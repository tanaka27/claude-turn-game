// =====================================================================
//  敵 (モンスター) の種類 (名前・見た目・ステータス・技・落とす素材)
//  技の書き方は data/skills.js の【攻撃(技)の定義】と同じ (距離はマス、時間は行動回数)。
//  敵のレベルによる補正は params.js の enemyLevel。素材の名前と売値は data/items.js の materials。
// =====================================================================

// keepDistance: 遠くから撃つ技を狙うとき、この距離 (マス) を保って撃つ。省略すると、どの技でも近づいて使う
// skillChance: 技を狙う確率の基準 (省略時は params.js の field.ai.skillChance)。外れると基本の技で攻撃しに行く
//   状況に合った技 (下の situations) ほど、この確率より選ばれやすくなる
// surround: false にすると、群れで取り囲む動き (となりの空いているマスへ回り込む) をしない。省略時はする
// radius: 描くときの大きさ (px。1 マスは 40px。当たり判定はどの敵も 1 マス)。絵の高さは radius × UNIT_SPRITE.scale
// sprite: 敵の絵 (右向きの透明 PNG。左を向くと左右反転して描く)。省略するか読み込めないと図形 (丸・耳・glyph の字) で描く
//   絵の作り方は docs/image-assets.md (tools/codex_image.py --kind sprite --size 128 --ref assets/sprites/enemies/wolf.png)
// glyph: 行動順の欄に出す 1 文字 (絵がないときは体の上にも出す)
// stats: 主人公と同じステータス (意味は data/player.js の【ステータスの意味】)。Lv1 の値
//   con / will / mag / spi / mus / dex / agi / int / luk / critMult / hpRegen / mpRegen
//   さいだいHP (体力 + 意思)・さいだいMP (魔力 + (知力 + 精神力) ÷ 3)・ちから (筋力 × 0.7 + 器用さ × 0.3)・みのまもり (筋力 × 0.32 + 器用さ × 0.08)・術攻撃力 (知力 + 魔力 × 0.3) も計算で決まるので書かない
//   (みのまもり は、前に書いていた値との差を gear の vit に入れてある)
//   こうげき力・しゅび力・術防御 (知力 × 0.16 + 精神力 × 0.24)・速度・スキル加速・会心率は、主人公と同じ式 (params.js の derivedStats) で計算する
//   (術防御 は、前に書いていた値 (知力 × 0.5 + gear) との差を gear の mdef に入れてある)
//   (すばやさ 20 で速度 100。すばやさ 1 につき速度 +2 / うんのよさ 1 につき会心率 +0.5%)
//   hpRegen は今はどの敵も 0 (戦っている間に HP は戻らない)
// gear: 装備のかわりに足す値 (主人公の装備と同じく、計算で決まるステータスに直接足す)。省略可
// 技の mp: 使うと減る MP。足りない技は使わない。毎回使える近接技 (主人公の通常攻撃にあたる) は mp なし
// 技の kind: 'magic' は術 (base + 術攻撃力 (知力 + 魔力 × 0.3) で計算し、相手の術防御で減る)。省略すると物理
// attacks: 技の一覧。基本の技 (MP を使わない技。主人公の通常攻撃にあたる) は一番下に書く
//   次に狙う技は、使える技 (再使用待ちでなく MP が足りる) と基本の技のくじで選ぶ
//   技の重み = weight (省略時 1) × 状況の倍率。見る状況は技の形から自動で決まる (直線・弾 → aligned、
//   円・投げる・大きい扇 → cornered、予告あり → telegraph、どれも reachNow)。変えたいときは技に
//   situations: ['aligned', ...] を書く (状況の種類と倍率は params.js の field.ai.situations)
//   狙った技が届くまで動き (近づく / 間合いを取る)、届いたら使う。近づいている間も、となりにいれば基本の技で攻撃する
//   再使用待ちは主人公と同じくスキル加速で変わる (四捨五入、最低 1 回)
// exp: 経験値 (レベル 1 の値。敵レベルで増える) / itemRate: 装備を落とす確率 / itemCount: 落とす装備の数 (省略時 1)
// drops: 落とす素材 [{ id: data/items.js の materials のキー, rate: 落とす確率, count: 数 (省略時 1。敵レベルで増える) }]
const ENEMIES = {
  wolf: {
    name: 'ウルフ', glyph: '狼', sprite: 'assets/sprites/enemies/wolf.png', radius: 14, color: '#90a4ae', exp: 12, itemRate: 0.08,
    drops: [{ id: 'wolfPelt', rate: 1 }, { id: 'wolfFang', rate: 0.15 }],
    stats: { con: 5, will: 4, mag: 0, spi: 0, mus: 4.6, dex: 4.6, agi: 25, int: 1, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0 },
    gear: { vit: 2.16, mdef: 2.34 },
    attacks: [
      { name: '噛みつき', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 1.0 },
    ],
  },
  boar: {
    name: 'ホーンボア', glyph: '猪', sprite: 'assets/sprites/enemies/boar.png', radius: 15, color: '#bc8f6f', exp: 18, itemRate: 0.1,
    drops: [{ id: 'boarHorn', rate: 1 }, { id: 'boarMeat', rate: 0.2 }],
    stats: { con: 8, will: 8, mag: 5.67, spi: 0, mus: 5.6, dex: 5.6, agi: 17.5, int: 1, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.2 },
    gear: { vit: 3.76, mdef: 2.34 },
    attacks: [
      { name: '角突き', type: 'melee', shape: 'line', range: 3, width: 1, charge: 1, cooldown: 4, mp: 3, power: 1.7 },
      { name: '体当たり', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.8 },
    ],
  },
  bee: {
    name: 'キラービー', glyph: '蜂', sprite: 'assets/sprites/enemies/bee.png', radius: 13, color: '#fff176', exp: 16, itemRate: 0.1, keepDistance: 4,
    drops: [{ id: 'beeStinger', rate: 1 }, { id: 'honey', rate: 0.15 }],
    stats: { con: 5, will: 4, mag: 3, spi: 13, mus: 4.8, dex: 4.8, agi: 22.5, int: 2, luk: 20, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { vit: 0.08, mdef: 0.56 },
    attacks: [
      { name: '毒針', type: 'projectile', range: 6, width: 1, charge: 0, cooldown: 4, mp: 2, power: 1.0 },
      { name: '刺す', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.7 },
    ],
  },
  salamander: {
    name: 'サラマンダー', glyph: '蜥', sprite: 'assets/sprites/enemies/salamander.png', radius: 14, color: '#ff8a65', exp: 22, itemRate: 0.12, keepDistance: 4,
    drops: [{ id: 'fireScale', rate: 1 }, { id: 'flameSac', rate: 0.12 }],
    stats: { con: 5, will: 4, mag: 1, spi: 21.5, mus: 5.6, dex: 5.6, agi: 12.5, int: 2.5, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { vit: 1.76, mdef: 4.69 },
    attacks: [
      { name: '火炎弾', type: 'lob', kind: 'magic', castRange: 6, radius: 1.5, charge: 1, cooldown: 3, mp: 3, base: 1 },
      { name: '噛みつき', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.7 },
    ],
  },
  golem: {
    name: 'ロックゴーレム', glyph: '岩', sprite: 'assets/sprites/enemies/golem.png', radius: 19, color: '#a1887f', exp: 40, itemRate: 0.25,
    drops: [{ id: 'stoneShard', rate: 1 }, { id: 'manaCore', rate: 0.15 }],
    stats: { con: 20, will: 19, mag: 11.67, spi: 0, mus: 7.1, dex: 7.1, agi: 5, int: 1, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { vit: 11.16, mdef: 3.34 },
    attacks: [
      { name: '叩きつけ', type: 'melee', shape: 'circle', range: 2.3, charge: 1, cooldown: 3, mp: 4, power: 1.6 },
      { name: '岩の拳', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 1.0 },
    ],
  },
  // ---- 風の草原 ----
  slime: {
    name: 'スライム', glyph: '粘', sprite: 'assets/sprites/enemies/slime.png', radius: 13, color: '#4fc3f7', exp: 10, itemRate: 0.06,
    drops: [{ id: 'slimeJelly', rate: 1 }, { id: 'slimeCore', rate: 0.12 }],
    stats: { con: 7, will: 7, mag: 3.67, spi: 0, mus: 4.2, dex: 4.2, agi: 10, int: 1, luk: 5, critMult: 1.5, hpRegen: 0, mpRegen: 0.2 },
    gear: { vit: 5.32, mdef: 4.34 },
    attacks: [
      { name: 'のしかかり', type: 'melee', shape: 'circle', range: 1.5, charge: 1, cooldown: 3, mp: 2, power: 1.4 },
      { name: '体当たり', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.8 },
    ],
  },
  crow: {
    name: '大ガラス', glyph: '鴉', sprite: 'assets/sprites/enemies/crow.png', radius: 13, color: '#5c6bc0', exp: 14, itemRate: 0.08,
    drops: [{ id: 'blackFeather', rate: 1 }, { id: 'shinyTrinket', rate: 0.12 }],
    stats: { con: 4, will: 3, mag: 5.5, spi: 0, mus: 4.4, dex: 4.4, agi: 27.5, int: 1.5, luk: 15, critMult: 1.5, hpRegen: 0, mpRegen: 0.2 },
    gear: { vit: 0.24, mdef: 2.51 },
    attacks: [
      { name: '急降下', type: 'melee', shape: 'line', range: 4, width: 1, charge: 1, cooldown: 4, mp: 3, power: 1.4 },
      { name: 'つつく', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.8 },
    ],
  },
  goblin: {
    name: 'ゴブリン', glyph: '鬼', sprite: 'assets/sprites/enemies/goblin.png', radius: 14, color: '#9ccc65', exp: 18, itemRate: 0.12, keepDistance: 3,
    drops: [{ id: 'ragCloth', rate: 1 }, { id: 'goblinEarring', rate: 0.12 }],
    stats: { con: 7, will: 6, mag: 7.5, spi: 0, mus: 5.2, dex: 5.2, agi: 18, int: 1.5, luk: 12, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { vit: 2.92, mdef: 2.51 },
    attacks: [
      { name: '石投げ', type: 'lob', castRange: 5, radius: 1, charge: 1, cooldown: 3, mp: 2, power: 0.9 },
      { name: '棍棒', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.9 },
    ],
  },
  // ---- 赤岩の峡谷 ----
  scorpion: {
    name: '大サソリ', glyph: '蠍', sprite: 'assets/sprites/enemies/scorpion.png', radius: 15, color: '#d4a056', exp: 30, itemRate: 0.15,
    drops: [{ id: 'scorpionShell', rate: 1 }, { id: 'venomTail', rate: 0.15 }],
    stats: { con: 9, will: 9, mag: 7.67, spi: 0, mus: 6, dex: 6, agi: 14, int: 1, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { vit: 7.6, mdef: 3.34 },
    attacks: [
      { name: '尾の一撃', type: 'melee', shape: 'line', range: 2, width: 1, charge: 1, cooldown: 3, mp: 3, power: 1.8 },
      { name: 'はさみ', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.9 },
    ],
  },
  harpy: {
    name: 'ハーピー', glyph: '翼', sprite: 'assets/sprites/enemies/harpy.png', radius: 15, color: '#ce93d8', exp: 30, itemRate: 0.15, keepDistance: 4,
    drops: [{ id: 'harpyFeather', rate: 1 }, { id: 'windCharm', rate: 0.12 }],
    stats: { con: 6, will: 6, mag: 9.34, spi: 0, mus: 5.4, dex: 5.4, agi: 24, int: 2, luk: 14, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { vit: 1.84, mdef: 4.68 },
    attacks: [
      { name: '羽根飛ばし', type: 'projectile', range: 6, width: 1, count: 3, spread: 40, charge: 1, cooldown: 4, mp: 3, power: 0.8 },
      { name: '爪', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.8 },
    ],
  },
  // ---- 黒き森 ----
  spider: {
    name: '大蜘蛛', glyph: '蜘', sprite: 'assets/sprites/enemies/spider.png', radius: 15, color: '#7e57c2', exp: 32, itemRate: 0.15, keepDistance: 3,
    drops: [{ id: 'spiderSilk', rate: 1 }, { id: 'venomGland', rate: 0.12 }],
    stats: { con: 7, will: 7, mag: 8.5, spi: 0, mus: 5.8, dex: 5.8, agi: 20, int: 1.5, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { vit: 3.68, mdef: 3.51 },
    attacks: [
      { name: '糸吐き', type: 'projectile', range: 5, width: 1, charge: 0, cooldown: 3, mp: 2, power: 0.9 },
      { name: '毒牙', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 1.0 },
    ],
  },
  mushroom: {
    name: '毒キノコ', glyph: '茸', sprite: 'assets/sprites/enemies/mushroom.png', radius: 15, color: '#e57373', exp: 34, itemRate: 0.15,
    drops: [{ id: 'mushroomCap', rate: 1 }, { id: 'dreamSpore', rate: 0.12 }],
    stats: { con: 10, will: 10, mag: 2, spi: 27, mus: 5, dex: 5, agi: 9, int: 3, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.4 },
    gear: { vit: 5, mdef: 0.54 },
    attacks: [
      { name: '胞子噴出', type: 'melee', kind: 'magic', shape: 'circle', range: 2, charge: 1, cooldown: 3, mp: 4, base: 1 },
      { name: '頭突き', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.9 },
    ],
  },
  // ---- 魔竜の山 ----
  kobold: {
    name: 'コボルト', glyph: '犬', sprite: 'assets/sprites/enemies/kobold.png', radius: 14, color: '#a1887f', exp: 28, itemRate: 0.15,
    drops: [{ id: 'koboldFur', rate: 1 }, { id: 'scrapOre', rate: 0.15 }],
    stats: { con: 8, will: 7, mag: 5.5, spi: 0, mus: 5.8, dex: 5.8, agi: 15, int: 1.5, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.3 },
    gear: { vit: 4.68, mdef: 3.51 },
    attacks: [
      { name: 'つるはし振り', type: 'melee', shape: 'fan', range: 1.5, angle: 150, charge: 1, cooldown: 3, mp: 3, power: 1.5 },
      { name: 'ひっかく', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.8 },
    ],
  },
  // ダンジョンのボス (狼の洞穴)
  wolfKing: {
    name: '狼王', glyph: '牙', sprite: 'assets/sprites/enemies/wolfKing.png', radius: 24, color: '#607d8b', exp: 250, itemRate: 1, itemCount: 1, isBoss: true, skillChance: 0.7,
    drops: [{ id: 'kingPelt', rate: 1 }, { id: 'kingFang', rate: 0.5 }],
    stats: { con: 64, will: 64, mag: 29.34, spi: 0, mus: 6.1, dex: 6.1, agi: 25, int: 2, luk: 16, critMult: 1.5, hpRegen: 0, mpRegen: 0.8 },
    gear: { vit: 7.56, mdef: 7.68 },
    attacks: [
      { name: '突進', type: 'melee', shape: 'line', range: 5, width: 1, charge: 1, cooldown: 5, mp: 4, power: 1.6 },
      { name: '爪の薙ぎ払い', type: 'melee', shape: 'fan', range: 2.3, angle: 150, charge: 1, cooldown: 3, mp: 3, power: 1.5 },
      { name: '岩蹴り', type: 'lob', castRange: 6, radius: 1.3, count: 3, scatter: 2.5, charge: 1, cooldown: 4, mp: 4, power: 1.1 },
      { name: '噛みつき', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 0.9 },
    ],
  },
  // ダンジョンのボス (森の主の祠)
  treant: {
    name: '森の主', glyph: '樹', sprite: 'assets/sprites/enemies/treant.png', radius: 26, color: '#558b2f', exp: 350, itemRate: 1, itemCount: 2, isBoss: true, skillChance: 0.7,
    drops: [{ id: 'ancientBranch', rate: 1 }, { id: 'treantFruit', rate: 0.5 }],
    stats: { con: 78, will: 78, mag: 1.6, spi: 40, mus: 6.5, dex: 6.5, agi: 10, int: 4, luk: 10, critMult: 1.5, hpRegen: 0, mpRegen: 0.9 },
    gear: { vit: 11.4 },
    attacks: [
      { name: '根の衝撃', type: 'melee', shape: 'circle', range: 3.3, charge: 1, cooldown: 4, mp: 4, power: 1.6 },
      { name: '種飛ばし', type: 'projectile', range: 7, width: 1, count: 5, spread: 70, charge: 1, cooldown: 5, mp: 5, power: 0.9 },
      { name: '胞子の雨', type: 'lob', kind: 'magic', castRange: 7, radius: 1.5, count: 4, scatter: 3, charge: 1, cooldown: 6, mp: 5, base: 1 },
      { name: '枝打ち', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 1.0 },
    ],
  },
  // 最後のボス (魔竜の遺跡)
  dragon: {
    name: '魔竜', glyph: '竜', sprite: 'assets/sprites/enemies/dragon.png', radius: 27, color: '#ef5350', exp: 400, itemRate: 1, itemCount: 2, isBoss: true, skillChance: 0.7,
    drops: [{ id: 'dragonScale', rate: 1, count: 2 }, { id: 'dragonHeart', rate: 0.5 }],
    stats: { con: 84, will: 84, mag: 1.8, spi: 48, mus: 7.3, dex: 7.3, agi: 20, int: 4.5, luk: 20, critMult: 1.5, hpRegen: 0, mpRegen: 1 },
    gear: { vit: 15.08 },
    attacks: [
      { name: '尾の薙ぎ払い', type: 'melee', shape: 'fan', range: 2.5, angle: 160, charge: 1, cooldown: 3, mp: 4, power: 1.6 },
      { name: '火炎の息', type: 'projectile', kind: 'magic', range: 7, width: 1, count: 5, spread: 50, charge: 1, cooldown: 5, mp: 5, base: 0.5 },
      { name: '隕石落とし', type: 'lob', kind: 'magic', castRange: 7, radius: 2, count: 3, scatter: 3, charge: 1, cooldown: 6, mp: 6, base: 3 },
      { name: '爪', type: 'melee', shape: 'fan', range: 1.5, angle: 120, charge: 0, cooldown: 1, power: 1.0 },
    ],
  },
};
