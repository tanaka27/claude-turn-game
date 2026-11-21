// =====================================================================
//  装備と道具 (レア度・部位・追加性能・道具 (回復薬など)・店ごとの品ぞろえ)
//  お金・持ち物の数・売値などは params.js の economy。
// =====================================================================

// 装備
//   値の書き方 [Lv1 の値, 1 レベルごとの増加]。装備レベル = 落とした敵のレベル (店では自分のレベル)
//   名前は nameTierEvery レベルごとに次のものになる
const ITEMS = {
  nameTierEvery: 2,
  // レア度 (装備・道具・素材で共通。並びが低い順)。名前と色は道具・素材にも使う
  //   以下は装備だけに使う: weight: 敵が落とすときの出やすさ / bossWeight: ボスが落とすときの出やすさ /
  //   mult: 基本性能の倍率 / affixes: 追加性能の数 / value: 価値の倍率
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
  // 道具 (使うとなくなるもの。回復薬など)。使うと 1 行動。キーはセーブ (player.consumables)・店・クエストの報酬が指す
  //   name / rarity: レア度 / key: フィールドで使うキー / price: 商人での値段 / max: 持てる数 / start: 最初の数
  //   effects: 使ったときの効果の並び (1 つ以上)。どれか 1 つでも効くときだけ使える (効かないものはとばす)
  //     { kind: 'healHp', ratio }        最大HP × ratio だけ HP を回復する
  //     { kind: 'healMp', ratio }        最大MP × ratio だけ MP を回復する
  //     { kind: 'addBuff', buff, actions } data/buffs.js の buff を、使った相手に actions 行動のあいだかける
  //   効果の種類 (kind) は src/items.js の ITEM_EFFECTS。足し方は docs/consumables.md
  consumables: {
    potion: { name: '回復薬', rarity: 'common', key: 'r', price: 25, max: 20, start: 3, effects: [{ kind: 'healHp', ratio: 0.4 }] },
    hiPotion: { name: '上回復薬', rarity: 'rare', key: 't', price: 80, max: 10, start: 0, effects: [{ kind: 'healHp', ratio: 0.8 }] },
  },
  // 商人の店。world.js の NPC (role: 'shop') の shop にキーを書く
  //   name: 画面の見出し / consumables: 売る道具 (consumables のキー)。素材はどの商人でも売れる (装備の売買は鍛冶屋)
  shops: {
    townGeneral: { name: '始まりの町の商店', consumables: ['potion'] },
    wayTools: { name: '宿場の道具屋', consumables: ['potion'] },
    hamletHerbs: { name: '隠れ里の薬師', consumables: ['potion', 'hiPotion'] },
  },
  // 鍛冶屋。world.js の NPC (role: 'smith') の smith にキーを書く。装備を買う・売る (町ごとに品ぞろえが違う)
  //   name: 画面の見出し / gear: 売る装備 [部位, レア度] (1 つずつ並ぶ)
  //   levelOffset: 装備レベル = 自分のレベル + levelOffset / maxLevel: 装備レベルの上限 (なければ上限なし)
  //   自分のレベルが変わると、次に鍛冶屋を開いたときに品ぞろえが入れ替わる。持っている装備はどの鍛冶屋でも売れる
  smiths: {
    townSmith: { name: '始まりの町の鍛冶屋', levelOffset: 0, maxLevel: 4,
      gear: [['weapon', 'common'], ['armor', 'common'], ['accessory', 'common']] },
    waySmith: { name: '宿場の鍛冶屋', levelOffset: 0, maxLevel: 8,
      gear: [['weapon', 'common'], ['weapon', 'rare'], ['armor', 'common'], ['armor', 'rare'], ['accessory', 'common'], ['accessory', 'rare']] },
    hamletSmith: { name: '隠れ里の鍛冶屋', levelOffset: 1,
      gear: [['weapon', 'rare'], ['weapon', 'epic'], ['armor', 'rare'], ['armor', 'epic'], ['accessory', 'rare'], ['accessory', 'epic']] },
  },
  // 素材 (敵が落とす。店で売るとお金になる。今後は装備を作る材料にする予定)
  //   rarity: レア度 (素材ごとに 1 つ) / price: 1 つの売値 / color: マップに落ちているときの色
  //   どの敵が何を落とすかは data/enemies.js の drops。同じ敵が落とす素材どうしでは、
  //   レア度が高いほど落とす確率を低く・売値を高くする (起動時のデータの確認で調べる)
  materials: {
    wolfPelt: { name: '狼の毛皮', rarity: 'common', price: 3, color: '#b0bec5' },
    wolfFang: { name: '狼の牙', rarity: 'rare', price: 8, color: '#eceff1' },
    boarHorn: { name: 'ボアの角', rarity: 'common', price: 5, color: '#d7ccc8' },
    boarMeat: { name: 'ボアの肉', rarity: 'rare', price: 6, color: '#ef9a9a' },
    beeStinger: { name: '蜂の毒針', rarity: 'common', price: 4, color: '#dce775' },
    honey: { name: '蜂蜜', rarity: 'rare', price: 8, color: '#ffca28' },
    fireScale: { name: '火トカゲの鱗', rarity: 'common', price: 6, color: '#ff8a65' },
    flameSac: { name: '火炎袋', rarity: 'rare', price: 12, color: '#ff5722' },
    stoneShard: { name: '岩の欠片', rarity: 'common', price: 10, color: '#bcaaa4' },
    manaCore: { name: '魔力の核', rarity: 'rare', price: 30, color: '#4dd0e1' },
    kingPelt: { name: '狼王の毛皮', rarity: 'rare', price: 40, color: '#90a4ae' },
    kingFang: { name: '狼王の大牙', rarity: 'epic', price: 120, color: '#ffffff' },
    ancientBranch: { name: '古木の枝', rarity: 'rare', price: 50, color: '#8d6e63' },
    treantFruit: { name: '森の主の実', rarity: 'epic', price: 200, color: '#aed581' },
    dragonScale: { name: '竜の鱗', rarity: 'rare', price: 40, color: '#e57373' },
    dragonHeart: { name: '竜の心臓', rarity: 'epic', price: 240, color: '#d50000' },
  },
};
