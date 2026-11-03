// =====================================================================
//  セーブ
//  いつもブラウザの localStorage に書き、server.py で起動しているときはサーバー (saves/save.json) にも送る
// =====================================================================
'use strict';

// セーブの形 (v1)
//   { v: 1, savedAt,
//     player:   { level, exp, base, hp, gold, potions, inventory, materials, equip, quests },
//       base: 成長で上がったステータス { maxHp, str, vit, agi, int } (ないセーブはレベルの目安の値にする)
//     progress: { kills, time },
//     location: { zone, tx, ty } (マス) }
// もとのリアルタイム版 (斬界アリーナ) とは別のキーに保存する。同じブラウザで両方遊んでも混ざらない
const SAVE_VERSION = 1;
const SAVE_KEY = 'zankai-turn-save';
const SAVE_API = 'api/save';

// server: null (まだ確かめていない) / true (サーバーに保存できる) / false (ブラウザだけ)
// unreachable: サーバーから時間内に返事がなかった (次に保存するときにもう一度確かめる)。probing: 確かめている最中
// cached: 一番新しいセーブ。sending / pending: サーバーへ送っている最中と、その次に送るもの
const saveStore = { server: null, unreachable: false, probing: false, error: '', cached: null, sending: false, pending: null };

function buildSave() {
  const p = player;
  // 倒れている間は、復活地点にいるものとして保存する
  const r = WORLD.zones[WORLD.respawnZone].respawn;
  return {
    v: SAVE_VERSION, savedAt: Date.now(),
    player: { level: p.level, exp: p.exp, base: p.base, hp: p.dead ? null : p.hp, gold: p.gold, potions: p.potions,
      inventory: p.inventory, materials: p.materials, equip: p.equip, quests: p.quests },
    progress: { kills: game.kills, time: game.time },
    location: p.dead ? { zone: WORLD.respawnZone, tx: tileOf(r.x), ty: tileOf(r.y) } : { zone: zone.id, tx: p.tx, ty: p.ty },
  };
}

// 読めないセーブは null
function migrateSave(d) {
  if (!d || typeof d !== 'object') return null;
  if (d.v !== SAVE_VERSION || !d.player || !d.progress || !d.location || !WORLD.zones[d.location.zone]) return null;
  return d;
}

// 作ったばかりの player にセーブの中身を戻す。戻り値: 始める場所と HP
function applySave(save) {
  const s = save.player, p = player;
  p.level = clamp(Math.floor(s.level) || 1, 1, PG.maxLevel);
  p.exp = Math.max(0, s.exp || 0);
  // 成長した値: ない・おかしい・目安から離れすぎているものは、そのレベルの目安にする
  p.base = growthBase(p.level);
  for (const k in p.base) {
    const v = s.base && s.base[k];
    if (Number.isFinite(v) && Math.abs(v - p.base[k]) < PG.growth[k].spread * PG.growthResetMult) p.base[k] = Math.round(v);
  }
  game.kills = save.progress.kills || 0;
  game.time = Math.max(0, save.progress.time || 0);
  for (const id in s.quests || {}) {
    const st = s.quests[id];
    if (questById(id) && st && ['active', 'ready', 'claimed'].includes(st.state)) p.quests[id] = { state: st.state, count: st.count || 0 };
  }
  p.gold = Math.max(0, s.gold || 0);
  p.potions = clamp(s.potions || 0, 0, IT.potion.max);
  const valid = (it) => it && IT.slots[it.slot] && it.stats && Object.keys(it.stats).every((k) => STATS[k]);
  p.inventory = (s.inventory || []).filter(valid).slice(0, EC.inventorySize);
  for (const slot in IT.slots) {
    const it = s.equip && s.equip[slot];
    p.equip[slot] = valid(it) && it.slot === slot ? it : null;
  }
  // 今はない素材は捨てる
  for (const id in s.materials || {}) {
    const n = Math.floor(s.materials[id]);
    if (IT.materials[id] && n > 0) p.materials[id] = n;
  }
  return { ...save.location, hp: s.hp };
}

// ----- 保存先: ブラウザ -----
function readLocalSave() {
  try {
    return migrateSave(JSON.parse(localStorage.getItem(SAVE_KEY)));
  } catch (err) {
    return null;
  }
}
function writeLocalSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('ブラウザへのセーブに失敗しました', err);
  }
}

// ----- 保存先: サーバー (server.py) -----
// サーバーは { save: セーブ | null } を返す。それ以外 (404 や file:// で開いたとき) はサーバーなしとみなす
// 時間内に返事がないときやつながらないときは unreachable: true (サーバーはあるかもしれない)
async function fetchServerSave() {
  if (location.protocol === 'file:') return { ok: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), P.save.serverTimeout * 1000);
  let res;
  try {
    res = await fetch(SAVE_API, { cache: 'no-store', signal: ctrl.signal });
  } catch (err) {
    clearTimeout(timer);
    console.warn('サーバーからセーブを読めませんでした', err);
    return { ok: false, unreachable: true };
  }
  clearTimeout(timer);
  try {
    const body = res.ok ? await res.json() : null;
    if (!body || !('save' in body)) return { ok: false };
    return { ok: true, save: migrateSave(body.save) };
  } catch (err) {
    return { ok: false };
  }
}
// 起動時にサーバーから返事がなかったとき、保存のついでにもう一度確かめ、つながったら今のセーブを送る
function retryServer() {
  if (saveStore.probing) return;
  saveStore.probing = true;
  fetchServerSave().then((r) => {
    saveStore.probing = false;
    saveStore.unreachable = !!r.unreachable;
    if (!r.ok) return;
    saveStore.server = true;
    if (saveStore.cached) sendServerSave(saveStore.cached);
  });
}
// 送っている最中なら、終わってから一番新しいものだけを送る。ページを閉じるとき (unloading) は待たずに送る
function sendServerSave(data, unloading) {
  if (!saveStore.server) return;
  if (saveStore.sending && !unloading) { saveStore.pending = data; return; }
  saveStore.sending = true;
  fetch(SAVE_API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: !!unloading })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      saveStore.error = '';
    })
    .catch((err) => {
      saveStore.error = String(err.message || err);
      console.warn('サーバーへのセーブに失敗しました', err);
    })
    .finally(() => {
      saveStore.sending = false;
      const next = saveStore.pending;
      saveStore.pending = null;
      if (next) sendServerSave(next);
    });
}

// 起動時に 1 回: ブラウザとサーバーのセーブのうち新しいほうを使う
async function initSave() {
  const local = readLocalSave();
  const remote = await fetchServerSave();
  saveStore.server = remote.ok;
  saveStore.unreachable = !!remote.unreachable;
  let best = local;
  if (remote.ok && remote.save && (!local || remote.save.savedAt >= local.savedAt)) best = remote.save;
  saveStore.cached = best;
  // ブラウザにしかない (またはブラウザのほうが新しい) セーブは、サーバーにも送っておく
  if (remote.ok && best && best === local && (!remote.save || local.savedAt > remote.save.savedAt)) sendServerSave(local);
}

function saveGame(unloading) {
  if (!player || !zone || game.state === 'title') return;
  const data = buildSave();
  saveStore.cached = data;
  writeLocalSave(data);
  if (!saveStore.server && saveStore.unreachable && !unloading) retryServer();
  sendServerSave(data, unloading);
  game.saveT = P.save.interval;
}
const loadSave = () => saveStore.cached;

// 一時停止画面・タイトルに出す、保存先の説明
function saveWhereText() {
  if (!saveStore.server && saveStore.unreachable) return 'サーバーから返事がありません。ブラウザには保存しています（次の保存でもう一度サーバーを試します）。';
  if (!saveStore.server) return '進行はブラウザ（localStorage）に自動で保存されています。サーバーにも保存するには python server.py で起動してください。';
  if (saveStore.error) return `サーバーに保存できませんでした（${saveStore.error}）。ブラウザには保存しています。`;
  return '進行はサーバー（saves/save.json）とブラウザに自動で保存されています。そのままブラウザを閉じても大丈夫です。';
}
