// =====================================================================
//  NPC (町の人) の種類ごとのステータス
//  NPC の配置 (名前・位置・役目) は world.js の npcs。そこに kind: このファイルのキー を書く。
// =====================================================================
//
// label : 種類の表示名 (NPC にマウスを乗せたときに出す)
// stats : 主人公と同じステータス (意味は data/player.js の【ステータスの意味】)
//   con / will / wis / spi / str / vit / agi / int / luk / critMult / hpRegen / mpRegen
//   さいだいHP (体力 + 意思)・さいだいMP ((知力 + 精神力) ÷ 2) も計算で決まるので書かない
//   こうげき力・しゅび力・術防御・速度・スキル加速・会心率は、主人公と同じ式 (params.js の derivedStats) で計算する
// gear  : 装備のかわりに足す値 (主人公の装備と同じく、計算で決まるステータスに直接足す)。省略可
//
// ※ 今は NPC に攻撃は当たらない (攻撃が当たるのは相手の陣営のキャラだけで、NPC はどの陣営にも入っていない)
// =====================================================================

const NPC_KINDS = {
  merchant: {
    label: '商人',
    stats: { con: 15, will: 15, wis: 10, spi: 10, str: 6, vit: 6, agi: 18, int: 22, luk: 40, critMult: 1.5, hpRegen: 0, mpRegen: 0.2 },
  },
  smith: {
    label: '鍛冶屋',
    stats: { con: 40, will: 40, wis: 6, spi: 6, str: 32, vit: 18, agi: 14, int: 14, luk: 20, critMult: 1.6, hpRegen: 0, mpRegen: 0.1 },
    gear: { atk: 10, def: 8 },
  },
  guard: {
    label: '衛兵',
    stats: { con: 70, will: 70, wis: 20, spi: 20, str: 36, vit: 22, agi: 30, int: 20, luk: 24, critMult: 1.7, hpRegen: 0, mpRegen: 0.3 },
    gear: { atk: 14, def: 16, mdef: 6 },
  },
  clerk: {
    label: 'ギルドの職員',
    stats: { con: 20, will: 20, wis: 30, spi: 30, str: 8, vit: 8, agi: 24, int: 40, luk: 30, critMult: 1.5, hpRegen: 0, mpRegen: 0.4 },
  },
  adventurer: {
    label: '冒険者',
    stats: { con: 35, will: 35, wis: 24, spi: 24, str: 22, vit: 10, agi: 34, int: 24, luk: 26, critMult: 1.6, hpRegen: 0, mpRegen: 0.3 },
    gear: { atk: 8, def: 6, mdef: 2 },
  },
};
