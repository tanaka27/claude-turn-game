// =====================================================================
//  画面 (道具一覧と店・NPC・一時停止)
// =====================================================================
'use strict';

// ----- 道具一覧・店の画面 -----
// menu.mode: 'inv' (道具一覧。I キーか HUD の「道具」ボタンで開く) / 'shop' (商人: 回復薬を買う・素材を売る) /
//   'smith' (鍛冶屋: 装備を買う・売る) / 'char' (キャラクター。一時停止から開き、閉じると一時停止に戻る) /
//   'quest' (クエスト。src/quests.js) / 'talk' (話すだけの NPC との会話)
// shop: 開いている店のキー (商人は data/items.js の ITEMS.shops、鍛冶屋は ITEMS.smiths) / sel: 選んでいる装備 ({ from: 'inv' | 'equip' | 'shop', id })
// pop: 開いているアイテムの詳細 (ポップアップ。道具一覧とキャラクターの画面だけ) null / { kind: 'gear' } (装備。どれかは sel) /
//   { kind: 'tool', id: 回復薬のキー } / { kind: 'mat', id: 素材のキー }
const menu = { mode: 'inv', shop: null, sel: null, pop: null };
// アイテムをクリックしたときにポップアップで詳細を出す画面か (店では今までどおり右の欄に出す)
const usesPop = () => menu.mode === 'inv' || menu.mode === 'char';
// 鍛冶屋ごとの品ぞろえ { 鍛冶屋のキー: { level: 作ったときの自分のレベル, items } } (セーブしない)
const shopStocks = {};
const shopDef = () => (menu.mode === 'smith' ? IT.smiths : IT.shops)[menu.shop];
const shopStock = () => (menu.mode === 'smith' && shopStocks[menu.shop] ? shopStocks[menu.shop].items : []);
const isStore = () => menu.mode === 'shop' || menu.mode === 'smith';

// 鍛冶屋の品ぞろえ: その鍛冶屋の gear を 1 つずつ。自分のレベルが変わったら入れ替える
function refreshSmith(id) {
  const st = shopStocks[id];
  if (st && st.level === player.level) return;
  const d = IT.smiths[id];
  const lv = clamp(player.level + (d.levelOffset || 0), 1, d.maxLevel || PG.maxLevel);
  shopStocks[id] = { level: player.level, items: d.gear.map(([slot, r]) => makeItem(slot, lv, r)) };
}

function openMenu(mode, shop) {
  game.state = 'menu';
  aiming = null;
  player.travel = null;
  menu.mode = mode;
  menu.shop = mode === 'shop' || mode === 'smith' ? shop : null;
  menu.sel = null;
  menu.pop = null;
  if (mode === 'smith') refreshSmith(shop);
  if (mode === 'char') $('pause').classList.remove('show');
  renderMenu();
  $('menu').classList.add('show');
}
function closeMenu() {
  menu.pop = null;
  $('itemPop').classList.remove('show');
  $('menu').classList.remove('show');
  $('quest').classList.remove('show');
  $('talk').classList.remove('show');
  game.state = 'play';
  // キャラクターの画面は一時停止のまま開いているので、一時停止の画面に戻す
  if (menu.mode === 'char' && game.paused) showPause();
  saveGame();
}

function findSel() {
  const s = menu.sel, p = player;
  if (!s) return null;
  if (s.from === 'inv') return p.inventory.find((it) => it.id === s.id) || null;
  if (s.from === 'shop') return shopStock().find((it) => it.id === s.id) || null;
  return Object.values(p.equip).find((it) => it && it.id === s.id) || null;
}

function itemChip(it, from) {
  const r = rarityOf(it.rarity);
  const on = menu.sel && menu.sel.id === it.id ? ' sel' : '';
  const price = from === 'shop' ? `<span class="price">${itemValue(it)} G</span>` : '';
  return `<div class="item${on}${usesPop() ? ' pop' : ''}" data-from="${from}" data-id="${it.id}" style="--rc:${r.color}">
    <b>${it.name}</b><span>${IT.slots[it.slot].label} Lv${it.level}</span>${price}</div>`;
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
    return `<div class="row${v ? '' : ' lost'}"><span>${STATS[k].label}</span><span>${v ? fmtStat(k, v, true) : '-'} ${d}</span></div>`;
  };
  const baseKeys = Object.keys(IT.slots[it.slot].base);
  const own = Object.keys(it.stats).filter((k) => !baseKeys.includes(k));
  const lost = cur ? Object.keys(cur.stats).filter((k) => !baseKeys.includes(k) && !own.includes(k)) : [];
  const section = (title, keys, empty) => `<div class="shead">${title}</div>
    <div class="stats">${keys.length ? keys.map(row).join('') : `<div class="row none">${empty}</div>`}</div>`;
  const rows = section('基本性能', baseKeys, 'なし') +
    section(`追加性能（${own.length}）`, [...own, ...lost], 'なし');
  const btn = (act, label, ok = true) => `<button data-act="${act}"${ok ? '' : ' disabled'}>${label}</button>`;
  const full = p.inventory.length >= EC.inventorySize;
  let btns = '';
  if (from === 'equip') btns = btn('unequip', '外す', !full);
  else if (from === 'shop') btns = btn('buy', `買う（${itemValue(it)} G）`, p.gold >= itemValue(it) && !full);
  else {
    btns = btn('equip', '装備する');
    btns += menu.mode === 'smith' ? btn('sell', `売る（${sellPrice(it)} G）`) : btn('drop', '捨てる');
  }
  return `<div class="dname" style="color:${r.color}">${it.name}</div>
    <div class="dsub">${r.name}・${IT.slots[it.slot].label}・Lv${it.level}</div>
    ${cur ? `<div class="dsub">差は装備中の「${cur.name}」と比べたもの</div>` : ''}
    ${rows}<div class="btns">${btns}</div>`;
}

function renderMenu() {
  const p = player;
  $('menuTitle').textContent = isStore() ? shopDef().name : menu.mode === 'char' ? 'キャラクター' : '道具一覧';
  $('profile').innerHTML = menu.mode === 'char' ? profileHtml() : '';
  $('menuGold').textContent = `所持金 ${p.gold} G`;
  renderTools();
  $('equipList').innerHTML = Object.keys(IT.slots).map((slot) => {
    const it = p.equip[slot];
    return it ? itemChip(it, 'equip') : `<div class="item empty">${IT.slots[slot].label}: なし</div>`;
  }).join('');
  $('invCount').textContent = `${p.inventory.length} / ${EC.inventorySize}`;
  $('invList').innerHTML = p.inventory.map((it) => itemChip(it, 'inv')).join('') || '<p class="hint">何も持っていない</p>';
  $('shopCol').style.display = isStore() ? '' : 'none';
  if (menu.mode === 'shop') {
    $('shopList').innerHTML = shopDef().potions.map((id) => {
      const po = IT.potions[id], ok = canBuyPotion(id);
      return `<div class="item potion" style="--rc:${rarityOf(po.rarity).color}"><b>${po.name}</b><span>${rarityOf(po.rarity).name}・最大HPの ${Math.round(po.heal * 100)}% 回復（${po.key.toUpperCase()} で使う）</span>
        <button data-act="potion" data-potion="${id}"${ok ? '' : ' disabled'}>買う（${po.price} G）</button></div>`;
    }).join('') || '<p class="hint">売り物はない</p>';
  } else if (menu.mode === 'smith') {
    const items = shopStock();
    $('shopList').innerHTML = items.map((it) => itemChip(it, 'shop')).join('') ||
      '<p class="hint">装備は売り切れ（レベルが上がると入れ替わる）</p>';
  }
  renderMaterials();
  const it = findSel();
  if (usesPop()) {
    // 道具一覧・キャラクターの画面: 右の欄はいつもつよさ。アイテムの詳細はポップアップ (付け替えるとつよさも変わる)
    $('detail').innerHTML = strengthHtml() + '<p class="hint">アイテムをクリックすると詳しく表示します</p>';
    renderPop();
    return;
  }
  $('detail').innerHTML = !it ? strengthHtml() + '<p class="hint">装備を選ぶと詳しく表示します</p>' : detailHtml(it, menu.sel.from);
}

// ----- アイテムの詳細 (ポップアップ) -----
function openPop(pop) {
  menu.pop = pop;
  renderMenu();
}
function closePop() {
  menu.pop = null;
  menu.sel = null;
  renderMenu();
}
function renderPop() {
  const pop = menu.pop, it = pop && pop.kind === 'gear' ? findSel() : null;
  let html = '', rc = '';
  if (it) { html = detailHtml(it, menu.sel.from); rc = rarityOf(it.rarity).color; }
  else if (pop && pop.kind === 'tool') {
    const t = toolEntries().find((x) => x.id === pop.id);
    if (t) { html = toolPopHtml(t); rc = rarityOf(t.rarity).color; }
  } else if (pop && pop.kind === 'mat' && player.materials[pop.id] > 0) {
    html = matPopHtml(pop.id); rc = rarityOf(IT.materials[pop.id].rarity).color;
  }
  // 中身がなくなった (捨てた・売った) ら閉じる
  if (!html) menu.pop = null;
  $('itemPopBody').innerHTML = html ? `<button class="pclose" data-act="popClose">閉じる</button>${html}` : '';
  $('itemPopBody').style.setProperty('--rc', rc || '#30363d');
  $('itemPop').classList.toggle('show', !!html);
}
// 道具 (回復薬) の詳細。道具一覧で、一時停止していなければ「使う」(画面を閉じて 1 行動)
function toolPopHtml(t) {
  const r = rarityOf(t.rarity), canUse = menu.mode === 'inv' && !game.paused;
  const reason = t.count <= 0 ? '持っていない' : player.hp >= player.stats.maxHp ? 'HP が満タン' : '';
  return `<div class="dname" style="color:${r.color}">${t.name}</div>
    <div class="dsub">${r.name}・道具</div>
    <div class="ptext">${t.desc}</div>
    <div class="stats"><div class="row"><span>持っている数</span><span>${t.count} / ${t.max}</span></div>
      <div class="row"><span>使うキー</span><span>${t.key.toUpperCase()}（フィールドで。1 行動）</span></div></div>
    ${canUse ? `<div class="btns"><button data-act="use" data-tool="${t.id}"${t.usable ? '' : ' disabled'}>使う</button></div>
      ${reason ? `<p class="hint">${reason}なので使えない</p>` : ''}` : ''}`;
}
// 素材の詳細: 数・売値・落とす魔物
function matPopHtml(id) {
  const m = IT.materials[id], r = rarityOf(m.rarity), n = player.materials[id];
  const from = Object.values(ENEMIES).filter((d) => (d.drops || []).some((x) => x.id === id)).map((d) => d.name);
  return `<div class="dname" style="color:${r.color}"><i class="swatch" style="background:${m.color}"></i>${m.name}</div>
    <div class="dsub">${r.name}・素材</div>
    <div class="stats"><div class="row"><span>持っている数</span><span>${n}</span></div>
      <div class="row"><span>売値</span><span>${m.price} G（全部で ${m.price * n} G）</span></div>
      <div class="row"><span>落とす魔物</span><span>${from.join('、') || '-'}</span></div></div>
    <p class="hint">商人に売るとお金になる</p>`;
}

// キャラクターの画面の左上: 顔の絵・名前・レベル・HP・MP・経験値・撃破数・状態・ターン・今いるゾーン・受けているクエスト
// (フィールドの HUD には顔・名前・レベル・HP・MP しか出さないので、ほかはここで見る)
function profileHtml() {
  const p = player, maxed = p.level >= PG.maxLevel, need = expToNext(p.level);
  const bar = (v, max, color) => `<div class="bar" style="--bc:${color}"><i style="width:${clamp(v / max, 0, 1) * 100}%"></i></div>`;
  const status = inSafeZone() ? '安全地帯' : game.time - p.lastHurt >= PG.restDelay ? '休息中' : '戦闘中';
  const face = PLAYER.face ? `<img class="pface" src="${PLAYER.face}" alt="" style="--fc:${PLAYER.color}">` : '';
  const qs = QUESTS.filter((q) => p.quests[q.id] && p.quests[q.id].state !== 'claimed').map((q) => {
    const st = p.quests[q.id];
    return st.state === 'ready' ? `<div class="row"><span>${q.name}</span><span class="up">${npcById(q.giver).name}に報告</span></div>`
      : `<div class="row"><span>${q.name}</span><span>${enemyName(q.target)} ${st.count} / ${q.count}</span></div>`;
  }).join('');
  return `<div class="profile"><div class="phead">${face}<div class="pname">${p.name}　Lv${p.level}</div></div>
    <div class="row"><span>HP</span><span>${Math.ceil(p.hp)} / ${p.stats.maxHp}</span></div>${bar(p.hp, p.stats.maxHp, '#ef5350')}
    <div class="row"><span>MP</span><span>${Math.floor(p.mp)} / ${p.stats.maxMp}</span></div>${bar(p.mp, p.stats.maxMp, THEME.mp)}
    <div class="row"><span>経験値</span><span>${maxed ? '最大レベル' : `${p.exp} / ${need}（あと ${need - p.exp}）`}</span></div>${bar(maxed ? 1 : p.exp, maxed ? 1 : need, '#b39ddb')}
    <div class="row"><span>撃破数</span><span>${game.kills}</span></div>
    <div class="row"><span>状態</span><span>${status}</span></div>
    <div class="row"><span>ターン</span><span>${Math.floor(game.time)}</span></div>
    <div class="row"><span>いる場所</span><span>${zone.name}（${zoneLevelText(zone)}）</span></div>
    <div class="pquest">クエスト</div>${qs || '<div class="row none"><span>受けているクエストはない</span></div>'}</div>`;
}

// つよさ: 全ステータスの最終的な値 (強化と装備を入れたもの) と、( ) に装備で上がっている分。強化がかかっている値は色を変える
function strengthHtml() {
  const p = player, st = p.stats, { equip } = statParts(p);
  const buffed = new Set(p.buffs.map((b) => BUFFS[b.id] && BUFFS[b.id].stat));
  const rows = Object.keys(STATS).map((k) => {
    const e = equip[k] || 0;
    const d = e ? `<span class="${e > 0 ? 'up' : 'down'}">（${fmtStat(k, e, true)}）</span>` : '';
    const v = buffed.has(k) ? `<span class="buffed">${fmtStat(k, st[k])}</span>` : fmtStat(k, st[k]);
    return `<div class="row"><span>${STATS[k].label}</span><span>${v} ${d}</span></div>`;
  }).join('');
  return `<div class="dname">つよさ</div><div class="dsub">Lv${p.level}　（ ）は装備で上がっている分。<span class="buffed">この色</span>は強化（バフ）中</div><div class="stats">${rows}</div>`;
}

// ----- 道具 (使うもの。今は回復薬だけ) -----
// 道具の種類を増やすときは toolEntries に足す (rarity: data/items.js のレア度)。use() は 1 行動を返す関数 (act に渡す。行動したら true)
function toolEntries() {
  const p = player;
  return Object.entries(IT.potions).map(([id, po]) => ({
    id, name: po.name, rarity: po.rarity, count: p.potions[id] || 0, max: po.max, key: po.key,
    desc: `最大HPの ${Math.round(po.heal * 100)}% 回復（今なら ${Math.round(p.stats.maxHp * po.heal)}）`,
    usable: (p.potions[id] || 0) > 0 && p.hp < p.stats.maxHp,
    use: () => usePotion(id),
  }));
}
// 道具の一覧。道具一覧の画面 (inv) では「使う」で画面を閉じて使う (1 行動)
function renderTools() {
  const inv = menu.mode === 'inv';
  $('toolList').innerHTML = toolEntries().map((t) => {
    const btn = inv ? `<button data-act="use" data-tool="${t.id}"${t.usable ? '' : ' disabled'}>使う</button>` : '';
    const r = rarityOf(t.rarity);
    return `<div class="item tool${t.count ? '' : ' none'}${usesPop() ? ' pop' : ''}" data-tool="${t.id}" style="--rc:${r.color}"><b>${t.name} ×${t.count}<small> / ${t.max}</small></b>
      <span>${r.name}・${t.desc}・${t.key.toUpperCase()} キー</span>${btn}</div>`;
  }).join('');
}

const canBuyPotion = (id) => player.gold >= IT.potions[id].price && (player.potions[id] || 0) < IT.potions[id].max;

// 素材の一覧。店では 1 つずつ・種類ごと・全部を売れる
const materialTotal = () => Object.entries(player.materials).reduce((s, [id, n]) => s + IT.materials[id].price * n, 0);
function renderMaterials() {
  const p = player, shop = menu.mode === 'shop';
  const ids = Object.keys(IT.materials).filter((id) => p.materials[id] > 0);
  $('matList').innerHTML = ids.map((id) => {
    const m = IT.materials[id], n = p.materials[id];
    const btns = shop ? `<div class="btns"><button data-act="sellMat" data-mat="${id}">1つ売る</button>
      <button data-act="sellMat" data-mat="${id}" data-all="1">全部（${m.price * n} G）</button></div>` : '';
    const r = rarityOf(m.rarity);
    return `<div class="item mat${usesPop() ? ' pop' : ''}" data-mat="${id}" style="--rc:${r.color}"><b><i class="swatch" style="background:${m.color}"></i>${m.name} ×${n}</b><span>${r.name}・売値 ${m.price} G</span>${btns}</div>`;
  }).join('') || '<p class="hint">素材は魔物を倒すと手に入る</p>';
  $('matSellAll').innerHTML = shop && ids.length ? `<button data-act="sellAllMat">全部売る（${materialTotal()} G）</button>` : '';
}
function sellMaterial(id, all) {
  const p = player, n = p.materials[id] || 0;
  if (n <= 0) return;
  const k = all ? n : 1;
  p.gold += IT.materials[id].price * k;
  p.materials[id] = n - k;
  if (!p.materials[id]) delete p.materials[id];
}

// 付け替えたら、最大 HP・MP の増減ぶん今の値もずらす (refreshStats の 'shift')
function equipItem(it) {
  const p = player;
  p.inventory = p.inventory.filter((x) => x !== it);
  if (p.equip[it.slot]) p.inventory.push(p.equip[it.slot]);
  p.equip[it.slot] = it;
  refreshStats(p, 'shift');
  menu.sel = { from: 'equip', id: it.id };
}
function unequipItem(it) {
  const p = player;
  p.equip[it.slot] = null;
  p.inventory.push(it);
  refreshStats(p, 'shift');
  menu.sel = { from: 'inv', id: it.id };
}

$('menu').addEventListener('click', (e) => {
  if (game.state !== 'menu') return;
  const p = player;
  const btn = e.target.closest('[data-act]');
  if (btn && !btn.disabled) {
    const it = findSel(), a = btn.dataset.act;
    if (a === 'close') { closeMenu(); return; }
    if (a === 'popClose') { closePop(); return; }
    if (a === 'use' && menu.mode === 'inv') {
      const t = toolEntries().find((x) => x.id === btn.dataset.tool);
      if (t && t.usable) { closeMenu(); act(t.use); }
      return;
    }
    const pid = btn.dataset.potion;
    if (a === 'potion' && menu.mode === 'shop' && shopDef().potions.includes(pid) && canBuyPotion(pid)) {
      p.gold -= IT.potions[pid].price;
      p.potions[pid] = (p.potions[pid] || 0) + 1;
    } else if (a === 'equip' && it) equipItem(it);
    else if (a === 'unequip' && it && p.inventory.length < EC.inventorySize) unequipItem(it);
    else if (a === 'drop' && it) { p.inventory = p.inventory.filter((x) => x !== it); menu.sel = null; }
    else if (a === 'sellMat' && menu.mode === 'shop') sellMaterial(btn.dataset.mat, !!btn.dataset.all);
    else if (a === 'sellAllMat' && menu.mode === 'shop') for (const id in p.materials) sellMaterial(id, true);
    else if (a === 'sell' && it && menu.mode === 'smith' && menu.sel.from === 'inv') { p.gold += sellPrice(it); p.inventory = p.inventory.filter((x) => x !== it); menu.sel = null; }
    else if (a === 'buy' && it && menu.mode === 'smith' && p.gold >= itemValue(it) && p.inventory.length < EC.inventorySize) {
      p.gold -= itemValue(it);
      shopStocks[menu.shop].items = shopStock().filter((x) => x !== it);
      p.inventory.push(it);
      menu.sel = { from: 'inv', id: it.id };
    }
    renderMenu();
    return;
  }
  // ポップアップの外 (暗いところ) をクリックしたら閉じる
  if (e.target.id === 'itemPop') { closePop(); return; }
  if (e.target.closest('#itemPop')) return;
  const chip = e.target.closest('.item[data-id]');
  if (chip) {
    menu.sel = { from: chip.dataset.from, id: chip.dataset.id };
    if (usesPop()) openPop({ kind: 'gear' }); else renderMenu();
    return;
  }
  // 道具・素材は、道具一覧とキャラクターの画面でだけクリックで詳細を出す
  const other = usesPop() && e.target.closest('.item[data-tool], .item[data-mat]');
  if (other) openPop(other.dataset.tool ? { kind: 'tool', id: other.dataset.tool } : { kind: 'mat', id: other.dataset.mat });
});

// 話しかけられる NPC (となりのマスにいる人)
function nearNpc() {
  if (!player || player.dead) return null;
  return (zone.npcs || []).find((n) => steps(n.tx, n.ty, player.tx, player.ty) <= 1) || null;
}
function talkTo(n) {
  if (n.role === 'shop') openMenu('shop', n.shop);
  else if (n.role === 'smith') openMenu('smith', n.smith);
  else if (n.role === 'quest') openQuest(n);
  else if (n.role === 'talk') openTalk(n);
}

// ----- 会話 (role: 'talk' の NPC。world.js の lines を 1 つずつ出す) -----
const talk = { npc: null, line: 0 };
function openTalk(n) {
  game.state = 'menu';
  aiming = null;
  player.travel = null;
  menu.mode = 'talk';
  talk.npc = n; talk.line = 0;
  renderTalk();
  $('talk').classList.add('show');
}
function renderTalk() {
  const n = talk.npc, last = talk.line >= n.lines.length - 1;
  $('talkName').textContent = n.name;
  $('talkName').style.color = n.color;
  $('talkText').textContent = n.lines[talk.line];
  $('talkNext').textContent = last ? '閉じる（F）' : `次へ（F）　${talk.line + 1} / ${n.lines.length}`;
}
function nextTalk() {
  if (talk.line >= talk.npc.lines.length - 1) { closeMenu(); return; }
  talk.line++;
  renderTalk();
}
$('talk').addEventListener('click', (e) => {
  if (game.state !== 'menu' || menu.mode !== 'talk') return;
  if (e.target.closest('[data-act="close"]')) closeMenu();
  else nextTalk();
});
function interact() {
  const n = nearNpc();
  if (n) talkTo(n);
  else log('話しかけられる人がいない。となりのマスで F を押そう。', '#9da7b3');
}

function togglePause() {
  game.paused = !game.paused;
  aiming = null;
  if (player) player.travel = null;
  if (game.paused) showPause();
  else $('pause').classList.remove('show');
}
function showPause() {
  $('saveWhere').textContent = saveWhereText();
  $('pause').classList.add('show');
}
$('pause').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (!act || game.state !== 'play' || !game.paused) return;
  if (act.dataset.act === 'resume') togglePause();
  else if (act.dataset.act === 'char') openMenu('char');
});
