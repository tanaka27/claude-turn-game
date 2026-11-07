// =====================================================================
//  道具一覧 (回復薬・素材・装備の図鑑)
//  L キー、または一時停止画面の「道具一覧」で開く。中身はすべて data/*.js と world.js から作る
// =====================================================================
'use strict';

// catalog.tab: 開いているタブ ('potion' | 'material' | 'gear')。閉じても覚えておく
const catalog = { tab: 'potion' };
const CATALOG_TABS = [['potion', '回復薬'], ['material', '素材'], ['gear', '装備']];

// 店のキー → { 店の名前, 町の名前, NPC の名前 } (world.js の NPC から探す)
function shopPlaces() {
  const out = {};
  for (const z of Object.values(WORLD.zones)) {
    for (const n of z.npcs || []) if (n.role === 'shop') out[n.shop] = { shop: IT.shops[n.shop].name, town: z.name, npc: n.name };
  }
  return out;
}
const placeText = (id, places) => (places[id] ? `${places[id].town}の${places[id].npc}` : IT.shops[id].name);

// 敵の種類 → 出るゾーンの名前 (重なりなし)
function enemyZones() {
  const out = {};
  for (const z of Object.values(WORLD.zones)) {
    for (const c of z.camps || []) for (const m of c.members) {
      out[m] = out[m] || [];
      if (!out[m].includes(z.name)) out[m].push(z.name);
    }
  }
  return out;
}

function openCatalog() {
  game.state = 'menu';
  aiming = null;
  if (player) player.travel = null;
  menu.mode = 'catalog';
  $('pause').classList.remove('show');
  renderCatalog();
  $('catalog').classList.add('show');
}

function renderCatalog() {
  $('catalogTabs').innerHTML = CATALOG_TABS.map(([id, label]) =>
    `<button data-tab="${id}" class="${catalog.tab === id ? 'on' : ''}">${label}</button>`).join('');
  const body = catalog.tab === 'potion' ? potionCatalog() : catalog.tab === 'material' ? materialCatalog() : gearCatalog();
  $('catalogBody').innerHTML = body;
}

function potionCatalog() {
  const p = player, places = shopPlaces();
  return Object.entries(IT.potions).map(([id, po]) => {
    const where = Object.keys(IT.shops).filter((s) => IT.shops[s].potions.includes(id)).map((s) => placeText(s, places));
    const heal = p ? `（今なら ${Math.round(p.stats.maxHp * po.heal)} 回復）` : '';
    return `<div class="cat-card"><div class="cat-head"><b>${po.name}</b><span class="cat-own">所持 ${p ? p.potions[id] || 0 : 0} / ${po.max}</span></div>
      <div class="row"><span>効果</span><span>最大HPの ${Math.round(po.heal * 100)}% 回復${heal}</span></div>
      <div class="row"><span>使うキー</span><span>${po.key.toUpperCase()}（1 行動）</span></div>
      <div class="row"><span>値段</span><span>${po.price} G</span></div>
      <div class="row"><span>売っている店</span><span>${where.join('、') || 'なし'}</span></div></div>`;
  }).join('');
}

function materialCatalog() {
  const p = player, zones = enemyZones();
  const rows = Object.entries(IT.materials).map(([id, m]) => {
    const n = p ? p.materials[id] || 0 : 0;
    const from = Object.entries(ENEMIES).filter(([, e]) => (e.drops || []).some((d) => d.id === id)).map(([eid, e]) => {
      const d = e.drops.find((x) => x.id === id);
      return `${e.name}（${Math.round(d.rate * 100)}%${d.count > 1 ? `・${d.count} 個` : ''}）<span class="cat-sub">${(zones[eid] || []).join('・')}</span>`;
    });
    return `<tr class="${n ? '' : 'none'}"><td><i class="dot" style="background:${m.color}"></i><b style="color:${m.color}">${m.name}</b></td>
      <td class="num">${m.price} G</td><td class="num">${n}</td><td class="num">${n ? m.price * n + ' G' : '-'}</td><td>${from.join('<br>') || '-'}</td></tr>`;
  }).join('');
  const total = p ? materialTotal() : 0;
  return `<p class="hint">素材は町の店（どこでも）で売るとお金になる。数は敵のレベルが高いほど増える。</p>
    <table class="cat-table"><tr><th>素材</th><th>売値</th><th>所持</th><th>合計</th><th>落とす敵（確率）と出る場所</th></tr>${rows}</table>
    <p class="cat-total">持っている素材の売値の合計 <b>${total} G</b></p>`;
}

function gearCatalog() {
  const places = shopPlaces(), maxLv = PG.maxLevel;
  const statText = (base, lv, mult = 1) => Object.keys(base).map((k) => `${STATS[k].label} ${fmtStat(k, roundStat(k, scaled(base[k], lv) * mult), true)}`).join('・') || '基本性能なし';
  const slots = Object.entries(IT.slots).map(([slot, S]) => {
    const tiers = S.names.map((name, i) => {
      const lo = i * IT.nameTierEvery + 1;
      if (lo > maxLv) return '';
      const hi = i === S.names.length - 1 ? maxLv : Math.min(maxLv, lo + IT.nameTierEvery - 1);
      return `<tr><td>${name}</td><td>Lv${lo}${hi > lo ? `〜${hi}` : ''}</td><td>${statText(S.base, lo)}</td></tr>`;
    }).join('');
    const where = Object.entries(IT.shops).filter(([, d]) => d.gear.some(([s]) => s === slot)).map(([id, d]) => {
      const rs = d.gear.filter(([s]) => s === slot).map(([, r]) => rarityOf(r).name).join('・');
      return `${placeText(id, places)}（${rs}）`;
    });
    const extra = S.extraAffixes ? `<p class="hint">追加性能がレア度の分より ${S.extraAffixes} つ多く付く</p>` : '';
    return `<div class="cat-card"><div class="cat-head"><b>${S.label}</b></div>${extra}
      <table class="cat-table"><tr><th>名前</th><th>装備レベル</th><th>ノーマルの基本性能（最初のレベル）</th></tr>${tiers}</table>
      <div class="row"><span>売っている店</span><span>${where.join('、') || 'なし'}</span></div></div>`;
  }).join('');
  const rar = IT.rarities.map((r) => `<tr><td><b style="color:${r.color}">${r.name}</b></td><td class="num">${r.weight}%</td>
    <td class="num">${r.bossWeight}%</td><td class="num">×${r.mult}</td><td class="num">${r.affixes}</td><td class="num">×${r.value}</td></tr>`).join('');
  const aff = Object.entries(IT.affixes).map(([k, v]) => `${STATS[k].label}（Lv1: ${fmtStat(k, roundStat(k, scaled(v, 1)), true)}）`).join('、');
  return `<p class="hint">装備レベルは敵が落としたものは敵のレベル、店で買うものは自分のレベル（店ごとの上限あり）。名前は ${IT.nameTierEvery} レベルごとに変わる。</p>
    ${slots}
    <div class="cat-card"><div class="cat-head"><b>レア度</b></div>
      <table class="cat-table"><tr><th>レア度</th><th>敵が落とす</th><th>ボスが落とす</th><th>基本性能</th><th>追加性能</th><th>価値</th></tr>${rar}</table>
      <p class="hint">追加性能の候補（値は ±20% で揺れる）: ${aff}</p></div>`;
}

$('catalog').addEventListener('click', (e) => {
  if (game.state !== 'menu' || menu.mode !== 'catalog') return;
  const tab = e.target.closest('[data-tab]');
  if (tab) { catalog.tab = tab.dataset.tab; renderCatalog(); $('catalogBody').scrollTop = 0; return; }
  if (e.target.closest('[data-act="close"]')) closeMenu();
});
