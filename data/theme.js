// =====================================================================
//  意味を持つ色 (陣営・敵のレベル差など)、canvas に描く HUD・フィールドの色と大きさ、キャラの絵の描き方
//  地形の色は world.js の terrain、レア度の色は data/items.js、敵の色は data/enemies.js、強化のアイコンの地の色は data/buffs.js
//  HTML の画面 (タイトル・道具一覧・店など) の見た目は style.css
//  色は CSS の書き方 ('#rrggbb' / 'rgba(...)')。'r,g,b' と書いてあるものは、透明度をあとから付ける (描くときに rgba(r,g,b,透明度) にする)
// =====================================================================

const THEME = {
  // 予測線・弾・着弾の色 ('r,g,b'。透明度はあとから付ける)
  faction: {
    player: { rgb: '80,200,255', slash: '200,240,255', spark: '#80d8ff', orbGlow: 'rgba(100,200,255,0.35)', orb: '#e1f5fe' },
    enemy: { rgb: '255,70,70', slash: '255,180,170', spark: '#ffab40', trail: '#ff9e40', orbGlow: 'rgba(255,120,40,0.35)', orb: '#ffcc80' },
  },
  spawn: '179,136,255',   // 敵が湧く前の予告
  // 敵のレベルの文字色 (自分とのレベル差で決まる。格下の境目は params.js の enemyLevel.grayDiff)
  level: { much: '#ff5252', higher: '#ffab40', even: '#e6edf3', gray: '#8b949e' },
  levelMuchDiff: 3,       // このレベル以上高いと much
  allyHp: '#66bb6a',      // 主人公の陣営のほかのキャラ (仲間) の頭上の HP バー
  mp: '#3d8bfd',          // MP のゲージ (HUD・キャラクターの画面)
  mpShort: '#ff8a80',     // スキル欄の消費 MP (MP が足りないとき)

  // ----- canvas の文字と地 -----
  font: 'sans-serif',     // canvas に書く文字の書体 (太さと大きさは書く場所ごとに src/ で決める。fontOf)
  background: '#0d1117',  // canvas の地 (マップの外)
  // よく使う文字の色
  text: {
    main: '#e6edf3',      // ふつうの文字
    sub: '#9da7b3',       // 補足 (案内・「行動順」の見出しなど)
    white: '#fff',
    outline: '#000',      // 縁取り (outlineText の既定)
  },

  // ----- バー (HUD の HP・MP・ボスの HP、キャラの頭上の HP) -----
  bars: {
    back: 'rgba(0,0,0,0.6)',  // HUD のバーの下地
    label: '#fff',            // HUD のバーに重ねる文字
    hp: '#43a047',            // 仲間の欄の HP
    hpLow: '#e53935',         // 仲間の欄の HP (残りが hpLowRatio 以下)
    hpLowRatio: 0.3,
    boss: '#c62828',          // 上中央のボスの HP
    unitBack: '#000a',        // 頭上の HP バーの下地
    enemyHp: '#ef5350',       // 敵の頭上の HP (仲間は allyHp)
    returnHp: '#8b949e',      // 諦めて帰っている敵の頭上の HP
    unitMinW: 30, unitWPerR: 2.2, unitH: 4, // 頭上の HP バーの幅 (最小 px と、大きさ r の何倍か) と高さ (px)
  },

  // ----- HUD (src/hud.js) -----
  hud: {
    // 左上の仲間の欄 (1 人分。大きさは px)
    card: {
      w: 260, h: 72, face: 60, gap: 8, radius: 10,
      bg: 'rgba(13,17,23,0.8)', bgHover: 'rgba(30,48,66,0.92)', edge: 'rgba(79,195,247,0.35)', edgeHover: '#4fc3f7',
      faceBg: '#1b2633', name: '#e6edf3', level: '#ffd54f', mpText: '#fff',
      buffSize: 18, buffGap: 5, // 名前の右の強化のアイコン
    },
    // 下中央のスキル欄 (1 マスの大きさ・間・画面の下からの位置は px)
    skillBar: {
      size: 62, gap: 12, bottom: 34, radius: 10,
      bg: 'rgba(13,17,23,0.85)', bgActive: 'rgba(80,200,255,0.35)', bgHover: 'rgba(48,80,110,0.95)', bgButton: 'rgba(30,40,55,0.9)',
      edge: '#4fc3f7', edgeOff: '#30363d', edgeButton: '#ffd54f', // 使える / 再使用待ち・未習得・MP 不足 / 「道具」ボタン
      name: '#e6edf3', lockName: '#6e7681', lockText: '#9da7b3',
      countOk: '#69f0ae', countNone: '#ff5252', // 回復薬の残り
      cdShade: 'rgba(0,0,0,0.6)', cdText: '#fff', key: '#ffd54f',
    },
    // 上中央の行動順
    turnOrder: {
      size: 30, gap: 4, top: 14,
      bg: 'rgba(13,17,23,0.75)', label: '#9da7b3', cellOurs: '#0b3a52', cellTheirs: '#3a1a1a',
      edgeHero: '#4fc3f7', edgeCharging: '#ff7043', heroGlyph: '#e1f5fe',
    },
    message: { main: '#ffd54f', sub: '#e6edf3' }, // 画面中央の大きい文字 (ゾーン名・レベルアップなど)
    logOutline: 'rgba(0,0,0,0.85)',                // 左下のメッセージ欄の文字の縁取り
  },

  // ----- 右下の地図と世界地図 -----
  map: {
    bg: 'rgba(13,17,23,0.8)', worldBg: 'rgba(13,17,23,0.88)', hintBg: 'rgba(13,17,23,0.8)', hint: '#9da7b3',
    gate: '#80deea', link: 'rgba(128,222,234,0.55)', bonfire: '#ff9800', npc: '#ffe082', view: 'rgba(255,255,255,0.4)', spawn: '#b388ff',
    boss: '#ffd54f', enemyChase: '#ff1744', enemy: '#c96b6b', ours: '#4fc3f7', // ours: 主人公と主人公の陣営のキャラ
    zoneEdge: 'rgba(255,255,255,0.25)', here: '#4fc3f7', name: '#e6edf3', level: '#9da7b3', safeLevel: '#a5d6a7',
  },

  // ----- マウスを重ねたときの説明 (敵・NPC・強化のアイコン) -----
  tooltip: {
    bg: 'rgba(13,17,23,0.92)', text: '#e6edf3', buffTitle: '#ffccbc',
    font: 13, titleFont: 14, lineH: 18, pad: 10, radius: 8, offset: 16, // 大きさは px。offset: マウスからのずれ
  },

  // ----- 強化・弱体のアイコン (地の色は data/buffs.js の color) -----
  buffIcon: {
    edge: 'rgba(255,255,255,0.85)', glyph: '#fff', up: '#b9f6ca', down: '#ff8a80', arrowEdge: 'rgba(0,0,0,0.7)', count: '#fff',
    fieldSize: 14, // キャラの頭上に並べるときの一辺 (px)
  },

  // ----- フィールド (src/render.js) -----
  field: {
    grid: 'rgba(255,255,255,0.045)',                         // マス目の線
    cursor: 'rgba(255,255,255,0.35)', cursorAiming: 'rgba(255,255,255,0.9)', travel: 'rgba(128,222,234,0.5)',
    aim: '255,255,255', aimRange: 'rgba(255,255,255,0.5)',   // 自分のスキルの範囲 ('r,g,b') / メテオの届く範囲
    hazardCount: '#ffccbc',                                  // 予告の「あと N」
    gate: '100,220,255', gateLabel: '#80deea',               // 門 ('r,g,b') と行き先の名前
    door: '255,204,128', doorLabel: '#ffe0b2',               // 建物の入口 ('r,g,b') と建物の名前
    bonfire: { glow: 'rgba(255,152,0,0.25)', log: '#5d4030', flame: '#ff9800', core: '#ffe082' },
    chest: '#5d4030', lootEdge: 'rgba(0,0,0,0.7)',           // 落とし物 (宝箱の地・素材の縁)
  },

  // ----- キャラ (主人公・敵・仲間・NPC) -----
  unit: {
    shadow: 'rgba(0,0,0,0.3)', hitFlash: '#ffffff', edge: 'rgba(0,0,0,0.6)', glyph: 'rgba(0,0,0,0.75)',
    heroEdge: '#e1f5fe', weapon: '#e0f7fa', eyes: '#fff', bossEyes: '#ffeb3b', bossRing: '#ffd54f', charge: '#ff7043',
    shadowShape: { dy: 0.7, rx: 1, ry: 0.45 }, // 足元の影の楕円 (大きさ r の何倍か。dy: 中心から下へのずれ)
    footRingPad: 6,                            // 絵のときの足元の輪の、影より大きい分 (px)
  },
  npc: { name: '#ffe082', quest: '#ffd54f', report: '#69f0ae', hint: '#fff', nearEdge: '#fff' }, // quest: 受けられる「!」 / report: 報告できる「?」

  // ----- 演出 (src/core.js の fx〇〇 が作る。描き方は src/render.js の EFFECT_TYPES) -----
  // life: 続く秒数 / ring: 広がる輪の色 ('r,g,b') / ringScale: 輪の広がり (大きさ r の何倍まで) / spark: 火花の色 / n: 火花の数 / speed: 火花の速さ (px/秒)
  fx: {
    particle: { life: [0.25, 0.55], size: [2, 4], minSpeed: 0.3, drag: 0.92 }, // 火花 1 つ (life・size はこの間でばらつく。速さは speed × minSpeed〜speed。drag: 毎フレームの減り方)
    hit: { ours: '#ff8a80', n: 5, critN: 10, speed: 160 },  // 当たったとき (主人公の陣営が受けたら ours、ほかは受けた側の色。会心は critN 個)
    death: { ring: '255,255,255', ringScale: 3, life: 0.4, n: 18, bossN: 60, speed: 220, bossSpeed: 380 }, // 倒れたとき (火花の色は倒れた側の色)
    levelUp: { ring: '255,213,79', ringScale: 5, life: 0.6, spark: '#ffd54f', n: 30, speed: 260 },
    buff: { ring: '255,138,101', ringScale: 3, life: 0.45, spark: '#ffab91', n: 16, speed: 180 }, // 自分を強化したとき
    heal: { spark: '#69f0ae', n: 14, speed: 140 },          // 回復薬
    spawn: { ringScale: 2.5, life: 0.3 },                   // 敵が湧いたとき (色は spawn)
    lob: { arcLife: 0.22, ringFrom: 0.3, ringPad: 0.5, ringLife: 0.4, n: 20, speed: 260 }, // 投げる技の着弾 (輪は半径 × ringFrom マスから 半径 + ringPad マスまで。色は陣営の faction)
    bolt: { life: 0.16 },   // 弾の線
    slash: { life: 0.3 },   // 技の範囲のマスが光る
    bump: { life: 0.25 },   // 移動でぶつかって殴ったマスが光る
    ghost: { life: 0.25 },  // ダッシュの残像
  },

  // ----- メッセージ欄の文の色 (文は data/text.js。logMsg(文, 色) の色) -----
  // 拾った素材・装備はレア度の色 (data/items.js)、道具を使った文は最初に効いた効果の浮かぶ文字の色
  msg: {
    normal: '#c9d1d9',    // 色を指定しないとき
    refuse: '#9da7b3',    // できなかった (進めない・覚えていない・再使用待ち・MP 不足・道具が効かない・話しかける人がいない) / 強化が切れた
    charge: '#ffab40',    // 予告ありの技を構えた
    skill: '#80d8ff',     // 主人公が技を出した
    buff: '#ffab91',      // 自分を強化した
    miss: '#9e9e9e',      // ミス
    hurt: '#ff8a80',      // 主人公の陣営が受けたダメージ
    crit: '#ffab40',      // 会心 (主人公の陣営以外が受けた)
    hit: '#e6edf3',       // ダメージ (主人公の陣営以外が受けた)
    heroDown: '#ff5252',  // 主人公が倒れた
    allyDown: '#ff8a80',  // 主人公の陣営のほかのキャラが倒れた
    defeated: '#b39ddb',  // 敵を倒した
    levelUp: '#ffd54f',
    zone: '#80deea',      // ゾーンに入った
    bagFull: '#ff8a80',   // 持ち物がいっぱいで拾えない
    alert: '#ffab40',     // 敵に気づかれて歩くのをやめた
  },
  // ----- 頭の上に浮かぶ文字の色と大きさ (px。文は data/text.js) -----
  float: {
    damage: { hurt: '#ff5252', crit: '#ffab40', hit: '#ffffff', size: 17, critSize: 24 }, // ダメージの数 (主人公の陣営が受けた / 会心 / ほか。会心は critSize)
    miss: { color: '#9e9e9e', size: 15 },
    invuln: { color: '#80deea', size: 15 },  // 帰還中の敵に当たった「無効」
    buff: { size: 17 },                      // 強化・弱体 (色はその強化の色 data/buffs.js)
    exp: { color: '#b39ddb', size: 14 },
    material: { size: 14 },                  // 拾った素材 (色はレア度)
    item: { size: 16 },                      // 拾った装備 (色はレア度)
    healHp: { color: '#69f0ae', size: 18 },  // 道具で HP 回復
    healMp: { size: 18 },                    // 道具で MP 回復 (色は mp)
  },
};

// キャラの種類ごとの描き方 (src/render.js の drawUnit)。種類 (unitKind): hero 主人公 / enemy 敵 / boss ボス / ally 主人公の陣営のほかのキャラ / npc 町の人
//   絵 (sprite) のありか: 主人公は data/player.js、敵・ボス・仲間はその種類 (data/enemies.js など)、NPC は world.js の NPC の sprite
//   footRing : 絵のときの足元の輪 { color ('own' ならキャラの色), width, nearOnly (主人公のとなりにいるときだけ) }。なければ描かない
//   絵がないときの形の部品 (描く順): weapon (武器の線の色) / ears (耳) / 丸い体 (縁は edge、となりにいるときは nearEdge) / eyes (目の色) / bodyRing (体の輪の色) / glyph (字。glyphPx: 字の大きさ。省略時は r と同じ)
//   overlays : 体の上に描くもの (描く順。src/render.js の UNIT_OVERLAYS の名前): buffs 強化のアイコン / hpBar 頭上の HP バー / level レベル / charge 構えの「!」 / name 名前 / questMark クエストの「!」「?」 / talkHint 話しかける案内
//   buffLift : 強化のアイコンを頭 (絵の上端か体の上端) からどれだけ上に出すか (px) / hp, hpReturn: 頭上の HP バーの色 (ふつう / 帰還中)
//   onTile, r, shadow: 描く位置を持たないキャラ (NPC) はいるマスの中心に、大きさ r (px)、影 { dy, rx, ry } (px) で描く
//   nameLift / markLift / hintDrop: 名前・クエストの印を頭から上へ / 話しかける案内を中心から下へ (px)
const ENEMY_OVERLAYS = ['buffs', 'hpBar', 'level', 'charge'];
const UNIT_LOOK = {
  hero: { footRing: { color: 'own', width: 2.5 }, weapon: THEME.unit.weapon, edge: THEME.unit.heroEdge, overlays: ['buffs'], buffLift: 4 },
  enemy: { ears: true, eyes: THEME.unit.eyes, glyph: true, edge: THEME.unit.edge, overlays: ENEMY_OVERLAYS, buffLift: 14, hp: THEME.bars.enemyHp, hpReturn: THEME.bars.returnHp },
  boss: {
    footRing: { color: THEME.unit.bossRing, width: 3 }, ears: true, eyes: THEME.unit.bossEyes, bodyRing: THEME.unit.bossRing, glyph: true, edge: THEME.unit.edge,
    overlays: ENEMY_OVERLAYS, buffLift: 14, hp: THEME.bars.enemyHp, hpReturn: THEME.bars.returnHp,
  },
  ally: { ears: true, eyes: THEME.unit.eyes, glyph: true, edge: THEME.unit.edge, overlays: ENEMY_OVERLAYS, buffLift: 14, hp: THEME.allyHp, hpReturn: THEME.allyHp },
  npc: {
    onTile: true, r: 15, shadow: { dy: 11, rx: 15, ry: 6 }, footRing: { color: THEME.npc.nearEdge, width: 2.5, nearOnly: true },
    glyph: true, glyphPx: 16, edge: THEME.unit.edge, nearEdge: THEME.npc.nearEdge,
    overlays: ['name', 'questMark', 'talkHint'], nameLift: 12, markLift: 33, hintDrop: 32,
  },
};

// キャラの絵の描き方 (絵のありかは上の UNIT_LOOK の説明)
const UNIT_SPRITE = {
  scale: 3.8,     // 絵の高さ (と幅) = radius × これ。足元は影の中心にそろえる
  turnDeadZone: 0.15, // 向きの左右成分 (cos) がこれより小さいときは反転を変えない (上下に動くたびにちらつかないように)
};
