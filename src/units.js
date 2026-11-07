// =====================================================================
//  主人公と敵の生成、マスの上の位置、成長 (経験値・レベル・復活)
// =====================================================================
'use strict';

// 回復薬の数 { 回復薬のキー: 数 }
function startPotions() {
  const n = {};
  for (const id in IT.potions) n[id] = IT.potions[id].start;
  return n;
}

function createPlayer() {
  const d = PLAYER;
  const skillCd = {};
  for (const s of SKILLS) skillCd[s.key] = 0;
  const equip = {};
  for (const slot in IT.slots) {
    const e = d.startEquip[slot];
    equip[slot] = e ? makeItem(slot, e.level, e.rarity) : null;
  }
  return {
    isPlayer: true, faction: 'player', name: d.name, tx: 0, ty: 0, x: 0, y: 0, r: d.radius, color: d.color,
    stats: null, base: growthBase(1), hp: d.stats.maxHp, mp: d.stats.maxMp, facing: -Math.PI / 2, level: 1, exp: 0, lastHurt: -99,
    gold: EC.startGold, potions: startPotions(), home: WORLD.respawnZone, inventory: [], materials: {}, quests: {},
    equip, next: 0, travel: null,
    skillCd, hitFlash: 0, dead: false,
  };
}

function createEnemy(type, tx, ty, camp, slot) {
  const d = ENEMIES[type];
  const g = camp.level - 1, EL = P.enemyLevel;
  const st = { ...d.stats };
  st.maxHp = Math.round(st.maxHp * (1 + EL.hpGrowth * g));
  st.atk = st.atk * (1 + EL.atkGrowth * g);
  st.def = st.def + EL.defGrowth * g;
  st.int = st.int * (1 + EL.intGrowth * g);
  st.mdef = st.mdef + EL.mdefGrowth * g;
  st.speed = st.speed + EL.speedGrowth * g;
  const e = {
    type, def: d, faction: 'enemy', name: d.name, isBoss: !!d.isBoss, tx, ty, x: 0, y: 0, r: d.radius, color: d.color,
    level: camp.level, exp: Math.round(d.exp * (1 + EL.expGrowth * g)), camp, slot, home: { tx, ty },
    state: 'idle', stats: st, hp: st.maxHp, facing: rand(0, TAU),
    cd: d.attacks.map(() => randInt(...AI.firstAttackDelay)), charging: null,
    invuln: false, hitFlash: 0, dead: false, returnT: 0,
  };
  // 湧いてすぐ動き出さないように、次の行動は 0〜1 回分あと
  e.next = game.time + actionCost(e) * Math.random();
  return e;
}

// ----- マスの上の位置 -----
// x, y は描く位置 (px)。マスを移ると、描く位置が少し遅れて追いつく (src/main.js の updateFx)
function placeUnit(u, tx, ty) {
  u.tx = tx; u.ty = ty;
  u.x = center(tx); u.y = center(ty);
}
function moveUnitTo(u, tx, ty) {
  if (tx !== u.tx || ty !== u.ty) u.facing = Math.atan2(ty - u.ty, tx - u.tx);
  u.tx = tx; u.ty = ty;
}
// そのマスにいるキャラ (主人公か敵)。いなければ null
function unitAt(tx, ty) {
  if (player && !player.dead && player.tx === tx && player.ty === ty) return player;
  for (const e of enemies) if (!e.dead && e.tx === tx && e.ty === ty) return e;
  return null;
}
// そのマスに入れるか (地形・NPC・ほかのキャラ)
const isFree = (tx, ty) => !isBlocked(tx, ty) && !unitAt(tx, ty);

// 行動 1 回にかかる時間 (ターン)
const actionCost = (u) => TN.baseSpeed / Math.max(TN.minSpeed, u.stats.speed);

const opponents = (faction) => (faction === 'player' ? enemies : (player && !player.dead ? [player] : []));
const skillCooldown = (sk) => sk.cooldown * 100 / (100 + player.stats.skillHaste);
const skillMp = (sk) => sk.mp || 0;

// ----- 成長 -----
const DS = P.derivedStats;

// 成長曲線の目安: Lv1 の値 + gain を直線でつないだ増加量
function growthTarget(k, lv) {
  let prev = [1, 0];
  for (const pt of PG.growth[k].gain) {
    if (lv <= pt[0]) return PLAYER.stats[k] + prev[1] + (pt[1] - prev[1]) * (lv - prev[0]) / (pt[0] - prev[0]);
    prev = pt;
  }
  return PLAYER.stats[k] + prev[1];
}
// そのレベルの目安どおりの成長した値 (はじめから・前のセーブで使う)
function growthBase(lv) {
  const base = {};
  for (const k in PG.growth) base[k] = Math.round(growthTarget(k, lv));
  return base;
}

// ステータス = Lv1 の値 (成長するものは p.base) + 装備 → 計算で決まるものを計算
function computeStats(p) {
  const st = { ...PLAYER.stats, ...p.base };
  for (const k in DS) st[k] = 0;
  for (const slot in p.equip) {
    const it = p.equip[slot];
    if (it) for (const k in it.stats) st[k] = (st[k] || 0) + it.stats[k];
  }
  for (const k in DS) {
    const d = DS[k];
    st[k] += d.start + (st[d.from] - d.base) * d.per;
  }
  for (const k in DS) if (DS[k].max !== undefined) st[k] = Math.min(DS[k].max, st[k]);
  return st;
}

function gainExp(n, x, y) {
  const p = player;
  if (p.level >= PG.maxLevel) return;
  p.exp += n;
  floatText(x, y - 24, `+${n} EXP`, '#b39ddb', 14);
  let up = false;
  while (p.level < PG.maxLevel && p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    levelUp();
    up = true;
  }
  if (p.level >= PG.maxLevel) p.exp = 0;
  if (up) saveGame();
}

function levelUp() {
  const p = player;
  p.level++;
  // 成長曲線の目安に近づくように、ばらつきながら上がる
  const gains = [];
  for (const k in PG.growth) {
    const n = Math.max(0, Math.round(growthTarget(k, p.level) - p.base[k] + rand(-1, 1) * PG.growth[k].spread));
    p.base[k] += n;
    if (n > 0) gains.push(`${STATS[k].label} +${n}`);
  }
  p.stats = computeStats(p);
  p.hp = p.stats.maxHp;
  p.mp = p.stats.maxMp;
  const learned = SKILLS.filter((s) => s.unlockLevel === p.level).map((s) => `${s.name}（${s.label}）`);
  showMsg(`LEVEL UP!  Lv ${p.level}`, [gains.join('　'), learned.length ? `新しいスキル: ${learned.join('、')}` : ''].filter(Boolean).join('\n'));
  log(`レベルが ${p.level} に上がった！`, '#ffd54f');
  effects.push({ type: 'ring', x: p.x, y: p.y, r0: p.r, r1: p.r * 5, t: 0, life: 0.6, color: '255,213,79' });
  burst(p.x, p.y, '#ffd54f', 30, 260);
}

// 倒れたら最後に立ち寄った町 (player.home) のかがり火に戻る (失うものは倒れたときに減らしている)
const homeZone = () => (WORLD.zones[player.home] && WORLD.zones[player.home].respawn ? player.home : WORLD.respawnZone);
function respawnPlayer() {
  const p = player, home = homeZone();
  const r = WORLD.zones[home].respawn;
  Object.assign(p, { hp: p.stats.maxHp, mp: p.stats.maxMp, dead: false, facing: -Math.PI / 2 });
  enterZone(home, tileOf(r.x), tileOf(r.y));
  game.state = 'play';
  const lost = [game.deathLoss.exp > 0 ? `EXP -${game.deathLoss.exp}` : '', game.deathLoss.gold > 0 ? `-${game.deathLoss.gold} G` : ''].filter(Boolean);
  showMsg(['力尽きた…', ...lost].join('  '), zone.name);
  saveGame();
}
