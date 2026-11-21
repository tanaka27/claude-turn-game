// 読み込みとデータの確認
'use strict';
const assert = require('assert');
const { loadGame, scriptList } = require('./harness');

test('index.html の読み込み順で全ファイルを読める (main.js が最後)', () => {
  const list = scriptList();
  assert.strictEqual(list[0], 'params.js');
  assert.strictEqual(list[list.length - 1], 'src/main.js');
  assert.ok(list.indexOf('world.js') < list.indexOf('src/core.js'));
  const g = loadGame();
  assert.strictEqual(g.game.state, 'title');
  assert.strictEqual(typeof g.startGame, 'function');
});

test('起動時のデータの確認で [データの確認] が出ない', () => {
  const g = loadGame();
  const bad = g.consoleLog.filter((m) => m.text.includes('[データの確認]'));
  assert.deepStrictEqual(bad.map((m) => m.text), []);
  const errors = g.consoleLog.filter((m) => m.level === 'error');
  assert.deepStrictEqual(errors.map((m) => m.text), []);
});

test('はじめから: 始まりの町のかがり火に立ち、HP・MP は満タン', () => {
  const g = loadGame();
  g.startGame(null);
  const p = g.player, r = g.WORLD.zones.town.respawn;
  assert.strictEqual(g.zone.id, 'town');
  assert.strictEqual(p.tx, Math.floor(r.x / g.TILE));
  assert.strictEqual(p.ty, Math.floor(r.y / g.TILE));
  assert.strictEqual(p.hp, p.stats.maxHp);
  assert.strictEqual(p.mp, p.stats.maxMp);
  assert.strictEqual(p.level, 1);
  assert.strictEqual(p.gold, g.PARAMS.economy.startGold);
  assert.strictEqual(g.game.time, 0);
});

test('乱数は種で決まり、force で次の値を決められる', () => {
  const a = loadGame({ seed: 42 }), b = loadGame({ seed: 42 });
  const ra = [1, 2, 3].map(() => a.eval('Math.random()'));
  const rb = [1, 2, 3].map(() => b.eval('Math.random()'));
  assert.deepStrictEqual(ra, rb);
  a.rng.force(0.25, 0.75);
  assert.strictEqual(a.eval('Math.random()'), 0.25);
  assert.strictEqual(a.eval('Math.random()'), 0.75);
});
