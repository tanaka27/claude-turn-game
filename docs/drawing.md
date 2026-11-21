# キャラ・地形・演出の描き方（登録表）と足し方

見た目の作り直しで、ゲームの動きに触らずに「データを書く」「描き方を 1 つ足す」で済むようにしたしくみ。色と大きさの置き場所・描く道具は [render.md](render.md)。

## キャラ（主人公・敵・ボス・仲間・NPC）: `drawUnit`（`src/render.js`）

どのキャラも同じ `drawUnit(u, near)` で描く（NPC も。`near`: NPC が主人公のとなりにいるか）。

1. 種類を決める: `unitKind(u)` → `hero`（主人公）/ `npc`（`faction === 'npc'`）/ `boss`（`isBoss`）/ `ally`（主人公の陣営のほかのキャラ）/ `enemy`
2. 種類の描き方 `UNIT_LOOK[種類]`（`data/theme.js`）を引き、描く場所 `v = { u, look, x, y, r, near, spriteTop }` を作る（NPC は描く位置を持たないので `onTile: true` でマスの中心に、大きさは `look.r`）
3. 影（`drawShadow`。楕円は `look.shadow`（px）か、`r` × `THEME.unit.shadowShape`）
4. 体: 絵があれば足元の輪（`look.footRing`）と絵（`drawUnitSprite`。右向きの絵を向きで左右反転、当たった瞬間は白）。なければ図形（`drawUnitShape`。`look` に書いた部品だけを `weapon` → `ears` → 丸い体 → `eyes` → `bodyRing` → `glyph` の順に）
5. 体の上のもの: `look.overlays` に書いた名前を順に `UNIT_OVERLAYS` で描く（`buffs` 強化のアイコン / `hpBar` HP バー / `level` レベル / `charge` 構えの「!」 / `name` 名前 / `questMark` クエストの「!」「?」 / `talkHint`「F: 話しかける」）。頭の高さは絵の上端か体の上端（`headOf`）

| 種類 | 絵がないとき | 体の上 | そのほか |
|---|---|---|---|
| `hero` | 丸い体（縁 `heroEdge`）と剣の線 | 強化のアイコン（頭の 4px 上） | 絵のときは足元に自分の色の輪 |
| `enemy` | 耳・丸い体・白い目・字 | 強化（14px 上）・HP バー（赤、帰還中は灰色）・レベル・「!」 | |
| `boss` | 敵と同じで、目が黄色・体に金の輪 | 敵と同じ | 絵のときは足元に金の輪 |
| `ally` | 敵と同じ | 敵と同じで HP バーが緑（`allyHp`） | |
| `npc` | 丸い体（となりにいると白い縁）と字（16px） | 名前・クエストの印・話しかける案内 | 絵のときは、となりにいると足元に白い輪 |

### 絵のありか（`SPRITE_SOURCE`）

キャラの絵は「そのキャラ自身の絵の指定」から読む（`unitSprite(u)`）: 主人公は `data/player.js` の `sprite`、敵・ボスは `data/enemies.js` の種類の `sprite`、仲間はその種類（`createAlly` に渡す `def`）の `sprite`、**NPC は `world.js` の NPC の `sprite`**（NPC の字・色と同じく、1 人ずつ書く）。指定がないか読み込めないうちは図形で描く。起動時のデータの確認が絵の形（PNG か WebP のパス）を確かめ、読み込みを始める。

### アニメーションを足すとき（今は 1 枚の絵だけ）

- 入り口は `spriteFrameSrc(entry, u)`（`src/render.js`）。今は指定（`entry`）が文字列ならそのままパスを返す
- コマ・向きごとの絵を足すときは、指定を `{ frames: [...], fps, … }` や `{ up, down, side }` のようなオブジェクトにして、ここで `u.facing`・`game.rt`・描く位置が追いついたか（`u.x` と `tileCenter(u.tx)`）からコマを選んで返す。左右反転は `drawUnitSprite` がしているので、向きの絵を足すならそこも合わせる
- `src/validate.js` の `sprite` の形の確認（主人公・敵・NPC）も、オブジェクトを受け付けるように直す
- 絵は `getSprite` が最初に使うときに読み込み、当たったとき用の白い絵も作る（コマごとに呼べばよい）

## 地形: `TERRAIN_DRAW`（`src/render.js`）

地形の種類（`world.js` の `terrain` のキー）→ 描き方 `(o, c)`（`o`: 障害物 `{ kind, x, y, w, h }`（px）、`c`: その種類の `colors`）。`drawObstacle` は表から引くだけ（表にない種類は柵の描き方）。

## 演出: `EFFECT_TYPES`（`src/render.js`）と `fx〇〇`（`src/core.js`）

- 演出は `effects` に入り、実時間で `t` が `life` まで進んで消える（`src/main.js` の `updateFx`）
- **作る**のは `src/core.js` の関数だけ（`effects.push` を直接書かない）: 形ごとの `fxRing`（広がる輪）/ `fxTiles`（マスが光る）/ `fxBolt`（弾の線）/ `fxArc`（投げたものの放物線）/ `fxGhost`（ダッシュの残像）/ `burst`（火花）と、意味ごとの `fxHit`（当たった）/ `fxDeath`（倒れた）/ `fxLevelUp` / `fxBuff`（自分を強化）/ `fxHeal`（回復薬）/ `fxSpawn`（敵が湧いた）/ `fxLobImpact`（投げる技の着弾）
- 意味ごとの色・数・広がり・続く秒数は `data/theme.js` の `THEME.fx`
- **描く**のは `EFFECT_TYPES[type].draw(f, k)`（`k`: 0〜1 の進み具合）。`under: true` ならキャラより下に描く（残像）。`update(f, dt)` があれば毎フレーム動かす（火花）
- `burst` は火花 1 つにつき乱数を 向き・速さ・続く秒数・大きさ の順に引く（自動で戦わせる確認が同じ結果になるように、数と順番を変えない）

## 足し方

- **NPC に絵を付ける**: 絵を `assets/sprites/npcs/<id>.png`（右向き・透明、[image-assets.md](image-assets.md) の `--kind sprite`）に置き、`world.js` のその NPC に `sprite: 'assets/sprites/npcs/<id>.png'` を書く。名前・印は絵の上端の上に出る
- **敵・仲間に絵を付ける**: 種類に `sprite` を書く（[image-assets.md](image-assets.md)）
- **種類ごとの見た目を変える**: `UNIT_LOOK` の部品・`overlays`・色を書き換える（例: 仲間にもボスのような輪を付ける → `ally.footRing`）。新しい頭上の表示は `UNIT_OVERLAYS` に描き方を 1 つ足し、`overlays` に名前を書く（ない名前はデータの確認で出る）
- **新しい演出の種類**: `EFFECT_TYPES` に `{ draw(f, k) { … } }` を 1 つ、`src/core.js` に作る関数（`addEffect('種類', { …, life })`）を 1 つ足し、ゲームの中ではその関数を呼ぶ。意味のある色・秒数は `THEME.fx` に
- **新しい地形の種類**: `world.js` の `terrain` に 1 行（`blocksShots`・`minimap`・`colors`）、`TERRAIN_DRAW` に描き方を 1 つ
- **新しい色**: [render.md](render.md) の「足し方」
