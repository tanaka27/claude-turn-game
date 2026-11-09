// =====================================================================
//  入力と主人公の行動
//  主人公の番のときだけ受け付ける。移動・攻撃・スキル・回復薬・待機はどれも 1 行動
// =====================================================================
'use strict';

// 移動キー → 向き (WASD / 矢印 / QEZC で斜め / テンキー)
const MOVE_KEYS = {
  w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
  q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1],
};
const NUMPAD = { Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1] };
const WAIT_KEYS = [' ', '.'];
const skillByKey = (k) => SKILLS.find((s) => s.key === k);
const potionByKey = (k) => Object.keys(IT.potions).find((id) => IT.potions[id].key === k);

// 主人公が行動できるか (主人公の番で、画面を開いていない)
const canAct = () => game.state === 'play' && !game.paused && player && !player.dead;

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow') || k === 'tab') e.preventDefault();
  if (game.state === 'menu') {
    // 会話: F / Enter / スペースで次の言葉へ (最後なら閉じる)
    if (menu.mode === 'talk' && !e.repeat && (k === 'f' || k === 'enter' || k === ' ')) { nextTalk(); return; }
    // クエストの画面: ↑↓ で選び、Enter で受ける・報告する
    if (menu.mode === 'quest' && (k === 'arrowup' || k === 'arrowdown')) { moveQuestSel(k === 'arrowup' ? -1 : 1); return; }
    if (menu.mode === 'quest' && k === 'enter' && !e.repeat) { questAction(questById(questSel)); return; }
    if (!e.repeat && (k === 'escape' || (k === 'i' && menu.mode === 'inv') || ((k === 'c' || k === 'tab') && menu.mode === 'char') ||
      (k === 'f' && (menu.mode === 'shop' || menu.mode === 'smith' || menu.mode === 'quest')))) closeMenu();
    return;
  }
  if (game.state !== 'play') return;
  if (k === 'escape' && aiming) { aiming = null; return; }
  if (!e.repeat && (k === 'escape' || k === 'p')) { togglePause(); return; }
  if (!e.repeat && k === 'm') { toggleWorldMap(); return; }
  if (game.paused) { if (k === 'c') openMenu('char'); return; }
  if (!canAct()) return;
  // 押しっぱなしのときは、少し間をあけて次の行動をする
  if (e.repeat && game.rt - game.inputT < TN.repeatDelay) return;
  const dir = NUMPAD[e.code] || (e.code === 'Numpad5' ? null : MOVE_KEYS[k]);
  player.travel = null;
  if (aiming) {
    if (k === 'enter' || k === aiming.key) { castSkill(aiming, mouse.tx, mouse.ty); return; }
    if (dir || WAIT_KEYS.includes(k)) aiming = null; // 動いたら狙うのをやめる
    else return;
  }
  if (dir) { act(() => tryMove(dir[0], dir[1])); return; }
  if (WAIT_KEYS.includes(k) || e.code === 'Numpad5') { act(waitTurn); return; }
  if (e.repeat) return;
  if (k === 'i') { openMenu('inv'); return; }
  if (k === 'tab') { openMenu('char'); return; }
  if (k === 'f') { interact(); return; }
  const potion = potionByKey(k);
  if (potion) { act(() => usePotion(potion)); return; }
  const sk = skillByKey(k);
  if (sk && player.level < sk.unlockLevel) {
    log(`${sk.name}は Lv${sk.unlockLevel} で使えるようになる。`, '#9da7b3');
  } else if (sk && player.skillCd[sk.key] > 0) {
    log(`${sk.name}はあと ${Math.ceil(player.skillCd[sk.key])} 行動で使える。`, '#9da7b3');
  } else if (sk && !enoughMp(sk)) {
    logNoMp(sk);
  } else if (sk) {
    aiming = sk;
  }
});
window.addEventListener('blur', () => { aiming = null; });
canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  canvas.style.cursor = hudButtonAt(mouse.x, mouse.y) ? 'pointer' : '';
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (!canAct()) return;
  if (e.button === 2) { aiming = null; player.travel = null; return; }
  if (e.button !== 0) return;
  // HUD のボタン (左上の仲間の欄、画面下の「道具」、右下の地図) を押したら、マスへの操作はしない
  const hb = hudButtonAt(e.clientX, e.clientY);
  if (hb) {
    if (hb.id === 'items') openMenu('inv'); else if (hb.id === 'char') openMenu('char'); else if (hb.id === 'map') toggleWorldMap();
    return;
  }
  updateMouseTile();
  if (aiming) { castSkill(aiming, mouse.tx, mouse.ty); return; }
  const { tx, ty } = mouse;
  const n = steps(player.tx, player.ty, tx, ty);
  if (n === 0) { act(waitTurn); return; }
  if (n === 1) { act(() => tryMove(tx - player.tx, ty - player.ty)); return; }
  // 遠くのマス: そこまで 1 歩ずつ歩く (src/main.js の stepTravel)
  const path = findPath(tx, ty);
  if (path) player.travel = path;
});

// 行動する。fn が true を返したら (行動したら) ターンを進める
function act(fn) {
  if (!canAct()) return;
  game.inputT = game.rt;
  if (fn()) endPlayerAction();
}

// (dx, dy) へ 1 歩。敵がいれば攻撃、NPC がいれば話しかける
function tryMove(dx, dy) {
  const p = player, nx = p.tx + dx, ny = p.ty + dy;
  p.facing = Math.atan2(dy, dx);
  const u = unitAt(nx, ny);
  if (u && !u.isPlayer) { bumpAttack(u); return true; }
  const npc = (zone.npcs || []).find((n) => n.tx === nx && n.ty === ny);
  if (npc) { talkTo(npc); return false; }
  if (!canStep(p.tx, p.ty, dx, dy)) return false;
  moveUnitTo(p, nx, ny);
  pickUpAt(nx, ny);
  checkGate();
  return true;
}

function bumpAttack(e) {
  const p = player;
  p.facing = Math.atan2(e.ty - p.ty, e.tx - p.tx);
  effects.push({ type: 'tiles', tiles: [[e.tx, e.ty]], t: 0, life: 0.25, faction: 'player' });
  dealDamage(p, e, BASIC, BASIC.name);
}

function waitTurn() { return true; }

// スキルを (tx, ty) のマスへ向けて使う
function castSkill(sk, tx, ty) {
  const p = player;
  aiming = null;
  if (!canAct() || p.skillCd[sk.key] > 0) return;
  if (!enoughMp(sk)) { logNoMp(sk); return; }
  game.inputT = game.rt;
  if (sk.type === 'dash') {
    if (!dash(sk, tx, ty)) return;
  } else {
    const h = planAttack(p, sk, tx, ty);
    p.facing = h.dir;
    log(`${sk.name}！`, '#80d8ff');
    resolveAttack(h);
  }
  p.skillCd[sk.key] = skillCooldown(sk);
  p.mp = Math.max(0, p.mp - skillMp(sk));
  endPlayerAction();
}

// MP が足りるか (MP は小数で回復していくので、表示と同じく切り捨てで比べる)
const enoughMp = (sk) => Math.floor(player.mp + 1e-9) >= skillMp(sk);
const logNoMp = (sk) => log(`MP が足りない（${sk.name}は MP ${skillMp(sk)}、今 ${Math.floor(player.mp)}）。`, '#9da7b3');

// ダッシュ: 狙ったマスの向き (8 方向) へ、ふさがるまで distance マス一気に進む。進めなければ false
function dash(sk, tx, ty) {
  const p = player;
  const a = Math.atan2(ty - p.ty, tx - p.tx);
  const oct = Math.round(a / (Math.PI / 4));
  const dx = Math.round(Math.cos(oct * Math.PI / 4)), dy = Math.round(Math.sin(oct * Math.PI / 4));
  if (tx === p.tx && ty === p.ty) return false;
  let moved = 0;
  for (let i = 0; i < sk.distance; i++) {
    if (!canStep(p.tx, p.ty, dx, dy) || !isFree(p.tx + dx, p.ty + dy)) break;
    effects.push({ type: 'ghost', x: center(p.tx), y: center(p.ty), r: p.r, t: 0, life: 0.25, color: p.color });
    moveUnitTo(p, p.tx + dx, p.ty + dy);
    pickUpAt(p.tx, p.ty);
    moved++;
    if (gateAt[idx(p.tx, p.ty)] >= 0) break;
  }
  if (!moved) { log('その方向には進めない。', '#9da7b3'); return false; }
  checkGate();
  return true;
}
