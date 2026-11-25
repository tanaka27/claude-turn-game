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

test('物理で殴ると、筋力・器用さ が 与えたダメージ / 相手の最大HP × 倍率 だけ小数で伸びる (敵レベルの補正なし)', () => {
  const { g, p, e } = withWolf();
  g.rng.force(0.99, 0.5); // 会心なし
  const hp0 = e.hp, str0 = p.stats.str;
  step(g, 1, 0);
  assert.ok(!e.dead && e.hp < hp0, '当たって生きている');
  assert.strictEqual(p.stats.str, str0, '一の位に届くまで戦いの値は変わらない');
  const f = (hp0 - e.hp) / e.stats.maxHp, ev = growthOf(g).events.dealPhysical;
  near(grown(g, 'mus'), f * ev.mus, '筋力');
  near(grown(g, 'dex'), f * ev.dex, '器用さ');
});

test('ちから = 筋力 × 0.7 + 器用さ × 0.3 (筋力のほうが効く)。会心を出すと 器用さ が伸びる', () => {
  const { g, p, e } = withWolf();
  assert.strictEqual(g.deriveStats({ ...g.PLAYER.stats }, []).str, 10, '筋力 10・器用さ 10');
  const at = (mus, dex) => g.deriveStats({ ...g.PLAYER.stats, mus, dex }, []).str;
  near(at(20, 10), 17);
  near(at(10, 20), 13);
  g.rng.force(0.0, 0.5); // 会心
  const dex0 = p.base.dex;
  g.dealDamage(p, e, { name: 'x', power: 1 }, 'x');
  assert.ok(p.base.dex - dex0 >= growthOf(g).events.critHit.dex - 1e-9, '会心の分だけは伸びる');
});

test('みのまもり = 筋力 × 0.32 + 器用さ × 0.08 (8:2)。しゅび力 = みのまもり + 装備。みのまもり は行動では直接伸びない', () => {
  const g = newGame();
  const p = g.player;
  assert.strictEqual(p.stats.vit, 4, '筋力 10・器用さ 10 で 3.2 + 0.8');
  assert.strictEqual(p.stats.def, p.stats.vit + (p.equip.armor ? p.equip.armor.stats.def || 0 : 0) + (p.equip.weapon ? p.equip.weapon.stats.def || 0 : 0) + (p.equip.accessory ? p.equip.accessory.stats.def || 0 : 0));
  const at = (mus, dex) => g.deriveStats({ ...g.PLAYER.stats, mus, dex }, []).vit;
  near(at(20, 10), 7.2);
  near(at(10, 20), 4.8);
  assert.ok(!('vit' in g.PLAYER.stats) && !('vit' in growthOf(g).stats), '伸びる値・潜在を持たない');
  for (const [ev, gains] of Object.entries(growthOf(g).events)) assert.ok(!('vit' in gains), `${ev} に みのまもり がある`);
});

test('潜在が高いほど多く伸びる (潜在 / 100 倍)', () => {
  const { g, p } = withWolf();
  p.potential.spi = 200;
  g.growthEvent(p, 'castMagic', 5);
  g.growthEvent(p, 'spendMp', 5);
  near(grown(g, 'spi'), 5 * growthOf(g).events.spendMp.spi * 2);
  near(grown(g, 'mag'), 5 * growthOf(g).events.castMagic.mag);
});

test('一の位が上がるとステータスが 1 上がり、潜在が × (1 − drop) に下がる。残りは下がった潜在で伸びる', () => {
  const { g, p } = withWolf();
  const S = growthOf(g).stats.mus, base0 = p.base.mus, atk0 = p.stats.atk;
  const d1 = 1 - S.drop;
  // 潜在 100 で 1 → 潜在 100×d1 で 1 → 残り 0.5 を潜在 100×d1² で
  const up = g.trainStat(p, 'mus', 1 + 1 / d1 + 0.5);
  assert.strictEqual(up, 2);
  near(p.base.mus, base0 + 2 + 0.5 * d1 * d1);
  near(p.stats.atk, atk0 + 2 * 0.7, 'ステータスはすぐ計算し直す (筋力は一の位まで。ちから は 筋力 × 0.7)');
  near(p.potential.mus, 100 * d1 * d1);
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

test('さいだいMP = 魔力 + (知力 + 精神力) ÷ 3 (切り捨て)。魔力は 1 で +1、知力・精神力は 3 つで +1', () => {
  const { g, p } = withWolf();
  assert.strictEqual(p.stats.maxMp, 12, '魔力 4 + (知力 10 + 精神力 14) ÷ 3');
  g.trainStat(p, 'mag', 1);
  assert.strictEqual(p.stats.maxMp, 13, '魔力 5');
  const set = (b) => { Object.assign(p.base, b); g.refreshStats(p); };
  set({ spi: 16 });
  assert.strictEqual(p.stats.maxMp, 13, '5 + 26 ÷ 3 = 13.67 → 13');
  set({ int: 11 });
  assert.strictEqual(p.stats.maxMp, 14, '5 + 27 ÷ 3 = 14');
});

test('知力 は今は行動で伸びない (どの出来事にも入っていない)', () => {
  const G = growthOf(newGame());
  for (const [ev, gains] of Object.entries(G.events)) assert.ok(!('int' in gains), `${ev} に知力がある`);
});

test('物理のダメージを受けると 体力・意思 と、わずかに 筋力 が伸びる', () => {
  const { g, p, e } = withWolf();
  g.rng.force(0.99, 0.5);
  const hp0 = p.hp, max = p.stats.maxHp;
  g.dealDamage(e, p, enemyAttack(e, '噛みつき'), '噛みつき');
  assert.ok(p.hp < hp0, '当たる');
  const ev = growthOf(g).events.takePhysical, f = (hp0 - p.hp) / max;
  near(grown(g, 'mus'), f * ev.mus, '筋力');
  assert.ok(ev.mus < growthOf(g).events.dealPhysical.mus, '与えたときより伸びにくい');
  assert.strictEqual(grown(g, 'dex'), 0, '器用さ は伸びない');
  assert.ok(f * ev.con < 1, '一の位をまたがない量 (またぐと潜在が下がって比べられない)');
  near(grown(g, 'con'), f * ev.con, '体力');
  near(grown(g, 'will'), f * ev.will, '意思');
});

test('スキルで MP を使うと 精神力 が伸びる。術でないスキルでは 魔力 は伸びない', () => {
  const { g, p } = withWolf();
  const sk = skillById(g, 'shockwave');
  assert.ok(useSkillBy(g, p, sk, 5, 1), '使える');
  near(grown(g, 'spi'), sk.mp * growthOf(g).events.spendMp.spi);
  assert.strictEqual(grown(g, 'mag'), 0);
  assert.strictEqual(grown(g, 'int'), 0);
});

test('術のスキル (メテオ) を使うと 魔力 が 使った MP × 倍率 だけ伸びる (精神力 も伸びる)', () => {
  const { g, p } = withWolf();
  const sk = skillById(g, 'meteor');
  assert.strictEqual(sk.kind, 'magic');
  g.teachSkill(p, 'meteor');
  assert.ok(useSkillBy(g, p, sk, 8, 5), '使える');
  near(grown(g, 'mag'), sk.mp * growthOf(g).events.castMagic.mag);
  near(grown(g, 'spi'), sk.mp * growthOf(g).events.spendMp.spi);
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
  p.potential.mus = P.max - 3;
  levelUp(g);
  assert.strictEqual(p.potential.mus, P.max);
  assert.strictEqual(p.potential.int, 100 + P.levelUp);
  assert.deepStrictEqual({ ...p.base }, base0);
});

test('潜在のうち decayFloor を超えた分は時間で下がる。decayFloor 以下は下がらない', () => {
  const g = newGame();
  const p = g.player, P = growthOf(g).potential;
  p.potential.mus = 150;
  p.potential.agi = 80;
  passTime(g, 100);
  near(p.potential.mus, P.decayFloor + (150 - P.decayFloor) * Math.pow(1 - P.decayRate, 100));
  assert.strictEqual(p.potential.agi, 80);
});
