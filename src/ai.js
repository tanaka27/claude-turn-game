// =====================================================================
//  敵の AI (自分の番に 1 回行動する) と湧き場所
// =====================================================================
'use strict';

// 技が届きそうか (おおまかな距離だけ見る。実際に当たるかは planAttack の範囲で確かめる)
function attackReach(a) {
  if (a.type === 'lob') return a.castRange + a.radius;
  if (a.type === 'projectile' || a.shape === 'line') return a.range * Math.SQRT2;
  return a.range;
}

// 追跡開始。同じ群れの近くにいる仲間も一緒に追ってくる
function aggro(e) {
  e.state = 'chase';
  for (const o of enemies) {
    if (o !== e && o.camp === e.camp && o.state === 'idle' && dist(o.tx, o.ty, e.tx, e.ty) <= AI.assistRange) o.state = 'chase';
  }
}

// 待機中: 湧いた位置のまわりをときどき 1 マスうろつく
function wander(e) {
  if (Math.random() >= AI.wanderChance) return;
  const opts = NB.filter(([dx, dy]) => canStep(e.tx, e.ty, dx, dy) && !unitAt(e.tx + dx, e.ty + dy) &&
    dist(e.tx + dx, e.ty + dy, e.home.tx, e.home.ty) <= AI.wanderRadius);
  if (!opts.length) return;
  const [dx, dy] = opts[Math.floor(Math.random() * opts.length)];
  moveUnitTo(e, e.tx + dx, e.ty + dy);
}

// score が一番大きくなるとなりのマスへ動く (今のマスより良くなるときだけ)。動いたら true
function stepBest(e, score) {
  let best = score(e.tx, e.ty), pick = null;
  for (const [dx, dy] of NB) {
    const nx = e.tx + dx, ny = e.ty + dy;
    if (!canStep(e.tx, e.ty, dx, dy) || unitAt(nx, ny)) continue;
    const v = score(nx, ny);
    if (v > best + 1e-6) { best = v; pick = [nx, ny]; }
  }
  if (pick) moveUnitTo(e, pick[0], pick[1]);
  return !!pick;
}

// プレイヤーへ近づく。道がふさがっていたら、少しでも近づけるマスへ
function approach(e) {
  const s = stepDownhill(e, flow);
  if (s) { moveUnitTo(e, e.tx + s[0], e.ty + s[1]); return; }
  stepBest(e, (x, y) => -dist(x, y, player.tx, player.ty));
}

function enemyAct(e) {
  // 予告していた技を出す
  if (e.charging) {
    const h = e.charging;
    cancelCharge(e);
    e.facing = h.dir;
    resolveAttack(h);
    return;
  }
  for (let i = 0; i < e.cd.length; i++) e.cd[i] = Math.max(0, e.cd[i] - 1);

  const alive = player && !player.dead;
  const d = alive ? dist(e.tx, e.ty, player.tx, player.ty) : Infinity;
  const canSee = alive && hasLOS(e.tx, e.ty, player.tx, player.ty);
  const fromHome = dist(e.tx, e.ty, e.home.tx, e.home.ty);
  if (e.state === 'idle') {
    if (alive && !inSafeZone() && d <= AI.aggroRange && canSee) aggro(e);
    else { wander(e); return; }
  }
  if (e.state === 'chase' && (!alive || inSafeZone() || fromHome > AI.leashRange)) {
    e.state = 'return';
    e.invuln = true;
    e.returnT = AI.returnTimeout; // 引っかかって戻れないときの保険
  }
  // 帰還中: 無敵のまま湧いた位置へ戻り、着いたら全回復
  // 戻る途中で（すぐまた諦めない所まで戻っていて）プレイヤーが近くに見えたら戦い直す
  if (e.state === 'return' && alive && !inSafeZone() && fromHome <= AI.leashRange * AI.reengageLeashRatio &&
    d <= AI.aggroRange && canSee) {
    e.invuln = false;
    aggro(e);
  }
  if (e.state === 'return') {
    e.returnT--;
    const home = e.home;
    if ((e.tx === home.tx && e.ty === home.ty) || (e.returnT <= 0 && isFree(home.tx, home.ty))) {
      if (e.tx !== home.tx || e.ty !== home.ty) placeUnit(e, home.tx, home.ty);
      Object.assign(e, { state: 'idle', invuln: false, hp: e.stats.maxHp, mp: e.stats.maxMp, intent: null });
      return;
    }
    const s = stepDownhill(e, e.camp.field);
    if (s) moveUnitTo(e, e.tx + s[0], e.ty + s[1]);
    return;
  }

  if (!e.intent || e.intentT <= 0) chooseIntent(e);
  e.intentT--;
  const a = e.def.attacks[e.intent.i];

  // 遠くから撃つつもりで近すぎるときは、まず下がる (下がれなければその場で撃つ)
  const kd = e.def.keepDistance;
  if (e.intent.far && canSee && d < kd * AI.retreatRatio &&
    stepBest(e, (x, y) => dist(x, y, player.tx, player.ty))) return;
  // 狙っている技が使えて、相手が範囲に入っていれば使う
  if (canSee && e.cd[e.intent.i] <= 0 && e.mp + 1e-9 >= skillMp(a) && d <= attackReach(a) + 0.01) {
    const h = planAttack(e, a, player.tx, player.ty);
    if (h.keys.has(tileKey(player.tx, player.ty))) {
      useEnemyAttack(e, e.intent.i, h);
      e.intent = null;
      return;
    }
  }
  // 技を待っている (近づく) 間でも、となりにいれば基本の技で攻撃する。遠くから撃つつもりのときは殴らない
  if (canSee && !e.intent.far && e.intent.i !== e.basic && e.basic >= 0 && e.cd[e.basic] <= 0) {
    const h = planAttack(e, e.def.attacks[e.basic], player.tx, player.ty);
    if (h.keys.has(tileKey(player.tx, player.ty))) { useEnemyAttack(e, e.basic, h); return; }
  }

  // 移動: 遠くから撃つつもりなら間合いを取り、そうでなければ近づく
  if (e.intent.far) {
    if (!canSee || d > kd * AI.approachRatio) approach(e);
  } else if (steps(e.tx, e.ty, player.tx, player.ty) > 1) {
    approach(e);
  }
  if (steps(e.tx, e.ty, player.tx, player.ty) <= 1) e.facing = Math.atan2(player.ty - e.ty, player.tx - e.tx);
}

// 次に狙う技を決める: 再使用待ちでなく MP が足りる技 (基本の技以外) から、skillChance の確率で 1 つをくじで選ぶ。
// 外れたら (選べる技がなければ) 基本の技 (MP を使わない技) で攻撃しに行く
// far: keepDistance を持つ敵が、となりより遠くまで届く技を狙うとき。間合いを取ったまま撃つ
function chooseIntent(e) {
  const atks = e.def.attacks;
  const opts = [];
  atks.forEach((a, i) => { if (i !== e.basic && e.cd[i] <= 0 && e.mp + 1e-9 >= skillMp(a)) opts.push(i); });
  const chance = e.def.skillChance ?? AI.skillChance;
  let i = e.basic;
  if (opts.length && (i < 0 || Math.random() < chance)) {
    const w = opts.map((k) => atks[k].weight ?? 1);
    let r = Math.random() * w.reduce((x, y) => x + y, 0);
    i = opts.find((k, n) => (r -= w[n]) < 0) ?? opts[opts.length - 1];
  }
  if (i < 0) i = 0; // 基本の技がなく、使える技もない: いちばん上の技を待つ
  e.intent = { i, far: !!e.def.keepDistance && attackReach(atks[i]) > AI.meleeReach };
  e.intentT = AI.intentTimeout;
}

// 技を出す (予告ありなら構える)。再使用待ちと MP を減らす
function useEnemyAttack(e, i, h) {
  const a = e.def.attacks[i];
  e.cd[i] = enemyCooldown(e, a);
  e.mp -= skillMp(a);
  e.facing = h.dir;
  if (a.charge) {
    startCharge(e, h);
    log(`${e.name}は${a.name}の構えをとった。`, '#ffab40');
  } else resolveAttack(h);
}

// ----- 湧き場所 -----
// 湧き場所の中心から spread 以内で、空いているマスを選ぶ。見つからなければ null
function pickCampTile(c) {
  for (let i = 0; i < 20; i++) {
    const a = rand(0, TAU), r = rand(0, c.spreadT);
    const x = Math.round(c.tx + Math.cos(a) * r), y = Math.round(c.ty + Math.sin(a) * r);
    if (isFree(x, y) && gateAt[idx(x, y)] < 0) return [x, y];
  }
  for (let r = 0; r <= 3; r++) for (const [dx, dy] of [[0, 0], ...NB]) {
    const x = c.tx + dx * r, y = c.ty + dy * r;
    if (isFree(x, y) && gateAt[idx(x, y)] < 0) return [x, y];
  }
  return null;
}

function placeEnemy(type, tx, ty, camp, slot) {
  const e = createEnemy(type, tx, ty, camp, slot);
  placeUnit(e, tx, ty);
  slot.enemy = e;
  enemies.push(e);
  return e;
}

// 倒された枠は respawn ターン後に、出現予告を挟んで湧き直す。dt: 進んだ時間 (ターン)
function updateCamps(dt) {
  for (const c of camps) {
    for (const s of c.slots) {
      if (s.enemy || s.pending) continue;
      s.timer -= dt;
      if (s.timer > 0) continue;
      const at = pickCampTile(c);
      if (!at || (player && !player.dead && dist(player.tx, player.ty, at[0], at[1]) < F.respawnMinDist)) continue;
      s.pending = true;
      spawns.push({ type: s.type, tx: at[0], ty: at[1], t: 0, total: F.spawnTelegraph, r: ENEMIES[s.type].radius, camp: c, slot: s });
    }
  }
  for (const s of spawns) {
    s.t += dt;
    if (s.t >= s.total && isFree(s.tx, s.ty)) {
      s.done = true;
      s.slot.pending = false;
      placeEnemy(s.type, s.tx, s.ty, s.camp, s.slot);
      effects.push({ type: 'ring', x: center(s.tx), y: center(s.ty), r0: s.r, r1: s.r * 2.5, t: 0, life: 0.3, color: THEME.spawn });
    }
  }
  spawns = spawns.filter((s) => !s.done);
}
