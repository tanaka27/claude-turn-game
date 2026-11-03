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

const FC = THEME.faction; // 陣営ごとの色 (FC.player / FC.enemy)

// ===================================================================
//  画面
// ===================================================================
let W = 0, H = 0, DPR = 1, VIEW = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  VIEW = clamp(Math.min(W / 1400, H / 860), 0.55, 1.2);
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
let player = null;
let enemies = [], hazards = [], effects = [], texts = [], spawns = [], loots = [];
const cam = { x: 0, y: 0 };
const mouse = { x: 0, y: 0, wx: 0, wy: 0, tx: 0, ty: 0 };
let aiming = null;

const BASIC = PLAYER.basicAttack;
const SKILLS = PLAYER.skills;

const $ = (id) => document.getElementById(id);

// ===================================================================
//  エフェクト (実時間で動く)
// ===================================================================
function floatText(x, y, text, color, size) {
  texts.push({ x, y, text, color, size, t: 0, life: 0.9, vy: -50 });
}
function burst(x, y, color, n, sp) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(sp * 0.3, sp);
    effects.push({ type: 'particle', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.25, 0.55), color, size: rand(2, 4) });
  }
}
const addShake = (v) => { game.shake = Math.max(game.shake, v); };
function showMsg(m, sub) { game.msg = m; game.sub = sub || ''; game.msgT = 2.2; }

// ===================================================================
//  メッセージ欄 (画面左下。何が起きたかを文字で残す)
// ===================================================================
const logLines = [];
const LOG_MAX = 7;
function log(text, color) {
  logLines.push({ text, color: color || '#c9d1d9', rt: game.rt });
  if (logLines.length > LOG_MAX) logLines.shift();
}
