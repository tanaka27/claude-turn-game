# 道具（使うとなくなるもの）

回復薬のような、使うとなくなる道具（コードでは consumable）の定義、効果の種類、使う道、足し方。定義は `data/items.js` の `ITEMS.consumables`、効果の種類と使う道は `src/items.js`（`ITEM_EFFECTS` / `useConsumable`）。道具一覧・店の画面のしくみは [menu.md](menu.md)、装備・素材・店の品ぞろえは [items.md](items.md)。

## 今ある道具（`consumables`）

使うと 1 行動（再使用待ちはない）。

| 道具 | レア度 | キー | 値段 | 効果 | 持てる数 | 最初 | 売っている店 |
|---|---|---|---|---|---|---|---|
| 回復薬 (`potion`) | コモン | R | 25 G | 最大HP の 40% 回復（`healHp` 0.4） | 20 | 3 | 始まりの町の商店、宿場の道具屋、隠れ里の薬師 |
| 上回復薬 (`hiPotion`) | レア | T | 80 G | 最大HP の 80% 回復（`healHp` 0.8） | 10 | 0 | 隠れ里の薬師 |

クエストの報酬でもらえる道具は [quests.md](quests.md) の今のクエストの表（`reward.consumables`）。

## 道具の定義

```js
potion: { name: '回復薬', rarity: 'common', key: 'r', price: 25, max: 20, start: 3, effects: [{ kind: 'healHp', ratio: 0.4 }] },
```

| 項目 | 意味 |
|---|---|
| キー（`potion` など） | セーブ（`player.consumables`）・店（`shops[*].consumables`）・クエストの報酬が指す。あとから変えるときはセーブの版を上げて直す（[save-versions.md](save-versions.md)） |
| `name` / `rarity` | 表示名 / レア度（`rarities` の id。名前と色に使う） |
| `key` | フィールドで使うキー。HUD のスキル欄の右に、この並びで枠が出る |
| `price` / `max` / `start` | 商人での値段 / 持てる数（買う・報酬・セーブを読むときにここまで） / はじめから遊ぶときの数 |
| `effects` | 効果の並び（1 つ以上）。**どれか 1 つでも効くときだけ使え、効くものだけを効かせる** |

## 効果の種類（`ITEM_EFFECTS`、`src/items.js`）

| `kind` | 書くもの | 効くとき | 効き目 | 効かないときの文 / 道具一覧の理由 |
|---|---|---|---|---|
| `healHp` | `ratio`（0 より大きく 1 以下） | HP が最大より少ない | HP を 最大HP × `ratio`（四捨五入）回復。緑の「+数」と回復の演出 | 「HP は満タンだ。」 / 「HP が満タン」 |
| `healMp` | `ratio`（0 より大きく 1 以下） | MP が最大より少ない | MP を 最大MP × `ratio`（四捨五入）回復。MP の色の「+数」と回復の演出 | 「MP は満タンだ。」 / 「MP が満タン」 |
| `addBuff` | `buff`（`data/buffs.js` のキー）、`actions`（1 以上の整数） | 同じ強化・弱体が `actions` 以上残っていない | 使った相手に `addBuff(相手, buff, actions, 使った者)`。自分に使えば使った行動は数えず、ほかの者に使えばその者の次の行動から数える（[combat.md](combat.md)）。強化の演出 | 「〇〇はもうかかっている。」 / 「〇〇中」 |

`healMp` と `addBuff` は今の道具には使っていない（テスト `tests/consumables.test.js` で確かめている）。
ほかの相手に使うと、文の頭と効き目の文に相手の名前が付く（例: 「リナに回復薬を使った。リナの HP が 8 回復した。」）。

- 今後の候補 `cure`（弱体・状態異常を消す。未実装）: `{ kind: 'cure', buffs: ['poison', …] }` と書き、`can` は相手の `buffs` に `buffs` のどれかがあるとき、`apply` はそれを外して `refreshStats` する。毒・スタンのような別の種類の効果を足すとき（[combat.md](combat.md) の「強化・弱体」）に合わせて足す

## 使う道（`useConsumable`）

- `useConsumable(u, id, t = u)`: キャラ `u` が道具 `id` を `t` に使う（1 行動）。使えたら true。主人公のキー（`consumableByKey`、`src/player.js`）・道具一覧の「使う」はどれもここを通る（`doPlayerAction` に渡す）
  1. `u` か `t` が倒れていれば何もしない（false）
  2. `consumableBlock(u, id, t)`: `u` の数（`consumableCount`。主人公だけが `consumables` を持ち、ほかのキャラは 0）が 0 なら「〇〇がない。」、効果のどれも効かなければ最初の効果の文をメッセージ欄に出して false
  3. 数を 1 減らし、効く効果だけを効かせ、頭の上に文（2 つ目からは 18px ずつ上）、メッセージ欄に「〇〇を使った。」と効き目の文（色は最初に効いた効果の色）、演出の順に出す
- 道具一覧の「使う」を押せるか（`usable`）と「〇〇なので使えない」の理由も `consumableBlock`（`toolEntries`、`src/ui.js`）。今は主人公が自分に使うだけ（相手を選ぶ画面はない）
- 説明（`consumableDesc(id, t)`）は効果ごとの `desc` を「・」でつなぐ。道具一覧は今の値つき（「最大HPの 40% 回復（今なら 12）」）、店は割合だけ

## 道具を足す

1. `data/items.js` の `consumables` に 1 つ足す（キーは英字。`key` は移動・画面・スキル・ほかの道具のキーと重ねない）
2. 売るなら `shops` の店の `consumables` に、報酬にするなら `data/quests.js` の `reward.consumables` に `{ id, count }` を書く
3. 上の表を直す。起動時のデータの確認（`[データの確認]`）で、効果の種類・数値・キー・店とクエストの参照が調べられる（[data.md](data.md)）

## 効果の種類を足す

`src/items.js` の `ITEM_EFFECTS` に 1 つ足す（数値は道具の `effects` の中に書き、`src/` には書かない）。

| 関数 | 役目 |
|---|---|
| `can(e, t)` | 相手 `t` に効くか（使えるかの判定に使う） |
| `refuse(e, t)` / `reason(e, t)` | 効かないときのメッセージ欄の文 / 道具一覧の理由（「〇〇なので使えない」の〇〇） |
| `desc(e, t)` | 説明（`t` があれば今の値も） |
| `apply(e, t, u)` | 効かせる。`{ text, float, color, size, fx }`（効き目の文・頭の上の文・色・大きさ・演出の関数）を返す |
| `check(e)` | データの確認。おかしいところの文（なければ `''`） |

上の「効果の種類」の表に 1 行足し、テスト（`tests/consumables.test.js`）に `defineConsumable` で足した道具で確かめるものを足す。
