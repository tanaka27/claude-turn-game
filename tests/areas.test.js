// 技の範囲 (planAttack) と、弾の貫通
'use strict';
const assert = require('assert');
const { newGame, arena, attackTiles, performAttack, castAt, sees, rayFrom } = require('./helpers');

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

test('近接・円: 壁のマスと、壁の陰のマスには届かない (上下左右どの向きの壁でも同じ形)', () => {
  // 壁が東にあるとき、隠れるのは壁と、その奥の 3 マス。斜めのとなり (8,6)・(8,8) へは、線が壁の角を
  // かすめるだけなので届く (角をちょうど通る線は、角を挟む 2 マスが両方とも遮るときだけ止まる)
  const east = ['8,7', '9,7', '9,6', '9,8'];
  // 東の壁と隠れるマスを、(7,7) のまわりで回したもの: [dx, dy] → 向き
  const turn = { east: ([dx, dy]) => [dx, dy], west: ([dx, dy]) => [-dx, dy], south: ([dx, dy]) => [dy, dx], north: ([dx, dy]) => [-dy, -dx] };
  for (const [name, f] of Object.entries(turn)) {
    const [wx, wy] = f([1, 0]);
    const g = field([[7 + wx, 7 + wy, 1, 1]]);
    const whirl = g.SKILLS.find((s) => s.shape === 'circle');
    const tiles = attackTiles(g, g.player, whirl, 7, 7);
    const hidden = east.map((k) => { const [x, y] = k.split(',').map(Number); const [dx, dy] = f([x - 7, y - 7]); return `${7 + dx},${7 + dy}`; });
    assert.deepStrictEqual(tiles, disc(7, 7, 2.3, false).filter((k) => !hidden.includes(k)), name);
  }
});

test('近接・円: 斜めに並んだ 2 つの壁の間 (角をちょうど通る線) は抜けられない', () => {
  // (7,7) から斜めのとなり (7+dx, 7+dy) へは、角を挟む (7+dx, 7) と (7, 7+dy) が両方とも壁なら届かない。片方だけなら届く
  for (const [dx, dy] of [[1, -1], [1, 1], [-1, 1], [-1, -1]]) {
    const key = `${7 + dx},${7 + dy}`;
    for (const walls of [[[7 + dx, 7, 1, 1]], [[7, 7 + dy, 1, 1]], [[7 + dx, 7, 1, 1], [7, 7 + dy, 1, 1]]]) {
      const g = field(walls);
      const whirl = g.SKILLS.find((s) => s.shape === 'circle');
      const tiles = attackTiles(g, g.player, whirl, 7, 7);
      assert.strictEqual(tiles.includes(key), walls.length === 1, `${key} 壁 ${JSON.stringify(walls)}`);
    }
  }
});

test('視線は向きによらない: 入れ替えても、左右・上下・縦横を裏返した地形でも同じ (ランダムな壁 25 通り)', () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const N = 9; // 外周の壁を含めて 9 × 9 マス
  const maps = {
    id: (x, y) => [x, y], ew: (x, y) => [N - 1 - x, y], ns: (x, y) => [x, N - 1 - y],
    both: (x, y) => [N - 1 - x, N - 1 - y], swap: (x, y) => [y, x],
  };
  const tiles = [];
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) tiles.push([x, y]); // 外周の壁の内側
  const games = {};
  for (const name in maps) games[name] = newGame(); // 地形ごとに試験場のゾーンを作り直す (ゲームは向きごとに 1 つ)
  for (let k = 0; k < 25; k++) {
    const walls = [];
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) if (rnd() < 0.25) walls.push([x, y]);
    const open = tiles.find(([x, y]) => !walls.some(([wx, wy]) => wx === x && wy === y));
    const results = {};
    for (const [name, m] of Object.entries(maps)) {
      const g = games[name];
      arena(g, { cols: N, rows: N, player: m(...open), walls: walls.map(([x, y]) => [...m(x, y), 1, 1]) });
      results[name] = (a, b) => sees(g, ...m(...a), ...m(...b));
    }
    for (const a of tiles) for (const b of tiles) {
      const v = results.id(a, b);
      assert.strictEqual(results.id(b, a), v, `入れ替え ${a} → ${b} (地形 ${k})`);
      for (const name of ['ew', 'ns', 'both', 'swap']) assert.strictEqual(results[name](a, b), v, `${name} ${a} → ${b} (地形 ${k})`);
    }
  }
});

test('近接・直線 (角突き 3 マス): まっすぐ・斜め、壁の手前で止まる', () => {
  const g = field();
  const gore = g.ENEMIES.boar.attacks[0];
  assert.deepStrictEqual(attackTiles(g, g.player, gore, 12, 7), sorted([[8, 7], [9, 7], [10, 7]]));
  assert.deepStrictEqual(attackTiles(g, g.player, gore, 12, 12), sorted([[8, 8], [9, 9], [10, 10]]));
  const g2 = field([[9, 7, 1, 1]]);
  assert.deepStrictEqual(attackTiles(g2, g2.player, gore, 12, 7), ['8,7']);
});

test('直線: ちょうど斜めの直線はどの向きでも同じ形 (角を挟む 2 マスが両方とも壁のときだけ止まる)', () => {
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const dir = Math.atan2(dy, dx);
    const g = field();
    const want = [1, 2, 3, 4].map((i) => [7 + dx * i, 7 + dy * i]);
    assert.deepStrictEqual(rayFrom(g, 7, 7, dir, 4), want, `${dx},${dy}`);
    // 2 歩目と 3 歩目の間の角を、片方だけふさいでも通る。両方ふさぐとそこで止まる
    const side1 = [7 + dx * 3, 7 + dy * 2, 1, 1], side2 = [7 + dx * 2, 7 + dy * 3, 1, 1];
    assert.deepStrictEqual(rayFrom(field([side1]), 7, 7, dir, 4), want, `${dx},${dy} 片方`);
    assert.deepStrictEqual(rayFrom(field([side2]), 7, 7, dir, 4), want, `${dx},${dy} もう片方`);
    assert.deepStrictEqual(rayFrom(field([side1, side2]), 7, 7, dir, 4), want.slice(0, 2), `${dx},${dy} 両方`);
    // 逆向き (終わりのマスから戻る) も同じマスを通る
    const back = rayFrom(g, 7 + dx * 4, 7 + dy * 4, Math.atan2(-dy, -dx), 4);
    assert.deepStrictEqual(back, [3, 2, 1, 0].map((i) => [7 + dx * i, 7 + dy * i]), `${dx},${dy} 逆向き`);
  }
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
