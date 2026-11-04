# データの置き場所と足し方

主人公・敵・装備などの「中身の定義」は `data/`、ゲーム全体のしくみの数値は `params.js`、マップの配置は `world.js` に置く。
`src/` のコードには、これらの中身や数値を直接書かない。

## どこに何があるか

| ファイル | 定数 | 中身 |
|---|---|---|
| `params.js` | `PARAMS` | ターンと速度、ダメージ計算、成長、敵のレベル補正（素材の数の伸びを含む）、お金・持ち物、敵の動き（AI）、セーブの間隔 |
| `data/player.js` | `PLAYER` | 主人公の名前・見た目・初期ステータス、通常攻撃、スキル（解放レベル付き）、最初の装備（`startEquip`）。ステータスと技の書き方の説明もここ |
| `data/enemies.js` | `ENEMIES` | 敵（モンスター）の種類ごとの名前・字・色・描く大きさ・経験値・落とす素材（`drops`）・装備を落とす確率・AI の型・ステータス（速度を含む）・技 |
| `data/items.js` | `ITEMS` | レア度、部位（基本性能・名前）、追加性能、価値、回復薬（`potions`。使うキー付き）、店ごとの品ぞろえ（`shops`）、素材（名前・売値・色） |
| `data/quests.js` | `QUESTS` | 討伐クエスト（依頼する NPC・倒す敵・数・報酬・前提） |
| `data/stats.js` | `STATS` | ステータスの表示名・桁数、HUD に出すかとその表示 |
| `data/theme.js` | `THEME` | 意味を持つ色（陣営ごとの予測線・弾の色、出現予告、敵のレベル差の色） |
| `world.js` | `WORLD` | 地形の種類（`terrain`）、ゾーン、門、湧き場所、NPC（位置は px で書き、読み込むときにマスに直す） |

読み込み順は `params.js` → `data/*.js` → `world.js` → `src/*.js`（`index.html`）。どれも `const` なので `window` のプロパティにはならず、名前で直接参照する。

## よくある足し方

- 敵を足す: `data/enemies.js` に 1 つ足し、`world.js` の湧き場所の `members` にキーを書く。新しい素材を落とすなら `data/items.js` の `materials` にも足す
- 装備の名前・性能を変える: `data/items.js` の `slots` / `affixes`
- 店を足す: `data/items.js` の `shops` に 1 つ足し、`world.js` の NPC に `role: 'shop', shop: '店のキー'` を書く
- クエストを足す: `data/quests.js` に 1 つ足す（`giver` は `world.js` の NPC の `id`）
- ステータスを足す: `data/stats.js` に 1 行足し、`data/player.js` の `stats` に Lv1 の値を書く。レベルで上げるなら `params.js` の `progression.growth`、ほかのステータスから計算するなら `params.js` の `derivedStats` に書く（このときは `stats` に書かない）。それ以外の効き目は `src/` に書く
- 地形を足す: [world.md](world.md) の「ゾーンと障害物」を見る

## 仕組み: データの確認（`src/validate.js`）

起動時に `validateData` が、データどうしの食い違いを調べてコンソールに `[データの確認]` として出す（ゲームは止めない）。

- 敵の落とす素材が `data/items.js` の `materials` にあるか（`data/enemies.js`）
- 湧き場所の敵、地形の種類、門の行き先、`start` / `respawnZone` の復活地点、店の NPC の `shop`、門をたどって全部のゾーンに行けるか（`world.js`）
- 最初の装備の部位とレア度、スキルのキーの重なり、スキルのキーが移動・画面のキーと重なっていないか（`data/player.js`）
- 敵の速度があるか、技の `cooldown` が 1 以上か（`data/enemies.js`）
- 復活地点・門の `spawn`・湧き場所の中心が通れるマスにあるか、NPC のとなりに通れるマスがあるか（`world.js`。ゾーンを 1 つずつ読み込んで調べる）
- 装備の性能・追加性能のステータスが `data/stats.js` にあるか、店の部位・レア度・回復薬があるか、回復薬のキーが重なっていないか（移動・画面・スキルのキーとも）
- 主人公のステータス: 成長するものに Lv1 の値があるか、成長曲線が最大レベルまで届いているか、計算で決まるものを `PLAYER.stats` に書いていないか
- クエストの敵・NPC・前提・報酬の装備
