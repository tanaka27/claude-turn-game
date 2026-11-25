// =====================================================================
//  スキル (技) の定義。主人公 (と仲間) が覚えて使う技
//  ここに書くのは「技そのもの」だけ。だれが覚えているか・どのキーに置くか・いつ覚えるかは書かない
//    覚え方 (はじめの決まり: レベルで覚える) とスキル欄の並び (キー) は data/player.js (learnAtLevel / skillSlots)
//  敵の技は data/enemies.js の attacks に直接書く (書き方は下と同じ)
// =====================================================================
//
// 【攻撃(技)の定義】 距離・範囲はマス、時間はターン (行動回数)
//   id     : スキルの名前 (英字)。覚えたスキル・スキル欄・再使用待ちはこれで指す。セーブにも残るので変えない
//            (変えるときはセーブの版を上げて古い id を直す。docs/save-versions.md)
//   type   : 'melee'      … 自分のまわりの範囲に判定
//            'projectile' … まっすぐ飛ぶ弾 (壁で止まる。pierce でなければ最初に当たった相手で止まる)
//            'lob'        … 指定したマスへ投げ、着弾したマスのまわりに範囲判定 (壁を越える)
//            'dash'       … 移動スキル
//            'buff'       … 自分を強化する (狙わずにキーを押したらすぐ使う)。buff: data/buffs.js の強化 / duration: 続く行動回数
//   shape  : melee の判定形状 'fan'(扇形) / 'circle'(自分中心の円) / 'line'(直線)
//   range  : 射程(マス)。fan/circle は半径、line/projectile は長さ。となりのマスだけなら 1.5 (斜めを含む)
//   angle  : fan の角度(度)
//   width  : line / projectile の幅(マス)。1 で 1 列
//   charge : 0 なら使ったその場で判定する。1 なら予告 (予測範囲) を出し、使った者の次の行動で判定する
//            (その間に範囲の外へ出れば当たらない。速いほど逃げる時間がある)
//   cooldown: 再使用までの行動回数 (主人公は自分の行動回数、敵はその敵の行動回数で数える)
//   mp     : 技が使う MP (主人公も敵も)。足りないと使えない (省略時 0)
//   kind   : 'physical' … 物理 (省略時)。こうげき力としゅび力で計算 (params.js のダメージ計算式)
//            'magic'    … 術。術攻撃力と術防御で計算 (params.js の術のダメージ計算式)
//   power  : 物理の威力倍率
//   base   : 術の固定ダメージ / matkRate : 術の術攻撃力の効き (省略時は params.js の magic.matkRate)
//   pierce : true なら弾が貫通
//   count / spread : 同時発射数 / 拡散角度(度)
//   castRange / radius / scatter : lob の最大射程 / 着弾範囲の半径 / 複数弾の散らばり (どれもマス)
// =====================================================================

// スキルは、キーを押すと狙う範囲を表示し、マウスで狙ってクリック (または同じキー / Enter) で使う
const SKILLS = [
  {
    id: 'shockwave', name: '衝撃波', type: 'projectile',
    range: 9, width: 1, cooldown: 5, mp: 3, power: 1.4, pierce: true,
  },
  {
    id: 'whirlwind', name: '旋風斬', type: 'melee', shape: 'circle',
    range: 2.3, cooldown: 6, mp: 4, power: 1.6,
  },
  {
    id: 'meteor', name: 'メテオ', type: 'lob', kind: 'magic',
    castRange: 8, radius: 2.3, cooldown: 10, mp: 8, base: 6,
  },
  {
    id: 'dash', name: 'ダッシュ', type: 'dash',
    distance: 4, cooldown: 6, mp: 2,
  },
  {
    id: 'battleAura', name: '闘気', type: 'buff',
    buff: 'atkUp', duration: 6, cooldown: 12, mp: 4,
  },
];
