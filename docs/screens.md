# 画面の登録表と NPC の役目（施設の足し方）

HTML の画面（道具一覧・キャラクター・商人・鍛冶屋・クエスト・会話）を開く・閉じる・キー・クリックのしくみと、NPC に話しかけたときに何を開くか。コードは `src/ui.js`（クエストの画面だけ `src/quests.js`）。画面の中身は [menu.md](menu.md)、会話は [buildings.md](buildings.md)、クエストは [quests.md](quests.md)。

## 画面の登録表（`SCREENS`）

画面は `registerScreen(名前, 定義)` で `SCREENS` に 1 つずつ登録する。開いている間は `game.state = 'menu'`、開いている画面の名前は `menu.mode`。

| 名前 | 出す要素（overlay） | 開き方 | Esc のほかに閉じるキー | 画面のキー |
|---|---|---|---|---|
| `inv` | `#menu` | I・HUD の「道具」 | I | ポップアップがあれば Esc はそれだけ閉じる |
| `char` | `#menu` | Tab・HUD の仲間の欄・一時停止から C / ボタン | C / Tab | 同上 |
| `shop` | `#menu` | `role: 'shop'` の NPC（店のキー） | F | 同上 |
| `smith` | `#menu` | `role: 'smith'` の NPC（鍛冶屋のキー） | F | 同上 |
| `quest` | `#quest` | `role: 'quest'` の NPC（その NPC） | F | ↑↓ で選ぶ、Enter で受ける・報告する |
| `talk` | `#talk` | `role: 'talk'` の NPC（その NPC） | なし | F / Enter / スペースで次へ（最後で閉じる） |

定義に書くもの（どれも省略できるものは省略してよい）:

- `overlay`: 出す要素の id。`#menu` を使う 4 つの画面は `menuScreen(def)` で作る（中身は `renderMenu`。見出し `title()`、`profile`、ポップアップを使う `pop`、道具の「使う」を出す `toolUse`、素材を売る `sellMaterials`、店の定義の表 `defs()`、商品の装備 `stock()`、「商品」の欄 `shopList()`、持ち物の装備の「装備する」の横のボタン `invGearButton(it)`（なければ「捨てる」）を画面ごとに書く。`if (menu.mode === …)` で分けない）
- `open(arg)`: その画面だけの準備。共通の準備（`game.state = 'menu'`、構え `aiming` と歩く道 `player.travel` を消す、`menu.mode`）は `openScreen(名前, arg)` が先にして、`open` → `render` → overlay を出す、の順
- `render()`: 中身を作る
- `keys(k, e)`: その画面のキー（`k` は小文字）。処理したら `true`。処理しなかったキーは、押しっぱなしでなければ Esc と `closeKeys` で閉じる（`screenKey`）。`src/player.js` の keydown は、画面を開いている間は `screenKey` を呼ぶだけで、フィールドには渡さない（動かない・時間が進まない）
- `actions`: `{ data-act の値: (ボタン) => … }`。overlay のクリックは `registerScreen` が 1 度だけ受け、押せる（`disabled` でない）`[data-act]` のボタンなら開いている画面の `actions` から引いて呼ぶ。`true` を返さなければそのあと `afterAction()`（`#menu` の画面は `renderMenu`。合わない data-act でも呼ぶ）。お金・持ち物・選んでいるもののたしかめ（見張り）は各 action の中に書く（古い画面に残ったボタンが押されても、合わないときは何もしない）。装備のボタンは、`detailHtml` がそのボタンを出す選び方（`menu.sel.from`。`selFrom`）のときだけ効く: 「装備する」は持ち物（`inv`）、「捨てる」は持ち物でその画面に `invGearButton` がないとき、「売る」は持ち物（鍛冶屋だけ）、「外す」は装備中（`equip`）で持ち物に空きがあるとき、「買う」はその鍛冶屋の今の品ぞろえ（`shop`）から選んだもので、お金と持ち物の空きがあるとき。`#menu` の画面に共通のボタン（閉じる・ポップアップを閉じる・装備する・外す・捨てる）は `MENU_ACTIONS`、画面ごとのもの（道具一覧の「使う」、商人の道具を買う（`buyItem`）・素材を売る、鍛冶屋の買う・売る）はその画面の `actions`
- `click(e)`: ボタン以外のところのクリック（アイテムを選ぶ・ポップアップの外、クエストの一覧、会話を進める）
- `onClose()`: 閉じたあと。`closeMenu` は登録された全部の画面の overlay を隠し、`game.state = 'play'` にして `onClose` を呼び、セーブする。`#menu` の画面はポップアップを消し、キャラクターは一時停止中なら一時停止の画面に戻す

一時停止（`game.paused`、`#pause`）は登録表に入れていない。時間を止めるだけで `game.state` は `'play'` のまま、キー（P / Esc / C）はフィールドのキーと同じ所（`src/player.js`）で受ける。キャラクターの画面は一時停止の上に開く（開くと一時停止の画面を隠し、閉じると戻す）。はじめから・続きから（`startGame`）も登録された画面の overlay を全部隠す。

## NPC の役目（`NPC_ROLES`）

`world.js` の NPC の `role` → 話しかけたとき（F、または NPC のマスへ移動）に開く画面と、その画面の `open` に渡すもの。`talkTo` は `NPC_ROLES[n.role]` を引いて `openScreen(screen, arg(n))` を呼ぶだけ。

| role | 開く画面 | 渡すもの | 役目ごとのデータの確認（`check`） |
|---|---|---|---|
| `shop` | `shop` | `n.shop` | `data/items.js` の `shops` にあるか |
| `smith` | `smith` | `n.smith` | `data/items.js` の `smiths` にあるか |
| `quest` | `quest` | NPC | — |
| `talk` | `talk` | NPC | `lines` があるか |

起動時のデータの確認（`validateData`）は、どの NPC の `role` も `NPC_ROLES` にあるか、その画面が `SCREENS` にあるか、役目の `check(n)` が返した食い違いを調べる。

## 施設の足し方（例: 宿屋）

施設（宿屋・倉庫・新しい種類の店・スキルの先生など）を足すときに書くのは次のものだけ。キー入力（`src/player.js`）・`talkTo`・`closeMenu`・クリックの振り分けは直さない。

1. **データ**: 中身の数値・表は `data/*.js` に書く（例: `data/items.js` に `inns: { townInn: { name: '始まりの町の宿', price: 10 } }`）。ゲーム全体のしくみの数値なら `params.js`
2. **NPC**: `world.js` のゾーンの `npcs` に NPC を足し、`role: 'inn'` と役目に要るもの（例: `inn: 'townInn'`）を書く。種類（`kind`）が新しければ `data/npcs.js` にも足す
3. **役目**: `src/ui.js` の `NPC_ROLES` に 1 行（例: `inn: { screen: 'inn', arg: (n) => n.inn, check: (n) => (IT.inns[n.inn] ? [] : [...]) }`）
4. **画面**: `registerScreen('inn', { … })` を 1 つ。今の `#menu` に収まるなら `menuScreen({ title, defs, shopList, actions, closeKeys, … })` で作り、別の見た目なら `overlay` に新しい要素の id を書いて `render` / `keys` / `actions` / `click` を書く。`src/quests.js` のように別のファイルに置くなら、`index.html` で `src/ui.js` より後に読み込む
5. **画面の土台**（別の見た目のときだけ）: `index.html` に `<div id="…" class="overlay">` と、必要なら `style.css` に CSS
6. **ドキュメントとテスト**: この表（`SCREENS` / `NPC_ROLES`）、[menu.md](menu.md) の開き方の表、データの表（[items.md](items.md) など）、`tests/` に開く・キー・ボタン・閉じるのテスト（`tests/registry.test.js` にテストだけで足した施設の例がある）
