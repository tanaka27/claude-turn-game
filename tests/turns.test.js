// ターンの進み方 (速度による行動順) と、時間で進むもの
'use strict';
const assert = require('assert');
const { newGame, arena, traceTurns, setNextAction, setPlayerBase, wait, press, castAt, livingEnemies, lootsOnGround, messages } = require('./helpers');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} ${a} != ${b}`);

test('速いほど多く行動する (主人公 100・ウルフ 110・ゴーレム 70)', () => {
  const g = newGame();
  const [wolf, golem] = arena(g, { cols: 30, rows: 15, player: [2, 7],
    enemies: [{ type: 'wolf', at: [25, 3] }, { type: 'golem', at: [25, 11] }] });
  const tr = traceTurns(g);
  const t0 = g.game.time;
  wait(g, 100);
  tr.stop();
  const count = (u) => tr.filter((x) => x.who === u).length;
  assert.strictEqual(count('player'), 100);
  near(g.game.time, t0 + 100, '速度 100 の主人公は 1 行動 1 ターン');
  assert.ok(Math.abs(count(wolf) - 110) <= 1, `ウルフ ${count(wolf)}`);
  assert.ok(Math.abs(count(golem) - 70) <= 1, `ゴーレム ${count(golem)}`);
});

test('主人公の行動にかかる時間は 100 / 速度', () => {
  const g = newGame();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  setPlayerBase(g, { agi: 45 }); // 速度 150
  assert.strictEqual(g.player.stats.speed, 150);
  const t0 = g.game.time;
  wait(g, 3);
  near(g.game.time, t0 + 3 * 100 / 150);
});

test('同じ時刻なら主人公が先に行動する', () => {
  const g = newGame();
  const [wolf] = arena(g, { cols: 30, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [25, 7] }] });
  setPlayerBase(g, { agi: 25 }); // ウルフと同じ速度 110
  assert.strictEqual(g.player.stats.speed, wolf.stats.speed);
  setNextAction(g, wolf, g.game.time);
  const tr = traceTurns(g);
  wait(g, 5);
  tr.stop();
  assert.deepStrictEqual(tr.map((x) => (x.who === 'player' ? 'P' : 'E')), ['P', 'E', 'P', 'E', 'P', 'E', 'P', 'E', 'P', 'E']);
  for (let i = 0; i < tr.length; i += 2) assert.strictEqual(tr[i].t, tr[i + 1].t, '同じ時刻で主人公が先');
});

test('HP・MP の回復: HP再生・MP再生と、休息 (攻撃を受けずに 8 ターン) の追加分', () => {
  const g = newGame();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  const p = g.player, PG = g.PARAMS.progression;
  p.hp = 10; p.mp = 0;
  wait(g);
  near(p.hp, 10 + p.stats.hpRegen + p.stats.maxHp * PG.restRegenRate);
  near(p.mp, 0 + p.stats.mpRegen + p.stats.maxMp * PG.restMpRegenRate);
  // 攻撃を受けたばかり (休息ではない)
  p.hp = 10; p.mp = 0; p.lastHurt = g.game.time;
  wait(g);
  near(p.hp, 10 + p.stats.hpRegen);
  near(p.mp, p.stats.mpRegen);
});

test('敵の MP も時間で回復する', () => {
  const g = newGame();
  const [boar] = arena(g, { cols: 30, rows: 15, player: [2, 7], enemies: [{ type: 'boar', at: [25, 7] }] });
  boar.mp = 0;
  wait(g, 5);
  near(boar.mp, 5 * boar.stats.mpRegen);
  wait(g, 100);
  assert.strictEqual(boar.mp, boar.stats.maxMp);
});

test('スキルの再使用待ちは主人公の行動ごとに 1 減る (使った行動でも 1 減る)', () => {
  const g = newGame();
  arena(g, { cols: 15, rows: 15, player: [2, 7] });
  const sk = g.SKILLS.find((s) => s.key === '1');
  castAt(g, '1', 8, 7);
  assert.strictEqual(g.player.skillCd['1'], sk.cooldown - 1);
  press(g, '1');
  assert.strictEqual(g.aiming, null, '再使用待ちの間は構えられない');
  assert.ok(messages(g).some((m) => m.includes(`あと ${sk.cooldown - 1} 行動`)));
  wait(g, sk.cooldown - 2);
  assert.strictEqual(g.player.skillCd['1'], 1);
  wait(g);
  assert.strictEqual(g.player.skillCd['1'], 0);
  press(g, '1');
  assert.strictEqual(g.aiming && g.aiming.key, '1');
});

test('湧き場所: 倒した敵は respawn ターン後に出現予告を挟んで湧き直す', () => {
  const g = newGame();
  const [wolf] = arena(g, { cols: 20, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [10, 7], respawn: 10 }] });
  wolf.hp = 1;
  g.rng.force(0.99); // 会心なし
  castAt(g, '1', 10, 7);
  assert.ok(wolf.dead);
  let n = 1;
  while (livingEnemies(g).length === 0 && n < 100) { wait(g); n++; }
  // 今の動き: 行動 1 回 = 1 ターン。respawn 10 ターンが切れたターンに予告が始まり、その同じターンの分も
  // 予告 (spawnTelegraph 2) に数えるので、倒した行動を含めて 11 行動目で湧く
  assert.strictEqual(n, 11);
  const e = livingEnemies(g)[0];
  assert.deepStrictEqual([e.tx, e.ty], [10, 7]);
  assert.strictEqual(e.hp, e.stats.maxHp);
});

test('湧き場所: 主人公が近く (7 マス未満) にいるうちは湧かない', () => {
  const g = newGame();
  const [wolf] = arena(g, { cols: 20, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [8, 7], respawn: 5 }] });
  wolf.hp = 1;
  g.rng.force(0.99);
  castAt(g, '1', 8, 7);
  assert.ok(wolf.dead);
  wait(g, 30);
  assert.strictEqual(livingEnemies(g).length, 0);
});

test('落とし物は lootLife ターンで消える', () => {
  const g = newGame();
  const [wolf] = arena(g, { cols: 20, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [10, 7] }] });
  wolf.hp = 1;
  g.rng.force(0.99);
  castAt(g, '1', 10, 7);
  assert.ok(lootsOnGround(g) >= 1, '毛皮を落とす');
  const life = g.PARAMS.economy.lootLife;
  wait(g, life - 2); // 倒した行動 + (life − 2) = life − 1 ターン
  assert.ok(lootsOnGround(g) >= 1);
  wait(g);
  assert.strictEqual(lootsOnGround(g), 0);
});
