// =====================================================================
//  主人公と敵の生成、マスの上の位置、成長 (経験値・レベル・復活)
// =====================================================================
'use strict';

// 道具の数 { 道具のキー: 数 } (data/items.js の consumables の start)
function startConsumables() {
  const n = {};
  for (const id in ITEMS.consumables) n[id] = ITEMS.consumables[id].start;
  return n;
}

function createPlayer() {
  const d = PLAYER;
  const skillCd = {};
  for (const s of SKILLS) skillCd[s.id] = 0;
  const equip = {};
  for (const slot in ITEMS.slots) {
    const e = d.startEquip[slot];
    equip[slot] = e ? makeItem(slot, e.level, e.rarity) : null;
  }
  const p = {
    isPlayer: true, faction: 'player', name: d.name, tx: 0, ty: 0, x: 0, y: 0, r: d.radius, color: d.color,
    stats: null, base: startBase(), potential: startPotential(), hp: 0, mp: 0, facing: -Math.PI / 2, level: 1, exp: 0, lastHurt: -99,
    gold: ECON.startGold, consumables: startConsumables(), home: WORLD.respawnZone, inventory: [], materials: {}, quests: {},
    equip, next: 0, travel: null, control: 'input',
    // 覚えられる技 (data/skills.js 全部)・覚えている技の id (はじめは下の learnSkillsByLevel で Lv1 のもの)・スキル欄 (キー → スキルの id)
    skills: SKILLS, knownSkills: [], skillSlots: d.skillSlots.map((b) => ({ ...b })), skillRule: 'hero', skillCd, buffs: [], hitFlash: 0, dead: false,
  };
  learnSkillsByLevel(p);
  return p;
}

function createEnemy(type, tx, ty, camp, slot) {
  const d = ENEMIES[type];
  const g = camp.level - 1, EL = PARAMS.enemyLevel;
  // 主人公と同じステータスをレベルで補正し、主人公と同じ式で計算する (gear は装備のかわり)
  const b = { ...d.stats };
  for (const k of ['con', 'will']) b[k] *= 1 + EL.hpGrowth * g;  // さいだいHP のもと (さいだいHP は計算で四捨五入)
  b.spi *= 1 + EL.mpGrowth * g;                                   // さいだいMP のもと (もう 1 つの 知力 は下で伸ばす)
  b.str *= 1 + EL.strGrowth * g;
  b.int *= 1 + EL.intGrowth * g;
  b.vit += EL.vitGrowth * g;
  b.agi += EL.agiGrowth * g;
  const gear = { ...d.gear, mdef: ((d.gear && d.gear.mdef) || 0) + EL.mdefGrowth * g };
  // baseStats / gear を持っておき、強化・弱体がかかるたびに主人公と同じ順番で計算し直す (computeStats)
  const e = {
    type, def: d, faction: 'enemy', name: d.name, isBoss: !!d.isBoss, tx, ty, x: 0, y: 0, r: d.radius, color: d.color,
    level: camp.level, exp: Math.round(d.exp * (1 + EL.expGrowth * g)), camp, slot, home: { tx, ty },
    state: 'idle', baseStats: b, gear, buffs: [], stats: null, hp: 0, mp: 0, facing: rand(0, TAU),
    // 技の並び・再使用待ちの決まり・再使用待ち (名札 = 技の並びでの位置。湧いてすぐは 0〜2 回待つ)
    skills: d.attacks, skillRule: 'enemy', skillCd: Object.fromEntries(d.attacks.map((a, i) => [i, randInt(...FIELD_AI.firstAttackDelay)])), charging: null,
    // 基本の技 (MP を使わない技のうち下のもの。なければ -1) と、次に狙う技 (src/ai.js の chooseIntent)
    basic: d.attacks.map((a) => !skillMp(a)).lastIndexOf(true), intent: null, intentT: 0,
    invuln: false, hitFlash: 0, dead: false, returnT: 0, control: 'ai', target: null,
  };
  refreshStats(e, 'full');
  // 湧いてすぐ動き出さないように、次の行動は 0〜1 回分あと
  e.next = game.time + actionCost(e) * Math.random();
  return e;
}

// 主人公の陣営のキャラ (仲間) を作る。今のゲームにはまだ出てこない (テストで使う)。置くのは addUnit
//   d: 種類 { name, stats (もとのステータス), gear (固定値。省略可), color, radius, glyph (描くときの字), level (省略時 1),
//            skills (使える技の並び。省略時なし。id のある技は覚えていることにする), skillRule (再使用待ちと MP の決まり SKILL_RULES のキー。省略時 'hero') }
//   control: 行動の決め方 (src/turn.js の CONTROLLERS。省略時 'wait')
function createAlly(d, control) {
  const a = {
    def: d, faction: 'player', name: d.name, tx: 0, ty: 0, x: 0, y: 0, r: d.radius, color: d.color,
    level: d.level || 1, baseStats: { ...d.stats }, gear: d.gear, buffs: [], stats: null, hp: 0, mp: 0, facing: -Math.PI / 2, lastHurt: -99,
    next: game.time, control: control || 'wait', charging: null, hitFlash: 0, dead: false,
    skills: d.skills || [], knownSkills: [], skillRule: d.skillRule || 'hero', skillCd: {},
  };
  for (const s of a.skills) a.skillCd[skillKey(a, s)] = 0;
  for (const s of a.skills) teachSkill(a, s.id);
  refreshStats(a, 'full');
  return a;
}
// キャラを (tx, ty) に置いて、戦うキャラ (units) に入れる
function addUnit(u, tx, ty) {
  placeUnit(u, tx, ty);
  units.push(u);
  return u;
}

// NPC: world.js の配置 + data/npcs.js の種類のステータス (主人公・敵と同じ式で計算する)
// NPC はどの陣営にも入っていないので、攻撃は当たらない (opponents に出てこない)
function createNpc(n) {
  // kind がない・まちがっているときは主人公の Lv1 の値で作る (データの確認で [データの確認] に出る)
  const k = NPC_KINDS[n.kind] || { label: '?', stats: PLAYER.stats };
  const st = deriveStats({ ...k.stats }, [k.gear]);
  return { ...n, faction: 'npc', kindLabel: k.label, tx: tileOf(n.x), ty: tileOf(n.y), stats: st, hp: st.maxHp, mp: st.maxMp };
}

// ----- マスの上の位置 -----
// x, y は描く位置 (px)。マスを移ると、描く位置が少し遅れて追いつく (src/main.js の updateFx)
function placeUnit(u, tx, ty) {
  u.tx = tx; u.ty = ty;
  u.x = tileCenter(tx); u.y = tileCenter(ty);
}
function moveUnitTo(u, tx, ty) {
  if (tx !== u.tx || ty !== u.ty) u.facing = Math.atan2(ty - u.ty, tx - u.tx);
  u.tx = tx; u.ty = ty;
}
// そのマスにいるキャラ (倒れていない units)。いなければ null
function unitAt(tx, ty) {
  for (const u of units) if (!u.dead && u.tx === tx && u.ty === ty) return u;
  return null;
}
// そのマスに入れるか (地形・NPC・ほかのキャラ)
const isFree = (tx, ty) => !isBlocked(tx, ty) && !unitAt(tx, ty);

// 行動 1 回にかかる時間 (ターン)
const actionCost = (u) => TURN.baseSpeed / Math.max(TURN.minSpeed, u.stats.speed);

// 陣営 faction から見た敵 (倒れていない units。units の順)
const opponents = (faction) => units.filter((u) => !u.dead && hostileTo(faction, u.faction));
const skillMp = (sk) => sk.mp || 0;

// ----- 技の再使用待ちと MP (どのキャラも同じ形。決まりだけキャラごとに名前を付けて持つ) -----
// 戦うキャラはみな u.skills (使える技の並び)、u.skillCd = { 技の名札: 再使用までの残りの行動回数 }、u.skillRule (下のどれか) を持つ
// 技の名札 (skillKey): 技に id があればそれ (data/skills.js のスキル)、なければ u.skills の中の位置 (敵の技)
// 主人公と敵で違う決まりは、遊び方を変えないためにそのまま残している (1 つにそろえない)
const SKILL_RULES = {
  // 主人公 (と仲間の省略時): 再使用待ちは小数のまま。使った行動も含めて、自分の行動の後始末 (endTurn) ごとに 1 減る
  //   MP は表示と同じく切り捨てで比べる (MP は小数で回復していくため)。払ったあとは 0 より下げない
  hero: { cooldown: (u, sk) => sk.cooldown * 100 / (100 + u.stats.skillHaste), tick: 'afterAction', mpFloor: true, mpClamp: true },
  // 敵: 再使用待ちは四捨五入して最低 1。自分の行動の初め (control を呼ぶ前) に 1 減り、予告していた技を出す行動では減らない
  //   MP は小数のまま比べ、払ったあとも 0 で止めない
  enemy: { cooldown: (u, sk) => Math.max(1, Math.round(sk.cooldown * 100 / (100 + u.stats.skillHaste))), tick: 'beforeAction', mpFloor: false, mpClamp: false },
};
const skillRule = (u) => SKILL_RULES[u.skillRule];
const skillKey = (u, sk) => (sk.id !== undefined ? sk.id : u.skills.indexOf(sk));
// 技 sk を使ったときの再使用待ち (u の行動回数。スキル加速で短くなる)
const skillCooldown = (u, sk) => skillRule(u).cooldown(u, sk);
// 再使用までの残り (0 なら使える)
const cooldownLeft = (u, sk) => u.skillCd[skillKey(u, sk)] || 0;
// MP が足りるか
const enoughMp = (u, sk) => (skillRule(u).mpFloor ? Math.floor(u.mp + 1e-9) : u.mp + 1e-9) >= skillMp(sk);
// 使えるか (再使用待ちでなく MP が足りる)。覚えているか (knowsSkill) は呼ぶ側が確かめる
const canUseSkill = (u, sk) => cooldownLeft(u, sk) <= 0 && enoughMp(u, sk);
// 再使用待ちを始める・MP を払う (useSkill)
function payForSkill(u, sk) {
  u.skillCd[skillKey(u, sk)] = skillCooldown(u, sk);
  growthEvent(u, 'spendMp', skillMp(sk));
  u.mp = skillRule(u).mpClamp ? Math.max(0, u.mp - skillMp(sk)) : u.mp - skillMp(sk);
}
// ----- 覚えているスキルとスキル欄 (主人公と、data/skills.js の技を持つ仲間) -----
// u.skills: 覚えられる技 (主人公は SKILLS 全部)。u.knownSkills: 覚えているスキルの id の並び (主人公はセーブに残す)
// u.skillSlots: スキル欄 [{ key, skill: スキルの id }] (主人公だけ。はじめは data/player.js の skillSlots。セーブには残さない)
const unitSkill = (u, id) => (typeof id === 'string' ? u.skills.find((s) => s.id === id) : undefined);
// u がスキル sk を覚えているか (どうやって覚えたかは問わない)
const knowsSkill = (u, sk) => !!u.knownSkills && u.knownSkills.includes(sk.id);
// u にスキル id を覚えさせる。スキルを覚えるのはいつもここを通る。u.skills にない id・もう覚えているものは何もしない
// 新しく覚えたら true
function teachSkill(u, id) {
  if (!u.knownSkills || !unitSkill(u, id) || u.knownSkills.includes(id)) return false;
  u.knownSkills.push(id);
  return true;
}
// スキル欄の並び [{ key, sk }] (u.skills にない id は飛ばす)。覚えていないスキルも入る (画面では暗く出す)
const skillSlotsOf = (u) => (u.skillSlots || []).map((b) => ({ key: b.key, sk: unitSkill(u, b.skill) })).filter((b) => b.sk);
// スキル sk を置いたキー (置いていなければ undefined)
const slotKeyOf = (u, sk) => (skillSlotsOf(u).find((b) => b.sk === sk) || {}).key;

// 再使用待ちを 1 行動ぶん進める (いつ呼ぶかは決まりの tick。src/turn.js)
function tickCooldowns(u) {
  for (const k in u.skillCd) u.skillCd[k] = Math.max(0, u.skillCd[k] - 1);
}

// ----- 成長 -----
const DERIVED_STATS = PARAMS.derivedStats;

// ----- スキルの覚え方 (はじめの決まり): data/player.js の learnAtLevel のレベルになったら自動で覚える -----
// はじめから遊ぶとき (createPlayer)・レベルアップ (levelUp)・セーブを読んだとき (applySave) に呼ぶ。新しく覚えたスキルの並びを返す
// ほかの覚え方 (師匠・道具・スキルポイントなど) を足すときは、これと並べて teachSkill を呼ぶ道を作る (この決まりをやめるなら、これを呼ぶ所を置き換える)
const learnLevelOf = (sk) => PLAYER.learnAtLevel[sk.id];
function learnSkillsByLevel(u) {
  const learned = [];
  for (const [id, lv] of Object.entries(PLAYER.learnAtLevel)) if (u.level >= lv && teachSkill(u, id)) learned.push(unitSkill(u, id));
  return learned;
}

// ----- ステータスの伸び (行動で能力値が小数点以下まで伸びる。伸びやすさは潜在。params.js の progression.growth) -----
// はじめの成長する値 (Lv1 の値) と潜在
function startBase() {
  const base = {};
  for (const k in GROWTH.stats) base[k] = PLAYER.stats[k];
  return base;
}
function startPotential() {
  const pot = {};
  for (const k in GROWTH.stats) pot[k] = (PLAYER.potential && PLAYER.potential[k]) || GROWTH.potential.base;
  return pot;
}
const clampPotential = (v) => clamp(v, GROWTH.potential.min, GROWTH.potential.max);
// 能力値 k を、潜在 100 のときの量 pts だけ伸ばす (実際は × 潜在 / 100)。u.base[k] は小数で持ち、戦いで使うのは一の位まで
//   一の位が 1 上がるたびに潜在が × (1 − drop) に下がり、残りはその下がった潜在で伸びる。一の位が上がった数を返す
//   潜在 (u.potential) を持つキャラだけ育つ (今は主人公だけ)
function trainStat(u, k, pts) {
  const S = GROWTH.stats[k], P = GROWTH.potential;
  if (!u.potential || !S || !(pts > 0) || u.base[k] >= S.max) return 0;
  let rest = pts, up = 0;
  while (rest > 0 && u.base[k] < S.max) {
    const next = Math.min(S.max, Math.floor(u.base[k]) + 1);
    const need = (next - u.base[k]) * P.base / u.potential[k]; // 次の一の位まで伸ばすのに要る pts
    if (rest < need) { u.base[k] += rest * u.potential[k] / P.base; break; }
    rest -= need;
    u.base[k] = next;
    up++;
    u.potential[k] = clampPotential(u.potential[k] * (1 - S.drop));
  }
  if (up) {
    refreshStats(u, 'shift');
    floatText(u.x, u.y - u.r - 18, txt('units.statUp', { stat: STATS[k].label, n: up }), THEME.float.statUp.color, THEME.float.statUp.size);
    logMsg(txt('units.statUpLog', { stat: STATS[k].label, n: up }), THEME.msg.statUp);
  }
  return up;
}
// 行動の出来事 type (params.js の growth.events) を伝える。amount: その出来事の量 (ダメージの割合・使った MP・回数)
function growthEvent(u, type, amount = 1) {
  const ev = GROWTH.events[type];
  if (!u || !u.potential || !ev || !(amount > 0)) return;
  for (const k in ev) trainStat(u, k, amount * ev[k]);
}
// 時間で潜在が下がる: decayFloor を超えている分が 1 ターンごとに decayRate の割合で減る
function decayPotential(u, dt) {
  if (!u.potential) return;
  const P = GROWTH.potential, keep = Math.pow(1 - P.decayRate, dt);
  for (const k in u.potential) if (u.potential[k] > P.decayFloor) u.potential[k] = P.decayFloor + (u.potential[k] - P.decayFloor) * keep;
}

// ステータスを計算する (主人公も敵も同じ): もとのステータス + 装備 (gears の各 stats) → 計算で決まるものを計算
function deriveStats(base, gears) {
  const st = { ...base };
  for (const k in DERIVED_STATS) st[k] = 0;
  for (const gs of gears) if (gs) for (const k in gs) st[k] = (st[k] || 0) + gs[k];
  for (const k in DERIVED_STATS) {
    const d = DERIVED_STATS[k];
    if (typeof d.from === 'string') { st[k] += d.start + (st[d.from] - d.base) * d.per; continue; }
    // from が表 { ステータス: 倍率 } (さいだいHP = 体力 + 意思 など)。持っていないステータスは 0
    let v = 0;
    for (const s in d.from) v += (st[s] || 0) * d.from[s];
    st[k] += d.start + (d.round ? Math.round(v + 1e-9) : d.floor ? Math.floor(v + 1e-9) : v);
  }
  for (const k in DERIVED_STATS) if (DERIVED_STATS[k].max !== undefined) st[k] = Math.min(DERIVED_STATS[k].max, st[k]);
  return st;
}
// ステータスのもと (どのキャラも同じ形): 強化・装備なしのもとのステータス base と、装備の並び gears (各 stats)
//   主人公: 行動で伸びた値 (u.base。小数なので一の位まで) / 装備 (u.equip)。敵・仲間: 作ったときの u.baseStats (敵はレベルの補正つき) / u.gear
function statSource(u) {
  const base = u.isPlayer ? { ...PLAYER.stats } : { ...u.baseStats };
  if (u.isPlayer) for (const k in u.base) base[k] = Math.floor(u.base[k]);
  const gears = u.equip ? Object.values(u.equip).map((it) => it && it.stats) : [u.gear];
  return { base, gears };
}
// キャラのステータス (主人公・敵・仲間で同じ): もとのステータスから計算 → 強化・弱体 (u.buffs) の倍率を掛ける → 装備の固定値を足す
// 装備は強化・弱体の倍率を受けない。上限 (derivedStats の max) は最後にかける
function computeStats(u) {
  const { bare, equip } = statParts(u);
  const st = applyBuffs({ ...bare }, u.buffs);
  for (const k in equip) st[k] = (st[k] || 0) + equip[k];
  for (const k in DERIVED_STATS) if (DERIVED_STATS[k].max !== undefined) st[k] = Math.min(DERIVED_STATS[k].max, st[k]);
  return st;
}
// 装備なしのステータス (bare) と、装備で上がる分 (equip = 装備ありで計算した値 − bare)。
// equip には、ちから +3 の装備ならこうげき力 +3 のように、計算で決まるステータスへの効き目も入る
function statParts(u) {
  const { base, gears } = statSource(u);
  const bare = deriveStats(base, []);
  const geared = deriveStats(base, gears);
  const equip = {};
  for (const k in geared) {
    const d = geared[k] - (bare[k] || 0);
    if (Math.abs(d) > 1e-9) equip[k] = d;
  }
  return { bare, equip };
}

// ----- 強化・弱体 (コードでは buff。data/buffs.js。mult が 1 より小さいものが弱体) -----
// 戦うキャラ (主人公・敵・仲間) はみな u.buffs = [{ id, left, fresh }] を持つ。left: 残りの行動回数 (かかったキャラ自身の行動で数える)
//   fresh: 今の行動の終わりには減らさない (自分にかけたとき、かけた行動のぶんを数えないため)
// 毒・スタンのような別の種類の効果を足すときは、行動ごとの効き目を tickBuffs (endTurn から呼ばれる) に、
// 「行動できない」の判定を src/turn.js の runUntilInput (control を呼ぶ前) と主人公の入力に足す
function applyBuffs(st, buffs) {
  for (const b of buffs || []) { const d = BUFFS[b.id]; if (d) st[d.stat] *= d.mult; }
  return st;
}
// 強化・弱体をかけたときに頭の上に浮かぶ文字 (「こうげき力↑」。弱体は ↓)
const buffFloatText = (b) => txt(b.mult < 1 ? 'combat.statDown' : 'combat.statUp', { stat: STATS[b.stat].label });
// u に強化・弱体をかける (n 行動続く)。同じものなら残りの長いほうにする (重ねがけしない)
//   src: かけた者 (省略時は u 自身)。自分にかけたときは、かけた行動の終わりでは減らさない。ほかの者がかけたときは u の次の行動から数える
function addBuff(u, id, n, src = u) {
  const self = src === u;
  const b = u.buffs.find((x) => x.id === id);
  if (b) { b.left = Math.max(b.left, n); b.fresh = b.fresh || self; } else u.buffs.push({ id, left: n, fresh: self });
  refreshStats(u);
}
// 行動 1 回ぶん強化・弱体を進め、切れたものを外す (src/turn.js の endTurn。どのキャラも)
function tickBuffs(u) {
  let changed = false;
  u.buffs = u.buffs.filter((b) => {
    if (b.fresh) { b.fresh = false; return true; }
    if (--b.left > 0) return true;
    logMsg(u === player ? txt('units.buffEndSelf', { buff: BUFFS[b.id].name }) : txt('units.buffEndOther', { who: u.name, buff: BUFFS[b.id].name }), THEME.msg.refuse);
    changed = true;
    return false;
  });
  if (changed) refreshStats(u);
}
// 強化・弱体を全部外す (主人公の復活、敵が帰り着いたとき、主人公以外が倒れたとき)
function clearBuffs(u) {
  u.buffs = [];
  refreshStats(u);
}
// ステータスを計算し直し (computeStats)、今の HP・MP を新しい最大に合わせる。どのキャラも
//   keep: 'clamp' (省略時。最大を超えた分だけ切る。強化・弱体のかけ外し。切れても減った HP は戻らない)
//         'shift' (最大の増減ぶん今の値もずらす。HP は 1 以上、MP は 0 以上。装備の付け替え)
//         'full'  (全回復。レベルアップ・作ったとき)
function refreshStats(u, keep = 'clamp') {
  const old = u.stats;
  const st = u.stats = computeStats(u);
  if (keep === 'full') {
    u.hp = st.maxHp;
    u.mp = st.maxMp;
  } else if (keep === 'shift') {
    u.hp = clamp(u.hp + st.maxHp - old.maxHp, 1, st.maxHp);
    u.mp = clamp(u.mp + st.maxMp - old.maxMp, 0, st.maxMp);
  } else {
    u.hp = Math.min(u.hp, st.maxHp);
    u.mp = Math.min(u.mp, st.maxMp);
  }
}

function gainExp(n, x, y) {
  const p = player;
  if (p.level >= PROGRESSION.maxLevel) return;
  p.exp += n;
  floatText(x, y - 24, txt('units.expFloat', { n }), THEME.float.exp.color, THEME.float.exp.size);
  let up = false;
  while (p.level < PROGRESSION.maxLevel && p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    levelUp();
    up = true;
  }
  if (p.level >= PROGRESSION.maxLevel) p.exp = 0;
  if (up) saveGame();
}

function levelUp() {
  const p = player;
  p.level++;
  // ステータスは上がらず、全部の潜在が上がる (ステータスは行動で伸びる)
  for (const k in p.potential) p.potential[k] = clampPotential(p.potential[k] + GROWTH.potential.levelUp);
  refreshStats(p, 'full');
  // 新しく覚えたスキル (はじめの覚え方)。スキル欄に置いてあればキーも出す
  const learned = learnSkillsByLevel(p).map((s) => (slotKeyOf(p, s) ? txt('units.learnedKey', { skill: s.name, key: slotKeyOf(p, s).toUpperCase() }) : s.name));
  showMsg(txt('units.levelUp', { level: p.level }), [txt('units.potentialUp', { n: GROWTH.potential.levelUp }),
    learned.length ? txt('units.learned', { skills: learned.join(txt('units.learnedSep')) }) : ''].filter(Boolean).join('\n'));
  logMsg(txt('units.levelUpLog', { level: p.level }), THEME.msg.levelUp);
  fxLevelUp(p);
}

// 倒れたら最後に立ち寄った町 (player.home) のかがり火に戻る (失うものは倒れたときに減らしている)
const homeZone = () => (WORLD.zones[player.home] && WORLD.zones[player.home].respawn ? player.home : WORLD.respawnZone);
function respawnPlayer() {
  const p = player, home = homeZone();
  const r = WORLD.zones[home].respawn;
  clearBuffs(p);
  Object.assign(p, { hp: p.stats.maxHp, mp: p.stats.maxMp, dead: false, facing: -Math.PI / 2 });
  enterZone(home, tileOf(r.x), tileOf(r.y));
  game.state = 'play';
  const lost = [game.deathLoss.exp > 0 ? txt('units.lostExp', { n: game.deathLoss.exp }) : '', game.deathLoss.gold > 0 ? txt('units.lostGold', { n: game.deathLoss.gold }) : ''].filter(Boolean);
  showMsg([txt('units.respawn'), ...lost].join(txt('units.lostSep')), zone.name);
  saveGame();
}
