# 斬界アリーナ ターン制（ブラウザ用 RPG）

- リアルタイム版の斬界アリーナ（`C:/Users/tomo2/claude-test-game`）をもとにしたターン制版。主人公と敵は速度に応じた順番で行動する（`docs/turn.md`）

- 素の HTML / JavaScript（Canvas 2D）で作っている。ビルド不要
- ゲーム全体のしくみの数値（ターンと速度・ダメージ計算・成長・敵のレベル補正・お金・敵の動き・セーブ）は `params.js` に定義する。距離はマス、時間はターン（行動回数）で書く
- 主人公・敵・装備・クエスト・ステータスの表示・意味を持つ色・画面に出す文章（`data/text.js`）は `data/*.js` に定義する（置き場所は `docs/data.md`）
- マップの配置（地形の種類・ゾーンの地形・門・湧き場所とその敵レベル・復活地点・NPC）は `world.js` に定義する
- ゲーム本体は `src/*.js`（ふつうの `<script>` で順に読み込む）。`src/` に数値やデータを直接書かない
- 実装の説明は、索引の `IMPLEMENTATION.md` と、テーマごとの `docs/*.md` に分けてある
  - まず `IMPLEMENTATION.md` の「ドキュメント一覧」を見て、**作業に関係する `docs/` のファイルだけを読む**（全部は読まない）
  - `docs/history.md`（修正履歴）は追記専用。過去の経緯を調べるとき以外は読まなくてよい

## 実装ルール

- **実装や修正をするたびに、同じ作業の中でドキュメントを最新の内容に更新する**
  - 変更に関係する `docs/` のファイルの節（パラメータの表、仕組みなど）を書き直す
  - ファイル構成・起動方法・メインループを変えたら `IMPLEMENTATION.md` を直す
  - `docs/history.md` の表の末尾に、日付と変更内容（不具合なら原因も）を 1 行追加する
  - 実装した項目は `IMPLEMENTATION.md` の「今後の候補」から外す
- `params.js`・`data/*.js`・`world.js` の数値を変えたら、該当する `docs/` の表も合わせて直す
- 新しいテーマが既存のどのファイルにも合わないときは `docs/` に新しいファイルを作り、`IMPLEMENTATION.md` の「ドキュメント一覧」に 1 行足す。1 ファイルが大きくなりすぎたら（目安 8KB）分ける
- **実装や修正をしたら、動作確認とドキュメントの更新まで済ませたうえで、必ず同じ作業の中で git に commit し、続けて GitHub（`origin` = https://github.com/tanaka27/claude-turn-game.git）に push する**（変更内容がわかるメッセージを付ける。`git push`。push に失敗したらそのことを報告する）

## 動作確認

- `python server.py` で起動し、http://localhost:8766/ を開く（遊ぶ人向けには `start.bat`）（`.claude/launch.json` に設定あり。ポートは引数か環境変数 `PORT` で変えられる）
- `window.__game` から `game` / `player` / `enemies` / `saveStore` の状態を確認できる
- 進行はサーバーの `saves/save.json` と `localStorage` の `zankai-turn-save` に保存される（新しいほうを使う）。最初から確認したいときは両方を消す
- 起動時のデータの食い違いはコンソールに `[データの確認]` として出る
- 自動テストは `node tests/run.js`（Node.js だけで動く。失敗すると終了コード 1。`docs/testing.md`）
