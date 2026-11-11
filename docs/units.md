# 戦うキャラの集まり（units）・陣営・行動の決め方・倒れたとき

主人公・敵（これからの仲間も）を 1 つの集まりで扱うしくみ。コードは `src/core.js`（`units`）、`src/units.js`（生成・`unitAt`・`opponents`）、`src/turn.js`（`CONTROLLERS`・`endTurn`）、`src/ai.js`（`chooseTarget`）、`src/combat.js`（`dealDamage`・`kill`）。
行動順は [turn.md](turn.md)、敵の動きは [enemy-ai.md](enemy-ai.md)、技の判定は [combat.md](combat.md)。

## units と player

- `units`: 今のゾーンで戦うキャラ全員。**ここが唯一の持ち場**で、「このマスに誰がいるか」（`unitAt`）、「誰が次に行動するか」（`nextUnit`）、「誰が回復するか」（`advanceTime`）、「誰の敵か」（`opponents`）はここから探す
- ゾーンに入ると `units = [player]` にしてから敵を湧かせる（`placeEnemy` が足す）。主人公はいつも先頭
- 倒れたキャラは、ほかのキャラの行動の区切り（`runUntilInput`）で外す。主人公は倒れても外さない（復活するため）
- `player`: そのうち人が操作するキャラ（主人公）。入力・カメラ・HUD・セーブ・経験値は主人公を見る
- `factionUnits(f)`: 陣営 f のキャラ（倒れて外れる前のものも入る。描画・HUD・ミニマップ・ツールチップ用）。デバッグ用の `window.__game.enemies` は `factionUnits('enemy')`、`window.__game.units` が `units`
- 別に「敵の配列」は持たない（2 つが食い違わないように）

## 陣営（faction）

| 陣営 | だれ | 敵 |
|---|---|---|
| `player` | 主人公（とこれからの仲間） | `enemy` |
| `enemy` | 敵 | `player` |
| `npc` | NPC（`units` には入らない。マスは地形として通れなくする） | なし |

- `hostileTo(a, b)`: 陣営 a から見て b が敵か
- `opponents(faction)`: その陣営から見た敵のうち倒れていないもの（`units` の順）。技の当たる相手・敵の狙う相手の候補
- 主人公は同じ陣営のキャラのマスへは動けない（攻撃しない・行動にならない。`tryMove`）
- 主人公の陣営は休息で回復が増える（敵にはない。[turn.md](turn.md)）

## 行動の決め方（control）

キャラの `control` が `CONTROLLERS`（`src/turn.js`）のどれか:

| control | だれ | 自分の番に |
|---|---|---|
| `input` | 主人公 | 止まって入力を待つ（行動したら `endPlayerAction`） |
| `ai` | 敵 | `enemyAct`（[enemy-ai.md](enemy-ai.md)） |
| `wait` | テスト用の仲間 | 何もしない |

予告した技があるキャラ（`charging`）は、`control` を呼ぶ代わりにそれを出す（`releaseCharge`。どの `control` でも）。再使用待ちが行動の初めに減る決まり（敵）のキャラは、`control` を呼ぶ前に減らす（[skill-use.md](skill-use.md)）。

どのキャラも行動のあとは `endTurn(u)`（次の時刻・スキルの再使用待ち（決まりが `hero` のキャラ）・強化と弱体）を通る。キャラごとの「行動 1 回ぶん進めるもの」はここに足す（毒のような行動ごとの効果は、そこから呼ばれる `tickBuffs` に）。スタンのような「行動できない」効果を足すときは、`runUntilInput` で `control` を呼ぶ前に判定する。

## 技を使う（どのキャラも同じ）

- 技を使うのはどのキャラも `useSkill(u, sk, tx, ty)`（攻撃・予告ありの技・ダッシュ・強化）。主人公の入力（`castSkill`）と敵の AI（`useEnemyAttack`）は、何をどこへ使うかを決めて呼ぶだけ
- どのキャラも `skills`（技の並び）、`skillCd`（再使用待ち）、`skillRule`（再使用待ちと MP の決まり: 主人公 `hero`、敵 `enemy`）を持つ。詳しくは [skill-use.md](skill-use.md)

## 敵の狙う相手

敵は毎回の行動で、`opponents(e.faction)` から狙う相手を選ぶ（`chooseTarget`。視線が通るものを先に、近い順、同じなら `units` の順）。選んだ相手は `e.target`。気づく・追う・技を選ぶ・近づく・取り囲むは、主人公ではなくこの相手を見る。主人公以外への道は `flowTo(u)`（[enemy-ai.md](enemy-ai.md)）。

## 当たったとき（dealDamage）

- 数字・メッセージ・飛び散る色は受けた側の陣営で決める（主人公の陣営なら赤っぽく）。歩くのをやめる（`travel`）・画面の揺れは主人公だけ。受けた時刻は `lastHurt`
- メッセージ欄の文（`damageLine`）:

| 場合 | 文 |
|---|---|
| 主人公が受けた | 〇〇の△△！ N のダメージを受けた ／ 〇〇の△△！ ミス！ ダメージを受けない |
| 主人公が与えた | △△: □□に N のダメージ ／ △△: ミス！ □□にダメージを与えられない |
| どちらでもない（敵と仲間など） | 〇〇の△△！ □□に N のダメージ ／ 〇〇の△△！ ミス！ □□にダメージを与えられない |

（〇〇: 使った者、△△: 技、□□: 受けた者。会心なら「（会心）」が付く）

## 倒れたとき（kill）

倒れる演出は共通。そのあとはキャラによって分ける:

- 主人公以外は、ここで強化・弱体を消す（`clearBuffs`）。主人公は復活するときに消す
- 主人公（`heroDown`）: 失う経験値・お金を決めて保存し、倒れてから復活する流れへ（[progression.md](progression.md)）
- 敵（`enemyDefeated`）: 撃破数、湧き場所の枠を空けて再出現を待つ、経験値（主人公に入る）・落とし物・クエスト
- 主人公の陣営のほかのキャラ（`allyDown`）: 「〇〇は倒れた。」と出るだけ。ゲームオーバーにも経験値にもならない

## 仲間を作る（まだゲームには出てこない）

- `createAlly(d, control)`: 主人公の陣営のキャラを作る。`d` は `{ name, stats（もとのステータス）, gear, color, radius, glyph, level, skills, skillRule }`（`baseStats` / `gear` として持ち、主人公・敵と同じ `computeStats` で計算する。`skills` は使える技の並び（主人公のスキルも渡せる）、`skillRule` の省略時は `hero`）。`control` の省略時は `wait`
- 仲間も `useSkill` で技を使える（テストが直接呼ぶ。技を選ぶ AI はまだない）
- `addUnit(u, tx, ty)`: マスに置いて `units` に足す
- 描くときは敵と同じ形（丸い体と字）で、頭上の HP バーは緑（`THEME.allyHp`）。行動順の枠は主人公と同じ青、ミニマップは小さな水色の四角
- 強化・弱体も主人公・敵と同じようにかかる（頭上にアイコン）。左上の仲間の欄（`partyMembers`）・キャラクターの画面はまだ主人公だけ

## ステータスと強化・弱体（どのキャラも同じ）

- どのキャラも、ステータスを計算し直せるもと（主人公: `base` と `equip`、敵・仲間: `baseStats` と `gear`）と、強化・弱体の `buffs` を持つ。計算は `computeStats` / `refreshStats`（[damage.md](damage.md)）、強化・弱体のかけ方・数え方・消えるときは [combat.md](combat.md)
- 行動の後始末 `endTurn` で強化・弱体の残りが 1 減る。倒れたとき（主人公以外）と、敵が帰り着いたときに消える
