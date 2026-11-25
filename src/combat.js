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
    for (let y = cy - n; y <= cy + n; y++) for (let x = cx - n; x <= cx + n; x++) if (tileDist(cx, cy, x, y) <= r + 1e-6) fn(x, y);
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
    const d = tileDist(u.tx, u.ty, tx, ty);
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
    return dealDamage(u, t, a, a.name);
  };
  if (a.type === 'projectile') {
    for (const ray of h.rays) {
      let end = ray.length ? ray[ray.length - 1] : [u.tx, u.ty];
      for (const [x, y] of ray) {
        const t = opponents(h.faction).find((o) => !o.dead && o.tx === x && o.ty === y);
        if (t && strike(t) && !a.pierce) { end = [x, y]; break; }
      }
      fxBolt(tileCenter(u.tx), tileCenter(u.ty), tileCenter(end[0]), tileCenter(end[1]), h.faction);
    }
  } else {
    for (const t of [...opponents(h.faction)]) if (h.keys.has(tileKey(t.tx, t.ty))) strike(t);
    if (a.type === 'lob') {
      for (const [cx, cy] of h.centers) fxLobImpact(tileCenter(u.tx), tileCenter(u.ty), tileCenter(cx), tileCenter(cy), a.radius, h.faction);
      addShake(a.radius > 2 ? 9 : 5);
    } else if (a.shape === 'circle' && a.range >= 2) addShake(5);
  }
  fxTiles(h.tiles, h.faction, FX_THEME.slash.life);
  return hit;
}

// 予告を出す (使った者の次の行動で判定)
function startCharge(u, h) {
  // 予告した時点で範囲にいた相手 (出すまでに逃げきったら、行動による成長の「よけた」になる)
  const keys = new Set(h.tiles.map(([x, y]) => tileKey(x, y)));
  h.threatened = opponents(h.faction).filter((o) => !o.dead && keys.has(tileKey(o.tx, o.ty)));
  u.charging = h;
  hazards.push(h);
}
function cancelCharge(u) {
  if (!u.charging) return;
  const i = hazards.indexOf(u.charging);
  if (i >= 0) hazards.splice(i, 1);
  u.charging = null;
}
// 予告していた技を出す。使った者の次の行動がこれになる (どのキャラも。src/turn.js の runUntilInput が control の代わりに呼ぶ)
function releaseCharge(u) {
  const h = u.charging;
  cancelCharge(u);
  u.facing = h.dir;
  const hit = resolveAttack(h);
  for (const t of h.threatened || []) if (!t.dead && !hit.has(t)) growthEvent(t, 'dodge');
}

// ----- 技を使う (どのキャラも、どの種類の技も同じ道) -----
// キャラ u が技 sk を (tx, ty) のマスへ向けて使う。使えたら true (行動したことになる。後始末 endTurn は呼ぶ側)
//   覚えているか (解放レベルなど) は呼ぶ側が確かめる。再使用待ちと MP はここで確かめ、使えたら再使用待ちを始めて MP を払う
//   plan: 先に planAttack で決めた範囲 (敵の AI が届くか確かめたもの。lob の散らばりを引き直さないため)
//   予告あり (charge) の技は予告を出し、u の次の行動で判定する (releaseCharge)
//   払うのは技を出したあと (主人公は技で倒した敵の経験値でレベルが上がると MP が満タンになり、そこから払う)
function useSkill(u, sk, tx, ty, plan) {
  if (!canUseSkill(u, sk)) return false;
  if (sk.type === 'dash') {
    if (!dash(u, sk, tx, ty)) return false;
  } else if (sk.type === 'buff') {
    castBuff(u, sk);
  } else {
    const h = plan || planAttack(u, sk, tx, ty);
    u.facing = h.dir;
    if (sk.charge) {
      startCharge(u, h);
      logMsg(txt('combat.charge', { who: u.name, skill: sk.name }), THEME.msg.charge);
    } else {
      if (u === player) logMsg(txt('combat.heroSkill', { skill: sk.name }), THEME.msg.skill); // ほかのキャラはダメージの文に名前が出る
      resolveAttack(h);
    }
  }
  payForSkill(u, sk);
  return true;
}

// 自分を強化する (data/buffs.js)。主人公以外はメッセージ欄の文の頭に名前が付く
function castBuff(u, sk) {
  const b = BUFFS[sk.buff];
  addBuff(u, sk.buff, sk.duration);
  logMsg(u === player ? txt('combat.buffSelf', { skill: sk.name, buff: b.name, actions: sk.duration })
    : txt('combat.buffOther', { who: u.name, skill: sk.name, buff: b.name, actions: sk.duration }), THEME.msg.buff);
  floatText(u.x, u.y - u.r - 30, buffFloatText(b), b.color, THEME.float.buff.size);
  fxBuff(u);
}

// ダッシュ: 狙ったマスの向き (8 方向) へ、ふさがるまで distance マス一気に進む。進めなければ false
//   落とし物を拾う・門をくぐる・「進めない」の文は主人公だけ
function dash(u, sk, tx, ty) {
  const hero = u === player;
  const a = Math.atan2(ty - u.ty, tx - u.tx);
  const oct = Math.round(a / (Math.PI / 4));
  const dx = Math.round(Math.cos(oct * Math.PI / 4)), dy = Math.round(Math.sin(oct * Math.PI / 4));
  if (tx === u.tx && ty === u.ty) return false;
  let moved = 0;
  for (let i = 0; i < sk.distance; i++) {
    if (!canStep(u.tx, u.ty, dx, dy) || !isFree(u.tx + dx, u.ty + dy)) break;
    fxGhost(tileCenter(u.tx), tileCenter(u.ty), u.r, u.color);
    moveUnitTo(u, u.tx + dx, u.ty + dy);
    if (hero) pickUpAt(u.tx, u.ty);
    moved++;
    if (gateAt[tileIndex(u.tx, u.ty)] >= 0) break;
  }
  if (!moved) { if (hero) logMsg(txt('combat.noDash'), THEME.msg.refuse); return false; }
  if (hero) checkGate();
  return true;
}

// 技 a (kind / power / base / intRate) のダメージ。戻り値 { dmg, crit }
function rollDamage(src, tgt, a) {
  const s = src.stats, D = PARAMS.damage;
  const vary = () => 1 + rand(-1, 1) * D.variance;
  if (a.kind === 'magic') {
    // 術: 固定値 + 知力に比例した分を、術防御で割合で減らす。会心・ミスはない
    const M = PARAMS.magic;
    const base = a.base + s.int * (a.intRate !== undefined ? a.intRate : M.intRate);
    return { dmg: Math.max(1, Math.round(base * M.mdefScale / (M.mdefScale + Math.max(0, tgt.stats.mdef)) * vary())), crit: false };
  }
  // 物理 (ドラクエ式)
  const power = a.power;
  const crit = Math.random() < s.critRate;
  let dmg;
  if (crit) {
    // 会心は防御を無視する
    dmg = Math.max(1, Math.round(s.atk * D.atkRate * s.critMult * power * vary()));
  } else {
    const base = (s.atk * D.atkRate - Math.max(0, tgt.stats.def) * D.defRate) * power;
    dmg = base < D.minBase ? randInt(0, 1) : Math.max(1, Math.round(base * vary()));
  }
  return { dmg, crit };
}

// メッセージ欄の文。主人公が受けたときは相手の名前、主人公が与えたときは受けた側の名前、どちらでもないときは両方の名前を出す
function damageLine(src, tgt, what, dmg, crit) {
  const c = crit ? txt('combat.critMark') : '';
  if (tgt === player) return dmg === 0 ? txt('combat.heroHurtMiss', { src: src.name, what }) : txt('combat.heroHurt', { src: src.name, what, dmg, crit: c });
  const head = src === player ? txt('combat.headHero', { what }) : txt('combat.headOther', { src: src.name, what });
  return dmg === 0 ? txt('combat.dealMiss', { head, tgt: tgt.name }) : txt('combat.deal', { head, tgt: tgt.name, dmg, crit: c });
}

// a: 技 (物理か術か・威力)。戻り値: 当たったか (ミスも当たったことにする。帰還中で無効のときは当たっていない)
// 色は受けた側の陣営で決める (主人公の陣営が受けたら赤っぽく)。歩くのをやめる・画面の揺れは主人公だけ
function dealDamage(src, tgt, a, what) {
  if (tgt.dead) return false;
  if (tgt.invuln) { floatText(tgt.x, tgt.y - tgt.r - 6, txt('combat.invulnFloat'), THEME.float.invuln.color, THEME.float.invuln.size); return false; }
  const { dmg, crit } = rollDamage(src, tgt, a);
  const ours = tgt.faction === 'player';
  if (dmg === 0) {
    if (src.faction !== tgt.faction) growthEvent(tgt, 'evade');
    if (tgt === player) tgt.travel = null;
    if (tgt.state === 'idle') aggro(tgt);
    logMsg(damageLine(src, tgt, what, 0, false), THEME.msg.miss);
    floatText(tgt.x + rand(-8, 8), tgt.y - tgt.r - 6, txt('combat.missFloat'), THEME.float.miss.color, THEME.float.miss.size);
    return true;
  }
  // 行動による成長: 与えた側・受けた側とも、倒しきるまでの分を最大HPに対する割合で数える (敵レベルの補正はない)
  if (src.faction !== tgt.faction) {
    const dealt = Math.min(dmg, Math.max(0, tgt.hp)), magic = a.kind === 'magic';
    growthEvent(src, magic ? 'dealMagic' : 'dealPhysical', dealt / tgt.stats.maxHp);
    growthEvent(tgt, magic ? 'takeMagic' : 'takePhysical', dealt / tgt.stats.maxHp);
    if (crit) growthEvent(src, 'critHit'); // 会心を出すと器用さが伸びる
  }
  tgt.hp -= dmg;
  tgt.hitFlash = 0.15;
  tgt.lastHurt = game.time;
  if (tgt === player) tgt.travel = null;
  if (tgt.state === 'idle') aggro(tgt);
  const FD = THEME.float.damage;
  logMsg(damageLine(src, tgt, what, dmg, crit), ours ? THEME.msg.hurt : crit ? THEME.msg.crit : THEME.msg.hit);
  floatText(tgt.x + rand(-8, 8), tgt.y - tgt.r - 6, txt(crit ? 'combat.critFloat' : 'combat.damageFloat', { dmg }),
    ours ? FD.hurt : crit ? FD.crit : FD.hit, crit ? FD.critSize : FD.size);
  fxHit(tgt, ours, crit);
  if (tgt === player) addShake(6);
  if (tgt.hp <= 0) kill(tgt);
  return true;
}

// 倒れる。演出は共通で、そのあとはキャラによって分ける:
//   主人公 → 倒れてから復活する流れ (heroDown) / 敵 → 経験値・落とし物・クエスト・湧き場所 (enemyDefeated) / 主人公の陣営のほかのキャラ → 倒れるだけ (allyDown)
function kill(u) {
  u.dead = true;
  u.hp = 0;
  cancelCharge(u);
  if (u !== player) clearBuffs(u); // 強化・弱体は消す (主人公は復活するときに消す。倒れている間はアイコンを残す)
  fxDeath(u);
  if (u === player) heroDown(u);
  else if (u.faction === 'enemy') enemyDefeated(u);
  else allyDown(u);
}

function heroDown(u) {
  // 失うものはその場で決めて保存する (復活前に閉じても取り消せないように)
  game.deathLoss = { exp: Math.floor(u.exp * PROGRESSION.deathExpLoss), gold: Math.floor(u.gold * PROGRESSION.deathGoldLoss) };
  u.exp -= game.deathLoss.exp;
  u.gold -= game.deathLoss.gold;
  game.state = 'dying';
  game.dyingT = 1.4;
  logMsg(txt('combat.heroDown'), THEME.msg.heroDown);
  saveGame();
}

function enemyDefeated(u) {
  game.kills++;
  u.slot.enemy = null;
  u.slot.timer = u.camp.respawn;
  logMsg(txt('combat.defeated', { who: u.name }), THEME.msg.defeated);
  const gray = player.level - u.level >= PARAMS.enemyLevel.grayDiff;
  gainExp(Math.max(1, Math.round(u.exp * (gray ? PARAMS.enemyLevel.grayExpMult : 1))), u.x, u.y);
  dropLoot(u);
  questEvent('kill', u);
  if (u.isBoss) { addShake(14); showMsg(txt('combat.bossDefeated')); }
}

function allyDown(u) {
  logMsg(txt('combat.allyDown', { who: u.name }), THEME.msg.allyDown);
}
