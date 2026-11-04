// =====================================================================
//  クエスト
// =====================================================================
'use strict';

// ----- クエスト -----
// player.quests[id] = { state: 'active' (受けている) | 'ready' (報告できる) | 'claimed' (報告済み), count }
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

// NPC の頭上の印: 報告できるクエストがあれば '?'、受けられるクエストがあれば '!'
function npcMark(n) {
  if (n.role !== 'quest' || !player) return '';
  const st = QUESTS.filter((q) => q.giver === n.id).map(questStatus);
  return st.includes('ready') ? '?' : st.includes('available') ? '!' : '';
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
  player.quests[q.id].state = 'claimed';
  p.gold += r.gold || 0;
  p.potions.potion = Math.min(IT.potions.potion.max, (p.potions.potion || 0) + (r.potions || 0));
  if (r.item) p.inventory.push(makeItem(r.item.slot, p.level, r.item.rarity));
  questNote = `「${q.name}」の報酬を受け取った: ${rewardText(r)}`;
  if (r.exp) gainExp(r.exp, p.x, p.y); // レベルアップの表示が最後に出るように
}

let questNpc = null, questNote = '';
function openQuest(n) {
  game.state = 'menu';
  aiming = null;
  menu.mode = 'quest';
  questNpc = n;
  questNote = '';
  renderQuest();
  $('quest').classList.add('show');
}

function renderQuest() {
  const tag = { available: '受けられる', active: '受けている', ready: '報告できる', claimed: '報告済み', lowLevel: '' };
  $('questTitle').textContent = questNpc.name;
  const list = QUESTS.filter((q) => q.giver === questNpc.id).map((q) => ({ q, st: questStatus(q) }))
    .filter(({ st }) => st !== 'locked');
  // 報告できる → 受けている → 受けられる → レベル不足 → 報告済み の順
  const order = ['ready', 'active', 'available', 'lowLevel', 'claimed'];
  list.sort((a, b) => order.indexOf(a.st) - order.indexOf(b.st));
  $('questList').innerHTML = (questNote ? `<p class="note">${questNote}</p>` : '') + (list.map(({ q, st }) => {
    const prog = player.quests[q.id];
    const goal = `${enemyName(q.target)}を ${q.count} 体倒す（${q.where}）` + (prog && st !== 'claimed' ? `　${Math.min(prog.count, q.count)} / ${q.count}` : '');
    const btn = st === 'available' ? `<button data-act="accept" data-id="${q.id}">受ける</button>` :
      st === 'ready' ? `<button data-act="claim" data-id="${q.id}">報告する</button>` : '';
    const label = st === 'lowLevel' ? `Lv${q.minLevel} から` : tag[st];
    return `<div class="quest q-${st}"><div class="qhead"><b>${q.name}</b><span class="qtag">${label}</span>${btn}</div>
      ${st === 'claimed' ? '' : `<p>${q.desc}</p><div class="qgoal">${goal}</div><div class="qreward">報酬: ${rewardText(q.reward)}</div>`}</div>`;
  }).join('') || '<p class="hint">今は頼みたいことはない。</p>');
}

$('quest').addEventListener('click', (e) => {
  if (game.state !== 'menu' || menu.mode !== 'quest') return;
  const act = e.target.closest('[data-act]');
  if (!act) return;
  if (act.dataset.act === 'close') { closeMenu(); return; }
  const q = questById(act.dataset.id);
  if (!q) return;
  if (act.dataset.act === 'accept' && questStatus(q) === 'available') {
    player.quests[q.id] = { state: 'active', count: 0 };
    questNote = `「${q.name}」を受けた`;
  } else if (act.dataset.act === 'claim' && questStatus(q) === 'ready') {
    claimQuest(q);
  }
  renderQuest();
  saveGame();
});
