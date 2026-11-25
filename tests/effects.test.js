// 強化・弱体 (コードでは buff) が、主人公だけでなく敵・仲間にも同じしくみで効くか
// 弱体 (倍率 1 未満) の種類はまだゲームのデータにないので、テストの中で defineEffect で足して使う
'use strict';
const assert = require('assert');
const {
  newGame, arena, plain, addAlly, applyBuff, buffsOf, defineEffect, makeEnemy, statPartsOf, strengthHtml, levelUp,
  recompute, step, wait, traceTurns, moveTo, isReturning, isIdle, messages, performAttack,
} = require('./helpers');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} ${a} != ${b}`);
const testItem = (slot, stats) => ({ id: `t-${slot}`, slot, name: 'テスト品', rarity: 'common', level: 1, stats });

// テスト用の強化・弱体
function withEffects(g) {
  defineEffect(g, 'defDown', { name: '守備ダウン', stat: 'def', mult: 0.5 });
  defineEffect(g, 'atkDown', { name: '攻撃ダウン', stat: 'atk', mult: 0.5 });
  defineEffect(g, 'spdDown', { name: '鈍足', stat: 'speed', mult: 0.5 });
  defineEffect(g, 'spdUp', { name: '加速', stat: 'speed', mult: 1.5 });
  defineEffect(g, 'hpDown', { name: '体力ダウン', stat: 'maxHp', mult: 0.5 });
  defineEffect(g, 'mdefDown', { name: '術防御ダウン', stat: 'mdef', mult: 0.5 });
  return g;
}
const game = (seed) => withEffects(newGame(seed));
const count = (tr, u) => tr.filter((x) => x.who === u).length;

// ----- 効果がなければ、計算し直しても作ったときと同じ -----

// 敵の作ったときのステータス (今までの createEnemy の式: レベルで補正したもとのステータス + gear を deriveStats)
function enemyStatsByFormula(g, type, level) {
  const d = g.ENEMIES[type], EL = g.PARAMS.enemyLevel, k = level - 1;
  const b = { ...d.stats };
  for (const s of ['con', 'will']) b[s] *= 1 + EL.hpGrowth * k;
  for (const s of ['mag', 'spi']) b[s] *= 1 + EL.mpGrowth * k;
  for (const s of ['mus', 'dex']) b[s] *= 1 + EL.strGrowth * k;
  b.int *= 1 + EL.intGrowth * k;
  b.agi += EL.agiGrowth * k;
  const dg = d.gear || {};
  const st = plain(g.deriveStats(b, [{ ...dg, vit: (dg.vit || 0) + EL.vitGrowth * k, mdef: (dg.mdef || 0) + EL.mdefGrowth * k }]));
  // 計算し直すとき (computeStats) は装備の分を足し戻した値を 1e-9 で丸めるので、同じように丸めて比べる
  for (const s in st) st[s] = Math.round(st[s] * 1e9) / 1e9;
  return st;
}

test('効果なし: どの敵もどのレベルでも、作ったときのステータスは今までの式とまったく同じで、計算し直しても変わらない', () => {
  const g = game();
  for (const type of Object.keys(g.ENEMIES)) {
    for (const level of [1, 3, 7, 12, 20, 40]) {
      const e = makeEnemy(g, type, level);
      const want = enemyStatsByFormula(g, type, level);
      assert.deepStrictEqual(plain(e.stats), want, `${type} Lv${level} 作ったとき`);
      assert.strictEqual(e.hp, want.maxHp);
      assert.strictEqual(e.mp, want.maxMp);
      recompute(g, e);
      assert.deepStrictEqual(plain(e.stats), want, `${type} Lv${level} 計算し直し`);
      assert.strictEqual(e.hp, want.maxHp);
    }
  }
});

test('効果なし: 湧き場所から湧いた敵 (Lv1 と Lv7) を計算し直しても同じ', () => {
  const g = game();
  const es = arena(g, { cols: 14, rows: 14, player: [2, 2], enemies: [{ type: 'wolf', at: [9, 9] }, { type: 'golem', at: [11, 11], level: 7 }] });
  for (const e of es) {
    const st = plain(e.stats), hp = e.hp, mp = e.mp;
    recompute(g, e);
    assert.deepStrictEqual(plain(e.stats), st);
    assert.strictEqual(e.hp, hp);
    assert.strictEqual(e.mp, mp);
  }
});

test('効果なし: 仲間 (gear あり・なし) を計算し直しても作ったときと同じ', () => {
  const g = game();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  const a = addAlly(g, [7, 7], { stats: { agi: 33, mus: 12.5, dex: 12.5 }, gear: { atk: 3, mdef: 2, luk: 5 } });
  const b = addAlly(g, [8, 8]);
  for (const u of [a, b]) {
    const want = plain(g.deriveStats({ ...u.def.stats }, [u.def.gear]));
    assert.deepStrictEqual(plain(u.stats), want);
    recompute(g, u);
    assert.deepStrictEqual(plain(u.stats), want);
    assert.strictEqual(u.hp, want.maxHp);
  }
});

// ----- 敵への弱体 -----

// しゅび力 14 がすべて みのまもり (筋力 35・器用さ 35 から計算) から来るゴーレム。
// gear の みのまもり は装備と同じで弱体の倍率を受けないので、弱体の確かめでは gear に置かない
function bareGolem(g) {
  const d = g.ENEMIES.golem;
  g.ENEMIES.golem = { ...d, stats: { ...d.stats, mus: 35, dex: 35 }, gear: { ...d.gear, vit: 0 } };
}

test('敵の守備ダウン: しゅび力が下がり、主人公の通常攻撃で受けるダメージが増える', () => {
  const g = game();
  bareGolem(g);
  const [e] = arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type: 'golem', at: [6, 5] }] });
  const hitOnce = () => {
    e.hp = e.stats.maxHp;
    g.rng.force(0.99, 0.5); // 会心なし・ぶれなし
    performAttack(g, g.player, { ...g.PLAYER.basicAttack, type: 'melee', shape: 'fan', range: 1.5, angle: 120 }, e.tx, e.ty);
    return e.stats.maxHp - e.hp;
  };
  assert.strictEqual(hitOnce(), 2); // こうげき力 11 / 2 − しゅび力 14 / 4
  applyBuff(g, e, 'defDown', 3, g.player);
  near(e.stats.def, 7);
  assert.strictEqual(hitOnce(), 4); // 11 / 2 − 7 / 4 = 3.75
});

test('敵の守備ダウン: その敵自身の行動 3 回で切れ、元の値にぴったり戻る', () => {
  const g = game();
  bareGolem(g);
  const [e] = arena(g, { cols: 12, rows: 12, player: [2, 2], safe: true, enemies: [{ type: 'golem', at: [9, 9] }] });
  g.rng.constant(0.9); // うろつかない
  const st0 = plain(e.stats);
  applyBuff(g, e, 'defDown', 3, g.player);
  near(e.stats.def, 7);
  const tr = traceTurns(g);
  let n = 0;
  while (buffsOf(e).length && n < 30) { wait(g); n++; }
  tr.stop();
  assert.deepStrictEqual(buffsOf(e), []);
  assert.strictEqual(count(tr, e), 3, 'ほかの者がかけた弱体は、かかった敵の次の行動から 3 回');
  assert.deepStrictEqual(plain(e.stats), st0, '切れたら元のステータスにぴったり戻る');
  assert.ok(messages(g).includes('ロックゴーレムの守備ダウンの効果が切れた。'), messages(g).join(' / '));
});

test('敵の攻撃ダウン: その敵の与えるダメージが下がる', () => {
  const g = game();
  const [e] = arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true, enemies: [{ type: 'golem', at: [6, 5], level: 7 }] });
  const p = g.player, fist = e.def.attacks[e.basic];
  const hitOnce = () => {
    p.hp = p.stats.maxHp;
    g.rng.force(0.99, 0.5); // 会心なし・ぶれなし
    performAttack(g, e, fist, p.tx, p.ty);
    return p.stats.maxHp - p.hp;
  };
  const d0 = hitOnce();
  assert.strictEqual(d0, Math.round((e.stats.atk * 0.5 - p.stats.def * 0.25) * fist.power));
  const atk0 = e.stats.atk;
  applyBuff(g, e, 'atkDown', 5, p);
  near(e.stats.atk, atk0 * 0.5, 'gear に atk はないので全部に掛かる');
  const d1 = hitOnce();
  assert.strictEqual(d1, Math.round((e.stats.atk * 0.5 - p.stats.def * 0.25) * fist.power));
  assert.ok(d1 < d0, `${d0} → ${d1}`);
});

test('敵の鈍足 (速度 ×0.5): 主人公に比べて行動する回数が半分になる', () => {
  const run = (slow) => {
    const g = game();
    const [w] = arena(g, { cols: 12, rows: 12, player: [2, 2], safe: true, enemies: [{ type: 'wolf', at: [9, 9] }] });
    g.rng.constant(0.9);
    if (slow) applyBuff(g, w, 'spdDown', 1000, g.player);
    const tr = traceTurns(g);
    wait(g, 100);
    tr.stop();
    return { n: count(tr, w), speed: w.stats.speed };
  };
  const a = run(false), b = run(true);
  assert.strictEqual(a.speed, 110);
  near(b.speed, 55);
  assert.ok(Math.abs(a.n - 110) <= 1, `効果なし ${a.n}`);
  assert.ok(Math.abs(b.n - 55) <= 2, `鈍足 ${b.n}`);
});

test('仲間の加速 (速度 ×1.5): 主人公 100 回の間に 150 回ほど行動する', () => {
  const g = game();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true });
  const ally = addAlly(g, [8, 8]);
  applyBuff(g, ally, 'spdUp', 1000, g.player);
  near(ally.stats.speed, 150);
  const tr = traceTurns(g);
  wait(g, 100);
  tr.stop();
  assert.strictEqual(count(tr, 'player'), 100);
  assert.ok(Math.abs(count(tr, ally) - 150) <= 2, `仲間 ${count(tr, ally)}`);
});

test('最大 HP ダウン: 今の HP は新しい最大に切られ、切れても減った HP は戻らない', () => {
  const g = game();
  const [e] = arena(g, { cols: 12, rows: 12, player: [2, 2], safe: true, enemies: [{ type: 'golem', at: [9, 9] }] });
  g.rng.constant(0.9);
  assert.strictEqual(e.hp, 39);
  applyBuff(g, e, 'hpDown', 2, g.player);
  near(e.stats.maxHp, 19.5);
  near(e.hp, 19.5);
  let n = 0;
  while (buffsOf(e).length && n < 30) { wait(g); n++; }
  assert.strictEqual(e.stats.maxHp, 39);
  near(e.hp, 19.5, 'ゴーレムは HP再生 0 なので減ったまま');
});

test('敵の gear は弱体の倍率を受けない (主人公の装備と同じ): 術防御ダウンは装備なしの分だけに掛かる', () => {
  const g = game();
  const [e] = arena(g, { cols: 12, rows: 12, player: [2, 2], safe: true, enemies: [{ type: 'golem', at: [9, 9], level: 7 }] });
  const EL = g.PARAMS.enemyLevel;
  const { bare, equip } = statPartsOf(g, e);
  near(equip.mdef, g.ENEMIES.golem.gear.mdef + EL.mdefGrowth * 6, 'gear の mdef はレベルで伸びた分も入る');
  near(bare.mdef + equip.mdef, e.stats.mdef);
  applyBuff(g, e, 'mdefDown', 5, g.player);
  near(e.stats.mdef, bare.mdef * 0.5 + equip.mdef);
});

// ----- 消えるとき -----

test('諦めて帰った敵は、帰り着いたら強化・弱体が消えてステータスが元に戻る', () => {
  const g = game();
  const [w] = arena(g, { cols: 30, rows: 15, player: [24, 7], enemies: [{ type: 'wolf', at: [23, 7], home: [3, 7] }] });
  const st0 = plain(w.stats);
  g.rng.force(0.99, 0.5);
  step(g, -1, 0); // 殴る → 気づく
  applyBuff(g, w, 'defDown', 999, g.player);
  applyBuff(g, w, 'spdUp', 999, g.player);
  g.rng.constant(0.9);
  if (!isReturning(w)) wait(g);
  assert.ok(isReturning(w));
  assert.strictEqual(buffsOf(w).length, 2, '帰る途中はまだ残る');
  moveTo(g, g.player, 28, 7);
  let n = 0;
  while (isReturning(w) && n < 60) { wait(g); n++; }
  assert.ok(isIdle(w), '帰り着く');
  assert.deepStrictEqual(buffsOf(w), []);
  assert.deepStrictEqual(plain(w.stats), st0);
  assert.strictEqual(w.hp, st0.maxHp);
});

test('倒れると強化・弱体は消える (敵・仲間)', () => {
  const g = game();
  const [e] = arena(g, { cols: 30, rows: 15, player: [5, 5], enemies: [{ type: 'wolf', at: [6, 5] }, { type: 'wolf', at: [20, 7], level: 5 }] });
  applyBuff(g, e, 'defDown', 10, g.player);
  e.hp = 1;
  g.rng.force(0.99, 0.5);
  step(g, 1, 0);
  assert.ok(e.dead);
  assert.deepStrictEqual(buffsOf(e), []);

  const ally = addAlly(g, [21, 7]);
  applyBuff(g, ally, 'spdUp', 50);
  ally.hp = 0.5;
  for (let i = 0; i < 20 && !ally.dead; i++) wait(g);
  assert.ok(ally.dead, '仲間が倒れる');
  assert.deepStrictEqual(buffsOf(ally), []);
  assert.strictEqual(ally.stats.speed, 100);
});

// ----- 主人公への弱体 -----

test('主人公の攻撃ダウン: 同じしくみで効き (装備の分は下がらない)、つよさの画面も出せ、切れると「〇〇の効果が切れた。」', () => {
  const g = game();
  const [e] = arena(g, { cols: 12, rows: 12, player: [5, 5], safe: true, enemies: [{ type: 'wolf', at: [9, 9] }] });
  const p = g.player;
  applyBuff(g, p, 'atkDown', 3, e); // 敵にかけられた
  near(p.stats.atk, 10 * 0.5 + 1); // 装備なし 10 × 0.5 + 木の剣 1
  const html = strengthHtml(g);
  assert.ok(html.includes('class="buffed"'), '弱体中の値も色が変わる');
  wait(g, 2);
  near(p.stats.atk, 6, '主人公の 2 行動ではまだ残る');
  wait(g);
  assert.strictEqual(p.stats.atk, 11);
  assert.deepStrictEqual(buffsOf(p), []);
  assert.ok(messages(g).includes('攻撃ダウンの効果が切れた。'), '主人公のときは名前を付けない');
  strengthHtml(g);
});

// ----- 最大 HP・MP が変わったときの今の値の合わせ方 (付け替え・レベルアップ) -----

test('装備の付け替え: 最大 HP・MP の増減ぶん今の値もずれる (HP は 1、MP は 0 が下限)', () => {
  const g = game();
  const p = g.player;
  p.hp = 10;
  g.unequipItem(p.equip.armor); // 最大 HP 21 → 20
  assert.strictEqual(p.stats.maxHp, 20);
  assert.strictEqual(p.hp, 9);
  g.equipItem(p.inventory.find((x) => x.slot === 'armor'));
  assert.strictEqual(p.hp, 10);
  p.hp = 1;
  g.unequipItem(p.equip.armor);
  assert.strictEqual(p.hp, 1, 'HP は 1 より下がらない');

  const ring = testItem('accessory', { maxMp: 5, maxHp: 4 });
  p.inventory.push(ring);
  p.mp = 3; p.hp = 20;
  g.equipItem(ring);
  assert.strictEqual(p.stats.maxMp, 17);
  assert.strictEqual(p.mp, 8);
  assert.strictEqual(p.hp, 24, '満タンなら満タンのまま');
  p.mp = 2;
  g.unequipItem(ring);
  assert.strictEqual(p.mp, 0, 'MP は 0 より下がらない');
  assert.strictEqual(p.hp, 20);
});

test('レベルアップ: HP・MP とも満タンになる', () => {
  const g = game();
  const p = g.player;
  p.hp = 2; p.mp = 1;
  levelUp(g);
  assert.strictEqual(p.level, 2);
  assert.strictEqual(p.hp, p.stats.maxHp);
  assert.strictEqual(p.mp, p.stats.maxMp);
});
