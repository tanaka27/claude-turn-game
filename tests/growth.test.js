// 行動によるステータスの伸び: 行動 → 能力値が小数点以下まで伸びる (潜在で増減)、一の位が上がるとステータスが上がって潜在が下がる、レベルアップで潜在が上がる、時間で潜在が下がる
'use strict';
const assert = require('assert');
const { newGame, arena, step, moveTo, passTime, levelUp, skillById, useSkillBy, enemyAttack } = require('./helpers');

const growthOf = (g) => g.PARAMS.progression.growth;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg || ''} ${a} ≠ ${b}`);

// Lv1 からの伸び (小数)
const grown = (g, k) => g.player.base[k] - g.PLAYER.stats[k];

function withWolf(seed = 1) {
  const g = newGame(seed);
  const [e] = arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type: 'wolf', at: [6, 5], level: 3 }] });
  return { g, p: g.player, e };
}

test('はじめの潜在は data/player.js の potential、伸びた値は Lv1 の値', () => {
  const g = newGame();
  const G = growthOf(g);
  assert.deepStrictEqual(Object.keys(g.player.potential).sort(), Object.keys(G.stats).sort());
  for (const k in G.stats) assert.strictEqual(g.player.potential[k], g.PLAYER.potential[k] || G.potential.base);
  for (const k in G.stats) assert.strictEqual(g.player.base[k], g.PLAYER.stats[k]);
  assert.ok(!('train' in g.player), '熟練度はない');
});

test('物理で殴ると、ちから が 与えたダメージ / 相手の最大HP × 倍率 だけ小数で伸びる (敵レベルの補正なし)', () => {
  const { g, p, e } = withWolf();
  g.rng.force(0.99, 0.5); // 会心なし
  const hp0 = e.hp;
  step(g, 1, 0);
  assert.ok(!e.dead && e.hp < hp0, '当たって生きている');
  assert.strictEqual(p.stats.str, g.PLAYER.stats.str, '一の位に届くまで戦いの値は変わらない');
  near(grown(g, 'str'), (hp0 - e.hp) / e.stats.maxHp * growthOf(g).events.dealPhysical.str);
});

test('潜在が高いほど多く伸びる (潜在 / 100 倍)', () => {
  const { g, p } = withWolf();
  p.potential.int = 200;
  g.growthEvent(p, 'spendMp', 5);
  const ev = growthOf(g).events.spendMp;
  near(grown(g, 'int'), 5 * ev.int * 2);
  near(grown(g, 'spi'), 5 * ev.spi);
});

test('一の位が上がるとステータスが 1 上がり、潜在が × (1 − drop) に下がる。残りは下がった潜在で伸びる', () => {
  const { g, p } = withWolf();
  const S = growthOf(g).stats.str, base0 = p.base.str, atk0 = p.stats.atk;
  const d1 = 1 - S.drop;
  // 潜在 100 で 1 → 潜在 100×d1 で 1 → 残り 0.5 を潜在 100×d1² で
  const up = g.trainStat(p, 'str', 1 + 1 / d1 + 0.5);
  assert.strictEqual(up, 2);
  near(p.base.str, base0 + 2 + 0.5 * d1 * d1);
  assert.strictEqual(p.stats.atk, atk0 + 2, 'ステータスはすぐ計算し直し、小数は切り捨て');
  near(p.potential.str, 100 * d1 * d1);
});

test('体力・意思 が上がると さいだいHP と今の HP も同じだけ増える。上限 max でちょうど止まる', () => {
  const { g, p } = withWolf();
  const S = growthOf(g).stats.con, max0 = p.stats.maxHp;
  p.hp = 10;
  g.trainStat(p, 'con', 1);
  assert.strictEqual(p.stats.maxHp, max0 + 1);
  assert.strictEqual(p.hp, 11);
  g.trainStat(p, 'will', 1);
  assert.strictEqual(p.stats.maxHp, max0 + 2);
  assert.strictEqual(p.hp, 12);
  p.base.con = S.max - 0.5;
  g.refreshStats(p);
  g.trainStat(p, 'con', 50);
  assert.strictEqual(p.base.con, S.max);
  assert.strictEqual(g.trainStat(p, 'con', 50), 0, '上限ではもう上がらない');
});

test('知力・精神力 が上がると さいだいMP = (知力 + 精神力) ÷ 2 (切り捨て) が増える', () => {
  const { g, p } = withWolf();
  const max0 = p.stats.maxMp; // 知力 10・精神力 14 で 12
  assert.strictEqual(max0, 12);
  g.trainStat(p, 'int', 1);
  assert.strictEqual(p.stats.maxMp, 12, '(11 + 14) ÷ 2 = 12.5 → 12');
  g.trainStat(p, 'spi', 1);
  assert.strictEqual(p.stats.maxMp, max0 + 1, '(11 + 15) ÷ 2 = 13');
});

test('物理のダメージを受けると みのまもり・体力・意思 が伸びる', () => {
  const { g, p, e } = withWolf();
  g.rng.force(0.99, 0.5);
  const hp0 = p.hp, max = p.stats.maxHp;
  g.dealDamage(e, p, enemyAttack(e, '噛みつき'), '噛みつき');
  assert.ok(p.hp < hp0, '当たる');
  const ev = growthOf(g).events.takePhysical, f = (hp0 - p.hp) / max;
  near(grown(g, 'vit'), f * ev.vit);
  assert.ok(f * ev.con < 1, '一の位をまたがない量 (またぐと潜在が下がって比べられない)');
  near(grown(g, 'con'), f * ev.con, '体力');
  near(grown(g, 'will'), f * ev.will, '意思');
});

test('スキルで MP を使うと 精神力 と 知力 が伸びる', () => {
  const { g, p } = withWolf();
  const sk = skillById(g, 'shockwave');
  assert.ok(useSkillBy(g, p, sk, 5, 1), '使える');
  const ev = growthOf(g).events.spendMp;
  near(grown(g, 'spi'), sk.mp * ev.spi);
  near(grown(g, 'int'), sk.mp * ev.int);
});

test('予告された技の範囲から、出るまでに逃げきると すばやさ が伸びる。逃げなければ伸びない', () => {
  const run = (escape) => {
    const g = newGame(3);
    const [b] = arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type: 'boar', at: [6, 5], level: 1 }] });
    const p = g.player;
    b.mp = 99;
    assert.ok(useSkillBy(g, b, enemyAttack(b, '角突き'), 5, 5), '構える');
    assert.ok(b.charging.threatened.includes(p), '予告の範囲にいる');
    if (escape) moveTo(g, p, 5, 8);
    g.rng.force(0.99, 0.5);
    g.releaseCharge(b);
    return g;
  };
  near(grown(run(true), 'agi'), growthOf(newGame()).events.dodge.agi);
  assert.strictEqual(grown(run(false), 'agi'), 0, '当たったらよけたことにならない');
});

test('敵は潜在を持たないので育たない', () => {
  const { g, p, e } = withWolf();
  const st = { ...e.baseStats };
  g.dealDamage(p, e, { name: 'x', power: 1 }, 'x');
  g.growthEvent(e, 'spendMp', 50);
  assert.ok(!e.potential && !e.base);
  assert.deepStrictEqual({ ...e.baseStats }, st);
});

test('レベルアップでは全部の潜在が levelUp 上がる (上限 max まで)。ステータスは上がらない', () => {
  const g = newGame();
  const p = g.player, P = growthOf(g).potential, base0 = { ...p.base };
  p.potential.str = P.max - 3;
  levelUp(g);
  assert.strictEqual(p.potential.str, P.max);
  assert.strictEqual(p.potential.int, 100 + P.levelUp);
  assert.deepStrictEqual({ ...p.base }, base0);
});

test('潜在のうち decayFloor を超えた分は時間で下がる。decayFloor 以下は下がらない', () => {
  const g = newGame();
  const p = g.player, P = growthOf(g).potential;
  p.potential.str = 150;
  p.potential.vit = 80;
  passTime(g, 100);
  near(p.potential.str, P.decayFloor + (150 - P.decayFloor) * Math.pow(1 - P.decayRate, 100));
  assert.strictEqual(p.potential.vit, 80);
});
