// =====================================================================
//  ステータスの表示名と表示のしかた
//  装備の性能・持ち物の画面 (つよさ)・HUD のステータス欄で使う。並び順が HUD・つよさの並び順になる
// =====================================================================
//
//   label  : 表示名
//   pct    : true なら % で表示する (装備の性能は小数 1 桁)
//   dec    : 小数点以下の桁数 (装備の性能。値の丸めにも使う)
//   hud    : HUD のステータス欄での表示 (dec: 桁数 / prefix・suffix: 前後に付ける文字)。省略すると HUD に出さない
// =====================================================================

const STATS = {
  maxHp: { label: 'さいだいHP', dec: 0 },
  str: { label: 'ちから', dec: 0, hud: { dec: 0 } },
  vit: { label: 'みのまもり', dec: 0, hud: { dec: 0 } },
  agi: { label: 'すばやさ', dec: 0, hud: { dec: 0 } },
  int: { label: 'かしこさ', dec: 0, hud: { dec: 0 } },
  luk: { label: 'うんのよさ', dec: 0, hud: { dec: 0 } },
  atk: { label: 'こうげき力', dec: 0, hud: { dec: 0 } },
  def: { label: 'しゅび力', dec: 0, hud: { dec: 0 } },
  mdef: { label: '術防御', dec: 0, hud: { dec: 0 } },
  speed: { label: '速度', dec: 0, hud: { dec: 0 } },
  skillHaste: { label: 'スキル加速', dec: 0 },
  critRate: { label: '会心率', pct: true, hud: { dec: 0 } },
  critMult: { label: '会心倍率', dec: 2 },
  hpRegen: { label: 'HP再生', dec: 2 },
};
