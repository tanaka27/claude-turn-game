// =====================================================================
//  NPC (町の人) の種類ごとのステータス
//  NPC の配置 (名前・位置・役目) は world.js の npcs。そこに kind: このファイルのキー を書く。
// =====================================================================
//
// label : 種類の表示名 (NPC にマウスを乗せたときに出す)
// stats : 主人公と同じステータス (意味は data/player.js の【ステータスの意味】)
//   con / will / mag / spi / mus / dex / agi / int / luk / critMult / hpRegen / mpRegen
//   さいだいHP (体力 + 意思)・さいだいMP (魔力 + (知力 + 精神力) ÷ 3)・ちから (筋力 × 0.7 + 器用さ × 0.3)・みのまもり (筋力 × 0.32 + 器用さ × 0.08) も計算で決まるので書かない
//   (みのまもり は、前に書いていた値との差を gear の vit に入れてある)
//   こうげき力・しゅび力・術防御・速度・スキル加速・会心率は、主人公と同じ式 (params.js の derivedStats) で計算する
// gear  : 装備のかわりに足す値 (主人公の装備と同じく、計算で決まるステータスに直接足す)。省略可
//
// ※ 今は NPC に攻撃は当たらない (攻撃が当たるのは相手の陣営のキャラだけで、NPC はどの陣営にも入っていない)
// =====================================================================

const NPC_KINDS = {
  merchant: {
    label: '商人',
    stats: { con: 15, will: 15, mag: 3.67, spi: 0, mus: 6, dex: 6, agi: 18, int: 22, luk: 40, critMult: 1.5, hpRegen: 0, mpRegen: 0.2 },
    gear: { vit: 3.6 },
  },
  smith: {
    label: '鍛冶屋',
    stats: { con: 40, will: 40, mag: 2.34, spi: 0, mus: 32, dex: 32, agi: 14, int: 14, luk: 20, critMult: 1.6, hpRegen: 0, mpRegen: 0.1 },
    gear: { vit: 5.2, atk: 10, def: 8 },
  },
  guard: {
    label: '衛兵',
    stats: { con: 70, will: 70, mag: 7, spi: 19, mus: 36, dex: 36, agi: 30, int: 20, luk: 24, critMult: 1.7, hpRegen: 0, mpRegen: 0.3 },
    gear: { vit: 7.6, atk: 14, def: 16, mdef: 6 },
  },
  clerk: {
    label: 'ギルドの職員',
    stats: { con: 20, will: 20, mag: 10, spi: 20, mus: 8, dex: 8, agi: 24, int: 40, luk: 30, critMult: 1.5, hpRegen: 0, mpRegen: 0.4 },
    gear: { vit: 4.8 },
  },
  adventurer: {
    label: '冒険者',
    stats: { con: 35, will: 35, mag: 8, spi: 24, mus: 22, dex: 22, agi: 34, int: 24, luk: 26, critMult: 1.6, hpRegen: 0, mpRegen: 0.3 },
    gear: { vit: 1.2, atk: 8, def: 6, mdef: 2 },
  },
};
