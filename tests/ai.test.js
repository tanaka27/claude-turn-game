// 敵の動き (結果で見る): 気づく・仲間が加わる・諦めて帰る・予告の技
'use strict';
const assert = require('assert');
const {
  newGame, arena, wait, step, isHostile, isIdle, isReturning, isInvulnerable, telegraphTiles, traceTurns, setPlayerBase, moveTo,
} = require('./helpers');

test('待機中の敵は、7 マス以内で視線が通ると追ってくる', () => {
  const g = newGame();
  const [w] = arena(g, { cols: 20, rows: 15, player: [3, 7], enemies: [{ type: 'wolf', at: [8, 7] }] });
  assert.ok(isIdle(w));
  wait(g);
  assert.ok(isHostile(w));
});

test('遠い (7 マスより先) ・壁で見えない・安全地帯なら追ってこない', () => {
  const far = newGame();
  const [a] = arena(far, { cols: 25, rows: 15, player: [3, 7], enemies: [{ type: 'wolf', at: [14, 7] }] });
  far.rng.constant(0.9); // うろつかない
  wait(far, 3);
  assert.ok(isIdle(a));

  const hidden = newGame();
  const [b] = arena(hidden, { cols: 20, rows: 15, player: [3, 7], walls: [[5, 2, 1, 11]], enemies: [{ type: 'wolf', at: [8, 7] }] });
  hidden.rng.constant(0.9);
  wait(hidden, 3);
  assert.ok(isIdle(b));

  const safe = newGame();
  const [c] = arena(safe, { cols: 20, rows: 15, player: [3, 7], safe: true, enemies: [{ type: 'wolf', at: [6, 7] }] });
  wait(safe, 3);
  assert.ok(isIdle(c));
});

test('気づいた敵の近く (8 マス以内) にいる同じ群れの仲間も追ってくる。別の群れは来ない', () => {
  const g = newGame();
  const [w1, w2, other] = arena(g, { cols: 25, rows: 15, player: [2, 7], enemies: [
    { type: 'wolf', at: [7, 7], camp: 'pack' },
    { type: 'wolf', at: [13, 7], camp: 'pack' },
    { type: 'wolf', at: [13, 10], camp: 'other' },
  ] });
  g.rng.constant(0.9);
  wait(g);
  assert.ok(isHostile(w1));
  assert.ok(isHostile(w2), '仲間は 11 マス先でも来る');
  assert.ok(isIdle(other));
});

test('湧いた位置から 16 マスより離れると諦めて帰る: 帰る間は無敵、着いたら全回復', () => {
  const g = newGame();
  const [w] = arena(g, { cols: 30, rows: 15, player: [24, 7], enemies: [{ type: 'wolf', at: [23, 7], home: [3, 7] }] });
  g.rng.force(0.99, 0.5); // 会心なし
  step(g, -1, 0); // 殴る → 気づく (HP 9 → 4)
  assert.strictEqual(w.hp, 4);
  g.rng.constant(0.9); // 帰り着いたあとにうろつかない
  if (!isReturning(w)) wait(g);
  assert.ok(isReturning(w), '諦めて帰る');
  assert.ok(isInvulnerable(w));
  // 帰る途中は攻撃が効かない (となりへ回って殴る)
  moveTo(g, g.player, w.tx + 1, w.ty);
  step(g, -1, 0);
  assert.strictEqual(w.hp, 4, '無効');
  assert.ok(isReturning(w));
  moveTo(g, g.player, 28, 7);
  let n = 0;
  while (isReturning(w) && n < 60) { wait(g); n++; }
  assert.ok(isIdle(w), '帰り着く');
  assert.deepStrictEqual([w.tx, w.ty], [3, 7]);
  assert.strictEqual(w.hp, w.stats.maxHp);
  assert.ok(!isInvulnerable(w));
});

// 予告の技: イノシシの角突き (直線 3 マス、予告あり)。予告が出るまで待つ
function untilTelegraph(g, boar) {
  const p = g.player;
  for (let i = 0; i < 80; i++) {
    p.hp = p.stats.maxHp;
    if (telegraphTiles(g).size) return true;
    wait(g);
  }
  return false;
}
function boarSetup(seed) {
  const g = newGame(seed);
  setPlayerBase(g, { maxHp: 400 });
  const [boar] = arena(g, { cols: 20, rows: 15, player: [5, 7], enemies: [{ type: 'boar', at: [8, 7] }] });
  return { g, boar };
}

test('予告の技は、使った敵の次の行動で当たる (その場にいれば当たる)', () => {
  const { g, boar } = boarSetup(3);
  assert.ok(untilTelegraph(g, boar), '予告が出る');
  const p = g.player;
  assert.ok(telegraphTiles(g).has(`${p.tx},${p.ty}`), '主人公のマスを狙う');
  const tr = traceTurns(g);
  const hp0 = p.hp;
  let n = 0;
  while (telegraphTiles(g).size && n < 10) { wait(g); n++; }
  tr.stop();
  assert.strictEqual(tr.filter((x) => x.who === boar).length, 1, 'イノシシの次の 1 回の行動で出る');
  assert.ok(p.hp < hp0 - 1, `当たる (${hp0} → ${p.hp})`);
});

test('予告の技は、範囲の外へ出れば当たらない', () => {
  const { g, boar } = boarSetup(3);
  assert.ok(untilTelegraph(g, boar));
  const p = g.player;
  const hot = telegraphTiles(g);
  const away = [[0, -1], [0, 1], [-1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]
    .find(([dx, dy]) => !hot.has(`${p.tx + dx},${p.ty + dy}`) && g.isFree(p.tx + dx, p.ty + dy) && g.canStep(p.tx, p.ty, dx, dy));
  assert.ok(away, '逃げ場がある');
  const hp0 = p.hp;
  step(g, away[0], away[1]);
  let n = 0;
  while (telegraphTiles(g).size && n < 10) { wait(g); n++; }
  assert.ok(p.hp >= hp0 - 1e-9, `当たらない (${hp0} → ${p.hp})`);
  assert.ok(!boar.dead);
});
