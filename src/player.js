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
// キー k に置いたスキル (主人公のスキル欄 player.skillSlots から。覚えていないスキルも返す)
const skillByKey = (k) => (skillSlotsOf(player).find((b) => b.key === k) || {}).sk;
const potionByKey = (k) => Object.keys(IT.potions).find((id) => IT.potions[id].key === k);

// 主人公が行動できるか (主人公の番で、画面を開いていない)
const canAct = () => game.state === 'play' && !game.paused && player && !player.dead;

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow') || k === 'tab') e.preventDefault();
  // 画面を開いている間のキーは、その画面のもの (src/ui.js の SCREENS の keys と closeKeys)。フィールドには渡さない
  if (game.state === 'menu') { screenKey(k, e); return; }
  if (game.state !== 'play') return;
  if (k === 'escape' && aiming) { aiming = null; return; }
  if (!e.repeat && (k === 'escape' || k === 'p')) { togglePause(); return; }
  if (!e.repeat && k === 'm') { toggleWorldMap(); return; }
  if (game.paused) { if (k === 'c') openScreen('char'); return; }
  if (!canAct()) return;
  // 押しっぱなしのときは、少し間をあけて次の行動をする
  if (e.repeat && game.rt - game.inputT < TN.repeatDelay) return;
  const dir = NUMPAD[e.code] || (e.code === 'Numpad5' ? null : MOVE_KEYS[k]);
  player.travel = null;
  if (aiming) {
    if (k === 'enter' || skillByKey(k) === aiming) { castSkill(aiming, mouse.tx, mouse.ty); return; }
    if (dir || WAIT_KEYS.includes(k)) aiming = null; // 動いたら狙うのをやめる
    else return;
  }
  if (dir) { act(() => tryMove(dir[0], dir[1])); return; }
  if (WAIT_KEYS.includes(k) || e.code === 'Numpad5') { act(waitTurn); return; }
  if (e.repeat) return;
  if (k === 'i') { openScreen('inv'); return; }
  if (k === 'tab') { openScreen('char'); return; }
  if (k === 'f') { interact(); return; }
  const potion = potionByKey(k);
  if (potion) { act(() => usePotion(potion)); return; }
  const sk = skillByKey(k);
  if (sk && !knowsSkill(player, sk)) {
    // まだ覚えていない (はじめの覚え方で覚えるレベルがあれば、それを知らせる)
    log(learnLevelOf(sk) ? `${sk.name}は Lv${learnLevelOf(sk)} で使えるようになる。` : `${sk.name}はまだ覚えていない。`, '#9da7b3');
  } else if (sk && cooldownLeft(player, sk) > 0) {
    log(`${sk.name}はあと ${Math.ceil(cooldownLeft(player, sk))} 行動で使える。`, '#9da7b3');
  } else if (sk && !enoughMp(player, sk)) {
    logNoMp(sk);
  } else if (sk && sk.type === 'buff') {
    castSkill(sk, player.tx, player.ty); // 強化は狙わずにすぐ使う
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
    if (hb.id === 'items') openScreen('inv'); else if (hb.id === 'char') openScreen('char'); else if (hb.id === 'map') toggleWorldMap();
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

// (dx, dy) へ 1 歩。敵がいれば攻撃、味方がいれば進めない (行動にならない)、NPC がいれば話しかける
function tryMove(dx, dy) {
  const p = player, nx = p.tx + dx, ny = p.ty + dy;
  p.facing = Math.atan2(dy, dx);
  const u = unitAt(nx, ny);
  if (u && hostileTo(p.faction, u.faction)) { bumpAttack(u); return true; }
  if (u) return false;
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

// スキルを (tx, ty) のマスへ向けて使う。使うのはどのキャラも同じ useSkill (src/combat.js)
// ここは主人公だけのこと: 狙うのをやめる、入力の時刻、MP が足りないときの文、使えたら主人公の行動を終える
function castSkill(sk, tx, ty) {
  aiming = null;
  if (!canAct() || cooldownLeft(player, sk) > 0) return;
  if (!enoughMp(player, sk)) { logNoMp(sk); return; }
  game.inputT = game.rt;
  if (useSkill(player, sk, tx, ty)) endPlayerAction();
}

const logNoMp = (sk) => log(`MP が足りない（${sk.name}は MP ${skillMp(sk)}、今 ${Math.floor(player.mp)}）。`, '#9da7b3');
