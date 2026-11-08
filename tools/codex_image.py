"""Codex CLI の画像生成（組み込みの image_gen）でゲーム素材を作り、ゲーム用に整える。

使い方の詳しい説明は docs/image-assets.md と .claude/skills/game-image/SKILL.md。

例:
  python tools/codex_image.py --name slime --kind sprite --pixel --size 64 \
      --subject "a small green slime monster, facing the viewer"

流れ:
  1. 決まった形のプロンプトを組み立てて `codex exec` に標準入力で渡す
  2. Codex が image_gen で 1 枚作り、assets/_raw/<name>.png にコピーする（元の大きさのまま）
  3. このスクリプトが透明な余白を切り、指定の大きさに縮めて assets/<dir>/<name>.png に保存する
"""
import argparse
import os
import shutil
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(REPO, 'assets', '_raw')

# 素材の種類ごとの既定（保存先のフォルダ、背景を透明にするか、置き方、プロンプトの用途）
KINDS = {
    'sprite': dict(dir='sprites', transparent=True, anchor='bottom',
                   asset='2D top-down RPG character/enemy sprite for a browser game (Canvas 2D, 1 tile = 40px)',
                   framing='single character centered, full body, nothing cropped, three-quarter view '
                           'with the body and face turned to the RIGHT side of the image (the game mirrors it for left)'),
    'icon': dict(dir='icons', transparent=True, anchor='center',
                 asset='inventory/item icon for a browser RPG UI',
                 framing='single object centered, fills most of the canvas, nothing cropped'),
    'tile': dict(dir='tiles', transparent=False, anchor='center',
                 asset='seamless square ground tile texture for a top-down 2D RPG map',
                 framing='flat top-down view, edges tile seamlessly in all directions, no perspective'),
    'effect': dict(dir='effects', transparent=True, anchor='center',
                   asset='skill/spell visual effect for a top-down 2D RPG',
                   framing='single effect centered, nothing cropped'),
    'portrait': dict(dir='portraits', transparent=True, anchor='bottom',
                     asset='character portrait (bust) for RPG dialogue window',
                     framing='head and shoulders, centered, facing slightly to the side'),
    'background': dict(dir='backgrounds', transparent=False, anchor='center',
                       asset='full-screen background illustration for a browser RPG title/menu screen',
                       framing='wide landscape composition'),
}

PIXEL_STYLE = 'clean pixel art, crisp pixel clusters, limited palette, no anti-aliased blur'
SMOOTH_STYLE = ('flat 2D anime-style game illustration (JRPG monster/character art), cel shading with at most '
                'two flat tone steps, clean bold dark outlines, solid flat colors, simple readable shapes and silhouette')
# 絵柄を 3D・リアル寄りにしないための「入れないもの」（--pixel でないときに足す）
SMOOTH_AVOID = ('3D render, CGI, realistic, photorealistic, painterly brush texture, soft airbrush gradients, '
                'glossy specular highlights, rim light glow, depth of field, detailed fur rendering')


def find_codex():
    for name in ('codex.cmd', 'codex.exe', 'codex'):
        path = shutil.which(name)
        if path:
            return path
    sys.exit('codex が見つからない。`npm install -g @openai/codex@latest` で入れて `codex login` する')


def build_prompt(args, kind, raw_rel, refs):
    style = args.style or (PIXEL_STYLE if args.pixel else SMOOTH_STYLE)
    transparent = kind['transparent'] if args.transparent is None else args.transparent
    lines = [
        'Use the built-in image_gen tool (imagegen skill, built-in mode, NOT the CLI fallback) '
        'to generate exactly ONE image.',
        f'Then copy the generated PNG to `{raw_rel}` in this workspace (create folders if needed). '
        'Do not create, modify or delete any other files. Do not run the game.',
        'Finally print only the final saved path.',
        '',
        'Use case: stylized-concept',
        f'Asset type: {kind["asset"]}',
        f'Subject: {args.subject}',
        f'Style/medium: {style}',
        f'Composition/framing: {args.framing or kind["framing"]}',
    ]
    if args.palette:
        lines.append(f'Color palette: {args.palette}')
    lines.append('Background: ' + ('fully transparent (real alpha channel), no glow or halo around the subject'
                                   if transparent else 'opaque, fills the whole canvas'))
    if refs:
        lines.append('Input images: the attached image(s) are STYLE REFERENCES only '
                     '(match their art style, palette, line weight and proportions; do not copy the subject)')
    avoid = 'text, letters, labels, UI frames, watermark, signature, scenery, ground shadow, border'
    if not args.pixel and not args.style:
        avoid += ', ' + SMOOTH_AVOID
    if args.avoid:
        avoid += ', ' + args.avoid
    lines.append(f'Avoid: {avoid}')
    if args.extra:
        lines.append(f'Notes: {args.extra}')
    return '\n'.join(lines), transparent


def run_codex(prompt, refs, timeout):
    cmd = [find_codex(), 'exec', '--sandbox', 'workspace-write', '--skip-git-repo-check',
           '--ephemeral', '--color', 'never', '-C', REPO]
    for r in refs:
        cmd += ['-i', r]
    cmd.append('-')  # プロンプトは標準入力で渡す（改行を含むため）
    t = time.time()
    res = subprocess.run(cmd, input=prompt.encode('utf-8'), capture_output=True, timeout=timeout)
    out = res.stdout.decode('utf-8', 'replace') + res.stderr.decode('utf-8', 'replace')
    return res.returncode, out, time.time() - t


def postprocess(raw, out, size, pixel, anchor, alpha_cut, transparent, trim):
    from PIL import Image
    im = Image.open(raw).convert('RGBA')
    if transparent:
        if alpha_cut:
            a = im.getchannel('A').point(lambda v: 255 if v >= alpha_cut else 0)
            im.putalpha(a)
        if trim:
            box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
            if box:
                im = im.crop(box)
    if size:
        w, h = size
        resample = Image.NEAREST if pixel else Image.LANCZOS
        if transparent:
            scale = min(w / im.width, h / im.height)
            nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
            im = im.resize((nw, nh), resample)
            canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            x = (w - nw) // 2
            y = (h - nh) if anchor == 'bottom' else (h - nh) // 2
            canvas.paste(im, (x, y), im)
            im = canvas
        else:
            # 不透明な素材は中央を切り抜いて縦横比を合わせてから縮める
            scale = max(w / im.width, h / im.height)
            im = im.resize((max(w, round(im.width * scale)), max(h, round(im.height * scale))), resample)
            l, t = (im.width - w) // 2, (im.height - h) // 2
            im = im.crop((l, t, l + w, t + h))
    if not transparent:
        im = im.convert('RGB')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out)
    return im.size


def parse_size(s):
    if not s:
        return None
    if 'x' in s:
        w, h = s.lower().split('x')
        return int(w), int(h)
    return int(s), int(s)


def main():
    p = argparse.ArgumentParser(description='Codex CLI でゲーム素材の画像を作る')
    p.add_argument('--name', required=True, help='ファイル名（拡張子なし、英小文字とハイフン推奨）')
    p.add_argument('--subject', required=True, help='何を描くか（英語がおすすめ）')
    p.add_argument('--kind', choices=KINDS, default='sprite')
    p.add_argument('--size', help='仕上がりの大きさ。64 または 64x96。省略すると元の大きさ')
    p.add_argument('--pixel', action='store_true', help='ドット絵（縮小は最近傍、アルファを二値化）')
    p.add_argument('--style', help='絵柄を自分で書く（--pixel の既定を上書き）')
    p.add_argument('--palette', help='色の指定')
    p.add_argument('--framing', help='構図を自分で書く')
    p.add_argument('--avoid', help='入れてほしくないもの（既定に追加）')
    p.add_argument('--extra', help='そのほかの指示')
    p.add_argument('--ref', action='append', default=[], help='絵柄を合わせる参考画像（何回でも）')
    p.add_argument('--count', type=int, default=1, help='何枚作るか（name-1, name-2, ...）')
    p.add_argument('--out-dir', help='保存先フォルダ（既定は assets/<種類のフォルダ>）')
    tr = p.add_mutually_exclusive_group()
    tr.add_argument('--transparent', dest='transparent', action='store_true', default=None)
    tr.add_argument('--opaque', dest='transparent', action='store_false')
    p.add_argument('--alpha-cut', type=int, help='アルファがこの値未満を透明、以上を不透明にする（--pixel の既定 128）')
    p.add_argument('--no-trim', action='store_true', help='透明な余白を切らない')
    p.add_argument('--overwrite', action='store_true', help='同じ名前のファイルを上書きする')
    p.add_argument('--timeout', type=int, default=600)
    p.add_argument('--dry-run', action='store_true', help='プロンプトを表示するだけ')
    args = p.parse_args()

    kind = KINDS[args.kind]
    size = parse_size(args.size)
    out_dir = os.path.abspath(args.out_dir) if args.out_dir else os.path.join(REPO, 'assets', kind['dir'])
    refs = [os.path.abspath(r) for r in args.ref]
    for r in refs:
        if not os.path.isfile(r):
            sys.exit(f'参考画像が見つからない: {r}')
    alpha_cut = args.alpha_cut if args.alpha_cut is not None else (128 if args.pixel else None)

    failed = 0
    for i in range(1, args.count + 1):
        stem = args.name if args.count == 1 else f'{args.name}-{i}'
        out = os.path.join(out_dir, stem + '.png')
        if os.path.exists(out) and not args.overwrite:
            n = 2
            while os.path.exists(os.path.join(out_dir, f'{stem}-v{n}.png')):
                n += 1
            stem = f'{stem}-v{n}'
            out = os.path.join(out_dir, stem + '.png')
        raw = os.path.join(RAW_DIR, stem + '.png')
        raw_rel = os.path.relpath(raw, REPO).replace('\\', '/')
        prompt, transparent = build_prompt(args, kind, raw_rel, refs)
        if args.dry_run:
            print(prompt)
            return
        if os.path.exists(raw):
            os.remove(raw)
        print(f'[{i}/{args.count}] 生成中: {stem} ...', flush=True)
        code, log, sec = run_codex(prompt, refs, args.timeout)
        if code != 0 or not os.path.isfile(raw):
            failed += 1
            print(f'  失敗（終了コード {code}、{sec:.0f} 秒）。Codex の出力の最後:\n' + log[-2000:])
            continue
        got = postprocess(raw, out, size, args.pixel, kind['anchor'], alpha_cut, transparent, not args.no_trim)
        print(f'  完了（{sec:.0f} 秒）: {os.path.relpath(out, REPO)}  {got[0]}x{got[1]}  元画像: {raw_rel}')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
