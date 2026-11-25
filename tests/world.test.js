// ワールドマップ (grid で描くゾーン): 文字の地図からゾーンを作る・入口で町やダンジョンに出入りする・地方・世界地図の位置
'use strict';
const assert = require('assert');
const { newGame, step, press, renderFrame, el } = require('./helpers');

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
  const lv = z.camps.filter((c) => g.regionAt(z, g.tileOf(c.x), g.tileOf(c.y)) === plains).map((c) => c.level);
  assert.strictEqual(g.zoneLevelText(g.zone, plains), g.txt('zone.levelRange', { lo: Math.min(...lv), hi: Math.max(...lv) }));
  // 地方が重なったところ (風の草原と赤岩の峡谷) の湧き場所は、先に書いた峡谷のものとして数える (草原は 1〜5)
  assert.strictEqual(g.zoneLevelText(g.zone, plains), g.txt('zone.levelRange', { lo: 1, hi: 5 }));
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

test('東の高原・海岸と南の島の町: 入口から入れて、町の門からワールドマップの入口の前に戻る', () => {
  const g = newGame();
  for (const [id, gate] of [['harbor', 'west'], ['frostVillage', 'south'], ['desertCity', 'north']]) {
    g.enterZone(g.WORLD.overworld, 20, 50);
    const gt = placeGate(g, id);
    g.placeUnit(g.player, gt.sx, gt.sy);
    step(g, gt.tx - gt.sx, gt.ty - gt.sy);
    assert.strictEqual(g.zone.id, id, `${id} に入る`);
    assert.ok(g.zone.safe && g.zone.respawn, `${id} は安全な町でかがり火がある`);
    assert.strictEqual(g.player.home, id, '入った町が倒れたときに戻る先になる');
    const out = g.zone.gates.find((x) => x.id === gate);
    g.placeUnit(g.player, out.sx, out.sy);
    const [dx, dy] = [Math.sign(out.tx - out.sx), Math.sign(out.ty - out.sy)];
    for (let i = 0; i < 5 && g.zone.id === id; i++) step(g, dx, dy); // 門まで歩く
    assert.strictEqual(g.zone.id, g.WORLD.overworld, `${id} から出る`);
    assert.deepStrictEqual([g.player.tx, g.player.ty], [gt.sx, gt.sy]);
  }
});

test('世界地図: M で ゾーンの地図 → 世界地図 → 大きく → ゾーンの地図、+ / - とホイールで拡大・縮小、ドラッグで動かす', () => {
  const g = newGame();
  const z = OW(g), v = g.worldMapView, M = g.WORLD.worldMap;
  g.enterZone(g.WORLD.overworld, 20, 50);
  press(g, 'm');
  assert.ok(g.worldMapOn && !g.worldMapBig);
  assert.strictEqual(v.cx, g.player.x, '開いたときは主人公がまん中');
  renderFrame(g);
  // 全体が収まる大きさ (倍率 1) では、地図のまん中を見ている
  assert.strictEqual(v.zoom, 1);
  assert.ok(Math.abs(v.cx - z.w / 2) < 1e-6 && Math.abs(v.cy - z.h / 2) < 1e-6, `(${v.cx}, ${v.cy})`);
  const small = v.panel.mw;
  press(g, '+'); press(g, '+');
  assert.ok(Math.abs(v.zoom - M.zoomStep ** 2) < 1e-9);
  press(g, '-');
  assert.ok(Math.abs(v.zoom - M.zoomStep) < 1e-9);
  for (let i = 0; i < 40; i++) press(g, '+');
  assert.strictEqual(v.zoom, M.maxZoom, '拡大は maxZoom まで');
  // ドラッグで動かす (地図の外は映さない: 描くときに寄せる)
  renderFrame(g);
  const P = v.panel, canvas = el(g, 'game')._listeners;
  const at = (x, y) => ({ button: 0, clientX: x, clientY: y, deltaY: 0, preventDefault() {} });
  const x0 = P.mx + P.mw / 2, y0 = P.my + P.mh / 2, cx0 = v.cx;
  for (const f of canvas.mousedown) f(at(x0, y0));
  for (const f of canvas.mousemove) f(at(x0 - 40, y0));
  for (const f of g.windowListeners.mouseup) f(at(x0 - 40, y0));
  assert.ok(Math.abs(v.cx - (cx0 + 40 / P.s)) < 1e-6, '左へドラッグすると東を見る');
  assert.ok(!g.worldMapBig, 'ドラッグしたときは大きさを変えない');
  for (const f of canvas.mousedown) f(at(-1e5, -1e5)); // 地図の外を押してもドラッグしない
  for (let i = 0; i < 200; i++) panWorld(g, 1e4);
  renderFrame(g);
  assert.ok(v.cx <= z.w - P.mw / 2 / v.panel.s + 1e-6, '地図の外は映さない');
  // ホイール (下へ回すと縮小)
  const zoom = v.zoom;
  for (const f of canvas.wheel) f({ ...at(x0, y0), deltaY: 100 });
  assert.ok(Math.abs(v.zoom - zoom / M.zoomStep) < 1e-9);
  // クリック (動かさずに離す) で大きく、M でゾーンの地図に戻る
  for (const f of canvas.mousedown) f(at(x0, y0));
  for (const f of g.windowListeners.mouseup) f(at(x0, y0));
  assert.ok(g.worldMapBig);
  renderFrame(g);
  assert.ok(v.panel.mw > small, '大きく出すと地図が広い');
  press(g, 'm');
  assert.ok(!g.worldMapOn && !g.worldMapBig);
  renderFrame(g);
});
// 世界地図を画面の dx px 分だけ動かす (ドラッグと同じ)
function panWorld(g, dx) { g.panWorldMap(-dx, 0); }
