// =====================================================================
//  入力と主人公の行動
//  主人公の番のときだけ受け付ける。移動・攻撃・スキル・道具・待機はどれも 1 行動
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
// キー k で使う道具のキー (data/items.js の consumables の key)
const consumableByKey = (k) => Object.keys(ITEMS.consumables).find((id) => ITEMS.consumables[id].key === k);

// 主人公が行動できるか (主人公の番で、画面を開いていない)
const canAct = () => game.state === 'play' && !game.paused && player && !player.dead;

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow') || k === 'tab') e.preventDefault();
  // 保存をやめたタブ (src/save.js の blockSaving) では何もしない (読み込み直すまで遊べない)
  if (saveStore.blocked) return;
  // 画面を開いている間のキーは、その画面のもの (src/ui.js の SCREENS の keys と closeKeys)。フィールドには渡さない
  if (game.state === 'menu') { screenKey(k, e); return; }
  if (game.state !== 'play') return;
  if (k === 'escape' && aiming) { aiming = null; return; }
  if (!e.repeat && (k === 'escape' || k === 'p')) { togglePause(); return; }
  if (!e.repeat && k === 'm') { toggleWorldMap(); return; }
  // 世界地図を出している間は + / - で拡大・縮小
  if (worldMapOn && (k === '+' || k === '=' || k === ';' || e.code === 'NumpadAdd')) { zoomWorldMap(WORLD.worldMap.zoomStep); return; }
  if (worldMapOn && (k === '-' || e.code === 'NumpadSubtract')) { zoomWorldMap(1 / WORLD.worldMap.zoomStep); return; }
  if (game.paused) {
    if (k === 'c') openScreen('char');
    else if (k === 's' && !e.repeat) manualSave();
    return;
  }
  if (!canAct()) return;
  // 押しっぱなしのときは、少し間をあけて次の行動をする
  if (e.repeat && game.rt - game.inputT < TURN.repeatDelay) return;
  const dir = NUMPAD[e.code] || (e.code === 'Numpad5' ? null : MOVE_KEYS[k]);
  player.travel = null;
  if (aiming) {
    if (k === 'enter' || skillByKey(k) === aiming) { castSkill(aiming, mouse.tx, mouse.ty); return; }
    // フィールドで意味のあるキー (移動・待機・I / Tab / F・道具・ほかのスキル) は、狙うのをやめてからふだんどおりにする
    // (ほかのスキルのキーなら、そのスキルに構え直す)。意味のないキーは何もしない (構えたまま)
    const fieldKey = dir || WAIT_KEYS.includes(k) || e.code === 'Numpad5' ||
      (!e.repeat && (k === 'i' || k === 'tab' || k === 'f' || consumableByKey(k) || skillByKey(k)));
    if (!fieldKey) return;
    aiming = null;
  }
  if (dir) { doPlayerAction(() => tryMove(dir[0], dir[1])); return; }
  if (WAIT_KEYS.includes(k) || e.code === 'Numpad5') { doPlayerAction(waitTurn); return; }
  if (e.repeat) return;
  if (k === 'i') { openScreen('inv'); return; }
  if (k === 'tab') { openScreen('char'); return; }
  if (k === 'f') { interact(); return; }
  const item = consumableByKey(k);
  if (item) { doPlayerAction(() => useConsumable(player, item)); return; }
  const sk = skillByKey(k);
  if (sk && !knowsSkill(player, sk)) {
    // まだ覚えていない (はじめの覚え方で覚えるレベルがあれば、それを知らせる)
    logMsg(learnLevelOf(sk) ? txt('skills.locked', { skill: sk.name, level: learnLevelOf(sk) }) : txt('skills.unknown', { skill: sk.name }), THEME.msg.refuse);
  } else if (sk && cooldownLeft(player, sk) > 0) {
    logMsg(txt('skills.cooldown', { skill: sk.name, n: Math.ceil(cooldownLeft(player, sk)) }), THEME.msg.refuse);
  } else if (sk && !enoughMp(player, sk)) {
    logNoMp(sk);
  } else if (sk && sk.type === 'buff') {
    castSkill(sk, player.tx, player.ty); // 強化は狙わずにすぐ使う
  } else if (sk) {
    aiming = sk;
  }
});
window.addEventListener('blur', () => { aiming = null; });
// 世界地図のドラッグ: 押した場所 (x, y) と、動かしたか (moved)。動かさずに離したらクリック (右下と大きくを切り替える)
let worldMapDrag = null;
canvas.addEventListener('mousemove', (e) => {
  if (worldMapDrag) {
    const dx = e.clientX - worldMapDrag.x, dy = e.clientY - worldMapDrag.y;
    if (worldMapDrag.moved || Math.abs(dx) + Math.abs(dy) > 4) { worldMapDrag.moved = true; panWorldMap(dx, dy); worldMapDrag.x = e.clientX; worldMapDrag.y = e.clientY; }
  }
  mouse.x = e.clientX; mouse.y = e.clientY;
  canvas.style.cursor = worldMapDrag && worldMapDrag.moved ? 'grabbing' : hudButtonAt(mouse.x, mouse.y) ? 'pointer' : '';
});
window.addEventListener('mouseup', () => {
  if (worldMapDrag && !worldMapDrag.moved) toggleWorldMapSize();
  worldMapDrag = null;
});
// 世界地図の上でホイール: 拡大・縮小 (カーソルの下の場所を動かさない)
canvas.addEventListener('wheel', (e) => {
  if (game.state !== 'play' || !worldMapOn) return;
  const hb = hudButtonAt(e.clientX, e.clientY);
  if (!hb || hb.id !== 'map') return;
  e.preventDefault();
  zoomWorldMap(e.deltaY < 0 ? WORLD.worldMap.zoomStep : 1 / WORLD.worldMap.zoomStep, e.clientX, e.clientY);
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  // 世界地図を押したら、ドラッグで動かす (動かさずに離せば大きさを切り替える)。主人公の番でなくてもよい
  if (game.state === 'play' && !game.paused && worldMapOn && e.button === 0) {
    const hb = hudButtonAt(e.clientX, e.clientY);
    if (hb && hb.id === 'map') { worldMapDrag = { x: e.clientX, y: e.clientY, moved: false }; return; }
  }
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
  const n = tileSteps(player.tx, player.ty, tx, ty);
  if (n === 0) { doPlayerAction(waitTurn); return; }
  if (n === 1) { doPlayerAction(() => tryMove(tx - player.tx, ty - player.ty)); return; }
  // 通常攻撃が届く敵 (槍。縦・横・斜めにまっすぐ並んだ 1 + 攻撃範囲 マス以内) をクリックしたら、その向きに攻撃する (当たるのはいちばん近い敵)
  const ddx = tx - player.tx, ddy = ty - player.ty, foe = unitAt(tx, ty);
  if (foe && hostileTo(player.faction, foe.faction) && (ddx === 0 || ddy === 0 || Math.abs(ddx) === Math.abs(ddy)) &&
    n <= 1 + Math.floor(player.stats.reach || 0) && reachTarget(player, Math.sign(ddx), Math.sign(ddy))) {
    doPlayerAction(() => tryMove(Math.sign(ddx), Math.sign(ddy)));
    return;
  }
  // 遠くのマス: そこまで 1 歩ずつ歩く (src/main.js の stepTravel)
  const path = findPath(tx, ty);
  if (path) player.travel = path;
});

// 行動する。fn が true を返したら (行動したら) ターンを進める
function doPlayerAction(fn) {
  if (!canAct()) return;
  game.inputT = game.rt;
  if (fn()) endPlayerAction();
}

// 通常攻撃が届く相手と、そこまでのマス: (dx, dy) の向き (縦・横・斜めの 1 歩) に 1 + 攻撃範囲 (stats.reach。槍) マス先まで。
//   当たるのはいちばん近いキャラだけで、それが敵のときだけ { target, tiles } を返す (味方・NPC が手前にいれば届かない)。
//   攻撃を遮る地形 (壁など) の先には届かない。2 マス目からは、斜めに進むとき角を挟む 2 マスが両方とも遮るなら止まる (直線 rayTiles と同じ決まり)
function reachTarget(u, dx, dy) {
  const reach = 1 + Math.max(0, Math.floor(u.stats.reach || 0));
  const tiles = [];
  let x = u.tx, y = u.ty;
  for (let i = 1; i <= reach; i++) {
    const nx = x + dx, ny = y + dy;
    if (isShotBlocked(nx, ny)) return null;
    if (i > 1 && dx && dy && isShotBlocked(nx, y) && isShotBlocked(x, ny)) return null;
    tiles.push([nx, ny]);
    const t = unitAt(nx, ny);
    if (t) return hostileTo(u.faction, t.faction) ? { target: t, tiles } : null;
    if ((zone.npcs || []).some((n) => n.tx === nx && n.ty === ny)) return null;
    x = nx; y = ny;
  }
  return null;
}

// (dx, dy) へ 1 歩。通常攻撃が届く敵がいれば攻撃 (槍なら離れた敵にも)、味方がいれば進めない (行動にならない)、NPC がいれば話しかける
//   walk: クリックで歩いている途中 (離れた敵には攻撃せずに歩く)
function tryMove(dx, dy, walk = false) {
  const p = player, nx = p.tx + dx, ny = p.ty + dy;
  p.facing = Math.atan2(dy, dx);
  const hit = walk ? null : reachTarget(p, dx, dy);
  if (hit) { bumpAttack(hit.target, hit.tiles); return true; }
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

// tiles: 攻撃が通ったマス (槍で離れた敵を突いたときは、間のマスにも演出を出す)
function bumpAttack(e, tiles = [[e.tx, e.ty]]) {
  const p = player;
  p.facing = Math.atan2(e.ty - p.ty, e.tx - p.tx);
  fxTiles(tiles, 'player', FX_THEME.bump.life);
  dealDamage(p, e, BASIC_ATTACK, BASIC_ATTACK.name);
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

const logNoMp = (sk) => logMsg(txt('skills.noMp', { skill: sk.name, cost: skillMp(sk), mp: Math.floor(player.mp) }), THEME.msg.refuse);
