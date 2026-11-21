// 主人公の行動 (移動・攻撃・待機・スキル・ダッシュ・回復薬)。キー入力の処理を通して試す
'use strict';
const assert = require('assert');
const { newGame, arena, step, wait, press, castAt, messages, skill, storedCooldown, bagOf, healRatio } = require('./helpers');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} ${a} != ${b}`);
function open(opts = {}) {
  const g = newGame();
  const es = arena(g, { cols: 15, rows: 15, player: [5, 7], ...opts });
  return { g, p: g.player, es };
}

test('移動: 1 マス動き、1 行動ぶん時間が進む。斜めも 1 歩', () => {
  const { g, p } = open();
  const t0 = g.game.time;
  step(g, 1, 0);
  assert.deepStrictEqual([p.tx, p.ty], [6, 7]);
  step(g, 1, 1);
  assert.deepStrictEqual([p.tx, p.ty], [7, 8]);
  near(g.game.time, t0 + 2);
});

test('移動: 壁・水場には入れず、時間も進まない。斜めに角をすり抜けられない', () => {
  const { g, p } = open({ walls: [[6, 7, 1, 1]], water: [[5, 6, 1, 1]] });
  const t0 = g.game.time;
  step(g, 1, 0);
  step(g, 0, -1);
  step(g, 1, -1); // (6,7) と (5,6) がふさがっている
  assert.deepStrictEqual([p.tx, p.ty], [5, 7]);
  assert.strictEqual(g.game.time, t0);
});

test('待機: その場で 1 行動ぶん時間が進む', () => {
  const { g, p } = open();
  const t0 = g.game.time;
  wait(g, 3);
  assert.deepStrictEqual([p.tx, p.ty], [5, 7]);
  near(g.game.time, t0 + 3);
});

test('敵のいるマスへ動くと攻撃する (動かない)', () => {
  const { g, p, es: [e] } = open({ enemies: [{ type: 'golem', at: [6, 7] }] });
  g.rng.force(0.99, 0.5);
  step(g, 1, 0);
  assert.deepStrictEqual([p.tx, p.ty], [5, 7]);
  assert.strictEqual(e.hp, e.stats.maxHp - 2);
});

test('スキル: MP を使い、再使用待ちになる', () => {
  const { g, p, es: [e] } = open({ enemies: [{ type: 'golem', at: [9, 7] }] });
  const sk = skill(g, '1');
  p.mp = 10; p.lastHurt = g.game.time; // 休息の回復を入れない
  g.rng.force(0.99, 0.5);
  castAt(g, '1', 9, 7);
  near(p.mp, 10 - sk.mp + p.stats.mpRegen * 1);
  assert.strictEqual(storedCooldown(g, p, sk), sk.cooldown - 1);
  // (5.5 − 3.5) × 1.4 = 2.8 → 3
  assert.strictEqual(e.hp, e.stats.maxHp - 3);
});

test('スキル: MP が足りないと構えられず、時間も進まない', () => {
  const { g, p } = open();
  p.mp = 2.9; // 表示は 2 (衝撃波は 3)
  const t0 = g.game.time;
  castAt(g, '1', 9, 7);
  assert.strictEqual(g.aiming, null);
  assert.strictEqual(storedCooldown(g, p, skill(g, '1')), 0);
  assert.strictEqual(p.mp, 2.9);
  assert.strictEqual(g.game.time, t0);
  assert.ok(messages(g).some((m) => m.includes('MP が足りない')));
});

test('スキル: 再使用待ちの間は使えない', () => {
  const { g, p } = open();
  castAt(g, '1', 9, 7);
  const mp = p.mp, t = g.game.time;
  castAt(g, '1', 9, 7);
  assert.strictEqual(p.mp, mp);
  assert.strictEqual(g.game.time, t);
});

test('スキル: 解放レベルに届いていないと構えられない', () => {
  const { g } = open();
  castAt(g, '2', 7, 7); // 旋風斬は Lv3
  assert.strictEqual(g.aiming, null);
  assert.ok(messages(g).some((m) => m.includes('Lv3')));
});

test('ダッシュ: 狙った向きへ 4 マス進む。壁・敵の手前で止まる', () => {
  const a = open();
  castAt(a.g, '4', 12, 7);
  assert.deepStrictEqual([a.p.tx, a.p.ty], [9, 7]);

  const b = open({ walls: [[8, 7, 1, 1]] });
  castAt(b.g, '4', 12, 7);
  assert.deepStrictEqual([b.p.tx, b.p.ty], [7, 7]);

  const c = open({ enemies: [{ type: 'golem', at: [7, 7] }] });
  castAt(c.g, '4', 12, 7);
  assert.deepStrictEqual([c.p.tx, c.p.ty], [6, 7]);

  // 斜め (8 方向にそろえる)
  const d = open();
  castAt(d.g, '4', 9, 12);
  assert.deepStrictEqual([d.p.tx, d.p.ty], [9, 11]);
});

test('ダッシュ: 1 マスも進めないときは行動にならない (MP も再使用待ちもそのまま)', () => {
  const { g, p } = open({ walls: [[6, 7, 1, 1]] });
  const mp = p.mp, t = g.game.time;
  castAt(g, '4', 12, 7);
  assert.deepStrictEqual([p.tx, p.ty], [5, 7]);
  assert.strictEqual(p.mp, mp);
  assert.strictEqual(storedCooldown(g, p, skill(g, '4')), 0);
  assert.strictEqual(g.game.time, t);
});

test('回復薬: 最大 HP の 4 割回復して 1 つ減る (1 行動)。満タンなら使わない', () => {
  const { g, p } = open();
  p.lastHurt = g.game.time;
  p.hp = 5;
  const heal = Math.round(p.stats.maxHp * healRatio(g, 'potion'));
  press(g, 'r');
  near(p.hp, 5 + heal + p.stats.hpRegen);
  assert.strictEqual(bagOf(p).potion, 2);
  p.hp = p.stats.maxHp;
  const t = g.game.time;
  press(g, 'r');
  assert.strictEqual(bagOf(p).potion, 2);
  assert.strictEqual(g.game.time, t);
  // 持っていない上回復薬
  p.hp = 5;
  press(g, 't');
  assert.strictEqual(p.hp, 5);
});
