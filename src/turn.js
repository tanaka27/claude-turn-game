// =====================================================================
//  ターンの進め方 (速度による行動順)
//  戦うキャラ (units) はそれぞれ「次に行動できる時刻」(next) を持つ。一番早い者から行動し、
//  行動するたびに next に「行動 1 回にかかる時間 = 100 / 速度」を足す。人が操作するキャラ (主人公) の番が来たら止まって入力を待つ
// =====================================================================
'use strict';

// 行動の決め方 (キャラの control)。人が操作するキャラ (input) の番が来たら止まって入力を待つ
//   ほかは自分の番に呼ばれて 1 回行動する。名前で呼ぶ (テストが包めるように)
const CONTROLLERS = {
  input: null,                // 主人公: 入力を待つ (src/player.js が行動して endPlayerAction を呼ぶ)
  ai: (u) => enemyAct(u),     // 敵の AI (src/ai.js)
  wait: () => {},             // 何もしない (テスト用の仲間など)
};

// 行動 1 回ぶんの後始末 (どのキャラも同じ)。次に行動できる時刻を進め、技の再使用待ち (決まりが行動の後のキャラ: 主人公) と強化を 1 進める
function endTurn(u) {
  u.next = Math.max(u.next, game.time) + actionCost(u);
  if (u.skillCd && skillRule(u).tick === 'afterAction') tickCooldowns(u);
  if (u.buffs) tickBuffs(u);
}

// 主人公が行動したあとに呼ぶ。後始末をして、主人公までの経路を作り直し、次に入力が要るまで進める
function endPlayerAction() {
  endTurn(player);
  computeFlow(player.tx, player.ty, flow);
  runUntilInput();
}

// 次に行動するキャラ (next が一番早い。同じ時刻なら主人公、その次は units の順)
function nextUnit() {
  let best = null;
  for (const u of units) {
    if (u.dead) continue;
    if (!best || u.next < best.next || (u.next === best.next && u === player)) best = u;
  }
  return best;
}

// 人が操作するキャラの番が来るまで、早い順にほかのキャラを行動させる
function runUntilInput() {
  for (let guard = 0; guard < 5000; guard++) {
    if (!player || player.dead || game.state !== 'play') return;
    const u = nextUnit();
    if (!u) return;
    advanceTime(u.next);
    if (u.charging) {
      releaseCharge(u); // 予告していた技を出す。これがこの行動 (どの control のキャラも)
    } else {
      const control = CONTROLLERS[u.control];
      if (!control) return; // 入力を待つ
      if (skillRule(u).tick === 'beforeAction') tickCooldowns(u); // 再使用待ちが行動の初めに減るキャラ (敵)
      control(u);
    }
    endTurn(u);
    units = units.filter((o) => !o.dead || o === player);
  }
}

// ゲーム内の時刻を t まで進める (HP・MP の回復・湧き場所・落とし物は経った時間ぶん進む)
function advanceTime(t) {
  const dt = t - game.time;
  if (dt <= 0) return;
  game.time = t;
  // どのキャラも HP再生・MP再生で回復する。主人公の陣営は、攻撃を受けずにしばらくたつと休息の分も回復する (敵に休息はない)
  for (const u of units) {
    if (u.dead) continue;
    const resting = u.faction === 'player' && game.time - u.lastHurt >= PG.restDelay;
    u.hp = Math.min(u.stats.maxHp, u.hp + (u.stats.hpRegen + (resting ? u.stats.maxHp * PG.restRegenRate : 0)) * dt);
    u.mp = Math.min(u.stats.maxMp, u.mp + (u.stats.mpRegen + (resting ? u.stats.maxMp * PG.restMpRegenRate : 0)) * dt);
  }
  updateCamps(dt);
  updateLoots(dt);
}

// これからの行動順 (HUD 用)。主人公の陣営と、画面に入っているか追ってきている敵を、早い順に n 回ぶん並べる
function turnOrder(n) {
  const vw = W / VIEW, vh = H / VIEW;
  const list = units.filter((e) => e.faction !== 'enemy' || e.state === 'chase' ||
    (e.x > cam.x && e.x < cam.x + vw && e.y > cam.y && e.y < cam.y + vh));
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
