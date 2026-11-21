// クエストの画面 (一覧の並びと状態・↑↓ で選ぶ・Enter / ボタンで受ける・報告する・報酬)。
// 作りを変える前の動きをそのまま固定する (docs/progression.md)
'use strict';
const assert = require('assert');
const {
  newGame, press, textOf, htmlOf, openScreen, questRows, clickQuestRow, clickButton, findButton, nextToNpc, setLevel, fillInventory, trackSaves, bagOf, consumableDef,
} = require('./helpers');

function openNpc(g, id) { nextToNpc(g, id); press(g, 'f'); }
const selected = (g) => (questRows(g).find((r) => r.sel) || {}).id;

// ギルド受付: 報告できる → 受けている → 受けられる → レベル不足 → 報告済み の順。前のクエストがまだのものは出ない
function guildSetup(g) {
  setLevel(g, 3);
  g.player.quests = { g_trial: { state: 'claimed', count: 3 }, g_wolf: { state: 'active', count: 4 }, g_boar: { state: 'ready', count: 6 } };
}

test('はじめは前のクエストがまだのものを出さない (衛兵隊長はウルフ退治だけ)', () => {
  const g = newGame();
  openNpc(g, 'captain');
  assert.deepStrictEqual(questRows(g), [{ id: 'c_wolf', state: 'available', sel: true }]);
  assert.ok(htmlOf(g, 'questDetail').includes('この依頼を受ける（Enter）'));
  assert.strictEqual(textOf(g, 'questNote'), '');
});

test('一覧の並びと状態、はじめに選ばれるのは先頭', () => {
  const g = newGame();
  guildSetup(g);
  openNpc(g, 'guildClerk');
  assert.deepStrictEqual(questRows(g).map((r) => [r.id, r.state]), [
    ['g_boar', 'ready'], ['g_wolf', 'active'], ['g_bee', 'available'], ['g_salamander', 'lowLevel'], ['g_golem', 'lowLevel'], ['g_trial', 'claimed'],
  ]);
  assert.strictEqual(selected(g), 'g_boar');
  const list = htmlOf(g, 'questList');
  assert.ok(list.includes('受けている　4 / 10'));
  assert.ok(list.includes('Lv5 から'));
  assert.ok(list.includes('くり返し'));
  assert.ok(htmlOf(g, 'questDetail').includes('報告する（Enter）'));
});

test('↑↓ で選択が動き (端で止まる)、クリックでも選べる。詳細の内容も変わる', () => {
  const g = newGame();
  guildSetup(g);
  openNpc(g, 'guildClerk');
  press(g, 'ArrowUp');
  assert.strictEqual(selected(g), 'g_boar', '先頭で止まる');
  press(g, 'ArrowDown');
  assert.strictEqual(selected(g), 'g_wolf');
  assert.ok(htmlOf(g, 'questDetail').includes('受けている（倒した数は受けたあとから数える）'));
  press(g, 'ArrowDown', { repeat: true });
  assert.strictEqual(selected(g), 'g_bee', '押しっぱなしでも動く');
  for (let i = 0; i < 6; i++) press(g, 'ArrowDown');
  assert.strictEqual(selected(g), 'g_trial', '最後で止まる');
  assert.ok(htmlOf(g, 'questDetail').includes('報告済み'));
  clickQuestRow(g, 'g_salamander');
  assert.strictEqual(selected(g), 'g_salamander');
  assert.ok(htmlOf(g, 'questDetail').includes('Lv5 になると受けられる'));
  press(g, 'Enter');
  assert.strictEqual(g.questStatus(g.questById('g_salamander')), 'lowLevel', 'レベル不足は受けられない');
  assert.strictEqual(openScreen(g), 'quest');
});

test('Enter で受ける (セーブする)。受けたら一覧の上の文が出て、受けているの側へ動く', () => {
  const g = newGame();
  guildSetup(g);
  openNpc(g, 'guildClerk');
  clickQuestRow(g, 'g_bee');
  const saves = trackSaves(g), n = saves.count;
  press(g, 'Enter');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g.player.quests.g_bee)), { state: 'active', count: 0 });
  assert.strictEqual(textOf(g, 'questNote'), '「大蜂の巣払い」を受けた');
  assert.ok(saves.count > n);
  assert.strictEqual(selected(g), 'g_bee', '選んだまま');
  assert.deepStrictEqual(questRows(g).map((r) => r.id).slice(0, 3), ['g_boar', 'g_wolf', 'g_bee']);
  press(g, 'Enter', { repeat: true });
  assert.strictEqual(openScreen(g), 'quest');
});

test('ボタンで受ける・報告する', () => {
  const g = newGame();
  openNpc(g, 'captain');
  clickButton(g, 'quest', 'accept', { id: 'c_wolf' });
  assert.strictEqual(g.player.quests.c_wolf.state, 'active');
  g.player.quests.c_wolf = { state: 'ready', count: 8 };
  press(g, 'f');
  openNpc(g, 'captain');
  const gold = g.player.gold;
  clickButton(g, 'quest', 'claim', { id: 'c_wolf' });
  assert.strictEqual(g.player.quests.c_wolf.state, 'claimed');
  assert.strictEqual(g.player.gold, gold + 50);
  assert.strictEqual(textOf(g, 'questNote'), '「ウルフ退治」の報酬を受け取った: 経験値 80、50 G');
  // 報酬の経験値で Lv2 になり、次のクエストが受けられる
  assert.strictEqual(g.player.level, 2);
  assert.deepStrictEqual(questRows(g).map((r) => [r.id, r.state]), [['c_bee', 'available'], ['c_wolf', 'claimed']]);
});

test('くり返しのクエストは報告すると記録が消えて、また受けられるになる', () => {
  const g = newGame();
  guildSetup(g);
  openNpc(g, 'guildClerk');
  const p = g.player, gold = p.gold, exp = p.exp, lv = p.level;
  press(g, 'Enter');
  assert.ok(!('g_boar' in p.quests));
  assert.strictEqual(g.questStatus(g.questById('g_boar')), 'available');
  assert.strictEqual(p.gold, gold + 60);
  assert.ok(p.level > lv || p.exp === exp + 110);
  assert.strictEqual(textOf(g, 'questNote'), '「畑を荒らすイノシシ」の報酬を受け取った: 経験値 110、60 G');
  assert.strictEqual(selected(g), 'g_boar');
  assert.deepStrictEqual(questRows(g).map((r) => [r.id, r.state]).slice(0, 3), [['g_wolf', 'active'], ['g_boar', 'available'], ['g_bee', 'available']]);
  assert.ok(htmlOf(g, 'questDetail').includes('この依頼を受ける（Enter）'));
});

test('報酬の回復薬は上限まで、装備は持ち物がいっぱいなら受け取れない', () => {
  const g = newGame();
  const p = g.player;
  setLevel(g, 3);
  p.quests = { c_wolf: { state: 'claimed', count: 8 }, c_bee: { state: 'ready', count: 5 } };
  bagOf(p).potion = consumableDef(g, 'potion').max - 1;
  openNpc(g, 'captain');
  press(g, 'Enter');
  assert.strictEqual(bagOf(p).potion, consumableDef(g, 'potion').max);
  assert.strictEqual(textOf(g, 'questNote'), '「毒針の羽音」の報酬を受け取った: 経験値 150、60 G、回復薬 ×2');
  press(g, 'f');
  p.quests.c_salamander = { state: 'ready', count: 6 };
  fillInventory(g);
  const gold = p.gold;
  openNpc(g, 'captain');
  assert.strictEqual(selected(g), 'c_salamander');
  press(g, 'Enter');
  assert.strictEqual(textOf(g, 'questNote'), '持ち物がいっぱいで受け取れない');
  assert.strictEqual(p.quests.c_salamander.state, 'ready');
  assert.strictEqual(p.gold, gold);
  assert.ok(findButton(g, 'quest', 'claim', { id: 'c_salamander' }));
  p.inventory.pop();
  press(g, 'Enter');
  assert.strictEqual(p.quests.c_salamander.state, 'claimed');
  assert.strictEqual(p.gold, gold + 100);
  const got = p.inventory[p.inventory.length - 1];
  assert.deepStrictEqual([got.slot, got.rarity], ['accessory', 'rare']);
  assert.strictEqual(p.inventory.length, g.EC.inventorySize);
  assert.strictEqual(textOf(g, 'questNote'), '「火を吐くトカゲ」の報酬を受け取った: 経験値 300、100 G、レアの装飾品');
});

test('開き直すと一覧の上の文と選択は消える', () => {
  const g = newGame();
  guildSetup(g);
  openNpc(g, 'guildClerk');
  press(g, 'ArrowDown');
  press(g, 'ArrowDown');
  press(g, 'Enter');
  assert.ok(textOf(g, 'questNote'));
  press(g, 'f');
  openNpc(g, 'guildClerk');
  assert.strictEqual(textOf(g, 'questNote'), '');
  assert.strictEqual(selected(g), 'g_boar');
});

test('クエストの画面は「閉じる」で閉じ、閉じるとセーブする。閉じたあとのクリックは効かない', () => {
  const g = newGame();
  openNpc(g, 'captain');
  const saves = trackSaves(g), n = saves.count;
  clickButton(g, 'quest', 'close');
  assert.strictEqual(openScreen(g), null);
  assert.ok(saves.count > n);
  clickButton(g, 'quest', 'accept', { id: 'c_wolf' });
  assert.ok(!g.player.quests.c_wolf);
});
