// =====================================================================
//  ターンの進め方 (速度による行動順)
//  主人公と敵はそれぞれ「次に行動できる時刻」(next) を持つ。一番早い者から行動し、
//  行動するたびに next に「行動 1 回にかかる時間 = 100 / 速度」を足す。主人公の番が来たら止まって入力を待つ
// =====================================================================
'use strict';

// 主人公が行動したあとに呼ぶ。主人公の次の番まで敵を動かし、時間を進める
function endPlayerAction() {
  const p = player;
  p.next = game.time + actionCost(p);
  for (const k in p.skillCd) p.skillCd[k] = Math.max(0, p.skillCd[k] - 1);
  computeFlow(p.tx, p.ty, flow);
  runUntilPlayer();
}

// 主人公の番が来るまで、早い順に敵を行動させる (同じ時刻なら主人公が先)
function runUntilPlayer() {
  for (let guard = 0; guard < 5000; guard++) {
    if (player.dead || game.state !== 'play') return;
    let e = null;
    for (const o of enemies) if (!o.dead && (!e || o.next < e.next)) e = o;
    if (!e || player.next <= e.next) { advanceTime(player.next); return; }
    advanceTime(e.next);
    enemyAct(e);
    e.next += actionCost(e);
    enemies = enemies.filter((o) => !o.dead);
  }
}

// ゲーム内の時刻を t まで進める (HP・MP の回復・湧き場所・落とし物は経った時間ぶん進む)
function advanceTime(t) {
  const dt = t - game.time;
  if (dt <= 0) return;
  game.time = t;
  const p = player;
  if (!p.dead) {
    const resting = game.time - p.lastHurt >= PG.restDelay;
    p.hp = Math.min(p.stats.maxHp, p.hp + (p.stats.hpRegen + (resting ? p.stats.maxHp * PG.restRegenRate : 0)) * dt);
    p.mp = Math.min(p.stats.maxMp, p.mp + (p.stats.mpRegen + (resting ? p.stats.maxMp * PG.restMpRegenRate : 0)) * dt);
  }
  // 敵も主人公と同じく HP再生・MP再生で回復する (休息はない。今は敵の HP再生はどれも 0)
  for (const e of enemies) {
    if (e.dead) continue;
    e.hp = Math.min(e.stats.maxHp, e.hp + e.stats.hpRegen * dt);
    e.mp = Math.min(e.stats.maxMp, e.mp + e.stats.mpRegen * dt);
  }
  updateCamps(dt);
  updateLoots(dt);
}

// これからの行動順 (HUD 用)。主人公と、画面に入っているか追ってきている敵を、早い順に n 回ぶん並べる
function turnOrder(n) {
  const vw = W / VIEW, vh = H / VIEW;
  const list = [player, ...enemies.filter((e) => e.state === 'chase' ||
    (e.x > cam.x && e.x < cam.x + vw && e.y > cam.y && e.y < cam.y + vh))];
  const next = list.map((u) => u.next);
  const out = [];
  for (let k = 0; k < n; k++) {
    let bi = 0;
    for (let i = 1; i < list.length; i++) if (next[i] < next[bi] - 1e-9) bi = i;
    out.push(list[bi]);
    next[bi] += actionCost(list[bi]);
  }
  return out;
}

// 予告の技が出るまでに、主人公があと何回行動できるか
function actionsBefore(u) {
  const pc = actionCost(player);
  return Math.max(0, Math.floor((u.next - player.next) / pc + 1e-9) + 1);
}
