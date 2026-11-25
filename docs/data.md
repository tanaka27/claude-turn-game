# データの置き場所と足し方

主人公・敵・装備などの「中身の定義」は `data/`、ゲーム全体のしくみの数値は `params.js`、マップの配置は `world.js` に置く。
`src/` のコードには、これらの中身や数値を直接書かない。

## どこに何があるか

| ファイル | 定数 | 中身 |
|---|---|---|
| `params.js` | `PARAMS` | ターンと速度、ダメージ計算、成長、敵のレベル補正（素材の数の伸びを含む）、お金・持ち物、敵の動き（AI）、セーブの間隔 |
| `data/skills.js` | `SKILLS` | スキル（技）の定義（id・名前・種類・範囲・再使用・MP・威力など）。主人公が覚えて使う（仲間にも渡せる）。だれが覚えているか・キー・いつ覚えるかは書かない。技の書き方の説明もここ（敵の技 `data/enemies.js` も同じ書き方） |
| `data/player.js` | `PLAYER` | 主人公の名前・見た目・初期ステータス、通常攻撃、スキルの覚え方（はじめの決まり `learnAtLevel`: スキルの id → 覚えるレベル）、スキル欄のはじめの並び（`skillSlots`: キー → スキルの id）、最初の装備（`startEquip`）。ステータスの書き方の説明もここ |
| `data/enemies.js` | `ENEMIES` | 敵（モンスター）の種類ごとの名前・字・色・描く大きさ・経験値・落とす素材（`drops`）・装備を落とす確率・間合い（`keepDistance`）・技を狙う確率（`skillChance`）・ステータス（主人公と同じもの）・装備のかわりの上乗せ（`gear`）・技（消費 MP 付き） |
| `data/npcs.js` | `NPC_KINDS` | NPC の種類（商人・鍛冶屋・衛兵・ギルドの職員・冒険者）ごとの表示名・ステータス（主人公と同じもの）・装備のかわりの上乗せ（`gear`）。配置は `world.js` の NPC の `kind` で選ぶ。今は NPC に攻撃は当たらない |
| `data/items.js` | `ITEMS` | レア度、部位（基本性能・名前）、追加性能、価値、道具（`consumables`。レア度・使うキー・効果の並び `effects`。[consumables.md](consumables.md)）、商人の品ぞろえ（`shops`）、鍛冶屋の品ぞろえ（`smiths`）、素材（名前・レア度・売値・色） |
| `data/quests.js` | `QUESTS` | クエスト（依頼する NPC・目標 `goal`（種類 `kill` / `collect` / `talk` と敵・素材・NPC・数。[quests.md](quests.md)）・報酬（道具は `consumables: [{ id, count }]`）・前提） |
| `data/stats.js` | `STATS` | ステータスの表示名・桁数（並び順がキャラクターの画面のつよさの並び順） |
| `data/buffs.js` | `BUFFS` | 強化・弱体（バフ・デバフ）の種類（表示名・変えるステータスと倍率・アイコンの字と色）。倍率が 1 より小さいものが弱体。どのキャラにもかけられる。今かける手段は `data/skills.js` の `type: 'buff'` の技（自分を強化）だけ（[combat.md](combat.md)） |
| `data/theme.js` | `THEME` / `UNIT_SPRITE` | 意味を持つ色（陣営ごとの予測線・弾の色、出現予告、敵のレベル差の色、仲間の HP バー、MP のゲージと消費 MP の色）と、canvas に描く色と大きさのまとまり（`font` / `background` / `text` / `bars` / `hud` / `map` / `tooltip` / `buffIcon` / `field` / `unit` / `npc` / `fx`、メッセージ欄の文の色 `msg`、浮かぶ文字の色と大きさ `float`。中身は [render.md](render.md)）、キャラの種類ごとの描き方（`UNIT_LOOK`。[drawing.md](drawing.md)）、キャラの絵の大きさ。HTML の画面の見た目は `style.css` |
| `data/text.js` | `TEXT` | 画面に出す文章のひな形（メッセージ欄・大きい文字・浮かぶ文字・HUD・ワールドの文字・HTML の画面・タイトルとセーブの説明）。`{名前}` に値が入る。`src/` は `txt('まとまり.名前', { … })` で引く。言い回しの変え方・色の置き場所（`THEME.msg` / `THEME.float`）は [text.md](text.md) |
| `world.js` | `WORLD` | ワールドマップ（`overworld`、文字の地図 `grid`・入口 `places`・地方 `regions`、地面の種類 `grounds`・文字の意味 `legend`、世界地図の大きさ `worldMap`。[overworld.md](overworld.md)）、地形の種類（`terrain`）、町・ダンジョンのゾーン、門、湧き場所、NPC（位置は px で書き、読み込むときにマスに直す。ステータスの種類は `kind`） |

読み込み順は `params.js` → `data/*.js` → `world.js` → `src/*.js`（`index.html`）。どれも `const` なので `window` のプロパティにはならず、名前で直接参照する。

## よくある足し方

- 敵を足す: `data/enemies.js` に 1 つ足し、`world.js` の湧き場所の `members` にキーを書く。新しい素材を落とすなら `data/items.js` の `materials` にも足す
- 装備の名前・性能を変える: `data/items.js` の `slots` / `affixes`
- 店を足す: 商人は `data/items.js` の `shops` に 1 つ足し、`world.js` の NPC に `role: 'shop', shop: '店のキー'` を書く。鍛冶屋は `smiths` に足し、NPC に `role: 'smith', smith: '鍛冶屋のキー'` を書く。新しい種類の施設（役目）を足すときは [screens.md](screens.md) の「施設の足し方」
- 入れる建物を足す・話すだけの NPC を足す: [buildings.md](buildings.md)
- NPC を足す: `world.js` の `npcs` に足し、`kind` に `data/npcs.js` の種類を書く。合う種類がなければ `NPC_KINDS` に 1 つ足す。絵を付けるなら `sprite`（[drawing.md](drawing.md)）
- クエストを足す: `data/quests.js` に 1 つ足す（`giver` は `world.js` の NPC の `id`。目標は `goal: { kind, … }`。くり返し受けられるものは `repeatable: true`。[quests.md](quests.md) の「足し方」）。`id` はセーブに残るので、あとから変えるときはセーブの版を上げて古い id を直す（[save-versions.md](save-versions.md)）
- ステータスを足す: `data/stats.js` に 1 行足し、`data/player.js` の `stats` に Lv1 の値を書く。行動で伸ばすなら `params.js` の `progression.growth` の `stats` と `events`（最初の潜在は `data/player.js` の `potential`。[growth.md](growth.md)）、ほかのステータスから計算するなら `params.js` の `derivedStats` に書く（このときは `stats` に書かない）。それ以外の効き目は `src/` に書く
- 道具を足す: [consumables.md](consumables.md) の「道具を足す」
- 強化を足す: `data/buffs.js` に 1 つ足し、`data/skills.js` に `type: 'buff', buff: 'キー', duration: 行動回数` の技を足す
- 主人公のスキルを足す: `data/skills.js` に 1 つ足し（`id` は英字。セーブに残るのであとから変えない。変えるならセーブの版を上げて直す）、`data/player.js` の `learnAtLevel` に覚えるレベル、`skillSlots` にキーを書く（キーに置かないと使えない）。仕組みは [skill-use.md](skill-use.md) の「覚えているスキルとスキル欄」
- 地形を足す: [world.md](world.md) の「ゾーンと障害物」を見る

## 仕組み: データの確認（`src/validate.js`）

起動時に `validateData` が、データどうしの食い違いを調べてコンソールに `[データの確認]` として出す（ゲームは止めない）。

- ワールドマップの文字の地図（行の長さ・文字・入口が 1 つずつ・外周）と、はじめの町から全部の入口・湧き場所に歩いて行けるか（`world.js`。[overworld.md](overworld.md)）
- 敵の落とす素材が `data/items.js` の `materials` にあるか（`data/enemies.js`）。同じ敵の素材どうしで、レア度が高いほうが確率が低く（同じまで）売値が高いか
- 道具・素材のレア度が `rarities` にあるか
- 強化の `stat` が `data/stats.js` にあり `mult` が 0 より大きいか、強化の技の `buff` が `data/buffs.js` にあり `duration` が 1 以上か（`data/buffs.js`・`data/skills.js`）
- 湧き場所の敵、地形の種類、門の行き先、`start` / `respawnZone` の復活地点、店の NPC の `shop` / 鍛冶屋の NPC の `smith`、NPC の `kind`、話すだけの NPC の `lines`、建物の中のゾーンの `parent` と入口、門をたどって全部のゾーンに行けるか（`world.js`）
- 最初の装備の部位とレア度、`mpRegen` があるか（`data/player.js`）、スキルの `mp` が 0 以上で Lv1 の さいだいMP（`deriveStats` で計算した値）以下か、スキルに `id` があり重なっていないか（`data/skills.js`）
- スキルの覚え方 `learnAtLevel` のスキルが `data/skills.js` にあり、レベルが 1〜最大レベルの整数か、Lv1 で覚えるスキルがあるか。スキル欄 `skillSlots` のスキルが `data/skills.js` にあるか、同じスキルを 2 つのキーに置いていないか、キーの重なり、キーが移動・画面のキーと重なっていないか（`data/player.js`）
- 敵のステータスが主人公と同じものだけそろっているか（計算で決まるものを書いていないか）、`gear` のステータスが `data/stats.js` にあるか、技の `cooldown` が 1 以上か、技の `mp` が 0 以上で Lv1 の `maxMp` 以下か、MP を使わない基本の技があるか、`skillChance` が 0〜1・`keepDistance` と技の `weight` が 0 より大きいか、技の `situations` が `params.js` にあるか、`surround` が true / false か（`data/enemies.js`）。`src/ai.js` の `SITUATIONS` の数値が `params.js` にあるか
- 技の `kind` が physical か magic か、物理の技に `power`、術に `base` があるか（主人公と敵）
- NPC の絵 `sprite` が PNG か WebP のパスか（`world.js`。起動時に読み込みを始める）、キャラの描き方 `UNIT_LOOK` にどの種類もあり `overlays` が `UNIT_OVERLAYS`（`src/render.js`）にあるか（`data/theme.js`）
- 復活地点・門の `spawn`・湧き場所の中心が通れるマスにあるか、NPC のとなりに通れるマスがあるか（`world.js`。ゾーンを 1 つずつ読み込んで調べる）
- 装備の性能・追加性能のステータスが `data/stats.js` にあるか、商人の道具・鍛冶屋の部位とレア度があるか。道具: キーがあり重なっていないか（移動・画面（I / F / P / M / Tab / Esc / Enter）・スキルのキーとも）、`name`、`max`（1 以上の整数）、`start`（0〜`max`）、`price`（1 以上の整数）、`effects` が 1 つ以上で効果の種類が `ITEM_EFFECTS` にあり、種類ごとの数値（`ratio` / `buff` / `actions`）がおかしくないか
- NPC の種類のステータスが主人公と同じものだけそろっているか、`gear` のステータスが `data/stats.js` にあるか（`data/npcs.js`）
- 主人公のステータス: 行動で伸びるもの（`progression.growth.stats`）に Lv1 の値があるか、伸びの数値・潜在の範囲・出来事のステータス・最初の潜在がおかしくないか、計算で決まるものを `PLAYER.stats` に書いていないか
- クエストの目標（種類があるか、種類ごとの敵・素材・NPC・数）・NPC・前提・報酬の装備・報酬の道具（`consumables` にあるか、`count` が 1 以上の整数か）
- セーブの形の直し方（`src/save.js` の `SAVE_MIGRATIONS`）が最初の版から今の版までそろっているか
- 画面に出す文章（`data/text.js`）がどれも文字列で、`{ }` が `{名前}` の形だけか。使っているキーがない・`{名前}` に入れる値がないときは、引いたとき（`txt`）に 1 回だけ出す（[text.md](text.md)）
