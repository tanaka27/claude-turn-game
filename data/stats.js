// =====================================================================
//  ステータスの表示名と表示のしかた
//  装備の性能・キャラクターの画面 (つよさ) で使う。並び順がつよさの並び順になる
// =====================================================================
//
//   label  : 表示名
//   pct    : true なら % で表示する (装備の性能は小数 1 桁)
//   dec    : 小数点以下の桁数 (装備の性能。値の丸めにも使う)
// =====================================================================

const STATS = {
  maxHp: { label: 'さいだいHP', dec: 0 },
  maxMp: { label: 'さいだいMP', dec: 0 },
  con: { label: '体力', dec: 0 },
  will: { label: '意思', dec: 0 },
  mag: { label: '魔力', dec: 0 },
  spi: { label: '精神力', dec: 0 },
  mus: { label: '筋力', dec: 0 },
  dex: { label: '器用さ', dec: 0 },
  str: { label: 'ちから', dec: 0 },
  vit: { label: 'みのまもり', dec: 0 },
  agi: { label: 'すばやさ', dec: 0 },
  int: { label: '知力', dec: 0 },
  luk: { label: 'うんのよさ', dec: 0 },
  atk: { label: 'こうげき力', dec: 0 },
  matk: { label: '術攻撃力', dec: 0 },
  def: { label: 'しゅび力', dec: 0 },
  mdef: { label: '術防御', dec: 0 },
  speed: { label: '速度', dec: 0 },
  reach: { label: '攻撃範囲', dec: 0 },      // 通常攻撃が 1 + この値 のマスまで届く (槍。docs/crafting.md)
  skillHaste: { label: 'スキル加速', dec: 0 },
  hit: { label: '命中', pct: true },
  eva: { label: '回避', pct: true },
  critRate: { label: '会心率', pct: true },
  critMult: { label: '会心倍率', dec: 2 },
  hpRegen: { label: 'HP再生', dec: 2 },
  mpRegen: { label: 'MP再生', dec: 2 },
};
