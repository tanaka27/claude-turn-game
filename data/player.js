// =====================================================================
//  主人公の定義 (初期ステータス・通常攻撃・スキル・最初の装備)
// =====================================================================
//
// 【ステータスの意味】(主人公はドラクエ風。敵も同じステータスを持ち、同じ式で計算する。data/enemies.js)
//   レベルアップで上がる (上がり方は params.js の progression.growth):
//     maxHp       : さいだいHP
//     maxMp       : さいだいMP。スキルを使うと減る (スキルごとの mp)
//     str         : ちから。こうげき力のもと
//     vit         : みのまもり。しゅび力のもと
//     agi         : すばやさ。速度を決める
//     int         : かしこさ。術のダメージ・術防御・スキル加速を決める
//   レベルアップでは上がらない (装備でだけ変わる):
//     luk         : うんのよさ。会心率を決める
//     critMult    : 会心時のダメージ倍率
//     hpRegen     : 1 ターンごとの HP 回復量
//     mpRegen     : 1 ターンごとの MP 回復量
//   上の値から計算する (式は params.js の derivedStats。ここには書かない):
//     atk         : こうげき力 = ちから + 装備。ダメージの基礎値
//     def         : しゅび力 = みのまもり + 装備。物理の被ダメージを軽減
//     mdef        : 術防御 = かしこさ × 0.5 + 装備。術の被ダメージを軽減
//     speed       : 速度 (100 が基準)。行動 1 回にかかる時間 = 100 / speed ターン。
//                   速いほど、敵が 1 回動く間に何回も動ける
//     skillHaste  : スキル加速。スキルの再使用ターン数 = 基本 × 100 / (100 + skillHaste)
//     critRate    : 会心率 (0〜1)
//
// 【攻撃(技)の定義】 距離・範囲はマス、時間はターン (行動回数)
//   type   : 'melee'      … 自分のまわりの範囲に判定
//            'projectile' … まっすぐ飛ぶ弾 (壁で止まる。pierce でなければ最初に当たった相手で止まる)
//            'lob'        … 指定したマスへ投げ、着弾したマスのまわりに範囲判定 (壁を越える)
//            'dash'       … 移動スキル
//   shape  : melee の判定形状 'fan'(扇形) / 'circle'(自分中心の円) / 'line'(直線)
//   range  : 射程(マス)。fan/circle は半径、line/projectile は長さ。となりのマスだけなら 1.5 (斜めを含む)
//   angle  : fan の角度(度)
//   width  : line / projectile の幅(マス)。1 で 1 列
//   charge : 0 なら使ったその場で判定する。1 なら予告 (予測範囲) を出し、使った者の次の行動で判定する
//            (その間に範囲の外へ出れば当たらない。速いほど逃げる時間がある)
//   cooldown: 再使用までの行動回数 (主人公は自分の行動回数、敵はその敵の行動回数で数える)
//   mp     : 技が使う MP (主人公も敵も)。足りないと使えない (省略時 0)
//   kind   : 'physical' … 物理 (省略時)。こうげき力としゅび力で計算 (params.js のダメージ計算式)
//            'magic'    … 術。かしこさと術防御で計算 (params.js の術のダメージ計算式)
//   power  : 物理の威力倍率
//   base   : 術の固定ダメージ / intRate : 術のかしこさの効き (省略時は params.js の magic.intRate)
//   pierce : true なら弾が貫通
//   count / spread : 同時発射数 / 拡散角度(度)
//   castRange / radius / scatter : lob の最大射程 / 着弾範囲の半径 / 複数弾の散らばり (どれもマス)
// =====================================================================

const PLAYER = {
  name: '剣士',
  // 絵 (右向きの透明 PNG。左を向くと左右反転。高さは radius × data/theme.js の UNIT_SPRITE.scale)。読み込めないと丸と剣の線で描く
  sprite: 'assets/sprites/player.png',
  // 顔の絵 (正方形の PNG。左上の HUD とキャラクターの画面に出す)。読み込めないと名前の 1 文字目で代わりにする
  face: 'assets/portraits/player.png',
  radius: 15,
  color: '#4fc3f7',
  // Lv1 の値
  stats: {
    maxHp: 20,
    maxMp: 12,
    str: 10,
    vit: 4,
    agi: 20,
    int: 10,
    luk: 20,
    critMult: 1.6,
    hpRegen: 0.05,
    mpRegen: 0.2,
  },
  // 通常攻撃: 敵のいるマスへ移動しようとすると、その敵を攻撃する (体当たり)
  basicAttack: { name: '斬撃', power: 1.0 },
  // スキル: キーを押すと狙う範囲を表示し、マウスで狙ってクリック (または同じキー / Enter) で使う
  //   unlockLevel: このレベルになると使えるようになる
  skills: [
    {
      key: '1', label: '1', name: '衝撃波', type: 'projectile', unlockLevel: 1,
      range: 9, width: 1, cooldown: 5, mp: 3, power: 1.4, pierce: true,
    },
    {
      key: '2', label: '2', name: '旋風斬', type: 'melee', shape: 'circle', unlockLevel: 3,
      range: 2.3, cooldown: 6, mp: 4, power: 1.6,
    },
    {
      key: '3', label: '3', name: 'メテオ', type: 'lob', kind: 'magic', unlockLevel: 6,
      castRange: 8, radius: 2.3, cooldown: 10, mp: 8, base: 6,
    },
    {
      key: '4', label: '4', name: 'ダッシュ', type: 'dash', unlockLevel: 1,
      distance: 4, cooldown: 6, mp: 2,
    },
  ],
  // はじめから遊ぶときの装備 (部位: { level, rarity }。null は何も付けない)
  startEquip: {
    weapon: { level: 1, rarity: 'common' },
    armor: { level: 1, rarity: 'common' },
    accessory: null,
  },
};
