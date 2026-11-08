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

  e.surroundAt = null; // 回り込む枠は、近づくときに毎回選び直す (closeIn)
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
    closeIn(e);
  }
  if (steps(e.tx, e.ty, player.tx, player.ty) <= 1) e.facing = Math.atan2(player.ty - e.ty, player.tx - e.tx);
}

// ----- 狙う技の選び方 -----
// 状況 (params.js の field.ai.situations) ごとの重みの倍率。新しい状況はここと params.js に 1 つずつ足す
//   c: そのときの様子 (situationContext)。戻り値は倍率 (1 なら変えない)
const SITUATIONS = {
  // 今の位置から届く技
  reachNow: (e, a, c, p) => (c.canSee && c.d <= attackReach(a) + 0.01 ? p.mult : 1),
  // 主人公が縦・横・斜めの直線上にいて届く (直線の技・弾)
  aligned: (e, a, c, p) => (c.canSee && c.aligned && c.d <= attackReach(a) + 0.01 ? p.mult : 1),
  // 主人公のまわりの空いているマスが少ない (逃げにくいので範囲技)
  cornered: (e, a, c, p) => (c.freeAround <= p.maxFree ? p.mult : 1),
  // 予告ありの技: 主人公が自分より速いほど逃げられるので選びにくい
  telegraph: (e, a, c, p) => clamp((e.stats.speed / player.stats.speed) ** p.exp, p.min, 1),
};
// 技の形から、見る状況を決める (技に situations があればそちらを使う)
function attackSituations(a) {
  if (a.situations) return a.situations;
  const list = ['reachNow'];
  if (a.type === 'projectile' || a.shape === 'line') list.push('aligned');
  if (a.type === 'lob' || a.shape === 'circle' || (a.shape === 'fan' && a.range >= 2)) list.push('cornered');
  if (a.charge) list.push('telegraph');
  return list;
}
// 技を選ぶときの様子
function situationContext(e) {
  const dx = player.tx - e.tx, dy = player.ty - e.ty;
  const canSee = hasLOS(e.tx, e.ty, player.tx, player.ty);
  const freeAround = NB.filter(([nx, ny]) => canStep(player.tx, player.ty, nx, ny) && !unitAt(player.tx + nx, player.ty + ny)).length;
  return { d: dist(e.tx, e.ty, player.tx, player.ty), canSee, aligned: dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy), freeAround };
}
// 技の重み = weight (省略時 1) × 状況ごとの倍率
function attackWeight(e, a, c) {
  let w = a.weight ?? 1;
  for (const k of attackSituations(a)) w *= SITUATIONS[k](e, a, c, AI.situations[k]);
  return w;
}

// 次に狙う技を決める: 再使用待ちでなく MP が足りる技 (基本の技以外) と、基本の技 (MP を使わない技) のくじ。
//   基本の技の重みは、状況の倍率がどれも 1 のときに技が当たる確率が skillChance になるように決める
//   (技の重み = weight × 状況の倍率。状況に合った技ほど、基本の技より選ばれやすくなる)
// far: keepDistance を持つ敵が、となりより遠くまで届く技を狙うとき。間合いを取ったまま撃つ
function chooseIntent(e) {
  const atks = e.def.attacks;
  const opts = [];
  atks.forEach((a, i) => { if (i !== e.basic && e.cd[i] <= 0 && e.mp + 1e-9 >= skillMp(a)) opts.push(i); });
  let i = e.basic;
  if (opts.length) {
    const chance = e.def.skillChance ?? AI.skillChance;
    const c = situationContext(e);
    const w = opts.map((k) => attackWeight(e, atks[k], c));
    const plain = opts.reduce((sum, k) => sum + (atks[k].weight ?? 1), 0);
    const wBasic = e.basic < 0 ? 0 : chance <= 0 ? Infinity : plain * (1 - chance) / chance;
    if (wBasic !== Infinity) {
      let r = Math.random() * (w.reduce((x, y) => x + y, 0) + wBasic);
      const n = w.findIndex((x) => (r -= x) < 0);
      if (n >= 0) i = opts[n];
    }
  }
  if (i < 0) i = 0; // 基本の技がなく、使える技もない: いちばん上の技を待つ
  e.intent = { i, far: !!e.def.keepDistance && attackReach(atks[i]) > AI.meleeReach };
  e.intentT = AI.intentTimeout;
}

// ----- 取り囲む -----
// 近づく敵は、主人公のとなりの空いているマス (枠) を分け合う。ほかの敵がもっと近くから狙っている枠は譲る
// 主人公まで surroundRange 歩以内に来たら使う。data/enemies.js で surround: false にした敵は使わない

// 自分のまわり limit 歩以内の最短経路 (ほかのキャラのいるマスは通らない)。
// 戻り値: Map(マスの番号 → { d: 歩数, first: そこへ行く最初の 1 歩 [x, y] })
function localPaths(e, limit) {
  const res = new Map([[idx(e.tx, e.ty), { d: 0, first: null, x: e.tx, y: e.ty }]]);
  let front = [res.get(idx(e.tx, e.ty))];
  for (let step = 1; step <= limit && front.length; step++) {
    const next = [];
    for (const n of front) {
      for (const [dx, dy] of NB) {
        const x = n.x + dx, y = n.y + dy, k = idx(x, y);
        if (res.has(k) || !canStep(n.x, n.y, dx, dy) || unitAt(x, y)) continue;
        const m = { d: step, first: n.first || [x, y], x, y };
        res.set(k, m);
        next.push(m);
      }
    }
    front = next;
  }
  return res;
}
// 狙う枠を選ぶ (今の自分からの歩数が一番少ない、ほかの敵に譲らなくてよい枠)。戻り値 { at: [x, y], first } か null
function surroundSlot(e, paths) {
  let best = null;
  for (const [dx, dy] of NB) {
    const x = player.tx + dx, y = player.ty + dy;
    if (!canStep(player.tx, player.ty, dx, dy)) continue;
    const p = paths.get(idx(x, y));
    if (!p) continue;
    const taken = enemies.some((o) => o !== e && !o.dead && o.surroundAt && o.surroundAt[0] === x && o.surroundAt[1] === y &&
      dist(o.tx, o.ty, x, y) < dist(e.tx, e.ty, x, y));
    if (!taken && (!best || p.d < best.d)) best = { at: [x, y], first: p.first, d: p.d };
  }
  return best;
}
// 主人公へ近づく。近くまで来ていれば、空いている枠へ回り込む
function closeIn(e) {
  if (e.def.surround !== false && flow[idx(e.tx, e.ty)] <= AI.surroundRange) {
    const t = surroundSlot(e, localPaths(e, AI.surroundRange + 2));
    if (t && t.first) {
      e.surroundAt = t.at;
      moveUnitTo(e, t.first[0], t.first[1]);
      return;
    }
  }
  approach(e);
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
