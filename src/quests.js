// =====================================================================
//  クエスト
// =====================================================================
'use strict';

// ----- クエスト -----
// player.quests[id] = { state: 'active' (受けている) | 'ready' (報告できる) | 'claimed' (報告済み), count }
//   くり返し受けられるクエスト (repeatable) は、報告すると記録を消す (また 'available' になる)
const questById = (id) => QUESTS.find((q) => q.id === id);
const npcById = (id) => Object.values(WORLD.zones).flatMap((z) => z.npcs || []).find((n) => n.id === id);
const enemyName = (type) => ENEMIES[type].name;

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

function questKill(u) {
  for (const q of QUESTS) {
    const st = player.quests[q.id];
    if (!st || st.state !== 'active' || q.target !== u.type) continue;
    st.count++;
    if (st.count >= q.count) {
      st.state = 'ready';
      showMsg('クエスト達成！', `「${q.name}」を${npcById(q.giver).name}に報告しよう`);
    }
  }
}

function rewardText(r) {
  const parts = [];
  if (r.exp) parts.push(`経験値 ${r.exp}`);
  if (r.gold) parts.push(`${r.gold} G`);
  if (r.potions) parts.push(`${IT.potions.potion.name} ×${r.potions}`);
  if (r.item) parts.push(`${rarityOf(r.item.rarity).name}の${IT.slots[r.item.slot].label}`);
  return parts.join('、');
}

function claimQuest(q) {
  const p = player, r = q.reward;
  if (r.item && p.inventory.length >= EC.inventorySize) { questNote = '持ち物がいっぱいで受け取れない'; return; }
  if (q.repeatable) delete player.quests[q.id];
  else player.quests[q.id].state = 'claimed';
  p.gold += r.gold || 0;
  p.potions.potion = Math.min(IT.potions.potion.max, (p.potions.potion || 0) + (r.potions || 0));
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
    const prog = player.quests[q.id];
    const sub = st === 'lowLevel' ? `Lv${q.minLevel} から` :
      st === 'active' ? `${QUEST_TAG[st]}　${Math.min(prog.count, q.count)} / ${q.count}` : QUEST_TAG[st];
    return `<div class="qitem q-${st}${q.id === questSel ? ' sel' : ''}" data-qid="${q.id}">
      <b>${q.name}</b>${q.repeatable ? '<i class="qrep">くり返し</i>' : ''}<span>${sub}</span></div>`;
  }).join('') || '<p class="hint">今は頼みたいことはない。</p>';
  const cur = list.find(({ q }) => q.id === questSel);
  if (!cur) { $('questDetail').innerHTML = ''; return; }
  const { q, st } = cur, prog = player.quests[q.id];
  const goal = `${enemyName(q.target)}を ${q.count} 体倒す` + (prog && st !== 'claimed' ? `　${Math.min(prog.count, q.count)} / ${q.count}` : '');
  const btn = st === 'available' ? `<button data-act="accept" data-id="${q.id}">この依頼を受ける（Enter）</button>` :
    st === 'ready' ? `<button data-act="claim" data-id="${q.id}">報告する（Enter）</button>` :
    st === 'lowLevel' ? `<p class="hint">Lv${q.minLevel} になると受けられる</p>` :
    st === 'active' ? '<p class="hint">受けている（倒した数は受けたあとから数える）</p>' : '<p class="hint">報告済み</p>';
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
