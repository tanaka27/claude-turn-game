// =====================================================================
//  装備と回復薬 (レア度・部位・追加性能・回復薬・店ごとの品ぞろえ)
//  お金・持ち物の数・売値などは params.js の economy。
// =====================================================================

// 装備
//   値の書き方 [Lv1 の値, 1 レベルごとの増加]。装備レベル = 落とした敵のレベル (店では自分のレベル)
//   名前は nameTierEvery レベルごとに次のものになる
const ITEMS = {
  nameTierEvery: 2,
  // レア度。weight: 敵が落とすときの出やすさ / bossWeight: ボスが落とすときの出やすさ /
  // mult: 基本性能の倍率 / affixes: 追加性能の数 / value: 価値の倍率
  rarities: [
    { id: 'common', name: 'ノーマル', color: '#e6edf3', weight: 70, bossWeight: 0, mult: 1.0, affixes: 0, value: 1 },
    { id: 'rare', name: 'レア', color: '#64b5f6', weight: 25, bossWeight: 60, mult: 1.2, affixes: 1, value: 2.5 },
    { id: 'epic', name: 'エピック', color: '#ce93d8', weight: 5, bossWeight: 40, mult: 1.45, affixes: 2, value: 6 },
  ],
  // 部位。base: 基本性能 / extraAffixes: レア度とは別に付く追加性能の数
  slots: {
    weapon: { label: '武器', base: { atk: [1.2, 0.6] }, extraAffixes: 0,
      names: ['木の剣', '銅の剣', '鉄の剣', '鋼の剣', '騎士の剣', '魔鋼の剣', '竜骨の剣', '聖剣'] },
    armor: { label: '防具', base: { def: [0.8, 0.4], maxHp: [1, 0.6] }, extraAffixes: 0,
      names: ['布の服', '革の鎧', '鋲打ちの鎧', '鎖かたびら', '鋼の鎧', '騎士の鎧', '魔鋼の鎧', '竜鱗の鎧'] },
    accessory: { label: '装飾品', base: {}, extraAffixes: 1,
      names: ['銅の指輪', '銀の指輪', '金の指輪', '翠玉の指輪', '紅玉の指輪', '蒼玉の指輪', '魔石の指輪', '星の指輪'] },
  },
  // 追加性能の候補 (選ばれた値は ±20% で揺れる)
  affixes: {
    atk: [0.6, 0.3], def: [0.6, 0.2], maxHp: [1, 0.6], luk: [4, 0.4], critMult: [0.08, 0.01],
    agi: [4, 0.4], int: [10, 2], hpRegen: [0.05, 0.015],
  },
  value: [10, 8],       // 価値 (= 店の買値) [Lv1 の値, 1 レベルごとの増加] × レア度の value
  // 回復薬。key: 使うキー / heal: 最大HP比 / max: 持てる数 / start: 最初の数。使うと 1 行動
  //   クエストの報酬の potions は先頭の回復薬 (potion) でもらう
  potions: {
    potion: { name: '回復薬', key: 'r', price: 25, heal: 0.4, max: 20, start: 3 },
    hiPotion: { name: '上回復薬', key: 't', price: 80, heal: 0.8, max: 10, start: 0 },
  },
  // 店。world.js の NPC (role: 'shop') の shop にキーを書く
  //   name: 画面の見出し / potions: 売る回復薬 / gear: 売る装備 [部位, レア度] (1 つずつ並ぶ)
  //   levelOffset: 装備レベル = 自分のレベル + levelOffset / maxLevel: 装備レベルの上限 (なければ上限なし)
  //   自分のレベルが変わると、次に店を開いたときに品ぞろえが入れ替わる。素材と装備はどの店でも売れる
  shops: {
    townGeneral: { name: '始まりの町の商店', potions: ['potion'], levelOffset: 0, maxLevel: 4,
      gear: [['weapon', 'common'], ['armor', 'common'], ['accessory', 'common']] },
    wayArms: { name: '宿場の武具屋', potions: [], levelOffset: 0, maxLevel: 8,
      gear: [['weapon', 'common'], ['weapon', 'rare'], ['armor', 'common'], ['armor', 'rare']] },
    wayTools: { name: '宿場の道具屋', potions: ['potion'], levelOffset: 0, maxLevel: 8,
      gear: [['accessory', 'common'], ['accessory', 'rare']] },
    hamletHerbs: { name: '隠れ里の薬師', potions: ['potion', 'hiPotion'], gear: [] },
    hamletCraft: { name: '隠れ里の細工師', potions: [], levelOffset: 1,
      gear: [['weapon', 'rare'], ['weapon', 'epic'], ['armor', 'rare'], ['armor', 'epic'], ['accessory', 'rare'], ['accessory', 'epic']] },
  },
  // 素材 (敵が落とす。店で売るとお金になる)。price: 1 つの売値 / color: 落とし物と画面での色
  //   どの敵が何を落とすかは data/enemies.js の drops
  materials: {
    wolfPelt: { name: '狼の毛皮', price: 3, color: '#b0bec5' },
    wolfFang: { name: '狼の牙', price: 8, color: '#eceff1' },
    boarHorn: { name: 'ボアの角', price: 5, color: '#d7ccc8' },
    boarMeat: { name: 'ボアの肉', price: 6, color: '#ef9a9a' },
    beeStinger: { name: '蜂の毒針', price: 4, color: '#dce775' },
    honey: { name: '蜂蜜', price: 8, color: '#ffca28' },
    fireScale: { name: '火トカゲの鱗', price: 6, color: '#ff8a65' },
    flameSac: { name: '火炎袋', price: 12, color: '#ff5722' },
    stoneShard: { name: '岩の欠片', price: 10, color: '#bcaaa4' },
    manaCore: { name: '魔力の核', price: 30, color: '#4dd0e1' },
    kingPelt: { name: '狼王の毛皮', price: 60, color: '#90a4ae' },
    kingFang: { name: '狼王の大牙', price: 40, color: '#ffffff' },
    ancientBranch: { name: '古木の枝', price: 50, color: '#8d6e63' },
    treantFruit: { name: '森の主の実', price: 100, color: '#aed581' },
    dragonScale: { name: '竜の鱗', price: 40, color: '#e57373' },
    dragonHeart: { name: '竜の心臓', price: 120, color: '#d50000' },
  },
};
