// 強化 (バフ): 闘気 (攻撃力アップ)
'use strict';
const assert = require('assert');
const { newGame, arena, applyBuff, buffsOf, press, wait, runFrames, keyOf, storedCooldown } = require('./helpers');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} ${a} != ${b}`);
const BUFFED = 10 * 1.3 + 1; // 装備なしのこうげき力 10 × 1.3 + 木の剣 1
const PLAIN = 11;

function safeArena() {
  const g = newGame();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  return g;
}
// 強化が切れるまでに何回行動したか (max まで)
function actionsUntilExpired(g, max = 30) {
  for (let n = 1; n <= max; n++) {
    wait(g);
    if (g.player.stats.atk === PLAIN) return n;
  }
  return Infinity;
}

test('闘気: こうげき力が上がり、MP と再使用待ちがかかる', () => {
  const g = safeArena();
  const p = g.player, sk = g.SKILLS.find((s) => s.type === 'buff');
  const mp0 = p.mp, t0 = g.game.time;
  press(g, keyOf(g, sk));
  near(p.stats.atk, BUFFED);
  assert.deepStrictEqual(buffsOf(p), [{ id: 'atkUp' }]);
  // 使った行動の終わりに MP の回復も入る (休息中)
  assert.ok(p.mp < mp0 - sk.mp + 1 && p.mp >= mp0 - sk.mp, `mp ${p.mp}`);
  assert.strictEqual(g.game.time, t0 + 1, '1 行動ぶん時間が進む');
  // 再使用待ちは使った行動の終わりに 1 減っている
  assert.strictEqual(storedCooldown(g, p, sk), sk.cooldown - 1);
});

test('闘気: かけた行動では減らず、そのあと duration 回の行動で切れる', () => {
  const g = safeArena();
  const sk = g.SKILLS.find((s) => s.type === 'buff');
  press(g, keyOf(g, sk));
  assert.strictEqual(actionsUntilExpired(g), sk.duration);
  near(g.player.stats.atk, PLAIN);
  assert.deepStrictEqual(buffsOf(g.player), []);
});

test('同じ強化をかけ直すと、残りの長いほうになる', () => {
  const g = safeArena();
  const p = g.player;
  applyBuff(g, p, 'atkUp', 6);
  wait(g, 2); // かけた分の 1 回 (減らない) + 1 回 → 残り 5
  applyBuff(g, p, 'atkUp', 3); // 短いのでは縮まない (残り 5 のまま、かけ直した行動では減らない)
  assert.strictEqual(buffsOf(p).length, 1, '重ねがけしない');
  assert.strictEqual(actionsUntilExpired(g), 6);

  applyBuff(g, p, 'atkUp', 2);
  wait(g); // 残り 2
  applyBuff(g, p, 'atkUp', 8); // 長いほうになる
  assert.strictEqual(actionsUntilExpired(g), 9);
});

test('倒れて復活すると強化は消え、ステータスが戻る', () => {
  const g = newGame();
  const p = g.player;
  const [w] = arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type: 'wolf', at: [6, 5], level: 5 }] });
  applyBuff(g, p, 'atkUp', 20);
  p.hp = 0.5;
  for (let i = 0; i < 20 && !p.dead; i++) wait(g);
  assert.ok(p.dead, 'ウルフにやられる');
  assert.strictEqual(g.game.state, 'dying');
  runFrames(g, 3);
  assert.strictEqual(g.game.state, 'play');
  assert.deepStrictEqual(buffsOf(p), []);
  near(p.stats.atk, PLAIN);
  assert.ok(w); // (使っていない)
});
