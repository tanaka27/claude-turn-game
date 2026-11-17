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
| `tests/areas.test.js` | 技の範囲（扇・円・直線・弾・投げる）、壁、弾の貫通 |
| `tests/turns.test.js` | 行動順（速度・同じ時刻は主人公が先）、HP・MP の回復、再使用待ち、湧き直し、落とし物が消える |
| `tests/ai.test.js` | 敵が気づく・群れの仲間が来る・諦めて帰る（無敵・全回復）・予告の技 |
| `tests/kill.test.js` | 経験値（灰色の敵は 0.2 倍）、落とし物、クエスト、レベルアップ、倒れたとき・復活 |
| `tests/effects.test.js` | 強化・弱体がどのキャラにも同じしくみで効くか（弱体の種類はテストの中で `defineEffect` で足す）: 効果なしなら敵（全種類・いくつかのレベル）・仲間を計算し直しても作ったときと同じ、敵の守備ダウンで受けるダメージが増える・敵自身の行動回数で切れて元に戻る、攻撃ダウンで与えるダメージが減る、鈍足・加速で行動の回数が変わる（敵・仲間）、最大 HP ダウンで HP が切られ切れても戻らない、敵の gear は倍率を受けない、帰り着いた敵・倒れた敵と仲間は消える、主人公の弱体とつよさの画面、装備の付け替え・レベルアップの HP・MP の合わせ方 |
| `tests/allies.test.js` | 主人公の陣営のほかのキャラ（仲間。`addAlly` で置く）: マスをふさぐ、速度どおりに行動順に入る、仲間しか見えない敵が仲間を狙って近づき攻撃する、予告の技が当たる、倒れても主人公の倒れた流れにならず経験値も入らない、仲間がいても敵を倒せば経験値 |
| `tests/actions.test.js` | 移動・攻撃・待機・スキル（MP・再使用待ち・覚えていないスキル）・ダッシュ・回復薬 |
| `tests/learn.test.js` | スキルを覚える・スキル欄（[skill-use.md](skill-use.md) の「覚えているスキルとスキル欄」）: はじめから遊ぶと Lv1 のスキルだけ覚えている、Lv3・Lv6 で覚えてレベルアップの表示に今までどおり出る、覚えていないスキルのキーは今までどおりの文だけ、レベルを通さずに覚えさせると覚えるレベルより下でも使える、テストで足した 6 つ目のスキル（`defineSkill`）を覚えさせてキー 6 に置く（`bindSkill`）と使える、仲間の覚えているスキル、覚えたスキルのセーブ（ない id を捨て、レベルで覚えるものは足す）、データの確認（`dataProblems`）でスキルの id・覚え方・スキル欄の食い違いを見つける |
| `tests/skills.test.js` | 技を使う道（`useSkill`）がどのキャラにも同じか: 仲間が主人公のスキル（弾・まわり・投げる・ダッシュ・強化）を使い MP を払って再使用待ちになる、仲間の予告ありの技（テストの中で足した技）が次の行動で範囲の敵に当たる、再使用待ち・MP 不足では使えない、敵が強化の技を自分に使う、主人公と敵で違う再使用待ち・MP の決まり（[skill-use.md](skill-use.md)）、主人公の文が今までどおり |
| `tests/save.test.js` | セーブの往復（`buildSave` → `migrateSave` → `applySave`）、ないゾーン、版の違い、おかしな値 |
| `tests/migrate.test.js` | セーブの版の移し替え（[save-versions.md](save-versions.md)）: そのまま書いた v1 のセーブが今の形（v3）に直って読める（クエストの id が変わり進み具合はそのまま、Lv5 なので覚えたスキルはメテオ以外）、そのあとの保存が今の形で読み直しても同じ、そのまま書いた v2 のセーブ（Lv1・Lv4・Lv7）がそのレベルで覚えていたスキルを覚えた形に直り、書いたものが今の形で往復する、渡したものを書き換えない、壊れた・型のおかしいセーブで落ちない、新しい版のセーブを読まずタイトルを開いただけでは上書きしない、壊れたセーブをタイトルで知らせる、ブラウザ v1・サーバーが今の形で `savedAt` の新しいほうを使う。今の版はテストの先頭の `CURRENT`（版を上げたらここを上げる） |
| `tests/screens.test.js` | 画面の開き方・閉じ方・キー（[menu.md](menu.md)）: 道具一覧（I・HUD の「道具」）、キャラクター（Tab・HUD の仲間の欄・一時停止から C と「キャラクター」ボタン、閉じると一時停止に戻る）、商人・鍛冶屋・クエスト・会話の NPC にぶつかる・となりで F、出る画面（overlay）と `game.state`、閉じるとセーブ、開くと構え・歩く道が消える、画面ごとの閉じるキー（Esc・I・C / Tab・F）、ポップアップがあると Esc はそれだけ閉じる、会話は F / Enter / スペース / クリックで進み最後で閉じる、画面を開いている間・一時停止中はフィールドのキーが効かない |
| `tests/shops.test.js` | 商人（回復薬を買う・お金と上限で押せない・素材を 1 つ / 種類ごと / 全部売る）、鍛冶屋（品ぞろえがレベルで決まり変わると入れ替わる・買う・お金 / 持ち物がいっぱいで買えない・売る）、道具一覧とキャラクター（装備する・外す（いっぱいなら押せない）・捨てる・回復薬を使うと閉じて 1 行動・ポップアップは道具一覧とキャラクターだけ・中身がなくなると閉じる）、開いている画面に合わないボタンが押されても何も起きない |
| `tests/questui.test.js` | クエストの画面: 一覧の並びと状態、↑↓ / クリックで選ぶ、Enter / ボタンで受ける・報告する（報酬・回復薬の上限・持ち物がいっぱいで装備を受け取れない文）、くり返しのクエストはまた受けられるに戻る、開き直すと文と選択が消える |
| `tests/smoke.test.js` | 通し試験。はじめから草原へ出て、簡単な方針（近づいて殴る・スキル・HP が減ったら回復薬）で 400 行動 × 3 つの種。毎行動、不変条件（HP・MP・ステータスに NaN がない、HP が 0〜最大、同じマスに 2 体いない、通れないマスにいない、時間が戻らない）を確かめる |

## 読み込み方（`tests/harness.js`）

- `index.html` の `<script src="...">` を上から順に読み、その順で 1 つの vm（Node の `vm.createContext`）の中で実行する。読み込み順をテスト側に写して持たない（`index.html` にファイルを足せばテストにも入る）
- 同じ vm で実行したスクリプトどうしは、ブラウザと同じくトップレベルの `const` / `let` / `function` を共有する
- ブラウザの機能は、読み込みで落ちない程度の代わりを置く: `document`（どの id でも空の要素を返す。要素は `innerHTML` / `textContent` / `classList` / `style`（`setProperty` も）/ `dataset` を覚え、`addEventListener` で登録された処理を `_listeners` に残す。HTML は解釈しない）、canvas と 2D コンテキスト（何を呼んでも何もしない）、`localStorage`（メモリ上。`loadGame({ storage: { キー: 文字列 } })` で読み込む前の中身を決められる）、`fetch`（いつも 404）、`location.protocol` は `file:`（サーバーのセーブは使わない。`loadGame({ server: { save } })` ならサーバーの代わりを置き、`http:` にして `GET /api/save` で save を返し、PUT されたセーブを `g.server.puts` に残す）、`requestAnimationFrame`（何もしない。描画は動かない）、`performance`、`Image`、`confirm` など
- `console` は記録する（`g.consoleLog`）。`window.addEventListener` で登録された処理も記録し（`g.windowListeners`）、キー入力のテストはこれに偽の `keydown` を渡す
- テストごとに新しい vm で読み込み直す（テストどうしで状態が混ざらない）。ファイルの解釈は 1 回だけ

`loadGame()` の戻り値 `g` から、ゲームの名前を `g.player` / `g.units` / `g.game` / `g.startGame(null)` のように読める（トップレベルの `let` も、書き換えられたあとの値が読める）。`g.player = ...` のように書くこともできる。

注意: vm の中で作られた配列やオブジェクトは、テスト側のものと「別の世界」のものなので、`assert.deepStrictEqual` でそのまま比べると形が同じでも失敗する。`plain(x)`（JSON にして戻す）か `Array.from(...)` でふつうの値にしてから比べる。

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

- 試験場: `WORLD.zones` にゾーンを足して `enterZone`、湧いた敵は `camps[i].slots[j].enemy` から取り、`placeUnit` と `e.home` で置き直す。`computeFlow(…, flow)`
- キャラ: `player` / `units`（主人公も入る。敵は `faction === 'enemy'`）、`unitAt`、仲間は `createAlly` / `addUnit`（`addAlly`）、敵の狙う相手 `e.target`（`targetOf`）、`u.stats` / `u.hp` / `u.mp` / `u.tx` / `u.ty` / `u.dead` / `u.level` / `u.exp` / `u.base` / `u.buffs` / `u.skillCd`（名札は `skillKey`。テスト本体は直接見ずに `storedCooldown(g, u, sk)` を通す）、覚えているスキル `u.knownSkills`（`knownSkillIds`）、主人公のスキル欄 `player.skillSlots`（`bindSkill`）/ `u.baseStats`（敵）、仲間の種類の `skills`、敵の `e.def.attacks`（`enemyAttack`）、敵の `e.state`（`'idle'` / `'chase'` / `'return'`）と `e.invuln`、`e.next`（行動順のテストで時刻を合わせる）
- ステータス: `deriveStats`、`refreshStats`（計算し直し）、`statParts`（`statPartsOf`）、`addBuff`（技を使わずに強化・弱体をかける。かけた者 `src` も渡せる）、`BUFFS`（`defineEffect` でテスト用の種類を足す）、`createEnemy`（`makeEnemy`。湧き場所を通さずに作る）、`levelUp`、`strengthHtml`（キャラクターの画面のつよさ）、`equipItem` / `unequipItem`
- 行動の記録: どのキャラも行動のあとに通る `endTurn` を包んで、誰がいつ行動したかを数える（`traceTurns`）
- 技: `planAttack`（範囲）、`resolveAttack`（判定）、`hazards`（予告中の範囲）、`SKILLS`（`skillById`・`defineSkill`）、キーに置いたスキル `skillByKey`（`skill`）・`slotKeyOf`（`keyOf`）、`knowsSkill` / `teachSkill`（`knows` / `teach`）、`learnSkillsByLevel`（`setLevel`。レベルを書き換えたらはじめの覚え方も通す）、どのキャラも同じ技を使う道 `useSkill`（`useSkillBy`）、`cooldownLeft` / `skillCooldown` / `canUseSkill`（`cooldownLeftOf` / `cooldownLengthOf` / `canUseSkillOf`）、`skillKey`（`setCooldown`）
- 画面: 土台の要素は HTML を解釈しないので、`tests/helpers.js` が画面の中身（`innerHTML`）を小さく解釈してクリックの的（`dataset` / `disabled` / `closest`）を作り、画面の要素（`#menu` / `#quest` / `#talk` / `#pause`）の `click` の処理に渡す（`clickButton` / `clickGear` / `clickTool` / `clickMat` / `clickQuestRow` など。入れ物の id と入れ子は `PARENT_OF` / `CONTAINERS`、`index.html` に直接書いてあるボタンは `STATIC_BUTTONS`）。出ている画面は `show` のクラス（`shown`）、開いている画面の名前は `game.state` と `menu.mode`（`openScreen`）、HUD のボタンは `hudButtons` に場所を置いて canvas の `mousedown`（`clickHud`）、セーブの回数は `saveGame` を包んで数える（`trackSaves`）、NPC のとなりへは `enterZone` / `placeUnit` / `tileOf` / `isBlocked` / `gateAt`（`nextToNpc`）、鍛冶屋の品ぞろえ `shopStocks`（`smithStock`）、`makeItem`（`giveItem`）、`EC.inventorySize`（`fillInventory`）、`worldMapOn`
- そのほか: `validateData`（`dataProblems`）、`loots`（落とし物）、`logLines`（メッセージ欄）、`aiming` / `mouse`（スキルを構える）、`updateWorld`（倒れてから復活するまでの実時間）、`findPath` / `gateAt` / `zone.gates`（通し試験の道案内）、セーブの `buildSave` / `migrateSave` / `readSave` / `SAVE_MIGRATIONS` / `SAVE_VERSION` / `applySave`（`startGame(save)` 経由）/ `saveGame` / `readLocalSave` / `saveStore`（`cached` / `problems`）/ `questStatus` / `questById`、タイトルの `continueBtn` / `startBtn`（`onclick`）/ `saveInfo`（`g.elements`）、`confirm`（`g.set` で差し替え）
