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
  for (const o of units) {
    if (o !== e && o.camp === e.camp && o.state === 'idle' && tileDist(o.tx, o.ty, e.tx, e.ty) <= FIELD_AI.assistRange) o.state = 'chase';
  }
}

// 待機中: 湧いた位置のまわりをときどき 1 マスうろつく
function wander(e) {
  if (Math.random() >= FIELD_AI.wanderChance) return;
  const opts = NEIGHBORS.filter(([dx, dy]) => canStep(e.tx, e.ty, dx, dy) && !unitAt(e.tx + dx, e.ty + dy) &&
    tileDist(e.tx + dx, e.ty + dy, e.home.tx, e.home.ty) <= FIELD_AI.wanderRadius);
  if (!opts.length) return;
  const [dx, dy] = opts[Math.floor(Math.random() * opts.length)];
  moveUnitTo(e, e.tx + dx, e.ty + dy);
}

// score が一番大きくなるとなりのマスへ動く (今のマスより良くなるときだけ)。動いたら true
function stepBest(e, score) {
  let best = score(e.tx, e.ty), pick = null;
  for (const [dx, dy] of NEIGHBORS) {
    const nx = e.tx + dx, ny = e.ty + dy;
    if (!canStep(e.tx, e.ty, dx, dy) || unitAt(nx, ny)) continue;
    const v = score(nx, ny);
    if (v > best + 1e-6) { best = v; pick = [nx, ny]; }
  }
  if (pick) moveUnitTo(e, pick[0], pick[1]);
  return !!pick;
}

// 相手 t へ近づく (t までの歩数の場 flowTo。主人公なら playerFlow)。道がふさがっていたら、少しでも近づけるマスへ
function approach(e, t) {
  const s = stepDownhill(e, flowTo(t));
  if (s) { moveUnitTo(e, e.tx + s[0], e.ty + s[1]); return; }
  stepBest(e, (x, y) => -tileDist(x, y, t.tx, t.ty));
}

// 狙う相手を選ぶ: 自分の陣営の敵 (opponents) のうち、視線が通るものを先に、近い順 (同じなら units の順 = 主人公が先)。いなければ null
function chooseTarget(e) {
  let best = null, bestSee = false, bestD = Infinity;
  for (const o of opponents(e.faction)) {
    const see = hasLOS(e.tx, e.ty, o.tx, o.ty), d = tileDist(e.tx, e.ty, o.tx, o.ty);
    if (!best || (see && !bestSee) || (see === bestSee && d < bestD)) { best = o; bestSee = see; bestD = d; }
  }
  return best;
}

// 敵の 1 回の行動。予告していた技を出す行動と、技の再使用待ちを減らすのは、ここを呼ぶ前に src/turn.js の runUntilInput がする
function enemyAct(e) {
  const t = e.target = chooseTarget(e);
  const alive = !!t;
  const d = alive ? tileDist(e.tx, e.ty, t.tx, t.ty) : Infinity;
  const canSee = alive && hasLOS(e.tx, e.ty, t.tx, t.ty);
  const fromHome = tileDist(e.tx, e.ty, e.home.tx, e.home.ty);
  if (e.state === 'idle') {
    if (alive && !inSafeZone() && d <= FIELD_AI.aggroRange && canSee) aggro(e);
    else { wander(e); return; }
  }
  if (e.state === 'chase' && (!alive || inSafeZone() || fromHome > FIELD_AI.leashRange)) {
    e.state = 'return';
    e.invuln = true;
    e.returnT = FIELD_AI.returnTimeout; // 引っかかって戻れないときの保険
  }
  // 帰還中: 無敵のまま湧いた位置へ戻り、着いたら全回復
  // 戻る途中で（すぐまた諦めない所まで戻っていて）相手が近くに見えたら戦い直す
  if (e.state === 'return' && alive && !inSafeZone() && fromHome <= FIELD_AI.leashRange * FIELD_AI.reengageLeashRatio &&
    d <= FIELD_AI.aggroRange && canSee) {
    e.invuln = false;
    aggro(e);
  }
  if (e.state === 'return') {
    e.returnT--;
    const home = e.home;
    if ((e.tx === home.tx && e.ty === home.ty) || (e.returnT <= 0 && isFree(home.tx, home.ty))) {
      if (e.tx !== home.tx || e.ty !== home.ty) placeUnit(e, home.tx, home.ty);
      clearBuffs(e); // 湧いたばかりと同じ状態に戻す (強化・弱体も消す)
      Object.assign(e, { state: 'idle', invuln: false, hp: e.stats.maxHp, mp: e.stats.maxMp, intent: null });
      return;
    }
    const s = stepDownhill(e, campField(e.camp));
    if (s) moveUnitTo(e, e.tx + s[0], e.ty + s[1]);
    return;
  }

  e.surroundAt = null; // 回り込む枠は、近づくときに毎回選び直す (closeIn)
  if (!e.intent || e.intentT <= 0) chooseIntent(e, t);
  e.intentT--;
  const a = e.def.attacks[e.intent.i];

  // 遠くから撃つつもりで近すぎるときは、まず下がる (下がれなければその場で撃つ)
  const kd = e.def.keepDistance;
  if (e.intent.far && canSee && d < kd * FIELD_AI.retreatRatio &&
    stepBest(e, (x, y) => tileDist(x, y, t.tx, t.ty))) return;
  // 狙っている技が使えて、相手が範囲に入っていれば使う
  if (canSee && canUseSkill(e, a) && d <= attackReach(a) + 0.01) {
    const h = planAttack(e, a, t.tx, t.ty);
    if (h.keys.has(tileKey(t.tx, t.ty))) {
      useEnemyAttack(e, e.intent.i, h);
      e.intent = null;
      return;
    }
  }
  // 技を待っている (近づく) 間でも、となりにいれば基本の技で攻撃する。遠くから撃つつもりのときは殴らない
  if (canSee && !e.intent.far && e.intent.i !== e.basic && e.basic >= 0 && cooldownLeft(e, e.def.attacks[e.basic]) <= 0) {
    const h = planAttack(e, e.def.attacks[e.basic], t.tx, t.ty);
    if (h.keys.has(tileKey(t.tx, t.ty))) { useEnemyAttack(e, e.basic, h); return; }
  }

  // 移動: 遠くから撃つつもりなら間合いを取り、そうでなければ近づく
  if (e.intent.far) {
    if (!canSee || d > kd * FIELD_AI.approachRatio) approach(e, t);
  } else if (tileSteps(e.tx, e.ty, t.tx, t.ty) > 1) {
    closeIn(e, t);
  }
  if (tileSteps(e.tx, e.ty, t.tx, t.ty) <= 1) e.facing = Math.atan2(t.ty - e.ty, t.tx - e.tx);
}

// ----- 狙う技の選び方 -----
// 状況 (params.js の field.ai.situations) ごとの重みの倍率。新しい状況はここと params.js に 1 つずつ足す
//   c: そのときの様子 (situationContext。c.target が狙っている相手)。戻り値は倍率 (1 なら変えない)
const SITUATIONS = {
  // 今の位置から届く技
  reachNow: (e, a, c, p) => (c.canSee && c.d <= attackReach(a) + 0.01 ? p.mult : 1),
  // 相手が縦・横・斜めの直線上にいて届く (直線の技・弾)
  aligned: (e, a, c, p) => (c.canSee && c.aligned && c.d <= attackReach(a) + 0.01 ? p.mult : 1),
  // 相手のまわりの空いているマスが少ない (逃げにくいので範囲技)
  cornered: (e, a, c, p) => (c.freeAround <= p.maxFree ? p.mult : 1),
  // 予告ありの技: 相手が自分より速いほど逃げられるので選びにくい
  telegraph: (e, a, c, p) => clamp((e.stats.speed / c.target.stats.speed) ** p.exp, p.min, 1),
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
// 技を選ぶときの様子 (t: 狙っている相手)
function situationContext(e, t) {
  const dx = t.tx - e.tx, dy = t.ty - e.ty;
  const canSee = hasLOS(e.tx, e.ty, t.tx, t.ty);
  const freeAround = NEIGHBORS.filter(([nx, ny]) => canStep(t.tx, t.ty, nx, ny) && !unitAt(t.tx + nx, t.ty + ny)).length;
  return { target: t, d: tileDist(e.tx, e.ty, t.tx, t.ty), canSee, aligned: dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy), freeAround };
}
// 技の重み = weight (省略時 1) × 状況ごとの倍率
function attackWeight(e, a, c) {
  let w = a.weight ?? 1;
  for (const k of attackSituations(a)) w *= SITUATIONS[k](e, a, c, FIELD_AI.situations[k]);
  return w;
}

// 次に狙う技を決める: 再使用待ちでなく MP が足りる技 (基本の技以外) と、基本の技 (MP を使わない技) のくじ。
//   基本の技の重みは、状況の倍率がどれも 1 のときに技が当たる確率が skillChance になるように決める
//   (技の重み = weight × 状況の倍率。状況に合った技ほど、基本の技より選ばれやすくなる)
// far: keepDistance を持つ敵が、となりより遠くまで届く技を狙うとき。間合いを取ったまま撃つ
function chooseIntent(e, t) {
  const atks = e.def.attacks;
  const opts = [];
  atks.forEach((a, i) => { if (i !== e.basic && canUseSkill(e, a)) opts.push(i); });
  let i = e.basic;
  if (opts.length) {
    const chance = e.def.skillChance ?? FIELD_AI.skillChance;
    const c = situationContext(e, t);
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
  e.intent = { i, far: !!e.def.keepDistance && attackReach(atks[i]) > FIELD_AI.meleeReach };
  e.intentT = FIELD_AI.intentTimeout;
}

// ----- 取り囲む -----
// 近づく敵は、相手のとなりの空いているマス (枠) を分け合う。ほかのキャラがもっと近くから狙っている枠は譲る
// 相手まで surroundRange 歩以内に来たら使う。data/enemies.js で surround: false にした敵は使わない

// 自分のまわり limit 歩以内の最短経路 (ほかのキャラのいるマスは通らない)。
// 戻り値: Map(マスの番号 → { d: 歩数, first: そこへ行く最初の 1 歩 [x, y] })
function localPaths(e, limit) {
  const res = new Map([[tileIndex(e.tx, e.ty), { d: 0, first: null, x: e.tx, y: e.ty }]]);
  let front = [res.get(tileIndex(e.tx, e.ty))];
  for (let step = 1; step <= limit && front.length; step++) {
    const next = [];
    for (const n of front) {
      for (const [dx, dy] of NEIGHBORS) {
        const x = n.x + dx, y = n.y + dy, k = tileIndex(x, y);
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
// 相手 t のまわりで狙う枠を選ぶ (今の自分からの歩数が一番少ない、ほかのキャラに譲らなくてよい枠)。戻り値 { at: [x, y], first } か null
function surroundSlot(e, t, paths) {
  let best = null;
  for (const [dx, dy] of NEIGHBORS) {
    const x = t.tx + dx, y = t.ty + dy;
    if (!canStep(t.tx, t.ty, dx, dy)) continue;
    const p = paths.get(tileIndex(x, y));
    if (!p) continue;
    const taken = units.some((o) => o !== e && !o.dead && o.surroundAt && o.surroundAt[0] === x && o.surroundAt[1] === y &&
      tileDist(o.tx, o.ty, x, y) < tileDist(e.tx, e.ty, x, y));
    if (!taken && (!best || p.d < best.d)) best = { at: [x, y], first: p.first, d: p.d };
  }
  return best;
}
// 相手 t へ近づく。近くまで来ていれば、空いている枠へ回り込む
function closeIn(e, t) {
  if (e.def.surround !== false && flowTo(t)[tileIndex(e.tx, e.ty)] <= FIELD_AI.surroundRange) {
    const s = surroundSlot(e, t, localPaths(e, FIELD_AI.surroundRange + 2));
    if (s && s.first) {
      e.surroundAt = s.at;
      moveUnitTo(e, s.first[0], s.first[1]);
      return;
    }
  }
  approach(e, t);
}

// i 番目の技を、範囲 h (planAttack で決めて相手が入っていると確かめたもの) で出す。使うのはどのキャラも同じ useSkill (src/combat.js)
// (予告ありなら構える。再使用待ちと MP もそこで)
function useEnemyAttack(e, i, h) {
  useSkill(e, e.def.attacks[i], e.target.tx, e.target.ty, h);
}

// ----- 湧き場所 -----
// 湧き場所の中心から spread 以内で、空いているマスを選ぶ。見つからなければ null
function pickCampTile(c) {
  for (let i = 0; i < 20; i++) {
    const a = rand(0, TAU), r = rand(0, c.spreadT);
    const x = Math.round(c.tx + Math.cos(a) * r), y = Math.round(c.ty + Math.sin(a) * r);
    if (isFree(x, y) && gateAt[tileIndex(x, y)] < 0) return [x, y];
  }
  for (let r = 0; r <= 3; r++) for (const [dx, dy] of [[0, 0], ...NEIGHBORS]) {
    const x = c.tx + dx * r, y = c.ty + dy * r;
    if (isFree(x, y) && gateAt[tileIndex(x, y)] < 0) return [x, y];
  }
  return null;
}

function placeEnemy(type, tx, ty, camp, slot) {
  const e = createEnemy(type, tx, ty, camp, slot);
  placeUnit(e, tx, ty);
  slot.enemy = e;
  units.push(e);
  return e;
}

// 倒された枠は respawn ターン後に、出現予告を挟んで湧き直す。dt: 進んだ時間 (ターン)
//   予告は再出現の時間が切れた時刻から数える (この dt の途中で切れたら、切れてから過ぎた分を予告に入れる)。
//   主人公が近いなどで予告を出すのを待っていた枠は、出したときから数える。
//   こうすると、時間がどう細かく区切られて進んでも、湧くのは「倒してから respawn + spawnTelegraph ターン」になる
function updateCamps(dt) {
  for (const s of spawns) s.t += dt; // 前から出ていた予告だけ進める (このあと出す予告には dt を足さない)
  for (const c of camps) {
    for (const s of c.slots) {
      if (s.enemy || s.pending) continue;
      const before = s.timer;
      s.timer -= dt;
      if (s.timer > 1e-9) continue; // 1e-9: 細かく区切って引いたときの小数の誤差
      const at = pickCampTile(c);
      if (!at || (player && !player.dead && tileDist(player.tx, player.ty, at[0], at[1]) < FIELD.respawnMinDist)) continue;
      s.pending = true;
      const late = before > 1e-9 ? Math.max(0, -s.timer) : 0;
      spawns.push({ type: s.type, tx: at[0], ty: at[1], t: late, total: FIELD.spawnTelegraph, r: ENEMIES[s.type].radius, camp: c, slot: s });
    }
  }
  for (const s of spawns) {
    if (s.t >= s.total - 1e-9 && isFree(s.tx, s.ty)) {
      s.done = true;
      s.slot.pending = false;
      placeEnemy(s.type, s.tx, s.ty, s.camp, s.slot);
      fxSpawn(tileCenter(s.tx), tileCenter(s.ty), s.r);
    }
  }
  spawns = spawns.filter((s) => !s.done);
}
