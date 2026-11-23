// 行動によるステータスの伸び: 行動 → 熟練度 (潜在で増減) → ステータス、上がると潜在が下がる、レベルアップで潜在が上がる、時間で潜在が下がる
'use strict';
const assert = require('assert');
const { newGame, arena, step, moveTo, passTime, levelUp, skillById, useSkillBy, enemyAttack } = require('./helpers');

const growthOf = (g) => g.PARAMS.progression.growth;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg || ''} ${a} ≠ ${b}`);

function withWolf(seed = 1) {
  const g = newGame(seed);
  const [e] = arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type: 'wolf', at: [6, 5], level: 3 }] });
  return { g, p: g.player, e };
}

test('はじめの潜在は data/player.js の potential、熟練度は空', () => {
  const g = newGame();
  const G = growthOf(g);
  assert.deepStrictEqual(Object.keys(g.player.potential).sort(), Object.keys(G.stats).sort());
  for (const k in G.stats) assert.strictEqual(g.player.potential[k], g.PLAYER.potential[k] || G.potential.base);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g.player.train)), {});
});

test('物理で殴ると、与えたダメージ / 相手の最大HP × 倍率 の熟練度が ちから に入る (敵レベルの補正なし)', () => {
  const { g, p, e } = withWolf();
  g.rng.force(0.99, 0.5); // 会心なし
  const hp0 = e.hp;
  step(g, 1, 0);
  assert.ok(!e.dead && e.hp < hp0, '当たって生きている');
  near(p.train.str, (hp0 - e.hp) / e.stats.maxHp * growthOf(g).events.dealPhysical.str);
});

test('潜在が高いほど熟練度が多く入る (潜在 / 100 倍)', () => {
  const { g, p } = withWolf();
  p.potential.int = 200;
  g.growthEvent(p, 'spendMp', 5);
  const ev = growthOf(g).events.spendMp;
  near(p.train.int, 5 * ev.int * 2);
  near(p.train.maxMp, 5 * ev.maxMp);
});

test('熟練度が cost に届くと step 上がり、潜在が × (1 − drop) に下がる。余りは持ち越す', () => {
  const { g, p } = withWolf();
  const S = growthOf(g).stats.str, base0 = p.base.str, atk0 = p.stats.atk;
  g.trainStat(p, 'str', S.cost * 2.5);
  assert.strictEqual(p.base.str, base0 + S.step * 2);
  assert.strictEqual(p.stats.atk, atk0 + S.step * 2, 'ステータスもすぐ計算し直す');
  near(p.potential.str, 100 * (1 - S.drop) * (1 - S.drop));
  near(p.train.str, S.cost * 0.5);
});

test('さいだいHP が上がると今の HP も同じだけ増える。上限 max で止まり、熟練度は 0 になる', () => {
  const { g, p } = withWolf();
  const S = growthOf(g).stats.maxHp;
  p.hp = 10;
  g.trainStat(p, 'maxHp', S.cost);
  assert.strictEqual(p.hp, 10 + S.step);
  p.base.maxHp = S.max - 1;
  g.refreshStats(p);
  g.trainStat(p, 'maxHp', S.cost * 5);
  assert.strictEqual(p.base.maxHp, S.max);
  assert.strictEqual(p.train.maxHp, 0);
  assert.strictEqual(g.trainStat(p, 'maxHp', S.cost * 5), 0, '上限ではもう上がらない');
});

test('物理のダメージを受けると みのまもり と さいだいHP に熟練度が入る', () => {
  const { g, p, e } = withWolf();
  g.rng.force(0.99, 0.5);
  const hp0 = p.hp, max = p.stats.maxHp;
  g.dealDamage(e, p, enemyAttack(e, '噛みつき'), '噛みつき');
  assert.ok(p.hp < hp0, '当たる');
  const ev = growthOf(g).events.takePhysical, f = (hp0 - p.hp) / max;
  near(p.train.vit, f * ev.vit);
  // さいだいHP は cost を超えると上がるので、上がった分も足して比べる
  const S = growthOf(g).stats.maxHp;
  near(p.train.maxHp + (p.base.maxHp - g.PLAYER.stats.maxHp) / S.step * S.cost, f * ev.maxHp, 'さいだいHP');
});

test('スキルで MP を使うと さいだいMP と かしこさ に熟練度が入る', () => {
  const { g, p } = withWolf();
  const sk = skillById(g, 'shockwave');
  assert.ok(useSkillBy(g, p, sk, 5, 1), '使える');
  const ev = growthOf(g).events.spendMp;
  near(p.train.maxMp, sk.mp * ev.maxMp);
  near(p.train.int, sk.mp * ev.int);
});

test('予告された技の範囲から、出るまでに逃げきると すばやさ に熟練度が入る。逃げなければ入らない', () => {
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
    return p;
  };
  near(run(true).train.agi, growthOf(newGame()).events.dodge.agi);
  assert.ok(!run(false).train.agi, '当たったらよけたことにならない');
});

test('敵は潜在を持たないので育たない', () => {
  const { g, p, e } = withWolf();
  const st = { ...e.baseStats };
  g.dealDamage(p, e, { name: 'x', power: 1 }, 'x');
  g.growthEvent(e, 'spendMp', 50);
  assert.ok(!e.potential && !e.train);
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
