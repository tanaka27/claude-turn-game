// クエストの目標の種類 (src/quests.js の QUEST_GOALS。docs/quests.md): 倒す (kill)・集める (collect)・話しかける (talk)。
// 集める・話しかけるは今のクエストには使っていないので、テストの中でクエストを足して (defineQuest) 確かめる
'use strict';
const assert = require('assert');
const {
  newGame, arena, step, press, textOf, htmlOf, openScreen, questRows, clickQuestRow, clickButton, nextToNpc, fillInventory, dropAt,
  defineQuest, questState, npcMarkOf, bigMessage, dataProblems, plain,
} = require('./helpers');

function openNpc(g, id) { nextToNpc(g, id); press(g, 'f'); }
// クエストの画面を開いて id を選ぶ
function openQuest(g, giver, id) { openNpc(g, giver); clickQuestRow(g, id); }
// キャラクターの画面の左上 (受けているクエスト) の中身
function profile(g) {
  press(g, 'Tab');
  const html = htmlOf(g, 'profile');
  press(g, 'Tab');
  return html;
}
// 素材 id を n 個、落とし物から拾う (本物の拾う道を通す)
function pickUp(g, id, n) {
  arena(g, { cols: 10, rows: 10, player: [4, 4] });
  dropAt(g, 5, 4, { kind: 'material', id, amount: n });
  step(g, 1, 0);
}
// 商人で素材 id を 1 つ売る
function sellOne(g, id) {
  openNpc(g, 'merchant');
  clickButton(g, 'menu', 'sellMat', { mat: id });
  press(g, 'Escape');
}
const pelts = (g) => g.player.materials.wolfPelt || 0;

test('倒す (kill): 今のクエストの文は今までどおり (詳細・一覧・キャラクターの画面)', () => {
  const g = newGame();
  openNpc(g, 'captain');
  assert.ok(htmlOf(g, 'questDetail').includes('<dt>内容</dt><dd>ウルフを 8 体倒す</dd>'), '受ける前は数を出さない');
  press(g, 'Enter');
  assert.ok(htmlOf(g, 'questDetail').includes('<dt>内容</dt><dd>ウルフを 8 体倒す　0 / 8</dd>'));
  assert.ok(htmlOf(g, 'questDetail').includes('受けている（倒した数は受けたあとから数える）'));
  assert.ok(htmlOf(g, 'questList').includes('<span>受けている　0 / 8</span>'));
  press(g, 'f');
  g.player.quests.c_wolf.count = 3;
  assert.ok(profile(g).includes('<div class="row"><span>ウルフ退治</span><span>ウルフ 3 / 8</span></div>'));
  g.player.quests.c_wolf = { state: 'ready', count: 8 };
  assert.ok(profile(g).includes('<div class="row"><span>ウルフ退治</span><span class="up">衛兵隊長に報告</span></div>'));
  assert.strictEqual(npcMarkOf(g, 'captain'), '?');
});

test('集める (collect): 持っている数で進み、数に届くと報告できる。売って足りなくなると受けているに戻る', () => {
  const g = newGame();
  defineQuest(g, { id: 't_pelt', name: '毛皮集め', goal: { kind: 'collect', material: 'wolfPelt', count: 3 }, reward: { gold: 10 } });
  pickUp(g, 'wolfPelt', 1);
  openQuest(g, 'guildClerk', 't_pelt');
  assert.ok(htmlOf(g, 'questDetail').includes('<dd>狼の毛皮を 3 個集める</dd>'));
  press(g, 'Enter');
  assert.strictEqual(questState(g, 't_pelt'), 'active');
  assert.ok(htmlOf(g, 'questDetail').includes('<dd>狼の毛皮を 3 個集める　1 / 3</dd>'), '受ける前から持っている分も数える');
  assert.ok(htmlOf(g, 'questDetail').includes('受けている（持っている数で数える。報告すると渡す）'));
  assert.ok(htmlOf(g, 'questList').includes('受けている　1 / 3'));
  press(g, 'f');
  assert.ok(profile(g).includes('<span>毛皮集め</span><span>狼の毛皮 1 / 3</span>'));
  assert.notStrictEqual(npcMarkOf(g, 'guildClerk'), '?');

  pickUp(g, 'wolfPelt', 3);
  assert.strictEqual(questState(g, 't_pelt'), 'ready');
  assert.deepStrictEqual(bigMessage(g), ['クエスト達成！', '「毛皮集め」をギルド受付に報告しよう']);
  assert.strictEqual(npcMarkOf(g, 'guildClerk'), '?');
  assert.ok(profile(g).includes('<span>毛皮集め</span><span class="up">ギルド受付に報告</span>'));

  sellOne(g, 'wolfPelt');
  assert.strictEqual(pelts(g), 3);
  assert.strictEqual(questState(g, 't_pelt'), 'ready', 'まだ 3 個ある');
  sellOne(g, 'wolfPelt');
  assert.strictEqual(questState(g, 't_pelt'), 'active', '売って足りなくなると戻る');
  assert.notStrictEqual(npcMarkOf(g, 'guildClerk'), '?');
  openQuest(g, 'guildClerk', 't_pelt');
  assert.ok(htmlOf(g, 'questDetail').includes('　2 / 3'));
  press(g, 'Enter');
  assert.strictEqual(questState(g, 't_pelt'), 'active', '足りないうちは報告できない');
  press(g, 'f');

  pickUp(g, 'wolfPelt', 2);
  assert.strictEqual(questState(g, 't_pelt'), 'ready');
  const gold = g.player.gold;
  openQuest(g, 'guildClerk', 't_pelt');
  press(g, 'Enter');
  assert.strictEqual(questState(g, 't_pelt'), 'claimed');
  assert.strictEqual(pelts(g), 1, '報告すると 3 個渡す');
  assert.strictEqual(g.player.gold, gold + 10);
  assert.strictEqual(textOf(g, 'questNote'), '「毛皮集め」の報酬を受け取った: 10 G');
});

test('集める: 受けたときにもう持っていればすぐ報告できる。渡しきると素材の欄から消える。くり返しはまた受けられる', () => {
  const g = newGame();
  defineQuest(g, { id: 't_fang', name: '牙集め', repeatable: true, goal: { kind: 'collect', material: 'wolfFang', count: 2 }, reward: { gold: 5 } });
  pickUp(g, 'wolfFang', 2);
  openQuest(g, 'guildClerk', 't_fang');
  press(g, 'Enter');
  assert.strictEqual(questState(g, 't_fang'), 'ready');
  assert.strictEqual(bigMessage(g)[0], 'クエスト達成！');
  press(g, 'Enter');
  assert.strictEqual(questState(g, 't_fang'), 'available');
  assert.ok(!('wolfFang' in g.player.materials));
});

test('集める: 装備の報酬は持ち物がいっぱいなら受け取れず、素材も減らない', () => {
  const g = newGame();
  defineQuest(g, { id: 't_pelt', name: '毛皮集め', goal: { kind: 'collect', material: 'wolfPelt', count: 2 }, reward: { gold: 10, item: { slot: 'weapon', rarity: 'common' } } });
  pickUp(g, 'wolfPelt', 2);
  openQuest(g, 'guildClerk', 't_pelt');
  press(g, 'Enter');
  assert.strictEqual(questState(g, 't_pelt'), 'ready');
  fillInventory(g);
  const gold = g.player.gold;
  press(g, 'Enter');
  assert.strictEqual(textOf(g, 'questNote'), '持ち物がいっぱいで受け取れない');
  assert.strictEqual(questState(g, 't_pelt'), 'ready');
  assert.strictEqual(pelts(g), 2);
  assert.strictEqual(g.player.gold, gold);
  g.player.inventory.pop();
  press(g, 'Enter');
  assert.strictEqual(questState(g, 't_pelt'), 'claimed');
  assert.strictEqual(pelts(g), 0);
  assert.strictEqual(g.player.inventory.length, g.ECON.inventorySize);
});

test('集める: 同じ素材のクエストが 2 つ報告できるとき、1 つ報告して足りなくなったほうは受けているに戻る', () => {
  const g = newGame();
  defineQuest(g, { id: 't_a', goal: { kind: 'collect', material: 'wolfPelt', count: 2 } });
  defineQuest(g, { id: 't_b', goal: { kind: 'collect', material: 'wolfPelt', count: 2 } });
  pickUp(g, 'wolfPelt', 3);
  openQuest(g, 'guildClerk', 't_a');
  press(g, 'Enter');
  clickQuestRow(g, 't_b');
  press(g, 'Enter');
  assert.deepStrictEqual([questState(g, 't_a'), questState(g, 't_b')], ['ready', 'ready']);
  clickQuestRow(g, 't_a');
  press(g, 'Enter');
  assert.deepStrictEqual([questState(g, 't_a'), questState(g, 't_b')], ['claimed', 'active']);
  assert.strictEqual(pelts(g), 1);
});

test('話しかける (talk): 受けたあとに NPC に話しかけると報告できる。依頼した NPC に「?」', () => {
  const g = newGame();
  defineQuest(g, { id: 't_talk', name: '伝言', goal: { kind: 'talk', npc: 'adventurer' }, reward: { gold: 7 } });
  openNpc(g, 'adventurer');
  assert.strictEqual(openScreen(g), 'talk');
  press(g, 'Escape');
  assert.strictEqual(questState(g, 't_talk'), 'available', '受ける前に話しても数えない');
  openQuest(g, 'guildClerk', 't_talk');
  assert.ok(htmlOf(g, 'questDetail').includes('<dd>冒険者と話す</dd>'));
  press(g, 'Enter');
  assert.ok(htmlOf(g, 'questDetail').includes('<dd>冒険者と話す　0 / 1</dd>'));
  assert.ok(htmlOf(g, 'questDetail').includes('受けている（話しかけると報告できる）'));
  press(g, 'f');
  assert.ok(profile(g).includes('<span>伝言</span><span>冒険者と話す 0 / 1</span>'));
  assert.notStrictEqual(npcMarkOf(g, 'guildClerk'), '?');

  openNpc(g, 'merchant');
  press(g, 'Escape');
  assert.strictEqual(questState(g, 't_talk'), 'active', 'ほかの NPC では進まない');
  openNpc(g, 'adventurer');
  assert.strictEqual(openScreen(g), 'talk', '会話もいつもどおり開く');
  assert.strictEqual(questState(g, 't_talk'), 'ready');
  assert.deepStrictEqual(bigMessage(g), ['クエスト達成！', '「伝言」をギルド受付に報告しよう']);
  press(g, 'Escape');
  assert.strictEqual(npcMarkOf(g, 'guildClerk'), '?');
  assert.ok(profile(g).includes('<span>伝言</span><span class="up">ギルド受付に報告</span>'));

  const gold = g.player.gold;
  openNpc(g, 'guildClerk');
  assert.strictEqual(questRows(g)[0].id, 't_talk', '報告できるものが先頭');
  press(g, 'Enter');
  assert.strictEqual(questState(g, 't_talk'), 'claimed');
  assert.strictEqual(g.player.gold, gold + 7);
});

test('倒すクエストと集めるクエストを同時に受けると、それぞれの出来事で進む', () => {
  const g = newGame();
  defineQuest(g, { id: 't_pelt', goal: { kind: 'collect', material: 'wolfPelt', count: 2 } });
  g.player.quests.c_wolf = { state: 'active', count: 0 };
  g.player.quests.t_pelt = { state: 'active', count: 0 };
  const [e] = arena(g, { cols: 12, rows: 12, player: [5, 5], enemies: [{ type: 'wolf', at: [6, 5] }] });
  e.hp = 1;
  g.rng.force(0.99, 0.5);
  step(g, 1, 0);
  assert.ok(e.dead);
  assert.strictEqual(g.player.quests.c_wolf.count, 1);
  assert.strictEqual(questState(g, 't_pelt'), 'active', '倒しただけでは素材は増えない');
  step(g, 1, 0); // 落とした毛皮を拾う
  assert.strictEqual(pelts(g), 1);
  assert.strictEqual(g.player.quests.c_wolf.count, 1, '拾っても倒した数は増えない');
  dropAt(g, 7, 5, { kind: 'material', id: 'wolfPelt', amount: 1 });
  step(g, 1, 0);
  assert.strictEqual(questState(g, 't_pelt'), 'ready');
  assert.strictEqual(questState(g, 'c_wolf'), 'active');
  assert.deepStrictEqual(plain(g.player.quests.t_pelt), { state: 'ready', count: 0 }, '集めるは count を使わない (セーブの形は同じ)');
});

test('データの確認: 目標の種類と、種類ごとの参照 (敵・素材・NPC)・数を調べる', () => {
  const g = newGame();
  assert.deepStrictEqual(dataProblems(g), []);
  defineQuest(g, { id: 'b_kind', goal: { kind: 'escort', npc: 'captain' } });
  defineQuest(g, { id: 'b_nogoal' });
  defineQuest(g, { id: 'b_enemy', goal: { kind: 'kill', enemy: 'goblin', count: 3 } });
  defineQuest(g, { id: 'b_count', goal: { kind: 'kill', enemy: 'wolf', count: 0 } });
  defineQuest(g, { id: 'b_mat', goal: { kind: 'collect', material: 'gold', count: 2 } });
  defineQuest(g, { id: 'b_matcount', goal: { kind: 'collect', material: 'wolfPelt', count: 1.5 } });
  defineQuest(g, { id: 'b_npc', goal: { kind: 'talk', npc: 'nobody' } });
  defineQuest(g, { id: 'b_rep', repeatable: true, goal: { kind: 'talk', npc: 'captain' } });
  defineQuest(g, { id: 'b_req', requires: 'b_rep', goal: { kind: 'talk', npc: 'captain' } });
  assert.deepStrictEqual(dataProblems(g), [
    "data/quests.js 'b_kind': 目標の種類 goal.kind 'escort' が QUEST_GOALS (src/quests.js) にない",
    "data/quests.js 'b_nogoal': 目標の種類 goal.kind 'undefined' が QUEST_GOALS (src/quests.js) にない",
    "data/quests.js 'b_enemy': 敵 'goblin' が data/enemies.js にない",
    "data/quests.js 'b_count': 目標の count は 1 以上の整数にする",
    "data/quests.js 'b_mat': 素材 'gold' が data/items.js の materials にない",
    "data/quests.js 'b_matcount': 目標の count は 1 以上の整数にする",
    "data/quests.js 'b_npc': NPC 'nobody' が world.js にない",
    "data/quests.js 'b_req': requires 'b_rep' はくり返しのクエストなので使えない",
  ]);
});
