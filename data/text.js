// =====================================================================
//  画面に出す文章 (メッセージ欄・画面中央の大きい文字・頭の上に浮かぶ文字・HUD・ワールドの文字・HTML の画面・タイトル・セーブの説明)
//  src/ は txt('まとまり.名前', { 名前: 値 }) で引く (src/core.js)。{名前} のところに値が入る
//  言い回しを変えるときはここだけ直す。{名前} を消す・名前を変えると値が入らなくなる (コンソールに [データの確認])
//  メッセージ欄・浮かぶ文字の色と大きさは data/theme.js の THEME.msg / THEME.float
//  敵・道具・スキル・クエストの名前、NPC の言葉、クエストの説明などは、それぞれのデータ (data/*.js・world.js) にある
//  index.html に直接書いてある文字 (タイトルの説明・操作・画面の見出し・ボタン) は index.html
// =====================================================================

const TEXT = {
  // ----- 戦い (src/combat.js) -----
  combat: {
    charge: '{who}は{skill}の構えをとった。',       // 予告ありの技を構えた
    heroSkill: '{skill}！',                          // 主人公が技を出した (ほかのキャラはダメージの文に名前が出る)
    buffSelf: '{skill}！ {buff}（{actions} 行動）',  // 主人公が自分を強化した
    buffOther: '{who}の{skill}！ {buff}（{actions} 行動）',
    statUp: '{stat}↑',                               // 強化・弱体をかけたときに頭の上に浮かぶ文字
    statDown: '{stat}↓',
    noDash: 'その方向には進めない。',
    // ダメージの文 (damageLine)。src: 使った者 / what: 技 / tgt: 受けた者 / crit: 会心なら critMark、そうでなければ空
    critMark: '（会心）',
    heroHurt: '{src}の{what}！ {dmg} のダメージを受けた{crit}',
    heroHurtMiss: '{src}の{what}！ ミス！ ダメージを受けない',
    headHero: '{what}: ',                            // 主人公が与えたときの文の頭
    headOther: '{src}の{what}！ ',                   // どちらでもないときの文の頭
    deal: '{head}{tgt}に {dmg} のダメージ{crit}',
    dealMiss: '{head}ミス！ {tgt}にダメージを与えられない',
    // 頭の上に浮かぶ文字
    invulnFloat: '無効',
    missFloat: 'ミス',
    damageFloat: '{dmg}',
    critFloat: '{dmg}!',
    heroDown: '力尽きた…',
    defeated: '{who}を倒した。',
    bossDefeated: 'BOSS 撃破！',
    allyDown: '{who}は倒れた。',
  },

  // ----- 強化・弱体・経験値・レベル・復活 (src/units.js) -----
  units: {
    buffEndSelf: '{buff}の効果が切れた。',
    buffEndOther: '{who}の{buff}の効果が切れた。',
    expFloat: '+{n} EXP',
    levelUp: 'LEVEL UP!  Lv {level}',               // 画面中央の大きい文字
    statGain: '{stat} +{n}',                         // その下の小さい文字 (上がったステータス)
    statGainSep: '　',
    learnedKey: '{skill}（{key}）',                  // 新しく覚えたスキル (スキル欄に置いてあればキーも)
    learned: '新しいスキル: {skills}',
    learnedSep: '、',
    levelUpLog: 'レベルが {level} に上がった！',
    respawn: '力尽きた…',                            // 復活したときの大きい文字 (失ったものを後ろに並べる)
    lostExp: 'EXP -{n}',
    lostGold: '-{n} G',
    lostSep: '  ',
  },

  // ----- 主人公の入力 (src/player.js) -----
  skills: {
    locked: '{skill}は Lv{level} で使えるようになる。',
    unknown: '{skill}はまだ覚えていない。',
    cooldown: '{skill}はあと {n} 行動で使える。',
    noMp: 'MP が足りない（{skill}は MP {cost}、今 {mp}）。',
  },

  // ----- 落とし物・道具 (src/items.js) -----
  items: {
    pickMaterial: '{name}を {amount} つ拾った。',
    pickMaterialFloat: '{name} ×{amount}',
    pickItem: '{name}を拾った。',
    bagFull: '持ち物がいっぱいで{name}を拾えない。',
    // 道具の効果 (ITEM_EFFECTS)。whose: 主人公以外に使ったときの「〇〇の」(ownerSp は「リナの HP」のように空白つき)
    owner: '{who}の',
    ownerSp: '{who}の ',
    hpFull: '{whose}HP は満タンだ。',
    hpFullReason: 'HP が満タン',
    healHpDesc: '最大HPの {pct}% 回復{now}',
    hpHealed: '{whose}HP が {n} 回復した。',
    mpFull: '{whose}MP は満タンだ。',
    mpFullReason: 'MP が満タン',
    healMpDesc: '最大MPの {pct}% 回復{now}',
    mpHealed: '{whose}MP が {n} 回復した。',
    nowValue: '（今なら {n}）',                     // 説明の後ろに付ける今の回復量
    healFloat: '+{n}',
    buffActive: '{whose}{buff}はもうかかっている。',
    buffReason: '{buff}中',
    buffDesc: '{buff}（{actions} 行動）',
    buffApplied: '{whose}{buff}（{actions} 行動）',
    none: '{item}がない。',
    noneReason: '持っていない',
    descSep: '・',                                    // 効果の説明をつなぐ
    // 使った文: {user}{target}{item}を使った。{effects} (user / target は主人公・自分なら空)
    used: '{user}{target}{item}を使った。{effects}',
    usedBy: '{who}は',
    usedOn: '{who}に',
  },

  // ----- ゾーン (src/map.js) -----
  zone: {
    safe: '安全地帯',
    level: 'Lv{lo}',
    levelRange: 'Lv{lo}〜{hi}',
    entered: '{zone}に入った。',
  },

  // ----- クエスト (src/quests.js) -----
  quests: {
    // 目標の種類 (QUEST_GOALS)。text: 内容の文 / short: キャラクターの画面で数の前に書く名前 / hint: 受けているときの詳細の案内
    killText: '{enemy}を {count} 体倒す',
    killHint: '受けている（倒した数は受けたあとから数える）',
    collectText: '{material}を {count} 個集める',
    collectHint: '受けている（持っている数で数える。報告すると渡す）',
    talkText: '{npc}と話す',
    talkShort: '{npc}と話す',
    talkHint: '受けている（話しかけると報告できる）',
    progress: '{n} / {need}',
    done: 'クエスト達成！',
    doneSub: '「{quest}」を{npc}に報告しよう',
    rewardExp: '経験値 {n}',
    rewardGold: '{n} G',
    rewardItem: '{name} ×{n}',
    rewardGear: '{rarity}の{slot}',
    rewardSep: '、',
    bagFull: '持ち物がいっぱいで受け取れない',
    claimed: '「{quest}」の報酬を受け取った: {reward}',
    accepted: '「{quest}」を受けた',
    // クエストの画面
    tagAvailable: '受けられる',
    tagActive: '受けている',
    tagReady: '報告できる',
    tagClaimed: '報告済み',
    lowLevel: 'Lv{level} から',
    activeSub: '{tag}　{progress}',
    repeatTag: 'くり返し',
    noQuests: '今は頼みたいことはない。',
    goalProgress: '{goal}　{progress}',
    accept: 'この依頼を受ける（Enter）',
    claim: '報告する（Enter）',
    lowLevelHint: 'Lv{level} になると受けられる',
    claimedHint: '報告済み',
    labelGoal: '内容',
    labelWhere: '場所',
    labelReward: '報酬',
    labelKind: '種類',
    repeatable: 'くり返し受けられる',
  },

  // ----- 道具一覧・店・キャラクターの画面 (src/ui.js) -----
  menu: {
    titleInv: '道具一覧',
    titleChar: 'キャラクター',
    gold: '所持金 {n} G',
    price: '{n} G',
    chipSub: '{slot} Lv{level}',
    emptySlot: '{slot}: なし',
    invCount: '{n} / {max}',
    noItems: '何も持っていない',
    hintPop: 'アイテムをクリックすると詳しく表示します',
    hintSelect: '装備を選ぶと詳しく表示します',
    close: '閉じる',
    // 装備の詳細
    baseStats: '基本性能',
    extraStats: '追加性能（{n}）',
    noStats: 'なし',
    noValue: '-',
    gearSub: '{rarity}・{slot}・Lv{level}',
    compare: '差は装備中の「{name}」と比べたもの',
    unequip: '外す',
    buy: '買う（{n} G）',
    equip: '装備する',
    drop: '捨てる',
    sell: '売る（{n} G）',
    // 道具
    toolSub: '{rarity}・道具',
    have: '持っている数',
    haveOf: '{n} / {max}',
    useKey: '使うキー',
    useKeyValue: '{key}（フィールドで。1 行動）',
    use: '使う',
    cannotUse: '{reason}なので使えない',
    toolName: '{name} ×{n}',
    toolMax: ' / {max}',
    toolLine: '{rarity}・{desc}・{key} キー',
    // 素材
    matSub: '{rarity}・素材',
    matPrice: '売値',
    matPriceValue: '{price} G（全部で {total} G）',
    matFrom: '落とす魔物',
    matFromSep: '、',
    matHint: '商人に売るとお金になる',
    matName: '{name} ×{n}',
    matLine: '{rarity}・売値 {price} G',
    sellOne: '1つ売る',
    sellAllOf: '全部（{n} G）',
    noMaterials: '素材は魔物を倒すと手に入る',
    sellAll: '全部売る（{n} G）',
    // 店
    shopLine: '{rarity}・{desc}（{key} で使う）',
    shopBuy: '買う（{n} G）',
    shopEmpty: '売り物はない',
    smithEmpty: '装備は売り切れ（レベルが上がると入れ替わる）',
    // キャラクターの画面の左上
    nameLevel: '{name}　Lv{level}',
    hp: 'HP',
    mp: 'MP',
    ofMax: '{n} / {max}',
    exp: '経験値',
    expValue: '{exp} / {need}（あと {left}）',
    maxLevel: '最大レベル',
    kills: '撃破数',
    status: '状態',
    statusSafe: '安全地帯',
    statusRest: '休息中',
    statusFight: '戦闘中',
    turn: 'ターン',
    where: 'いる場所',
    whereValue: '{zone}（{level}）',
    quests: 'クエスト',
    questReport: '{npc}に報告',
    questCount: '{name} {n} / {need}',
    noQuests: '受けているクエストはない',
    // つよさ ({buffed} は buffedSample を強化の色で書いたもの)
    strength: 'つよさ',
    strengthNote: 'Lv{level}　（ ）は装備で上がっている分。{buffed}は強化（バフ）中',
    buffedSample: 'この色',
    equipBonus: '（{v}）',
  },

  // ----- 会話・NPC (src/ui.js) -----
  talk: {
    close: '閉じる（F）',
    next: '次へ（F）　{n} / {total}',
    nobody: '話しかけられる人がいない。となりのマスで F を押そう。',
  },

  // ----- HUD (src/hud.js) -----
  hud: {
    level: 'Lv {level}',                             // 仲間の欄
    hpBar: 'HP {hp} / {max}',
    mpBar: 'MP {mp} / {max}',
    skillLocked: 'Lv{level} で解放',                 // スキル欄: まだ覚えていないスキル
    skillUnknown: '未習得',
    skillMp: 'MP{mp}',
    itemCount: '×{n}',
    itemsButton: '道具',
    itemsKey: 'I',
    bossBar: 'Lv{level} {name}  {hp} / {max}',
    mapHintWorld: 'M: 世界地図',
    mapHintZone: 'M: このエリアの地図',
    turnOrder: '行動順',
    turnHero: '自',
    // ツールチップ
    unitTitle: 'Lv{level} {name}',
    hpMp: 'HP {hp} / {maxHp}　MP {mp} / {maxMp}',
    stats4: '{atkLabel} {atk}  {defLabel} {def}  {intLabel} {int}  {mdefLabel} {mdef}',
    speed: '速度 {speed}（あなたの {ratio} 倍）',
    attacks: '技: {list}',
    attackMagic: '（術）',
    attackMp: ' MP{mp}',
    drops: '素材: {list}',
    listSep: ' / ',
    expCamp: '経験値 {exp}　{camp}',
    buffEffect: '{stat} {pct}%',
    buffLeft: 'あと {n} 行動',
    npcTitle: '{name}（{kind}）',
    npcSpeed: '{speedLabel} {speed}  {critLabel} {crit}%',
    npcNoHit: '攻撃は当たらない',
  },

  // ----- ワールドに書く文字 (src/render.js) -----
  world: {
    hazardLeft: 'あと{n}',                           // 敵の技の予告の残り
    unitLevel: 'Lv{level}',                          // 敵の頭上のレベル
    chargeMark: '!',                                 // 予告中の敵の頭上
    questMark: '!',                                  // 受けられるクエストがある NPC
    reportMark: '?',                                 // 報告できるクエストがある NPC
    talkHint: 'F: 話しかける',
    gateLabel: '→ {zone}（{level}）',
  },

  // ----- タイトル・はじめから・クリックで歩く (src/main.js) -----
  title: {
    start: '冒険の始まり',                           // はじめから遊んだときの大きい文字 (下はゾーン名)
    continue: '続きから（Lv {level}・{zone}）',
    confirmRestart: 'セーブデータを消して、はじめから遊びますか？',
    confirmOverwrite: 'この版で読めないセーブデータを上書きして、はじめから遊びますか？（上書きする前の控えは残します）',
    travelStop: '敵に気づかれている。歩くのをやめた。',
  },

  // ----- セーブの説明 (src/save.js。タイトルと一時停止の画面) -----
  save: {
    whereServer: 'サーバー（saves/save.json）',
    whereLocal: 'ブラウザ',
    whereSep: 'と',
    newer: '{where}のセーブデータは新しい版のゲームで保存されたもの（形 v{v}。この版は v{max} まで）なので、この版では読めません。続きは新しい版のゲームで遊んでください。「はじめから」を選ぶとセーブデータが上書きされます（上書きする前の控えは残します）。',
    brokenOther: '{where}のセーブデータは壊れているか古すぎて読めなかったので、もう一方のセーブを使います（控えを残して上書きします）。',
    broken: '{where}にセーブデータがありますが、壊れているか古すぎて読めませんでした。「はじめから」を選ぶと上書きされます（上書きする前の控えは残します）。',
    serverNewer: 'サーバーに新しい版のゲームのセーブがあるため、サーバーには保存していません。ブラウザには保存しています。',
    unreachable: 'サーバーから返事がありません。ブラウザには保存しています（次の保存でもう一度サーバーを試します）。',
    browserOnly: '進行はブラウザ（localStorage）に自動で保存されています。サーバーにも保存するには python server.py で起動してください。',
    serverError: 'サーバーに保存できませんでした（{error}）。ブラウザには保存しています。',
    both: '進行はサーバー（saves/save.json）とブラウザに自動で保存されています。そのままブラウザを閉じても大丈夫です。',
  },
};
