# 画像素材（Codex CLI で作る）

ゲーム素材の画像（敵・主人公のスプライト、道具のアイコン、地面のタイル、技の演出、顔絵、背景）を、Codex CLI の組み込み画像生成（`image_gen`）で作る方法。
作った画像は `assets/` に置く。ゲームから読み込むのは `src/render.js` の `getSprite(パス)`（最初に使うときに読み込む）。

## 必要なもの

- Codex CLI（`codex --version` が 0.167 以上）。古いと設定のモデル（`~/.codex/config.toml` の `model`）を知らずに `model_not_found` で止まる → `npm install -g @openai/codex@latest`
- `codex login status` が `Logged in using ChatGPT`。組み込みの `image_gen` は ChatGPT ログインで使え、`OPENAI_API_KEY` はいらない
- Python と Pillow（後処理に使う）

## 使い方（`tools/codex_image.py`）

```bash
python tools/codex_image.py --name slime --kind sprite --pixel --size 64 --subject "a small green slime monster"
```

1. 決まった形のプロンプト（用途・題材・絵柄・構図・背景・入れないもの）を組み立て、`codex exec --sandbox workspace-write --ephemeral -` に標準入力で渡す
2. Codex が `image_gen` で 1 枚作り（`~/.codex/generated_images/<セッション>/` に保存される）、`assets/_raw/<name>.png` にコピーする（元の大きさ。1536×1024 などになる）
3. スクリプトが透明な余白を切り、`--size` に収まるよう縮め、`assets/<種類のフォルダ>/<name>.png` に保存する

1 枚 40〜60 秒ほど。別々のコマンドとして並べて走らせてもよい（2 つ同時で問題なかった）。

### おもな引数

| 引数 | 意味 |
|---|---|
| `--name` | ファイル名（拡張子なし。英小文字とハイフン） |
| `--subject` | 何を描くか。英語のほうが安定する |
| `--kind` | 素材の種類（下の表）。保存先・透明にするか・置き方・プロンプトの用途が決まる |
| `--size` | 仕上がりの大きさ（`64` か `64x96`）。省略すると元の大きさ |
| `--pixel` | ドット絵にする。縮小は最近傍、アルファを 128 で二値化（ふちのにじみを消す） |
| `--ref` | 絵柄を合わせる参考画像（何回でも）。`codex exec -i` で添付する。すでにある素材を渡すと絵柄がそろう |
| `--style` / `--palette` / `--framing` / `--avoid` / `--extra` | プロンプトの各行を書き足す・上書きする |
| `--count` | 同じ指示で何枚作るか（`name-1`, `name-2`, …） |
| `--transparent` / `--opaque` | 種類の既定を変える |
| `--alpha-cut` / `--no-trim` | アルファの二値化のしきい値 / 余白を切らない |
| `--overwrite` | 同名を上書き（指定しないと `name-v2` のように別名にする） |
| `--dry-run` | プロンプトを表示するだけ |

### 素材の種類（`KINDS`）

| `--kind` | 保存先 | 背景 | 置き方 | 目安の `--size` |
|---|---|---|---|---|
| `sprite` | `assets/sprites/` | 透明 | 下ぞろえ・中央 | 128（描くときに縮める。1 マス = 40px） |
| `icon` | `assets/icons/` | 透明 | 中央 | 48〜64 |
| `tile` | `assets/tiles/` | 不透明（中央を切り抜く） | — | 40 か 80 |
| `effect` | `assets/effects/` | 透明 | 中央 | 64〜128 |
| `portrait` | `assets/portraits/` | 透明 | 下ぞろえ | 128〜256 |
| `background` | `assets/backgrounds/` | 不透明 | — | 画面の大きさ |

`assets/_raw/`（元の大きさの画像）は git に入れない（`.gitignore`）。大きさを変えて作り直したいときは、同じ元画像からもう一度後処理すればよい。

## 絵柄（既定）

- `--pixel` なし: **フラットなアニメ調**（JRPG のモンスター絵、セル塗りで影は 2 段まで、はっきりした暗い輪郭線、ベタ塗り）。3D・CG・リアル・厚塗り・エアブラシのグラデーション・つやの強い光・毛並みの描き込みは `Avoid` に入れる（`SMOOTH_STYLE` / `SMOOTH_AVOID`）
- `--pixel`: ドット絵
- `sprite` は**右向きの 3/4 視点**で作る。ゲームは左を向くとき左右反転して描く

## ゲームで使っている素材

| ファイル | 使うところ | 作り方 |
|---|---|---|
| `assets/sprites/player.png` | 主人公の絵（`data/player.js` の `sprite`） | `--kind sprite --size 128 --out-dir assets/sprites --ref assets/sprites/enemies/wolf.png`。空色の服の剣士 |
| `assets/portraits/player.png` | 主人公の顔の絵（`data/player.js` の `face`。HUD の左上の仲間の欄とキャラクターの画面） | `--kind portrait --size 128 --ref assets/sprites/player.png --framing "head and shoulders bust, face centered, fills the frame"`。主人公の絵と同じ紺の髪・青いマントの胸から上 |
| `assets/sprites/enemies/<キー>.png` | 敵の絵（`data/enemies.js` の `sprite`。[enemies.md](enemies.md)） | `--kind sprite --size 128 --out-dir assets/sprites/enemies`。まずウルフを作り、ほかは `--ref assets/sprites/enemies/wolf.png` で絵柄をそろえた。2026-11-25 に足した 8 種類（slime / crow / goblin / scorpion / harpy / spider / mushroom / kobold）も同じ引数で、`--subject` に姿（色・持ち物・弱そうか）を英語で書いて作った |

新しい敵の絵を足すときは、同じ引数でキーの名前にして作り、`data/enemies.js` のその敵に `sprite` を書く。NPC の絵は `--out-dir assets/sprites/npcs` で NPC の `id` の名前にして作り、`world.js` のその NPC に `sprite` を書く（[drawing.md](drawing.md)）。

## うまく作るこつ

- 絵柄をそろえる: 最初に 1 枚、気に入る基準の素材を作り、以降は `--ref` でその素材を渡す
- 透明背景は組み込みの `image_gen` が本当のアルファで返す（RGB は黒いが A=0）。被写体のまわりにぼんやりした光（半透明）が付くことがあるので、ドット絵では `--pixel`（二値化）で消える
- 文字は入れない（既定の `Avoid` に入れてある）。画面の文字はゲーム側で描く
- 歩きのアニメーションなどコマを並べた絵は、コマごとに作るとずれる。1 枚の帯（ストリップ）としてまとめて頼み、あとで切り分ける（Codex の game-studio プラグインの `sprite-pipeline` スキルにこの手順がある）
- `codex exec` を直接使うときは、プロンプトを引数ではなく標準入力（最後に `-`）で渡す。Windows の `codex.cmd` は改行を含む引数を正しく渡せない。標準入力を渡さないと `Reading additional input from stdin...` で待つので、空でも何か渡す

## Claude Code から使う

`.claude/skills/game-image/SKILL.md`（スキル `game-image`）に、Claude Code がこのスクリプトを使って素材を作るときの手順をまとめてある。
