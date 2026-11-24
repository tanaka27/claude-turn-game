# 自動テスト

ゲームの動き（ステータス・強化・ダメージ・技の範囲・行動順・敵の動き・倒したとき・主人公の行動・画面（道具一覧・店・クエスト・会話・一時停止）・セーブ）を、ブラウザを開かずに確かめる。
今の動きをそのまま固定するテスト（キャラクタリゼーションテスト）で、作りを大きく変える前後で結果が変わっていないかを見るためのもの。

## 動かし方

```
node tests/run.js            （全部）
node tests/run.js damage     （名前に damage を含むものだけ。「ファイル名 > テスト名」の一部で選ぶ）
```

- Node.js（v18 以上）だけで動く。`npm install` も `package.json` もいらない
- テストは `async` でもよい（返した Promise が終わるまで待つ）
- 1 つでも失敗すると終了コード 1。最後に「N passed, N failed, N skipped」と出る。失敗したものは最後にまとめて理由が出る
- 全部で 20 秒ほど（一番重いのは自動で戦わせる通し試験）

## ファイル

| ファイル | 中身 |
|---|---|
| `tests/run.js` | 実行役。`tests/*.test.js` を名前順に読み込み、登録されたテストを順に動かす |
| `tests/harness.js` | 土台。ゲームの本物のファイルを vm の中で読み込む（下の「読み込み方」）。乱数の差し替えもここ |
| `tests/helpers.js` | テストの道具（試験場を作る・キーを押す・行動の記録など）。**ゲームの中の名前（内部の関数・フィールド）に触るのは、なるべくこのファイルだけにする** |
| `tests/load.test.js` | 読み込み、データの確認（`[データの確認]` が出ないこと）、はじめから |
| `tests/stats.test.js` | `deriveStats`、主人公と敵（レベル補正つき）のステータス、装備、強化と装備の関係 |
| `tests/buffs.test.js` | 闘気（攻撃力アップ）: かける・続く行動回数・かけ直し・復活で消える |
| `tests/damage.test.js` | 物理（ふつう・ぶれ・会心・0〜1 のミス）、術、敵から主人公へ |
| `tests/areas.test.js` | 技の範囲（扇・円・直線・弾・投げる）、壁（上下左右どの向きの壁でも円の隠れる形が同じ、斜めに並んだ 2 つの壁の間は抜けられない）、ちょうど斜めの直線（4 つの向き・逆向き・角を挟む壁）、視線の対称性（種を決めたランダムな壁 25 通りで、入れ替え・左右・上下・両方・縦横の裏返しで同じ）、弾の貫通 |
| `tests/turns.test.js` | 行動順（速度・同じ時刻は主人公が先）、HP・MP の回復、再使用待ち、湧き直し（倒してから `respawn + spawnTelegraph` ターン。主人公の速さ・速い敵がいるか・時間を 1 度に / 細かく分けて進めても同じ、ゾーンを出て戻っても残りを引き継ぐ、主人公が近いと湧かない）、落とし物が消える |
| `tests/ai.test.js` | 敵が気づく・群れの仲間が来る・諦めて帰る（無敵・全回復）・予告の技 |
| `tests/kill.test.js` | 経験値（灰色の敵は 0.2 倍）、落とし物、クエスト、レベルアップ（潜在が上がる・ステータスは上がらない）、倒れたとき・復活 |
| `tests/growth.test.js` | 行動によるステータスの伸び（[growth.md](growth.md)）: はじめの潜在、物理で殴る → ちから（与えたダメージ / 相手の最大HP）、伸びは小数で一の位に届くまで戦いの値は変わらない、潜在の倍率、一の位が上がる・潜在が下がる・残りは下がった潜在で伸びる、さいだいHP が上がると今の HP も増える・上限でちょうど止まる、受けたダメージ → みのまもり・さいだいHP、MP → さいだいMP・かしこさ、予告の範囲から逃げきる → すばやさ（当たったら入らない）、敵は育たない、レベルアップで潜在が上がる（上限まで）、時間で潜在が下がる |
| `tests/effects.test.js` | 強化・弱体がどのキャラにも同じしくみで効くか（弱体の種類はテストの中で `defineEffect` で足す）: 効果なしなら敵（全種類・いくつかのレベル）・仲間を計算し直しても作ったときと同じ、敵の守備ダウンで受けるダメージが増える・敵自身の行動回数で切れて元に戻る、攻撃ダウンで与えるダメージが減る、鈍足・加速で行動の回数が変わる（敵・仲間）、最大 HP ダウンで HP が切られ切れても戻らない、敵の gear は倍率を受けない、帰り着いた敵・倒れた敵と仲間は消える、主人公の弱体とつよさの画面、装備の付け替え・レベルアップの HP・MP の合わせ方 |
| `tests/allies.test.js` | 主人公の陣営のほかのキャラ（仲間。`addAlly` で置く）: マスをふさぐ、速度どおりに行動順に入る、仲間しか見えない敵が仲間を狙って近づき攻撃する、予告の技が当たる、倒れても主人公の倒れた流れにならず経験値も入らない、仲間がいても敵を倒せば経験値 |
| `tests/actions.test.js` | 移動・攻撃・待機・スキル（MP・再使用待ち・覚えていないスキル）・ダッシュ・回復薬 |
| `tests/consumables.test.js` | 道具（[consumables.md](consumables.md)）: 回復薬・上回復薬の回復量と文・色・頭の上の数・演出、満タン・持っていないときの文で行動にならない、テストで足した道具（`defineConsumable`）で MP 回復（`healMp`）・強化（`addBuff`。使った相手の行動回数で切れる、もう長くかかっていれば使わない）・効果 2 つ（どれかが効けば使え、効くものだけ）、仲間に使う（`useItem(g, 主人公, id, 仲間)`。仲間だけ回復・文に名前・仲間の次の行動から数える強化）、道具一覧の「使う」と理由が同じ判定、商人がデータの道具を売る、クエストの報酬の 2 種類の道具と上限、データの確認（効果の種類・数値・キー・店とクエストの参照） |
| `tests/learn.test.js` | スキルを覚える・スキル欄（[skill-use.md](skill-use.md) の「覚えているスキルとスキル欄」）: はじめから遊ぶと Lv1 のスキルだけ覚えている、Lv3・Lv6 で覚えてレベルアップの表示に今までどおり出る、覚えていないスキルのキーは今までどおりの文だけ、レベルを通さずに覚えさせると覚えるレベルより下でも使える、テストで足した 6 つ目のスキル（`defineSkill`）を覚えさせてキー 6 に置く（`bindSkill`）と使える、仲間の覚えているスキル、覚えたスキルのセーブ（ない id を捨て、レベルで覚えるものは足す）、データの確認（`dataProblems`）でスキルの id・覚え方・スキル欄の食い違いを見つける |
| `tests/skills.test.js` | 技を使う道（`useSkill`）がどのキャラにも同じか: 仲間が主人公のスキル（弾・まわり・投げる・ダッシュ・強化）を使い MP を払って再使用待ちになる、仲間の予告ありの技（テストの中で足した技）が次の行動で範囲の敵に当たる、再使用待ち・MP 不足では使えない、敵が強化の技を自分に使う、主人公と敵で違う再使用待ち・MP の決まり（[skill-use.md](skill-use.md)）、主人公の文が今までどおり |
| `tests/save.test.js` | セーブの往復（`buildSave` → `migrateSave` → `applySave`。小数の伸びた値・潜在も戻る）、HP・MP の戻し方（HP 0 以下・数でない → 満タン、端数はそのまま、最大で切る。MP は 0〜最大、数でない → 満タン）、ないゾーン、版の違い、おかしな値（上限を超えたステータス・範囲外の潜在など） |
| `tests/migrate.test.js` | セーブの版の移し替え（[save-versions.md](save-versions.md)）: そのまま書いた v1 のセーブが今の形（v5）に直って読める（クエストの id が変わり進み具合はそのまま、Lv5 なので覚えたスキルはメテオ以外、回復薬の数は道具の数 `consumables` に移る）、そのあとの保存が今の形で読み直しても同じ、そのまま書いた v2 のセーブ（Lv1・Lv4・Lv7）がそのレベルで覚えていたスキルを覚えた形に直り、書いたものが今の形で往復する、そのまま書いた v3 のセーブ（`V3_SAVE`）の回復薬の数が道具の数に移り（今はない道具は読むとき捨て、上限で切る）往復する、v3 → v4 の直し方（数だけ → `{ potion: 数 }`、おかしいものは空）、そのまま書いた v4 のセーブ（`V4_SAVE`）が伸びた値をそのまま残し潜在ははじめの値になる、渡したものを書き換えない、壊れた・型のおかしいセーブで落ちない、新しい版のセーブを読まずタイトルを開いただけでは上書きしない、壊れたセーブをタイトルで知らせる、ブラウザ v1・サーバーが今の形で `savedAt` の新しいほうを使う。今の版はテストの先頭の `CURRENT`（版を上げたらここを上げる） |
| `tests/savesync.test.js` | 手動のセーブと保存の知らせ・タブの競合（[save.md](save.md)・[server.md](server.md)）: 一時停止画面の「セーブ」と S キーでサーバーとブラウザに保存して結果を出す（30 秒の時計を数え直す、一時停止していなければ保存しない）、サーバーなし・サーバーに書けない（理由）・ブラウザに書けない（サーバーだけ / どこにも。ログは 1 回）ときの文、時刻・倒した数が数でないセーブを読んでも `NaN` にならない、返事の本文が届かないサーバーを待ち時間で打ち切る、古いタブ（BroadcastChannel が届かない）の保存はサーバーが 409 にして古いタブは止まりキー・保存も止まる、同じタブの順番が入れ替わった古いセーブは `stale`・`tab` は残り `base` は残らない、ほかのタブで続きから → 今のタブは止まり（閉じるときも保存しない）新しいタブは読み直した最新のセーブから、タイトルのままのタブも止まる |
| `tests/screens.test.js` | 画面の開き方・閉じ方・キー（[menu.md](menu.md)）: 道具一覧（I・HUD の「道具」）、キャラクター（Tab・HUD の仲間の欄・一時停止から C と「キャラクター」ボタン、閉じると一時停止に戻る）、商人・鍛冶屋・クエスト・会話の NPC にぶつかる・となりで F、出る画面（overlay）と `game.state`、閉じるとセーブ、開くと構え・歩く道が消える、画面ごとの閉じるキー（Esc・I・C / Tab・F）、ポップアップがあると Esc はそれだけ閉じる、キャラクターの画面のタブ（クリック・← →・数字で切り替え、閉じても覚えている、ほかの画面にはタブがない）、会話は F / Enter / スペース / クリックで進み最後で閉じる、画面を開いている間・一時停止中はフィールドのキーが効かない、スキルを構えているときのキー（I / Tab / F は構えをやめて開く・話しかける（NPC がいなければ文）、ほかのスキルのキーは構え直す・強化はすぐ使う・覚えていなければ文、回復薬は飲む、テンキー 5 は待つ、意味のないキーと M は構えたまま、Esc は構えをやめるだけ） |
| `tests/shops.test.js` | 商人（回復薬を買う・お金と上限で押せない・素材を 1 つ / 種類ごと / 全部売る）、鍛冶屋（品ぞろえがレベルで決まり変わると入れ替わる・買う・お金 / 持ち物がいっぱいで買えない・売る）、道具一覧とキャラクター（装備する・外す（いっぱいなら押せない）・捨てる・回復薬を使うと閉じて 1 行動・ポップアップは道具一覧とキャラクターだけ・中身がなくなると閉じる）、開いている画面に合わないボタンが押されても何も起きない、装備のボタンは出ている選び方のときだけ効く（持ち物を選んでいるときの古い「買う」・2 回目の「買う」・品ぞろえにない / ほかの鍛冶屋の装備の「買う」、商品を選んでいるときの「装備する」「売る」「捨てる」「外す」、鍛冶屋での持ち物の「捨てる」、装備中のものの「装備する」「捨てる」・持ち物の「外す」は何もしない）、買う → 装備する → 外す → 売る のお金 |
| `tests/quests.test.js` | クエストの目標の種類（[quests.md](quests.md)）: 今の討伐クエストの文（詳細・一覧・キャラクターの画面のクエストのタブ「ウルフ 3 / 8」「衛兵隊長に報告」）と「?」、テストで足したクエスト（`defineQuest`）で集める（受ける前から持っている分も数える・拾って届くと報告できて「クエスト達成！」と「?」・売って足りなくなると受けているに戻る・報告すると渡す・受けたときにもう持っていればすぐ報告できる・持ち物がいっぱいなら装備も素材もそのまま・同じ素材のクエスト 2 つ）、話しかける（受ける前は数えない・ほかの NPC では進まない・会話はいつもどおり開く・依頼した NPC に「?」・報告できる）、倒すと集めるを同時に受けてそれぞれ進む、データの確認（目標の種類・敵・素材・NPC・数・くり返しの `requires`） |
| `tests/questui.test.js` | クエストの画面: 一覧の並びと状態、↑↓ / クリックで選ぶ、Enter / ボタンで受ける・報告する（報酬・回復薬の上限・持ち物がいっぱいで装備を受け取れない文）、くり返しのクエストはまた受けられるに戻る、開き直すと文と選択が消える |
| `tests/registry.test.js` | 画面の登録表と NPC の役目（[screens.md](screens.md)）: 今の画面と役目がそろっている、データの確認でない役目・ない店 / 鍛冶屋のキー・会話の言葉がない NPC・画面のない役目を見つける、テストだけで足した施設（`defineScreen` / `defineRole`）が話しかけて開き、キー・ボタン・閉じる（セーブ）・はじめからで隠れる |
| `tests/render.test.js` | 描画が例外を出さないこと（土台の canvas は何も描かないので見た目は確かめない）: タイトル、町（NPC・話しかける案内・NPC と強化のアイコンの説明・はじめの大きい文字・絵を付けた NPC・世界地図）、戦い（敵・ボス・予告中の敵・帰還中の敵・当たって光る敵・仲間・落とし物・演出・敵の説明・スキルの範囲を、絵がないときの図形と、絵を読み込んだことにしたとき）、画面（道具一覧・キャラクター・一時停止）を開いたまま。コンソールにエラーや `[データの確認]` が出ないこと。データの確認が NPC の絵の形・`UNIT_LOOK` の `overlays` のない名前を見つけること |
| `tests/text.test.js` | 画面に出す文章（[text.md](text.md)）: `src/*.js` の `txt('キー', { … })` のキーが `data/text.js` にあり、渡す値の名前と文の `{名前}` がそろっている、`fmt` / `txt` の値の入れ方とないキー・足りない値の知らせ（1 回だけ）、データの確認が文字列でない文・`{ }` の形のおかしい文を見つける |
| `tests/globals.test.js` | トップレベルの名前（下の「トップレベルの名前」）: ファイルをまたいで同じ名前を 2 回宣言していない、関数の引数・ローカルの名前がゲームのファイルのトップレベルの名前を隠していない（許可リスト `SHADOW_ALLOW` のものを除く）、スキャナ（`tests/scope-scan.js`）が小さな例と本物のファイルで正しく拾う |
| `tests/scope-scan.js` | トップレベルの名前とローカルの名前を拾う小さなスキャナ（テストではない。`globals.test.js` が使う） |
| `tests/world.test.js` | ワールドマップ（[overworld.md](overworld.md)）: 文字の地図から大きさ・地形（山と木は 1 マスずつ、海はまとめる）・入口の門を作る、入口から出ると下のマスに立つ、町の門 ⇄ ワールドマップの入口の出入り、地方に入ると名前と敵レベル（その地方の湧き場所だけ）を出す、世界地図での位置（建物の中は外の町の入口）、データの確認が入口の数・外周を調べる |
| `tests/smoke.test.js` | 通し試験。はじめからワールドマップ（風の草原）へ出て、簡単な方針（近づいて殴る・スキル・HP が減ったら回復薬）で 400 行動 × 3 つの種。毎行動、不変条件（HP・MP・ステータスに NaN がない、HP が 0〜最大、同じマスに 2 体いない、通れないマスにいない、時間が戻らない）を確かめる |

## ブラウザの通しテスト（`tests/e2e/`）

`node tests/run.js` はブラウザの代わり（下の「読み込み方」）で動かすので、本物の `server.py` とブラウザの組み合わせは確かめない。そこを確かめるのが `tests/e2e/*.e2e.js`（`node tests/run.js` には入らない。名前が `.test.js` で終わらないため）。

```
node tests/e2e/savesync.e2e.js
```

- Playwright（`require('playwright')`）と Chromium、Python が要る。どれかがないときは `skipped:` と出して終了コード 0。失敗すると終了コード 1
- 空いているポートで `server.py` を起動し、セーブは一時フォルダ（環境変数 `ZANKAI_SAVE_DIR`）に置く。`saves/` の本物のセーブには触らない。テストごとにセーブを消し、新しいブラウザのコンテキスト（`localStorage` が空）で始める
- ページのエラー（`pageerror` とコンソールのエラー）が出たら失敗。ただしサーバーが古いタブの保存を断ったときにブラウザが自動で出す 409 の表示は数えない

| ファイル | 中身 |
|---|---|
| `tests/e2e/savesync.e2e.js` | 手動のセーブと古いタブ（[save.md](save.md)・[server.md](server.md)）: 一時停止画面の「セーブ」と S キーでサーバーに書けて「保存しました（サーバーとブラウザ）。」と出る、同じブラウザのほかのタブで続きから → 前のタブは止まり「保存を止めました」が出て、閉じても新しい進行を上書きしない（`tab` は残り `base` は残らない）、別のブラウザ（BroadcastChannel が届かない）の古いタブの保存はサーバーが 409 にして古いタブが止まる |

## 読み込み方（`tests/harness.js`）

- `index.html` の `<script src="...">` を上から順に読み、その順で 1 つの vm（Node の `vm.createContext`）の中で実行する。読み込み順をテスト側に写して持たない（`index.html` にファイルを足せばテストにも入る）
- 同じ vm で実行したスクリプトどうしは、ブラウザと同じくトップレベルの `const` / `let` / `function` を共有する
- ブラウザの機能は、読み込みで落ちない程度の代わりを置く: `document`（どの id でも空の要素を返す。要素は `innerHTML` / `textContent` / `classList` / `style`（`setProperty` も）/ `dataset` を覚え、`addEventListener` で登録された処理を `_listeners` に残す。HTML は解釈しない）、canvas と 2D コンテキスト（何を呼んでも何もしない）、`localStorage`（メモリ上。`loadGame({ storage: { キー: 文字列 } })` で読み込む前の中身を決められる。`g.local.fail = true` で書くと例外）、`fetch`（いつも 404。`loadGame({ fetch })` で差し替え）、`location.protocol` は `file:`（サーバーのセーブは使わない。`loadGame({ server: { save } })` ならサーバーの代わり（`makeServer`）を置き、`http:` にして `GET /api/save` で save を返し、PUT は `server.py` と同じ決まり（同じタブの古いものは stale、ほかのタブのセーブで `base` が違えば 409）で書いて `g.server.puts` に残す。`server.fail = true` で 500。`makeServer` で作ったものか `g.server` を渡すと 2 つのゲームでサーバーを共有する）、`BroadcastChannel`（`makeBus` で作った bus を `loadGame({ bus })` に渡したゲームどうしで少しあとに届く。省略時はほかのタブなし）、`crypto.getRandomValues`（タブの名前。ゲームの乱数は使わない）、`requestAnimationFrame`（何もしない。描画は動かない）、`performance`、`Image`、`confirm` など
- ゲームを読み込む前からある名前（ブラウザの代わり）は `g.sandboxKeys`（`globals.test.js` がトップレベルの名前の拾い損ねを確かめるのに使う）
- `console` は記録する（`g.consoleLog`）。`window.addEventListener` で登録された処理も記録し（`g.windowListeners`）、キー入力のテストはこれに偽の `keydown` を渡す
- テストごとに新しい vm で読み込み直す（テストどうしで状態が混ざらない）。ファイルの解釈は 1 回だけ

`loadGame()` の戻り値 `g` から、ゲームの名前を `g.player` / `g.units` / `g.game` / `g.startGame(null)` のように読める（トップレベルの `let` も、書き換えられたあとの値が読める）。`g.player = ...` のように書くこともできる。

注意: vm の中で作られた配列やオブジェクトは、テスト側のものと「別の世界」のものなので、`assert.deepStrictEqual` でそのまま比べると形が同じでも失敗する。`plain(x)`（JSON にして戻す）か `Array.from(...)` でふつうの値にしてから比べる。

## トップレベルの名前（`tests/globals.test.js`）

ゲームのファイルはモジュールではなく、トップレベルの名前を全ファイルで共有する（[IMPLEMENTATION.md](../IMPLEMENTATION.md) の注意）。それで起きる 2 つの事故をテストで見張る。

- **重なり**: 同じトップレベルの名前を 2 回宣言すると、ブラウザでは読み込みエラーでゲーム全体が止まる。テストは両方のファイルと行を出して失敗する
- **隠し**: 関数の引数・ローカルの `const` / `let` などがトップレベルの名前と同じだと、その関数の中ではトップレベルのものが使えず、読み違えやすい。テストは場所を出して失敗する。わざとで害のないものだけ、`globals.test.js` の先頭の `SHADOW_ALLOW` に `[ファイル, 名前, 直前のトップレベルの名前, 理由]` で書く（使われなくなった行もテストが知らせる）

名前を拾うのは `tests/scope-scan.js`。Node には JS の構文解析器が公開されていないので、字句（トークン）に分けてかっこの深さを数えるだけの簡単な方法にしている。

- 文字列・テンプレート（中の `${ }` はコードとして読む）・コメント・正規表現は読み飛ばす。`/` は直前が値で終わらない（`)` `]` `}` 名前・数・文字列でない）ときだけ正規表現とみなす
- トップレベルの名前: かっこの深さ 0 の `const` / `let` / `var`（分割代入も、`,` で続くものも）と `function` / `class` の名前
- ローカルの名前: 深さ 1 以上の `const` / `let` / `var` / `function` / `class`、関数の引数（`function (…)` / `(…) =>` / `名前 =>` / メソッドの `名前(…) {` / `catch (e)`）。プロパティ（`.名前`・`名前:`）は拾わない
- 文の終わりは `;` / `,` / 閉じかっこ。`;` を省いた行は、次の行が文の始めのキーワード（`const` / `if` など）なら終わりとみなす
- スキャナの確かめ: 小さな例と、本物のファイルで拾った名前が読み込んだゲーム（vm）に本当にあること、逆にゲームで使えて組み込みでもブラウザの代わりでもない名前を全部拾えていること

拾いすぎ・拾い損ねがあれば、スキャナをむりに賢くせず許可リストに理由つきで書く。

## 乱数

ゲームは `Math.random` を直接呼ぶので、vm の中の `Math.random` を種から決まる乱数（mulberry32）に差し替えている。

- `loadGame({ seed: 5 })` / `newGame(5)`: 種を決める（省略時 1）。同じ種なら毎回同じ結果になる
- `g.rng.force(0.99, 0.5)`: 次に返す値を順に決める（使い切ったら種の乱数に戻る）。例: 物理の攻撃は「会心か（`< 会心率` なら会心）→ ぶれ（0.5 でぶれ 0）」の順に引くので、`force(0.99, 0.5)` で会心なし・ぶれなし、`force(0, 0.5)` で会心
- `g.rng.constant(0.9)`: ずっとこの値を返す（`null` でやめる）。待機中の敵をうろつかせたくないときなど（うろつく確率 0.3 より大きい値）

## テストの足し方

1. `tests/` の合うファイル（なければ `tests/○○.test.js` を新しく作る。名前が `.test.js` で終われば自動で読まれる）に書く

```js
'use strict';
const assert = require('assert');
const { newGame, arena, step } = require('./helpers');

test('となりの敵を殴ると HP が減る', () => {
  const g = newGame();
  const [e] = arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type: 'golem', at: [6, 5] }] });
  g.rng.force(0.99, 0.5);   // 会心なし・ぶれなし
  step(g, 1, 0);            // D キー: 右へ動く → 敵がいるので攻撃
  assert.strictEqual(e.hp, e.stats.maxHp - 2);
});
```

2. 場面は `arena(g, opts)` で作る。テスト用のゾーンを `WORLD.zones` に足して入る（`cols` / `rows`: 大きさ、`player`: 主人公の位置、`walls` / `water`: [x, y, 幅, 高さ]（マス）、`enemies`: [{ type, at, level, camp, home, respawn }]、`safe`）。戻り値は `enemies` と同じ順の敵
3. 行動はなるべく本物のキー入力の処理を通す: `step(g, dx, dy)`（移動・攻撃）、`wait(g, n)`、`press(g, 'r')`（回復薬など）、`castAt(g, '1', tx, ty)`（スキルを構えてマスを狙って使う）
4. 結果で確かめる（攻撃後の HP、誰がどの順で行動したか、ステータスの値、セーブの中身）。内部の関数を直接呼ぶ必要があるときは、`tests/helpers.js` に道具として足し、テストからはそれを使う
5. 今の動きが不具合に見えても、テストでは直さずに今の動きを固定し、コメントで「不具合の疑い」と書いておく（直すときにテストも合わせて直す）

## テストが頼っている内部の名前（作りを変えたら `tests/helpers.js` を直す）

- 試験場: `WORLD.zones` にゾーンを足して `enterZone`、湧いた敵は `camps[i].slots[j].enemy` から取り、`placeUnit` と `e.home` で置き直す。`computeFlow(…, playerFlow)`
- キャラ: `player` / `units`（主人公も入る。敵は `faction === 'enemy'`）、`unitAt`、仲間は `createAlly` / `addUnit`（`addAlly`）、敵の狙う相手 `e.target`（`targetOf`）、`u.stats` / `u.hp` / `u.mp` / `u.tx` / `u.ty` / `u.dead` / `u.level` / `u.exp` / `u.base` / `u.buffs` / `u.skillCd`（名札は `skillKey`。テスト本体は直接見ずに `storedCooldown(g, u, sk)` を通す）、覚えているスキル `u.knownSkills`（`knownSkillIds`）、主人公のスキル欄 `player.skillSlots`（`bindSkill`）/ `u.baseStats`（敵）、仲間の種類の `skills`、敵の `e.def.attacks`（`enemyAttack`）、敵の `e.state`（`'idle'` / `'chase'` / `'return'`）と `e.invuln`、`e.next`（行動順のテストで時刻を合わせる）
- 道具: `ITEMS.consumables`（`consumableDef` / `healRatio`。`defineConsumable` でテスト用の道具を足す）、主人公の数 `player.consumables`（`bagOf`。テスト本体は直接見ずにこれを通す）、どのキャラも同じ道 `useConsumable`（`useItem`）、商人の「買う」ボタン `data-act="buyItem"` / `data-item`（`buyButton`）
- ステータス: `deriveStats`、`refreshStats`（計算し直し）、`statParts`（`statPartsOf`）、`addBuff`（技を使わずに強化・弱体をかける。かけた者 `src` も渡せる）、`BUFFS`（`defineEffect` でテスト用の種類を足す）、`createEnemy`（`makeEnemy`。湧き場所を通さずに作る）、`levelUp`、`strengthHtml`（キャラクターの画面のつよさ）、`equipItem` / `unequipItem`
- 行動の記録: どのキャラも行動のあとに通る `endTurn` を包んで、誰がいつ行動したかを数える（`traceTurns`）。行動を通さずに時間だけ進める `advanceTime`（`passTime`）
- 技: `hasLOS`（視線。`sees`）、`rayTiles`（直線。`rayFrom`）、`planAttack`（範囲）、`resolveAttack`（判定）、`hazards`（予告中の範囲）、`SKILLS`（`skillById`・`defineSkill`）、キーに置いたスキル `skillByKey`（`skill`）・`slotKeyOf`（`keyOf`）、`knowsSkill` / `teachSkill`（`knows` / `teach`）、`learnSkillsByLevel`（`setLevel`。レベルを書き換えたらはじめの覚え方も通す）、どのキャラも同じ技を使う道 `useSkill`（`useSkillBy`）、`cooldownLeft` / `skillCooldown` / `canUseSkill`（`cooldownLeftOf` / `cooldownLengthOf` / `canUseSkillOf`）、`skillKey`（`setCooldown`）
- 画面: 土台の要素は HTML を解釈しないので、`tests/helpers.js` が画面の中身（`innerHTML`）を小さく解釈してクリックの的（`dataset` / `disabled` / `closest`）を作り、画面の要素（`#menu` / `#quest` / `#talk` / `#pause`）の `click` の処理に渡す（`clickButton` / `clickGear` / `clickTool` / `clickMat` / `clickQuestRow` など。入れ物の id と入れ子は `PARENT_OF` / `CONTAINERS`、`index.html` に直接書いてあるボタンは `STATIC_BUTTONS`）。出ている画面は `show` のクラス（`shown`）、開いている画面の名前は `game.state` と `menuState.mode`（テストの道具の `openScreen`。ゲームの `openScreen` とは別）、画面の登録表 `SCREENS` / `registerScreen` と役目 `NPC_ROLES`（`defineScreen` / `defineRole` / `screenNames` / `roleNames`。表にない画面の要素は、その要素の中身をそのまま読む）、HUD のボタンは `hudButtons` に場所を置いて canvas の `mousedown`（`clickHud`）、セーブの回数は `saveGame` を包んで数える（`trackSaves`）、NPC のとなりへは `enterZone` / `placeUnit` / `tileOf` / `isBlocked` / `gateAt`（`nextToNpc`）、鍛冶屋の品ぞろえ `shopStocks`（`smithStock`）、選んでいる装備 `menuState.sel`（`staleSelect`。古い画面の選択が残った場面）、`makeItem`（`giveItem`）、`ECON.inventorySize`（`fillInventory`）、`worldMapOn`
- 描画: `updateCamera` / `render`（`renderFrame`）、`mouse` / `camera` / `VIEW_SCALE` / `tileCenter`（`hoverTile`）、`buffIcons`（`hoverBuffIcon`）、`sprites`（`fakeSpriteLoaded`。絵を読み込んだことにする）、`spawnLoot`（`dropAt`）
- そのほか: `validateData`（`dataProblems`）、`loots`（落とし物）、`logLines`（メッセージ欄）、`aiming` / `mouse`（スキルを構える）、`updateWorld`（倒れてから復活するまでの実時間）、`findPath` / `gateAt` / `zone.gates`（通し試験の道案内）、セーブの `buildSave` / `migrateSave` / `readSave` / `SAVE_MIGRATIONS` / `SAVE_VERSION` / `applySave`（`startGame(save)` 経由）/ `saveGame` / `readLocalSave` / `saveStore`（`cached` / `problems`）/ `questStatus` / `questById`（`questState`）、クエストの `QUESTS`（`defineQuest`。テスト用のクエストを足す）・`npcMark` / `npcById`（`npcMarkOf`）・画面中央の文 `game.msg` / `game.sub`（`bigMessage`）、タイトルの `continueBtn` / `startBtn`（`onclick`）/ `saveInfo`（`g.elements`）、`confirm`（`g.set` で差し替え）
