# セーブの形

保存する項目（今の形 v6）と、読むときのない・おかしな値の扱い。コードは `src/save.js` の `buildSave`（作る）・`readSave`（今の形に直す）・`applySave`（主人公に戻す）。
いつ・どこに保存するかは [save.md](save.md)、版の移し替えは [save-versions.md](save-versions.md)。

## 項目（v6）

```
{ v: 6, savedAt, tab,
  player:   { level, exp, base, potential, hp, mp, gold, consumables, inventory, materials, equip, quests, knownSkills },
  progress: { kills, time },
  location: { zone, tx, ty },
  home }
```

- `base` は行動で伸びたステータス `{ con, will, mag, spi, str, vit, agi, int }`（小数点以下まで。v6 から。v7 から さいだいHP・MP のかわりに 体力・意思・精神力。v8 で 知力 `wis` をやめ、`int` を 知力 と呼ぶ。v9 から 魔力 `mag`）、`potential` は潜在（どちらも `{ ステータス: 数 }`。v5 から潜在。[growth.md](growth.md)）。`inventory` / `equip` は装備（`{ id, slot, name, rarity, level, stats }`）そのもの、`materials` は素材の数 `{ 素材のid: 数 }`、`quests` は `{ クエストのid: { state, count } }`（id は `data/quests.js`。v2 から衛兵隊長のクエストは `c_wolf` など）、`consumables` は道具の数 `{ 道具のキー: 数 }`（`data/items.js` の `consumables`。v4 から。v3 までは `potions`）、`knownSkills` は覚えているスキルの id の並び（`data/skills.js`。v3 から）
- `tab` はサーバーに書いたタブの名前（サーバーへ送るときに付ける。ブラウザのセーブにはない。ゲームは読まない。[server.md](server.md)）
- `progress.time` はゲーム内の時刻（ターン）。`progress.kills` は倒した数。どちらも数でない（文字列など）・負の値は読むとき 0 にする（時刻が `NaN` になると行動順が壊れるため）。`location` の `tx`, `ty` はマス
- ステータスそのもの（こうげき力など）は保存せず、読み込むときに「`base` + 装備」から計算し直す（`computeStats`）。式や装備の数値を変えても、続きから遊ぶと新しい数値が反映される
- `mp` は今の MP。ない（MP を入れる前の）セーブは満タンから始まる。`base.int` / `base.spi` がないセーブは Lv1 の値になる（下の決まり）
- `base` がない・数でない値は Lv1 の値にし、Lv1 の値〜上限（`growth.stats` の `max`）に収める（小数はそのまま）。`potential` がない・数でない値ははじめの潜在にし、下限〜上限に収める
- `home` は倒れたときに戻る町のゾーン（[world.md](world.md)）。ない・町でないときは `WORLD.respawnZone`
- 倒れている間に保存するときは、`home` の町のかがり火にいるものとして保存する（`hp: null`・`mp: null` で満タンから始まる）
- 読み込むとき、存在しないクエスト・部位・ステータスの装備・素材・道具は捨てる（`STATS` にないステータスを持つ装備も捨てる）。道具の数は 0〜持てる数（`max`）に収める
- 覚えたスキル（`knownSkills`）: 読むとき、今はないスキルの id・重なり・id でないものは捨て（`teachSkill` を通す）、そのあとはじめの覚え方（`learnSkillsByLevel`）でそのレベルなら覚えているはずのものを足す（古い・おかしなセーブでも、そのレベルで覚えるスキルがなくならない）
- スキル欄（どのキーにどのスキル）は保存しない（付け替える画面がなく、いつも `data/player.js` の `skillSlots` のため。[skill-use.md](skill-use.md)）。再使用待ち・強化も保存しない（続きから遊ぶとどのスキルもすぐ使える）
- 上の「ない・おかしい値の読み方」（`base` / `mp` / `home` がないなど）は v1 より前のセーブのためのもので、`applySave` に置いてある（回復薬の数が数だけのものは v3 → v4 の直し方で直す）。これからの形の変更は版の移し替え（[save-versions.md](save-versions.md)）で行う

