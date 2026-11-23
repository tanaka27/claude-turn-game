// 敵を倒したとき (経験値・落とし物・クエスト・レベルアップ) と、主人公が倒れたとき
'use strict';
const assert = require('assert');
const { newGame, arena, step, wait, runFrames, livingEnemies, lootsOnGround } = require('./helpers');

// 主人公 (5,5) のとなりの敵を 1 回で倒す
function killNext(type, level, prep) {
  const g = newGame();
  const [e] = arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type, at: [6, 5], level }] });
  if (prep) prep(g, e);
  e.hp = 1;
  g.rng.force(0.99, 0.5); // 会心なし
  step(g, 1, 0);
  assert.ok(e.dead, '倒れる');
  return { g, e };
}

test('倒すと経験値が入る (敵レベルで +25%/Lv)', () => {
  const a = killNext('wolf', 1);
  assert.strictEqual(a.g.player.exp, 12);
  assert.strictEqual(a.g.game.kills, 1);
  const b = killNext('wolf', 5);
  assert.strictEqual(b.g.player.exp, 24);
});

test('5 レベル以上低い敵 (灰色) の経験値は 0.2 倍', () => {
  const four = killNext('wolf', 1, (g) => { g.player.level = 5; });
  assert.strictEqual(four.g.player.exp, 12);
  const five = killNext('wolf', 1, (g) => { g.player.level = 6; });
  assert.strictEqual(five.g.player.exp, Math.round(12 * 0.2));
});

test('倒した敵はいなくなり、素材を落とす。そのマスへ歩くと拾う', () => {
  const { g } = killNext('wolf', 1);
  assert.strictEqual(livingEnemies(g).length, 0);
  assert.ok(lootsOnGround(g) >= 1);
  step(g, 1, 0);
  assert.deepStrictEqual([g.player.tx, g.player.ty], [6, 5]);
  assert.strictEqual(g.player.materials.wolfPelt, 1);
});

test('受けているクエストの数が進み、数に届くと報告できる', () => {
  const a = killNext('wolf', 1, (g) => { g.player.quests.c_wolf = { state: 'active', count: 0 }; g.player.quests.c_bee = { state: 'active', count: 0 }; });
  assert.strictEqual(a.g.player.quests.c_wolf.count, 1);
  assert.strictEqual(a.g.player.quests.c_wolf.state, 'active');
  assert.strictEqual(a.g.player.quests.c_bee.count, 0, '対象でない敵では進まない');
  const b = killNext('wolf', 1, (g) => { g.player.quests.c_wolf = { state: 'active', count: 7 }; });
  assert.strictEqual(b.g.player.quests.c_wolf.count, 8);
  assert.strictEqual(b.g.player.quests.c_wolf.state, 'ready');
});

test('経験値がたまるとレベルが上がり、全部の潜在が上がって HP・MP が満タンになる (ステータスはレベルでは上がらない)', () => {
  let before;
  const { g } = killNext('wolf', 1, (g) => {
    const p = g.player;
    p.exp = g.expToNext(1) - 1;
    p.hp = 3;
    before = { potential: { ...p.potential } };
  });
  const p = g.player;
  assert.strictEqual(p.level, 2);
  assert.strictEqual(p.exp, g.expToNext(1) - 1 + 12 - g.expToNext(1));
  const P = g.PARAMS.progression.growth.potential;
  // 倒した一撃で ちから の一の位が上がると潜在が少し下がることがあるので、上がったことと上がりすぎていないことを見る
  for (const k in before.potential) {
    assert.ok(p.potential[k] > before.potential[k] + P.levelUp * 0.5, `${k} の潜在が上がる`);
    assert.ok(p.potential[k] <= before.potential[k] + P.levelUp + 1e-9, k);
  }
  assert.strictEqual(p.hp, p.stats.maxHp);
  assert.strictEqual(p.mp, p.stats.maxMp);
  // レベルアップでセーブされる
  assert.ok(g.storage.get('zankai-turn-save'));
  assert.strictEqual(JSON.parse(g.storage.get('zankai-turn-save')).player.level, 2);
});

// 主人公を倒れさせる (HP をわずかにして、となりのウルフに攻撃させる)
function dieToWolf(g) {
  const p = g.player;
  arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type: 'wolf', at: [6, 5], level: 5 }] });
  p.hp = 0.5;
  for (let i = 0; i < 20 && !p.dead; i++) wait(g);
  assert.ok(p.dead, '倒れる');
}

test('倒れると所持金の 1 割を失い (経験値は失わない)、町のかがり火で HP 満タンで復活する', () => {
  const g = newGame();
  const p = g.player;
  p.gold = 105; p.exp = 40;
  dieToWolf(g);
  assert.strictEqual(g.game.state, 'dying');
  assert.strictEqual(p.gold, 105 - 10);
  assert.strictEqual(p.exp, 40);
  // 倒れている間のセーブは、戻る町の復活地点にいることになる
  const saved = JSON.parse(g.storage.get('zankai-turn-save'));
  assert.strictEqual(saved.location.zone, 'town');
  assert.strictEqual(saved.player.hp, null);
  const t = g.game.time;
  runFrames(g, 3);
  assert.strictEqual(g.game.state, 'play');
  assert.ok(!p.dead);
  assert.strictEqual(g.zone.id, 'town');
  const r = g.WORLD.zones.town.respawn;
  assert.deepStrictEqual([p.tx, p.ty], [Math.floor(r.x / g.TILE), Math.floor(r.y / g.TILE)]);
  assert.strictEqual(p.hp, p.stats.maxHp);
  assert.strictEqual(p.mp, p.stats.maxMp);
  assert.ok(g.game.time >= t, '時間は戻らない');
});

test('最後に立ち寄った町 (home) で復活する', () => {
  const g = newGame();
  g.player.home = 'waystation';
  dieToWolf(g);
  runFrames(g, 3);
  assert.strictEqual(g.zone.id, 'waystation');
  const r = g.WORLD.zones.waystation.respawn;
  assert.deepStrictEqual([g.player.tx, g.player.ty], [Math.floor(r.x / g.TILE), Math.floor(r.y / g.TILE)]);
});
