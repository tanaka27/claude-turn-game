// =====================================================================
//  ゲームの開始・メインループ
//  ゲーム内の時間は主人公が行動したときだけ進む (src/turn.js)。ここでは毎フレーム、描画と演出を進める
// =====================================================================
'use strict';

// save があれば続きから、なければはじめから
function startGame(save) {
  player = createPlayer();
  zone = null;
  for (const k in zoneMemory) delete zoneMemory[k];
  logLines.length = 0;
  for (const k in shopStocks) delete shopStocks[k];
  Object.assign(game, { state: 'play', paused: false, kills: 0, time: 0, shake: 0, saveT: PARAMS.save.interval });
  const start = WORLD.zones[WORLD.start].respawn;
  const at = save ? applySave(save) : { zone: WORLD.start, tx: tileOf(start.x), ty: tileOf(start.y), hp: null, mp: null };
  player.stats = computeStats(player);
  player.hp = Number.isFinite(at.hp) && at.hp > 0 ? Math.min(at.hp, player.stats.maxHp) : player.stats.maxHp;
  player.mp = Number.isFinite(at.mp) ? clamp(at.mp, 0, player.stats.maxMp) : player.stats.maxMp;
  player.next = game.time;
  enterZone(at.zone, at.tx, at.ty);
  if (!save) showMsg(txt('title.start'), zone.name);
  for (const id of ['title', 'pause', ...Object.values(SCREENS).map((s) => s.overlay)]) $(id).classList.remove('show');
  saveGame();
}

// タイトル画面: セーブがあれば「続きから」を出す。この版で読めないセーブがあればその説明も出す
function refreshTitle() {
  const save = loadSave();
  $('continueBtn').style.display = save ? '' : 'none';
  $('startBtn').className = save ? 'secondary' : '';
  $('startBtn').disabled = false;
  if (save) $('continueBtn').textContent = txt('title.continue', { level: save.player.level, zone: WORLD.zones[save.location.zone].name });
  $('saveInfo').textContent = [saveProblemText(), saveWhereText()].filter(Boolean).join(' ');
}
// どちらも、遊び始める前にほかのタブの保存をやめさせ、セーブを読み直す (claimSave。古いタブの読み込みで新しい進行を上書きしないため)
// 読み直したセーブでタイトルを出し直し、「続きから」はその一番新しいセーブから始める
let titleBusy = false;
async function fromTitle(start) {
  if (titleBusy) return;
  titleBusy = true;
  try {
    await claimSave();
    if (saveStore.blocked || game.state !== 'title') return;
    refreshTitle();
    start();
  } finally {
    titleBusy = false;
  }
}
$('continueBtn').onclick = () => fromTitle(() => { const save = loadSave(); if (save) startGame(save); });
$('startBtn').onclick = () => fromTitle(() => {
  if (loadSave() && !confirm(txt('title.confirmRestart'))) return;
  if (!loadSave() && saveStore.problems.length && !confirm(txt('title.confirmOverwrite'))) return;
  startGame(null);
});
validateData();
loadZone(WORLD.start);
// セーブ (ブラウザとサーバー) を確かめてから、タイトルのボタンを使えるようにする
initSave().then(refreshTitle);
window.addEventListener('beforeunload', () => { if (['play', 'menu'].includes(game.state)) saveGame(true); });

// クリックした遠くのマスへ 1 歩ずつ歩く。敵に気づかれたり、予告の範囲に入りそうになったら止まる
function stepTravel() {
  const p = player;
  if (!p.travel || !canAct() || aiming || game.rt - game.inputT < TURN.travelDelay) return;
  const danger = units.some((e) => hostileTo(p.faction, e.faction) && e.state === 'chase' && hasLOS(e.tx, e.ty, p.tx, p.ty));
  const [nx, ny] = p.travel[0];
  const hot = hazards.some((h) => h.keys.has(tileKey(nx, ny)));
  if (danger || hot || !isFree(nx, ny)) {
    p.travel = null;
    if (danger) logMsg(txt('title.travelStop'), THEME.msg.alert);
    return;
  }
  p.travel.shift();
  if (!p.travel.length) p.travel = null;
  doPlayerAction(() => tryMove(nx - p.tx, ny - p.ty, true));
}

function updateWorld(dt) {
  stepTravel();
  if (game.state === 'dying') {
    game.dyingT -= dt;
    if (game.dyingT <= 0) respawnPlayer();
  }
  game.saveT -= dt;
  if (game.saveT <= 0 && game.state === 'play') saveGame();
}

function updateFx(dt) {
  // 描く位置を、いるマスへ近づける
  const k = 1 - Math.exp(-dt / TURN.animTime * 3);
  for (const u of units) {
    const tx = tileCenter(u.tx), ty = tileCenter(u.ty);
    if (Math.hypot(tx - u.x, ty - u.y) > TILE * 8) { u.x = tx; u.y = ty; }
    u.x += (tx - u.x) * k; u.y += (ty - u.y) * k;
    u.hitFlash = Math.max(0, u.hitFlash - dt);
  }
  for (const f of effects) {
    f.t += dt;
    const d = EFFECT_TYPES[f.type]; // 動く演出 (火花など) は種類の update で動かす (src/render.js)
    if (d && d.update) d.update(f, dt);
  }
  effects = effects.filter((f) => f.t < f.life);
  for (const t of floatTexts) { t.t += dt; t.y += t.vy * dt; t.vy *= 0.94; }
  floatTexts = floatTexts.filter((t) => t.t < t.life);
  game.shake = Math.max(0, game.shake - dt * 30);
  game.msgT -= dt;
}

function updateMouseTile() {
  mouse.wx = camera.x + mouse.x / VIEW_SCALE;
  mouse.wy = camera.y + mouse.y / VIEW_SCALE;
  mouse.tx = tileOf(mouse.wx);
  mouse.ty = tileOf(mouse.wy);
}

function updateCamera() {
  const vw = VIEW_W / VIEW_SCALE, vh = VIEW_H / VIEW_SCALE;
  const tx = player ? player.x : MAP_W / 2, ty = player ? player.y : MAP_H / 2;
  // 下端はスキル欄に隠れないよう、その高さ分だけマップの外まで映せるようにする
  const mh = MAP_H + 110 / VIEW_SCALE;
  camera.x = MAP_W > vw ? clamp(tx - vw / 2, 0, MAP_W - vw) : (MAP_W - vw) / 2;
  camera.y = mh > vh ? clamp(ty - vh / 2, 0, mh - vh) : (mh - vh) / 2;
  updateMouseTile();
}

// ===================================================================
//  メインループ
// ===================================================================
let lastFrameTime = performance.now();
function frame(now) {
  // 先に次フレームを予約し、万一例外が出てもループが止まらないようにする
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  game.rt += dt;
  try {
    updateCamera();
    if ((game.state === 'play' || game.state === 'dying') && !game.paused) updateWorld(dt);
    if (!game.paused && game.state !== 'menu') updateFx(dt);
    render();
  } catch (err) {
    console.error(err);
  }
}
requestAnimationFrame(frame);

// デバッグ用
window.__game = { game, saveStore, get player() { return player; }, get units() { return units; }, get enemies() { return factionUnits('enemy'); } };
