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
    { id: 'common', name: 'コモン', color: '#e6edf3', weight: 60, bossWeight: 0, mult: 1.0, affixes: 0, value: 1 },
    { id: 'uncommon', name: 'アンコモン', color: '#81c784', weight: 25, bossWeight: 0, mult: 1.1, affixes: 1, value: 1.8 },
    { id: 'rare', name: 'レア', color: '#64b5f6', weight: 11, bossWeight: 45, mult: 1.2, affixes: 2, value: 3 },
    { id: 'epic', name: 'エピック', color: '#ce93d8', weight: 3, bossWeight: 40, mult: 1.35, affixes: 3, value: 6 },
    { id: 'legendary', name: 'レジェンダリー', color: '#ffb74d', weight: 1, bossWeight: 15, mult: 1.5, affixes: 4, value: 12 },
  ],
  // 部位。base: 基本性能 / extraAffixes: レア度とは別に付く追加性能の数 / names: 名前 (nameTierEvery レベルごとに次のもの)
  //   types: 種類 (武器種) に分かれる部位。種類ごとに label・base・names を書き、部位の base・names は使わない。
  //     装備は type に種類のキーを持つ (セーブにも残るので、キーは変えない)。店・敵が落とすときの種類はくじで決める
  //     base の値は負でもよい (重い斧のすばやさなど)。負の値にはレア度の倍率をかけない
  //     fixed: 種類だけが持つ決まった値の能力 { ステータス: 値 } (レベル・レア度で変わらない。槍の攻撃範囲 +1・弓の射程 5)
  //     ammo: true なら矢 (consumables の arrow を持つ道具) を撃つ武器 (弓)。撃つたびに矢を 1 本使い、矢の攻撃力を足す。
  //       矢がないときは素手でとなりを殴る (武器のこうげき力は乗らない)。docs/crafting.md の「弓」
  slots: {
    weapon: { label: '武器', extraAffixes: 0,
      types: {
        sword: { label: '剣', base: { atk: [1.2, 0.6] },
          names: ['木の剣', '銅の剣', '鉄の剣', '鋼の剣', '騎士の剣', '魔鋼の剣', '竜骨の剣', '聖剣'] },
        dagger: { label: '短剣', base: { atk: [0.8, 0.4], agi: [3, 0.3], critMult: [0.06, 0.008] },
          names: ['ナイフ', '銅の短剣', '鉄の短剣', '鋼の短剣', '騎士の短剣', '魔鋼の短剣', '竜骨の短剣', '聖なる短剣'] },
        axe: { label: '斧', base: { atk: [1.8, 0.9], agi: [-3, -0.3] },
          names: ['手斧', '銅の斧', '鉄の斧', '鋼の斧', '戦斧', '魔鋼の斧', '竜骨の斧', '聖斧'] },
        staff: { label: '杖', base: { atk: [0.4, 0.2], matk: [1.6, 0.8] },
          names: ['木の杖', '樫の杖', '魔術師の杖', '銀の杖', '賢者の杖', '魔鋼の杖', '竜骨の杖', '聖杖'] },
        spear: { label: '槍', base: { atk: [1.0, 0.5] }, fixed: { reach: 1 },
          names: ['木の槍', '銅の槍', '鉄の槍', '鋼の槍', '騎士の槍', '魔鋼の槍', '竜骨の槍', '聖槍'] },
        bow: { label: '弓', base: { atk: [0.6, 0.3] }, fixed: { range: 5 }, ammo: true,
          names: ['木の弓', '短弓', '狩人の弓', '長弓', '騎士の弓', '魔鋼の弓', '竜骨の弓', '聖弓'] },
      } },
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
  //   矢 (arrow: { atk }): 弓 (ammo のある武器種) で撃つたびに 1 本使う道具。key・effects は持たない (キーで使わない)。
  //     atk: 撃つときにこうげき力に足す値。道具一覧で「使う矢にする」と選べる (選んでいなければ、ここに書いた順で先の矢から使う)
  //   buyCount: 商人で 1 回に買う数 (省略時 1。price は 1 つの値段)
  //   効果の種類 (kind) は src/items.js の ITEM_EFFECTS。足し方は docs/consumables.md
  consumables: {
    potion: { name: '回復薬', rarity: 'common', key: 'r', price: 25, max: 20, start: 3, effects: [{ kind: 'healHp', ratio: 0.4 }] },
    hiPotion: { name: '上回復薬', rarity: 'rare', key: 't', price: 80, max: 10, start: 0, effects: [{ kind: 'healHp', ratio: 0.8 }] },
    woodArrow: { name: '木の矢', rarity: 'common', price: 3, buyCount: 10, max: 99, start: 0, arrow: { atk: 2 } },
    ironArrow: { name: '鉄の矢', rarity: 'uncommon', price: 8, buyCount: 10, max: 99, start: 0, arrow: { atk: 5 } },
    steelArrow: { name: '鋼の矢', rarity: 'rare', price: 15, buyCount: 10, max: 99, start: 0, arrow: { atk: 9 } },
  },
  // 商人の店。world.js の NPC (role: 'shop') の shop にキーを書く
  //   name: 画面の見出し / consumables: 売る道具 (consumables のキー)。素材はどの商人でも売れる (装備の売買は鍛冶屋)
  shops: {
    townGeneral: { name: '始まりの町の商店', consumables: ['potion', 'woodArrow'] },
    wayTools: { name: '宿場の道具屋', consumables: ['potion', 'woodArrow'] },
    hamletHerbs: { name: '隠れ里の薬師', consumables: ['potion', 'hiPotion', 'woodArrow', 'ironArrow'] },
    rockTools: { name: '岩根の村の道具屋', consumables: ['potion', 'hiPotion', 'woodArrow', 'ironArrow'] },
    harborTools: { name: '潮風の港の道具屋', consumables: ['potion', 'hiPotion', 'woodArrow', 'ironArrow'] },
    frostHerbs: { name: '霜の村の薬師', consumables: ['potion', 'hiPotion', 'woodArrow', 'ironArrow', 'steelArrow'] },
    desertBazaar: { name: '砂の都の市場', consumables: ['potion', 'hiPotion', 'woodArrow', 'ironArrow', 'steelArrow'] },
  },
  // 鍛冶屋で買える装備のレア度 (smiths の gear に書けるのはこれだけ。起動時のデータの確認で調べる)
  smithRarities: ['common', 'uncommon'],
  // 鍛冶屋で作った装備のレア度のくじ (weight: 出やすさ)
  craftRarities: [
    { rarity: 'uncommon', weight: 80 },
    { rarity: 'rare', weight: 17 },
    { rarity: 'epic', weight: 3 },
  ],
  // 鍛冶屋。world.js の NPC (role: 'smith') の smith にキーを書く。装備を買う・売る・作る (町ごとに品ぞろえが違う)
  //   name: 画面の見出し / gear: 売る装備 [部位, レア度] (1 つずつ並ぶ。レア度は smithRarities のどれか。武器の種類はくじ)
  //   levelOffset: 装備レベル = 自分のレベル + levelOffset / maxLevel: 装備レベルの上限 (なければ上限なし)
  //   recipes: 作れる装備 (recipes のキー)
  //   自分のレベルが変わると、次に鍛冶屋を開いたときに品ぞろえが入れ替わる。持っている装備はどの鍛冶屋でも売れる
  smiths: {
    townSmith: { name: '始まりの町の鍛冶屋', levelOffset: 0, maxLevel: 4,
      gear: [['weapon', 'common'], ['weapon', 'common'], ['armor', 'common'], ['accessory', 'common']],
      recipes: ['fangKnife', 'stingerSword', 'hornAxe', 'jellyStaff', 'featherSpear', 'hunterBow'] },
    waySmith: { name: '宿場の鍛冶屋', levelOffset: 0, maxLevel: 8,
      gear: [['weapon', 'common'], ['weapon', 'uncommon'], ['armor', 'common'], ['armor', 'uncommon'], ['accessory', 'uncommon']],
      recipes: ['flameSword', 'venomDagger', 'stoneAxe', 'windStaff', 'goblinSpear', 'harpyBow'] },
    hamletSmith: { name: '隠れ里の鍛冶屋', levelOffset: 1,
      gear: [['weapon', 'uncommon'], ['weapon', 'uncommon'], ['armor', 'uncommon'], ['accessory', 'uncommon']],
      recipes: ['silkDagger', 'scrapSword', 'kingAxe', 'treantStaff', 'koboldSpear', 'silkBow'] },
    harborSmith: { name: '港の鍛冶屋', levelOffset: 0, maxLevel: 10,
      gear: [['weapon', 'common'], ['weapon', 'uncommon'], ['armor', 'uncommon'], ['accessory', 'common'], ['accessory', 'uncommon']],
      recipes: ['gullDagger', 'clawAxe', 'pearlStaff', 'clawSpear', 'gullBow'] },
    frostSmith: { name: '霜の村の鍛冶屋', levelOffset: 1,
      gear: [['weapon', 'uncommon'], ['weapon', 'uncommon'], ['armor', 'uncommon'], ['armor', 'uncommon'], ['accessory', 'uncommon']],
      recipes: ['iceDagger', 'soulSword', 'yetiAxe', 'wispStaff', 'frogSpear', 'frostBow'] },
    desertSmith: { name: '砂の都の鍛冶屋', levelOffset: 2,
      gear: [['weapon', 'uncommon'], ['weapon', 'uncommon'], ['armor', 'uncommon'], ['armor', 'uncommon'], ['accessory', 'uncommon'], ['accessory', 'uncommon']],
      recipes: ['thiefDagger', 'dragonSword', 'wormAxe', 'pharaohStaff', 'orbSpear', 'dragonBow'] },
  },
  // 鍛冶屋で作る装備 (作り方)。キーは作った装備の recipe に残る (セーブにも残るので変えない)
  //   name: 作った装備の名前 / slot: 部位 / type: 種類 (部位に types があるとき。武器種) / level: 装備レベル (決まった値)
  //   materials: 使う素材 { 素材のキー: 数 } / gold: 作る代金
  //   bonus: 種類の基本性能に足す性能 { ステータス: [Lv1 の値, 1 レベルごとの増加] } (器用さの補正のある弓など。基本性能と同じくレア度の倍率をかける)
  //   レア度は craftRarities のくじ。基本性能と追加性能の数はレア度で決まり、追加性能の種類と揺れはランダム (店・落とし物と同じ)
  recipes: {
    // 始まりの町 (草原の素材)
    fangKnife: { name: '狼牙のナイフ', slot: 'weapon', type: 'dagger', level: 3, materials: { wolfPelt: 6, wolfFang: 2 }, gold: 30 },
    stingerSword: { name: '毒針の剣', slot: 'weapon', type: 'sword', level: 3, materials: { beeStinger: 6, honey: 1 }, gold: 30 },
    hornAxe: { name: '角の手斧', slot: 'weapon', type: 'axe', level: 3, materials: { boarHorn: 6, boarMeat: 1 }, gold: 30 },
    jellyStaff: { name: 'ゼリーの杖', slot: 'weapon', type: 'staff', level: 3, materials: { slimeJelly: 6, slimeCore: 1 }, gold: 30 },
    featherSpear: { name: '黒羽の槍', slot: 'weapon', type: 'spear', level: 3, materials: { blackFeather: 6, shinyTrinket: 1 }, gold: 30 },
    hunterBow: { name: '狩人の短弓', slot: 'weapon', type: 'bow', level: 3, materials: { wolfPelt: 4, blackFeather: 4 }, gold: 30, bonus: { dex: [2, 0.2] } },
    // 風見の宿場 (草原の奥・峡谷の素材)
    flameSword: { name: '火竜鱗の剣', slot: 'weapon', type: 'sword', level: 6, materials: { fireScale: 8, flameSac: 2 }, gold: 50 },
    venomDagger: { name: '毒尾の短剣', slot: 'weapon', type: 'dagger', level: 7, materials: { scorpionShell: 8, venomTail: 2 }, gold: 60 },
    stoneAxe: { name: '岩砕きの斧', slot: 'weapon', type: 'axe', level: 7, materials: { stoneShard: 8, manaCore: 1 }, gold: 60 },
    windStaff: { name: '風切りの杖', slot: 'weapon', type: 'staff', level: 7, materials: { harpyFeather: 8, windCharm: 2 }, gold: 60 },
    goblinSpear: { name: 'ゴブリンの槍', slot: 'weapon', type: 'spear', level: 5, materials: { ragCloth: 8, goblinEarring: 2 }, gold: 45 },
    harpyBow: { name: 'ハーピーの弓', slot: 'weapon', type: 'bow', level: 6, materials: { harpyFeather: 8, windCharm: 1 }, gold: 50, bonus: { dex: [2, 0.2] } },
    // 森の隠れ里 (森・山の素材とボス)
    silkDagger: { name: '蜘蛛糸の短剣', slot: 'weapon', type: 'dagger', level: 8, materials: { spiderSilk: 8, venomGland: 2 }, gold: 70 },
    scrapSword: { name: 'くず鉄の大剣', slot: 'weapon', type: 'sword', level: 10, materials: { koboldFur: 8, scrapOre: 3 }, gold: 85 },
    kingAxe: { name: '狼王の牙斧', slot: 'weapon', type: 'axe', level: 9, materials: { kingPelt: 2, kingFang: 1, wolfFang: 6 }, gold: 80 },
    treantStaff: { name: '古木の杖', slot: 'weapon', type: 'staff', level: 9, materials: { ancientBranch: 2, mushroomCap: 8, dreamSpore: 2 }, gold: 80 },
    koboldSpear: { name: 'コボルトの鉄槍', slot: 'weapon', type: 'spear', level: 9, materials: { koboldFur: 6, venomGland: 2 }, gold: 75 },
    silkBow: { name: '蜘蛛糸の弓', slot: 'weapon', type: 'bow', level: 9, materials: { spiderSilk: 8, ancientBranch: 1 }, gold: 80 },
    // 潮風の港 (海岸の素材)
    gullDagger: { name: '海鳥の短剣', slot: 'weapon', type: 'dagger', level: 6, materials: { seabirdFeather: 8, prettyShell: 2 }, gold: 50 },
    clawAxe: { name: '大バサミの斧', slot: 'weapon', type: 'axe', level: 7, materials: { crabShell: 8, bigClaw: 2 }, gold: 60 },
    pearlStaff: { name: '真珠の杖', slot: 'weapon', type: 'staff', level: 7, materials: { inkSac: 8, pearl: 2 }, gold: 60 },
    clawSpear: { name: 'ハサミの銛', slot: 'weapon', type: 'spear', level: 7, materials: { seabirdFeather: 6, bigClaw: 2 }, gold: 60 },
    gullBow: { name: '海鳥の弓', slot: 'weapon', type: 'bow', level: 7, materials: { seabirdFeather: 8, pearl: 1 }, gold: 60, bonus: { dex: [2, 0.2] } },
    // 霜の村 (高原・湿地の素材)
    iceDagger: { name: '氷牙の短剣', slot: 'weapon', type: 'dagger', level: 10, materials: { whitePelt: 8, iceFang: 2 }, gold: 85 },
    soulSword: { name: '鬼火の剣', slot: 'weapon', type: 'sword', level: 11, materials: { wispLight: 8, soulShard: 2 }, gold: 90 },
    yetiAxe: { name: '雪男の大斧', slot: 'weapon', type: 'axe', level: 11, materials: { yetiFur: 8, iceBlock: 2 }, gold: 90 },
    wispStaff: { name: '氷精の杖', slot: 'weapon', type: 'staff', level: 10, materials: { frostCrystal: 8, wispCore: 2 }, gold: 85 },
    frogSpear: { name: '毒蛙の槍', slot: 'weapon', type: 'spear', level: 10, materials: { frogSkin: 8, poisonGland: 2 }, gold: 85 },
    frostBow: { name: '氷の大弓', slot: 'weapon', type: 'bow', level: 11, materials: { whitePelt: 8, frostCrystal: 2 }, gold: 90 },
    // 砂の都 (砂丘の素材とボス)
    thiefDagger: { name: '盗賊の短剣', slot: 'weapon', type: 'dagger', level: 12, materials: { stolenPouch: 8, stolenJewel: 2 }, gold: 100 },
    dragonSword: { name: '竜骨の大剣', slot: 'weapon', type: 'sword', level: 14, materials: { dragonScale: 4, dragonHeart: 1 }, gold: 120 },
    wormAxe: { name: '砂虫の斧', slot: 'weapon', type: 'axe', level: 13, materials: { wormHide: 8, desertOrb: 2 }, gold: 110 },
    pharaohStaff: { name: '王墓の杖', slot: 'weapon', type: 'staff', level: 13, materials: { oldBandage: 8, ancientCoin: 2 }, gold: 110 },
    orbSpear: { name: '宝珠の槍', slot: 'weapon', type: 'spear', level: 13, materials: { venomTail: 4, desertOrb: 2 }, gold: 110 },
    dragonBow: { name: '竜骨の弓', slot: 'weapon', type: 'bow', level: 14, materials: { dragonScale: 3, wormHide: 6 }, gold: 120, bonus: { dex: [2, 0.2] } },
  },
  // 素材 (敵が落とす。商人に売るとお金になる。鍛冶屋で装備を作る材料になる (recipes))
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
    slimeJelly: { name: 'スライムゼリー', rarity: 'common', price: 3, color: '#81d4fa' },
    slimeCore: { name: '澄んだ核', rarity: 'rare', price: 9, color: '#e1f5fe' },
    blackFeather: { name: '黒い羽根', rarity: 'common', price: 3, color: '#5c6bc0' },
    shinyTrinket: { name: '光り物', rarity: 'rare', price: 10, color: '#ffd54f' },
    ragCloth: { name: '粗末な布', rarity: 'common', price: 4, color: '#a1887f' },
    goblinEarring: { name: 'ゴブリンの耳飾り', rarity: 'rare', price: 12, color: '#ffb74d' },
    scorpionShell: { name: 'サソリの殻', rarity: 'common', price: 8, color: '#d4a056' },
    venomTail: { name: '毒尾', rarity: 'rare', price: 20, color: '#aed581' },
    harpyFeather: { name: 'ハーピーの羽', rarity: 'common', price: 8, color: '#ce93d8' },
    windCharm: { name: '風の羽飾り', rarity: 'rare', price: 22, color: '#80deea' },
    spiderSilk: { name: '蜘蛛の糸', rarity: 'common', price: 9, color: '#eeeeee' },
    venomGland: { name: '蜘蛛の毒腺', rarity: 'rare', price: 24, color: '#9575cd' },
    mushroomCap: { name: '毒キノコの傘', rarity: 'common', price: 9, color: '#e57373' },
    dreamSpore: { name: '幻の胞子', rarity: 'rare', price: 26, color: '#f48fb1' },
    koboldFur: { name: 'コボルトの毛', rarity: 'common', price: 10, color: '#bcaaa4' },
    scrapOre: { name: 'くず鉄石', rarity: 'rare', price: 28, color: '#90a4ae' },
    // 新しい地方の敵
    crabShell: { name: '蟹の甲羅', rarity: 'common', price: 7, color: '#ef9a9a' },
    bigClaw: { name: '大きなハサミ', rarity: 'rare', price: 16, color: '#e53935' },
    seabirdFeather: { name: '海鳥の羽', rarity: 'common', price: 5, color: '#f5f5f5' },
    prettyShell: { name: 'きれいな貝', rarity: 'rare', price: 12, color: '#f8bbd0' },
    inkSac: { name: '墨袋', rarity: 'common', price: 6, color: '#5e35b1' },
    pearl: { name: '真珠', rarity: 'rare', price: 20, color: '#fafafa' },
    whitePelt: { name: '白狼の毛皮', rarity: 'common', price: 8, color: '#e3f2fd' },
    iceFang: { name: '氷の牙', rarity: 'rare', price: 18, color: '#b3e5fc' },
    frostCrystal: { name: '霜の結晶', rarity: 'common', price: 9, color: '#80deea' },
    wispCore: { name: '氷精の核', rarity: 'rare', price: 24, color: '#4fc3f7' },
    yetiFur: { name: '雪男の毛', rarity: 'common', price: 12, color: '#eceff1' },
    iceBlock: { name: '氷塊', rarity: 'rare', price: 30, color: '#b2ebf2' },
    frogSkin: { name: 'カエルの皮', rarity: 'common', price: 7, color: '#81c784' },
    poisonGland: { name: '毒腺', rarity: 'rare', price: 16, color: '#9ccc65' },
    wispLight: { name: '鬼火の灯', rarity: 'common', price: 8, color: '#b39ddb' },
    soulShard: { name: '魂のかけら', rarity: 'rare', price: 22, color: '#7e57c2' },
    wormHide: { name: '砂虫の皮', rarity: 'common', price: 14, color: '#c8a165' },
    desertOrb: { name: '砂漠の宝珠', rarity: 'rare', price: 36, color: '#ffb74d' },
    oldBandage: { name: '古い包帯', rarity: 'common', price: 8, color: '#d7ccc8' },
    ancientCoin: { name: '古代の金貨', rarity: 'rare', price: 28, color: '#ffd54f' },
    stolenPouch: { name: '盗品の袋', rarity: 'common', price: 15, color: '#a1887f' },
    stolenJewel: { name: '盗まれた宝石', rarity: 'rare', price: 40, color: '#e040fb' },
    kingPelt: { name: '狼王の毛皮', rarity: 'rare', price: 40, color: '#90a4ae' },
    kingFang: { name: '狼王の大牙', rarity: 'epic', price: 120, color: '#ffffff' },
    ancientBranch: { name: '古木の枝', rarity: 'rare', price: 50, color: '#8d6e63' },
    treantFruit: { name: '森の主の実', rarity: 'epic', price: 200, color: '#aed581' },
    dragonScale: { name: '竜の鱗', rarity: 'rare', price: 40, color: '#e57373' },
    dragonHeart: { name: '竜の心臓', rarity: 'epic', price: 240, color: '#d50000' },
  },
};
