// =====================================================================
//  クエスト (今のクエストはどれも討伐 kind: 'kill')
// =====================================================================

// 上から順に受けられる
//   id: セーブに残る (player.quests)。変えるときは src/save.js の SAVE_MIGRATIONS で古い id を直す (docs/save.md)
//   giver: 受ける NPC の id (world.js) / where: 説明用の場所
//   goal: 目標 { kind: 目標の種類, ... }。種類は src/quests.js の QUEST_GOALS (docs/quests.md)
//     kill   : { kind: 'kill', enemy: 倒す敵 (モンスター) の種類, count: 倒す数 } (受けたあとに倒した数)
//     collect: { kind: 'collect', material: data/items.js の materials のキー, count: 数 } (持っている数。報告すると渡す)
//     talk   : { kind: 'talk', npc: 話しかける NPC の id (world.js) } (受けたあとに話しかける)
//   minLevel: 受けられるレベル / requires: 先に報告しておくクエスト
//   repeatable: true なら報告したあと、また受けられる (ほかのクエストの requires には使えない)
//   reward: exp / gold / consumables ([{ id: data/items.js の consumables のキー, count }]。持てる数 (max) を超えた分はもらえない) /
//           item ({ slot, rarity, type }。装備レベルは報告したときの自分のレベル。type は武器種 (省略するとくじ))
const QUESTS = [
  { id: 'c_wolf', giver: 'captain', name: 'ウルフ退治', goal: { kind: 'kill', enemy: 'wolf', count: 8 }, where: '風の草原', minLevel: 1,
    desc: '町の外にウルフの群れが増えている。まずは数を減らしてくれ。', reward: { exp: 80, gold: 50 } },
  { id: 'c_bee', giver: 'captain', name: '毒針の羽音', goal: { kind: 'kill', enemy: 'bee', count: 5 }, where: '風の草原', minLevel: 2, requires: 'c_wolf',
    desc: '遠くから毒針を飛ばしてくる大蜂がいる。近づいて斬り落とせ。', reward: { exp: 150, gold: 60, consumables: [{ id: 'potion', count: 2 }] } },
  { id: 'c_salamander', giver: 'captain', name: '火を吐くトカゲ', goal: { kind: 'kill', enemy: 'salamander', count: 6 }, where: '風の草原', minLevel: 3, requires: 'c_bee',
    desc: '火炎弾を吐くサラマンダーがいる。着弾地点の印をよく見て避けるんだ。', reward: { exp: 300, gold: 100, item: { slot: 'accessory', rarity: 'rare' } } },
  { id: 'c_wolfKing', giver: 'captain', name: '狼王', goal: { kind: 'kill', enemy: 'wolfKing', count: 1 }, where: '狼の洞穴（風の草原の北）', minLevel: 5, requires: 'c_salamander',
    desc: 'ウルフを率いる巨大な狼王がいる。奴を倒せば草原は静かになる。', reward: { exp: 600, gold: 200, item: { slot: 'weapon', rarity: 'rare' } } },
  { id: 'c_golem', giver: 'captain', name: '動く岩', goal: { kind: 'kill', enemy: 'golem', count: 6 }, where: '黒き森', minLevel: 6, requires: 'c_wolfKing',
    desc: '森の中を岩のゴーレムが歩き回っている。叩きつけの範囲は広いぞ。', reward: { exp: 1000, gold: 250, consumables: [{ id: 'potion', count: 3 }] } },
  { id: 'c_treant', giver: 'captain', name: '森の主', goal: { kind: 'kill', enemy: 'treant', count: 1 }, where: '森の主の祠（黒き森の北）', minLevel: 8, requires: 'c_golem',
    desc: '森の奥で古い木が目を覚ました。あれが森を狂わせている。', reward: { exp: 1800, gold: 400, item: { slot: 'armor', rarity: 'epic' } } },
  { id: 'c_dragon', giver: 'captain', name: '魔竜討伐', goal: { kind: 'kill', enemy: 'dragon', count: 1 }, where: '魔竜の遺跡', minLevel: 9, requires: 'c_treant',
    desc: 'すべての元凶、遺跡に棲む魔竜を討て。お前ならできる。', reward: { exp: 3000, gold: 800, item: { slot: 'weapon', rarity: 'epic' } } },

  // ----- 冒険者ギルド (始まりの町。受付 guildClerk) の依頼 -----
  { id: 'g_trial', giver: 'guildClerk', name: '新人の腕試し', goal: { kind: 'kill', enemy: 'wolf', count: 3 }, where: '風の草原', minLevel: 1,
    desc: 'ギルドへようこそ。まずは腕試しに、草原のウルフを 3 体倒してきてください。', reward: { exp: 30, gold: 30, consumables: [{ id: 'potion', count: 2 }] } },
  { id: 'g_wolf', giver: 'guildClerk', name: 'ウルフの間引き', goal: { kind: 'kill', enemy: 'wolf', count: 10 }, where: '風の草原', minLevel: 1, requires: 'g_trial', repeatable: true,
    desc: '草原のウルフはすぐに増えます。定期的な間引きの依頼です。', reward: { exp: 70, gold: 45 } },
  { id: 'g_boar', giver: 'guildClerk', name: '畑を荒らすイノシシ', goal: { kind: 'kill', enemy: 'boar', count: 6 }, where: '風の草原・赤岩の峡谷', minLevel: 2, requires: 'g_trial', repeatable: true,
    desc: '町の畑がホーンボアに荒らされています。突進に気をつけて。', reward: { exp: 110, gold: 60 } },
  { id: 'g_bee', giver: 'guildClerk', name: '大蜂の巣払い', goal: { kind: 'kill', enemy: 'bee', count: 8 }, where: '風の草原・黒き森', minLevel: 3, requires: 'g_trial', repeatable: true,
    desc: '街道に大蜂が出て、旅人が困っています。', reward: { exp: 180, gold: 80 } },
  { id: 'g_salamander', giver: 'guildClerk', name: '火吹きトカゲの駆除', goal: { kind: 'kill', enemy: 'salamander', count: 8 }, where: '赤岩の峡谷', minLevel: 5, requires: 'g_trial', repeatable: true,
    desc: '峡谷の火吹き岩のあたりでサラマンダーが増えています。', reward: { exp: 400, gold: 140 } },
  { id: 'g_golem', giver: 'guildClerk', name: '岩人形の破壊', goal: { kind: 'kill', enemy: 'golem', count: 5 }, where: '赤岩の峡谷・黒き森', minLevel: 6, requires: 'g_trial', repeatable: true,
    desc: '歩き回るロックゴーレムが道をふさいでいます。上級者向けの依頼です。', reward: { exp: 650, gold: 220 } },
];
