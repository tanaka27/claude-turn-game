# 斬界アリーナ ターン制 実装まとめ（索引）

フィールドをマス目で歩き回り、各地にいるモンスターの群れをターン制で倒して経験値と素材を集め、レベルを上げていくブラウザ用 RPG。
リアルタイム版の「斬界アリーナ」（`C:/Users/tomo2/claude-test-game`）をもとに、2026-11-03 にターン制へ作り直した。
主人公と敵は速度に応じた順番で 1 回ずつ行動する（速いほど多く動ける）。敵も主人公と同じステータスを持ち、技に MP を使う。敵・装備・クエスト・成長はもとと同じ。マップはもとより広く、町が 3 つあり、町ごとに商人と鍛冶屋の品ぞろえが違う。
ビルド不要の素の HTML / JavaScript（Canvas 2D）で作っている。

このファイルは索引。詳しい内容はテーマごとに `docs/` に分けてある。**作業に関係するファイルだけを読む。**

## ドキュメント一覧

| ファイル | 内容 | 読むとき |
|---|---|---|
| [docs/data.md](docs/data.md) | データ（主人公・敵・装備・クエストなど）の置き場所と足し方、データの確認 | 敵・装備・クエストなどの中身を足す・変える。どのファイルに書くか迷う |
| [docs/gameplay.md](docs/gameplay.md) | 操作方法、ゲームの流れ | 操作やゲームの進み方を変える |
| [docs/turn.md](docs/turn.md) | ターンと速度（行動順の決め方）、時間で進むもの、入力 | 行動順・速度・時間の進み方・キー操作を変える |
| [docs/damage.md](docs/damage.md) | ステータスの意味、技の種類（物理と術）、ダメージ計算 | ステータス・ダメージ・物理と術を変える |
| [docs/units.md](docs/units.md) | 戦うキャラの集まり（`units`）、陣営、行動の決め方（`control`）、敵の狙う相手、当たったときの文と色、倒れたときの分かれ方、仲間の作り方（テスト用） | 主人公・敵・仲間の扱いを変える。仲間を足す |
| [docs/combat.md](docs/combat.md) | 技の定義形式（マス・行動回数）、主人公の技（`data/skills.js`）、敵の技の予告、判定の仕組み | 技・攻撃を変える |
| [docs/skill-use.md](docs/skill-use.md) | 技を使う道（どのキャラも同じ `useSkill`。攻撃・予告・ダッシュ・強化）、予告した技を出すとき、再使用待ちと MP の形と決まり（主人公と敵で違う `SKILL_RULES`）、覚えているスキル（`knownSkills` / `teachSkill`）とスキル欄（キー → スキル） | 技の使い方・再使用待ち・MP を変える。仲間や敵に技を使わせる。スキルの覚え方・キーの割り当てを変える |
| [docs/enemies.md](docs/enemies.md) | 敵の種類と数値（主人公と同じステータス）、敵の MP、敵のレベル補正 | 敵を足す・変える |
| [docs/enemy-ai.md](docs/enemy-ai.md) | 敵の AI（狙う技のくじ、状況による重み、遠くから撃つ敵の間合い、群れで取り囲む）、経路探索 | 敵の動きを変える・直す |
| [docs/world.md](docs/world.md) | ゾーン・門・湧き場所・NPC の配置、マス目、視線、ゾーンの読み込みと切り替え | マップ・ゾーン・湧き場所を変える |
| [docs/buildings.md](docs/buildings.md) | 入れる建物（建物の中のゾーン・入口）、NPC のステータス、話すだけの NPC（会話） | 建物を足す・入れるようにする、NPC を足す・ステータスを変える、会話を変える |
| [docs/progression.md](docs/progression.md) | 経験値とレベル、ステータスの成長（成長曲線）、クエスト、スキルを覚える決まり（今はレベルで覚える `learnAtLevel`） | 成長・クエスト・スキルの覚え方を変える |
| [docs/items.md](docs/items.md) | 素材とお金、落とし物、装備とレア度、回復薬、商人と鍛冶屋の品ぞろえ | 装備・経済・店を変える |
| [docs/menu.md](docs/menu.md) | 道具一覧・店（商人・鍛冶屋）・キャラクターの画面（開き方、道具を使う、装備の付け替え、素材を売る） | 画面の中身・道具の種類を変える |
| [docs/screens.md](docs/screens.md) | 画面の登録表（`SCREENS`。開く・閉じる・キー・ボタンの振り分け）、NPC の役目（`NPC_ROLES`）、施設（宿屋・倉庫・新しい店など）の足し方 | 画面や NPC の役目を足す・キーや閉じ方を変える |
| [docs/save.md](docs/save.md) | セーブの中身と保存先（ブラウザ・サーバー）、`server.py` の API | 保存する項目を増やす・変える、サーバーを直す |
| [docs/save-versions.md](docs/save-versions.md) | セーブの形の版と移し替え（`SAVE_MIGRATIONS`）、版の足し方、使えないセーブ（新しい版・壊れたもの）の扱い | 保存する項目を増やす・形を変える。セーブが読めないときの動きを変える |
| [docs/ui.md](docs/ui.md) | HUD（仲間の欄・行動順・スキル欄・メッセージ欄・地図・ツールチップ）に何を出すか | HUD の表示を変える |
| [docs/render.md](docs/render.md) | 描画の作り（色と大きさの置き場所 `data/theme.js`・`style.css`、描く道具、ワールドに何をどう描くか）、色・絵・演出・地形の足し方 | 見た目を変える（色・絵・演出・地形・画面の CSS） |
| [docs/image-assets.md](docs/image-assets.md) | 画像素材を Codex CLI（`image_gen`）で作る方法、`tools/codex_image.py` の使い方、`assets/` の置き場所 | 画像素材を作る・足す |
| [docs/testing.md](docs/testing.md) | 自動テスト（`node tests/run.js`）の動かし方、ゲームの読み込み方、乱数の固定、テストの足し方、テストが頼っている内部の名前 | テストを動かす・足す。大きく作りを変える前後 |
| [docs/history.md](docs/history.md) | 修正履歴（追記専用） | 変更を記録するとき。過去の経緯を調べるとき |

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面の土台。canvas、タイトル（続きから／はじめから）／道具一覧・店・キャラクター／クエスト／会話／一時停止の各画面（HTML だけ。見た目は `style.css`）。`params.js` → `data/*.js` → `world.js` → `src/*.js`（`main.js` が最後）の順に読み込む |
| `style.css` | HTML の画面（タイトル・道具一覧・店・キャラクター・クエスト・会話・一時停止）の見た目。`index.html` が `<link>` で読み込む（`index.html` を直接開いても読める）。canvas の中の色と大きさは `data/theme.js` |
| `params.js` | **ゲーム全体のしくみの数値**（ターンと速度、ダメージ計算、主人公のステータスの計算式、成長曲線、敵のレベル補正、お金・持ち物、敵の動き、セーブ） |
| `data/*.js` | **中身の定義**（主人公（スキルの覚え方・スキル欄の並びを含む）・スキル（`data/skills.js`）・敵・NPC の種類・装備・クエスト・ステータスの表示・強化・弱体（バフ・デバフ）・色）。詳しくは [docs/data.md](docs/data.md) |
| `world.js` | **マップの配置**（世界地図の並び（`mapPos`）と大きさ、地形の種類、ゾーンごとの大きさ、障害物、門、湧き場所とその敵レベル・再出現ターン数、復活地点、NPC（店の NPC はどの店か）、地面の色。px で書き、読み込むときにマスに直す） |
| `src/core.js` | 共通（ユーティリティ、画面の大きさ、ゲームの状態 `game`、戦うキャラ全員 `units` と主人公 `player`、陣営（`factionUnits` / `hostileTo`）、演出の追加、メッセージ欄 `log`） |
| `src/map.js` | マス目（通れるか・攻撃が通るか）、視線、直線のマス、経路探索、ゾーンの読み込みと切り替え、門 |
| `src/units.js` | 主人公と敵（とテスト用の仲間 `createAlly` / `addUnit`）の生成、マスの上の位置、そのマスのキャラ（`unitAt`）・敵の陣営（`opponents`）、行動 1 回にかかる時間、ステータスの計算（どのキャラも同じ `computeStats` / `refreshStats`）、強化・弱体（`addBuff` / `tickBuffs` / `clearBuffs`）、技の再使用待ちと MP の決まり（`SKILL_RULES` / `cooldownLeft` / `enoughMp` / `canUseSkill`）、覚えているスキルとスキル欄（`knowsSkill` / `teachSkill` / `skillSlotsOf`）、スキルの覚え方（`learnSkillsByLevel`）、経験値・レベル・復活 |
| `src/combat.js` | 技の範囲（マス）・判定・ダメージ（物理・術）、予告（出す・消す・判定する）、どのキャラも同じ技を使う道（`useSkill`、強化 `castBuff`、ダッシュ `dash`）、倒れたとき（主人公・敵・仲間で分ける） |
| `src/items.js` | 装備の生成、素材と落とし物（拾う・消える）、回復薬 |
| `src/save.js` | セーブ（ブラウザとサーバー）、古い形のセーブを今の形に直す（`readSave` / `SAVE_MIGRATIONS`）、使えないセーブの扱い |
| `src/player.js` | 入力と主人公の行動（移動・通常攻撃・スキル欄のキーからスキルを引く `skillByKey`・スキルを狙って使う `castSkill`） |
| `src/ai.js` | 敵の AI（狙う相手の選び方、1 回の行動、狙う技の選び方）、湧き場所 |
| `src/turn.js` | ターンの進め方（速度による行動順、キャラごとの行動の決め方 `CONTROLLERS`、予告した技を出す・再使用待ちを減らすとき、行動の後始末 `endTurn`、時間を進める、行動順の表示用） |
| `src/ui.js` / `src/quests.js` | 画面の登録表（`SCREENS` / `registerScreen` / `openScreen` / `closeMenu`・画面のキー `screenKey`）、道具一覧と店とキャラクター・NPC の役目（`NPC_ROLES` / `talkTo`）・会話・一時停止の画面 / クエスト（クエストの画面も登録表に入れる） |
| `src/render.js` / `src/hud.js` | ワールドの描画と描く道具（`fontOf` / `outlineText`）/ HUD・行動順・メッセージ欄・ミニマップ・ツールチップ（`drawTooltipBox`）。色と大きさは `data/theme.js`（[docs/render.md](docs/render.md)） |
| `src/validate.js` | 起動時のデータの確認 |
| `src/main.js` | ゲームの開始、クリックで歩く、毎フレームの演出、メインループ、起動処理 |
| `tests/run.js` / `tests/harness.js` / `tests/helpers.js` | 自動テストの実行役（`node tests/run.js`）/ ゲームの本物のファイルを `index.html` の順に vm で読み込む土台（ブラウザの代わり・乱数の固定）/ テストの道具（内部の名前に触るのはここだけ）。詳しくは [docs/testing.md](docs/testing.md) |
| `tests/*.test.js` | テスト本体（ステータス・強化・どのキャラにも効く強化と弱体・ダメージ・技の範囲・行動順・敵の動き・倒したとき・主人公の行動・どのキャラも同じ技を使う道・スキルを覚える・スキル欄・セーブ・セーブの版の移し替え・主人公の陣営のほかのキャラ（仲間）・自動で戦わせる通し試験） |
| `start.bat` | ダブルクリックで `server.py` を起動し、ブラウザでゲームを開く（Windows 用。ポートは中の `PORT`。8766 が使われていると止まって知らせる） |
| `server.py` | ローカルサーバー（ゲームのファイルを配り、セーブを `saves/save.json` に読み書きする）。詳しくは [docs/save.md](docs/save.md) |
| `.claude/launch.json` | 確認用ローカルサーバーの設定（`python server.py`） |
| `tools/codex_image.py` | Codex CLI で画像素材を作り、大きさと透明背景を整えて `assets/` に保存する（ゲームの実行には使わない）。詳しくは [docs/image-assets.md](docs/image-assets.md) |
| `.claude/skills/game-image/` | Claude Code 用のスキル（画像素材の作り方の手順） |
| `assets/` | 画像素材（主人公の絵 `assets/sprites/player.png` と敵の絵 `assets/sprites/enemies/` を `src/render.js` の `getSprite` で読み込む）。`assets/_raw/` は生成した元の大きさの画像で git に入れない |

### 起動方法

- `start.bat` をダブルクリックする（おすすめ。サーバーを起動してブラウザでゲームを開く。遊び終わったら黒いウィンドウを閉じる）
- または `python server.py` を実行して http://localhost:8766/ を開く（`python server.py --open` ならブラウザも開く）。どちらもセーブがサーバーの `saves/save.json` にも残る
- `index.html` をブラウザで直接開く、または `python -m http.server` でも遊べる（セーブはブラウザの `localStorage` だけ）

> 注意: `src/*.js` はモジュールではなく、ふつうの `<script>` として順に読み込む。トップレベルの `const` / `let` / `function` は全ファイルで共有され、`window` のプロパティにならないもの（`const` / `let`）は名前で直接参照する。ファイルを読み込んだ時点で動く処理（イベントの登録など）は、それより前のファイルのものしか使えない。起動処理は `src/main.js` の最後にまとめる。トップレベルの名前がファイル間で重なると読み込みエラーになる。

## メインループ（`frame`、`src/main.js`）

- ゲーム内の時間（ターン）は、主人公が行動したときだけ進む（`endPlayerAction` → `runUntilInput`。ほかのキャラは主人公の番が来るまでそれぞれの `control` で行動する。[docs/turn.md](docs/turn.md)）。キー入力・クリックのイベントで行動する
- 毎フレーム（`requestAnimationFrame`、最大 0.05 秒）は、実時間で動くものだけを進める: クリックで歩く（`stepTravel`）、倒れてから復活するまで、自動セーブ、描く位置の追いつき・演出（`updateFx`）、描画
- 次のフレームは処理の最初に予約し、更新と描画は `try/catch` で囲む（途中でエラーが出ても画面が止まらないようにするため）
- デバッグ用に `window.__game` から `game` / `player` / `units` / `enemies`（敵の陣営）/ `saveStore` を見られる
- 起動時: `validateData`（データの確認）→ `loadZone`（タイトルの背景）→ `initSave`（セーブの確認）が終わったら `refreshTitle`

## 今後の候補（未実装）

- 実際に遊んだうえでのバランス調整（ターン制にしたときの数値は、自動で戦わせて確かめただけ。Lv1 の群れは HP 半分ほど残って勝てる。狼王は Lv6・速度 120 前後だと簡単な戦い方では負け、速度 175 前後なら勝てる）
- 敵の HP・攻撃の伸びと、すばやさの成長（速度）の釣り合いの見直し
- 視界（見えていないマスを暗くする）
- 大きいボスを 2×2 マスにする（今はどの敵も 1 マス）
- キーボードだけでスキルを狙う方法（今はマウスで狙う）
- クエストの種類を増やす（集める・届ける）、クエストをくれる NPC を増やす（宿場・隠れ里にはまだ店しかない。冒険者ギルドは始まりの町だけ）
- ほかの家にも入れるようにする（今は始まりの町の宿だけ。[docs/buildings.md](docs/buildings.md)）
- 効果音・BGM
- 敵の種類や、状態異常の追加。強化・弱体（ステータスに倍率を掛けるもの。`data/buffs.js`）のしくみは主人公・敵・仲間のだれにでも効くようになった（速度を下げれば行動の回数も減る）が、データにあるのは攻撃力アップ（主人公が自分にかける闘気）だけ。弱体の種類、敵の技・主人公の技で相手に弱体をかける（技に「当たったらかける効果」を書けるようにする）、敵が使う強化（技を使う道はどのキャラも同じ `useSkill` になったので、敵も強化の技を自分に使えるが、データと敵の AI の選び方がない）は未実装。毒（行動ごとのダメージ）・スタン（行動できない）のような別の種類の効果も未実装（足す場所は [docs/combat.md](docs/combat.md) の「強化・弱体」）
- スマートフォン（タッチ操作）への対応
- 画面に出す文章（メッセージ欄など、`src/` に直接書いてあるもの）をデータに分ける
- セーブスロットを複数にする（今は 1 つ。サーバーの API は `/api/save` だけ）
