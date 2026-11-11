// =====================================================================
//  テストの道具。ゲームの中の名前 (内部の関数・フィールド) に触るのは、なるべくこのファイルだけにする
//  (作りを変えたら、ここを直せばテスト本体はそのまま使えるように)
// =====================================================================
'use strict';

const { loadGame } = require('./harness');

// クロスレルムのオブジェクト (vm の中で作られたもの) を、比べられるふつうの値にする
const plain = (x) => JSON.parse(JSON.stringify(x));

// はじめから遊ぶ状態のゲーム (始まりの町)
function newGame(seed = 1) {
  const g = loadGame({ seed });
  g.startGame(null);
  return g;
}

// ----- 試験場 (テスト用のゾーン) -----
// opts:
//   cols, rows: 大きさ (マス。外周の 1 マスは壁)
//   player: [tx, ty] 主人公の位置
//   walls / water: [[tx, ty, tw, th], ...] 壁 (攻撃も遮る) / 水場 (移動だけ遮る)
//   enemies: [{ type, at: [tx, ty], level (既定 1), camp (同じ名前は同じ群れ。既定は 1 体ずつ別), home: [tx, ty], respawn (既定 99999) }]
//   safe: 安全地帯にする
// 戻り値: enemies と同じ順の敵 (ゲームの中の敵オブジェクト)
let arenaSeq = 0;
function arena(g, opts = {}) {
  const cols = opts.cols || 15, rows = opts.rows || 15, T = g.T;
  const px = (t) => t * T;
  const obstacles = [];
  for (const [x, y, w, h] of opts.walls || []) obstacles.push(['wall', px(x), px(y), px(w), px(h)]);
  for (const [x, y, w, h] of opts.water || []) obstacles.push(['water', px(x), px(y), px(w), px(h)]);
  const specs = (opts.enemies || []).map((s, i) => ({ level: 1, camp: `#${i}`, respawn: 99999, ...s, home: s.home || s.at }));
  const campIds = [...new Set(specs.map((s) => s.camp))];
  const camps = campIds.map((id) => {
    const ms = specs.filter((s) => s.camp === id);
    const c = ms[0].home;
    return { name: `camp ${id}`, x: px(c[0]) + T / 2, y: px(c[1]) + T / 2, level: ms[0].level, respawn: ms[0].respawn, spread: 0,
      members: ms.map((s) => s.type) };
  });
  const id = `__arena${arenaSeq++}`;
  g.WORLD.zones[id] = {
    name: 'テスト場', w: cols * T, h: rows * T, safe: !!opts.safe,
    theme: { ground: '#000', tile: '#000', decor: ['#111', '#222'] },
    obstacles, gates: [], camps, npcs: [],
  };
  const [ptx, pty] = opts.player || [2, 2];
  g.enterZone(id, ptx, pty);
  // 湧いた敵を、決めた位置に置き直す (湧き場所の枠の順 = specs の順)
  const out = specs.map((s) => {
    const ci = campIds.indexOf(s.camp);
    const si = specs.filter((x) => x.camp === s.camp).indexOf(s);
    const e = g.camps[ci].slots[si].enemy;
    if (!e) throw new Error(`arena: ${s.type} が湧かなかった`);
    return e;
  });
  out.forEach((e, i) => {
    const s = specs[i];
    g.placeUnit(e, s.at[0], s.at[1]);
    e.home = { tx: s.home[0], ty: s.home[1] };
  });
  g.computeFlow(g.player.tx, g.player.ty, g.flow);
  return out;
}

// ----- キャラ -----
const allUnits = (g) => g.units.filter((u) => u && !u.dead);
const livingEnemies = (g) => g.units.filter((e) => e.faction === 'enemy' && !e.dead);
// 主人公の陣営のキャラ (仲間) を (tx, ty) に置く。今のゲームにはまだない。行動の決め方は既定で「何もしない」
//   def: { name, stats (もとのステータス。省略したものは主人公の Lv1 の値), gear, color, radius, glyph }
function addAlly(g, at, def = {}, control) {
  const d = { name: '仲間', color: '#66bb6a', radius: 14, glyph: '仲', ...def, stats: { ...g.PLAYER.stats, ...(def.stats || {}) } };
  return g.addUnit(g.createAlly(d, control), at[0], at[1]);
}
// そのマスにいるキャラ (いなければ null)
const unitOn = (g, x, y) => g.unitAt(x, y);
// 敵が狙っている相手
const targetOf = (e) => e.target;
const isHostile = (e) => e.state === 'chase';            // 主人公を追っている
const isReturning = (e) => e.state === 'return';          // 諦めて帰っている
const isIdle = (e) => e.state === 'idle';
const isInvulnerable = (e) => !!e.invuln;
function moveTo(g, u, tx, ty) { g.placeUnit(u, tx, ty); g.computeFlow(g.player.tx, g.player.ty, g.flow); }
// 次に行動できる時刻を決める (行動順のテスト用)
function setNextAction(g, u, t) { u.next = t; }
// ステータスを計算し直す (もとのステータスや装備を書き換えたあと)
function recompute(g, u) { g.refreshStats(u); }
// 主人公のもとのステータスを書き換えて計算し直す
function setPlayerBase(g, values) { Object.assign(g.player.base, values); recompute(g, g.player); }
// 強化・弱体をかける (技を使わずに)。src: かけた者 (省略時は u 自身 = 自分にかけた)
function applyBuff(g, u, id, n, src) { g.addBuff(u, id, n, src); }
const buffsOf = (u) => Array.from(u.buffs || [], (b) => ({ id: b.id }));
// テストだけで使う強化・弱体の種類を足す (data/buffs.js と同じ形 { name, stat, mult, icon, color })
function defineEffect(g, id, def) { g.BUFFS[id] = { icon: '試', color: '#777', ...def }; }
// 湧き場所を通さずに敵を 1 体作る (units には入れない。ステータスを見るだけ)
const makeEnemy = (g, type, level = 1) => g.createEnemy(type, 0, 0, { level }, null);
// 装備なし・強化なしのステータス (bare) と、装備 (敵・仲間は gear) で上がる分 (equip)
const statPartsOf = (g, u) => { const s = g.statParts(u); return { bare: plain(s.bare), equip: plain(s.equip) }; };
// キャラクターの画面の「つよさ」の HTML
const strengthHtml = (g) => g.strengthHtml();
// レベルを 1 上げる (経験値を通さずに)
function levelUp(g) { g.levelUp(); }
// 予告中の技の範囲 (画面の赤いマス) を 'x,y' の集合で
const telegraphTiles = (g) => new Set(g.hazards.flatMap((h) => h.tiles.map(([x, y]) => `${x},${y}`)));
const lootsOnGround = (g) => g.loots.length;
// メッセージ欄の文 (新しいものが後ろ。最大 7 行)
const messages = (g) => Array.from(g.logLines, (l) => l.text);

// ----- マップ -----
// 今のゾーンから行き先 to へ行く門のマス (1 つ)
function gateTile(g, to) {
  const gt = g.zone.gates.find((x) => x.to === to);
  return gt ? [gt.tx, gt.ty + Math.floor(gt.th / 2)] : null;
}
const isGate = (g, x, y) => g.inMap(x, y) && g.gateAt[g.idx(x, y)] >= 0;
// 主人公から (tx, ty) までの道の最初の 1 歩 [dx, dy] (なければ null)
function firstStep(g, tx, ty) {
  const path = g.findPath(tx, ty);
  if (!path || !path.length) return null;
  return [path[0][0] - g.player.tx, path[0][1] - g.player.ty];
}

// ----- 行動の記録: 誰がいつ行動したか -----
// 戻り値の配列に { who: 'player' | ほかのキャラ (敵・仲間), t: その時刻 } がたまる。stop() でやめる
// どのキャラも行動のあとに必ず通る後始末 (endTurn) を包んで数える
function traceTurns(g) {
  const log = [];
  const ctx = g.context;
  const orig = ctx.endTurn;
  ctx.endTurn = function (u) { log.push({ who: u === g.player ? 'player' : u, t: g.game.time }); return orig.apply(this, arguments); };
  log.stop = () => { ctx.endTurn = orig; };
  return log;
}

// ----- 入力 (本物のキー入力の処理を通す) -----
function press(g, key, extra = {}) {
  const fns = g.windowListeners.keydown || [];
  const ev = { key, code: extra.code || '', repeat: false, preventDefault() {}, ...extra };
  for (const f of fns) f(ev);
}
const DIR_KEY = { '0,-1': 'w', '0,1': 's', '-1,0': 'a', '1,0': 'd', '-1,-1': 'q', '1,-1': 'e', '-1,1': 'z', '1,1': 'c' };
function step(g, dx, dy) { press(g, DIR_KEY[`${dx},${dy}`]); }
function wait(g, n = 1) { for (let i = 0; i < n; i++) press(g, ' '); }
// スキルを構えて (tx, ty) を狙って使う (キー → マウスの位置 → 同じキー)。強化はキーだけで出る
function castAt(g, key, tx, ty) {
  press(g, key);
  if (!g.aiming) return;
  g.mouse.tx = tx; g.mouse.ty = ty;
  press(g, key);
}
const skill = (g, key) => g.SKILLS.find((s) => s.key === key);
// 技の範囲を 'x,y' の並び (ソート済み) で
function attackTiles(g, u, atk, tx, ty) {
  return Array.from(g.planAttack(u, atk, tx, ty).tiles, ([x, y]) => `${x},${y}`).sort();
}
// 技をその場で出す (予告なしで判定まで)
function performAttack(g, u, atk, tx, ty) { g.resolveAttack(g.planAttack(u, atk, tx, ty)); }
// キャラ u に技 sk を (tx, ty) へ向けて使わせる (どのキャラも同じ道 useSkill。行動の後始末はしない)。使えたら true
const useSkillBy = (g, u, sk, tx, ty) => g.useSkill(u, sk, tx, ty);
// 技の再使用までの残り / 使ったときの再使用待ちの長さ / 使えるか (再使用待ちと MP)
const cooldownLeftOf = (g, u, sk) => g.cooldownLeft(u, sk);
const cooldownLengthOf = (g, u, sk) => g.skillCooldown(u, sk);
const canUseSkillOf = (g, u, sk) => g.canUseSkill(u, sk);
// 再使用待ちを決める (技を使わずに)
function setCooldown(g, u, sk, n) { u.skillCd[g.skillKey(u, sk)] = n; }
// 敵の技を名前で
const enemyAttack = (e, name) => e.def.attacks.find((a) => a.name === name);
// 実時間を進める (倒れてから復活するまでなど)。sec 秒ぶんフレームの更新を回す
function runFrames(g, sec, dt = 0.05) { for (let t = 0; t < sec; t += dt) { g.game.rt += dt; g.updateWorld(dt); } }

module.exports = {
  plain, newGame, arena, allUnits, livingEnemies, addAlly, unitOn, targetOf, isHostile, isReturning, isIdle, isInvulnerable, moveTo, setNextAction,
  recompute, setPlayerBase, applyBuff, buffsOf, defineEffect, makeEnemy, statPartsOf, strengthHtml, levelUp, telegraphTiles, lootsOnGround, messages, traceTurns,
  press, step, wait, castAt, skill, attackTiles, performAttack, runFrames, gateTile, isGate, firstStep,
  useSkillBy, cooldownLeftOf, cooldownLengthOf, canUseSkillOf, setCooldown, enemyAttack,
};
