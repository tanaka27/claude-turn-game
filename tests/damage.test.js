// ダメージ計算 (物理・会心・ミス・術)
'use strict';
const assert = require('assert');
const { newGame, arena, step, wait, castAt, isHostile, messages, setLevel } = require('./helpers');
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} ${a} != ${b}`);

// 主人公 (こうげき力 11) のとなりに敵を 1 体置く
function setup(type, level) {
  const g = newGame();
  const [e] = arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type, at: [6, 5], level }] });
  return { g, e };
}

test('物理: ふつうの当たり = (こうげき力 × 0.5 − しゅび力 × 0.25) × 威力 × 乱数', () => {
  const { g, e } = setup('golem', 1); // しゅび力 14 → (5.5 − 3.5) × 1 = 2
  g.rng.force(0.99, 0.5); // 会心なし、乱数のぶれ 0
  step(g, 1, 0);
  assert.strictEqual(e.hp, 39 - 2);
});

test('物理: 乱数のぶれは ±1/16', () => {
  const { g, e } = setup('wolf', 1); // (5.5 − 1) = 4.5
  g.rng.force(0.99, 0.0); // ぶれ −1/16 → 4.22 → 4
  step(g, 1, 0);
  assert.strictEqual(e.hp, 9 - 4);
});

test('物理: 会心は防御を無視する (こうげき力 × 0.5 × 会心倍率)', () => {
  const { g, e } = setup('golem', 1);
  g.rng.force(0.0, 0.5); // 会心 (会心率 0.1 未満)
  step(g, 1, 0);
  assert.strictEqual(e.hp, 39 - 9); // 11 × 0.5 × 1.6 = 8.8 → 9
});

test('物理: 基礎ダメージが 1 未満なら 0 (ミス) か 1。ミスでも待機中の敵は追ってくる', () => {
  // ゴーレム Lv7 (しゅび力 18.8): 5.5 − 4.7 = 0.8
  const a = setup('golem', 7);
  assert.ok(!isHostile(a.e));
  a.g.rng.force(0.99, 0.2); // randInt(0, 1) = 0
  step(a.g, 1, 0);
  assert.strictEqual(a.e.hp, 74);
  assert.ok(isHostile(a.e), 'ミスでも気づかれる');

  const b = setup('golem', 7);
  b.g.rng.force(0.99, 0.7); // randInt(0, 1) = 1
  step(b.g, 1, 0);
  assert.strictEqual(b.e.hp, 73);
});

test('術: (固定値 + 術攻撃力 × 0.8) × 50 / (50 + 術防御)。会心なし', () => {
  const g = newGame();
  const [e] = arena(g, { cols: 12, rows: 12, player: [3, 5], enemies: [{ type: 'golem', at: [6, 5], level: 7 }] });
  setLevel(g, 6); // メテオは Lv6 から
  const mp0 = g.player.mp;
  g.rng.force(0.5);
  castAt(g, '3', 6, 5);
  // 術攻撃力 = 知力 10 + 魔力 4 × 0.3 = 11.2。(6 + 11.2 × 0.8) × 50 / (50 + 8.81) = 12.7 → 13
  assert.strictEqual(e.hp, 74 - 13);
  assert.ok(g.player.mp < mp0 - 8 + 1, 'MP 8 を使う');
});

test('敵から主人公へ: ウルフ Lv1 の噛みつきは 1 (2.3 − 5 × 0.25 = 1.05)', () => {
  const { g } = setup('wolf', 1);
  const p = g.player;
  g.rng.constant(0.5); // 会心なし・ぶれなし・うろつかない
  for (let i = 0; i < 10 && !messages(g).some((m) => m.includes('ダメージを受けた')); i++) {
    p.hp = p.stats.maxHp;
    wait(g);
  }
  const line = messages(g).find((m) => m.includes('ダメージを受けた'));
  assert.ok(line, 'ウルフが噛みつく');
  assert.ok(line.includes(' 1 のダメージを受けた'), line);
  assert.ok(p.hp < p.stats.maxHp - 0.5, `hp ${p.hp}`);
});

test('術は会心にならない (乱数が小さくても同じダメージ)', () => {
  const g = newGame();
  const [e] = arena(g, { cols: 12, rows: 12, player: [3, 5], enemies: [{ type: 'golem', at: [6, 5], level: 7 }] });
  setLevel(g, 6);
  g.rng.force(0.5, 0.0, 0.0);
  castAt(g, '3', 6, 5);
  assert.strictEqual(e.hp, 74 - 13);
});

test('術攻撃力 = 知力 + 魔力 × 0.3 (知力のほうが効く)。魔力を伸ばすと術のダメージが増える', () => {
  const g = newGame();
  const at = (int, mag) => g.deriveStats({ ...g.PLAYER.stats, int, mag }, []).matk;
  assert.strictEqual(at(10, 4), 11.2);
  assert.strictEqual(at(20, 4), 21.2);
  assert.strictEqual(at(10, 14), 14.2);
  const [e] = arena(g, { cols: 12, rows: 12, player: [3, 5], enemies: [{ type: 'golem', at: [6, 5], level: 7 }] });
  setLevel(g, 6);
  g.player.base.mag = 24; // 術攻撃力 10 + 7.2 = 17.2
  g.refreshStats(g.player, 'clamp');
  g.player.mp = g.player.stats.maxMp;
  g.rng.force(0.5);
  castAt(g, '3', 6, 5);
  // (6 + 17.2 × 0.8) × 50 / (50 + 8.81) = 16.8 → 17
  assert.strictEqual(e.hp, 74 - 17);
});

test('術を使う敵の術攻撃力も 知力 + 魔力 × 0.3 (魔力 = 知力 × 0.4 なので 知力 × 1.12)', () => {
  const g = newGame();
  for (const type of ['salamander', 'treant', 'dragon']) {
    const s = g.ENEMIES[type].stats;
    near(g.deriveStats({ ...s }, []).matk, s.int * 1.12, type);
  }
});

