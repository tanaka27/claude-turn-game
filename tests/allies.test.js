// 主人公の陣営のほかのキャラ (仲間) がいても動くか: 戦うキャラの集まり (units)・行動順・敵の狙い・倒れたとき
// 今のゲームにはまだ仲間は出てこない。テストの中で addAlly で置く (行動の決め方は「何もしない」)
'use strict';
const assert = require('assert');
const {
  newGame, arena, addAlly, unitOn, targetOf, step, wait, traceTurns, isHostile, telegraphTiles, messages, livingEnemies,
} = require('./helpers');

// 主人公は壁の向こうの遠く (敵から見えない・届かない) に置く
const HIDE = { cols: 30, rows: 15, player: [27, 7], walls: [[22, 1, 1, 13]] };

test('仲間はマスをふさぐ: 主人公はそのマスへ動けず (攻撃もしない)、行動にもならない', () => {
  const g = newGame();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  const ally = addAlly(g, [6, 5]);
  assert.strictEqual(unitOn(g, 6, 5), ally);
  assert.ok(!g.isFree(6, 5));
  const t0 = g.game.time;
  step(g, 1, 0);
  assert.deepStrictEqual([g.player.tx, g.player.ty], [5, 5]);
  assert.strictEqual(ally.hp, ally.stats.maxHp);
  assert.strictEqual(g.game.time, t0, '行動にならない');
});

test('仲間も速度に応じて行動順に入る (主人公 100・仲間 150)', () => {
  const g = newGame();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  const ally = addAlly(g, [8, 8], { stats: { agi: 45 } });
  assert.strictEqual(ally.stats.speed, 150);
  const tr = traceTurns(g);
  wait(g, 100);
  tr.stop();
  const count = (u) => tr.filter((x) => x.who === u).length;
  assert.strictEqual(count('player'), 100);
  assert.ok(Math.abs(count(ally) - 150) <= 1, `仲間 ${count(ally)}`);
});

test('仲間と同じ時刻なら主人公が先に行動する', () => {
  const g = newGame();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  const ally = addAlly(g, [8, 8]);
  assert.strictEqual(ally.stats.speed, g.player.stats.speed);
  const tr = traceTurns(g);
  wait(g, 3);
  tr.stop();
  assert.deepStrictEqual(tr.map((x) => (x.who === 'player' ? 'P' : 'A')), ['P', 'A', 'P', 'A', 'P', 'A']);
});

test('仲間しか見えない敵は、仲間を狙って近づき、攻撃する', () => {
  const g = newGame();
  // 主人公は敵をはさんで仲間の反対側 (壁の向こう。下の端だけ通れる)。主人公への道をたどると仲間から離れてしまう
  const [wolf] = arena(g, { cols: 30, rows: 15, player: [2, 7], walls: [[7, 1, 1, 12]], enemies: [{ type: 'wolf', at: [18, 7] }] });
  const ally = addAlly(g, [24, 7], { name: 'テスト仲間', stats: { con: 200, will: 200 } });
  const d0 = Math.max(Math.abs(wolf.tx - ally.tx), Math.abs(wolf.ty - ally.ty));
  wait(g);
  assert.ok(isHostile(wolf), '気づく');
  assert.strictEqual(targetOf(wolf), ally);
  let n = 0;
  while (ally.hp === ally.stats.maxHp && n < 20) { wait(g); n++; }
  assert.ok(ally.hp < ally.stats.maxHp, '仲間がダメージを受ける');
  assert.ok(Math.max(Math.abs(wolf.tx - ally.tx), Math.abs(wolf.ty - ally.ty)) < d0, '近づいた');
  assert.strictEqual(g.player.hp, g.player.stats.maxHp, '主人公は無傷');
  // メッセージ欄には両方の名前が出る
  assert.ok(messages(g).some((m) => m.includes(wolf.name) && m.includes('テスト仲間')), messages(g).join(' / '));
});

test('予告の技の範囲に仲間が立っていれば当たる', () => {
  const g = newGame(3);
  const [boar] = arena(g, { ...HIDE, enemies: [{ type: 'boar', at: [8, 7] }] });
  const ally = addAlly(g, [11, 7], { stats: { con: 200, will: 200 } });
  let found = false;
  for (let i = 0; i < 80 && !found; i++) {
    ally.hp = ally.stats.maxHp;
    if (telegraphTiles(g).size) found = true; else wait(g);
  }
  assert.ok(found, '予告が出る');
  assert.ok(telegraphTiles(g).has(`${ally.tx},${ally.ty}`), '仲間のマスを狙う');
  const tr = traceTurns(g);
  const hp0 = ally.hp;
  let n = 0;
  while (telegraphTiles(g).size && n < 10) { wait(g); n++; }
  tr.stop();
  assert.ok(tr.some((x) => x.who === boar), 'イノシシが行動した');
  assert.ok(ally.hp < hp0 - 1, `当たる (${hp0} → ${ally.hp})`);
});

test('仲間が倒れても主人公は倒れたことにならず、経験値も入らない', () => {
  const g = newGame();
  const [wolf] = arena(g, { ...HIDE, enemies: [{ type: 'wolf', at: [10, 7], level: 5 }] });
  const ally = addAlly(g, [11, 7]);
  const p = g.player, exp0 = p.exp, gold0 = p.gold, kills0 = g.game.kills;
  ally.hp = 0.5;
  for (let i = 0; i < 20 && !ally.dead; i++) wait(g);
  assert.ok(ally.dead, '仲間が倒れる');
  assert.strictEqual(g.game.state, 'play');
  assert.ok(!p.dead);
  assert.strictEqual(p.exp, exp0);
  assert.strictEqual(p.gold, gold0);
  assert.strictEqual(g.game.kills, kills0);
  assert.ok(!wolf.dead);
  wait(g);
  assert.strictEqual(unitOn(g, 11, 7) === ally, false, 'もうマスをふさがない');
  assert.ok(messages(g).some((m) => m.includes('倒れた')));
});

test('仲間がいても、主人公が敵を倒せば経験値が入る', () => {
  const g = newGame();
  const [e] = arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type: 'wolf', at: [6, 5] }] });
  addAlly(g, [3, 3]);
  e.hp = 1;
  g.rng.force(0.99, 0.5); // 会心なし
  step(g, 1, 0);
  assert.ok(e.dead);
  assert.strictEqual(g.player.exp, 12);
  assert.strictEqual(g.game.kills, 1);
  assert.strictEqual(livingEnemies(g).length, 0);
});
