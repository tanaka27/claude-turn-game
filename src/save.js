// =====================================================================
//  セーブ
//  いつもブラウザの localStorage に書き、server.py で起動しているときはサーバー (saves/save.json) にも送る
// =====================================================================
'use strict';

// セーブの形 (v2。くわしくは docs/save.md)
//   { v: 2, savedAt,
//     player:   { level, exp, base, hp, mp, gold, potions, inventory, materials, equip, quests },
//     progress: { kills, time },
//     location: { zone, tx, ty } (マス), home: 倒れたときに戻る町のゾーン }
// 読むときは SAVE_MIGRATIONS で 1 版ずつ今の形に直してから使う (readSave)
// もとのリアルタイム版 (斬界アリーナ) とは別のキーに保存する。同じブラウザで両方遊んでも混ざらない
const SAVE_VERSION = 2;
const SAVE_OLDEST = 1;                       // 読める一番古い形
const SAVE_KEY = 'zankai-turn-save';
const SAVE_UNREAD_KEY = 'zankai-turn-save-unread'; // この版で読めなかったブラウザのセーブの控え
const SAVE_API = 'api/save';

// 形を変えたら SAVE_VERSION を上げ、ここに「1 つ前の形 → 今の形」を 1 つ足す
// SAVE_MIGRATIONS[n]: 形 n のセーブ (コピー) を直して返す。v は呼ぶ側が n + 1 にする
//   ない項目があっても落ちないように書く。今のデータ (QUESTS など) は見ない (あとでデータが変わっても同じ結果になるように)
const SAVE_MIGRATIONS = {
  // v1 → v2: 衛兵隊長のクエストの id を、倒す敵に合わせた名前にした (もとは人の敵だったころの名前)
  1: (d) => {
    const renamed = { goblin: 'c_wolf', archer: 'c_bee', mage: 'c_salamander', king: 'c_wolfKing', ogre: 'c_golem', treant: 'c_treant', warlord: 'c_dragon' };
    const quests = d.player && d.player.quests;
    if (quests && typeof quests === 'object') {
      const out = {};
      for (const id in quests) out[renamed[id] || id] = quests[id];
      d.player.quests = out;
    }
    return d;
  },
};

// server: null (まだ確かめていない) / true (サーバーに保存できる) / false (ブラウザだけ)
// unreachable: サーバーから時間内に返事がなかった (次に保存するときにもう一度確かめる)。probing: 確かめている最中
// cached: 一番新しいセーブ。sending / pending: サーバーへ送っている最中と、その次に送るもの
// problems: 起動時に見つけた、この版で使えないセーブ [{ where: 'local' | 'server', problem: 'newer' | 'broken', v }]
const saveStore = { server: null, unreachable: false, probing: false, error: '', cached: null, sending: false, pending: null, problems: [] };

function buildSave() {
  const p = player;
  // 倒れている間は、戻る町の復活地点にいるものとして保存する
  const home = homeZone(), r = WORLD.zones[home].respawn;
  return {
    v: SAVE_VERSION, savedAt: Date.now(),
    player: { level: p.level, exp: p.exp, base: p.base, hp: p.dead ? null : p.hp, mp: p.dead ? null : p.mp, gold: p.gold, potions: p.potions,
      inventory: p.inventory, materials: p.materials, equip: p.equip, quests: p.quests },
    progress: { kills: game.kills, time: game.time },
    location: p.dead ? { zone: home, tx: tileOf(r.x), ty: tileOf(r.y) } : { zone: zone.id, tx: p.tx, ty: p.ty },
    home,
  };
}

// 保存されていたもの (JSON を読んだもの) を今の形にする。渡されたものは書き換えない
// 戻り値: { save } (使える) / { problem: 'newer' (新しい版のゲームのセーブ) | 'broken' (壊れている・古すぎる), v } / {} (セーブなし)
function readSave(raw) {
  if (raw === null || raw === undefined) return {};
  const v = raw && typeof raw === 'object' ? raw.v : undefined;
  if (!Number.isInteger(v)) return { problem: 'broken' };
  if (v > SAVE_VERSION) return { problem: 'newer', v };
  if (v < SAVE_OLDEST) return { problem: 'broken', v };
  const isObj = (x) => !!x && typeof x === 'object';
  let d;
  try {
    d = JSON.parse(JSON.stringify(raw));
    for (let n = v; n < SAVE_VERSION; n++) {
      d = SAVE_MIGRATIONS[n](d);
      d.v = n + 1;
    }
  } catch (err) {
    console.warn(`セーブ (形 v${v}) を今の形に直せませんでした`, err);
    return { problem: 'broken', v };
  }
  if (!isObj(d.player) || !isObj(d.progress) || !isObj(d.location)) return { problem: 'broken', v };
  // 今はないゾーン (名前を変えた建物など) にいたセーブは、倒れたときに戻る町のかがり火から始める
  if (!WORLD.zones[d.location.zone]) {
    const home = WORLD.zones[d.home] && WORLD.zones[d.home].respawn ? d.home : WORLD.respawnZone, r = WORLD.zones[home].respawn;
    d.location = { ...d.location, zone: home, tx: tileOf(r.x), ty: tileOf(r.y) };
  }
  return { save: d };
}
// 使えないセーブは null
const migrateSave = (raw) => readSave(raw).save || null;

// 作ったばかりの player にセーブの中身を戻す。戻り値: 始める場所と HP・MP
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
  const potions = typeof s.potions === 'number' ? { potion: s.potions } : s.potions || {};
  for (const id in IT.potions) p.potions[id] = clamp(Math.floor(potions[id]) || 0, 0, IT.potions[id].max);
  const home = WORLD.zones[save.home];
  p.home = home && home.safe && home.respawn ? save.home : WORLD.respawnZone;
  const valid = (it) => it && IT.slots[it.slot] && it.stats && Object.keys(it.stats).every((k) => STATS[k]);
  p.inventory = (Array.isArray(s.inventory) ? s.inventory : []).filter(valid).slice(0, EC.inventorySize);
  for (const slot in IT.slots) {
    const it = s.equip && s.equip[slot];
    p.equip[slot] = valid(it) && it.slot === slot ? it : null;
  }
  // 今はない素材は捨てる
  for (const id in s.materials || {}) {
    const n = Math.floor(s.materials[id]);
    if (IT.materials[id] && n > 0) p.materials[id] = n;
  }
  return { ...save.location, hp: s.hp, mp: s.mp };
}

// ----- 保存先: ブラウザ -----
// 戻り値は readSave と同じ。使えないときは、もとの文字列 (raw) も付ける
function readLocal() {
  let raw;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch (err) {
    return {};
  }
  let r;
  try {
    r = readSave(JSON.parse(raw));
  } catch (err) {
    r = { problem: 'broken' };
  }
  return r.problem ? { ...r, raw } : r;
}
const readLocalSave = () => readLocal().save || null;
function writeLocalSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('ブラウザへのセーブに失敗しました', err);
  }
}

// ----- 保存先: サーバー (server.py) -----
// サーバーは { save: セーブ | null } を返す (ファイルが読めないときは unreadable: true も付く)。それ以外 (404 や file:// で開いたとき) はサーバーなしとみなす
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
    if (body.unreadable) return { ok: true, problem: 'broken' }; // saves/save.json はあるが JSON として読めない
    return { ok: true, ...readSave(body.save) };
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
    // サーバーに新しい版のゲームのセーブがあったら、知らせないまま上書きしないように送らない
    if (r.problem === 'newer') { saveStore.problems.push({ where: 'server', problem: r.problem, v: r.v }); return; }
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
// どちらも今の形に直してから比べる。どちらかに新しい版のゲームのセーブがあれば、どちらも使わない (タイトルで知らせる)
async function initSave() {
  const localRead = readLocal();
  const remote = await fetchServerSave();
  saveStore.server = remote.ok;
  saveStore.unreachable = !!remote.unreachable;
  saveStore.problems = [];
  if (localRead.problem) {
    saveStore.problems.push({ where: 'local', problem: localRead.problem, v: localRead.v });
    // 読めなかったブラウザのセーブは、あとで上書きされても残るように別のキーに写しておく
    try { localStorage.setItem(SAVE_UNREAD_KEY, localRead.raw); } catch (err) { /* 写せなくても続ける */ }
  }
  if (remote.ok && remote.problem) saveStore.problems.push({ where: 'server', problem: remote.problem, v: remote.v });
  const newer = saveStore.problems.some((q) => q.problem === 'newer');
  const local = newer ? null : localRead.save || null;
  const server = newer || !remote.ok ? null : remote.save || null;
  const at = (s) => (Number.isFinite(s.savedAt) ? s.savedAt : 0);
  let best = local;
  if (server && (!local || at(server) >= at(local))) best = server;
  saveStore.cached = best;
  // ブラウザにしかない (またはブラウザのほうが新しい) セーブは、サーバーにも送っておく (サーバーに読めないセーブがあるときは送らない)
  if (remote.ok && !remote.problem && best && best === local && (!server || at(local) > at(server))) sendServerSave(local);
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

// タイトルに出す、この版で使えなかったセーブの説明 (なければ '')
function saveProblemText() {
  const ps = saveStore.problems;
  if (!ps.length) return '';
  const where = (q) => (q.where === 'server' ? 'サーバー（saves/save.json）' : 'ブラウザ');
  const newer = ps.find((q) => q.problem === 'newer');
  if (newer) {
    return `${where(newer)}のセーブデータは新しい版のゲームで保存されたもの（形 v${newer.v}。この版は v${SAVE_VERSION} まで）なので、この版では読めません。続きは新しい版のゲームで遊んでください。` +
      '「はじめから」を選ぶとセーブデータが上書きされます（上書きする前の控えは残します）。';
  }
  const names = ps.map(where).join('と');
  if (saveStore.cached) return `${names}のセーブデータは壊れているか古すぎて読めなかったので、もう一方のセーブを使います（控えを残して上書きします）。`;
  return `${names}にセーブデータがありますが、壊れているか古すぎて読めませんでした。「はじめから」を選ぶと上書きされます（上書きする前の控えは残します）。`;
}

// 一時停止画面・タイトルに出す、保存先の説明
function saveWhereText() {
  if (!saveStore.server && saveStore.problems.some((q) => q.where === 'server' && q.problem === 'newer')) {
    return 'サーバーに新しい版のゲームのセーブがあるため、サーバーには保存していません。ブラウザには保存しています。';
  }
  if (!saveStore.server && saveStore.unreachable) return 'サーバーから返事がありません。ブラウザには保存しています（次の保存でもう一度サーバーを試します）。';
  if (!saveStore.server) return '進行はブラウザ（localStorage）に自動で保存されています。サーバーにも保存するには python server.py で起動してください。';
  if (saveStore.error) return `サーバーに保存できませんでした（${saveStore.error}）。ブラウザには保存しています。`;
  return '進行はサーバー（saves/save.json）とブラウザに自動で保存されています。そのままブラウザを閉じても大丈夫です。';
}
