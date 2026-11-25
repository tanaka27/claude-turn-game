// 技を使う道 (useSkill) がどのキャラにも同じように使えるか: 仲間 (テスト用) が主人公のスキル・予告ありの技を使う、
// 再使用待ちと MP、敵が自分を強化する技、主人公と敵で違う再使用待ち・MP の決まり (今の動きのまま)
'use strict';
const assert = require('assert');
const {
  newGame, arena, addAlly, skill, castAt, press, wait, traceTurns, telegraphTiles, messages, buffsOf, setPlayerBase, makeEnemy, recompute,
  useSkillBy, cooldownLeftOf, cooldownLengthOf, canUseSkillOf, setCooldown, enemyAttack,
} = require('./helpers');

// 主人公は壁の向こうの遠く (敵から見えない・届かない) に置く
const HIDE = { cols: 30, rows: 15, player: [27, 7], walls: [[22, 1, 1, 13]] };
// 主人公のスキルを持った仲間 (MP は多め)
const heroSkillAlly = (g, at, extra = {}) =>
  addAlly(g, at, { stats: { wis: 40, spi: 40 }, skills: ['1', '2', '3', '4', '5'].map((k) => skill(g, k)), ...extra });
const last = (g) => messages(g)[messages(g).length - 1];

test('仲間が弾のスキル (衝撃波) を使う: 当たり、MP を払い、再使用待ちになる', () => {
  const g = newGame();
  const [e] = arena(g, { ...HIDE, enemies: [{ type: 'golem', at: [9, 7] }] });
  const ally = heroSkillAlly(g, [4, 7]);
  const sk = skill(g, '1');
  g.rng.force(0.99, 0.5);
  assert.strictEqual(useSkillBy(g, ally, sk, 9, 7), true);
  assert.ok(e.hp < e.stats.maxHp);
  assert.strictEqual(ally.mp, 40 - sk.mp);
  assert.strictEqual(cooldownLeftOf(g, ally, sk), cooldownLengthOf(g, ally, sk));
  assert.ok(cooldownLeftOf(g, ally, sk) > 0);
  assert.ok(!canUseSkillOf(g, ally, sk));
  // 主人公だけの「衝撃波！」は出ず、ダメージの文に仲間の名前が出る
  assert.ok(!messages(g).includes('衝撃波！'));
  assert.ok(last(g).startsWith('仲間の衝撃波！ ロックゴーレムに '), last(g));
});

test('仲間がまわりの範囲のスキル (旋風斬) を使う: まわりの敵みなに当たる', () => {
  const g = newGame();
  const es = arena(g, { ...HIDE, enemies: [{ type: 'golem', at: [9, 7] }, { type: 'golem', at: [11, 8] }] });
  const ally = heroSkillAlly(g, [10, 7]);
  const sk = skill(g, '2');
  assert.strictEqual(useSkillBy(g, ally, sk, 10, 7), true);
  for (const e of es) assert.ok(e.hp < e.stats.maxHp);
  assert.strictEqual(ally.mp, 40 - sk.mp);
  assert.strictEqual(cooldownLeftOf(g, ally, sk), cooldownLengthOf(g, ally, sk));
});

test('仲間が投げるスキル (メテオ) を使う: 狙ったマスのまわりに当たる', () => {
  const g = newGame();
  const [e] = arena(g, { ...HIDE, enemies: [{ type: 'golem', at: [11, 7] }] });
  const ally = heroSkillAlly(g, [5, 7]);
  const sk = skill(g, '3');
  assert.strictEqual(useSkillBy(g, ally, sk, 11, 7), true);
  assert.ok(e.hp < e.stats.maxHp);
  assert.strictEqual(ally.mp, 40 - sk.mp);
  assert.strictEqual(cooldownLeftOf(g, ally, sk), cooldownLengthOf(g, ally, sk));
});

test('仲間がダッシュを使う: 狙った向きへ distance マス進む。進めなければ使えず、主人公向けの文も出ない', () => {
  const g = newGame();
  arena(g, HIDE);
  const ally = heroSkillAlly(g, [3, 7]);
  const sk = skill(g, '4');
  assert.strictEqual(useSkillBy(g, ally, sk, 12, 7), true);
  assert.deepStrictEqual([ally.tx, ally.ty], [3 + sk.distance, 7]);
  assert.strictEqual(ally.mp, 40 - sk.mp);
  assert.strictEqual(cooldownLeftOf(g, ally, sk), cooldownLengthOf(g, ally, sk));
  // 壁に向かって: 進めない
  const other = heroSkillAlly(g, [1, 3]);
  const before = messages(g).length;
  assert.strictEqual(useSkillBy(g, other, sk, 0, 3), false);
  assert.deepStrictEqual([other.tx, other.ty], [1, 3]);
  assert.strictEqual(other.mp, 40);
  assert.strictEqual(cooldownLeftOf(g, other, sk), 0);
  assert.strictEqual(messages(g).length, before);
});

test('仲間が強化のスキル (闘気) を使う: 自分に攻撃力アップがかかり、文に名前が付く', () => {
  const g = newGame();
  arena(g, HIDE);
  const ally = heroSkillAlly(g, [5, 7]);
  const sk = skill(g, '5');
  const atk0 = ally.stats.atk;
  assert.strictEqual(useSkillBy(g, ally, sk, ally.tx, ally.ty), true);
  assert.deepStrictEqual(buffsOf(ally), [{ id: 'atkUp' }]);
  assert.ok(Math.abs(ally.stats.atk - atk0 * g.BUFFS.atkUp.mult) < 1e-9);
  assert.strictEqual(last(g), '仲間の闘気！ 攻撃力アップ（6 行動）');
  assert.strictEqual(ally.mp, 40 - sk.mp);
  assert.strictEqual(cooldownLeftOf(g, ally, sk), cooldownLengthOf(g, ally, sk));
});

test('仲間の予告ありの技: 予告を出し、仲間の次の行動で範囲にいる敵に当たる (範囲の外の敵には当たらない)', () => {
  const g = newGame();
  const [near, far] = arena(g, { ...HIDE, enemies: [{ type: 'golem', at: [11, 7] }, { type: 'golem', at: [17, 7] }] });
  const slam = { name: 'テスト叩きつけ', type: 'melee', shape: 'circle', range: 2.3, charge: 1, cooldown: 3, mp: 4, power: 1.6 };
  const ally = addAlly(g, [10, 7], { stats: { con: 200, will: 200 }, skills: [slam] });
  const mp0 = ally.mp;
  assert.strictEqual(useSkillBy(g, ally, slam, 11, 7), true);
  assert.strictEqual(last(g), '仲間はテスト叩きつけの構えをとった。');
  assert.ok(telegraphTiles(g).has('11,7'));
  assert.strictEqual(near.hp, near.stats.maxHp, 'まだ当たらない');
  assert.strictEqual(ally.mp, mp0 - slam.mp);
  assert.strictEqual(cooldownLeftOf(g, ally, slam), 3);
  const tr = traceTurns(g);
  const allyTurns = () => tr.filter((x) => x.who === ally).length;
  for (let i = 0; i < 10 && allyTurns() < 1; i++) {
    assert.ok(telegraphTiles(g).size > 0, '仲間が行動するまで予告は残る');
    wait(g);
  }
  tr.stop();
  assert.strictEqual(allyTurns(), 1);
  assert.strictEqual(telegraphTiles(g).size, 0);
  assert.ok(near.hp < near.stats.maxHp, '範囲の敵に当たる');
  assert.strictEqual(far.hp, far.stats.maxHp, '範囲の外の敵には当たらない');
  // 主人公の決まり (仲間の省略時) では、技を出す行動でも再使用待ちが 1 減る
  assert.strictEqual(cooldownLeftOf(g, ally, slam), 2);
});

test('再使用待ちの技・MP が足りない技は使えない (何も変わらない)', () => {
  const g = newGame();
  const [e] = arena(g, { ...HIDE, enemies: [{ type: 'golem', at: [9, 7] }] });
  const ally = heroSkillAlly(g, [4, 7]);
  const sk = skill(g, '1');
  setCooldown(g, ally, sk, 2);
  const before = messages(g).length;
  assert.strictEqual(useSkillBy(g, ally, sk, 9, 7), false);
  assert.strictEqual(ally.mp, 40);
  assert.strictEqual(cooldownLeftOf(g, ally, sk), 2);
  setCooldown(g, ally, sk, 0);
  ally.mp = sk.mp - 1;
  assert.strictEqual(useSkillBy(g, ally, sk, 9, 7), false);
  assert.strictEqual(ally.mp, sk.mp - 1);
  assert.strictEqual(cooldownLeftOf(g, ally, sk), 0);
  assert.strictEqual(e.hp, e.stats.maxHp);
  assert.strictEqual(messages(g).length, before);
  // 敵も同じ
  const boar = makeEnemy(g, 'boar');
  const horn = enemyAttack(boar, '角突き');
  setCooldown(g, boar, horn, 1);
  assert.ok(!canUseSkillOf(g, boar, horn));
  setCooldown(g, boar, horn, 0);
  boar.mp = horn.mp - 0.5;
  assert.ok(!canUseSkillOf(g, boar, horn));
  boar.mp = horn.mp;
  assert.ok(canUseSkillOf(g, boar, horn));
});

test('敵が強化の技を自分に使う: 強化がかかり、敵の決まりで再使用待ちになる', () => {
  const g = newGame();
  const [boar] = arena(g, { ...HIDE, enemies: [{ type: 'boar', at: [8, 7] }] });
  const rally = { key: 'testRally', name: '気合', type: 'buff', buff: 'atkUp', duration: 3, cooldown: 5, mp: 2 };
  const atk0 = boar.stats.atk, mp0 = boar.mp;
  assert.strictEqual(useSkillBy(g, boar, rally, boar.tx, boar.ty), true);
  assert.deepStrictEqual(buffsOf(boar), [{ id: 'atkUp' }]);
  assert.ok(boar.stats.atk > atk0);
  assert.strictEqual(boar.mp, mp0 - 2);
  assert.strictEqual(last(g), 'ホーンボアの気合！ 攻撃力アップ（3 行動）');
  const n = cooldownLeftOf(g, boar, rally);
  assert.strictEqual(n, Math.max(1, Math.round(5 * 100 / (100 + boar.stats.skillHaste))));
  assert.ok(Number.isInteger(n));
});

// ----- 主人公と敵で違う決まり (今の動きをそのまま固定する) -----

test('主人公の決まり: 再使用待ちはスキル加速で割った小数のまま、使った行動で 1 減る', () => {
  const g = newGame();
  arena(g, { cols: 15, rows: 15, player: [7, 7], safe: true });
  setPlayerBase(g, { int: 30 }); // スキル加速 10
  const p = g.player, sk = skill(g, '1');
  assert.strictEqual(p.stats.skillHaste, 10);
  const len = sk.cooldown * 100 / 110;
  assert.strictEqual(cooldownLengthOf(g, p, sk), len);
  assert.ok(!Number.isInteger(len));
  castAt(g, '1', 12, 7);
  assert.ok(Math.abs(cooldownLeftOf(g, p, sk) - (len - 1)) < 1e-9);
  wait(g);
  assert.ok(Math.abs(cooldownLeftOf(g, p, sk) - (len - 2)) < 1e-9);
});

test('敵の決まり: 再使用待ちは四捨五入して最低 1 (同じスキル加速の仲間は小数のまま)', () => {
  const g = newGame();
  arena(g, HIDE);
  const boar = makeEnemy(g, 'boar');
  boar.baseStats.int = 60; // スキル加速 25
  recompute(g, boar);
  assert.strictEqual(boar.stats.skillHaste, 25);
  const horn = enemyAttack(boar, '角突き'); // 再使用 4 → 4 × 100 / 125 = 3.2
  assert.strictEqual(cooldownLengthOf(g, boar, horn), 3);
  assert.strictEqual(cooldownLengthOf(g, boar, { cooldown: 1 }), 1);
  const ally = addAlly(g, [3, 3], { stats: { int: 60 } });
  assert.strictEqual(ally.stats.skillHaste, 25);
  assert.strictEqual(cooldownLengthOf(g, ally, horn), 3.2);
  assert.strictEqual(cooldownLengthOf(g, ally, { cooldown: 1 }), 0.8);
});

test('敵の決まり: 再使用待ちは自分の行動の初めに 1 減り、予告の技を出す行動では減らない', () => {
  const g = newGame();
  const [boar] = arena(g, { cols: 20, rows: 15, player: [4, 7], enemies: [{ type: 'boar', at: [12, 7] }] });
  const horn = enemyAttack(boar, '角突き');
  setCooldown(g, boar, horn, 0);
  boar.mp = boar.stats.maxMp;
  // 主人公とは反対の向きへ構えさせる
  assert.strictEqual(useSkillBy(g, boar, horn, 16, 7), true);
  const len = cooldownLeftOf(g, boar, horn);
  assert.strictEqual(len, cooldownLengthOf(g, boar, horn));
  const tr = traceTurns(g);
  const boarTurns = () => tr.filter((x) => x.who === boar).length;
  for (let i = 0; i < 10 && boarTurns() < 1; i++) wait(g);
  assert.strictEqual(boarTurns(), 1);
  assert.strictEqual(telegraphTiles(g).size, 0, '予告の技を出した');
  assert.strictEqual(cooldownLeftOf(g, boar, horn), len, '技を出す行動では減らない');
  for (let i = 0; i < 10 && boarTurns() < 2; i++) wait(g);
  tr.stop();
  assert.strictEqual(boarTurns(), 2);
  assert.strictEqual(cooldownLeftOf(g, boar, horn), len - 1, '次の行動の初めに 1 減る');
});

test('MP の決まり: 主人公の決まりは切り捨てで比べて払うと 0 で止まる、敵は小数のまま比べて 0 で止めない', () => {
  const g = newGame();
  arena(g, HIDE);
  const ally = addAlly(g, [3, 3]);
  const boar = makeEnemy(g, 'boar');
  const half = { key: 'testHalf', name: '半端', type: 'buff', buff: 'atkUp', duration: 1, cooldown: 1, mp: 2.5 };
  ally.mp = 2.7; boar.mp = 2.7;
  assert.ok(!canUseSkillOf(g, ally, half), '切り捨てて 2 < 2.5');
  assert.ok(canUseSkillOf(g, boar, half), '2.7 >= 2.5');
  // 回復の途中で 3 にわずかに足りない MP (1e-9 までは足りることにする)
  const three = { ...half, key: 'testThree', mp: 3 };
  ally.mp = 3 - 1e-10; boar.mp = 3 - 1e-10;
  assert.strictEqual(useSkillBy(g, ally, three, ally.tx, ally.ty), true);
  assert.strictEqual(ally.mp, 0);
  assert.strictEqual(useSkillBy(g, boar, three, 0, 0), true);
  assert.ok(boar.mp < 0 && boar.mp > -1e-9);
});

test('主人公のスキルの文は今までどおり (闘気・衝撃波・進めないダッシュ)', () => {
  const g = newGame();
  arena(g, { cols: 15, rows: 15, player: [1, 7], safe: true });
  press(g, '5');
  assert.strictEqual(last(g), '闘気！ 攻撃力アップ（6 行動）');
  castAt(g, '1', 8, 7);
  assert.strictEqual(last(g), '衝撃波！');
  castAt(g, '4', 0, 7);
  assert.strictEqual(last(g), 'その方向には進めない。');
});
