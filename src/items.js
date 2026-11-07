// =====================================================================
//  装備・素材・落とし物・回復薬
// =====================================================================
'use strict';

// ステータスの表示 (表示名と桁数は data/stats.js)
function fmtStat(k, v, sign) {
  const info = STATS[k];
  const s = info.pct ? (v * 100).toFixed(1) + '%' : v.toFixed(info.dec);
  return sign && v >= 0 ? '+' + s : s;
}
function roundStat(k, v) {
  const info = STATS[k];
  const m = info.pct ? 1000 : Math.pow(10, info.dec);
  return Math.max(1 / m, Math.round(v * m) / m);
}
const scaled = ([a, b], lv) => a + b * (lv - 1);
const rarityOf = (id) => IT.rarities.find((r) => r.id === id) || IT.rarities[0];
const itemValue = (it) => Math.round(scaled(IT.value, it.level) * rarityOf(it.rarity).value);
const sellPrice = (it) => Math.max(1, Math.floor(itemValue(it) * EC.sellRate));
let itemSeq = 0;

function pickWeighted(list, key) {
  const total = list.reduce((s, r) => s + r[key], 0);
  let x = Math.random() * total;
  for (const r of list) { x -= r[key]; if (x <= 0) return r; }
  return list[list.length - 1];
}

// 装備を作る。rarity を省略するとレア度の出やすさ (boss なら bossWeight) で決める
function makeItem(slot, level, rarity, boss) {
  const S = IT.slots[slot];
  const R = rarity ? rarityOf(rarity) : pickWeighted(IT.rarities, boss ? 'bossWeight' : 'weight');
  const stats = {};
  for (const k in S.base) stats[k] = roundStat(k, scaled(S.base[k], level) * R.mult);
  const pool = Object.keys(IT.affixes).filter((k) => !(k in stats));
  for (let i = 0; i < R.affixes + S.extraAffixes && pool.length; i++) {
    const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    stats[k] = roundStat(k, scaled(IT.affixes[k], level) * rand(0.8, 1.2));
  }
  const name = S.names[Math.min(S.names.length - 1, Math.floor((level - 1) / IT.nameTierEvery))];
  return { id: `${Date.now().toString(36)}-${itemSeq++}`, slot, name, rarity: R.id, level, stats };
}

const materialOf = (id) => IT.materials[id];

// 敵が倒れたマスに素材と装備を落とす。素材の数は敵レベルで増える (端数は確率で切り上げ)
function dropLoot(e) {
  const d = e.def, EL = P.enemyLevel;
  for (const m of d.drops || []) {
    if (Math.random() >= m.rate) continue;
    const n = (m.count || 1) * (1 + EL.materialGrowth * (e.level - 1));
    const amount = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    if (amount > 0) spawnLoot(e.tx, e.ty, { kind: 'material', id: m.id, amount });
  }
  const slots = Object.keys(IT.slots);
  for (let i = 0; i < (d.itemCount || 1); i++) {
    if (Math.random() >= d.itemRate) continue;
    spawnLoot(e.tx, e.ty, { kind: 'item', item: makeItem(slots[Math.floor(Math.random() * slots.length)], e.level, null, e.isBoss) });
  }
}
// ox, oy: 同じマスに何個もあるとき重ならないように、描く位置を少しずらす (px)
function spawnLoot(tx, ty, data) {
  loots.push({ ...data, tx, ty, ox: rand(-9, 9), oy: rand(-6, 9), t: 0 });
}

// 落とし物は lootLife ターンで消える。dt: 進んだ時間 (ターン)
function updateLoots(dt) {
  for (const l of loots) l.t += dt;
  loots = loots.filter((l) => l.t < EC.lootLife);
}

// そのマスの落とし物を拾う。持ち物がいっぱいなら装備は拾わない (素材はいつも拾う)
function pickUpAt(tx, ty) {
  const p = player;
  for (const l of loots) {
    if (l.tx !== tx || l.ty !== ty) continue;
    if (l.kind === 'material') {
      const m = materialOf(l.id), rc = rarityOf(m.rarity).color;
      p.materials[l.id] = (p.materials[l.id] || 0) + l.amount;
      floatText(p.x, p.y - 30, `${m.name} ×${l.amount}`, rc, 14);
      log(`${m.name}を ${l.amount} つ拾った。`, rc);
      l.taken = true;
    } else if (p.inventory.length >= EC.inventorySize) {
      log(`持ち物がいっぱいで${l.item.name}を拾えない。`, '#ff8a80');
    } else {
      p.inventory.push(l.item);
      floatText(p.x, p.y - 40, l.item.name, rarityOf(l.item.rarity).color, 16);
      log(`${l.item.name}を拾った。`, rarityOf(l.item.rarity).color);
      l.taken = true;
    }
  }
  loots = loots.filter((l) => !l.taken);
}

// 回復薬を使う (1 行動)。id: data/items.js の ITEMS.potions のキー。使えたら true
function usePotion(id) {
  const p = player, po = IT.potions[id];
  if (p.dead) return false;
  if (!(p.potions[id] > 0)) { log(`${po.name}がない。`, '#9da7b3'); return false; }
  if (p.hp >= p.stats.maxHp) { log('HP は満タンだ。', '#9da7b3'); return false; }
  const heal = Math.round(p.stats.maxHp * po.heal);
  p.hp = Math.min(p.stats.maxHp, p.hp + heal);
  p.potions[id]--;
  floatText(p.x, p.y - 30, `+${heal}`, '#69f0ae', 18);
  log(`${po.name}を使った。HP が ${heal} 回復した。`, '#69f0ae');
  burst(p.x, p.y, '#69f0ae', 14, 140);
  return true;
}
