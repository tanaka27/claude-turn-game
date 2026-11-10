// =====================================================================
//  テスト用の土台: ゲームの本物のファイルを、index.html と同じ順に 1 つの vm の中で読み込む
//  ブラウザの機能 (document / canvas / localStorage / fetch など) は、読み込みで落ちない程度の代わりを置く。
//  描画は動かさない (requestAnimationFrame は呼ばれても何もしない)。
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// index.html の <script src="..."> を上から順に読む (読み込み順を写し持たないため)
function scriptList() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script\s+[^>]*src="([^"]+)"[^>]*>\s*<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  if (!out.length) throw new Error('index.html に <script src> が見つからない');
  return out;
}

// 読み込んだファイルは一度だけ解釈し、テストごとの新しい vm で実行し直す
let compiled = null;
function compiledScripts() {
  if (!compiled) {
    compiled = scriptList().map((src) => {
      const file = path.join(ROOT, src);
      return new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
    });
  }
  return compiled;
}

// ----- 乱数: 種から決まる乱数 (mulberry32)。force で次に返す値を決められる -----
function makeRng(seed) {
  let s = seed >>> 0;
  const queue = [];
  let constant = null;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = () => {
    if (queue.length) return queue.shift();
    if (constant !== null) return constant;
    return next();
  };
  rng.seed = (n) => { s = n >>> 0; queue.length = 0; constant = null; };
  rng.force = (...vals) => { queue.push(...vals); };       // 次に返す値を順に決める
  rng.constant = (v) => { constant = v; };                 // ずっとこの値を返す (null でやめる)
  rng.clear = () => { queue.length = 0; constant = null; };
  rng.pending = () => queue.length;
  return rng;
}

// ----- ブラウザの代わり -----
// 何をしても落ちない値 (2D コンテキスト・グラデーションなど)。数として使うと 0
function anything() {
  const store = {};
  const fn = function () {};
  const p = new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      if (k in store) return store[k];
      if (k === 'measureText') return () => ({ width: 0 });
      return anything();
    },
    set(t, k, v) { store[k] = v; return true; },
    apply() { return anything(); },
  });
  return p;
}

function makeElement(id) {
  const listeners = {};
  const classes = new Set();
  return {
    id, style: {}, dataset: {}, textContent: '', innerHTML: '', className: '', value: '', disabled: false, children: [],
    width: 0, height: 0, onclick: null,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, on) => { const v = on === undefined ? !classes.has(c) : !!on; if (v) classes.add(c); else classes.delete(c); return v; },
      contains: (c) => classes.has(c),
    },
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: () => {},
    getContext: () => anything(),
    appendChild: (c) => c, removeChild: () => {}, append: () => {}, remove: () => {},
    setAttribute: () => {}, getAttribute: () => null, closest: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }),
    focus: () => {}, blur: () => {}, scrollIntoView: () => {},
    _listeners: listeners,
  };
}

// 新しいゲームを読み込む。戻り値 g: ゲームの名前を g.名前 で読み書きできる (トップレベルの let / const も)
//   opts.seed: 乱数の種 (省略時 1)
function loadGame(opts = {}) {
  const rng = makeRng(opts.seed ?? 1);
  const consoleLog = [];
  const record = (level) => (...args) => {
    consoleLog.push({ level, text: args.map((a) => (a && a.stack) || String(a)).join(' ') });
  };
  const elements = {};
  const storage = new Map();
  const windowListeners = {};
  const sandbox = {
    console: { log: record('log'), info: record('info'), warn: record('warn'), error: record('error'), debug: record('debug') },
    document: {
      getElementById: (id) => (elements[id] = elements[id] || makeElement(id)),
      createElement: (tag) => makeElement(tag),
      addEventListener: () => {}, removeEventListener: () => {},
      querySelector: () => null, querySelectorAll: () => [],
      body: makeElement('body'),
    },
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener: (type, fn) => { (windowListeners[type] = windowListeners[type] || []).push(fn); },
    removeEventListener: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    performance: { now: () => 0 },
    location: { protocol: 'file:', href: 'file:///index.html' },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: (k) => { storage.delete(k); },
      clear: () => storage.clear(),
    },
    fetch: () => Promise.resolve({ ok: false, status: 404, json: async () => null }),
    Image: class { constructor() { this.onload = null; this.onerror = null; this.src = ''; this.width = 0; this.height = 0; } },
    confirm: () => true, alert: () => {},
    setTimeout, clearTimeout, AbortController,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  // vm の中の Math.random を差し替える (ゲームは Math.random を直接呼ぶ)
  vm.runInContext('Math', context).random = rng;

  for (const s of compiledScripts()) s.runInContext(context);

  // 名前 → 読む関数・書く関数 (一度作ったら使い回す)
  const getters = {}, setters = {};
  const read = (name) => (getters[name] = getters[name] || vm.runInContext(`(() => ${name})`, context))();
  const write = (name, v) => (setters[name] = setters[name] || vm.runInContext(`((__v) => { ${name} = __v; })`, context))(v);
  const special = {
    rng, consoleLog, storage, elements, windowListeners, context,
    eval: (code) => vm.runInContext(code, context),
    set: write,
  };
  return new Proxy(special, {
    get(t, k) {
      if (typeof k !== 'string') return undefined;
      if (k in special) return special[k];
      return read(k);
    },
    set(t, k, v) { write(k, v); return true; },
  });
}

module.exports = { loadGame, scriptList, makeRng, ROOT };
