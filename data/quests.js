// =====================================================================
//  討伐クエスト
// =====================================================================

// 上から順に受けられる
//   giver: 受ける NPC の id (world.js) / target: 倒す敵 (モンスター) の種類 / count: 倒す数 / where: 説明用の場所
//   minLevel: 受けられるレベル / requires: 先に報告しておくクエスト
//   reward: exp / gold / potions / item ({ slot, rarity }。装備レベルは報告したときの自分のレベル)
const QUESTS = [
  { id: 'goblin', giver: 'captain', name: 'ウルフ退治', target: 'wolf', count: 8, where: '風の草原', minLevel: 1,
    desc: '町の外にウルフの群れが増えている。まずは数を減らしてくれ。', reward: { exp: 80, gold: 50 } },
  { id: 'archer', giver: 'captain', name: '毒針の羽音', target: 'bee', count: 5, where: '風の草原', minLevel: 2, requires: 'goblin',
    desc: '遠くから毒針を飛ばしてくる大蜂がいる。近づいて斬り落とせ。', reward: { exp: 150, gold: 60, potions: 2 } },
  { id: 'mage', giver: 'captain', name: '火を吐くトカゲ', target: 'salamander', count: 6, where: '風の草原', minLevel: 3, requires: 'archer',
    desc: '火炎弾を吐くサラマンダーがいる。着弾地点の印をよく見て避けるんだ。', reward: { exp: 300, gold: 100, item: { slot: 'accessory', rarity: 'rare' } } },
  { id: 'king', giver: 'captain', name: '狼王', target: 'wolfKing', count: 1, where: '風の草原の北東', minLevel: 5, requires: 'mage',
    desc: 'ウルフを率いる巨大な狼王がいる。奴を倒せば草原は静かになる。', reward: { exp: 600, gold: 200, item: { slot: 'weapon', rarity: 'rare' } } },
  { id: 'ogre', giver: 'captain', name: '動く岩', target: 'golem', count: 6, where: '黒き森', minLevel: 6, requires: 'king',
    desc: '森の中を岩のゴーレムが歩き回っている。叩きつけの範囲は広いぞ。', reward: { exp: 1000, gold: 250, potions: 3 } },
  { id: 'treant', giver: 'captain', name: '森の主', target: 'treant', count: 1, where: '黒き森の北西', minLevel: 8, requires: 'ogre',
    desc: '森の奥で古い木が目を覚ました。あれが森を狂わせている。', reward: { exp: 1800, gold: 400, item: { slot: 'armor', rarity: 'epic' } } },
  { id: 'warlord', giver: 'captain', name: '魔竜討伐', target: 'dragon', count: 1, where: '魔竜の遺跡', minLevel: 9, requires: 'treant',
    desc: 'すべての元凶、遺跡に棲む魔竜を討て。お前ならできる。', reward: { exp: 3000, gold: 800, item: { slot: 'weapon', rarity: 'epic' } } },
];
