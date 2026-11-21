# 描画の作り（色・大きさ・描く道具・ワールドの描画）

見た目を変えるときに、どこを直せばよいか。キャラ・地形・演出の描き方の登録表（`UNIT_LOOK` / `TERRAIN_DRAW` / `EFFECT_TYPES`）と絵・演出・地形の足し方は [drawing.md](drawing.md)、HUD とワールドに何を出すかは [ui.md](ui.md)、絵（PNG）の作り方は [image-assets.md](image-assets.md)。

## ファイル

| ファイル | 中身 |
|---|---|
| `data/theme.js` | canvas に描く色と大きさ（`THEME`）、キャラの種類ごとの描き方（`UNIT_LOOK`。[drawing.md](drawing.md)）、キャラの絵の大きさ（`UNIT_SPRITE`） |
| `world.js` | 地形の色（`terrain[種類].colors`・`minimap`）、ゾーンの地面の色（`theme`）、NPC の字・色・絵（`npcs` の `glyph` / `color` / `sprite`） |
| `data/enemies.js` / `data/player.js` / `data/items.js` / `data/buffs.js` | 敵・主人公の色と絵、レア度・素材の色、強化のアイコンの地の色 |
| `style.css` | HTML の画面（タイトル・道具一覧・店・キャラクター・クエスト・会話・一時停止）の見た目。`index.html` が `<link rel="stylesheet" href="style.css">` で読む（相対パスなので `index.html` を直接開いても読める） |
| `src/render.js` | ワールド（地面・地形・門・落とし物・NPC・キャラ・演出・浮かぶ文字）の描画と、描く道具。キャラ（`drawUnit`）・地形（`TERRAIN_DRAW`）・演出（`EFFECT_TYPES`）の描き方の登録表 |
| `src/core.js` | 演出を作る関数（`fxRing` / `fxHit` など。`effects` に足すのはここだけ） |
| `src/hud.js` | HUD（仲間の欄・スキル欄・行動順・メッセージ欄・地図・ツールチップ） |

`src/render.js` / `src/hud.js` には色を直接書かない（`THEME` などから読む）。

## THEME のまとまり（`data/theme.js`）

| まとまり | 中身 |
|---|---|
| `faction` / `spawn` / `level` / `allyHp` / `mp` / `mpShort` | 意味を持つ色（陣営ごとの予告・弾・着弾、出現予告、敵のレベル差、仲間の HP バー、MP） |
| `font` / `background` / `text` | canvas の文字の書体（大きさと太さは書く場所ごと）、canvas の地の色、よく使う文字の色（縁取りの色 `text.outline` など） |
| `bars` | HUD のバー（下地・文字・仲間の欄の HP と少ないときの色・ボスの HP）、キャラの頭上の HP バー（下地・敵・帰還中・幅と高さ） |
| `hud.card` / `hud.skillBar` / `hud.turnOrder` | 左上の仲間の欄・下中央のスキル欄・上中央の行動順の大きさ（px）と色 |
| `hud.message` / `hud.logOutline` | 画面中央の大きい文字、メッセージ欄の文字の縁取り |
| `map` | 右下の地図と世界地図（地・門・つながり・かがり火・NPC・敵・今いるゾーン・名前・敵レベル） |
| `tooltip` | マウスを重ねたときの説明の枠（地・文字・強化の見出し、文字の大きさ・行の高さ・余白・マウスからのずれ） |
| `buffIcon` | 強化・弱体のアイコン（縁・字・上昇 / 低下の印・残りの数、頭上に並べるときの大きさ） |
| `field` | フィールド（マス目の線・カーソル・歩く道・自分のスキルの範囲・予告の「あと N」・門と建物の入口・かがり火・落とし物） |
| `unit` / `npc` | キャラ（影の色と形・絵の足元の輪・当たったときの白・縁・字・主人公の縁と武器・目・ボスの目と輪・構えの「!」）、NPC（名前・「!」「?」・話しかける案内・となりにいるときの縁）。どの種類にどれを使うかは `UNIT_LOOK` |
| `fx` | 演出（火花 1 つのばらつき、当たった・倒れた・レベルアップ・強化・回復・湧いた・投げる技の着弾の色・数・広がり・秒数、弾・マスの光り・残像の秒数） |

`'r,g,b'` の形の色（`faction.*.rgb`・`spawn`・`field.aim`・`field.gate`・`field.door`）は、描くときに透明度を付ける（点滅させるため）。

## 描く道具

| 名前 | ファイル | すること |
|---|---|---|
| `fontOf(px, bold = true)` | `src/render.js` | canvas の文字の書き方（`'bold 13px sans-serif'` など）。書体は `THEME.font` |
| `outlineText(text, x, y, fill, lineWidth, stroke)` | `src/render.js` | 縁取りした文字（縁を描いてから中を塗る）。縁の色の省略時は `THEME.text.outline`。書体・寄せ方は先に決めておく |
| `drawTooltipBox(title, titleColor, lines, border, minW)` | `src/hud.js` | マウスを重ねたときの説明の枠。マウスの右下に出し、画面からはみ出さないよう寄せる。敵・NPC・強化のアイコンの説明がこれを使う |
| `fillTiles(tiles, col, fill, line)` | `src/render.js` | マスの集まりを塗る（予告・スキルの範囲・出現予告・判定の光り） |
| `roundRect` / `bar` / `pathCircle` | `src/hud.js` / `src/render.js` | 角の丸い四角の道、HUD のバー、円の道 |

## 足し方

- **色を変える**: `data/theme.js` の該当するまとまりの値を変える（地形は `world.js` の `terrain`、敵は `data/enemies.js`）。HTML の画面は `style.css`
- **色を足す**: 意味のある色は `src/` に直接書かず、`THEME` の合うまとまりに名前を付けて足し、`src/` からはその名前で読む。HUD の大きさ（欄・スキル欄・行動順・ツールチップの文字）も同じ
- **書体を変える**: canvas は `THEME.font`、HTML の画面は `style.css` の `html, body` の `font-family`
