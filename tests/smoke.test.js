// 自動で戦わせる通し試験: はじめから始めて草原へ出て、簡単な方針で数百回行動する。
// 途中で例外が出ないことと、いつも成り立つはずのこと (不変条件) を毎行動確かめる
'use strict';
const assert = require('assert');
const {
  newGame, allUnits, livingEnemies, step, wait, press, castAt, runFrames, gateTile, isGate, firstStep,
} = require('./helpers');

function checkInvariants(g, state, where) {
  const fail = (msg) => assert.fail(`${where}: ${msg}`);
  const t = g.game.time;
  if (!Number.isFinite(t)) fail(`game.time が ${t}`);
  if (t < state.lastTime - 1e-9) fail(`game.time が戻った ${state.lastTime} → ${t}`);
  state.lastTime = t;
  const seen = new Map();
  for (const u of allUnits(g)) {
    const name = u === g.player ? '主人公' : `${u.name}(${u.tx},${u.ty})`;
    for (const k of ['hp', 'mp', 'tx', 'ty']) if (!Number.isFinite(u[k])) fail(`${name} の ${k} が ${u[k]}`);
    for (const k in u.stats) if (typeof u.stats[k] !== 'number' || Number.isNaN(u.stats[k])) fail(`${name} の stats.${k} が ${u.stats[k]}`);
    if (u.hp < 0 || u.hp > u.stats.maxHp + 1e-9) fail(`${name} の HP ${u.hp} / ${u.stats.maxHp}`);
    if (u.mp < -1e-9 || u.mp > u.stats.maxMp + 1e-9) fail(`${name} の MP ${u.mp} / ${u.stats.maxMp}`);
    if (g.isBlocked(u.tx, u.ty)) fail(`${name} が通れないマスにいる`);
    const key = `${u.tx},${u.ty}`;
    if (seen.has(key)) fail(`${name} と ${seen.get(key)} が同じマス ${key}`);
    seen.set(key, name);
  }
}

// 1 回ぶんの方針: HP が少なければ回復薬、となりに敵がいれば殴る、届けばスキル、それ以外は近づく
function decide(g) {
  const p = g.player;
  if (p.hp < p.stats.maxHp * 0.4 && p.potions.potion > 0) return () => press(g, 'r');
  if (g.zone.safe) {
    // 町: 草原への門へ歩く (建物の中にいたら外へ)
    const to = gateTile(g, 'plains') || gateTile(g, 'town');
    const s = to && firstStep(g, to[0], to[1]);
    return s ? () => step(g, s[0], s[1]) : () => wait(g);
  }
  const es = livingEnemies(g);
  if (!es.length) return () => wait(g);
  const dist = (e) => Math.max(Math.abs(e.tx - p.tx), Math.abs(e.ty - p.ty));
  const e = es.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  const d = dist(e);
  const ready = (key) => {
    const sk = g.SKILLS.find((s) => s.key === key);
    return p.level >= sk.unlockLevel && p.skillCd[key] <= 0 && Math.floor(p.mp) >= sk.mp;
  };
  if (d <= 2 && ready('5') && !p.buffs.length) return () => press(g, '5');
  if (d <= 2 && ready('2')) return () => castAt(g, '2', p.tx, p.ty);
  if (d <= 7 && ready('3')) return () => castAt(g, '3', e.tx, e.ty);
  const aligned = e.tx === p.tx || e.ty === p.ty || Math.abs(e.tx - p.tx) === Math.abs(e.ty - p.ty);
  if (d >= 2 && d <= 8 && aligned && ready('1') && g.hasLOS(p.tx, p.ty, e.tx, e.ty)) return () => castAt(g, '1', e.tx, e.ty);
  if (d === 1) return () => step(g, e.tx - p.tx, e.ty - p.ty);
  const s = firstStep(g, e.tx, e.ty);
  if (!s || isGate(g, p.tx + s[0], p.ty + s[1])) return () => wait(g);
  return () => step(g, s[0], s[1]);
}

function autoBattle(seed, actions) {
  const g = newGame(seed);
  const state = { lastTime: g.game.time };
  const stats = { deaths: 0, kills: 0, inPlains: 0, maxLevel: 1 };
  checkInvariants(g, state, 'start');
  for (let i = 0; i < actions; i++) {
    const where = `seed ${seed} 行動 ${i}`;
    if (g.game.state === 'dying') { stats.deaths++; runFrames(g, 2); checkInvariants(g, state, `${where} (復活)`); continue; }
    if (g.game.state === 'menu') g.closeMenu();
    assert.strictEqual(g.game.state, 'play', where);
    const t0 = g.game.time;
    decide(g)();
    if (g.game.time === t0 && g.game.state === 'play') wait(g); // 行動にならなかったら待つ
    if (g.zone.id === 'plains') stats.inPlains++;
    checkInvariants(g, state, where);
    stats.maxLevel = Math.max(stats.maxLevel, g.player.level);
  }
  stats.kills = g.game.kills;
  return { g, stats };
}

for (const seed of [1, 2, 3]) {
  test(`自動で 400 行動戦っても壊れない (seed ${seed})`, () => {
    const { g, stats } = autoBattle(seed, 400);
    assert.ok(stats.inPlains > 100, `草原で戦っている (${stats.inPlains})`);
    assert.ok(stats.kills >= 3, `敵を倒している (${stats.kills})`);
    const errors = g.consoleLog.filter((m) => m.level === 'error');
    assert.deepStrictEqual(errors.map((m) => m.text), []);
  });
}
