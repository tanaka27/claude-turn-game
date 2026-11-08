---
name: game-image
description: Codex CLI の組み込み画像生成（image_gen）でゲーム素材の画像（敵・主人公のスプライト、道具のアイコン、地面のタイル、技の演出、顔絵、背景）を作り、ゲーム用の大きさ・透明背景に整えて assets/ に保存する。「画像を作って」「スプライト／アイコン／素材を生成して」「codex で絵を描いて」と頼まれたときに使う。
---

# ゲーム素材の画像を Codex CLI で作る

詳しい説明・引数の表は `docs/image-assets.md`。ここは手順だけ。

## 1. 準備の確認（最初の 1 回だけでよい）

```bash
codex --version        # 0.167 以上。古ければ npm install -g @openai/codex@latest
codex login status     # "Logged in using ChatGPT" ならよい（API キーはいらない）
```

## 2. 作る

`tools/codex_image.py` を使う。Codex に直接プロンプトを書くより、用途・透明背景・入れないもの（文字・地面の影など）が毎回そろう。

```bash
python tools/codex_image.py --name <英小文字-ハイフン> --kind <sprite|icon|tile|effect|portrait|background> \
  --size <64 など> [--pixel] [--ref <絵柄を合わせる既存の画像>] --subject "<英語で題材>"
```

- `--subject` は英語で、題材だけを具体的に書く（色・形・表情・持ち物）。絵柄や構図は種類の既定に任せ、変えたいときだけ `--style` / `--framing` を足す
- 絵柄をそろえるため、`assets/` に同じ種類の素材がすでにあれば `--ref` で 1〜2 枚渡す
- 1 枚 40〜60 秒。時間がかかるので、複数枚は Bash の `run_in_background` で別々のコマンドとして並べて走らせる（同時 2〜3 本まで）
- 2 分の既定タイムアウトを超えることがあるので、前面で走らせるときは `timeout` を 600000 にする
- 失敗したら終了コード 1 と Codex の出力の最後が出る。`model_not_found` なら CLI が古い

## 3. 確かめる

- 出力の最後の行に保存先と大きさが出る（`assets/<種類>/<name>.png`）
- Read で画像を開いて見る。小さい素材は見えにくいので、Pillow で 4 倍（ドット絵は NEAREST）に拡大し、色の付いた背景に貼った確認用画像を scratchpad に作って見る
- 題材・絵柄・透明背景（ふちに黒や白が残っていないか）・切れていないかを見て、だめなら `--extra` か `--subject` を 1 点だけ直して作り直す（同名は自動で `-v2` になる。置き換えるなら `--overwrite`）

## 4. 片付けと記録

- ユーザーが使うと決めた素材だけ残す。試しに作ったものは消す（`assets/_raw/` は git に入らない）
- ゲームに組み込んだら、どの素材をどこで使うかを `docs/image-assets.md` に書き、`docs/history.md` に 1 行足して commit する（CLAUDE.md の実装ルール）
- ユーザーには保存先のパスと、使ったプロンプト（`--dry-run` で表示できる）を伝える
