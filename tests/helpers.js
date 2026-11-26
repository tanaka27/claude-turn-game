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
  const cols = opts.cols || 15, rows = opts.rows || 15, T = g.TILE;
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
  g.computeFlow(g.player.tx, g.player.ty, g.playerFlow);
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
function moveTo(g, u, tx, ty) { g.placeUnit(u, tx, ty); g.computeFlow(g.player.tx, g.player.ty, g.playerFlow); }
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
// 主人公のレベルを lv にする (成長もレベルアップの演出もなし)。はじめの覚え方でそのレベルなら覚えているスキルは覚える
function setLevel(g, lv) { g.player.level = lv; g.learnSkillsByLevel(g.player); }
// 予告中の技の範囲 (画面の赤いマス) を 'x,y' の集合で
const telegraphTiles = (g) => new Set(g.hazards.flatMap((h) => h.tiles.map(([x, y]) => `${x},${y}`)));
const lootsOnGround = (g) => g.loots.length;
// メッセージ欄の文 (新しいものが後ろ。最大 7 行)
const messages = (g) => Array.from(g.logLines, (l) => l.text);

// ----- 道具 (data/items.js の ITEMS.consumables。主人公の数は player.consumables) -----
// 道具の数 { 道具のキー: 数 } (そのまま書き換えられる)
const bagOf = (u) => u.consumables;
// 道具の定義 / 回復薬の回復の割合 (healHp の ratio)
const consumableDef = (g, id) => g.ITEMS.consumables[id];
const healRatio = (g, id) => consumableDef(g, id).effects.find((e) => e.kind === 'healHp').ratio;
// キャラ u が道具 id を t (省略時は u 自身) に使う (どのキャラも同じ道 useConsumable。行動の後始末はしない)。使えたら true
const useItem = (g, u, id, t) => (t ? g.useConsumable(u, id, t) : g.useConsumable(u, id));
// テストだけで使う道具を足す (data/items.js の consumables と同じ形)。key を書かなければ空いているキーを付ける
function defineConsumable(g, id, def) {
  const used = Object.values(g.ITEMS.consumables).map((c) => c.key);
  const key = def.key || [...'ghjklnbvxy'].find((k) => !used.includes(k));
  g.ITEMS.consumables[id] = { name: id, rarity: 'common', price: 1, max: 9, start: 0, ...def, key };
  return g.ITEMS.consumables[id];
}
// 商人の「買う」ボタン (findButton / clickButton に ...buyButton(id) で渡す)
const buyButton = (id) => ['buyItem', { item: id }];

// ----- マップ -----
// 今のゾーンから行き先 to へ行く門のマス (1 つ)
function gateTile(g, to) {
  const gt = g.zone.gates.find((x) => x.to === to);
  return gt ? [gt.tx, gt.ty + Math.floor(gt.th / 2)] : null;
}
const isGate = (g, x, y) => g.inMap(x, y) && g.gateAt[g.tileIndex(x, y)] >= 0;
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
// キャラの行動を通さずに、ゲーム内の時間だけを dt ターン進める (時間で進むものの区切り方を変えるテスト用)
function passTime(g, dt) { g.advanceTime(g.game.time + dt); }

// ----- 視線と直線 -----
// (x1, y1) と (x2, y2) のマスの中心どうしを結ぶ線が、攻撃を遮る地形を通らないか
const sees = (g, x1, y1, x2, y2) => g.hasLOS(x1, y1, x2, y2);
// (x, y) から dir (ラジアン) の向きへ len マスの直線が通るマス ([[x, y]...]。近い順)
const rayFrom = (g, x, y, dir, len) => Array.from(g.rayTiles(x, y, dir, len), (t) => Array.from(t));

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
// 主人公のスキル欄でキー key に置いてあるスキル (覚えていないものも)
const skill = (g, key) => g.skillByKey(key);
// スキルの id で (data/skills.js の定義)
const skillById = (g, id) => g.SKILLS.find((s) => s.id === id);
// 主人公のスキル欄で sk を置いたキー
const keyOf = (g, sk) => g.slotKeyOf(g.player, sk);
// キャラ u が覚えているか / 覚えているスキルの id の並び / 覚えさせる (レベルを通さずに)
const knows = (g, u, sk) => g.knowsSkill(u, sk);
const knownSkillIds = (u) => Array.from(u.knownSkills || []);
const teach = (g, u, id) => g.teachSkill(u, id);
// テストだけで使うスキルを data/skills.js の SKILLS に足す (主人公が覚えられる技になる)
function defineSkill(g, def) { g.SKILLS.push(def); return def; }
// 主人公のスキル欄のキー key にスキル id を置く (なければ欄を足す)
function bindSkill(g, key, id) {
  const slots = g.player.skillSlots, b = slots.find((x) => x.key === key);
  if (b) b.skill = id; else slots.push({ key, skill: id });
}
// 再使用待ちの入れ物に入っている値 (技を使っていなければ 0。入れ物の名札は skillKey)
const storedCooldown = (g, u, sk) => u.skillCd[g.skillKey(u, sk)];
// データの確認をもう一度して、見つかった食い違いの文の並び (データを書き換えたあとに)
const dataProblems = (g) => Array.from(g.validateData());
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

// ----- 画面 (index.html の #menu / #itemPop / #quest / #talk / #pause) -----
// 土台の document は HTML を解釈しないので、画面の中身 (innerHTML) をここで小さく解釈して、クリックの的を作る。
// 的は本物の要素と同じく dataset / disabled / id / closest(選び方) を持ち、親 (入れ物の要素) へたどれる
const el = (g, id) => g.document.getElementById(id);
const shown = (g, id) => el(g, id).classList.contains('show');
const textOf = (g, id) => el(g, id).textContent;
const htmlOf = (g, id) => el(g, id).innerHTML;
// 入れ物の要素 → 親の要素 (index.html の入れ子)
const PARENT_OF = {
  itemPop: 'menu', itemPopBody: 'itemPop', profile: 'menu', charQuests: 'menu', menuTabs: 'menu', equipList: 'menu', shopList: 'menu', toolList: 'menu', invList: 'menu',
  matSellAll: 'menu', matList: 'menu', detail: 'menu', questList: 'quest', questDetail: 'quest', talkName: 'talk', talkText: 'talk', talkNext: 'talk',
};
// 画面ごとの、中身を作り直す入れ物 / index.html に直接書いてあるボタン
const CONTAINERS = {
  menu: ['menuTabs', 'profile', 'charQuests', 'equipList', 'shopList', 'toolList', 'invList', 'matSellAll', 'matList', 'detail', 'itemPopBody'],
  quest: ['questList', 'questDetail'], talk: [], pause: [],
};
const STATIC_BUTTONS = {
  menu: [['close', '閉じる（Esc）']], quest: [['close', '閉じる（Esc）']], talk: [['close', '閉じる（Esc）']],
  pause: [['resume', '再開'], ['save', 'セーブ（S）'], ['char', 'キャラクター（C）']],
  saveBlocked: [['reload', '読み込み直す']],
};
function selectorMatches(n, sel) {
  return sel.split(',').some((s) => {
    const m = /^([a-z]*)(.*)$/i.exec(s.trim());
    if (m[1] && n.tag !== m[1].toLowerCase()) return false;
    const re = /#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;
    let p;
    while ((p = re.exec(m[2]))) {
      if (p[1] && n.id !== p[1]) return false;
      if (p[2] && !n.classes.includes(p[2])) return false;
      if (p[3] && (!(p[3] in n.attrs) || (p[4] !== undefined && n.attrs[p[3]] !== p[4]))) return false;
    }
    return true;
  });
}
function makeNode(tag, attrs, parent) {
  const dataset = {};
  for (const k in attrs) if (k.startsWith('data-')) dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = attrs[k];
  const node = { tag, tagName: tag.toUpperCase(), id: attrs.id || '', attrs, dataset, classes: (attrs.class || '').split(/\s+/).filter(Boolean),
    disabled: 'disabled' in attrs, parent, text: '' };
  node.closest = (sel) => { for (let n = node; n; n = n.parent) if (selectorMatches(n, sel)) return n; return null; };
  return node;
}
// 入れ物の要素 (id) の的 (親をたどれる)
const staticNode = (id) => makeNode('div', { id }, PARENT_OF[id] ? staticNode(PARENT_OF[id]) : null);
const VOID_TAGS = new Set(['img', 'br', 'input', 'hr']);
function parseHtml(html, root) {
  const nodes = [], stack = [root];
  const re = /<(\/?)([a-zA-Z0-9]+)((?:[^>"]|"[^"]*")*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { for (const n of stack.slice(1)) n.text += m[4]; continue; }
    const tag = m[2].toLowerCase();
    if (m[1]) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; } continue; }
    const attrs = {}, are = /([\w-]+)(?:="([^"]*)")?/g;
    let a;
    while ((a = are.exec(m[3]))) attrs[a[1]] = a[2] === undefined ? '' : a[2];
    const node = makeNode(tag, attrs, stack[stack.length - 1]);
    nodes.push(node);
    if (!VOID_TAGS.has(tag)) stack.push(node);
  }
  return nodes;
}
// 画面 screen ('menu' | 'quest' | 'talk' | 'pause') の中の要素 (今の中身から作る)
function screenNodes(g, screen) {
  const out = [];
  // 下の表にない画面 (テストで足した画面) は、画面の要素そのものの中身を読む
  for (const id of CONTAINERS[screen] || [screen]) out.push(...parseHtml(htmlOf(g, id), staticNode(id)));
  for (const [act, label] of STATIC_BUTTONS[screen] || []) {
    const b = makeNode('button', { 'data-act': act }, staticNode(screen));
    b.text = label;
    out.push(b);
  }
  return out;
}
const hasData = (n, data) => Object.entries(data).every(([k, v]) => n.dataset[k] === String(v));
// data-act が act で、data-* が data と同じボタン (なければ null)。{ label, disabled } も読める
function findButton(g, screen, act, data = {}) {
  return screenNodes(g, screen).find((n) => n.tag === 'button' && n.dataset.act === act && hasData(n, data)) || null;
}
const buttonLabels = (g, screen) => screenNodes(g, screen).filter((n) => n.tag === 'button').map((n) => n.text.trim());
// 要素をクリックする (画面の要素に登録された click の処理に渡す)
function clickNode(g, screen, node) {
  for (const f of el(g, screen)._listeners.click || []) f({ target: node, preventDefault() {} });
}
// ボタンを押す。ブラウザと同じく押せない (disabled) ボタンはクリックが届かない (opts.force なら届ける。画面の処理の見張りを試す)
function clickButton(g, screen, act, data = {}, opts = {}) {
  const b = findButton(g, screen, act, data);
  if (!b) throw new Error(`ボタン ${act} ${JSON.stringify(data)} が ${screen} にない`);
  if (b.disabled && !opts.force) return false;
  clickNode(g, screen, b);
  return true;
}
// 今の画面にはないボタン (古い画面に残ったもの) が押されたことにする。画面の処理の見張り (お金・持ち物・画面の種類) を試す
function clickStaleButton(g, screen, act, data = {}) {
  const attrs = { 'data-act': act };
  for (const [k, v] of Object.entries(data)) attrs[`data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = String(v);
  clickNode(g, screen, makeNode('button', attrs, staticNode((CONTAINERS[screen] || [])[0] || screen)));
}
// 選んでいる装備を直接決める (画面には出ていない、古い画面の選択が残った場面。from: 'inv' | 'equip' | 'shop')
function staleSelect(g, from, id) { g.menuState.sel = { from, id: String(id) }; }
// 道具一覧・店の画面のアイテムをクリックする: 装備 (from: 'inv' | 'equip' | 'shop') / 道具 / 素材
function clickGear(g, from, id) {
  const n = screenNodes(g, 'menu').find((x) => x.classes.includes('item') && x.dataset.from === from && x.dataset.id === String(id));
  if (!n) throw new Error(`装備 ${from} ${id} が画面にない`);
  clickNode(g, 'menu', n);
}
function clickTool(g, id) {
  const n = screenNodes(g, 'menu').find((x) => x.tag === 'div' && x.classes.includes('item') && x.dataset.tool === id);
  if (!n) throw new Error(`道具 ${id} が画面にない`);
  clickNode(g, 'menu', n);
}
function clickMat(g, id) {
  const n = screenNodes(g, 'menu').find((x) => x.tag === 'div' && x.classes.includes('item') && x.dataset.mat === id);
  if (!n) throw new Error(`素材 ${id} が画面にない`);
  clickNode(g, 'menu', n);
}
// 鍛冶屋の「作る」の作り方をクリックする (id: data/items.js の ITEMS.recipes のキー)
function clickRecipe(g, id) {
  const n = screenNodes(g, 'menu').find((x) => x.tag === 'div' && x.classes.includes('item') && x.dataset.recipe === id);
  if (!n) throw new Error(`作り方 ${id} が画面にない`);
  clickNode(g, 'menu', n);
}
// 鍛冶屋の画面で今出している切り替え ('trade' | 'craft') / 作り方の一覧の id の並び
const smithView = (g) => g.menuState.view;
const recipeIds = (g) => screenNodes(g, 'menu').filter((x) => x.tag === 'div' && x.dataset.recipe).map((x) => x.dataset.recipe);
// 画面を通さずに作る (作れなければ null)
const craftWith = (g, id) => g.craftItem(g.player, id);
// 詳細のポップアップの外 (暗い幕) をクリックする
const clickPopBackdrop = (g) => clickNode(g, 'menu', staticNode('itemPop'));
// 会話の枠の文のところをクリックする
const clickTalkText = (g) => clickNode(g, 'talk', staticNode('talkText'));
// クエストの画面の一覧: 並び [{ id, state, sel }] / クリックで選ぶ
const questRows = (g) => screenNodes(g, 'quest').filter((n) => n.dataset.qid).map((n) => ({
  id: n.dataset.qid, state: (n.classes.find((c) => c.startsWith('q-')) || '').slice(2), sel: n.classes.includes('sel'),
}));
function clickQuestRow(g, qid) {
  const n = screenNodes(g, 'quest').find((x) => x.dataset.qid === qid);
  if (!n) throw new Error(`クエスト ${qid} が一覧にない`);
  clickNode(g, 'quest', n);
}
// ----- クエスト (data/quests.js の QUESTS / src/quests.js) -----
// テストだけで使うクエストを QUESTS の最後に足す (data/quests.js と同じ形)。giver を書かなければギルド受付
function defineQuest(g, def) {
  const q = { giver: 'guildClerk', name: def.id, where: 'テスト', minLevel: 1, desc: 'テスト', reward: {}, ...def };
  g.QUESTS.push(q);
  return q;
}
// クエストの状態 ('locked' / 'lowLevel' / 'available' / 'active' / 'ready' / 'claimed')
const questState = (g, id) => g.questStatus(g.questById(id));
// NPC (world.js の id) の頭上の印 ('!' / '?' / '')
const npcMarkOf = (g, id) => g.npcMark(g.npcById(id));
// 画面中央の大きい文字 [文, 下の文]
const bigMessage = (g) => [g.game.msg, g.game.sub];
// 開いている画面 (game.state が 'menu' のときの画面の名前。開いていなければ null)
const openScreen = (g) => (g.game.state === 'menu' ? g.menuState.mode : null);
// HUD のボタン (id: 'items' | 'char' | 'map') を左クリックする (画面の描画は動かないので、ボタンの場所を置いてから押す)
function clickHud(g, id) {
  g.hudButtons.length = 0;
  g.hudButtons.push({ id, x: 0, y: 0, w: 10, h: 10 });
  for (const f of el(g, 'game')._listeners.mousedown || []) f({ button: 0, clientX: 5, clientY: 5, preventDefault() {} });
}
// セーブ (saveGame) を呼んだ回数を数える。戻り値 { count }。stop() でやめる
function trackSaves(g) {
  const ctx = g.context, orig = ctx.saveGame, t = { count: 0 };
  ctx.saveGame = function () { t.count++; return orig.apply(this, arguments); };
  t.stop = () => { ctx.saveGame = orig; };
  return t;
}
// NPC (world.js の id) のいるゾーンへ入り、そのとなりのマスに主人公を置く。戻り値: 主人公から NPC への向き [dx, dy]
function nextToNpc(g, id) {
  const zid = Object.keys(g.WORLD.zones).find((z) => (g.WORLD.zones[z].npcs || []).some((n) => n.id === id));
  const n0 = g.WORLD.zones[zid].npcs.find((n) => n.id === id);
  const ntx = g.tileOf(n0.x), nty = g.tileOf(n0.y);
  g.enterZone(zid, ntx, nty + 1);
  const npcAt = (x, y) => g.zone.npcs.some((n) => n.tx === x && n.ty === y);
  for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const x = ntx + dx, y = nty + dy;
    if (g.isBlocked(x, y) || npcAt(x, y) || g.gateAt[g.tileIndex(x, y)] >= 0) continue;
    g.placeUnit(g.player, x, y);
    g.player.travel = null;
    return [-dx, -dy];
  }
  throw new Error(`NPC ${id} のとなりに空いたマスがない`);
}
// 装備を作って持ち物に入れる / 持ち物をいっぱいにする
function giveItem(g, slot = 'weapon', level = 1, rarity = 'common') {
  const it = g.makeItem(slot, level, rarity);
  g.player.inventory.push(it);
  return it;
}
function fillInventory(g) { while (g.player.inventory.length < g.ECON.inventorySize) giveItem(g); }
// テストだけで使う画面・NPC の役目を足す (src/ui.js の registerScreen / NPC_ROLES。施設を足すときと同じ道)
//   def の関数はテスト側のもの。overlay の要素は土台がどの id でも作る
function defineScreen(g, name, def) { g.registerScreen(name, def); }
function defineRole(g, role, def) { g.NPC_ROLES[role] = def; }
// 画面の登録表にある画面の名前 / NPC の役目の名前
const screenNames = (g) => Object.keys(g.SCREENS);
const roleNames = (g) => Object.keys(g.NPC_ROLES);
// 鍛冶屋の今の品ぞろえ (開いたときに作られる)
const smithStock = (g, id) => (g.shopStocks[id] ? Array.from(g.shopStocks[id].items) : []);

// ----- 描画 (src/render.js / src/hud.js) -----
// 土台の canvas は何も描かない代わりなので、描く処理が例外を出さないことだけを確かめるのに使う
// 1 フレーム分描く (メインループと同じく、カメラを合わせてから render)
function renderFrame(g) { g.updateCamera(); g.render(); }
// マウスをマス (tx, ty) に重ねる (敵・NPC の説明を出す)
function hoverTile(g, tx, ty) {
  g.updateCamera();
  g.mouse.x = (g.tileCenter(tx) - g.camera.x) * g.VIEW_SCALE; g.mouse.y = (g.tileCenter(ty) - g.camera.y) * g.VIEW_SCALE;
}
// マウスを仲間の欄の強化のアイコンに重ねる (renderFrame でアイコンの場所が決まってから)。アイコンがなければ false
function hoverBuffIcon(g) {
  const b = g.buffIcons[0];
  if (!b) return false;
  g.mouse.x = b.x + b.s / 2; g.mouse.y = b.y + b.s / 2;
  return true;
}
// 絵 (src) を読み込み終わったことにする (土台の Image は読み込まないので、そのままだと図形でしか描かれない)
function fakeSpriteLoaded(g, src) {
  if (src) g.sprites[src] = { img: { naturalWidth: 128, naturalHeight: 128 }, flash: {}, ready: true };
}
// 落とし物を (tx, ty) に置く。data: { kind: 'material', id, amount } / { kind: 'item', item }
function dropAt(g, tx, ty, data) { g.spawnLoot(tx, ty, data); }

module.exports = {
  renderFrame, hoverTile, hoverBuffIcon, fakeSpriteLoaded, dropAt,
  el, shown, textOf, htmlOf, screenNodes, findButton, buttonLabels, clickNode, clickButton, clickStaleButton, staleSelect, clickGear, clickTool, clickMat, clickPopBackdrop, clickTalkText,
  questRows, clickQuestRow, defineQuest, questState, npcMarkOf, bigMessage, openScreen, clickHud, trackSaves, nextToNpc, giveItem, fillInventory, smithStock, defineScreen, defineRole, screenNames, roleNames,
  plain, newGame, arena, allUnits, livingEnemies, addAlly, unitOn, targetOf, isHostile, isReturning, isIdle, isInvulnerable, moveTo, setNextAction,
  recompute, setPlayerBase, setLevel, applyBuff, buffsOf, defineEffect, makeEnemy, statPartsOf, strengthHtml, levelUp, telegraphTiles, lootsOnGround, messages, traceTurns, passTime,
  sees, rayFrom, press, step, wait, castAt, skill, attackTiles, performAttack, runFrames, gateTile, isGate, firstStep,
  useSkillBy, cooldownLeftOf, cooldownLengthOf, canUseSkillOf, setCooldown, enemyAttack,
  skillById, keyOf, knows, knownSkillIds, teach, defineSkill, bindSkill, storedCooldown, dataProblems,
  bagOf, consumableDef, healRatio, useItem, defineConsumable, buyButton,
  clickRecipe, smithView, recipeIds, craftWith,
};
