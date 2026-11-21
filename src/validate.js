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

  const mapCells = {};
  for (const [zid, z] of Object.entries(WORLD.zones)) {
    if (z.parent) {
      // 建物の中: 世界地図には出さない。外のゾーンから入口 (door) の門でつながっている
      check(WORLD.zones[z.parent] && !WORLD.zones[z.parent].parent, `world.js ${zid}: parent '${z.parent}' が外のゾーンにない`);
      check(!z.mapPos, `world.js ${zid}: 建物の中 (parent あり) には mapPos を書かない`);
      check(!WORLD.zones[z.parent] || WORLD.zones[z.parent].gates.some((g) => g.to === zid && g.door),
        `world.js ${zid}: parent '${z.parent}' にこの建物への入口 (door: true の門) がない`);
    }
    const okPos = z.parent || (Array.isArray(z.mapPos) && z.mapPos.length === 2 && z.mapPos.every((v) => Number.isInteger(v) && v >= 0));
    check(okPos, `world.js ${zid}: 世界地図の位置 mapPos [列, 行] がない`);
    if (okPos && !z.parent) {
      const key = z.mapPos.join(',');
      check(!mapCells[key], `world.js ${zid}: 世界地図の位置 mapPos が '${mapCells[key]}' と重なっている`);
      mapCells[key] = zid;
    }
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
      check(NPC_KINDS[n.kind], `world.js ${zid} の NPC '${n.id}': kind '${n.kind}' が data/npcs.js にない`);
      npcIds.push(n.id);
      // 役目 (role) は src/ui.js の NPC_ROLES にあり、開く画面が SCREENS にあるか。役目ごとに書くもの (店のキーなど) は役目の check で調べる
      const role = NPC_ROLES[n.role];
      check(role, `world.js ${zid} の NPC '${n.id}': 役目 role '${n.role}' が NPC_ROLES (src/ui.js) にない`);
      check(!role || SCREENS[role.screen], `world.js ${zid} の NPC '${n.id}': 役目 '${n.role}' の画面 '${role && role.screen}' が SCREENS にない`);
      for (const msg of (role && role.check ? role.check(n) : [])) check(false, `world.js ${zid} の NPC '${n.id}': ${msg}`);
      // 絵 (省略可。省略するか読み込めないと丸と字で描く)。起動時に読み込みを始める
      check(n.sprite === undefined || (typeof n.sprite === 'string' && /\.(png|webp)$/i.test(n.sprite)), `world.js ${zid} の NPC '${n.id}': sprite は PNG か WebP のパスにする`);
      if (n.sprite) getSprite(n.sprite);
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
  // 強化 (data/buffs.js) と、強化をかける技
  for (const [id, b] of Object.entries(BUFFS)) {
    check(STATS[b.stat], `data/buffs.js ${id}: stat '${b.stat}' が data/stats.js にない`);
    check(b.mult > 0, `data/buffs.js ${id}: mult は 0 より大きくする`);
  }
  for (const s of SKILLS.filter((x) => x.type === 'buff')) {
    check(BUFFS[s.buff], `data/skills.js スキル「${s.name}」: buff '${s.buff}' が data/buffs.js にない`);
    check(s.duration >= 1, `data/skills.js スキル「${s.name}」: duration は 1 以上にする`);
  }
  // 技の種類: 物理は power、術は base が要る
  const attacks = [['data/player.js', PLAYER.basicAttack],
    ...SKILLS.filter((s) => s.type !== 'dash' && s.type !== 'buff').map((s) => ['data/skills.js', s]),
    ...Object.entries(ENEMIES).flatMap(([type, d]) => d.attacks.map((a) => [`data/enemies.js ${type}`, a]))];
  for (const [where, a] of attacks) {
    const kind = a.kind || 'physical';
    check(kind === 'physical' || kind === 'magic', `${where} の技「${a.name}」: kind '${kind}' は physical か magic にする`);
    check(kind !== 'physical' || a.power > 0, `${where} の技「${a.name}」: 物理の技に power がない`);
    check(kind !== 'magic' || a.base >= 0, `${where} の技「${a.name}」: 術に base がない`);
  }
  // MP: 主人公は最大 MP と MP 再生を持つ。スキルの消費 MP は 0 以上で、Lv1 の最大 MP を超えない (超えると使えない技になる)
  for (const k of ['maxMp', 'mpRegen']) check(PLAYER.stats[k] >= 0, `data/player.js stats: ${k} がない`);
  for (const s of SKILLS) {
    check(s.mp === undefined || s.mp >= 0, `data/skills.js のスキル「${s.name}」: mp は 0 以上にする`);
    check(!(s.mp > PLAYER.stats.maxMp), `data/skills.js のスキル「${s.name}」: mp ${s.mp} が Lv1 の maxMp ${PLAYER.stats.maxMp} より大きい`);
  }
  // スキルの id (覚えたスキル・スキル欄・セーブが指す)・覚え方 (learnAtLevel)・スキル欄 (skillSlots)
  const skillIds = SKILLS.map((s) => s.id);
  for (const s of SKILLS) check(typeof s.id === 'string' && s.id !== '', `data/skills.js のスキル「${s.name}」: id がない`);
  check(new Set(skillIds).size === skillIds.length, 'data/skills.js: スキルの id が重なっている');
  for (const [id, lv] of Object.entries(PLAYER.learnAtLevel || {})) {
    check(skillIds.includes(id), `data/player.js learnAtLevel: スキル '${id}' が data/skills.js にない`);
    check(Number.isInteger(lv) && lv >= 1 && lv <= P.progression.maxLevel, `data/player.js learnAtLevel.${id}: レベル ${lv} は 1〜${P.progression.maxLevel} の整数にする`);
  }
  check(Object.values(PLAYER.learnAtLevel || {}).includes(1), 'data/player.js learnAtLevel: Lv1 で覚えるスキルがない (はじめから遊ぶとスキルがない)');
  const slots = PLAYER.skillSlots || [];
  for (const b of slots) check(skillIds.includes(b.skill), `data/player.js skillSlots: キー '${b.key}' のスキル '${b.skill}' が data/skills.js にない`);
  const slotted = slots.map((b) => b.skill);
  check(new Set(slotted).size === slotted.length, 'data/player.js skillSlots: 同じスキルを 2 つのキーに置いている');
  const keys = slots.map((b) => b.key);
  check(keys.every((k) => typeof k === 'string' && k !== ''), 'data/player.js skillSlots: key がないものがある');
  check(new Set(keys).size === keys.length, 'data/player.js skillSlots: スキルのキーが重なっている');
  // 移動・待機・画面のキーと重なると、そちらが先に使われてスキルが出ない
  const reserved = [...Object.keys(MOVE_KEYS), ...WAIT_KEYS, 'i', 'f', 'p', 'escape', 'enter'];
  for (const k of keys) check(!reserved.includes(k), `data/player.js: スキルのキー '${k}' は移動や画面のキーと重なっている`);
  // 回復薬のキーも、移動・画面・スキルのキーと重ならないようにする
  const potionKeys = Object.values(ITEMS.potions).map((po) => po.key);
  check(new Set(potionKeys).size === potionKeys.length, 'data/items.js potions: 回復薬のキーが重なっている');
  for (const k of potionKeys) check(!reserved.includes(k) && !keys.includes(k), `data/items.js potions: キー '${k}' は移動・画面・スキルのキーと重なっている`);
  check(ITEMS.potions.potion, 'data/items.js potions: クエストの報酬に使う potion がない');
  // NPC の種類も主人公と同じステータスを持つ (計算で決まるものは書かない)
  for (const [kind, k] of Object.entries(NPC_KINDS)) {
    for (const st in PLAYER.stats) check(Number.isFinite(k.stats[st]) && k.stats[st] >= 0, `data/npcs.js ${kind}: stats に ${st} がない`);
    for (const st in k.stats) check(st in PLAYER.stats, `data/npcs.js ${kind}: stats の ${st} は主人公にないステータス (計算で決まるものは書かない)`);
    for (const st in k.gear || {}) check(STATS[st], `data/npcs.js ${kind}: gear の ${st} が data/stats.js にない`);
  }
  for (const k in SITUATIONS) check(P.field.ai.situations[k], `params.js field.ai.situations: '${k}' の数値がない (src/ai.js の SITUATIONS にはある)`);
  check(PLAYER.sprite === undefined || (typeof PLAYER.sprite === 'string' && /\.(png|webp)$/i.test(PLAYER.sprite)), 'data/player.js: sprite は PNG か WebP のパスにする');
  if (PLAYER.sprite) getSprite(PLAYER.sprite);
  check(PLAYER.face === undefined || (typeof PLAYER.face === 'string' && /\.(png|webp)$/i.test(PLAYER.face)), 'data/player.js: face は PNG か WebP のパスにする');
  if (PLAYER.face) getSprite(PLAYER.face);
  // キャラの描き方 (data/theme.js の UNIT_LOOK): どの種類もあり、overlays が src/render.js の UNIT_OVERLAYS にあるか
  for (const kind of ['hero', 'enemy', 'boss', 'ally', 'npc']) check(UNIT_LOOK[kind], `data/theme.js: UNIT_LOOK に ${kind} がない`);
  for (const [kind, look] of Object.entries(UNIT_LOOK)) for (const o of look.overlays || []) check(UNIT_OVERLAYS[o], `data/theme.js UNIT_LOOK.${kind}: overlays の '${o}' が UNIT_OVERLAYS (src/render.js) にない`);
  for (const [type, d] of Object.entries(ENEMIES)) {
    // 敵も主人公と同じステータスを持つ (計算で決まるものは書かない)
    for (const k in PLAYER.stats) check(Number.isFinite(d.stats[k]) && d.stats[k] >= 0, `data/enemies.js ${type}: stats に ${k} がない`);
    for (const k in d.stats) check(k in PLAYER.stats, `data/enemies.js ${type}: stats の ${k} は主人公にないステータス (計算で決まるものは書かない)`);
    for (const k in d.gear || {}) check(STATS[k], `data/enemies.js ${type}: gear の ${k} が data/stats.js にない`);
    check(d.attacks.some((a) => !a.mp), `data/enemies.js ${type}: MP を使わない基本の技がない (MP が尽きると攻撃できなくなる)`);
    check(d.skillChance === undefined || (d.skillChance >= 0 && d.skillChance <= 1), `data/enemies.js ${type}: skillChance は 0〜1 にする`);
    check(d.keepDistance === undefined || d.keepDistance > 0, `data/enemies.js ${type}: keepDistance は 0 より大きくする`);
    for (const a of d.attacks) check(a.weight === undefined || a.weight > 0, `data/enemies.js ${type} の技「${a.name}」: weight は 0 より大きくする`);
    for (const a of d.attacks) for (const k of a.situations || []) check(P.field.ai.situations[k] && SITUATIONS[k], `data/enemies.js ${type} の技「${a.name}」: situations の '${k}' が params.js の field.ai.situations にない`);
    check(d.surround === undefined || typeof d.surround === 'boolean', `data/enemies.js ${type}: surround は true か false にする`);
    check(d.sprite === undefined || (typeof d.sprite === 'string' && /\.(png|webp)$/i.test(d.sprite)), `data/enemies.js ${type}: sprite は PNG か WebP のパスにする (読み込めないときは描くときに出る)`);
    if (d.sprite) getSprite(d.sprite); // 起動時に読み込みを始める (なければここでエラーが出る)
    for (const a of d.attacks) {
      check(a.cooldown >= 1, `data/enemies.js ${type} の技「${a.name}」: cooldown は 1 以上にする`);
      check(a.mp === undefined || a.mp >= 0, `data/enemies.js ${type} の技「${a.name}」: mp は 0 以上にする`);
      check(!(a.mp > d.stats.maxMp), `data/enemies.js ${type} の技「${a.name}」: mp ${a.mp} が Lv1 の maxMp ${d.stats.maxMp} より大きい`);
    }
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
    for (const po of sh.potions) check(ITEMS.potions[po], `data/items.js shops.${id}: 回復薬 '${po}' が potions にない`);
  }
  for (const [id, sm] of Object.entries(ITEMS.smiths)) {
    for (const [slot, r] of sm.gear) check(ITEMS.slots[slot] && rarityIds.includes(r), `data/items.js smiths.${id}: 部位 '${slot}' かレア度 '${r}' がない`);
  }
  for (const [id, po] of Object.entries(ITEMS.potions)) check(rarityIds.includes(po.rarity), `data/items.js potions.${id}: レア度 '${po.rarity}' がない`);
  for (const [id, m] of Object.entries(ITEMS.materials)) check(rarityIds.includes(m.rarity), `data/items.js materials.${id}: レア度 '${m.rarity}' がない`);
  for (const [type, d] of Object.entries(ENEMIES)) {
    const drops = (d.drops || []).filter((m) => ITEMS.materials[m.id]);
    for (const m of d.drops || []) check(ITEMS.materials[m.id], `data/enemies.js ${type}: 素材 '${m.id}' が data/items.js の materials にない`);
    // 同じ敵が落とす素材どうしでは、レア度が高いほど確率が低く (同じでもよい)、売値が高い
    for (const a of drops) for (const b of drops) {
      const ma = ITEMS.materials[a.id], mb = ITEMS.materials[b.id];
      if (rarityIds.indexOf(ma.rarity) <= rarityIds.indexOf(mb.rarity)) continue;
      check(a.rate <= b.rate && ma.price > mb.price,
        `data/enemies.js ${type}: レア度の高い素材 '${a.id}' は '${b.id}' より確率を低く (同じまで)、売値を高くする`);
    }
  }

  const questIds = QUESTS.map((q) => q.id);
  for (const q of QUESTS) {
    check(ENEMIES[q.target], `data/quests.js '${q.id}': 敵 '${q.target}' が data/enemies.js にない`);
    check(npcIds.includes(q.giver), `data/quests.js '${q.id}': NPC '${q.giver}' が world.js にない`);
    check(!q.requires || questIds.includes(q.requires), `data/quests.js '${q.id}': requires '${q.requires}' のクエストがない`);
    check(!q.requires || !(questById(q.requires) || {}).repeatable, `data/quests.js '${q.id}': requires '${q.requires}' はくり返しのクエストなので使えない`);
    const it = q.reward.item;
    check(!it || (ITEMS.slots[it.slot] && rarityIds.includes(it.rarity)), `data/quests.js '${q.id}': 報酬の装備の部位かレア度がない`);
  }

  for (let n = SAVE_OLDEST; n < SAVE_VERSION; n++) {
    check(typeof SAVE_MIGRATIONS[n] === 'function', `src/save.js: セーブの形 v${n} → v${n + 1} の直し方 (SAVE_MIGRATIONS[${n}]) がない`);
  }

  for (const e of errors) console.error('[データの確認]', e);
  return errors;
}
