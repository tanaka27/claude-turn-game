// =====================================================================
//  敵 (モンスター) の種類 (名前・見た目・ステータス・技・落とす素材)
//  技の書き方は data/player.js の【攻撃(技)の定義】と同じ (距離はマス、時間は行動回数)。
//  敵のレベルによる補正は params.js の enemyLevel。素材の名前と売値は data/items.js の materials。
// =====================================================================

// ai: 'melee' … 近づいて攻撃 / 'ranged' … keepDistance (マス) を保ちつつ攻撃
// radius: 描くときの大きさ (px。1 マスは 40px。当たり判定はどの敵も 1 マス)
// stats: 主人公と同じステータス (意味は data/player.js の【ステータスの意味】)。Lv1 の値
//   maxHp / maxMp / str / vit / agi / int / luk / critMult / hpRegen / mpRegen
//   こうげき力・しゅび力・術防御・速度・スキル加速・会心率は、主人公と同じ式 (params.js の derivedStats) で計算する
//   (すばやさ 20 で速度 100。すばやさ 1 につき速度 +2 / うんのよさ 1 につき会心率 +0.5%)
//   hpRegen は今はどの敵も 0 (戦っている間に HP は戻らない)
// gear: 装備のかわりに足す値 (主人公の装備と同じく、計算で決まるステータスに直接足す)。省略可
// 技の mp: 使うと減る MP。足りない技は使わない。毎回使える近接技 (主人公の通常攻撃にあたる) は mp なし
// 技の kind: 'magic' は術 (base + int で計算し、相手の術防御で減る)。省略すると物理
// attacks: 上から順に、使えるもの (再使用待ちでなく、MP が足り、相手が届く所にいる) を 1 つ使う。強い技を上に書く
//   再使用待ちは主人公と同じくスキル加速で変わる (四捨五入、最低 1 回)
// exp: 経験値 (レベル 1 の値。敵レベルで増える) / itemRate: 装備を落とす確率 / itemCount: 落とす装備の数 (省略時 1)
// drops: 落とす素材 [{ id: data/items.js の materials のキー, rate: 落とす確率, count: 数 (省略時 1。敵レベルで増える) }]
const ENEMIES = {
  wolf: {
    name: 'ウルフ', glyph: '狼', radius: 14, color: '#90a4ae', exp: 12, itemRate: 0.08, ai: 'melee',
    drops: [{ id: 'wolfPelt', rate: 1 }, { id: 'wolfFang', rate: 0.15 }],
    stats: { maxHp: 9, maxMp: 0, str: 4.6, vit: 4, agi: 25, int: 1, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0 },
    gear: { mdef: 2 },
    attacks: [
      { name: '噛みつき', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 1.0 },
    ],
  },
  boar: {
    name: 'ホーンボア', glyph: '猪', radius: 15, color: '#bc8f6f', exp: 18, itemRate: 0.1, ai: 'melee',
    drops: [{ id: 'boarHorn', rate: 1 }, { id: 'boarMeat', rate: 0.2 }],
    stats: { maxHp: 16, maxMp: 6, str: 5.6, vit: 6, agi: 17.5, int: 1, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.2 },
    gear: { mdef: 2 },
    attacks: [
      { name: '角突き', type: 'melee', shape: 'line', range: 3, width: 1, charge: 1, cooldown: 4, mp: 3, power: 1.7 },
      { name: '体当たり', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.8 },
    ],
  },
  bee: {
    name: 'キラービー', glyph: '蜂', radius: 13, color: '#fff176', exp: 16, itemRate: 0.1, ai: 'ranged', keepDistance: 4,
    drops: [{ id: 'beeStinger', rate: 1 }, { id: 'honey', rate: 0.15 }],
    stats: { maxHp: 9, maxMp: 8, str: 4.8, vit: 2, agi: 22.5, int: 2, luk: 20, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { mdef: 3 },
    attacks: [
      { name: '毒針', type: 'projectile', range: 6, width: 1, charge: 0, cooldown: 4, mp: 2, power: 1.0 },
    ],
  },
  salamander: {
    name: 'サラマンダー', glyph: '蜥', radius: 14, color: '#ff8a65', exp: 22, itemRate: 0.12, ai: 'ranged', keepDistance: 4,
    drops: [{ id: 'fireScale', rate: 1 }, { id: 'flameSac', rate: 0.12 }],
    stats: { maxHp: 9, maxMp: 9, str: 5.6, vit: 4, agi: 12.5, int: 2.5, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { mdef: 9 },
    attacks: [
      { name: '火炎弾', type: 'lob', kind: 'magic', castRange: 6, radius: 1.5, charge: 1, cooldown: 3, mp: 3, base: 1 },
    ],
  },
  golem: {
    name: 'ロックゴーレム', glyph: '岩', radius: 19, color: '#a1887f', exp: 40, itemRate: 0.25, ai: 'melee',
    drops: [{ id: 'stoneShard', rate: 1 }, { id: 'manaCore', rate: 0.15 }],
    stats: { maxHp: 39, maxMp: 12, str: 7.1, vit: 14, agi: 5, int: 1, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { mdef: 3 },
    attacks: [
      { name: '叩きつけ', type: 'melee', shape: 'circle', range: 2.3, charge: 1, cooldown: 3, mp: 4, power: 1.6 },
      { name: '岩の拳', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 1.0 },
    ],
  },
  // ゾーンボス (風の草原)
  wolfKing: {
    name: '狼王', glyph: '牙', radius: 24, color: '#607d8b', exp: 250, itemRate: 1, itemCount: 1, ai: 'melee', isBoss: true,
    drops: [{ id: 'kingPelt', rate: 1 }, { id: 'kingFang', rate: 0.5 }],
    stats: { maxHp: 128, maxMp: 30, str: 6.1, vit: 10, agi: 25, int: 2, luk: 16, critMult: 1.5, hpRegen: 0, mpRegen: 0.8 },
    gear: { mdef: 7 },
    attacks: [
      { name: '突進', type: 'melee', shape: 'line', range: 5, width: 1, charge: 1, cooldown: 5, mp: 4, power: 1.6 },
      { name: '爪の薙ぎ払い', type: 'melee', shape: 'fan', range: 2.3, angle: 150, charge: 1, cooldown: 3, mp: 3, power: 1.5 },
      { name: '岩蹴り', type: 'lob', castRange: 6, radius: 1.3, count: 3, scatter: 2.5, charge: 1, cooldown: 4, mp: 4, power: 1.1 },
      { name: '噛みつき', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.9 },
    ],
  },
  // ゾーンボス (黒き森)
  treant: {
    name: '森の主', glyph: '樹', radius: 26, color: '#558b2f', exp: 350, itemRate: 1, itemCount: 2, ai: 'melee', isBoss: true,
    drops: [{ id: 'ancientBranch', rate: 1 }, { id: 'treantFruit', rate: 0.5 }],
    stats: { maxHp: 156, maxMp: 36, str: 6.5, vit: 14, agi: 10, int: 4, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.9 },
    gear: { mdef: 14 },
    attacks: [
      { name: '根の衝撃', type: 'melee', shape: 'circle', range: 3.3, charge: 1, cooldown: 4, mp: 4, power: 1.6 },
      { name: '種飛ばし', type: 'projectile', range: 7, width: 1, count: 5, spread: 70, charge: 1, cooldown: 5, mp: 5, power: 0.9 },
      { name: '胞子の雨', type: 'lob', kind: 'magic', castRange: 7, radius: 1.5, count: 4, scatter: 3, charge: 1, cooldown: 6, mp: 5, base: 1 },
      { name: '枝打ち', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 1.0 },
    ],
  },
  // 最後のボス (魔竜の遺跡)
  dragon: {
    name: '魔竜', glyph: '竜', radius: 27, color: '#ef5350', exp: 400, itemRate: 1, itemCount: 2, ai: 'melee', isBoss: true,
    drops: [{ id: 'dragonScale', rate: 1, count: 2 }, { id: 'dragonHeart', rate: 0.5 }],
    stats: { maxHp: 168, maxMp: 40, str: 7.3, vit: 18, agi: 20, int: 4.5, luk: 20, critMult: 1.5, hpRegen: 0, mpRegen: 1 },
    gear: { mdef: 18 },
    attacks: [
      { name: '尾の薙ぎ払い', type: 'melee', shape: 'fan', range: 2.5, angle: 160, charge: 1, cooldown: 3, mp: 4, power: 1.6 },
      { name: '火炎の息', type: 'projectile', kind: 'magic', range: 7, width: 1, count: 5, spread: 50, charge: 1, cooldown: 5, mp: 5, base: 0.5 },
      { name: '隕石落とし', type: 'lob', kind: 'magic', castRange: 7, radius: 2, count: 3, scatter: 3, charge: 1, cooldown: 6, mp: 6, base: 3 },
      { name: '爪', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 1.0 },
    ],
  },
};
