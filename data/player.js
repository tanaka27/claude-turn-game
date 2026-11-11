// =====================================================================
//  主人公の定義 (初期ステータス・通常攻撃・スキルの覚え方とスキル欄・最初の装備)
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
// 【攻撃(技)の定義】 スキルの定義と書き方の説明は data/skills.js (敵の技 data/enemies.js も同じ書き方)
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
  // スキル (技の定義は data/skills.js。ここでは id で指す)
  // スキルの覚え方 (はじめの決まり): このレベルになると自動で覚える { スキルの id: レベル }。はじめから遊ぶときは Lv1 のものを覚えている
  //   ほかの覚え方 (師匠・道具など) を足すときも、覚えさせるのは src/units.js の teachSkill だけ
  learnAtLevel: { shockwave: 1, whirlwind: 3, meteor: 6, dash: 1, battleAura: 1 },
  // スキル欄 (はじめの並び): どのキーにどのスキルを置くか。並びが画面下のスキル欄の並び。覚えていないスキルは暗く出る
  skillSlots: [
    { key: '1', skill: 'shockwave' },
    { key: '2', skill: 'whirlwind' },
    { key: '3', skill: 'meteor' },
    { key: '4', skill: 'dash' },
    { key: '5', skill: 'battleAura' },
  ],
  // はじめから遊ぶときの装備 (部位: { level, rarity }。null は何も付けない)
  startEquip: {
    weapon: { level: 1, rarity: 'common' },
    armor: { level: 1, rarity: 'common' },
    accessory: null,
  },
};
