// =====================================================================
//  攻撃 (技の範囲・判定・ダメージ・予告)
//  技の範囲はマスの集まり。charge のある技は予告 (hazards) を出し、使った者の次の行動で判定する
// =====================================================================
'use strict';

const tileKey = (x, y) => x + ',' + y;

// 技の範囲を決める。u: 使う者 / (ax, ay): 狙うマス
//   戻り値 { owner, atk, faction, dir, tiles: [[x, y]...], rays: 弾の通り道 (projectile のみ), centers: 着弾点 (lob のみ) }
function planAttack(u, atk, ax, ay) {
  const dir = ax === u.tx && ay === u.ty ? u.facing : Math.atan2(ay - u.ty, ax - u.tx);
  const h = { owner: u, atk, faction: u.faction, dir, tiles: [], rays: null, centers: null };
  const seen = new Set();
  const addTile = (x, y) => {
    const k = tileKey(x, y);
    if (!seen.has(k) && inMap(x, y)) { seen.add(k); h.tiles.push([x, y]); }
  };
  const around = (cx, cy, r, fn) => {
    const n = Math.ceil(r);
    for (let y = cy - n; y <= cy + n; y++) for (let x = cx - n; x <= cx + n; x++) if (dist(cx, cy, x, y) <= r + 1e-6) fn(x, y);
  };
  if (atk.type === 'melee') {
    if (atk.shape === 'line') {
      for (const [x, y] of rayTiles(u.tx, u.ty, dir, atk.range)) addTile(x, y);
    } else {
      const half = (atk.angle || 360) * DEG / 2 + 0.01;
      around(u.tx, u.ty, atk.range, (x, y) => {
        if (x === u.tx && y === u.ty) return;
        if (atk.shape === 'fan' && Math.abs(angDiff(Math.atan2(y - u.ty, x - u.tx), dir)) > half) return;
        if (!isShotBlocked(x, y) && hasLOS(u.tx, u.ty, x, y)) addTile(x, y);
      });
    }
  } else if (atk.type === 'projectile') {
    const n = atk.count || 1, spread = (atk.spread || 0) * DEG;
    h.rays = [];
    for (let i = 0; i < n; i++) {
      const d = n > 1 ? dir - spread / 2 + spread * i / (n - 1) : dir;
      const ray = rayTiles(u.tx, u.ty, d, atk.range);
      h.rays.push(ray);
      for (const [x, y] of ray) addTile(x, y);
    }
  } else if (atk.type === 'lob') {
    // 射程より遠いマスを狙ったら、同じ向きで射程いっぱいのマスにする
    let tx = ax, ty = ay;
    const d = dist(u.tx, u.ty, tx, ty);
    if (d > atk.castRange) {
      tx = Math.round(u.tx + (ax - u.tx) / d * atk.castRange);
      ty = Math.round(u.ty + (ay - u.ty) / d * atk.castRange);
    }
    h.centers = [[clamp(tx, 0, COLS - 1), clamp(ty, 0, ROWS - 1)]];
    for (let i = 1; i < (atk.count || 1); i++) {
      const a = rand(0, TAU), r = rand(atk.scatter * 0.4, atk.scatter);
      h.centers.push([clamp(Math.round(tx + Math.cos(a) * r), 1, COLS - 2), clamp(Math.round(ty + Math.sin(a) * r), 1, ROWS - 2)]);
    }
    for (const [cx, cy] of h.centers) {
      const skipLOS = isShotBlocked(cx, cy);
      around(cx, cy, atk.radius, (x, y) => {
        if (!isShotBlocked(x, y) && (skipLOS || hasLOS(cx, cy, x, y))) addTile(x, y);
      });
    }
  }
  h.keys = seen;
  return h;
}

// 技の判定。範囲のマスにいる相手にダメージを与え、演出を出す
function resolveAttack(h) {
  const u = h.owner, a = h.atk;
  const hit = new Set();
  const strike = (t) => {
    if (hit.has(t) || t.dead) return false;
    hit.add(t);
    return dealDamage(u, t, a.power, a.name);
  };
  if (a.type === 'projectile') {
    for (const ray of h.rays) {
      let end = ray.length ? ray[ray.length - 1] : [u.tx, u.ty];
      for (const [x, y] of ray) {
        const t = opponents(h.faction).find((o) => !o.dead && o.tx === x && o.ty === y);
        if (t && strike(t) && !a.pierce) { end = [x, y]; break; }
      }
      effects.push({ type: 'bolt', x0: center(u.tx), y0: center(u.ty), x1: center(end[0]), y1: center(end[1]), t: 0, life: 0.16, faction: h.faction });
    }
  } else {
    for (const t of [...opponents(h.faction)]) if (h.keys.has(tileKey(t.tx, t.ty))) strike(t);
    if (a.type === 'lob') {
      for (const [cx, cy] of h.centers) {
        const x = center(cx), y = center(cy), col = FC[h.faction].rgb;
        effects.push({ type: 'arc', x0: center(u.tx), y0: center(u.ty), x1: x, y1: y, t: 0, life: 0.22, faction: h.faction });
        effects.push({ type: 'ring', x, y, r0: a.radius * T * 0.3, r1: (a.radius + 0.5) * T, t: 0, life: 0.4, color: col });
        burst(x, y, FC[h.faction].spark, 20, 260);
      }
      addShake(a.radius > 2 ? 9 : 5);
    } else if (a.shape === 'circle' && a.range >= 2) addShake(5);
  }
  effects.push({ type: 'tiles', tiles: h.tiles, t: 0, life: 0.3, faction: h.faction });
}

// 予告を出す (使った者の次の行動で判定)
function startCharge(u, h) {
  u.charging = h;
  hazards.push(h);
}
function cancelCharge(u) {
  if (!u.charging) return;
  const i = hazards.indexOf(u.charging);
  if (i >= 0) hazards.splice(i, 1);
  u.charging = null;
}

// 戻り値: ダメージが入ったか
function dealDamage(src, tgt, power, what) {
  if (tgt.dead) return false;
  if (tgt.invuln) { floatText(tgt.x, tgt.y - tgt.r - 6, '無効', '#80deea', 15); return false; }
  const s = src.stats, K = P.damage.defConstant;
  let dmg = s.atk * power * (K / (K + Math.max(0, tgt.stats.def)));
  dmg *= 1 + rand(-1, 1) * P.damage.variance;
  const crit = Math.random() < s.critRate;
  if (crit) dmg *= s.critMult;
  dmg = Math.max(1, Math.round(dmg));
  tgt.hp -= dmg;
  tgt.hitFlash = 0.15;
  if (tgt.isPlayer) {
    tgt.lastHurt = game.time;
    tgt.travel = null;
    log(`${src.name}の${what}！ ${dmg} のダメージを受けた${crit ? '（会心）' : ''}`, '#ff8a80');
  } else {
    if (tgt.state === 'idle') aggro(tgt);
    log(`${what}: ${tgt.name}に ${dmg} のダメージ${crit ? '（会心）' : ''}`, crit ? '#ffab40' : '#e6edf3');
  }
  floatText(tgt.x + rand(-8, 8), tgt.y - tgt.r - 6, crit ? dmg + '!' : String(dmg),
    tgt.isPlayer ? '#ff5252' : crit ? '#ffab40' : '#ffffff', crit ? 24 : 17);
  burst(tgt.x, tgt.y, tgt.isPlayer ? '#ff8a80' : tgt.color, crit ? 10 : 5, 160);
  if (tgt.isPlayer) addShake(6);
  if (tgt.hp <= 0) kill(tgt);
  return true;
}

function kill(u) {
  u.dead = true;
  u.hp = 0;
  cancelCharge(u);
  burst(u.x, u.y, u.color, u.isBoss ? 60 : 18, u.isBoss ? 380 : 220);
  effects.push({ type: 'ring', x: u.x, y: u.y, r0: u.r, r1: u.r * 3, t: 0, life: 0.4, color: '255,255,255' });
  if (u.isPlayer) {
    // 失うものはその場で決めて保存する (復活前に閉じても取り消せないように)
    game.deathLoss = { exp: Math.floor(u.exp * PG.deathExpLoss), gold: Math.floor(u.gold * PG.deathGoldLoss) };
    u.exp -= game.deathLoss.exp;
    u.gold -= game.deathLoss.gold;
    game.state = 'dying';
    game.dyingT = 1.4;
    log('力尽きた…', '#ff5252');
    saveGame();
  } else {
    game.kills++;
    u.slot.enemy = null;
    u.slot.timer = u.camp.respawn;
    log(`${u.name}を倒した。`, '#b39ddb');
    const gray = player.level - u.level >= P.enemyLevel.grayDiff;
    gainExp(Math.max(1, Math.round(u.exp * (gray ? P.enemyLevel.grayExpMult : 1))), u.x, u.y);
    dropLoot(u);
    questKill(u);
    if (u.isBoss) { addShake(14); showMsg('BOSS 撃破！'); }
  }
}
