// =====================================================================
//  ワールド定義 (ゾーンの地形・門・湧き場所)
//  強さや時間などの調整用の数値は params.js、マップの配置はこのファイルに置く。
// =====================================================================
//
// 【座標】
//   位置と大きさは px で書く。1 マス = 40px。読み込むときにマスに直す
//     点 (x, y)      : その点を含むマス
//     範囲 (x, y, w, h): いちばん近いマスの境目にそろえる (最低 1 マス)。40 の倍数で書くと見た目どおりになる
//
// 【ゾーンの定義】
//   name      : 表示名
//   w, h      : 大きさ(px)。40 の倍数にする。外周の壁 (厚さ 1 マス) は自動で付く
//   safe      : true ならゾーン全体が安全地帯 (敵は追ってこない)
//   respawn   : 復活地点 (かがり火)。倒れたら WORLD.respawnZone のこの地点に戻る
//   theme     : 地面の色 (ground: 下地 / tile: 市松模様 / decor: 小石の色 2 つ)
//   obstacles : [種類, x, y, 幅, 高さ]。種類は下の terrain のキー
//   gates     : 別のゾーンへの門。id / 範囲(x, y, w, h) / to: 行き先のゾーン / toGate: 行き先の門の id
//               spawn: この門から入ってきたときに立つ位置 (門の範囲の外に置く)
//   camps     : 敵の湧き場所。name / 中心(x, y) / level: 敵レベル / respawn: 再出現までのターン数 /
//               spread: 湧く範囲の半径(px) / members: 敵 (モンスター) の種類 (data/enemies.js の ENEMIES のキー)
//   npcs      : 話しかけられる人 (NPC)。id / name / glyph: 体に書く字 / color / x, y / role: 'shop'(店) / 'quest'(クエスト)
//               NPC のマスは通れない。となりのマスから話しかける (NPC のマスへ移動しようとしても話しかける)
//
// 【地形の種類 (terrain)】
//   blocksShots : true なら移動も攻撃も遮る。false なら移動だけを遮る
//   minimap     : ミニマップでの色
//   colors      : 描くときの色 (どこに使うかは種類ごとに決まっている)
// =====================================================================

const WORLD = {
  start: 'town',       // はじめから遊ぶときのゾーン
  respawnZone: 'town', // 倒れたときに戻るゾーン

  terrain: {
    wall: { name: '壁', blocksShots: true, minimap: '#5a6272', colors: { base: '#3b4250', top: '#4b5363', edge: '#1b1f27' } },
    tree: { name: '木', blocksShots: true, minimap: '#5a6272', colors: { dark: '#16301d', mid: '#21452a', light: '#2e5c37' } },
    house: { name: '家', blocksShots: true, minimap: '#5a6272',
      colors: { wall: '#4a3f35', roof: '#7b3f32', door: '#2b231d', window: '#ffcc80', edge: '#1b1f27' } },
    water: { name: '水場', blocksShots: false, minimap: '#1d4f73', colors: { base: '#1d4f73', edge: '#2f6f99', wave: 'rgba(160,220,255,0.25)' } },
    fence: { name: '柵', blocksShots: false, minimap: '#7a5640', colors: { rail: '#5d4030', post: '#7a5640' } },
  },

  zones: {
    // ------------------------------------------------------------------
    town: {
      name: '始まりの町', w: 1600, h: 1200, safe: true,
      respawn: { x: 800, y: 720 },
      theme: { ground: '#2a2722', tile: '#2e2b25', decor: ['#3a352d', '#34302a'] },
      obstacles: [
        ['house', 160, 160, 240, 160], ['house', 1200, 160, 240, 160],
        ['house', 160, 860, 240, 180], ['house', 1180, 860, 220, 180],
        ['house', 640, 140, 320, 140],
        ['water', 720, 480, 160, 120],
        ['fence', 420, 640, 160, 26], ['fence', 1020, 640, 160, 26],
        ['tree', 520, 940, 70, 70], ['tree', 1010, 960, 70, 70],
      ],
      gates: [
        { id: 'east', x: 1500, y: 520, w: 60, h: 160, to: 'plains', toGate: 'south', spawn: { x: 1430, y: 600 } },
      ],
      camps: [],
      npcs: [
        { id: 'merchant', name: '商人', glyph: '商', color: '#ffb300', x: 560, y: 760, role: 'shop' },
        { id: 'captain', name: '衛兵隊長', glyph: '衛', color: '#90a4ae', x: 1040, y: 760, role: 'quest' },
      ],
    },

    // ------------------------------------------------------------------
    plains: {
      name: '風の草原', w: 2400, h: 1600,
      theme: { ground: '#1b261f', tile: '#1e2b23', decor: ['#2a3a2e', '#22302a'] },
      obstacles: [
        // L字の壁
        ['wall', 560, 300, 40, 360], ['wall', 560, 300, 240, 40],
        ['wall', 1800, 300, 40, 360], ['wall', 1600, 300, 240, 40],
        ['wall', 560, 940, 40, 360], ['wall', 560, 1260, 240, 40],
        ['wall', 1800, 940, 40, 360], ['wall', 1600, 1260, 240, 40],
        // 中央の柱・北の壁・岩
        ['wall', 1140, 740, 120, 120], ['wall', 1100, 200, 200, 40],
        ['wall', 300, 780, 80, 80], ['wall', 2020, 740, 80, 80],
        ['wall', 880, 760, 50, 50], ['wall', 1470, 790, 50, 50],
        // 柵・水場
        ['fence', 850, 560, 160, 26], ['fence', 1390, 560, 160, 26],
        ['fence', 850, 1014, 160, 26], ['fence', 1390, 1014, 160, 26],
        ['water', 240, 240, 170, 120], ['water', 1990, 1240, 170, 120],
        ['water', 1950, 260, 120, 90], ['water', 330, 1250, 120, 90],
      ],
      gates: [
        { id: 'south', x: 1120, y: 1500, w: 160, h: 60, to: 'town', toGate: 'east', spawn: { x: 1200, y: 1430 } },
        { id: 'north', x: 1120, y: 40, w: 160, h: 60, to: 'forest', toGate: 'south', spawn: { x: 1200, y: 160 } },
      ],
      camps: [
        { name: '東の草むら', x: 1600, y: 1130, level: 1, respawn: 60, spread: 60, members: ['wolf', 'wolf', 'wolf'] },
        { name: '西の草むら', x: 800, y: 1130, level: 1, respawn: 60, spread: 60, members: ['wolf', 'wolf', 'bee'] },
        { name: '西の岩場', x: 300, y: 1050, level: 2, respawn: 66, spread: 70, members: ['boar', 'wolf', 'bee'] },
        { name: '東の水辺', x: 2150, y: 1050, level: 3, respawn: 66, spread: 70, members: ['boar', 'bee', 'salamander'] },
        { name: '中央広場', x: 1200, y: 640, level: 4, respawn: 75, spread: 70, members: ['wolf', 'wolf', 'salamander', 'salamander'] },
        { name: '北西の泉', x: 330, y: 560, level: 5, respawn: 75, spread: 70, members: ['boar', 'boar', 'bee'] },
        { name: '北東の泉', x: 2080, y: 560, level: 5, respawn: 75, spread: 70, members: ['wolf', 'bee', 'salamander'] },
        { name: '狼王の丘', x: 2230, y: 170, level: 6, respawn: 300, spread: 0, members: ['wolfKing'] },
      ],
    },

    // ------------------------------------------------------------------
    forest: {
      name: '黒き森', w: 2400, h: 1600,
      theme: { ground: '#141f19', tile: '#16231c', decor: ['#22352a', '#1c2c23'] },
      obstacles: [
        ['tree', 120, 1400, 100, 100], ['tree', 380, 1150, 90, 90], ['tree', 900, 1450, 80, 80],
        ['tree', 1450, 1420, 90, 90], ['tree', 2150, 1400, 120, 100], ['tree', 2200, 1050, 100, 90],
        ['tree', 1500, 1050, 80, 80], ['tree', 850, 1000, 80, 80], ['tree', 650, 850, 70, 70],
        ['tree', 1600, 700, 90, 90], ['tree', 120, 400, 100, 140], ['tree', 500, 150, 100, 90],
        ['tree', 1400, 250, 90, 90], ['tree', 1750, 200, 100, 100], ['tree', 2200, 250, 100, 120],
        ['tree', 1250, 480, 60, 60],
        ['water', 1850, 950, 180, 110], ['water', 980, 640, 100, 70],
      ],
      gates: [
        { id: 'south', x: 1120, y: 1500, w: 160, h: 60, to: 'plains', toGate: 'north', spawn: { x: 1200, y: 1430 } },
        { id: 'north', x: 1120, y: 40, w: 160, h: 60, to: 'ruins', toGate: 'south', spawn: { x: 1200, y: 170 } },
      ],
      camps: [
        { name: '森の入口', x: 700, y: 1250, level: 6, respawn: 80, spread: 70, members: ['golem', 'wolf', 'wolf'] },
        { name: '蜂の巣の森', x: 1750, y: 1250, level: 6, respawn: 80, spread: 70, members: ['bee', 'bee', 'boar'] },
        { name: '苔むす広場', x: 1200, y: 850, level: 7, respawn: 90, spread: 70, members: ['golem', 'salamander', 'salamander'] },
        { name: '西の沼', x: 400, y: 700, level: 7, respawn: 90, spread: 70, members: ['boar', 'boar', 'salamander'] },
        { name: '東の茂み', x: 2000, y: 650, level: 8, respawn: 100, spread: 70, members: ['golem', 'golem', 'bee'] },
        { name: '古木の下', x: 900, y: 350, level: 8, respawn: 100, spread: 70, members: ['boar', 'golem', 'salamander'] },
        { name: '森の主の根元', x: 230, y: 210, level: 9, respawn: 300, spread: 0, members: ['treant'] },
      ],
    },

    // ------------------------------------------------------------------
    ruins: {
      name: '魔竜の遺跡', w: 1600, h: 1200,
      theme: { ground: '#1d1b24', tile: '#211e29', decor: ['#2d2936', '#26222e'] },
      obstacles: [
        // 玉座を囲む柱
        ['wall', 560, 160, 60, 60], ['wall', 980, 160, 60, 60],
        ['wall', 560, 420, 60, 60], ['wall', 980, 420, 60, 60],
        // 崩れた回廊
        ['wall', 200, 520, 320, 40], ['wall', 1080, 520, 320, 40],
        ['wall', 700, 700, 50, 50], ['wall', 850, 700, 50, 50],
        ['wall', 300, 1000, 60, 60], ['wall', 1240, 1000, 60, 60],
        ['water', 100, 150, 140, 120], ['water', 1360, 150, 140, 120],
      ],
      gates: [
        { id: 'south', x: 720, y: 1100, w: 160, h: 60, to: 'forest', toGate: 'north', spawn: { x: 800, y: 1030 } },
      ],
      camps: [
        { name: '崩れた西回廊', x: 350, y: 800, level: 9, respawn: 100, spread: 70, members: ['golem', 'bee', 'salamander'] },
        { name: '崩れた東回廊', x: 1250, y: 800, level: 9, respawn: 100, spread: 70, members: ['boar', 'boar', 'salamander'] },
        { name: '魔竜の巣', x: 800, y: 300, level: 10, respawn: 400, spread: 0, members: ['dragon'] },
      ],
    },
  },
};
