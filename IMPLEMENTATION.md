# 斬界アリーナ ターン制 実装まとめ（索引）

フィールドをマス目で歩き回り、各地にいるモンスターの群れをターン制で倒して経験値と素材を集め、レベルを上げていくブラウザ用 RPG。ステータスはレベルではなく行動（殴る・受ける・術・よける）で伸び、伸びやすさは潜在で決まる（レベルアップで潜在が上がる）。ちから は 筋力 × 0.7 + 器用さ × 0.3、みのまもり は 筋力 × 0.32 + 器用さ × 0.08、術攻撃力 は 知力 + 魔力 × 0.3、術防御 は 知力 × 0.16 + 精神力 × 0.24、さいだいHP は 体力 + 意思、さいだいMP は 魔力 + (知力 + 精神力) ÷ 3 で決まる。
リアルタイム版の「斬界アリーナ」（`C:/Users/tomo2/claude-test-game`）をもとに、2026-11-03 にターン制へ作り直した。
主人公と敵は速度に応じた順番で 1 回ずつ行動する（速いほど多く動ける）。敵も主人公と同じステータスを持ち、技に MP を使う。敵・装備・クエスト・成長はもとと同じ（東と南の地方には、その地方だけの敵 12 種類を足した）。大きなワールドマップ（文字で描く 144 × 96 マス。東と南の陸へは橋で渡る）の上に町 7 つ・ダンジョン 3 つの入口があり、踏むと中に入る。右下の世界地図は拡大・ドラッグ・大きく出すことができる。町ごとに商人と鍛冶屋の品ぞろえが違う。武器は 剣・短剣・斧・杖 の 4 種類（武器種）で、鍛冶屋ではモンスターの素材から武器を作れる（レア度はアンコモン・レア・エピックのくじ）。
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
| [docs/enemies-regions.md](docs/enemies-regions.md) | 東と南の地方だけに出る敵 12 種類の数値・技・落とす素材 | 新しい地方の敵を足す・変える |
| [docs/enemy-ai.md](docs/enemy-ai.md) | 敵の AI（狙う技のくじ、状況による重み、遠くから撃つ敵の間合い、群れで取り囲む）、経路探索 | 敵の動きを変える・直す |
| [docs/world.md](docs/world.md) | 町・ダンジョンのゾーン・門・湧き場所・NPC の配置、マス目、視線、ゾーンの読み込みと切り替え | マップ・ゾーン・湧き場所を変える |
| [docs/overworld.md](docs/overworld.md) | ワールドマップ（文字で描く地図・町とダンジョンの入口・地方・ワールドマップの湧き場所） | ワールドマップを描き直す、町・ダンジョンを足す、地方を変える |
| [docs/overworld-camps.md](docs/overworld-camps.md) | ワールドマップの湧き場所の表（地方・位置・敵レベル・再出現・敵） | ワールドマップの湧き場所を足す・変える |
| [docs/worldmap.md](docs/worldmap.md) | 世界地図（M キーでの切り替え、拡大・縮小・ドラッグ・大きく出す、描き方、`WORLD.worldMap`） | 世界地図の操作・大きさ・描くものを変える |
| [docs/buildings.md](docs/buildings.md) | 入れる建物（建物の中のゾーン・入口）、NPC のステータス、話すだけの NPC（会話） | 建物を足す・入れるようにする、NPC を足す・ステータスを変える、会話を変える |
| [docs/progression.md](docs/progression.md) | 経験値とレベル（レベルアップで潜在が上がる）、スキルを覚える決まり（今はレベルで覚える `learnAtLevel`） | レベル・経験値・スキルの覚え方を変える |
| [docs/growth.md](docs/growth.md) | 行動によるステータスの伸び（行動で能力値が小数点以下まで伸び、一の位が上がるとステータスが上がる）と潜在（伸びやすさ。レベルアップで上がり、伸びると・時間で下がる）、潜在の見え方 | ステータスの伸び方・潜在・行動の出来事を変える |
| [docs/quests.md](docs/quests.md) | クエストのデータの形（目標 `goal`）、目標の種類の表（`QUEST_GOALS`: 倒す・集める・話しかける）、進み具合を進める出来事（`questEvent`）、今のクエストの表、クエストの画面、クエスト・目標の種類の足し方 | クエストを足す・変える。新しい目標の種類を足す |
| [docs/items.md](docs/items.md) | 素材とお金、落とし物、装備とレア度、商人と鍛冶屋の品ぞろえ | 装備・経済・店を変える |
| [docs/crafting.md](docs/crafting.md) | 武器種（剣・短剣・斧・杖。`ITEMS.slots.weapon.types`）、鍛冶屋で素材から武器を作る（作り方 `recipes`・レア度のくじ `craftRarities`・`craftItem`）と作り方の表 | 武器種を足す・変える。作れる武器を足す・変える。作るしくみを変える |
| [docs/consumables.md](docs/consumables.md) | 道具（回復薬など使うとなくなるもの）の定義（`ITEMS.consumables`）、効果の種類（`ITEM_EFFECTS`）、どのキャラも同じ使う道（`useConsumable`）、道具・効果の種類の足し方 | 道具を足す・変える。新しい効果（MP 回復・強化・弱体を消すなど）を足す。仲間に道具を使わせる |
| [docs/menu.md](docs/menu.md) | 道具一覧・店（商人・鍛冶屋）・キャラクターの画面（開き方、道具を使う、装備の付け替え、素材を売る） | 画面の中身を変える |
| [docs/character.md](docs/character.md) | キャラクターの画面（タブ: ステータス・装備・持ち物・クエスト、タブの切り替えと足し方） | キャラクターの画面の中身・タブを変える |
| [docs/screens.md](docs/screens.md) | 画面の登録表（`SCREENS`。開く・閉じる・キー・ボタンの振り分け）、NPC の役目（`NPC_ROLES`）、施設（宿屋・倉庫・新しい店など）の足し方 | 画面や NPC の役目を足す・キーや閉じ方を変える |
| [docs/save.md](docs/save.md) | いつ保存するか（自動・一時停止画面の手動のセーブ）、保存先（ブラウザ・サーバー）、保存できないときの知らせ、読み込みと開始 | 保存のタイミング・保存先・セーブの説明の文を変える |
| [docs/save-format.md](docs/save-format.md) | セーブの項目（今の形）と、読むときのない・おかしな値の扱い | 保存する項目を増やす・変える |
| [docs/server.md](docs/server.md) | `server.py`（起動・配信・セーブの API）、古いタブで新しい進行を上書きしないしくみ（タブへの知らせとサーバーの競合の見分け） | サーバーを直す。タブ・競合の扱いを変える |
| [docs/save-versions.md](docs/save-versions.md) | セーブの形の版と移し替え（`SAVE_MIGRATIONS`）、版の足し方、使えないセーブ（新しい版・壊れたもの）の扱い | 保存する項目を増やす・形を変える。セーブが読めないときの動きを変える |
| [docs/ui.md](docs/ui.md) | HUD（仲間の欄・行動順・スキル欄・メッセージ欄・地図・ツールチップ）とワールド（予告・キャラ・落とし物・門・NPC など）に何を出すか | 画面に出すものを変える |
| [docs/drawing.md](docs/drawing.md) | キャラ（主人公・敵・ボス・仲間・NPC）の描く手順と種類ごとの描き方 `UNIT_LOOK`、絵のありか（NPC の絵）・アニメーションの入り口、地形 `TERRAIN_DRAW`・演出 `EFFECT_TYPES` の登録表と演出を作る関数 `fx〇〇`、それぞれの足し方 | キャラ・NPC・地形・演出の見た目を変える・足す |
| [docs/text.md](docs/text.md) | 画面に出す文章の置き場所（`data/text.js` の `TEXT`）、ひな形の `{名前}` と `txt` / `fmt`、メッセージ欄・浮かぶ文字の色（`THEME.msg` / `THEME.float`）、言い回しの変え方、`src/` と `index.html` に残る文字 | メッセージ・画面の文の言い回しを変える。文を足す |
| [docs/render.md](docs/render.md) | 描画の作り（色と大きさの置き場所 `data/theme.js`・`style.css`、`THEME` のまとまり、描く道具）、色の足し方 | 色・大きさ・書体・画面の CSS を変える |
| [docs/image-assets.md](docs/image-assets.md) | 画像素材を Codex CLI（`image_gen`）で作る方法、`tools/codex_image.py` の使い方、`assets/` の置き場所 | 画像素材を作る・足す |
| [docs/testing.md](docs/testing.md) | 自動テスト（`node tests/run.js`）の動かし方、ゲームの読み込み方、乱数の固定、テストの足し方、テストが頼っている内部の名前 | テストを動かす・足す。大きく作りを変える前後 |
| [docs/history.md](docs/history.md) | 修正履歴（追記専用） | 変更を記録するとき。過去の経緯を調べるとき |

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面の土台。canvas、タイトル（続きから／はじめから）／道具一覧・店・キャラクター／クエスト／会話／一時停止（セーブのボタン）／保存を止めたときの知らせの各画面（HTML だけ。見た目は `style.css`）。`params.js` → `data/*.js` → `world.js` → `src/*.js`（`main.js` が最後）の順に読み込む |
| `style.css` | HTML の画面（タイトル・道具一覧・店・キャラクター・クエスト・会話・一時停止）の見た目。`index.html` が `<link>` で読み込む（`index.html` を直接開いても読める）。canvas の中の色と大きさは `data/theme.js` |
| `params.js` | **ゲーム全体のしくみの数値**（ターンと速度、ダメージ計算、主人公のステータスの計算式、行動によるステータスの伸びと潜在、敵のレベル補正、お金・持ち物、敵の動き、セーブ） |
| `data/*.js` | **中身の定義**（主人公（スキルの覚え方・スキル欄の並びを含む）・スキル（`data/skills.js`）・敵・NPC の種類・装備・クエスト・ステータスの表示・強化・弱体（バフ・デバフ）・色・画面に出す文章（`data/text.js`））。詳しくは [docs/data.md](docs/data.md) |
| `world.js` | **マップの配置**（ワールドマップの文字の地図・入口・地方、地面と地形の種類、町・ダンジョンのゾーンごとの大きさ、障害物、門、湧き場所とその敵レベル・再出現ターン数、復活地点、NPC（店の NPC はどの店か）、地面の色。px で書き、読み込むときにマスに直す） |
| `src/core.js` | 共通（ユーティリティ、画面の大きさ、ゲームの状態 `game`、戦うキャラ全員 `units` と主人公 `player`、陣営（`factionUnits` / `hostileTo`）、演出を作る関数（`fxRing` / `fxHit` など）、メッセージ欄 `logMsg`、画面に出す文章を引く `txt` / `fmt`） |
| `src/map.js` | マス目（通れるか・攻撃が通るか）、視線、直線のマス、経路探索、ゾーンの読み込みと切り替え、門 |
| `src/units.js` | 主人公と敵（とテスト用の仲間 `createAlly` / `addUnit`）の生成、マスの上の位置、そのマスのキャラ（`unitAt`）・敵の陣営（`opponents`）、行動 1 回にかかる時間、ステータスの計算（どのキャラも同じ `computeStats` / `refreshStats`）、強化・弱体（`addBuff` / `tickBuffs` / `clearBuffs`）、技の再使用待ちと MP の決まり（`SKILL_RULES` / `cooldownLeft` / `enoughMp` / `canUseSkill`）、覚えているスキルとスキル欄（`knowsSkill` / `teachSkill` / `skillSlotsOf`）、スキルの覚え方（`learnSkillsByLevel`）、行動によるステータスの伸びと潜在（`growthEvent` / `trainStat` / `decayPotential`）、経験値・レベル・復活 |
| `src/combat.js` | 技の範囲（マス）・判定・ダメージ（物理・術）、予告（出す・消す・判定する）、どのキャラも同じ技を使う道（`useSkill`、強化 `castBuff`、ダッシュ `dash`）、倒れたとき（主人公・敵・仲間で分ける） |
| `src/items.js` | 装備の生成（武器種 `gearKindOf` / `itemKind`）、鍛冶屋で作る（`craftBlock` / `craftItem`）、素材と落とし物（拾う・消える）、道具（効果の種類 `ITEM_EFFECTS`、使えるかの判定 `consumableBlock`、どのキャラも同じ使う道 `useConsumable`） |
| `src/save.js` | セーブ（ブラウザとサーバー）、古い形のセーブを今の形に直す（`readSave` / `SAVE_MIGRATIONS`）、使えないセーブの扱い、ほかのタブとの競合（`claimSave` / `blockSaving`） |
| `src/player.js` | 入力と主人公の行動（移動・通常攻撃・スキル欄のキーからスキルを引く `skillByKey`・スキルを狙って使う `castSkill`・道具のキー `consumableByKey`） |
| `src/ai.js` | 敵の AI（狙う相手の選び方、1 回の行動、狙う技の選び方）、湧き場所 |
| `src/turn.js` | ターンの進め方（速度による行動順、キャラごとの行動の決め方 `CONTROLLERS`、予告した技を出す・再使用待ちを減らすとき、行動の後始末 `endTurn`、時間を進める、行動順の表示用） |
| `src/ui.js` / `src/quests.js` | 画面の登録表（`SCREENS` / `registerScreen` / `openScreen` / `closeMenu`・画面のキー `screenKey`）、道具一覧と店とキャラクター・NPC の役目（`NPC_ROLES` / `talkTo`）・会話・一時停止の画面 / クエスト（目標の種類の表 `QUEST_GOALS`、出来事を伝える `questEvent`、達成の確かめ `settleQuest`。クエストの画面も登録表に入れる） |
| `src/render.js` / `src/hud.js` | ワールドの描画（キャラ `drawUnit`・地形 `TERRAIN_DRAW`・演出 `EFFECT_TYPES` の登録表）と描く道具（`fontOf` / `outlineText`）/ HUD・行動順・メッセージ欄・ミニマップ・ツールチップ（`drawTooltipBox`）。色と大きさは `data/theme.js`（[docs/render.md](docs/render.md)） |
| `src/validate.js` | 起動時のデータの確認 |
| `src/main.js` | ゲームの開始、クリックで歩く、毎フレームの演出、メインループ、起動処理 |
| `tests/run.js` / `tests/harness.js` / `tests/helpers.js` / `tests/scope-scan.js` | 自動テストの実行役（`node tests/run.js`）/ ゲームの本物のファイルを `index.html` の順に vm で読み込む土台（ブラウザの代わり・乱数の固定）/ テストの道具（内部の名前に触るのはここだけ）/ トップレベルの名前とそれを隠すローカルの名前を拾うスキャナ。詳しくは [docs/testing.md](docs/testing.md) |
| `tests/e2e/*.e2e.js` | ブラウザの通しテスト（本物の `server.py` と Chromium（Playwright）。`node tests/e2e/savesync.e2e.js`。Playwright がなければ何もしない）。詳しくは [docs/testing.md](docs/testing.md) |
| `tests/*.test.js` | テスト本体（ステータス・行動によるステータスの伸びと潜在・武器種と鍛冶屋で作る・強化・どのキャラにも効く強化と弱体・ダメージ・技の範囲・行動順・敵の動き・倒したとき・主人公の行動・どのキャラも同じ技を使う道・スキルを覚える・スキル欄・道具・クエストの目標の種類・セーブ・手動のセーブと保存できないときの知らせ・古いタブで上書きしない・セーブの版の移し替え・主人公の陣営のほかのキャラ（仲間）・画面に出す文章・トップレベルの名前の重なりと隠し・自動で戦わせる通し試験） |
| `start.bat` | ダブルクリックで `server.py` を起動し、ブラウザでゲームを開く（Windows 用。ポートは中の `PORT`。8766 が使われていると止まって知らせる） |
| `server.py` | ローカルサーバー（ゲームのファイルを配り、セーブを `saves/save.json` に読み書きする。ほかのタブのセーブを上書きしそうなら 409）。詳しくは [docs/server.md](docs/server.md) |
| `.claude/launch.json` | 確認用ローカルサーバーの設定（`python server.py`） |
| `tools/codex_image.py` | Codex CLI で画像素材を作り、大きさと透明背景を整えて `assets/` に保存する（ゲームの実行には使わない）。詳しくは [docs/image-assets.md](docs/image-assets.md) |
| `.claude/skills/game-image/` | Claude Code 用のスキル（画像素材の作り方の手順） |
| `assets/` | 画像素材（主人公の絵 `assets/sprites/player.png` と敵の絵 `assets/sprites/enemies/` を `src/render.js` の `getSprite` で読み込む）。`assets/_raw/` は生成した元の大きさの画像で git に入れない |

### 起動方法

- `start.bat` をダブルクリックする（おすすめ。サーバーを起動してブラウザでゲームを開く。遊び終わったら黒いウィンドウを閉じる）
- または `python server.py` を実行して http://localhost:8766/ を開く（`python server.py --open` ならブラウザも開く）。どちらもセーブがサーバーの `saves/save.json` にも残る
- `index.html` をブラウザで直接開く、または `python -m http.server` でも遊べる（セーブはブラウザの `localStorage` だけ）

> 注意: `src/*.js` はモジュールではなく、ふつうの `<script>` として順に読み込む。トップレベルの `const` / `let` / `function` は全ファイルで共有され、`window` のプロパティにならないもの（`const` / `let`）は名前で直接参照する。ファイルを読み込んだ時点で動く処理（イベントの登録など）は、それより前のファイルのものしか使えない。起動処理は `src/main.js` の最後にまとめる。トップレベルの名前がファイル間で重なると読み込みエラーになる。重なりと、ローカルの名前がトップレベルの名前を隠すことは `tests/globals.test.js` が見張る（[docs/testing.md](docs/testing.md) の「トップレベルの名前」）。

### トップレベルの名前の付け方

トップレベルの名前は全ファイル（とテストの `g.名前`）で共有されるので、短い名前・ありふれた名前（`T`・`log`・`menu` など）は使わず、ほかと重ならない、何かが分かる名前にする。

- データ・調整用の数値の表、定数、マップと画面の大きさ: UPPER_CASE（`PARAMS`・`ITEMS`・`THEME`・`TILE`・`MAP_W`・`COLS`・`VIEW_W`・`VIEW_SCALE`・`SAVE_VERSION`）。`PARAMS` / `THEME` / `PLAYER` の一部への近道も UPPER_CASE で、どこの一部か分かる名前にする（`TURN` = `PARAMS.turn`、`FIELD` / `FIELD_AI` / `PROGRESSION` / `ECON`、`FX_THEME` = `THEME.fx`、`FACTION_COLOR`、`PARTY_CARD`、`BASIC_ATTACK`、`DERIVED_STATS`）。データ全体への近道（もとの `P` / `IT` のようなもの）は作らず、もとの名前（`PARAMS` / `ITEMS`）をそのまま使う
- 関数と、書き換わる状態: camelCase で、何をするか・何の状態か分かる名前（`logMsg`・`doPlayerAction`・`menuState`・`talkState`・`tileCenter`・`tileDist`・`camera`・`floatTexts`・`lastFrameTime`）
- 短いまま残しているもの（どこでも使う道具で、意味がはっきりしているもの）: `$`（`document.getElementById`）、`txt` / `fmt`（画面に出す文章を引く。[docs/text.md](docs/text.md)）、`ctx` / `canvas`、`rand` / `randInt` / `clamp` / `DEG` / `TAU`。これと同じ名前をほかで使わない
- 関数の引数・ローカルの名前は、トップレベルの名前と同じにしない（隠すと、その関数の中でトップレベルのものが使えず、読み違えやすい）。わざと同じにするときは `tests/globals.test.js` の `SHADOW_ALLOW` に理由を書く
- データのファイルの名前（`PARAMS`・`PLAYER`・`ENEMIES`・`ITEMS`・`QUESTS`・`WORLD`・`THEME`・`TEXT`・`SKILLS`・`BUFFS`・`NPC_KINDS`・`STATS`・`UNIT_LOOK` など）は、データを書く人とドキュメントが使うので変えない

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
- 集める（`collect`）・話しかける（`talk`）クエストを実際に作る（目標の種類はあるが、今のクエストはどれも討伐。[docs/quests.md](docs/quests.md)）、品物をほかの NPC に届ける種類、クエストをくれる NPC を増やす（宿場・隠れ里・岩根の村・潮風の港・霜の村・砂の都にはまだ店と話すだけの NPC しかない（話すだけの NPC は各町に 4〜6 人いる）。冒険者ギルドは始まりの町だけ）
- ほかの家にも入れるようにする（今は始まりの町の宿だけ。[docs/buildings.md](docs/buildings.md)）
- ワールドマップの続き（[docs/overworld.md](docs/overworld.md)）: ダンジョンを複数の階にする、新しく足した東と南の地方にダンジョンとボスを置く、船や橋で海の向こうへ渡る、地方ごとの地面の飾り（今の飾りの小石はワールドマップ全体で同じ色）
- 武器種の続き（[docs/crafting.md](docs/crafting.md)）: 槍・弓（通常攻撃の届く距離が変わる）、武器種でしか使えないスキル、武器種ごとの成長（短剣で殴ると器用さが伸びやすいなど）、作り方に素材らしい追加性能を決めて付ける、作った装備を素材で鍛える
- 効果音・BGM
- 状態異常の追加（敵の種類は 2026-11-25 に通常の敵を 8 種類足した）。強化・弱体（ステータスに倍率を掛けるもの。`data/buffs.js`）のしくみは主人公・敵・仲間のだれにでも効くようになった（速度を下げれば行動の回数も減る）が、データにあるのは攻撃力アップ（主人公が自分にかける闘気）だけ。弱体の種類、敵の技・主人公の技で相手に弱体をかける（技に「当たったらかける効果」を書けるようにする）、敵が使う強化（技を使う道はどのキャラも同じ `useSkill` になったので、敵も強化の技を自分に使えるが、データと敵の AI の選び方がない）は未実装。毒（行動ごとのダメージ）・スタン（行動できない）のような別の種類の効果も未実装（足す場所は [docs/combat.md](docs/combat.md) の「強化・弱体」）
- スマートフォン（タッチ操作）への対応
- セーブスロットを複数にする（今は 1 つ。サーバーの API は `/api/save` だけ）
- 道具を仲間に使う画面（相手を選ぶ。使う道 `useConsumable(主人公, id, 仲間)` はもうある）、弱体・状態異常を消す道具（効果の種類 `cure`）、MP 回復・強化の道具（効果の種類 `healMp` / `addBuff` はあるが、今の道具には使っていない）、道具を売る（[docs/consumables.md](docs/consumables.md)）
