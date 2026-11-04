// =====================================================================
//  データの確認
//  data/*.js と world.js のあいだで、存在しない id や種類を指していないか、
//  大事な地点が通れないマスになっていないかを起動時に調べ、コンソールに出す
// =====================================================================
'use strict';

function validateData() {
  const errors = [];
  const check = (ok, msg) => { if (!ok) errors.push(msg); };
  const rarityIds = ITEMS.rarities.map((r) => r.id);
  const npcIds = [];

  for (const [zid, z] of Object.entries(WORLD.zones)) {
    for (const o of z.obstacles) check(WORLD.terrain[o[0]], `world.js ${zid}: 地形の種類 '${o[0]}' が terrain にない`);
    for (const c of z.camps || []) {
      for (const m of c.members) check(ENEMIES[m], `world.js ${zid} の湧き場所「${c.name}」: 敵 '${m}' が data/enemies.js にない`);
    }
    for (const g of z.gates) {
      const to = WORLD.zones[g.to];
      check(to, `world.js ${zid} の門 '${g.id}': 行き先のゾーン '${g.to}' がない`);
      check(!to || to.gates.some((t) => t.id === g.toGate), `world.js ${zid} の門 '${g.id}': 行き先の門 '${g.toGate}' がない`);
    }
    for (const n of z.npcs || []) {
      npcIds.push(n.id);
      check(n.role !== 'shop' || ITEMS.shops[n.shop], `world.js ${zid} の NPC '${n.id}': 店 '${n.shop}' が data/items.js の shops にない`);
    }
  }
  check(WORLD.zones[WORLD.start] && WORLD.zones[WORLD.start].respawn, `world.js: start のゾーン '${WORLD.start}' に respawn がない`);
  check(WORLD.zones[WORLD.respawnZone] && WORLD.zones[WORLD.respawnZone].respawn, `world.js: respawnZone '${WORLD.respawnZone}' に respawn がない`);
  // 門を順にたどって、全部のゾーンに行けるか
  const reach = new Set([WORLD.start]);
  for (const zid of reach) for (const g of WORLD.zones[zid] ? WORLD.zones[zid].gates : []) if (WORLD.zones[g.to]) reach.add(g.to);
  for (const zid of Object.keys(WORLD.zones)) check(reach.has(zid), `world.js: ゾーン '${zid}' へは門をたどって行けない`);

  for (const [slot, e] of Object.entries(PLAYER.startEquip)) {
    check(ITEMS.slots[slot], `data/player.js startEquip: 部位 '${slot}' が data/items.js にない`);
    check(!e || rarityIds.includes(e.rarity), `data/player.js startEquip.${slot}: レア度 '${e && e.rarity}' がない`);
  }
  // 主人公のステータス: 成長するものは Lv1 の値があり、計算で決まるものは PLAYER.stats に書かない
  for (const k in PLAYER.stats) check(STATS[k], `data/player.js stats: '${k}' が data/stats.js にない`);
  for (const [k, g] of Object.entries(P.progression.growth)) {
    check(k in PLAYER.stats, `params.js progression.growth: '${k}' の Lv1 の値が data/player.js の stats にない`);
    const lv = g.gain.map((pt) => pt[0]);
    check(lv.every((v, i) => v > (i ? lv[i - 1] : 1)), `params.js progression.growth.${k}: gain のレベルが 2 以上で小さい順になっていない`);
    check(lv[lv.length - 1] >= P.progression.maxLevel, `params.js progression.growth.${k}: gain が最大レベル (${P.progression.maxLevel}) まで届いていない`);
  }
  for (const [k, d] of Object.entries(P.derivedStats)) {
    check(STATS[k], `params.js derivedStats: '${k}' が data/stats.js にない`);
    check(!(k in PLAYER.stats), `data/player.js stats: '${k}' は params.js の derivedStats で計算するので書かない`);
    check(d.from in PLAYER.stats, `params.js derivedStats.${k}: もとのステータス '${d.from}' が data/player.js の stats にない`);
  }
  // 技の種類: 物理は power、術は base が要る
  const attacks = [['data/player.js', PLAYER.basicAttack],
    ...PLAYER.skills.filter((s) => s.type !== 'dash').map((s) => ['data/player.js', s]),
    ...Object.entries(ENEMIES).flatMap(([type, d]) => d.attacks.map((a) => [`data/enemies.js ${type}`, a]))];
  for (const [where, a] of attacks) {
    const kind = a.kind || 'physical';
    check(kind === 'physical' || kind === 'magic', `${where} の技「${a.name}」: kind '${kind}' は physical か magic にする`);
    check(kind !== 'physical' || a.power > 0, `${where} の技「${a.name}」: 物理の技に power がない`);
    check(kind !== 'magic' || a.base >= 0, `${where} の技「${a.name}」: 術に base がない`);
  }
  const keys = PLAYER.skills.map((s) => s.key);
  check(new Set(keys).size === keys.length, 'data/player.js: スキルのキーが重なっている');
  // 移動・待機・画面のキーと重なると、そちらが先に使われてスキルが出ない
  const reserved = [...Object.keys(MOVE_KEYS), ...WAIT_KEYS, 'i', 'f', 'p', 'escape', 'enter'];
  for (const k of keys) check(!reserved.includes(k), `data/player.js: スキルのキー '${k}' は移動や画面のキーと重なっている`);
  // 回復薬のキーも、移動・画面・スキルのキーと重ならないようにする
  const potionKeys = Object.values(ITEMS.potions).map((po) => po.key);
  check(new Set(potionKeys).size === potionKeys.length, 'data/items.js potions: 回復薬のキーが重なっている');
  for (const k of potionKeys) check(!reserved.includes(k) && !keys.includes(k), `data/items.js potions: キー '${k}' は移動・画面・スキルのキーと重なっている`);
  check(ITEMS.potions.potion, 'data/items.js potions: クエストの報酬に使う potion がない');
  for (const [type, d] of Object.entries(ENEMIES)) {
    check(d.stats.speed > 0, `data/enemies.js ${type}: speed がない`);
    for (const a of d.attacks) check(a.cooldown >= 1, `data/enemies.js ${type} の技「${a.name}」: cooldown は 1 以上にする`);
    check(d.stats.int >= 0 && d.stats.mdef >= 0, `data/enemies.js ${type}: int か mdef がない`);
  }

  // 復活地点・門から入ったときの位置・NPC・湧き場所の中心が、通れるマスにあるか (world.js)
  for (const zid of Object.keys(WORLD.zones)) {
    loadZone(zid);
    const z = WORLD.zones[zid];
    const open = (px, py, what) => {
      const tx = tileOf(px), ty = tileOf(py);
      check(inMap(tx, ty) && !blocked[idx(tx, ty)], `world.js ${zid}: ${what} (${px}, ${py}) が通れないマスにある`);
    };
    if (z.respawn) open(z.respawn.x, z.respawn.y, '復活地点');
    for (const g of z.gates) open(g.spawn.x, g.spawn.y, `門 '${g.id}' の spawn`);
    for (const c of z.camps || []) open(c.x, c.y, `湧き場所「${c.name}」の中心`);
    for (const n of zone.npcs) {
      check(NB.some(([dx, dy]) => !isBlocked(n.tx + dx, n.ty + dy)), `world.js ${zid}: NPC '${n.id}' のとなりに通れるマスがない`);
    }
  }
  zone = null;

  for (const [slot, s] of Object.entries(ITEMS.slots)) {
    for (const k in s.base) check(STATS[k], `data/items.js ${slot}: 基本性能 '${k}' が data/stats.js にない`);
  }
  for (const k in ITEMS.affixes) check(STATS[k], `data/items.js: 追加性能 '${k}' が data/stats.js にない`);
  for (const [id, sh] of Object.entries(ITEMS.shops)) {
    for (const [slot, r] of sh.gear) check(ITEMS.slots[slot] && rarityIds.includes(r), `data/items.js shops.${id}: 部位 '${slot}' かレア度 '${r}' がない`);
    for (const po of sh.potions) check(ITEMS.potions[po], `data/items.js shops.${id}: 回復薬 '${po}' が potions にない`);
  }
  for (const [type, d] of Object.entries(ENEMIES)) {
    for (const m of d.drops || []) check(ITEMS.materials[m.id], `data/enemies.js ${type}: 素材 '${m.id}' が data/items.js の materials にない`);
  }

  const questIds = QUESTS.map((q) => q.id);
  for (const q of QUESTS) {
    check(ENEMIES[q.target], `data/quests.js '${q.id}': 敵 '${q.target}' が data/enemies.js にない`);
    check(npcIds.includes(q.giver), `data/quests.js '${q.id}': NPC '${q.giver}' が world.js にない`);
    check(!q.requires || questIds.includes(q.requires), `data/quests.js '${q.id}': requires '${q.requires}' のクエストがない`);
    const it = q.reward.item;
    check(!it || (ITEMS.slots[it.slot] && rarityIds.includes(it.rarity)), `data/quests.js '${q.id}': 報酬の装備の部位かレア度がない`);
  }

  for (const e of errors) console.error('[データの確認]', e);
  return errors;
}
