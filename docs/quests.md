# クエスト

クエストのデータの形、目標の種類（倒す・集める・話しかける）、進み具合を進める出来事、今のクエスト、画面、足し方。
データは `data/quests.js`（`QUESTS`）、コードは `src/quests.js`（目標の種類の表 `QUEST_GOALS`・出来事 `questEvent`・画面）。NPC の配置は [world.md](world.md)、ギルドの建物は [buildings.md](buildings.md)、画面の登録表は [screens.md](screens.md)。

始まりの町の衛兵隊長（物語の討伐。順に続く）と、冒険者ギルドの受付（くり返し受けられる依頼が中心）から受ける。前のクエスト（`requires`）を報告し、レベルが足りていると受けられる。

## データの形（`data/quests.js`）

```js
{ id: 'c_wolf', giver: 'captain', name: 'ウルフ退治', goal: { kind: 'kill', enemy: 'wolf', count: 8 }, where: '風の草原', minLevel: 1,
  desc: '…', reward: { exp: 80, gold: 50 } },
```

| 項目 | 中身 |
|---|---|
| `id` | セーブに残る（`player.quests`）。あとから変えるときはセーブの版を上げて古い id を直す（[save-versions.md](save-versions.md)） |
| `giver` | 受ける・報告する NPC の id（`world.js`。`role: 'quest'` の NPC） |
| `name` / `desc` / `where` | 名前・説明・場所（説明用の文） |
| `goal` | 目標。`{ kind: 目標の種類, …その種類が使う項目 }`（下の表） |
| `minLevel` / `requires` | 受けられるレベル / 先に報告しておくクエストの id |
| `repeatable` | `true` なら報告したあとまた受けられる（ほかのクエストの `requires` には使えない） |
| `reward` | `exp`・`gold`・`consumables`（道具 `[{ id: 'potion', count: 2 }]`。`id` は `data/items.js` の `consumables` のキー。何種類でも書ける。持てる数（`max`）を超えた分はもらえない）・`item`（装備 `{ slot, rarity }`。装備のレベルは報告したときの自分のレベル） |

## 目標の種類（`QUEST_GOALS`、`src/quests.js`）

| `kind` | 書く項目 | 数え方 | 聞く出来事 | 内容の文 | 報告したとき |
|---|---|---|---|---|---|
| `kill` | `enemy`（`data/enemies.js` の種類）、`count` | 受けた後に倒した数（どのゾーンで倒してもよい）。`player.quests[id].count` | `kill` | 「ウルフを 8 体倒す」 | — |
| `collect` | `material`（`data/items.js` の `materials` のキー）、`count` | **今持っている数**（受ける前から持っている分も数える。数は覚えず毎回持ち物から出す） | `materials` | 「狼の毛皮を 3 個集める」 | `count` 個を渡す（持ち物から減る） |
| `talk` | `npc`（`world.js` の NPC の id） | 受けた後にその NPC に話しかけたら 1（目標の数は 1） | `talk` | 「冒険者と話す」 | — |

今のクエストはどれも `kill`。`collect` と `talk` はテスト（`tests/quests.test.js`）でクエストを足して確かめているが、まだ使っているクエストはない。
品物をほかの NPC に「届ける」は今はない（依頼した NPC に素材を持ってくるのは `collect`。ほかの NPC に渡すなら `talk` に持ち物の条件を足す種類を作る）。

種類ごとに持つもの:

| 名前 | 中身 |
|---|---|
| `on` | `{ 出来事の名前: (goal, st, …出来事の引数) }`。受けている（`active`）ときにその出来事で `st`（`player.quests[id]`）を進める。数を覚えない種類（`collect`）は何もしない関数を書く（出来事のたびに達成を確かめ直すため） |
| `progress(goal, st)` | 今の数 |
| `need(goal)` | 目標の数（省略すると `goal.count`。`talk` は 1） |
| `text(goal)` | クエストの画面の「内容」の文 |
| `short(goal)` | キャラクターの画面で「3 / 8」の前に書く名前（`kill` は敵の名前） |
| `activeHint` | 受けているときに詳細の下に出す案内（`kill` は「受けている（倒した数は受けたあとから数える）」） |
| `claim(goal)` | 報告したときにすること（省略可。`collect` は素材を渡す） |
| `check(goal)` | データの食い違いの文の並び（起動時の `validateData` が「data/quests.js 'id': …」を付けて出す） |

## 出来事（`questEvent`）

進み具合は、ゲームの出来事を `questEvent(名前, …引数)` で受けているクエストに伝えて進める。その名前を `on` に持つ種類のクエストだけが動く。

| 名前 | 呼ぶところ | 引数 |
|---|---|---|
| `kill` | 敵が倒れたとき（`enemyDefeated`、`src/combat.js`） | 倒れた敵 |
| `materials` | 素材の数が変わったとき: 拾う（`pickUpAt`、`src/items.js`）・売る（`sellMaterial`、`src/ui.js`）・報告で渡す（`claimQuest`） | なし |
| `talk` | NPC に話しかけたとき（`talkTo`、`src/ui.js`。役目の画面を開く前） | その NPC |

`questEvent` は、受けている（`active`）クエストなら種類の `on` を呼び、そのあと `active` と `ready` のクエストの達成を `settleQuest` で確かめる。
`settleQuest` は全部の種類で同じ: 目標に届けば `active` → `ready` にして画面に「クエスト達成！」「「名前」を〇〇に報告しよう」を出す。届かなくなれば `ready` → `active` に戻す（`collect` で素材を売ったとき・同じ素材のクエストを先に報告したとき。知らせは出さない）。
受けたとき（`questAction`）も `settleQuest` を通すので、もう素材を持っていれば `collect` はすぐ報告できるになる。

## 今のクエスト

### 衛兵隊長（`captain`）

| id | 名前 | 目標（すべて `kill`） | 受けられるレベル | 報酬 |
|---|---|---|---|---|
| c_wolf | ウルフ退治 | ウルフ ×8 | 1 | 経験値 80、50 G |
| c_bee | 毒針の羽音 | キラービー ×5 | 2 | 経験値 150、60 G、回復薬 ×2 |
| c_salamander | 火を吐くトカゲ | サラマンダー ×6 | 3 | 経験値 300、100 G、レアの装飾品 |
| c_wolfKing | 狼王 | 狼王 ×1 | 5 | 経験値 600、200 G、レアの武器 |
| c_golem | 動く岩 | ロックゴーレム ×6 | 6 | 経験値 1000、250 G、回復薬 ×3 |
| c_treant | 森の主 | 森の主 ×1 | 8 | 経験値 1800、400 G、エピックの防具 |
| c_dragon | 魔竜討伐 | 魔竜 ×1 | 9 | 経験値 3000、800 G、エピックの武器 |

（`id` は `c_` + 倒す敵。セーブの形 v1 までは敵を人からモンスターに変える前の名前（`goblin` など）だったので、v1 のセーブは読むときに新しい id に直す。[save-versions.md](save-versions.md)）

### 冒険者ギルドの受付（`guildClerk`）

「新人の腕試し」を報告すると、ほかの依頼が受けられるようになる。くり返し（`repeatable: true`）の依頼は、報告するとまた受けられる。

| id | 名前 | 目標（すべて `kill`） | 受けられるレベル | くり返し | 報酬 |
|---|---|---|---|---|---|
| g_trial | 新人の腕試し | ウルフ ×3 | 1 | | 経験値 30、30 G、回復薬 ×2 |
| g_wolf | ウルフの間引き | ウルフ ×10 | 1 | ○ | 経験値 70、45 G |
| g_boar | 畑を荒らすイノシシ | ホーンボア ×6 | 2 | ○ | 経験値 110、60 G |
| g_bee | 大蜂の巣払い | キラービー ×8 | 3 | ○ | 経験値 180、80 G |
| g_salamander | 火吹きトカゲの駆除 | サラマンダー ×8 | 5 | ○ | 経験値 400、140 G |
| g_golem | 岩人形の破壊 | ロックゴーレム ×5 | 6 | ○ | 経験値 650、220 G |


## 仕組み

- クエストの状態は `player.quests[id] = { state, count }`。`count` は種類が使うもの（`kill`: 倒した数 / `talk`: 話しかけたら 1 / `collect`: 使わず 0 のまま）。どの種類も同じ形なのでセーブの版は変わらない（[save.md](save.md)）。`questStatus` が `locked`（前のクエストがまだ）/ `lowLevel` / `available` / `active` / `ready`（報告できる）/ `claimed`（報告済み）を返す
- くり返しのクエスト（`repeatable`）は、報告すると `player.quests` から記録を消すので、また `available` になる
- NPC の頭上の印: 報告できるクエストがあれば「?」、くり返しでないクエストを受けられれば「!」（くり返しの依頼だけなら印は出さない。`npcMark`）。どの種類でも `ready` なら「?」
- クエストの画面は HTML（`index.html` の `#quest`）。`role: 'quest'` の NPC に話しかけると `openScreen('quest', NPC)` で開く（画面の登録表の `quest`。[screens.md](screens.md)）。左が依頼の一覧（`questEntries`。報告できる → 受けている → 受けられる → レベル不足 → 報告済みの順。前のクエストがまだのものは出さない。受けているものは「受けている　3 / 8」）、右が選んでいる依頼の内容（説明・目標の文（受けていれば「　3 / 8」を付ける）・場所・報酬）と「受ける」「報告する」ボタン。一覧はクリックか ↑↓ で選び（`moveQuestSel`）、Enter かボタンで受ける・報告する（`questAction`）。`renderQuest` が中身を作る。進み具合の文「3 / 8」は `progressText`（目標の数で止める）
- キャラクターの画面（`profileHtml`、[menu.md](menu.md)）は受けているクエストを「名前　ウルフ 3 / 8」（種類の `short` と数）、報告できるものを緑で「〇〇に報告」と出す
- 報告すると `claimQuest` が報酬を渡す（装備の報酬は持ち物がいっぱいだと受け取れない。そのときは素材も渡さない。道具は持てる数まで）。そのあと種類の `claim`（`collect` は素材を渡す）。報酬の文は `rewardText`（「経験値 150、60 G、回復薬 ×2」）
- データの確認（`validateData`）: 目標の種類が `QUEST_GOALS` にあるか、種類の `check`（敵・素材・NPC があるか、`count` が 1 以上の整数か）、依頼する NPC、`requires` のクエストがあってくり返しでないか、報酬の装備・道具

## 足し方

### クエストを足す

1. `data/quests.js` の `QUESTS` に 1 つ足す（上から順に一覧に出る）。`giver` は `world.js` の `role: 'quest'` の NPC
2. `goal` に種類と項目を書く。例:
   - 倒す: `goal: { kind: 'kill', enemy: 'boar', count: 6 }`
   - 集める: `goal: { kind: 'collect', material: 'wolfPelt', count: 5 }`（報告すると 5 個渡す）
   - 話しかける: `goal: { kind: 'talk', npc: 'adventurer' }`（話しかける NPC はどの役目でもよい。依頼した NPC 自身でもよい）
3. 上の「今のクエスト」の表を直す。起動時の `[データの確認]` で参照の食い違いがわかる

### 目標の種類を足す

1. `src/quests.js` の `QUEST_GOALS` に 1 つ足す（`on` / `progress` / `text` / `short` / `activeHint` / `check`、必要なら `need` / `claim`）
2. 新しい出来事が要るなら、その出来事が起きる場所で `questEvent('名前', …)` を呼ぶ（今ある出来事で足りればいらない）
3. 数を覚えるなら `st.count` を使う（セーブの形はそのまま）。別の形のものを覚えるならセーブの版を上げる（[save-versions.md](save-versions.md)）
4. この文書の「目標の種類」の表と、`tests/quests.test.js` にテストを足す
