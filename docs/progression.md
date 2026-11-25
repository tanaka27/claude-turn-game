# 成長（レベル・スキルを覚える）

経験値とレベル、スキルを覚える決まり。行動によるステータスの伸びと潜在は [growth.md](growth.md)。数値は `params.js` の `progression`、スキルを覚えるレベルは `data/player.js` の `learnAtLevel`。コードは `src/units.js`（成長・スキルの覚え方）。クエストは [quests.md](quests.md)。

## 経験値とレベル（`progression`）

| 項目 | 値 |
|---|---|
| 次のレベルまでの経験値 | 60 × 現在レベル ^ 1.5（Lv1→2 は 60、Lv5→6 は 671） |
| 最大レベル | 30 |
| レベルアップ | **ステータスは上がらない**。全部の潜在が +10（`potential.levelUp`。上限 400）。HP・MP は全回復。新しいスキルを覚える |
| 倒れたとき | 所持金の 10% を失う（`deathGoldLoss`）。経験値は減らない（`deathExpLoss` = 0） |
| 休息 | 最後に攻撃を受けてから 8 ターンたつと、HP再生に加えて 1 ターンごとに 最大HP の 3%、MP再生に加えて 最大MP の 2%（`restMpRegenRate`）回復（待つ・歩くどちらでも） |
| 倒れて復活したとき | HP・MP とも満タン |

レベルアップの表示は「LEVEL UP! Lv 7」の下に「すべての潜在 +10」、新しいスキルがあれば次の行に出す。

## 行動によるステータスの伸び・潜在

ステータスはレベルでは上がらず、行動で伸びる（伸びやすさは潜在）。くわしくは [growth.md](growth.md)。

## クエスト

クエスト（データの形・目標の種類・今のクエストの表・仕組み・足し方）は [quests.md](quests.md)。

## 仕組み: 成長

- 敵を倒すと `gainExp` で経験値が入り、必要量を超えるたびに `levelUp`（潜在を上げる・全回復・スキルを覚える）
- 伸びた値は `player.base`（`{ con, will, wis, spi, str, vit, agi, int }`。はじめは Lv1 の値 `startBase()`。小数点以下まで持ち、戦いで使うのは一の位まで）、潜在は `player.potential`（`startPotential()`）。どちらもセーブに残る
- 行動による伸び（`growthEvent` / `trainStat` / `decayPotential`）は [growth.md](growth.md) の「仕組み」
- ステータスは `computeStats` で毎回計算する: Lv1 の値（成長するものは `base` の一の位まで）→ `derivedStats` で こうげき力などを計算 → 強化・弱体（`player.buffs`）の倍率を掛ける → 装備（`player.equip`）で上がる分を足す。装備で上がる分は `statParts` が「装備ありで計算した値 − 装備なしで計算した値」で出す（ちから +3 の装備ならこうげき力にも +3 が入る）。上限（`max`）は最後にかける
- プレイヤーが倒れると、その場で所持金（と `deathExpLoss` 分の経験値）を減らして保存し、1.4 秒後（実時間）に `respawnPlayer` で最後に立ち寄った町（`player.home`。[world.md](world.md)）のかがり火へ戻る

## スキルを覚える（はじめの決まり: レベルで覚える）

主人公が覚えているスキルはキャラの状態（`player.knownSkills`、セーブに残る）で、レベルから毎回決めるものではない。覚えさせるのはいつも `teachSkill`（[skill-use.md](skill-use.md) の「覚えているスキルとスキル欄」）。
今の覚え方は「そのレベルになったら自動で覚える」だけで、データと関数が 1 つずつ:

- データ: `data/player.js` の `learnAtLevel`（`{ スキルの id: レベル }`。今は衝撃波・ダッシュ・闘気が Lv1、旋風斬が Lv3、メテオが Lv6）。スキルの定義（`data/skills.js`）には覚えるレベルを書かない（技を使う道は覚えるレベルを見ない）
- 関数: `learnSkillsByLevel(u)`（`src/units.js`）。`learnAtLevel` のレベルに届いていて、まだ覚えていないスキルを `teachSkill` で覚え、新しく覚えたものを返す。呼ぶのは 3 か所: はじめから（`createPlayer`。Lv1 のもの）、レベルアップ（`levelUp`）、セーブを読んだとき（`applySave`。そのレベルなら覚えているはずのものを足す）
- `levelUp` は覚えたスキルを「LEVEL UP!」の下の最後の行に「新しいスキル: 旋風斬（2）」のように出す（括弧はスキル欄のキー。置いていなければ名前だけ）
- `learnLevelOf(sk)`: そのスキルを覚えるレベル（なければ `undefined`）。覚えていないスキルの案内（「Lv3 で使えるようになる」「Lv3 で解放」）に使う

ほかの覚え方（師匠・道具・スキルポイントなど）を足すとき: 覚える道（例: 師匠と話す・道具を使う）から `teachSkill(player, id)` を呼ぶだけでよい（覚えたものはそのままセーブに残る）。レベルでも覚えるならそのまま並べて使える。レベルで覚えるのをやめるスキルは `learnAtLevel` から外す（全部やめるなら、上の 3 か所の `learnSkillsByLevel` を新しい決まりに置き換える）。覚えていないスキルの案内の文は `src/player.js`（キー入力）と `src/hud.js`（スキル欄）にある。
