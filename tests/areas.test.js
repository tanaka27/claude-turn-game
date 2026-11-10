// 技の範囲 (planAttack) と、弾の貫通
'use strict';
const assert = require('assert');
const { newGame, arena, attackTiles, performAttack, castAt } = require('./helpers');

const sorted = (list) => list.map(([x, y]) => `${x},${y}`).sort();
// (cx, cy) から半径 r 以内のマス (中心を含むか選べる)
function disc(cx, cy, r, withCenter, keep = () => true) {
  const out = [];
  const n = Math.ceil(r);
  for (let y = cy - n; y <= cy + n; y++) for (let x = cx - n; x <= cx + n; x++) {
    if (!withCenter && x === cx && y === cy) continue;
    if (Math.hypot(x - cx, y - cy) <= r + 1e-6 && keep(x, y)) out.push([x, y]);
  }
  return sorted(out);
}
function field(walls) {
  const g = newGame();
  arena(g, { cols: 15, rows: 15, player: [7, 7], walls });
  return g;
}

test('近接・扇 (噛みつき 120°・1.5 マス): 向いた側の 3 マス', () => {
  const g = field();
  const bite = g.ENEMIES.wolf.attacks[0];
  assert.deepStrictEqual(attackTiles(g, g.player, bite, 8, 7), sorted([[8, 6], [8, 7], [8, 8]]));
  assert.deepStrictEqual(attackTiles(g, g.player, bite, 8, 8), sorted([[8, 7], [8, 8], [7, 8]]));
});

test('近接・円 (旋風斬 2.3 マス): まわり 20 マス (自分のマスは入らない)', () => {
  const g = field();
  const whirl = g.SKILLS.find((s) => s.shape === 'circle');
  const tiles = attackTiles(g, g.player, whirl, 7, 7);
  assert.strictEqual(tiles.length, 20);
  assert.deepStrictEqual(tiles, disc(7, 7, 2.3, false));
});

test('近接・円: 壁のマスと、壁の陰のマスには届かない', () => {
  const g = field([[8, 7, 1, 1]]);
  const whirl = g.SKILLS.find((s) => s.shape === 'circle');
  const tiles = attackTiles(g, g.player, whirl, 7, 7);
  // 今の動き: 斜め上 (8,6) も壁の陰あつかいになるが、斜め下 (8,8) はならない (視線の判定がマスの角で
  // floor するため、上下で非対称)。不具合の疑いとして記録してあり、ここでは今の結果を固定する
  const hidden = ['8,7', '9,7', '9,6', '9,8', '8,6'];
  assert.deepStrictEqual(tiles, disc(7, 7, 2.3, false).filter((k) => !hidden.includes(k)));
});

test('近接・直線 (角突き 3 マス): まっすぐ・斜め、壁の手前で止まる', () => {
  const g = field();
  const gore = g.ENEMIES.boar.attacks[0];
  assert.deepStrictEqual(attackTiles(g, g.player, gore, 12, 7), sorted([[8, 7], [9, 7], [10, 7]]));
  assert.deepStrictEqual(attackTiles(g, g.player, gore, 12, 12), sorted([[8, 8], [9, 9], [10, 10]]));
  const g2 = field([[9, 7, 1, 1]]);
  assert.deepStrictEqual(attackTiles(g2, g2.player, gore, 12, 7), ['8,7']);
});

test('弾 (衝撃波 9 マス): まっすぐ飛び、壁で止まる', () => {
  const g = newGame();
  arena(g, { cols: 15, rows: 15, player: [2, 7] });
  const wave = g.SKILLS.find((s) => s.type === 'projectile');
  // 外周の壁 (x = 14) まで 11 マスあるが、射程 9
  assert.deepStrictEqual(attackTiles(g, g.player, wave, 13, 7), sorted([3, 4, 5, 6, 7, 8, 9, 10, 11].map((x) => [x, 7])));
  const g2 = newGame();
  arena(g2, { cols: 15, rows: 15, player: [2, 7], walls: [[6, 7, 1, 1]] });
  assert.deepStrictEqual(attackTiles(g2, g2.player, wave, 13, 7), sorted([[3, 7], [4, 7], [5, 7]]));
});

test('弾: 貫通する弾は並んだ敵すべてに、貫通しない弾は最初の敵だけに当たる', () => {
  const opts = { cols: 15, rows: 15, player: [2, 7], enemies: [{ type: 'golem', at: [4, 7] }, { type: 'golem', at: [6, 7] }] };
  const g = newGame();
  const [a, b] = arena(g, opts);
  castAt(g, '1', 10, 7); // 衝撃波 (貫通)
  assert.ok(a.hp < a.stats.maxHp && b.hp < b.stats.maxHp, '両方に当たる');

  const g2 = newGame();
  const [c, d] = arena(g2, opts);
  const wave = g2.SKILLS.find((s) => s.type === 'projectile');
  performAttack(g2, g2.player, { ...wave, pierce: false }, 10, 7);
  assert.ok(c.hp < c.stats.maxHp, '手前に当たる');
  assert.strictEqual(d.hp, d.stats.maxHp, '奥には当たらない');
});

test('投げる (メテオ 射程 8・半径 2.3): 射程より遠くを狙うと射程いっぱいに落ちる', () => {
  const g = newGame();
  arena(g, { cols: 15, rows: 15, player: [2, 7] });
  const meteor = g.SKILLS.find((s) => s.type === 'lob');
  const h = g.planAttack(g.player, meteor, 14, 7);
  assert.deepStrictEqual(Array.from(h.centers, (c) => Array.from(c)), [[10, 7]]);
  assert.deepStrictEqual(attackTiles(g, g.player, meteor, 14, 7), disc(10, 7, 2.3, true));
  // 射程内ならそのマス
  assert.deepStrictEqual(attackTiles(g, g.player, meteor, 6, 7), disc(6, 7, 2.3, true));
});

test('投げる: 着弾点から壁の向こう側には広がらない。壁そのものを狙うと両側に広がる', () => {
  const g = newGame();
  arena(g, { cols: 15, rows: 15, player: [2, 7], walls: [[10, 4, 1, 7]] });
  const meteor = g.SKILLS.find((s) => s.type === 'lob');
  assert.deepStrictEqual(attackTiles(g, g.player, meteor, 9, 7), disc(9, 7, 2.3, true, (x) => x <= 9));
  const onWall = attackTiles(g, g.player, meteor, 10, 7);
  assert.ok(onWall.includes('9,7') && onWall.includes('11,7'), '壁の両側');
  assert.ok(!onWall.includes('10,7'), '壁のマスは入らない');
});
