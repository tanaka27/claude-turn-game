// =====================================================================
//  クエスト
// =====================================================================
'use strict';

// ----- クエスト -----
// player.quests[id] = { state: 'active' (受けている) | 'ready' (報告できる) | 'claimed' (報告済み), count }
//   count: 目標の種類が数えるもの (kill: 倒した数 / talk: 話しかけたら 1 / collect: 使わない (持っている数で決まる))
//   くり返し受けられるクエスト (repeatable) は、報告すると記録を消す (また 'available' になる)
const questById = (id) => QUESTS.find((q) => q.id === id);
const npcById = (id) => Object.values(WORLD.zones).flatMap((z) => z.npcs || []).find((n) => n.id === id);
const enemyName = (type) => ENEMIES[type].name;

// ----- クエストの目標の種類 (data/quests.js の goal.kind)。新しい種類はここに 1 つ足す (docs/quests.md) -----
//   on: { イベント名: (goal, st, ...イベントの引数) } 受けている ('active') ときにそのイベントで st を進める (questEvent が呼ぶ)
//   progress(goal, st): 今の数 / need(goal): 目標の数 (省略時 goal.count)
//   text(goal): 内容の文 / short(goal): キャラクターの画面で数の前に書く名前 / activeHint: 受けているときの詳細の案内
//   claim(goal): 報告したとき (渡すものを減らすなど。省略可) / check(goal): データの食い違いの文の並び (validateData が調べる)
const countOk = (goal) => (Number.isInteger(goal.count) && goal.count >= 1 ? [] : ['目標の count は 1 以上の整数にする']);
const QUEST_GOALS = {
  // 倒す: 受けたあとに倒した数 (どのゾーンで倒してもよい)
  kill: {
    on: { kill: (goal, st, u) => { if (u.type === goal.enemy) st.count++; } },
    progress: (goal, st) => st.count,
    text: (goal) => `${enemyName(goal.enemy)}を ${goal.count} 体倒す`,
    short: (goal) => enemyName(goal.enemy),
    activeHint: '受けている（倒した数は受けたあとから数える）',
    check: (goal) => [...(ENEMIES[goal.enemy] ? [] : [`敵 '${goal.enemy}' が data/enemies.js にない`]), ...countOk(goal)],
  },
  // 集める: 今持っている素材の数 (受ける前から持っている分も数える)。売って足りなくなると 'ready' から 'active' に戻る。報告すると count 個渡す
  collect: {
    on: { materials: () => {} },
    progress: (goal) => player.materials[goal.material] || 0,
    text: (goal) => `${IT.materials[goal.material].name}を ${goal.count} 個集める`,
    short: (goal) => IT.materials[goal.material].name,
    activeHint: '受けている（持っている数で数える。報告すると渡す）',
    claim: (goal) => {
      player.materials[goal.material] -= goal.count;
      if (!player.materials[goal.material]) delete player.materials[goal.material];
    },
    check: (goal) => [...(IT.materials[goal.material] ? [] : [`素材 '${goal.material}' が data/items.js の materials にない`]), ...countOk(goal)],
  },
  // 話しかける: 受けたあとに NPC (world.js の id) に話しかける
  talk: {
    on: { talk: (goal, st, n) => { if (n.id === goal.npc) st.count = 1; } },
    progress: (goal, st) => st.count,
    need: () => 1,
    text: (goal) => `${npcById(goal.npc).name}と話す`,
    short: (goal) => `${npcById(goal.npc).name}と話す`,
    activeHint: '受けている（話しかけると報告できる）',
    check: (goal) => (npcById(goal.npc) ? [] : [`NPC '${goal.npc}' が world.js にない`]),
  },
};
const goalKind = (q) => QUEST_GOALS[q.goal.kind];
const questNeed = (q) => (goalKind(q).need ? goalKind(q).need(q.goal) : q.goal.count);
const questProgress = (q) => goalKind(q).progress(q.goal, player.quests[q.id]);
// 進み具合の文「3 / 8」(目標の数で止める)
const progressText = (q) => `${Math.min(questProgress(q), questNeed(q))} / ${questNeed(q)}`;

// 'locked' (前のクエストがまだ) / 'lowLevel' / 'available' / 'active' / 'ready' / 'claimed'
function questStatus(q) {
  const st = player.quests[q.id];
  if (st) return st.state;
  if (q.requires && (!player.quests[q.requires] || player.quests[q.requires].state !== 'claimed')) return 'locked';
  return player.level < q.minLevel ? 'lowLevel' : 'available';
}

// NPC の頭上の印: 報告できるクエストがあれば '?'、まだ受けたことのない (くり返しでない) クエストを受けられれば '!'
function npcMark(n) {
  if (n.role !== 'quest' || !player) return '';
  const qs = QUESTS.filter((q) => q.giver === n.id);
  if (qs.some((q) => questStatus(q) === 'ready')) return '?';
  return qs.some((q) => !q.repeatable && questStatus(q) === 'available') ? '!' : '';
}

// 目標に届いていれば 'active' → 'ready' (画面に知らせる)、届かなくなれば 'ready' → 'active' (集めるで売ったときなど。知らせない)
function settleQuest(q) {
  const st = player.quests[q.id];
  if (!st || (st.state !== 'active' && st.state !== 'ready')) return;
  const done = questProgress(q) >= questNeed(q);
  if (st.state === 'active' && done) {
    st.state = 'ready';
    showMsg('クエスト達成！', `「${q.name}」を${npcById(q.giver).name}に報告しよう`);
  } else if (st.state === 'ready' && !done) st.state = 'active';
}
// ゲームの出来事を受けているクエストに伝える。ev: 'kill' (敵を倒した。引数は敵) / 'materials' (素材の数が変わった: 拾う・売る・報告で渡す) /
//   'talk' (NPC に話しかけた。引数は NPC)。その ev を on に持つ種類のクエストだけを進め、達成を確かめる
function questEvent(ev, ...args) {
  for (const q of QUESTS) {
    const st = player.quests[q.id], h = goalKind(q).on[ev];
    if (!st || !h) continue;
    if (st.state === 'active') h(q.goal, st, ...args);
    settleQuest(q);
  }
}

function rewardText(r) {
  const parts = [];
  if (r.exp) parts.push(`経験値 ${r.exp}`);
  if (r.gold) parts.push(`${r.gold} G`);
  for (const c of r.consumables || []) parts.push(`${IT.consumables[c.id].name} ×${c.count}`);
  if (r.item) parts.push(`${rarityOf(r.item.rarity).name}の${IT.slots[r.item.slot].label}`);
  return parts.join('、');
}

function claimQuest(q) {
  const p = player, r = q.reward;
  if (r.item && p.inventory.length >= EC.inventorySize) { questNote = '持ち物がいっぱいで受け取れない'; return; }
  if (q.repeatable) delete player.quests[q.id];
  else player.quests[q.id].state = 'claimed';
  if (goalKind(q).claim) { goalKind(q).claim(q.goal); questEvent('materials'); }
  p.gold += r.gold || 0;
  // 道具は持てる数 (max) まで。超えた分はもらえない
  for (const c of r.consumables || []) p.consumables[c.id] = Math.min(IT.consumables[c.id].max, consumableCount(p, c.id) + c.count);
  if (r.item) p.inventory.push(makeItem(r.item.slot, p.level, r.item.rarity));
  questNote = `「${q.name}」の報酬を受け取った: ${rewardText(r)}`;
  if (r.exp) gainExp(r.exp, p.x, p.y); // レベルアップの表示が最後に出るように
}

// ----- クエストの画面 (依頼の一覧から選び、右で内容を見て受ける・報告する) -----
// questSel: 選んでいるクエストの id
let questNpc = null, questNote = '', questSel = null;

const QUEST_TAG = { available: '受けられる', active: '受けている', ready: '報告できる', claimed: '報告済み' };
// 一覧に出すクエスト (前のクエストがまだのものは出さない)。報告できる → 受けている → 受けられる → レベル不足 → 報告済み の順
function questEntries() {
  const order = ['ready', 'active', 'available', 'lowLevel', 'claimed'];
  return QUESTS.filter((q) => q.giver === questNpc.id).map((q) => ({ q, st: questStatus(q) }))
    .filter(({ st }) => st !== 'locked')
    .sort((a, b) => order.indexOf(a.st) - order.indexOf(b.st));
}

function renderQuest() {
  $('questTitle').textContent = questNpc.name;
  const list = questEntries();
  if (!list.some(({ q }) => q.id === questSel)) questSel = list.length ? list[0].q.id : null;
  $('questNote').textContent = questNote;
  $('questList').innerHTML = list.map(({ q, st }) => {
    const sub = st === 'lowLevel' ? `Lv${q.minLevel} から` :
      st === 'active' ? `${QUEST_TAG[st]}　${progressText(q)}` : QUEST_TAG[st];
    return `<div class="qitem q-${st}${q.id === questSel ? ' sel' : ''}" data-qid="${q.id}">
      <b>${q.name}</b>${q.repeatable ? '<i class="qrep">くり返し</i>' : ''}<span>${sub}</span></div>`;
  }).join('') || '<p class="hint">今は頼みたいことはない。</p>';
  const cur = list.find(({ q }) => q.id === questSel);
  if (!cur) { $('questDetail').innerHTML = ''; return; }
  const { q, st } = cur, prog = player.quests[q.id];
  const goal = goalKind(q).text(q.goal) + (prog && st !== 'claimed' ? `　${progressText(q)}` : '');
  const btn = st === 'available' ? `<button data-act="accept" data-id="${q.id}">この依頼を受ける（Enter）</button>` :
    st === 'ready' ? `<button data-act="claim" data-id="${q.id}">報告する（Enter）</button>` :
    st === 'lowLevel' ? `<p class="hint">Lv${q.minLevel} になると受けられる</p>` :
    st === 'active' ? `<p class="hint">${goalKind(q).activeHint}</p>` : '<p class="hint">報告済み</p>';
  $('questDetail').innerHTML = `<h3>${q.name}</h3><p>${q.desc}</p>
    <dl><dt>内容</dt><dd>${goal}</dd><dt>場所</dt><dd>${q.where}</dd><dt>報酬</dt><dd class="qreward">${rewardText(q.reward)}</dd>
    ${q.repeatable ? '<dt>種類</dt><dd>くり返し受けられる</dd>' : ''}</dl>${btn}`;
}

// 選んでいるクエストを受ける・報告する
function questAction(q) {
  if (!q) return;
  const st = questStatus(q);
  if (st === 'available') {
    player.quests[q.id] = { state: 'active', count: 0 };
    questNote = `「${q.name}」を受けた`;
    settleQuest(q); // 集めるクエストは、もう持っていればすぐ報告できる
  } else if (st === 'ready') claimQuest(q);
  else return;
  renderQuest();
  saveGame();
}

// ↑↓ で一覧の選択を動かす
function moveQuestSel(d) {
  const list = questEntries();
  if (!list.length) return;
  const i = list.findIndex(({ q }) => q.id === questSel);
  questSel = list[clamp(i + d, 0, list.length - 1)].q.id;
  renderQuest();
  const el = document.querySelector('#questList .sel');
  if (el) el.scrollIntoView({ block: 'nearest' });
}

// クエストの画面 (role: 'quest' の NPC に話しかけて開く。arg: その NPC)。画面の登録表は src/ui.js の SCREENS
// ↑↓ で選び、Enter・ボタンで受ける・報告する。F でも閉じる
registerScreen('quest', {
  overlay: 'quest', render: renderQuest, closeKeys: ['f'],
  open: (n) => { questNpc = n; questNote = ''; questSel = null; },
  keys: (k, e) => {
    if (k === 'arrowup' || k === 'arrowdown') { moveQuestSel(k === 'arrowup' ? -1 : 1); return true; }
    if (k === 'enter' && !e.repeat) { questAction(questById(questSel)); return true; }
    return false;
  },
  actions: {
    close: () => closeMenu(),
    accept: (btn) => questAction(questById(btn.dataset.id)),
    claim: (btn) => questAction(questById(btn.dataset.id)),
  },
  click: (e) => {
    const item = e.target.closest('[data-qid]');
    if (item) { questSel = item.dataset.qid; renderQuest(); }
  },
});
