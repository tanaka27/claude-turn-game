// ワールドマップ (grid で描くゾーン): 文字の地図からゾーンを作る・入口で町やダンジョンに出入りする・地方・世界地図の位置
'use strict';
const assert = require('assert');
const { newGame, step } = require('./helpers');

const OW = (g) => g.WORLD.zones[g.WORLD.overworld];
// grid の中の文字 ch の位置 [列, 行]
function findChar(g, ch) {
  const grid = OW(g).grid;
  for (let r = 0; r < grid.length; r++) { const c = grid[r].indexOf(ch); if (c >= 0) return [c, r]; }
  return null;
}
// ワールドマップの入口 id の門 (マスにそろえたもの。今のゾーンがワールドマップのとき)
const placeGate = (g, id) => g.zone.gates.find((x) => x.id === id);

test('grid の文字から、大きさ・地形・地面・入口の門を作る (入口から出ると下のマスに立つ)', () => {
  const g = newGame();
  const z = OW(g);
  assert.strictEqual(z.w, z.grid[0].length * g.TILE);
  assert.strictEqual(z.h, z.grid.length * g.TILE);
  g.loadZone(g.WORLD.overworld);
  // 地形: 文字どおりに通れる・通れない
  for (const [ch, blocks] of [['^', true], ['~', true], ['*', true], ['.', false], ['=', false], [':', false]]) {
    const [c, r] = findChar(g, ch);
    assert.strictEqual(!!g.blocked[g.tileIndex(c, r)], blocks, `'${ch}' (${c}, ${r})`);
  }
  // 山と木は 1 マスずつの障害物、海はまとめた四角
  assert.ok(g.obstacles.filter((o) => o.kind === 'mountain').every((o) => o.w === g.TILE && o.h === g.TILE));
  assert.ok(g.obstacles.some((o) => o.kind === 'water' && o.w > g.TILE && o.h > g.TILE));
  // 外周の壁は付けない (外周は海と山で囲む)
  assert.ok(!g.obstacles.some((o) => o.kind === 'wall' && o.w === z.w));
  // 入口: places の数だけ門があり、入口のマスに置かれる
  assert.strictEqual(z.gates.length, Object.keys(z.places).length);
  for (const [ch, p] of Object.entries(z.places)) {
    const [c, r] = findChar(g, ch), gt = placeGate(g, p.id);
    assert.deepStrictEqual([gt.tx, gt.ty, gt.tw, gt.th], [c, r, 1, 1], p.id);
    assert.strictEqual(gt.place, p.icon);
    assert.ok(!g.isBlocked(gt.sx, gt.sy) && g.gateAt[g.tileIndex(gt.sx, gt.sy)] < 0, `${p.id} の出口 (${gt.sx}, ${gt.sy}) が通れる`);
  }
  const town = placeGate(g, 'town');
  assert.deepStrictEqual([town.sx, town.sy], [town.tx, town.ty + 1], '下が通れれば下に立つ');
});

test('町の門からワールドマップの入口の前に出て、入口を踏むとまた町に入る', () => {
  const g = newGame();
  assert.strictEqual(g.zone.id, 'town');
  const east = g.zone.gates.find((x) => x.id === 'east');
  // 門のとなりから門へ 1 歩
  g.placeUnit(g.player, east.tx - 1, east.ty);
  step(g, 1, 0);
  assert.strictEqual(g.zone.id, g.WORLD.overworld);
  const gt = placeGate(g, 'town');
  assert.deepStrictEqual([g.player.tx, g.player.ty], [gt.sx, gt.sy]);
  // 入口へ戻る (出てきたマスは入口のとなり)
  step(g, gt.tx - g.player.tx, gt.ty - g.player.ty);
  assert.strictEqual(g.zone.id, 'town');
  const dest = g.zone.gates.find((x) => x.id === 'east');
  assert.deepStrictEqual([g.player.tx, g.player.ty], [dest.sx, dest.sy]);
});

test('ワールドマップの地方: 入ると名前と敵レベル (その地方の湧き場所だけ) を出す', () => {
  const g = newGame();
  const z = OW(g);
  g.enterZone(g.WORLD.overworld, ...(() => { const gt = z.gates.find((x) => x.id === 'town'); return [gt.spawn.x / g.TILE | 0, gt.spawn.y / g.TILE | 0]; })());
  const plains = z.regions.find((r) => r.name === '風の草原');
  assert.strictEqual(g.regionAt(g.zone, g.player.tx, g.player.ty), plains);
  assert.ok(g.game.sub.includes('風の草原'), `出たときに地方の名前 (${g.game.sub})`);
  const lv = z.camps.filter((c) => c.x >= plains.x && c.x < plains.x + plains.w && c.y >= plains.y && c.y < plains.y + plains.h).map((c) => c.level);
  assert.strictEqual(g.zoneLevelText(g.zone, plains), g.txt('zone.levelRange', { lo: Math.min(...lv), hi: Math.max(...lv) }));
  // 別の地方へ歩くと出す (黒き森の湧き場所の中心へ置いてから、地方の判定だけを呼ぶ)
  const forestCamp = z.camps.find((c) => c.name === '森の入口');
  g.placeUnit(g.player, forestCamp.x / g.TILE | 0, forestCamp.y / g.TILE | 0);
  g.checkRegion(true);
  assert.strictEqual(g.game.msg, '黒き森');
});

test('世界地図での位置: 町・ダンジョン・建物の中は入口、ワールドマップそのものは null', () => {
  const g = newGame();
  const ow = OW(g);
  assert.strictEqual(g.worldPlaceOf(g.WORLD.overworld), null);
  assert.strictEqual(g.worldPlaceOf('town').id, 'town');
  assert.strictEqual(g.worldPlaceOf('townGuild'), ow.gates.find((x) => x.to === 'town'), '建物の中は外の町の入口');
  assert.strictEqual(g.worldPlaceOf('wolfDen').place, 'dungeon');
});

test('データの確認: grid の入口が足りない・外周が通れるのを知らせる', () => {
  const g = newGame();
  const z = OW(g);
  const errs = () => { const out = []; const orig = g.console.error; g.console.error = (...a) => out.push(a.join(' ')); g.validateData(); g.console.error = orig; return out.join('\n'); };
  assert.strictEqual(errs(), '', '今のデータには食い違いがない');
  // 入口の文字を消す → 入口が 0 個
  const [c, r] = findChar(g, 'G');
  const keep = z.grid[r];
  z.grid[r] = keep.slice(0, c) + '.' + keep.slice(c + 1);
  assert.ok(errs().includes("入口 'G' が grid に 0 個"));
  z.grid[r] = keep;
  // 外周を草地にする
  const top = z.grid[0];
  z.grid[0] = '.' + top.slice(1);
  assert.ok(errs().includes('grid の外周 (0, 0) が通れる'));
  z.grid[0] = top;
});
