# 戦闘（技・予告）

技の定義形式、主人公の技、敵の技の予告、判定の仕組み。
ステータスとダメージ計算（物理・術）は [damage.md](damage.md)。
主人公の技は `data/player.js`、敵の技は `data/enemies.js`。コードは `src/combat.js`。
行動の順番は [turn.md](turn.md)。

## 技の定義形式

距離・範囲はマス、時間は行動回数。書き方の説明は `data/player.js` の先頭にもある。

| 項目 | 意味 |
|---|---|
| type | `melee`（自分のまわり）/ `projectile`（まっすぐ飛ぶ弾）/ `lob`（指定したマスへ投げる。壁を越える）/ `dash`（移動） |
| shape | melee の形。`fan`（扇形）/ `circle`（円）/ `line`（直線） |
| range | 射程（マス）。fan / circle は半径（マスの中心どうしの距離）、line / projectile は長さ（縦横の大きいほうで数える。斜めも同じ歩数まで届く）。となりのマスだけなら 1.5 |
| angle | fan の角度（度） |
| width | line / projectile の幅（マス。今は 1 だけ） |
| charge | 0 なら使ったその場で判定。1 なら予告を出し、使った者の次の行動で判定 |
| cooldown | 再使用までの行動回数（N なら N 回の行動に 1 回使える） |
| kind | `physical`（物理、省略時）/ `magic`（術） |
| power | 物理の威力倍率 |
| base / intRate | 術の固定ダメージ / かしこさの効き（省略時は `params.js` の `magic.intRate`） |
| pierce | 弾が貫通する |
| count / spread | 同時に撃つ弾の数 / 広がる角度（度） |
| castRange / radius / scatter | lob の最大射程 / 着弾範囲の半径 / 複数投げるときの散らばり（どれもマス） |

## 主人公の技（`data/player.js`）

| キー | 名前 | 内容 | 再使用 | 種類・威力 | 解放 |
|---|---|---|---|---|---|
| 敵へ移動 | 斬撃 | 通常攻撃。となりの敵 1 体 | - | 物理 1.0 | Lv1 |
| 1 | 衝撃波 | 9 マス貫通する直線の弾 | 5 | 物理 1.4 | Lv1 |
| 2 | 旋風斬 | 自分のまわり半径 2.3 マス | 7 | 物理 1.6 | Lv3 |
| 3 | メテオ | 8 マス以内のマスへ。半径 2.3 マス | 14 | 術 base 6 | Lv6 |
| 4 | ダッシュ | 狙った向き（8 方向）へ最大 4 マス一気に進む（1 行動） | 6 | - | Lv1 |

主人公のスキルはどれも予告なし（使ったその場で当たる）。

## 敵の技の予告

`charge: 1` の技は、使うと範囲のマスが赤く塗られ（予告）、**その敵の次の行動**で判定する。
その間に範囲の外へ出れば当たらない。予告には「あと N」（それまでに主人公が動ける回数）を出し、1 のときは点滅する。
予告中の敵は頭上に「!」が付き、メッセージ欄に「〇〇は△△の構えをとった。」と出る。

範囲は予告を出したときに決まる（狙ったマスも、lob の散らばりもそのとき決める）。予告中の敵を倒すと予告は消える。

## 仕組み

- `planAttack(u, atk, ax, ay)`: 技の範囲を決める。戻り値は範囲のマス（`tiles`、`keys`）、弾の通り道（`rays`）、着弾点（`centers`）
  - melee の fan / circle: 半径内で、角度に入り、攻撃を遮る地形でなく、視線が通るマス
  - line / projectile: `rayTiles` で直線のマス（攻撃を遮る地形の手前まで）
  - lob: 射程より遠ければ同じ向きで射程いっぱいのマスにする。着弾点の半径内で、着弾点から視線が通るマス（着弾点が壁の中なら視線は見ない）
- `resolveAttack(h)`: 判定。範囲のマスにいる相手に `dealDamage`（同じ相手には 1 回だけ）。projectile は弾の通り道を近い順に見て、`pierce` でなければ最初に当たった相手で止まる
- `startCharge` / `cancelCharge`: 予告を `hazards` に出す・消す。敵の `charging` に持つ
- `rollDamage(src, tgt, a)`: 技 `a` の `kind` で物理か術の式を選び、`{ dmg, crit }` を返す
- `dealDamage(src, tgt, a, what)`: `rollDamage` でダメージを決め、浮かぶ数字、メッセージ欄。待機中の敵は追跡を始める（`aggro`）。HP が 0 以下なら `kill`
- 主人公のスキルは `castSkill`（`src/player.js`）が `planAttack` → `resolveAttack` → 再使用を設定 → `endPlayerAction`。狙っている間は同じ `planAttack` の範囲を白く表示する
