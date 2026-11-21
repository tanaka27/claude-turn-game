// =====================================================================
//  装備・素材・落とし物・道具 (使うもの)
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
const scaledByLevel = ([a, b], lv) => a + b * (lv - 1);
const rarityOf = (id) => ITEMS.rarities.find((r) => r.id === id) || ITEMS.rarities[0];
const itemValue = (it) => Math.round(scaledByLevel(ITEMS.value, it.level) * rarityOf(it.rarity).value);
const sellPrice = (it) => Math.max(1, Math.floor(itemValue(it) * ECON.sellRate));
let itemSeq = 0;

function pickWeighted(list, key) {
  const total = list.reduce((s, r) => s + r[key], 0);
  let x = Math.random() * total;
  for (const r of list) { x -= r[key]; if (x <= 0) return r; }
  return list[list.length - 1];
}

// 装備を作る。rarity を省略するとレア度の出やすさ (boss なら bossWeight) で決める
function makeItem(slot, level, rarity, boss) {
  const S = ITEMS.slots[slot];
  const R = rarity ? rarityOf(rarity) : pickWeighted(ITEMS.rarities, boss ? 'bossWeight' : 'weight');
  const stats = {};
  for (const k in S.base) stats[k] = roundStat(k, scaledByLevel(S.base[k], level) * R.mult);
  const pool = Object.keys(ITEMS.affixes).filter((k) => !(k in stats));
  for (let i = 0; i < R.affixes + S.extraAffixes && pool.length; i++) {
    const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    stats[k] = roundStat(k, scaledByLevel(ITEMS.affixes[k], level) * rand(0.8, 1.2));
  }
  const name = S.names[Math.min(S.names.length - 1, Math.floor((level - 1) / ITEMS.nameTierEvery))];
  return { id: `${Date.now().toString(36)}-${itemSeq++}`, slot, name, rarity: R.id, level, stats };
}

const materialOf = (id) => ITEMS.materials[id];

// 敵が倒れたマスに素材と装備を落とす。素材の数は敵レベルで増える (端数は確率で切り上げ)
function dropLoot(e) {
  const d = e.def, EL = PARAMS.enemyLevel;
  for (const m of d.drops || []) {
    if (Math.random() >= m.rate) continue;
    const n = (m.count || 1) * (1 + EL.materialGrowth * (e.level - 1));
    const amount = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    if (amount > 0) spawnLoot(e.tx, e.ty, { kind: 'material', id: m.id, amount });
  }
  const slots = Object.keys(ITEMS.slots);
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
  loots = loots.filter((l) => l.t < ECON.lootLife);
}

// そのマスの落とし物を拾う。持ち物がいっぱいなら装備は拾わない (素材はいつも拾う)
function pickUpAt(tx, ty) {
  const p = player;
  for (const l of loots) {
    if (l.tx !== tx || l.ty !== ty) continue;
    if (l.kind === 'material') {
      const m = materialOf(l.id), rc = rarityOf(m.rarity).color;
      p.materials[l.id] = (p.materials[l.id] || 0) + l.amount;
      floatText(p.x, p.y - 30, txt('items.pickMaterialFloat', { name: m.name, amount: l.amount }), rc, THEME.float.material.size);
      logMsg(txt('items.pickMaterial', { name: m.name, amount: l.amount }), rc);
      l.taken = true;
    } else if (p.inventory.length >= ECON.inventorySize) {
      logMsg(txt('items.bagFull', { name: l.item.name }), THEME.msg.bagFull);
    } else {
      p.inventory.push(l.item);
      floatText(p.x, p.y - 40, l.item.name, rarityOf(l.item.rarity).color, THEME.float.item.size);
      logMsg(txt('items.pickItem', { name: l.item.name }), rarityOf(l.item.rarity).color);
      l.taken = true;
    }
  }
  if (loots.some((l) => l.taken && l.kind === 'material')) questEvent('materials'); // 集めるクエスト
  loots = loots.filter((l) => !l.taken);
}

// ----- 道具 (使うとなくなるもの。data/items.js の ITEMS.consumables) -----
// 効果の種類。道具の effects の 1 つ { kind, ... } を e、使われる相手を t として:
//   can(e, t): 効くか (使えるかの判定。道具の効果のどれか 1 つでも効けば使える)
//   refuse(e, t): 効かないときのメッセージ欄の文 / reason(e, t): 道具一覧で「〇〇なので使えない」に出す理由
//   desc(e, t): 説明 (t があれば今の値も出す。道具一覧・店)
//   apply(e, t, u): 効かせる。戻り値 { text: メッセージ欄の文の続き, float: 頭の上の文, color, size, fx: 演出 (fx〇〇) }
//   check(e): データの確認 (おかしいところの文。なければ '')
// 種類を足すときはここに 1 つ足す (docs/consumables.md)。
//   今後の候補: cure (弱体・状態異常を消す。e.buffs: 消す data/buffs.js のキーの並び。
//   can = t.buffs に e.buffs のどれかがある / apply = それを外して refreshStats(t)。未実装)
const whose = (t) => (t === player ? '' : txt('items.owner', { who: t.name }));
const whoseSp = (t) => (t === player ? '' : txt('items.ownerSp', { who: t.name })); // 「リナの HP」
// 説明の後ろに付ける今の回復量 (t がなければ空)
const nowValue = (t, n) => (t ? txt('items.nowValue', { n }) : '');
const ITEM_EFFECTS = {
  healHp: {
    can: (e, t) => t.hp < t.stats.maxHp,
    refuse: (e, t) => txt('items.hpFull', { whose: whoseSp(t) }),
    reason: () => txt('items.hpFullReason'),
    desc: (e, t) => txt('items.healHpDesc', { pct: Math.round(e.ratio * 100), now: nowValue(t, t && Math.round(t.stats.maxHp * e.ratio)) }),
    apply(e, t) {
      const heal = Math.round(t.stats.maxHp * e.ratio);
      t.hp = Math.min(t.stats.maxHp, t.hp + heal);
      return { text: txt('items.hpHealed', { whose: whoseSp(t), n: heal }), float: txt('items.healFloat', { n: heal }), color: THEME.float.healHp.color, size: THEME.float.healHp.size, fx: fxHeal };
    },
    check: (e) => (e.ratio > 0 && e.ratio <= 1 ? '' : 'ratio は 0 より大きく 1 以下にする'),
  },
  healMp: {
    can: (e, t) => t.mp < t.stats.maxMp,
    refuse: (e, t) => txt('items.mpFull', { whose: whoseSp(t) }),
    reason: () => txt('items.mpFullReason'),
    desc: (e, t) => txt('items.healMpDesc', { pct: Math.round(e.ratio * 100), now: nowValue(t, t && Math.round(t.stats.maxMp * e.ratio)) }),
    apply(e, t) {
      const n = Math.round(t.stats.maxMp * e.ratio);
      t.mp = Math.min(t.stats.maxMp, t.mp + n);
      return { text: txt('items.mpHealed', { whose: whoseSp(t), n }), float: txt('items.healFloat', { n }), color: THEME.mp, size: THEME.float.healMp.size, fx: fxHeal };
    },
    check: (e) => (e.ratio > 0 && e.ratio <= 1 ? '' : 'ratio は 0 より大きく 1 以下にする'),
  },
  // 同じものがもう同じ長さ以上かかっていれば効かない (addBuff は残りの長いほうにするだけなので)
  addBuff: {
    can: (e, t) => !t.buffs.some((b) => b.id === e.buff && b.left >= e.actions),
    refuse: (e, t) => txt('items.buffActive', { whose: whose(t), buff: BUFFS[e.buff].name }),
    reason: (e) => txt('items.buffReason', { buff: BUFFS[e.buff].name }),
    desc: (e) => txt('items.buffDesc', { buff: BUFFS[e.buff].name, actions: e.actions }),
    apply(e, t, u) {
      const b = BUFFS[e.buff];
      addBuff(t, e.buff, e.actions, u);
      return { text: txt('items.buffApplied', { whose: whose(t), buff: b.name, actions: e.actions }), float: buffFloatText(b), color: b.color, size: THEME.float.buff.size, fx: fxBuff };
    },
    check: (e) => (!BUFFS[e.buff] ? `buff '${e.buff}' が data/buffs.js にない` : Number.isInteger(e.actions) && e.actions >= 1 ? '' : 'actions は 1 以上の整数にする'),
  },
};

// 道具の数 { 道具のキー: 数 } (主人公だけが持つ。ほかのキャラは持っていない = 0)
const consumableCount = (u, id) => (u.consumables && u.consumables[id]) || 0;
// u が道具 id を t (省略時は u 自身) に使えるか。使えるなら null、使えないなら { log: メッセージ欄の文, reason: 道具一覧の理由 }
function consumableBlock(u, id, t = u) {
  const c = ITEMS.consumables[id];
  if (!(consumableCount(u, id) > 0)) return { log: txt('items.none', { item: c.name }), reason: txt('items.noneReason') };
  if (c.effects.some((e) => ITEM_EFFECTS[e.kind].can(e, t))) return null;
  const e = c.effects[0], K = ITEM_EFFECTS[e.kind];
  return { log: K.refuse(e, t), reason: K.reason(e, t) };
}
// 道具の説明 (効果をつなげたもの)。t があれば今の値も出す
const consumableDesc = (id, t) => ITEMS.consumables[id].effects.map((e) => ITEM_EFFECTS[e.kind].desc(e, t)).join(txt('items.descSep'));

// キャラ u が道具 id を t (省略時は u 自身) に使う (1 行動)。どのキャラ・どの相手も、使うのはここだけ。使えたら true
//   数を 1 減らし、効く効果だけを効かせる。文の頭: 主人公以外が使うと「〇〇は」、ほかの相手に使うと「〇〇に」
function useConsumable(u, id, t = u) {
  const c = ITEMS.consumables[id];
  if (u.dead || t.dead) return false;
  const block = consumableBlock(u, id, t);
  if (block) { logMsg(block.log, THEME.msg.refuse); return false; }
  u.consumables[id]--;
  const done = c.effects.filter((e) => ITEM_EFFECTS[e.kind].can(e, t)).map((e) => ITEM_EFFECTS[e.kind].apply(e, t, u));
  done.forEach((r, i) => floatText(t.x, t.y - 30 - i * 18, r.float, r.color, r.size));
  logMsg(txt('items.used', { user: u === player ? '' : txt('items.usedBy', { who: u.name }), target: t === u ? '' : txt('items.usedOn', { who: t.name }),
    item: c.name, effects: done.map((r) => r.text).join('') }), done[0].color);
  for (const r of done) r.fx(t);
  return true;
}
