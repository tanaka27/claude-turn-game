// ステータスの計算 (主人公・敵・装備・強化との関係)
'use strict';
const assert = require('assert');
const { newGame, arena, plain, applyBuff } = require('./helpers');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} ${a} != ${b}`);
const testItem = (slot, stats) => ({ id: `t-${slot}`, slot, name: 'テスト品', rarity: 'common', level: 1, stats });

test('deriveStats: 主人公の Lv1 (装備なし)', () => {
  const g = newGame();
  const st = plain(g.deriveStats({ ...g.PLAYER.stats }, []));
  assert.deepStrictEqual(st, {
    maxHp: 20, maxMp: 12, str: 10, vit: 4, agi: 20, int: 10, luk: 20, critMult: 1.6, hpRegen: 0.05, mpRegen: 0.2,
    atk: 10, def: 4, speed: 100, skillHaste: 0, mdef: 5, critRate: 0.1,
  });
});

test('deriveStats: 装備の値は計算で決まるステータスにも直接足される', () => {
  const g = newGame();
  const st = g.deriveStats({ ...g.PLAYER.stats }, [{ atk: 3, str: 2, agi: 5 }, { luk: 200 }]);
  near(st.atk, 15); // ちから 12 + 3
  near(st.speed, 110); // すばやさ 25
  near(st.critRate, 1); // 上限 1
});

test('主人公の Lv1: はじめの装備 (木の剣・布の服) あり', () => {
  const g = newGame();
  const st = plain(g.player.stats);
  assert.strictEqual(st.maxHp, 21);
  assert.strictEqual(st.atk, 11);
  assert.strictEqual(st.def, 5);
  assert.strictEqual(st.speed, 100);
  assert.strictEqual(st.mdef, 5);
  near(st.critRate, 0.1);
});

test('装備を外す・付けるとステータスが変わる', () => {
  const g = newGame();
  const p = g.player;
  g.unequipItem(p.equip.weapon);
  g.unequipItem(p.equip.armor);
  assert.strictEqual(p.stats.atk, 10);
  assert.strictEqual(p.stats.def, 4);
  assert.strictEqual(p.stats.maxHp, 20);
  const ring = testItem('accessory', { agi: 10, luk: 20 });
  p.inventory.push(ring);
  g.equipItem(ring);
  assert.strictEqual(p.stats.speed, 120);
  near(p.stats.critRate, 0.2);
  assert.strictEqual(p.equip.accessory, ring);
});

test('強化の倍率は装備の分には掛からない', () => {
  const g = newGame();
  const p = g.player;
  const sword = testItem('weapon', { atk: 10 });
  p.inventory.push(sword);
  g.equipItem(sword);
  assert.strictEqual(p.stats.atk, 20);
  applyBuff(g, p, 'atkUp', 6);
  // 装備なしのこうげき力 10 × 1.3 + 装備 10 (装備ごと × 1.3 なら 26)
  near(p.stats.atk, 23);
  // ちから +5 の装備: ちから由来のこうげき力 +5 も装備の分 (倍率なし)
  const ring = testItem('accessory', { str: 5 });
  p.inventory.push(ring);
  g.equipItem(ring);
  near(p.stats.atk, 28);
});

// 敵のステータス: 主人公と同じ式 + 湧き場所のレベルの補正 (params.js の enemyLevel)
const enemyCases = [
  ['wolf', 1, { maxHp: 9, maxMp: 0, atk: 4.6, def: 4, speed: 110, mdef: 2.5, critRate: 0.05 }],
  ['wolf', 5, { maxHp: 14, maxMp: 0, atk: 7.728, def: 7.2, speed: 118, mdef: 6.04, critRate: 0.05 }],
  ['boar', 1, { maxHp: 16, maxMp: 6, atk: 5.6, def: 6, speed: 95, mdef: 2.5 }],
  ['boar', 5, { maxHp: 26, maxMp: 8, atk: 9.408, def: 9.2, speed: 103, mdef: 6.04 }],
  ['golem', 1, { maxHp: 39, maxMp: 12, atk: 7.1, def: 14, speed: 70, mdef: 3.5 }],
  ['golem', 7, { maxHp: 74, maxMp: 19, atk: 14.342, def: 18.8, speed: 82, mdef: 8.81 }],
];
for (const [type, level, want] of enemyCases) {
  test(`敵のステータス: ${type} Lv${level}`, () => {
    const g = newGame();
    const [e] = arena(g, { cols: 12, rows: 12, player: [2, 2], enemies: [{ type, at: [9, 9], level }] });
    assert.strictEqual(e.level, level);
    for (const k in want) near(e.stats[k], want[k], `${type} Lv${level} ${k}`);
    assert.strictEqual(e.hp, e.stats.maxHp);
    assert.strictEqual(e.mp, e.stats.maxMp);
  });
}

test('敵のステータスは params.js の enemyLevel の式どおりに伸びる', () => {
  const g = newGame();
  const EL = g.PARAMS.enemyLevel, base = g.ENEMIES.boar.stats, L = 4;
  const [e] = arena(g, { cols: 12, rows: 12, enemies: [{ type: 'boar', at: [9, 9], level: L }] });
  const k = L - 1;
  assert.strictEqual(e.stats.maxHp, Math.round(base.maxHp * (1 + EL.hpGrowth * k)));
  assert.strictEqual(e.stats.maxMp, Math.round(base.maxMp * (1 + EL.mpGrowth * k)));
  near(e.stats.atk, base.str * (1 + EL.strGrowth * k));
  near(e.stats.def, base.vit + EL.vitGrowth * k);
  near(e.stats.speed, 100 + (base.agi + EL.agiGrowth * k - 20) * 2);
});
