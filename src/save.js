// =====================================================================
//  セーブ
//  いつもブラウザの localStorage に書き、server.py で起動しているときはサーバー (saves/save.json) にも送る
// =====================================================================
'use strict';

// セーブの形 (v8。くわしくは docs/save-format.md)
//   { v: 8, savedAt,
//     player:   { level, exp, base, potential, hp, mp, gold, consumables, inventory, materials, equip, quests, knownSkills },
//     progress: { kills, time },
//     location: { zone, tx, ty } (マス), home: 倒れたときに戻る町のゾーン }
// 読むときは SAVE_MIGRATIONS で 1 版ずつ今の形に直してから使う (readSave)
// もとのリアルタイム版 (斬界アリーナ) とは別のキーに保存する。同じブラウザで両方遊んでも混ざらない
const SAVE_VERSION = 8;
const SAVE_OLDEST = 1;                       // 読める一番古い形
const SAVE_KEY = 'zankai-turn-save';
const SAVE_UNREAD_KEY = 'zankai-turn-save-unread'; // この版で読めなかったブラウザのセーブの控え
const SAVE_API = 'api/save';
const SAVE_CHANNEL = 'zankai-turn-save'; // 同じブラウザのほかのタブに「このタブで遊び始めた」と知らせる BroadcastChannel の名前

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
  // v2 → v3: 覚えたスキルの id (player.knownSkills) を足した。v2 まではレベルで自動で覚えるだけだったので、
  //   v2 のころの決まり (下の表。data/player.js の learnAtLevel と同じだったもの) で保存したレベルから埋める
  2: (d) => {
    const atLevel = { shockwave: 1, whirlwind: 3, meteor: 6, dash: 1, battleAura: 1 };
    if (d.player && typeof d.player === 'object') {
      const lv = Math.floor(d.player.level) || 1;
      d.player.knownSkills = Object.keys(atLevel).filter((id) => lv >= atLevel[id]);
    }
    return d;
  },
  // v3 → v4: 回復薬の数 player.potions を、道具の数 player.consumables ({ 道具のキー: 数 }) にした。キーと数はそのまま
  //   v1 より前のセーブは数だけ (回復薬 potion の数) のことがあるので、それも直す。数でもオブジェクトでもなければ空
  3: (d) => {
    if (d.player && typeof d.player === 'object') {
      const old = d.player.potions;
      d.player.consumables = typeof old === 'number' ? { potion: old } : old && typeof old === 'object' && !Array.isArray(old) ? old : {};
      delete d.player.potions;
    }
    return d;
  },
  // v4 → v5: ステータスが行動で伸びるようになり、潜在 player.potential と熟練度 player.train を足した
  //   成長した値 base はそのまま。潜在・熟練度は空にしておき、読むとき (applySave) にはじめの値で埋める
  4: (d) => {
    if (d.player && typeof d.player === 'object') {
      if (!d.player.potential || typeof d.player.potential !== 'object') d.player.potential = {};
      if (!d.player.train || typeof d.player.train !== 'object') d.player.train = {};
    }
    return d;
  },
  // v5 → v6: 熟練度 player.train をやめ、能力値 base を小数で持つようにした。熟練度は v5 で 10 たまると +1 だったので、
  //   その分 (熟練度 / 10) を base に足して消す
  5: (d) => {
    const p = d.player;
    if (p && typeof p === 'object') {
      if (p.base && typeof p.base === 'object' && p.train && typeof p.train === 'object') {
        for (const k in p.train) if (Number.isFinite(p.base[k]) && Number.isFinite(p.train[k]) && p.train[k] > 0) p.base[k] += p.train[k] / 10;
      }
      delete p.train;
    }
    return d;
  },
  // v6 → v7: さいだいHP・さいだいMP が行動で伸びるのをやめ、体力 + 意思・(知力 wis + 精神力) ÷ 2 で決まるようにした
  //   伸びた さいだいHP h は 意思 = h の整数部分の半分 (切り捨て)・体力 = 残り (小数も) に分ける (一の位までで同じ さいだいHP になる)
  //   さいだいMP はそのまま 知力・精神力 の両方にする。潜在も さいだいHP の分を 体力・意思 に、さいだいMP の分を 知力・精神力 に写す
  6: (d) => {
    const p = d.player;
    if (!p || typeof p !== 'object') return d;
    const b = p.base && typeof p.base === 'object' ? p.base : null;
    const pot = p.potential && typeof p.potential === 'object' ? p.potential : null;
    if (b && Number.isFinite(b.maxHp)) {
      b.will = Math.floor(Math.floor(b.maxHp) / 2);
      b.con = b.maxHp - b.will;
    }
    if (b && Number.isFinite(b.maxMp)) b.wis = b.spi = b.maxMp;
    const to = { maxHp: ['con', 'will'], maxMp: ['wis', 'spi'] };
    for (const old in to) {
      if (pot && Number.isFinite(pot[old])) for (const k of to[old]) pot[k] = pot[old];
      if (b) delete b[old];
      if (pot) delete pot[old];
    }
    return d;
  },
  // v7 → v8: 知力 wis をやめ、かしこさ int を 知力 にした (さいだいMP = (int + 精神力) ÷ 2)。
  //   精神力 に wis − int を足して、(int + 精神力) が前の (wis + 精神力) と同じになるようにし (同じ さいだいMP)、wis を消す
  //   (足すと Lv1 の値より小さくなるときは、読むとき applySave が Lv1 の値まで上げる)。潜在の wis は消す
  7: (d) => {
    const p = d.player;
    if (!p || typeof p !== 'object') return d;
    const b = p.base && typeof p.base === 'object' ? p.base : null;
    if (b && Number.isFinite(b.wis) && Number.isFinite(b.spi) && Number.isFinite(b.int)) b.spi += b.wis - b.int;
    if (b) delete b.wis;
    if (p.potential && typeof p.potential === 'object') delete p.potential.wis;
    return d;
  },
};

// タブの名前 (でたらめな 16 進の文字)。ゲームの乱数 (Math.random) は使わない
function newTabName() {
  const bytes = new Uint8Array(8);
  if (typeof crypto === 'object' && crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = (Date.now() * (i + 7)) & 255;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
// server: null (まだ確かめていない) / true (サーバーに保存できる) / false (ブラウザだけ)
// unreachable: サーバーから時間内に返事がなかった (次に保存するときにもう一度確かめる)。probing: 確かめている最中
// cached: 一番新しいセーブ。sending / pending: サーバーへ送っている最中と、その次に送るもの
// problems: 起動時に見つけた、この版で使えないセーブ [{ where: 'local' | 'server', problem: 'newer' | 'broken', v }]
// waiters: pending を送り終わるのを待っている保存 (saveGame の Promise)
// localOk: 最後のブラウザへの保存ができたか。tab: このタブの名前 (サーバーが、どのタブが書いたセーブかを見分ける)
// serverBase: このタブが読んだときのサーバーのセーブの savedAt (なければ null)。サーバーは、これが今のセーブと違い、
//   ほかのタブが書いたセーブなら書き込まない (409。古いタブで新しい進行を上書きしないため)
// blocked: ほかのタブで遊び始めた ('otherTab') / サーバーにほかのタブの新しいセーブがあった ('conflict') ので、このタブでは保存しない
const saveStore = { server: null, unreachable: false, probing: false, error: '', cached: null, sending: false, pending: null, waiters: [], problems: [],
  localOk: true, lastSaved: null, tab: newTabName(), serverBase: null, blocked: '' };
const savedAtOf = (s) => (s && Number.isFinite(s.savedAt) ? s.savedAt : null);

function buildSave() {
  const p = player;
  // 倒れている間は、戻る町の復活地点にいるものとして保存する
  const home = homeZone(), r = WORLD.zones[home].respawn;
  return {
    v: SAVE_VERSION, savedAt: Date.now(),
    player: { level: p.level, exp: p.exp, base: p.base, potential: p.potential, hp: p.dead ? null : p.hp, mp: p.dead ? null : p.mp, gold: p.gold, consumables: p.consumables,
      inventory: p.inventory, materials: p.materials, equip: p.equip, quests: p.quests, knownSkills: p.knownSkills },
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
  p.level = clamp(Math.floor(s.level) || 1, 1, PROGRESSION.maxLevel);
  p.exp = Math.max(0, s.exp || 0);
  // 伸びた値 (小数のまま): ない・数でないものは Lv1 の値、Lv1 の値〜上限 (max) に収める
  // 潜在: ない・数でないものははじめの値、下限〜上限に収める
  p.base = startBase();
  p.potential = startPotential();
  const num = (o, k) => (o && typeof o === 'object' && Number.isFinite(o[k]) ? o[k] : undefined);
  for (const k in GROWTH.stats) {
    const S = GROWTH.stats[k], b = num(s.base, k), pot = num(s.potential, k);
    if (b !== undefined) p.base[k] = clamp(b, PLAYER.stats[k], S.max);
    if (pot !== undefined) p.potential[k] = clampPotential(pot);
  }
  // 数でない (文字列など) ・負の値は 0 にする (ゲーム内の時刻が NaN になると行動順が壊れる)
  const count = (x) => (Number.isFinite(x) && x > 0 ? x : 0);
  game.kills = Math.floor(count(save.progress.kills));
  game.time = count(save.progress.time);
  for (const id in s.quests || {}) {
    const st = s.quests[id];
    if (questById(id) && st && ['active', 'ready', 'claimed'].includes(st.state)) p.quests[id] = { state: st.state, count: st.count || 0 };
  }
  p.gold = Math.max(0, s.gold || 0);
  // 道具: 今はない道具は捨て、持てる数 (max) までにする
  const owned = s.consumables && typeof s.consumables === 'object' ? s.consumables : {};
  for (const id in ITEMS.consumables) p.consumables[id] = clamp(Math.floor(owned[id]) || 0, 0, ITEMS.consumables[id].max);
  const home = WORLD.zones[save.home];
  p.home = home && home.safe && home.respawn ? save.home : WORLD.respawnZone;
  const valid = (it) => it && ITEMS.slots[it.slot] && it.stats && Object.keys(it.stats).every((k) => STATS[k]);
  p.inventory = (Array.isArray(s.inventory) ? s.inventory : []).filter(valid).slice(0, ECON.inventorySize);
  for (const slot in ITEMS.slots) {
    const it = s.equip && s.equip[slot];
    p.equip[slot] = valid(it) && it.slot === slot ? it : null;
  }
  // 今はない素材は捨てる
  for (const id in s.materials || {}) {
    const n = Math.floor(s.materials[id]);
    if (ITEMS.materials[id] && n > 0) p.materials[id] = n;
  }
  // 覚えたスキル: 今はないスキルは捨て、はじめの覚え方 (レベル) でそのレベルなら覚えているはずのものは足す
  p.knownSkills = [];
  for (const id of Array.isArray(s.knownSkills) ? s.knownSkills : []) teachSkill(p, id);
  learnSkillsByLevel(p);
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
// 書けたら true。書けなかった (容量がいっぱい・ブラウザの設定で使えないなど) ら false で、保存先の説明にも出す
function writeLocalSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    saveStore.localOk = true;
  } catch (err) {
    console.warn('ブラウザへのセーブに失敗しました', err);
    saveStore.localOk = false;
  }
  return saveStore.localOk;
}

// ----- 保存先: サーバー (server.py) -----
// サーバーは { save: セーブ | null } を返す (ファイルが読めないときは unreadable: true も付く)。それ以外 (404 や file:// で開いたとき) はサーバーなしとみなす
// 時間内に返事がないときやつながらないときは unreachable: true (サーバーはあるかもしれない)
async function fetchServerSave() {
  if (location.protocol === 'file:') return { ok: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PARAMS.save.serverTimeout * 1000);
  // 待ち時間は本文を読み終わるまで (返事の頭だけ来て本文が届かないときも、時間が来たらブラウザだけに切り替える)
  let res, body;
  try {
    res = await fetch(SAVE_API, { cache: 'no-store', signal: ctrl.signal });
    body = res.ok ? await res.json() : null;
  } catch (err) {
    clearTimeout(timer);
    // 時間切れ・つながらない (AbortError / TypeError) はサーバーがあるかもしれない。本文が JSON でないときはサーバーなし
    if (err && err.name === 'SyntaxError') return { ok: false };
    console.warn('サーバーからセーブを読めませんでした', err);
    return { ok: false, unreachable: true };
  }
  clearTimeout(timer);
  if (!body || typeof body !== 'object' || !('save' in body)) return { ok: false };
  // saves/save.json はあるが JSON として読めない
  if (body.unreadable) return { ok: true, problem: 'broken', savedAt: null };
  return { ok: true, savedAt: savedAtOf(body.save), ...readSave(body.save) };
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
    saveStore.serverBase = r.savedAt;
    if (saveStore.cached) sendServerSave(saveStore.cached);
  });
}
// 送っている最中なら、終わってから一番新しいものだけを送る。ページを閉じるとき (unloading) は待たずに送る
// 戻り値: そのセーブ (送るまでにもっと新しいセーブが来たらそちら) を送り終わったときの結果で終わる Promise
//   'ok' (書けた) / 'error' (書けなかった) / 'conflict' (ほかのタブの新しいセーブがあった) / 'none' (サーバーなし・保存をやめた)
function sendServerSave(data, unloading) {
  if (!saveStore.server || saveStore.blocked) return Promise.resolve('none');
  return new Promise((resolve) => {
    if (saveStore.sending && !unloading) {
      saveStore.pending = data;
      saveStore.waiters.push(resolve);
      return;
    }
    putServerSave(data, unloading, [resolve]);
  });
}
function putServerSave(data, unloading, waiters) {
  saveStore.sending = true;
  // tab と base はサーバーが競合を見分けるためのもの (サーバーは base を捨て、tab は書いたタブとして残す)
  const body = { ...data, tab: saveStore.tab, base: saveStore.serverBase };
  fetch(SAVE_API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: !!unloading })
    .then((res) => {
      if (res.status === 409) return 'conflict';
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      saveStore.error = '';
      return 'ok';
    })
    .catch((err) => {
      saveStore.error = String(err.message || err);
      console.warn('サーバーへのセーブに失敗しました', err);
      return 'error';
    })
    .then((result) => {
      saveStore.sending = false;
      if (result === 'conflict') blockSaving('conflict');
      for (const w of waiters) w(result);
      const next = saveStore.pending, more = saveStore.waiters;
      saveStore.pending = null;
      saveStore.waiters = [];
      if (next && !saveStore.blocked) putServerSave(next, false, more);
      else for (const w of more) w(saveStore.blocked ? 'conflict' : 'none');
    });
}

// このタブでは保存しないようにして、画面で知らせる (reason: 'otherTab' | 'conflict')。読み込み直すまで続く
function blockSaving(reason) {
  if (saveStore.blocked) return;
  saveStore.blocked = reason;
  console.warn(`このタブでは保存をやめました (${reason})`);
  showSaveBlocked(reason);
}
// ほかのタブで「続きから」「はじめから」を選んだら、このタブ (タイトルでも遊んでいる最中でも) は保存をやめる
const saveChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(SAVE_CHANNEL) : null;
if (saveChannel) {
  saveChannel.onmessage = (e) => {
    if (e.data && e.data.type === 'claim' && e.data.tab !== saveStore.tab) blockSaving('otherTab');
  };
}
// 遊び始める前に: ほかのタブに知らせて保存をやめさせ、少し待ってから (ほかのタブの最後の保存が終わるように) セーブを読み直す
// (タイトルを開いたあとにほかのタブで進めた分を、古い読み込みで上書きしないため)
async function claimSave() {
  if (saveChannel) {
    saveChannel.postMessage({ type: 'claim', tab: saveStore.tab });
    await new Promise((r) => setTimeout(r, PARAMS.save.claimWait * 1000));
  }
  if (!saveStore.blocked) await initSave();
}

// 起動時に 1 回: ブラウザとサーバーのセーブのうち新しいほうを使う
// どちらも今の形に直してから比べる。どちらかに新しい版のゲームのセーブがあれば、どちらも使わない (タイトルで知らせる)
async function initSave() {
  const localRead = readLocal();
  const remote = await fetchServerSave();
  saveStore.server = remote.ok;
  saveStore.unreachable = !!remote.unreachable;
  saveStore.serverBase = remote.ok ? remote.savedAt : null;
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

// 保存する (自動のセーブも、一時停止画面の「セーブ」も同じ)
// 戻り値: 保存が終わったときに { local: ブラウザに書けたか, server: sendServerSave の結果 } で終わる Promise
//   (保存しなかったとき (タイトル・保存をやめたタブ) は { local: false, server: 'none', skipped: true })
function saveGame(unloading) {
  if (!player || !zone || game.state === 'title' || saveStore.blocked) return Promise.resolve({ local: false, server: 'none', skipped: true });
  const data = buildSave();
  saveStore.cached = data;
  const local = writeLocalSave(data);
  if (!saveStore.server && saveStore.unreachable && !unloading) retryServer();
  game.saveT = PARAMS.save.interval;
  return sendServerSave(data, unloading).then((server) => {
    // どこにも保存できなくなったら、ログにも 1 回出す (保存できるようになったらまた出せる)
    const saved = local || server === 'ok';
    if (!saved && saveStore.lastSaved !== false && server !== 'conflict') logMsg(txt('save.failedLog'), THEME.msg.refuse);
    saveStore.lastSaved = saved;
    return { local, server };
  });
}
// 一時停止画面の「セーブ」で出す、結果の文
function saveResultText(r) {
  if (r.skipped || r.server === 'conflict') return saveWhereText();
  if (r.server === 'ok') return txt(r.local ? 'save.doneBoth' : 'save.doneServerOnly');
  if (!r.local) return txt('save.doneNowhere');
  if (r.server === 'error') return txt('save.doneLocalServerError', { error: saveStore.error });
  return txt('save.doneLocal');
}
const loadSave = () => saveStore.cached;

// タイトルに出す、この版で使えなかったセーブの説明 (なければ '')
function saveProblemText() {
  const ps = saveStore.problems;
  if (!ps.length) return '';
  const where = (q) => (q.where === 'server' ? txt('save.whereServer') : txt('save.whereLocal'));
  const newer = ps.find((q) => q.problem === 'newer');
  if (newer) {
    return txt('save.newer', { where: where(newer), v: newer.v, max: SAVE_VERSION });
  }
  const names = ps.map(where).join(txt('save.whereSep'));
  if (saveStore.cached) return txt('save.brokenOther', { where: names });
  return txt('save.broken', { where: names });
}

// 一時停止画面・タイトルに出す、保存先の説明
function saveWhereText() {
  if (saveStore.blocked) return txt(saveStore.blocked === 'conflict' ? 'save.blockedConflict' : 'save.blockedOtherTab');
  const serverOk = saveStore.server && !saveStore.error;
  // ブラウザに書けないとき: サーバーに書けていればそう出し、どちらにも書けなければ保存されていないと出す
  if (!saveStore.localOk) return txt(serverOk ? 'save.serverOnly' : 'save.nowhere');
  if (!saveStore.server && saveStore.problems.some((q) => q.where === 'server' && q.problem === 'newer')) {
    return txt('save.serverNewer');
  }
  if (!saveStore.server && saveStore.unreachable) return txt('save.unreachable');
  if (!saveStore.server) return txt('save.browserOnly');
  if (saveStore.error) return txt('save.serverError', { error: saveStore.error });
  return txt('save.both');
}
