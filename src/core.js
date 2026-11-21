// =====================================================================
//  共通 (ユーティリティ・画面の大きさ・ゲームの状態・演出の追加・メッセージ欄)
// =====================================================================
'use strict';

const P = PARAMS;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ===================================================================
//  ユーティリティ
// ===================================================================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}
function norm(x, y) {
  const l = Math.hypot(x, y);
  return l > 1e-6 ? [x / l, y / l] : [0, 0];
}

// ===================================================================
//  画面に出す文章 (data/text.js の TEXT)
//  txt('combat.heroHurt', { src: 'ウルフ', ... }): TEXT のキー (まとまり.名前) の文の {名前} に値を入れて返す
//  キーがない・{名前} に入れる値がないときは、コンソールに [データの確認] を 1 回だけ出す (キーがなければキーをそのまま返す)
// ===================================================================
const textNoticed = new Set();
function textProblem(msg) {
  if (textNoticed.has(msg)) return;
  textNoticed.add(msg);
  console.error('[データの確認]', msg);
}
// 文の {名前} に values の値を入れる (値は文字列にする。テンプレートリテラルの ${} と同じ)
function fmt(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (m, k) => {
    if (Object.prototype.hasOwnProperty.call(values, k)) return String(values[k]);
    textProblem(`data/text.js の文の {${k}} に入れる値がない: ${template}`);
    return m;
  });
}
const textTemplate = (key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), TEXT);
function txt(key, values) {
  const t = textTemplate(key);
  if (typeof t !== 'string') { textProblem(`文 '${key}' が data/text.js にない`); return key; }
  return fmt(t, values);
}

const FC = THEME.faction; // 陣営ごとの色 (FC.player / FC.enemy)

// ===================================================================
//  画面
// ===================================================================
const T = 40;  // 1 マスの大きさ (px)
let W = 0, H = 0, DPR = 1, VIEW = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const [cols, rows] = PARAMS.field.viewTiles;
  VIEW = Math.min(W / (cols * T), H / (rows * T));
}
window.addEventListener('resize', resize);
resize();

// ===================================================================
//  ゲーム状態
//  time: ゲーム内の時刻 (ターン)。主人公と敵の行動でだけ進む
//  rt: 実時間 (秒)。アニメーションと演出に使う
// ===================================================================
const game = { state: 'title', paused: false, kills: 0, time: 0, rt: 0, saveT: 0, deathLoss: null,
  msg: '', sub: '', msgT: 0, shake: 0, dyingT: 0, inputT: 0 };
const TN = P.turn, F = P.field, AI = P.field.ai, PG = P.progression, EC = P.economy, IT = ITEMS;
// 今いるゾーンの湧き場所。slots は群れの一員ごとの枠 (enemy: 生きている敵 / pending: 出現予告中 / timer: 再出現までの残りターン)
let camps = [];
// 離れたゾーンの湧き場所の状態 (ゾーン id → 離れた時刻と、枠ごとの再出現までの残りターン)
const zoneMemory = {};
const inSafeZone = () => !!zone.safe;
const expToNext = (lv) => Math.round(PG.expBase * Math.pow(lv, PG.expExponent));
// units: 今のゾーンで戦うキャラ全員 (主人公・敵・これからの仲間)。どのキャラも faction (陣営) を持つ。
//   「このマスに誰がいるか」「誰が次に行動するか」「誰が回復するか」はここから探す (主人公も入る。先頭)
// player: そのうち人が操作するキャラ (主人公)。入力・カメラ・HUD・セーブは主人公を見る
let player = null;
let units = [], hazards = [], effects = [], texts = [], spawns = [], loots = [];
// 陣営 f のキャラ (倒れて片付く前のものも入る。描画・HUD 用)
const factionUnits = (f) => units.filter((u) => u.faction === f);
// 陣営 a から見て陣営 b が敵か (NPC はどちらとも戦わない)
const hostileTo = (a, b) => (a === 'player' && b === 'enemy') || (a === 'enemy' && b === 'player');
const cam = { x: 0, y: 0 };
const mouse = { x: 0, y: 0, wx: 0, wy: 0, tx: 0, ty: 0 };
let aiming = null;

const BASIC = PLAYER.basicAttack;

const $ = (id) => document.getElementById(id);

// ===================================================================
//  エフェクト (実時間で動く)
//  演出は下の fx〇〇 で作る (effects に足すのはここだけ)。種類ごとの描き方は src/render.js の EFFECT_TYPES、
//  意味のある色・大きさ・続く秒数は data/theme.js の THEME.fx
// ===================================================================
const FX = THEME.fx;
function floatText(x, y, text, color, size) {
  texts.push({ x, y, text, color, size, t: 0, life: 0.9, vy: -50 });
}
// 種類 type の演出を 1 つ足す (t: 経った秒数。life になったら消える)
function addEffect(type, props) {
  const f = { type, t: 0, ...props };
  effects.push(f);
  return f;
}
// 火花を n 個、ばらばらの向きに飛ばす (速さは sp × minSpeed〜sp)。乱数は 1 個につき 向き・速さ・life・size の順に引く
function burst(x, y, color, n, sp) {
  const P = FX.particle;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(sp * P.minSpeed, sp);
    addEffect('particle', { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(P.life[0], P.life[1]), color, size: rand(P.size[0], P.size[1]) });
  }
}
// 形ごとの演出: 広がる輪 (半径 r0 → r1、color は 'r,g,b') / マスが光る / 弾の線 / 投げたものの放物線 / ダッシュの残像
const fxRing = (x, y, r0, r1, life, color) => addEffect('ring', { x, y, r0, r1, life, color });
const fxTiles = (tiles, faction, life) => addEffect('tiles', { tiles, life, faction });
const fxBolt = (x0, y0, x1, y1, faction) => addEffect('bolt', { x0, y0, x1, y1, life: FX.bolt.life, faction });
const fxArc = (x0, y0, x1, y1, faction) => addEffect('arc', { x0, y0, x1, y1, life: FX.lob.arcLife, faction });
const fxGhost = (x, y, r, color) => addEffect('ghost', { x, y, r, life: FX.ghost.life, color });
// 意味ごとの演出 (色と数は THEME.fx)
// 当たった (ours: 主人公の陣営が受けた。crit: 会心)
function fxHit(u, ours, crit) { const H = FX.hit; burst(u.x, u.y, ours ? H.ours : u.color, crit ? H.critN : H.n, H.speed); }
// 倒れた (火花のあと白い輪)
function fxDeath(u) {
  const D = FX.death;
  burst(u.x, u.y, u.color, u.isBoss ? D.bossN : D.n, u.isBoss ? D.bossSpeed : D.speed);
  fxRing(u.x, u.y, u.r, u.r * D.ringScale, D.life, D.ring);
}
// レベルアップ / 自分を強化した (輪のあと火花)
function fxLevelUp(u) { const L = FX.levelUp; fxRing(u.x, u.y, u.r, u.r * L.ringScale, L.life, L.ring); burst(u.x, u.y, L.spark, L.n, L.speed); }
function fxBuff(u) { const B = FX.buff; fxRing(u.x, u.y, u.r, u.r * B.ringScale, B.life, B.ring); burst(u.x, u.y, B.spark, B.n, B.speed); }
// 回復薬
function fxHeal(u) { burst(u.x, u.y, FX.heal.spark, FX.heal.n, FX.heal.speed); }
// 敵が湧いた (半径 r の輪が広がる)
function fxSpawn(x, y, r) { fxRing(x, y, r, r * FX.spawn.ringScale, FX.spawn.life, THEME.spawn); }
// 投げる技: (x0, y0) から (x, y) へ放物線で飛び、半径 radius (マス) の輪と陣営の色の火花
function fxLobImpact(x0, y0, x, y, radius, faction) {
  const L = FX.lob;
  fxArc(x0, y0, x, y, faction);
  fxRing(x, y, radius * T * L.ringFrom, (radius + L.ringPad) * T, L.ringLife, FC[faction].rgb);
  burst(x, y, FC[faction].spark, L.n, L.speed);
}
const addShake = (v) => { game.shake = Math.max(game.shake, v); };
function showMsg(m, sub) { game.msg = m; game.sub = sub || ''; game.msgT = 2.2; }

// ===================================================================
//  メッセージ欄 (画面左下。何が起きたかを文字で残す)
// ===================================================================
const logLines = [];
const LOG_MAX = 7;
function log(text, color) {
  logLines.push({ text, color: color || THEME.msg.normal, rt: game.rt });
  if (logLines.length > LOG_MAX) logLines.shift();
}
