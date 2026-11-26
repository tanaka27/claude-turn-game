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

  check(WORLD.zones[WORLD.overworld] && WORLD.zones[WORLD.overworld].grid, `world.js: overworld のゾーン '${WORLD.overworld}' がないか、grid で描いていない`);
  for (const k in WORLD.legend) {
    const v = WORLD.legend[k];
    check(!!WORLD.terrain[v] !== !!WORLD.grounds[v], `world.js legend '${k}': '${v}' は terrain か grounds のどちらか一方にだけ書く`);
    check(!/[A-Z]/.test(k), `world.js legend '${k}': 英大文字は入口 (places) に使うので legend に書かない`);
  }
  for (const [zid, z] of Object.entries(WORLD.zones)) {
    if (z.parent) {
      // 建物の中: 世界地図には出さない。外のゾーンから入口 (door) の門でつながっている
      check(WORLD.zones[z.parent] && !WORLD.zones[z.parent].parent, `world.js ${zid}: parent '${z.parent}' が外のゾーンにない`);
      check(!WORLD.zones[z.parent] || WORLD.zones[z.parent].gates.some((g) => g.to === zid && g.door),
        `world.js ${zid}: parent '${z.parent}' にこの建物への入口 (door: true の門) がない`);
    }
    if (z.grid) {
      // grid で描くゾーン: 行の長さがそろっているか、文字が legend か places にあるか、入口が 1 つずつあるか、外周が通れないか
      const cols = z.grid[0].length, seen = {};
      check(WORLD.grounds[z.ground], `world.js ${zid}: ground '${z.ground}' が WORLD.grounds にない`);
      z.grid.forEach((row, r) => {
        check(row.length === cols, `world.js ${zid}: grid の ${r} 行目の長さ ${row.length} が 1 行目 (${cols}) と違う`);
        [...row].forEach((ch, c) => {
          if (z.places && z.places[ch]) { seen[ch] = (seen[ch] || 0) + 1; return; }
          const kind = WORLD.legend[ch];
          check(kind, `world.js ${zid}: grid の文字 '${ch}' (${c}, ${r}) が legend にも places にもない`);
          const edge = r === 0 || c === 0 || r === z.grid.length - 1 || c === cols - 1;
          if (edge && kind) check(WORLD.terrain[kind], `world.js ${zid}: grid の外周 (${c}, ${r}) が通れる ('${ch}')`);
        });
      });
      for (const ch in z.places || {}) check(seen[ch] === 1, `world.js ${zid}: 入口 '${ch}' が grid に ${seen[ch] || 0} 個ある (1 個にする)`);
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
  // ワールドマップの上を歩いて、はじめの町の入口から全部の入口と湧き場所に行けるか
  const ow = WORLD.zones[WORLD.overworld], startGate = ow && worldPlaceOf(WORLD.start);
  if (ow && startGate) {
    loadZone(WORLD.overworld);
    const field = new Float64Array(COLS * ROWS);
    computeFlow(tileOf(startGate.spawn.x), tileOf(startGate.spawn.y), field);
    const far = (px, py) => field[tileIndex(tileOf(px), tileOf(py))] >= 1e9;
    for (const g of ow.gates) check(!far(g.spawn.x, g.spawn.y), `world.js ${WORLD.overworld}: 入口 '${g.id}' へははじめの町から歩いて行けない`);
    for (const c of ow.camps || []) check(!far(c.x, c.y), `world.js ${WORLD.overworld}: 湧き場所「${c.name}」へははじめの町から歩いて行けない`);
    zone = null;
  }

  for (const [slot, e] of Object.entries(PLAYER.startEquip)) {
    check(ITEMS.slots[slot], `data/player.js startEquip: 部位 '${slot}' が data/items.js にない`);
    check(!e || rarityIds.includes(e.rarity), `data/player.js startEquip.${slot}: レア度 '${e && e.rarity}' がない`);
    check(!e || !ITEMS.slots[slot] || (ITEMS.slots[slot].types ? ITEMS.slots[slot].types[e.type] : e.type === undefined), `data/player.js startEquip.${slot}: 種類 '${e && e.type}' が部位の types にない`);
  }
  // 主人公のステータス: 成長するものは Lv1 の値があり、計算で決まるものは PLAYER.stats に書かない
  for (const k in PLAYER.stats) check(STATS[k], `data/player.js stats: '${k}' が data/stats.js にない`);
  // 行動で伸びるステータス (params.js の progression.growth): Lv1 の値があり、潜在の範囲がおかしくない
  const G = PARAMS.progression.growth, GP = G.potential;
  check(GP.min > 0 && GP.min <= GP.base && GP.base <= GP.max, 'params.js progression.growth.potential: min ≦ base ≦ max (min > 0) になっていない');
  for (const [k, g] of Object.entries(G.stats)) {
    const w = `params.js progression.growth.stats.${k}`;
    check(k in PLAYER.stats, `${w}: Lv1 の値が data/player.js の stats にない`);
    check(g.drop >= 0 && g.drop < 1, `${w}: drop は 0 以上 1 未満にする`);
  }
  for (const [ev, gains] of Object.entries(G.events)) {
    for (const k in gains) check(G.stats[k], `params.js progression.growth.events.${ev}: '${k}' は行動で伸びるステータス (growth.stats) にない`);
  }
  for (const k in PLAYER.potential || {}) {
    check(G.stats[k], `data/player.js potential: '${k}' は行動で伸びるステータス (params.js の growth.stats) にない`);
    check(PLAYER.potential[k] >= GP.min && PLAYER.potential[k] <= GP.max, `data/player.js potential.${k}: 潜在の下限〜上限の外`);
  }
  for (const [k, d] of Object.entries(PARAMS.derivedStats)) {
    check(STATS[k], `params.js derivedStats: '${k}' が data/stats.js にない`);
    check(!(k in PLAYER.stats), `data/player.js stats: '${k}' は params.js の derivedStats で計算するので書かない`);
    const from = typeof d.from === 'string' ? [d.from] : Object.keys(d.from || {});
    check(from.length > 0, `params.js derivedStats.${k}: from (もとのステータス) がない`);
    const before = Object.keys(PARAMS.derivedStats).slice(0, Object.keys(PARAMS.derivedStats).indexOf(k));
    for (const f of from) check(f in PLAYER.stats || before.includes(f), `params.js derivedStats.${k}: もとのステータス '${f}' が data/player.js の stats にも、これより前の derivedStats にもない`);
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
  check(PLAYER.stats.mpRegen >= 0, 'data/player.js stats: mpRegen がない');
  const lv1MaxMp = deriveStats({ ...PLAYER.stats }, []).maxMp;
  for (const s of SKILLS) {
    check(s.mp === undefined || s.mp >= 0, `data/skills.js のスキル「${s.name}」: mp は 0 以上にする`);
    check(!(s.mp > lv1MaxMp), `data/skills.js のスキル「${s.name}」: mp ${s.mp} が Lv1 の さいだいMP ${lv1MaxMp} より大きい`);
  }
  // スキルの id (覚えたスキル・スキル欄・セーブが指す)・覚え方 (learnAtLevel)・スキル欄 (skillSlots)
  const skillIds = SKILLS.map((s) => s.id);
  for (const s of SKILLS) check(typeof s.id === 'string' && s.id !== '', `data/skills.js のスキル「${s.name}」: id がない`);
  check(new Set(skillIds).size === skillIds.length, 'data/skills.js: スキルの id が重なっている');
  for (const [id, lv] of Object.entries(PLAYER.learnAtLevel || {})) {
    check(skillIds.includes(id), `data/player.js learnAtLevel: スキル '${id}' が data/skills.js にない`);
    check(Number.isInteger(lv) && lv >= 1 && lv <= PARAMS.progression.maxLevel, `data/player.js learnAtLevel.${id}: レベル ${lv} は 1〜${PARAMS.progression.maxLevel} の整数にする`);
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
  const reserved = [...Object.keys(MOVE_KEYS), ...WAIT_KEYS, 'i', 'f', 'p', 'm', 'tab', 'escape', 'enter'];
  for (const k of keys) check(!reserved.includes(k), `data/player.js: スキルのキー '${k}' は移動や画面のキーと重なっている`);
  // 道具 (consumables): キーは移動・画面・スキルのキーと重ならない。効果の種類は src/items.js の ITEM_EFFECTS にある
  //   矢 (arrow を持つもの) はキーで使わないので key・effects を持たない
  const usables = Object.values(ITEMS.consumables).filter((c) => !c.arrow);
  const itemKeys = usables.map((c) => c.key);
  check(itemKeys.every((k) => typeof k === 'string' && k !== ''), 'data/items.js consumables: key がないものがある (矢でない道具)');
  check(new Set(itemKeys).size === itemKeys.length, 'data/items.js consumables: 道具のキーが重なっている');
  for (const k of itemKeys) check(!reserved.includes(k) && !keys.includes(k), `data/items.js consumables: キー '${k}' は移動・画面・スキルのキーと重なっている`);
  for (const [id, c] of Object.entries(ITEMS.consumables)) {
    const at = `data/items.js consumables.${id}`;
    check(typeof c.name === 'string' && c.name !== '', `${at}: name がない`);
    check(Number.isInteger(c.max) && c.max >= 1, `${at}: max は 1 以上の整数にする`);
    check(Number.isInteger(c.start) && c.start >= 0 && c.start <= c.max, `${at}: start は 0〜max の整数にする`);
    check(Number.isInteger(c.price) && c.price >= 1, `${at}: price は 1 以上の整数にする`);
    check(c.buyCount === undefined || (Number.isInteger(c.buyCount) && c.buyCount >= 1 && c.buyCount <= c.max), `${at}: buyCount は 1〜max の整数にする`);
    if (c.arrow) {
      check(Number.isFinite(c.arrow.atk) && c.arrow.atk >= 0, `${at}: arrow.atk は 0 以上の数にする`);
      check(c.key === undefined && c.effects === undefined, `${at}: 矢 (arrow) には key・effects を書かない`);
      continue;
    }
    check(Array.isArray(c.effects) && c.effects.length > 0, `${at}: effects (効果の並び) がない`);
    for (const e of Array.isArray(c.effects) ? c.effects : []) {
      const K = e && ITEM_EFFECTS[e.kind];
      check(K, `${at}: 効果の種類 '${e && e.kind}' が src/items.js の ITEM_EFFECTS にない`);
      const bad = K ? K.check(e) : '';
      check(!bad, `${at}: ${e && e.kind}: ${bad}`);
    }
  }
  // NPC の種類も主人公と同じステータスを持つ (計算で決まるものは書かない)
  for (const [kind, k] of Object.entries(NPC_KINDS)) {
    for (const st in PLAYER.stats) check(Number.isFinite(k.stats[st]) && k.stats[st] >= 0, `data/npcs.js ${kind}: stats に ${st} がない`);
    for (const st in k.stats) check(st in PLAYER.stats, `data/npcs.js ${kind}: stats の ${st} は主人公にないステータス (計算で決まるものは書かない)`);
    for (const st in k.gear || {}) check(STATS[st], `data/npcs.js ${kind}: gear の ${st} が data/stats.js にない`);
  }
  for (const k in SITUATIONS) check(PARAMS.field.ai.situations[k], `params.js field.ai.situations: '${k}' の数値がない (src/ai.js の SITUATIONS にはある)`);
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
    for (const a of d.attacks) for (const k of a.situations || []) check(PARAMS.field.ai.situations[k] && SITUATIONS[k], `data/enemies.js ${type} の技「${a.name}」: situations の '${k}' が params.js の field.ai.situations にない`);
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
      check(inMap(tx, ty) && !blocked[tileIndex(tx, ty)], `world.js ${zid}: ${what} (${px}, ${py}) が通れないマスにある`);
    };
    if (z.respawn) open(z.respawn.x, z.respawn.y, '復活地点');
    for (const g of z.gates) open(g.spawn.x, g.spawn.y, `門 '${g.id}' の spawn`);
    for (const c of z.camps || []) open(c.x, c.y, `湧き場所「${c.name}」の中心`);
    for (const n of zone.npcs) {
      check(NEIGHBORS.some(([dx, dy]) => !isBlocked(n.tx + dx, n.ty + dy)), `world.js ${zid}: NPC '${n.id}' のとなりに通れるマスがない`);
    }
  }
  zone = null;

  for (const [slot, s] of Object.entries(ITEMS.slots)) {
    const kinds = s.types ? Object.entries(s.types).map(([t, k]) => [`${slot}.types.${t}`, k]) : [[slot, s]];
    check(!s.types || kinds.length > 0, `data/items.js ${slot}: types に種類がない`);
    for (const [w, k] of kinds) {
      check(k.label && Array.isArray(k.names) && k.names.length > 0, `data/items.js ${w}: label か names がない`);
      for (const b in k.base || {}) check(STATS[b], `data/items.js ${w}: 基本性能 '${b}' が data/stats.js にない`);
      for (const b in k.fixed || {}) check(STATS[b] && !(b in (k.base || {})), `data/items.js ${w}: fixed の '${b}' が data/stats.js にないか、base と重なっている`);
      check(!k.ammo || Object.values(ITEMS.consumables).some((c) => c.arrow), `data/items.js ${w}: ammo (矢を撃つ) なのに consumables に矢 (arrow) がない`);
      check(!k.ammo || (k.fixed && k.fixed.range >= 1), `data/items.js ${w}: ammo (矢を撃つ) の武器には fixed.range (射程。1 以上) を書く`);
    }
  }
  // 種類のある部位 (武器) で、種類が合っているか (type を省略したらくじにする書き方では、省略を許す)
  const typeOk = (slot, type, optional) => !ITEMS.slots[slot] || !ITEMS.slots[slot].types ? type === undefined : (optional && type === undefined) || !!ITEMS.slots[slot].types[type];
  for (const k in ITEMS.affixes) check(STATS[k], `data/items.js: 追加性能 '${k}' が data/stats.js にない`);
  for (const [id, sh] of Object.entries(ITEMS.shops)) {
    for (const c of sh.consumables || []) check(ITEMS.consumables[c], `data/items.js shops.${id}: 道具 '${c}' が consumables にない`);
  }
  for (const r of ITEMS.smithRarities) check(rarityIds.includes(r), `data/items.js smithRarities: レア度 '${r}' がない`);
  check(ITEMS.craftRarities.length > 0, 'data/items.js craftRarities: くじがない');
  for (const c of ITEMS.craftRarities) {
    check(rarityIds.includes(c.rarity), `data/items.js craftRarities: レア度 '${c.rarity}' がない`);
    check(c.weight > 0, `data/items.js craftRarities: '${c.rarity}' の weight は 0 より大きくする`);
  }
  const usedRecipes = new Set();
  for (const [id, sm] of Object.entries(ITEMS.smiths)) {
    for (const [slot, r] of sm.gear) {
      check(ITEMS.slots[slot] && rarityIds.includes(r), `data/items.js smiths.${id}: 部位 '${slot}' かレア度 '${r}' がない`);
      check(ITEMS.smithRarities.includes(r), `data/items.js smiths.${id}: レア度 '${r}' は smithRarities にない (鍛冶屋で売れるのは ${ITEMS.smithRarities.join(' / ')})`);
    }
    for (const rid of sm.recipes || []) {
      check(ITEMS.recipes[rid], `data/items.js smiths.${id}: 作り方 '${rid}' が recipes にない`);
      usedRecipes.add(rid);
    }
  }
  for (const [id, r] of Object.entries(ITEMS.recipes)) {
    const w = `data/items.js recipes.${id}`;
    check(r.name, `${w}: name がない`);
    check(ITEMS.slots[r.slot], `${w}: 部位 '${r.slot}' がない`);
    check(typeOk(r.slot, r.type, false), `${w}: 種類 '${r.type}' が部位 '${r.slot}' の types にない (種類のない部位には書かない)`);
    check(Number.isInteger(r.level) && r.level >= 1, `${w}: level は 1 以上の整数にする`);
    check(Number.isFinite(r.gold) && r.gold >= 0, `${w}: gold は 0 以上にする`);
    const mats = Object.entries(r.materials || {});
    check(mats.length > 0, `${w}: materials がない`);
    for (const [m, n] of mats) {
      check(ITEMS.materials[m], `${w}: 素材 '${m}' が materials にない`);
      check(Number.isInteger(n) && n >= 1, `${w}: 素材 '${m}' の数は 1 以上の整数にする`);
    }
    check(usedRecipes.has(id), `${w}: どの鍛冶屋の recipes にもない (作れない)`);
    const K = ITEMS.slots[r.slot] && gearKindOf(r.slot, r.type);
    for (const [b, v] of Object.entries(r.bonus || {})) {
      check(STATS[b] && K && !kindStatKeys(K).includes(b), `${w}: bonus の '${b}' が data/stats.js にないか、種類の基本性能・fixed と重なっている`);
      check(Array.isArray(v) && v.length === 2 && v.every(Number.isFinite), `${w}: bonus の '${b}' は [Lv1 の値, 1 レベルごとの増加] にする`);
    }
  }
  for (const [id, c] of Object.entries(ITEMS.consumables)) check(rarityIds.includes(c.rarity), `data/items.js consumables.${id}: レア度 '${c.rarity}' がない`);
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
    // 目標 (goal) は種類 (src/quests.js の QUEST_GOALS) があり、その種類の check で中身 (敵・素材・NPC・数) を調べる
    const kind = q.goal && QUEST_GOALS[q.goal.kind];
    check(kind, `data/quests.js '${q.id}': 目標の種類 goal.kind '${q.goal && q.goal.kind}' が QUEST_GOALS (src/quests.js) にない`);
    for (const msg of (kind ? kind.check(q.goal) : [])) check(false, `data/quests.js '${q.id}': ${msg}`);
    check(npcIds.includes(q.giver), `data/quests.js '${q.id}': NPC '${q.giver}' が world.js にない`);
    check(!q.requires || questIds.includes(q.requires), `data/quests.js '${q.id}': requires '${q.requires}' のクエストがない`);
    check(!q.requires || !(questById(q.requires) || {}).repeatable, `data/quests.js '${q.id}': requires '${q.requires}' はくり返しのクエストなので使えない`);
    const it = q.reward.item;
    check(!it || (ITEMS.slots[it.slot] && rarityIds.includes(it.rarity)), `data/quests.js '${q.id}': 報酬の装備の部位かレア度がない`);
    check(!it || typeOk(it.slot, it.type, true), `data/quests.js '${q.id}': 報酬の装備の種類 '${it && it.type}' が部位の types にない`);
    for (const c of q.reward.consumables || []) {
      check(ITEMS.consumables[c.id], `data/quests.js '${q.id}': 報酬の道具 '${c.id}' が data/items.js の consumables にない`);
      check(Number.isInteger(c.count) && c.count >= 1, `data/quests.js '${q.id}': 報酬の道具 '${c.id}' の count は 1 以上の整数にする`);
    }
  }

  // 画面に出す文章 (data/text.js): どの文も文字列で、{ } は {名前} の形だけ (使っているキーと値の名前は、引くとき txt が調べる)
  const walkText = (o, path) => {
    for (const [k, v] of Object.entries(o)) {
      const key = path ? `${path}.${k}` : k;
      if (v && typeof v === 'object') { walkText(v, key); continue; }
      check(typeof v === 'string', `data/text.js '${key}': 文は文字列にする`);
      if (typeof v === 'string') check(!/[{}]/.test(v.replace(/\{\w+\}/g, '')), `data/text.js '${key}': { } は {名前} の形で書く`);
    }
  };
  walkText(TEXT, '');

  for (let n = SAVE_OLDEST; n < SAVE_VERSION; n++) {
    check(typeof SAVE_MIGRATIONS[n] === 'function', `src/save.js: セーブの形 v${n} → v${n + 1} の直し方 (SAVE_MIGRATIONS[${n}]) がない`);
  }

  for (const e of errors) console.error('[データの確認]', e);
  return errors;
}
