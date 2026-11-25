// =====================================================================
//  画面 (道具一覧と店・NPC・一時停止)
// =====================================================================
'use strict';

// ----- 画面の登録表 -----
// 画面 (game.state === 'menu' のときに出す HTML の画面) は SCREENS[名前] に 1 つずつ登録する (registerScreen)。
// 開いている画面の名前は menuState.mode。足し方は docs/menu.md の「施設（画面と NPC の役目）の足し方」
//   overlay   : 出す要素の id (index.html)。閉じるときは登録された全部の画面の overlay を隠す
//   open(arg) : その画面だけの開くときの準備 (共通の準備 = 時間を止める・構えと歩く道を消す・menuState.mode は openScreen がする)
//   render()  : 中身を作る (開いたとき。ボタンを押したあとは afterAction)
//   keys(k, e): その画面のキー (k は小文字)。処理したら true。処理しなかったら、Esc と closeKeys で閉じる (押しっぱなしは除く)
//   closeKeys : Esc のほかに閉じるキー
//   actions   : { data-act の値: (ボタン) => ... } ボタンのクリック。true を返したら afterAction をしない (閉じたときなど)
//   afterAction(): ボタンを押したあと (合わない data-act でも呼ぶ)
//   click(e)  : ボタン (data-act) 以外のところのクリック
//   onClose() : 閉じたあと (セーブの前)
const SCREENS = {};
const screenNow = () => SCREENS[menuState.mode];
const hasAction = (s, a) => Object.prototype.hasOwnProperty.call(s.actions || {}, a);
// 画面を登録する。overlay の要素のクリックはここで 1 度だけ受けて、開いている画面に渡す
function registerScreen(name, def) {
  const known = Object.values(SCREENS).some((s) => s.overlay === def.overlay);
  SCREENS[name] = def;
  if (known) return;
  $(def.overlay).addEventListener('click', (e) => {
    const s = screenNow();
    if (game.state !== 'menu' || !s || s.overlay !== def.overlay) return;
    const btn = e.target.closest('[data-act]');
    if (btn && !btn.disabled) {
      const a = btn.dataset.act;
      if (!(hasAction(s, a) && s.actions[a](btn) === true) && s.afterAction) s.afterAction();
      return;
    }
    if (s.click) s.click(e);
  });
}
// 画面を開く (NPC に話しかける・キー・HUD のボタンから)。arg はその画面の open に渡す (店のキー・NPC など)
function openScreen(name, arg) {
  const s = SCREENS[name];
  game.state = 'menu';
  aiming = null;
  player.travel = null;
  menuState.mode = name;
  if (s.open) s.open(arg);
  s.render();
  $(s.overlay).classList.add('show');
}
// 開いている画面のキー (src/player.js の keydown から、画面を開いている間だけ呼ぶ)
function screenKey(k, e) {
  const s = screenNow();
  if (s.keys && s.keys(k, e)) return;
  if (!e.repeat && (k === 'escape' || (s.closeKeys || []).includes(k))) closeMenu();
}
function closeMenu() {
  const s = screenNow();
  for (const x of Object.values(SCREENS)) $(x.overlay).classList.remove('show');
  game.state = 'play';
  if (s && s.onClose) s.onClose();
  saveGame();
}

// ----- 道具一覧・店・キャラクターの画面 (どれも index.html の #menu。menuScreen で作る) -----
// shop: 開いている店のキー (その画面の defs() の表のキー。商人は data/items.js の ITEMS.shops、鍛冶屋は ITEMS.smiths) /
//   sel: 選んでいる装備 ({ from: 'inv' | 'equip' | 'shop', id })
// pop: 開いているアイテムの詳細 (ポップアップ。画面の pop が true のときだけ) null / { kind: 'gear' } (装備。どれかは sel) /
//   { kind: 'tool', id: 道具のキー (data/items.js の consumables) } / { kind: 'mat', id: 素材のキー }
// tab: キャラクターの画面で開いているタブ (CHAR_TABS の id。閉じても覚えておく。セーブしない)
const menuState = { mode: 'inv', shop: null, sel: null, pop: null, tab: 'status' };
// キャラクターの画面のタブ。名前は data/text.js の menu.tabs、どのまとまりを出すかは index.html の data-sec (と style.css)
//   ← → で隣のタブ、1〜4 でそのタブ
const CHAR_TABS = ['status', 'equip', 'items', 'quest'];
// アイテムをクリックしたときにポップアップで詳細を出す画面か (店では今までどおり右の欄に出す)
const usesPop = () => !!screenNow().pop;
// 鍛冶屋ごとの品ぞろえ { 鍛冶屋のキー: { level: 作ったときの自分のレベル, items } } (セーブしない)
const shopStocks = {};
// 開いている店の定義 (その画面の defs() の表から) / 商品の装備 (その画面の stock()。なければ空)
const shopDef = () => screenNow().defs()[menuState.shop];
const shopStock = () => (screenNow().stock ? screenNow().stock() : []);

// 鍛冶屋の品ぞろえ: その鍛冶屋の gear を 1 つずつ。自分のレベルが変わったら入れ替える
function refreshSmith(id) {
  const st = shopStocks[id];
  if (st && st.level === player.level) return;
  const d = ITEMS.smiths[id];
  const lv = clamp(player.level + (d.levelOffset || 0), 1, d.maxLevel || PROGRESSION.maxLevel);
  shopStocks[id] = { level: player.level, items: d.gear.map(([slot, r]) => makeItem(slot, lv, r)) };
}

// #menu を使う画面を作る。def に書いたもので共通のものを上書き・追加する
//   title(): 見出し / profile: 左上に profileHtml を出す / tabs: タブの id の並び (あればタブに分ける。CHAR_TABS) / pop: アイテムの詳細をポップアップで出す /
//   toolUse: 道具の「使う」を出す / sellMaterials: 素材を売るボタンを出す /
//   defs(): 店の定義の表 (data/items.js) / stock(): 商品の装備 / shopList(): 「商品」の欄の中身 (あれば「商品」の欄を出す) /
//   invGearButton(it): 持ち物の装備を選んだときの「装備する」の横のボタン (なければ「捨てる」) /
//   open(arg): menuState.shop・menuState.sel・menuState.pop を消したあとの準備 / actions: MENU_ACTIONS に足すボタン / onClose()
function menuScreen(def) {
  return {
    overlay: 'menu', render: renderMenu, afterAction: renderMenu, keys: menuKeys, click: menuClick, ...def,
    open(arg) {
      menuState.shop = null;
      menuState.sel = null;
      menuState.pop = null;
      if (def.open) def.open(arg);
    },
    actions: { ...MENU_ACTIONS, ...(def.actions || {}) },
    onClose() {
      menuState.pop = null;
      $('itemPop').classList.remove('show');
      if (def.onClose) def.onClose();
    },
  };
}
// アイテムの詳細 (ポップアップ) を開いているときは、Esc でそれだけ閉じる
function menuKeys(k, e) {
  if (menuState.pop && !e.repeat && k === 'escape') { closePop(); return true; }
  return false;
}
// タブのある画面: ← → で隣のタブ、1〜(タブの数) でそのタブ (ポップアップを開いていても切り替えると閉じる)
function tabKeys(k) {
  const tabs = screenNow().tabs;
  if (!tabs) return false;
  const i = tabs.indexOf(menuState.tab);
  let next = null;
  if (k === 'arrowleft' || k === 'arrowright') next = tabs[(i + (k === 'arrowright' ? 1 : tabs.length - 1)) % tabs.length];
  else if (/^[1-9]$/.test(k) && Number(k) <= tabs.length) next = tabs[Number(k) - 1];
  if (!next) return false;
  switchTab(next);
  return true;
}
function switchTab(id) {
  menuState.tab = id;
  menuState.pop = null;
  menuState.sel = null;
  renderMenu();
}

function findSel() {
  const s = menuState.sel, p = player;
  if (!s) return null;
  if (s.from === 'inv') return p.inventory.find((it) => it.id === s.id) || null;
  if (s.from === 'shop') return shopStock().find((it) => it.id === s.id) || null;
  return Object.values(p.equip).find((it) => it && it.id === s.id) || null;
}

function itemChip(it, from) {
  const r = rarityOf(it.rarity);
  const on = menuState.sel && menuState.sel.id === it.id ? ' sel' : '';
  const price = from === 'shop' ? `<span class="price">${txt('menu.price', { n: itemValue(it) })}</span>` : '';
  return `<div class="item${on}${usesPop() ? ' pop' : ''}" data-from="${from}" data-id="${it.id}" style="--rc:${r.color}">
    <b>${it.name}</b><span>${txt('menu.chipSub', { slot: ITEMS.slots[it.slot].label, level: it.level })}</span>${price}</div>`;
}

// 選んだ装備の詳細。部位で決まる基本性能と、ランダムに付いた追加性能を分けて出し、
// 同じ部位の装備中のものとの差を出す
function detailHtml(it, from) {
  const p = player, r = rarityOf(it.rarity);
  const cur = from === 'equip' ? null : p.equip[it.slot];
  const row = (k) => {
    const v = it.stats[k] || 0, diff = v - (cur ? cur.stats[k] || 0 : 0);
    const d = from === 'equip' || Math.abs(diff) < 1e-9 ? '' :
      `<span class="${diff > 0 ? 'up' : 'down'}">${fmtStat(k, diff, true)}</span>`;
    return `<div class="row${v ? '' : ' lost'}"><span>${STATS[k].label}</span><span>${v ? fmtStat(k, v, true) : txt('menu.noValue')} ${d}</span></div>`;
  };
  const baseKeys = Object.keys(ITEMS.slots[it.slot].base);
  const own = Object.keys(it.stats).filter((k) => !baseKeys.includes(k));
  const lost = cur ? Object.keys(cur.stats).filter((k) => !baseKeys.includes(k) && !own.includes(k)) : [];
  const section = (title, keys, empty) => `<div class="shead">${title}</div>
    <div class="stats">${keys.length ? keys.map(row).join('') : `<div class="row none">${empty}</div>`}</div>`;
  const rows = section(txt('menu.baseStats'), baseKeys, txt('menu.noStats')) +
    section(txt('menu.extraStats', { n: own.length }), [...own, ...lost], txt('menu.noStats'));
  const btn = actButton, s = screenNow();
  const full = p.inventory.length >= ECON.inventorySize;
  let btns = '';
  if (from === 'equip') btns = btn('unequip', txt('menu.unequip'), !full);
  else if (from === 'shop') btns = btn('buy', txt('menu.buy', { n: itemValue(it) }), p.gold >= itemValue(it) && !full);
  else {
    btns = btn('equip', txt('menu.equip'));
    btns += s.invGearButton ? s.invGearButton(it) : btn('drop', txt('menu.drop'));
  }
  return `<div class="dname" style="color:${r.color}">${it.name}</div>
    <div class="dsub">${txt('menu.gearSub', { rarity: r.name, slot: ITEMS.slots[it.slot].label, level: it.level })}</div>
    ${cur ? `<div class="dsub">${txt('menu.compare', { name: cur.name })}</div>` : ''}
    ${rows}<div class="btns">${btns}</div>`;
}

const actButton = (action, label, ok = true) => `<button data-act="${action}"${ok ? '' : ' disabled'}>${label}</button>`;

function renderMenu() {
  const p = player, s = screenNow();
  $('menuTitle').textContent = s.title();
  $('profile').innerHTML = s.profile ? profileHtml() : '';
  $('charQuests').innerHTML = s.profile ? questsHtml() : '';
  renderTabs(s);
  $('menuGold').textContent = txt('menu.gold', { n: p.gold });
  renderTools();
  $('equipList').innerHTML = Object.keys(ITEMS.slots).map((slot) => {
    const it = p.equip[slot];
    return it ? itemChip(it, 'equip') : `<div class="item empty">${txt('menu.emptySlot', { slot: ITEMS.slots[slot].label })}</div>`;
  }).join('');
  $('invCount').textContent = txt('menu.invCount', { n: p.inventory.length, max: ECON.inventorySize });
  $('invList').innerHTML = p.inventory.map((it) => itemChip(it, 'inv')).join('') || `<p class="hint">${txt('menu.noItems')}</p>`;
  $('shopCol').style.display = s.shopList ? '' : 'none';
  if (s.shopList) $('shopList').innerHTML = s.shopList();
  renderMaterials();
  const it = findSel();
  if (usesPop()) {
    // 道具一覧・キャラクターの画面: 右の欄はいつもつよさ。アイテムの詳細はポップアップ (付け替えるとつよさも変わる)
    const hint = s.tabs && menuState.tab === 'status' ? '' : `<p class="hint">${txt('menu.hintPop')}</p>`;
    $('detail').innerHTML = strengthHtml() + hint;
    renderPop();
    return;
  }
  $('detail').innerHTML = !it ? strengthHtml() + `<p class="hint">${txt('menu.hintSelect')}</p>` : detailHtml(it, menuState.sel.from);
}

// タブ (画面の tabs があるときだけ)。#menuBody の data-tab で、どのまとまりを出すかを style.css が決める
function renderTabs(s) {
  if (!s.tabs) {
    $('menuTabs').innerHTML = '';
    delete $('menuBody').dataset.tab;
    return;
  }
  if (!s.tabs.includes(menuState.tab)) menuState.tab = s.tabs[0];
  $('menuTabs').innerHTML = s.tabs.map((id, i) =>
    `<button data-act="tab" data-tab="${id}"${id === menuState.tab ? ' class="on"' : ''}>${txt(`menu.tabs.${id}`)}<small>${i + 1}</small></button>`).join('') +
    `<span class="tabhint">${txt('menu.hintTabs')}</span>`;
  $('menuBody').dataset.tab = menuState.tab;
}

// ----- アイテムの詳細 (ポップアップ) -----
function openPop(pop) {
  menuState.pop = pop;
  renderMenu();
}
function closePop() {
  menuState.pop = null;
  menuState.sel = null;
  renderMenu();
}
function renderPop() {
  const pop = menuState.pop, it = pop && pop.kind === 'gear' ? findSel() : null;
  let html = '', rc = '';
  if (it) { html = detailHtml(it, menuState.sel.from); rc = rarityOf(it.rarity).color; }
  else if (pop && pop.kind === 'tool') {
    const t = toolEntries().find((x) => x.id === pop.id);
    if (t) { html = toolPopHtml(t); rc = rarityOf(t.rarity).color; }
  } else if (pop && pop.kind === 'mat' && player.materials[pop.id] > 0) {
    html = matPopHtml(pop.id); rc = rarityOf(ITEMS.materials[pop.id].rarity).color;
  }
  // 中身がなくなった (捨てた・売った) ら閉じる
  if (!html) menuState.pop = null;
  $('itemPopBody').innerHTML = html ? `<button class="pclose" data-act="popClose">${txt('menu.close')}</button>${html}` : '';
  $('itemPopBody').style.setProperty('--rc', rc || '#30363d');
  $('itemPop').classList.toggle('show', !!html);
}
// 道具の詳細。道具一覧で、一時停止していなければ「使う」(画面を閉じて 1 行動。使えないときは理由)
function toolPopHtml(t) {
  const r = rarityOf(t.rarity), canUse = !!screenNow().toolUse && !game.paused, reason = t.reason;
  return `<div class="dname" style="color:${r.color}">${t.name}</div>
    <div class="dsub">${txt('menu.toolSub', { rarity: r.name })}</div>
    <div class="ptext">${t.desc}</div>
    <div class="stats"><div class="row"><span>${txt('menu.have')}</span><span>${txt('menu.haveOf', { n: t.count, max: t.max })}</span></div>
      <div class="row"><span>${txt('menu.useKey')}</span><span>${txt('menu.useKeyValue', { key: t.key.toUpperCase() })}</span></div></div>
    ${canUse ? `<div class="btns"><button data-act="use" data-tool="${t.id}"${t.usable ? '' : ' disabled'}>${txt('menu.use')}</button></div>
      ${reason ? `<p class="hint">${txt('menu.cannotUse', { reason })}</p>` : ''}` : ''}`;
}
// 素材の詳細: 数・売値・落とす魔物
function matPopHtml(id) {
  const m = ITEMS.materials[id], r = rarityOf(m.rarity), n = player.materials[id];
  const from = Object.values(ENEMIES).filter((d) => (d.drops || []).some((x) => x.id === id)).map((d) => d.name);
  return `<div class="dname" style="color:${r.color}"><i class="swatch" style="background:${m.color}"></i>${m.name}</div>
    <div class="dsub">${txt('menu.matSub', { rarity: r.name })}</div>
    <div class="stats"><div class="row"><span>${txt('menu.have')}</span><span>${n}</span></div>
      <div class="row"><span>${txt('menu.matPrice')}</span><span>${txt('menu.matPriceValue', { price: m.price, total: m.price * n })}</span></div>
      <div class="row"><span>${txt('menu.matFrom')}</span><span>${from.join(txt('menu.matFromSep')) || txt('menu.noValue')}</span></div></div>
    <p class="hint">${txt('menu.matHint')}</p>`;
}

// キャラクターの画面の「ステータス」タブ: 顔の絵・名前・レベル・HP・MP・経験値・撃破数・状態・ターン・今いるゾーン
// (フィールドの HUD には顔・名前・レベル・HP・MP しか出さないので、ほかはここで見る)
function profileHtml() {
  const p = player, maxed = p.level >= PROGRESSION.maxLevel, need = expToNext(p.level);
  const meter = (v, max, color) => `<div class="bar" style="--bc:${color}"><i style="width:${clamp(v / max, 0, 1) * 100}%"></i></div>`;
  const status = inSafeZone() ? txt('menu.statusSafe') : game.time - p.lastHurt >= PROGRESSION.restDelay ? txt('menu.statusRest') : txt('menu.statusFight');
  const face = PLAYER.face ? `<img class="pface" src="${PLAYER.face}" alt="" style="--fc:${PLAYER.color}">` : '';
  return `<div class="profile"><div class="phead">${face}<div class="pname">${txt('menu.nameLevel', { name: p.name, level: p.level })}</div></div>
    <div class="row"><span>${txt('menu.hp')}</span><span>${txt('menu.ofMax', { n: Math.ceil(p.hp), max: p.stats.maxHp })}</span></div>${meter(p.hp, p.stats.maxHp, '#ef5350')}
    <div class="row"><span>${txt('menu.mp')}</span><span>${txt('menu.ofMax', { n: Math.floor(p.mp), max: p.stats.maxMp })}</span></div>${meter(p.mp, p.stats.maxMp, THEME.mp)}
    <div class="row"><span>${txt('menu.exp')}</span><span>${maxed ? txt('menu.maxLevel') : txt('menu.expValue', { exp: p.exp, need, left: need - p.exp })}</span></div>${meter(maxed ? 1 : p.exp, maxed ? 1 : need, '#b39ddb')}
    <div class="row"><span>${txt('menu.kills')}</span><span>${game.kills}</span></div>
    <div class="row"><span>${txt('menu.status')}</span><span>${status}</span></div>
    <div class="row"><span>${txt('menu.turn')}</span><span>${Math.floor(game.time)}</span></div>
    <div class="row"><span>${txt('menu.where')}</span><span>${txt('menu.whereValue', { zone: zone.name, level: zoneLevelText(zone) })}</span></div></div>`;
}
// キャラクターの画面の「クエスト」タブ: 受けているクエストの進み具合 (目標の種類の short と数。報告できるものは緑)
function questsHtml() {
  const p = player;
  const qs = QUESTS.filter((q) => p.quests[q.id] && p.quests[q.id].state !== 'claimed').map((q) => {
    const st = p.quests[q.id];
    return st.state === 'ready' ? `<div class="row"><span>${q.name}</span><span class="up">${txt('menu.questReport', { npc: npcById(q.giver).name })}</span></div>`
      : `<div class="row"><span>${q.name}</span><span>${txt('menu.questCount', { name: goalKind(q).short(q.goal), n: questProgress(q), need: questNeed(q) })}</span></div>`;
  }).join('');
  return `<div class="profile"><div class="pquest">${txt('menu.quests')}</div>${qs || `<div class="row none"><span>${txt('menu.noQuests')}</span></div>`}</div>`;
}

// 行動で伸びるステータスにマウスを重ねると出す吹き出し: 潜在 (100 が基準) と、小数点以下まで入れた今の値
function growthTipHtml(k) {
  const p = player, S = GROWTH.stats[k];
  if (!S || !p.potential) return '';
  return `<div class="stat-tip"><span>${txt('menu.potential', { n: Math.round(p.potential[k]) })}</span><span class="sub">${txt('menu.exact', { n: (Math.floor(p.base[k] * 100) / 100).toFixed(2) })}</span></div>`;
}
// つよさ: 全ステータスの最終的な値 (強化と装備を入れたもの) と、( ) に装備で上がっている分。強化がかかっている値は色を変える
//   「基礎能力値」(行動で伸びる。params.js の progression.growth.stats) と、それ以外の「ステータス」(基礎能力値から計算で決まるもの・装備でだけ変わるもの) に分けて出す
function strengthHtml() {
  const p = player, st = p.stats, { equip } = statParts(p);
  const buffed = new Set(p.buffs.map((b) => BUFFS[b.id] && BUFFS[b.id].stat));
  const row = (k) => {
    const e = equip[k] || 0;
    const d = e ? `<span class="${e > 0 ? 'up' : 'down'}">${txt('menu.equipBonus', { v: fmtStat(k, e, true) })}</span>` : '';
    const v = buffed.has(k) ? `<span class="buffed">${fmtStat(k, st[k])}</span>` : fmtStat(k, st[k]);
    return `<div class="row${GROWTH.stats[k] ? ' has-tip' : ''}"><span>${STATS[k].label}</span><span>${v} ${d}</span>${growthTipHtml(k)}</div>`;
  };
  const keys = Object.keys(STATS);
  const section = (title, ks) => `<div class="shead">${title}</div><div class="stats">${ks.map(row).join('')}</div>`;
  const note = txt('menu.strengthNote', { level: p.level, buffed: `<span class="buffed">${txt('menu.buffedSample')}</span>` });
  return `<div class="dname">${txt('menu.strength')}</div><div class="dsub">${note}</div>`
    + section(txt('menu.baseStats'), keys.filter((k) => GROWTH.stats[k]))
    + section(txt('menu.derivedStats'), keys.filter((k) => !GROWTH.stats[k]));
}

// ----- 道具 (使うもの。data/items.js の ITEMS.consumables) -----
// 道具の種類を増やすときは data/items.js の consumables に足す (効果の種類は src/items.js の ITEM_EFFECTS)
//   usable / reason: 使えるか・使えない理由 (どちらも consumableBlock。使うときと同じ判定) /
//   use(): 1 行動を返す関数 (doPlayerAction に渡す。行動したら true)。今は主人公が自分に使う
function toolEntries() {
  const p = player;
  return Object.entries(ITEMS.consumables).map(([id, c]) => {
    const block = consumableBlock(p, id);
    return {
      id, name: c.name, rarity: c.rarity, count: consumableCount(p, id), max: c.max, key: c.key,
      desc: consumableDesc(id, p), usable: !block, reason: block ? block.reason : '',
      use: () => useConsumable(p, id),
    };
  });
}
// 道具の一覧。道具一覧の画面 (inv) では「使う」で画面を閉じて使う (1 行動)
function renderTools() {
  const inv = !!screenNow().toolUse;
  $('toolList').innerHTML = toolEntries().map((t) => {
    const btn = inv ? `<button data-act="use" data-tool="${t.id}"${t.usable ? '' : ' disabled'}>${txt('menu.use')}</button>` : '';
    const r = rarityOf(t.rarity);
    return `<div class="item tool${t.count ? '' : ' none'}${usesPop() ? ' pop' : ''}" data-tool="${t.id}" style="--rc:${r.color}"><b>${txt('menu.toolName', { name: t.name, n: t.count })}<small>${txt('menu.toolMax', { max: t.max })}</small></b>
      <span>${txt('menu.toolLine', { rarity: r.name, desc: t.desc, key: t.key.toUpperCase() })}</span>${btn}</div>`;
  }).join('');
}

const canBuyConsumable = (id) => player.gold >= ITEMS.consumables[id].price && consumableCount(player, id) < ITEMS.consumables[id].max;

// 素材の一覧。店では 1 つずつ・種類ごと・全部を売れる
const materialTotal = () => Object.entries(player.materials).reduce((s, [id, n]) => s + ITEMS.materials[id].price * n, 0);
function renderMaterials() {
  const p = player, shop = !!screenNow().sellMaterials;
  const ids = Object.keys(ITEMS.materials).filter((id) => p.materials[id] > 0);
  $('matList').innerHTML = ids.map((id) => {
    const m = ITEMS.materials[id], n = p.materials[id];
    const btns = shop ? `<div class="btns"><button data-act="sellMat" data-mat="${id}">${txt('menu.sellOne')}</button>
      <button data-act="sellMat" data-mat="${id}" data-all="1">${txt('menu.sellAllOf', { n: m.price * n })}</button></div>` : '';
    const r = rarityOf(m.rarity);
    return `<div class="item mat${usesPop() ? ' pop' : ''}" data-mat="${id}" style="--rc:${r.color}"><b><i class="swatch" style="background:${m.color}"></i>${txt('menu.matName', { name: m.name, n })}</b><span>${txt('menu.matLine', { rarity: r.name, price: m.price })}</span>${btns}</div>`;
  }).join('') || `<p class="hint">${txt('menu.noMaterials')}</p>`;
  $('matSellAll').innerHTML = shop && ids.length ? `<button data-act="sellAllMat">${txt('menu.sellAll', { n: materialTotal() })}</button>` : '';
}
function sellMaterial(id, all) {
  const p = player, n = p.materials[id] || 0;
  if (n <= 0) return;
  const k = all ? n : 1;
  p.gold += ITEMS.materials[id].price * k;
  p.materials[id] = n - k;
  if (!p.materials[id]) delete p.materials[id];
  questEvent('materials'); // 集めるクエストは足りなくなると「受けている」に戻る
}

// 付け替えたら、最大 HP・MP の増減ぶん今の値もずらす (refreshStats の 'shift')
function equipItem(it) {
  const p = player;
  p.inventory = p.inventory.filter((x) => x !== it);
  if (p.equip[it.slot]) p.inventory.push(p.equip[it.slot]);
  p.equip[it.slot] = it;
  refreshStats(p, 'shift');
  menuState.sel = { from: 'equip', id: it.id };
}
function unequipItem(it) {
  const p = player;
  p.equip[it.slot] = null;
  p.inventory.push(it);
  refreshStats(p, 'shift');
  menuState.sel = { from: 'inv', id: it.id };
}

// ----- #menu のボタン (data-act) -----
// どの #menu の画面でも使えるボタン。画面ごとのボタンは menuScreen の actions に足す (押したあとは renderMenu)
// 装備のボタンは、detailHtml がそのボタンを出す選び方 (menuState.sel.from) のときだけ効く (古い画面のボタンが押されても何も起きない)
//   inv: 装備する + (invGearButton があればそれ、なければ捨てる) / equip: 外す / shop: 買う
const selFrom = (from) => { const it = findSel(); return it && menuState.sel.from === from ? it : null; };
const MENU_ACTIONS = {
  close: () => { closeMenu(); return true; },
  tab: (btn) => { if (screenNow().tabs && screenNow().tabs.includes(btn.dataset.tab)) switchTab(btn.dataset.tab); return true; },
  popClose: () => { closePop(); return true; },
  equip: () => { const it = selFrom('inv'); if (it) equipItem(it); },
  unequip: () => { const it = selFrom('equip'); if (it && player.inventory.length < ECON.inventorySize) unequipItem(it); },
  drop: () => {
    const it = selFrom('inv');
    if (it && !screenNow().invGearButton) { player.inventory = player.inventory.filter((x) => x !== it); menuState.sel = null; }
  },
};
// 道具を使う (画面を閉じて 1 行動)。使えなくても画面は作り直さない
function useToolAction(btn) {
  const t = toolEntries().find((x) => x.id === btn.dataset.tool);
  if (t && t.usable) { closeMenu(); doPlayerAction(t.use); }
  return true;
}
function buyConsumableAction(btn) {
  const p = player, id = btn.dataset.item;
  if (shopDef().consumables.includes(id) && canBuyConsumable(id)) {
    p.gold -= ITEMS.consumables[id].price;
    p.consumables[id] = consumableCount(p, id) + 1;
  }
}
function sellGearAction() {
  const p = player, it = selFrom('inv');
  if (it) { p.gold += sellPrice(it); p.inventory = p.inventory.filter((x) => x !== it); menuState.sel = null; }
}
// 買えるのは、この鍛冶屋の今の品ぞろえから選んだ装備だけ (findSel は from が 'shop' なら shopStock から探す)
function buyGearAction() {
  const p = player, it = selFrom('shop');
  if (it && p.gold >= itemValue(it) && p.inventory.length < ECON.inventorySize) {
    p.gold -= itemValue(it);
    shopStocks[menuState.shop].items = shopStock().filter((x) => x !== it);
    p.inventory.push(it);
    menuState.sel = { from: 'inv', id: it.id };
  }
}

// #menu のボタン以外のクリック: アイテムを選ぶ・詳細を出す
function menuClick(e) {
  // ポップアップの外 (暗いところ) をクリックしたら閉じる
  if (e.target.id === 'itemPop') { closePop(); return; }
  if (e.target.closest('#itemPop')) return;
  const chip = e.target.closest('.item[data-id]');
  if (chip) {
    menuState.sel = { from: chip.dataset.from, id: chip.dataset.id };
    if (usesPop()) openPop({ kind: 'gear' }); else renderMenu();
    return;
  }
  // 道具・素材は、道具一覧とキャラクターの画面でだけクリックで詳細を出す
  const other = usesPop() && e.target.closest('.item[data-tool], .item[data-mat]');
  if (other) openPop(other.dataset.tool ? { kind: 'tool', id: other.dataset.tool } : { kind: 'mat', id: other.dataset.mat });
}

// 道具一覧 (I キーか HUD の「道具」ボタン)
registerScreen('inv', menuScreen({
  title: () => txt('menu.titleInv'), pop: true, toolUse: true, closeKeys: ['i'],
  actions: { use: useToolAction },
}));
// キャラクター (Tab・HUD の仲間の欄・一時停止の画面から)。一時停止の画面は隠し、閉じると一時停止の画面に戻す
registerScreen('char', menuScreen({
  title: () => txt('menu.titleChar'), profile: true, pop: true, tabs: CHAR_TABS, closeKeys: ['c', 'tab'],
  keys: (k, e) => menuKeys(k, e) || tabKeys(k),
  open: () => $('pause').classList.remove('show'),
  onClose: () => { if (game.paused) showPause(); },
}));
// 商人: 道具を買う・素材を売る (arg: data/items.js の ITEMS.shops のキー)
registerScreen('shop', menuScreen({
  title: () => shopDef().name, sellMaterials: true, closeKeys: ['f'],
  defs: () => ITEMS.shops,
  open: (id) => { menuState.shop = id; },
  shopList: () => shopDef().consumables.map((id) => {
    const c = ITEMS.consumables[id], ok = canBuyConsumable(id);
    return `<div class="item potion" style="--rc:${rarityOf(c.rarity).color}"><b>${c.name}</b><span>${txt('menu.shopLine', { rarity: rarityOf(c.rarity).name, desc: consumableDesc(id), key: c.key.toUpperCase() })}</span>
        <button data-act="buyItem" data-item="${id}"${ok ? '' : ' disabled'}>${txt('menu.shopBuy', { n: c.price })}</button></div>`;
  }).join('') || `<p class="hint">${txt('menu.shopEmpty')}</p>`,
  actions: {
    buyItem: buyConsumableAction,
    sellMat: (btn) => sellMaterial(btn.dataset.mat, !!btn.dataset.all),
    sellAllMat: () => { for (const id in player.materials) sellMaterial(id, true); },
  },
}));
// 鍛冶屋: 装備を買う・売る (arg: data/items.js の ITEMS.smiths のキー)。品ぞろえは開いたときに自分のレベルで作り直す
registerScreen('smith', menuScreen({
  title: () => shopDef().name, closeKeys: ['f'],
  defs: () => ITEMS.smiths,
  stock: () => (shopStocks[menuState.shop] ? shopStocks[menuState.shop].items : []),
  open: (id) => { menuState.shop = id; refreshSmith(id); },
  shopList: () => shopStock().map((it) => itemChip(it, 'shop')).join('') ||
    `<p class="hint">${txt('menu.smithEmpty')}</p>`,
  invGearButton: (it) => actButton('sell', txt('menu.sell', { n: sellPrice(it) })),
  actions: { sell: sellGearAction, buy: buyGearAction },
}));

// 話しかけられる NPC (となりのマスにいる人)
function nearNpc() {
  if (!player || player.dead) return null;
  return (zone.npcs || []).find((n) => tileSteps(n.tx, n.ty, player.tx, player.ty) <= 1) || null;
}
// NPC の役目 (world.js の NPC の role) → 話しかけたときに開く画面 (SCREENS の名前) と、その画面の open に渡すもの。
//   check(n): 役目ごとに NPC に書くもの (店のキーなど) の食い違いの文の並び (起動時に validateData が調べる)
const NPC_ROLES = {
  shop: { screen: 'shop', arg: (n) => n.shop, check: (n) => (ITEMS.shops[n.shop] ? [] : [`店 '${n.shop}' が data/items.js の shops にない`]) },
  smith: { screen: 'smith', arg: (n) => n.smith, check: (n) => (ITEMS.smiths[n.smith] ? [] : [`鍛冶屋 '${n.smith}' が data/items.js の smiths にない`]) },
  quest: { screen: 'quest', arg: (n) => n },
  talk: { screen: 'talk', arg: (n) => n, check: (n) => (Array.isArray(n.lines) && n.lines.length > 0 ? [] : ['話す言葉 lines がない']) },
};
function talkTo(n) {
  questEvent('talk', n); // 話しかけるクエスト (役目の画面を開く前に。クエストの NPC ならすぐ「報告できる」が出る)
  const r = NPC_ROLES[n.role];
  if (r) openScreen(r.screen, r.arg(n));
}

// ----- 会話 (role: 'talk' の NPC。world.js の lines を 1 つずつ出す) -----
const talkState = { npc: null, line: 0 };
function renderTalk() {
  const n = talkState.npc, isLast = talkState.line >= n.lines.length - 1;
  $('talkName').textContent = n.name;
  $('talkName').style.color = n.color;
  $('talkStats').textContent = txt('talk.stats', { kind: n.kindLabel, hpMp: hpMpLine(n), stats: stats4Line(n.stats) });
  $('talkText').textContent = n.lines[talkState.line];
  $('talkNext').textContent = isLast ? txt('talk.close') : txt('talk.next', { n: talkState.line + 1, total: n.lines.length });
}
function nextTalk() {
  if (talkState.line >= talkState.npc.lines.length - 1) { closeMenu(); return; }
  talkState.line++;
  renderTalk();
}
// F / Enter / スペース・クリックで次の言葉へ (最後なら閉じる)。Esc か「閉じる」でいつでも閉じる
registerScreen('talk', {
  overlay: 'talk', render: renderTalk,
  open: (n) => { talkState.npc = n; talkState.line = 0; },
  keys: (k, e) => {
    if (!e.repeat && (k === 'f' || k === 'enter' || k === ' ')) { nextTalk(); return true; }
    return false;
  },
  actions: { close: () => closeMenu() },
  click: () => nextTalk(),
});
function interact() {
  const n = nearNpc();
  if (n) talkTo(n);
  else logMsg(txt('talk.nobody'), THEME.msg.refuse);
}

function togglePause() {
  game.paused = !game.paused;
  aiming = null;
  if (player) player.travel = null;
  if (game.paused) showPause();
  else $('pause').classList.remove('show');
}
function showPause() {
  $('saveResult').textContent = '';
  $('saveWhere').textContent = saveWhereText();
  $('pause').classList.add('show');
}
// 一時停止画面の「セーブ」(S キー): 今すぐ保存し、終わったら結果を出す
let manualSaving = false;
function manualSave() {
  if (manualSaving || game.state !== 'play' || !game.paused) return Promise.resolve();
  manualSaving = true;
  $('saveResult').textContent = txt('save.saving');
  return saveGame().then((r) => {
    manualSaving = false;
    $('saveResult').textContent = saveResultText(r);
    $('saveWhere').textContent = saveWhereText();
  });
}
$('pause').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || game.state !== 'play' || !game.paused) return;
  if (btn.dataset.act === 'resume') togglePause();
  else if (btn.dataset.act === 'save') manualSave();
  else if (btn.dataset.act === 'char') openScreen('char');
});

// このタブで保存をやめたとき (src/save.js の blockSaving): 遊べないように止め、ほかの画面の上に知らせを出す
function showSaveBlocked(reason) {
  if (game.state === 'play' || game.state === 'menu' || game.state === 'dying') game.paused = true;
  aiming = null;
  if (player) player.travel = null;
  $('saveBlockedTitle').textContent = txt('save.blockedTitle');
  $('saveBlockedText').textContent = txt(reason === 'conflict' ? 'save.blockedConflict' : 'save.blockedOtherTab');
  $('saveBlockedReload').textContent = txt('save.reload');
  $('saveBlocked').classList.add('show');
}
$('saveBlocked').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (btn && btn.dataset.act === 'reload') location.reload();
});
