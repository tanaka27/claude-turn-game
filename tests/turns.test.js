// ターンの進み方 (速度による行動順) と、時間で進むもの
'use strict';
const assert = require('assert');
const { newGame, arena, traceTurns, passTime, setNextAction, setPlayerBase, wait, press, castAt, livingEnemies, lootsOnGround, messages, skill, storedCooldown } = require('./helpers');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} ${a} != ${b}`);

test('速いほど多く行動する (主人公 100・ウルフ 110・ゴーレム 70)', () => {
  const g = newGame();
  const [wolf, golem] = arena(g, { cols: 30, rows: 15, player: [2, 7],
    enemies: [{ type: 'wolf', at: [25, 3] }, { type: 'golem', at: [25, 11] }] });
  const tr = traceTurns(g);
  const t0 = g.game.time;
  wait(g, 100);
  tr.stop();
  const count = (u) => tr.filter((x) => x.who === u).length;
  assert.strictEqual(count('player'), 100);
  near(g.game.time, t0 + 100, '速度 100 の主人公は 1 行動 1 ターン');
  assert.ok(Math.abs(count(wolf) - 110) <= 1, `ウルフ ${count(wolf)}`);
  assert.ok(Math.abs(count(golem) - 70) <= 1, `ゴーレム ${count(golem)}`);
});

test('主人公の行動にかかる時間は 100 / 速度', () => {
  const g = newGame();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  setPlayerBase(g, { agi: 45 }); // 速度 150
  assert.strictEqual(g.player.stats.speed, 150);
  const t0 = g.game.time;
  wait(g, 3);
  near(g.game.time, t0 + 3 * 100 / 150);
});

test('同じ時刻なら主人公が先に行動する', () => {
  const g = newGame();
  const [wolf] = arena(g, { cols: 30, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [25, 7] }] });
  setPlayerBase(g, { agi: 25 }); // ウルフと同じ速度 110
  assert.strictEqual(g.player.stats.speed, wolf.stats.speed);
  setNextAction(g, wolf, g.game.time);
  const tr = traceTurns(g);
  wait(g, 5);
  tr.stop();
  assert.deepStrictEqual(tr.map((x) => (x.who === 'player' ? 'P' : 'E')), ['P', 'E', 'P', 'E', 'P', 'E', 'P', 'E', 'P', 'E']);
  for (let i = 0; i < tr.length; i += 2) assert.strictEqual(tr[i].t, tr[i + 1].t, '同じ時刻で主人公が先');
});

test('HP・MP の回復: HP再生・MP再生と、休息 (攻撃を受けずに 8 ターン) の追加分', () => {
  const g = newGame();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  const p = g.player, PG = g.PARAMS.progression;
  p.hp = 10; p.mp = 0;
  wait(g);
  near(p.hp, 10 + p.stats.hpRegen + p.stats.maxHp * PG.restRegenRate);
  near(p.mp, 0 + p.stats.mpRegen + p.stats.maxMp * PG.restMpRegenRate);
  // 攻撃を受けたばかり (休息ではない)
  p.hp = 10; p.mp = 0; p.lastHurt = g.game.time;
  wait(g);
  near(p.hp, 10 + p.stats.hpRegen);
  near(p.mp, p.stats.mpRegen);
});

test('敵の MP も時間で回復する', () => {
  const g = newGame();
  const [boar] = arena(g, { cols: 30, rows: 15, player: [2, 7], enemies: [{ type: 'boar', at: [25, 7] }] });
  boar.mp = 0;
  wait(g, 5);
  near(boar.mp, 5 * boar.stats.mpRegen);
  wait(g, 100);
  assert.strictEqual(boar.mp, boar.stats.maxMp);
});

test('スキルの再使用待ちは主人公の行動ごとに 1 減る (使った行動でも 1 減る)', () => {
  const g = newGame();
  arena(g, { cols: 15, rows: 15, player: [2, 7] });
  const sk = skill(g, '1');
  castAt(g, '1', 8, 7);
  assert.strictEqual(storedCooldown(g, g.player, sk), sk.cooldown - 1);
  press(g, '1');
  assert.strictEqual(g.aiming, null, '再使用待ちの間は構えられない');
  assert.ok(messages(g).some((m) => m.includes(`あと ${sk.cooldown - 1} 行動`)));
  wait(g, sk.cooldown - 2);
  assert.strictEqual(storedCooldown(g, g.player, sk), 1);
  wait(g);
  assert.strictEqual(storedCooldown(g, g.player, sk), 0);
  press(g, '1');
  assert.strictEqual(g.aiming, sk);
});

test('湧き場所: 倒した敵は respawn ターン後に出現予告を挟んで湧き直す', () => {
  const g = newGame();
  const [wolf] = arena(g, { cols: 20, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [10, 7], respawn: 10 }] });
  wolf.hp = 1;
  g.rng.force(0.99); // 会心なし
  castAt(g, '1', 10, 7);
  assert.ok(wolf.dead);
  let n = 1;
  while (livingEnemies(g).length === 0 && n < 100) { wait(g); n++; }
  // 行動 1 回 = 1 ターン。respawn 10 ターンが切れた時刻に予告が出て、そこから spawnTelegraph (2) ターンで湧く。
  // 倒した行動を含めて 12 行動目 (= respawn + spawnTelegraph)
  assert.strictEqual(n, 10 + g.PARAMS.field.spawnTelegraph);
  const e = livingEnemies(g)[0];
  assert.deepStrictEqual([e.tx, e.ty], [10, 7]);
  assert.strictEqual(e.hp, e.stats.maxHp);
});

// 倒してから湧き直すまで: 主人公の行動を何回したか (倒した行動を含む) と、何ターンたったか
//   others: ほかに置く敵 (遠くで待機させる)。agi: 主人公のすばやさ (速度を変える)
function respawnCount({ others = [], agi } = {}) {
  const g = newGame();
  const [wolf] = arena(g, { cols: 40, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [10, 7], respawn: 10 }, ...others] });
  if (agi !== undefined) setPlayerBase(g, { agi });
  g.rng.constant(0.99); // 会心なし・待機中の敵はうろつかない
  wolf.hp = 1;
  const t0 = g.game.time;
  castAt(g, '1', 10, 7);
  assert.ok(wolf.dead);
  let n = 1;
  while (livingEnemies(g).length === others.length && n < 100) { wait(g); n++; }
  g.rng.constant(null);
  return { n, turns: g.game.time - t0, speed: g.player.stats.speed };
}

test('湧き場所: 湧き直すまでのターン数は、時間の区切られ方 (主人公の速さ・速い敵がいるか) によらない', () => {
  const telegraph = newGame().PARAMS.field.spawnTelegraph;
  const want = 10 + telegraph;
  const alone = respawnCount();
  assert.deepStrictEqual([alone.n, alone.turns], [want, want]);
  // 速い敵 (Lv10 のウルフ) が遠くで待機していると、時間がその敵の行動で細かく区切られる
  const fast = [{ type: 'wolf', at: [36, 2], level: 10 }];
  const withFast = respawnCount({ others: fast });
  assert.deepStrictEqual([withFast.n, withFast.turns], [want, want]);
  // 主人公が速い (速度 150: 1 行動 2/3 ターン) と、湧くまでの行動は増えるがターン数は同じ
  const quick = respawnCount({ others: fast, agi: 45 });
  assert.strictEqual(quick.speed, 150);
  assert.strictEqual(quick.n, want * 3 / 2);
  near(quick.turns, want, '速度 150');
  // 主人公が遅い (速度 75: 1 行動 4/3 ターン)
  const slow = respawnCount({ others: fast, agi: 7.5 });
  assert.strictEqual(slow.speed, 75);
  assert.strictEqual(slow.n, want * 3 / 4);
  near(slow.turns, want, '速度 75');
});

test('湧き場所: 時間を 1 度に進めても、細かく分けて進めても、同じ時刻に湧く', () => {
  const telegraph = newGame().PARAMS.field.spawnTelegraph;
  const killed = () => {
    const g = newGame();
    const [wolf] = arena(g, { cols: 20, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [10, 7], respawn: 10 }] });
    wolf.hp = 1;
    g.rng.force(0.99);
    castAt(g, '1', 10, 7); // 倒した行動で 1 ターン進む
    assert.ok(wolf.dead);
    return g;
  };
  const rest = 10 + telegraph - 1;
  // 1 度に: 再出現の時間が切れてから過ぎた分も予告に数えるので、その場で湧く
  const big = killed();
  passTime(big, rest - 1e-6);
  assert.strictEqual(livingEnemies(big).length, 0, 'まだ');
  const big2 = killed();
  passTime(big2, rest);
  assert.strictEqual(livingEnemies(big2).length, 1, '1 度に進める');
  // 0.1 ターンずつ
  const small = killed();
  for (let i = 0; i < rest * 10 - 1; i++) passTime(small, 0.1);
  assert.strictEqual(livingEnemies(small).length, 0, '0.1 ターン手前');
  passTime(small, 0.1);
  assert.strictEqual(livingEnemies(small).length, 1, '0.1 ターンずつ');
  // 再出現の時間が切れる区切りをまたいで、半端な大きさで
  const odd = killed();
  passTime(odd, 8.7); passTime(odd, 0.6); passTime(odd, 1.5); // 0.6 の途中で切れる
  assert.strictEqual(livingEnemies(odd).length, 0, '10.8 ターン');
  passTime(odd, rest - 10.8);
  assert.strictEqual(livingEnemies(odd).length, 1, '半端な区切り');
});

test('湧き場所: ゾーンを出て戻っても、再出現までの残りを引き継いで同じ時刻に湧く', () => {
  const g = newGame();
  const [wolf] = arena(g, { cols: 20, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [10, 7], respawn: 10 }] });
  const first = g.zone.id;
  wolf.hp = 1;
  g.rng.force(0.99);
  castAt(g, '1', 10, 7);
  assert.ok(wolf.dead);
  wait(g, 3); // 倒してから 4 ターン (残り 6)
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  wait(g, 4); // よそで 4 ターン (残り 2)
  g.enterZone(first, 2, 7);
  assert.strictEqual(livingEnemies(g).length, 0, '戻ってすぐは湧いていない');
  const telegraph = g.PARAMS.field.spawnTelegraph;
  let n = 0;
  while (livingEnemies(g).length === 0 && n < 100) { wait(g); n++; }
  // 残り 2 ターンで予告が出て、そこから spawnTelegraph ターン。倒してからでは 10 + spawnTelegraph ターン
  assert.strictEqual(n, 2 + telegraph);
  assert.strictEqual(1 + 3 + 4 + n, 10 + telegraph);
  // 残りが過ぎてから戻ると、入ったときにもう湧いている
  const [w2] = livingEnemies(g);
  w2.hp = 1;
  g.rng.force(0.99);
  castAt(g, '1', w2.tx, w2.ty);
  assert.ok(w2.dead);
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  wait(g, 10);
  g.enterZone(first, 2, 7);
  assert.strictEqual(livingEnemies(g).length, 1);
});

test('湧き場所: 主人公が近く (7 マス未満) にいるうちは湧かない', () => {
  const g = newGame();
  const [wolf] = arena(g, { cols: 20, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [8, 7], respawn: 5 }] });
  wolf.hp = 1;
  g.rng.force(0.99);
  castAt(g, '1', 8, 7);
  assert.ok(wolf.dead);
  wait(g, 30);
  assert.strictEqual(livingEnemies(g).length, 0);
});

test('落とし物は lootLife ターンで消える', () => {
  const g = newGame();
  const [wolf] = arena(g, { cols: 20, rows: 15, player: [2, 7], enemies: [{ type: 'wolf', at: [10, 7] }] });
  wolf.hp = 1;
  g.rng.force(0.99);
  castAt(g, '1', 10, 7);
  assert.ok(lootsOnGround(g) >= 1, '毛皮を落とす');
  const life = g.PARAMS.economy.lootLife;
  wait(g, life - 2); // 倒した行動 + (life − 2) = life − 1 ターン
  assert.ok(lootsOnGround(g) >= 1);
  wait(g);
  assert.strictEqual(lootsOnGround(g), 0);
});
