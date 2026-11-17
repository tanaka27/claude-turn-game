// 画面の登録表 (SCREENS) と NPC の役目 (NPC_ROLES): 今の画面と役目がそろっていること、データの確認、
// テストだけで足した施設 (画面 + 役目 + NPC) が 1 つの登録だけで開く・キー・ボタン・閉じるまで動くこと (docs/menu.md)
'use strict';
const assert = require('assert');
const {
  newGame, press, step, shown, textOf, openScreen, clickButton, trackSaves, nextToNpc, dataProblems,
  defineScreen, defineRole, screenNames, roleNames,
} = require('./helpers');

test('登録表: 画面は inv / char / shop / smith / talk / quest、役目は shop / smith / quest / talk', () => {
  const g = newGame();
  assert.deepStrictEqual(screenNames(g).sort(), ['char', 'inv', 'quest', 'shop', 'smith', 'talk']);
  assert.deepStrictEqual(roleNames(g).sort(), ['quest', 'shop', 'smith', 'talk']);
  for (const r of roleNames(g)) assert.ok(screenNames(g).includes(g.NPC_ROLES[r].screen), r);
  assert.deepStrictEqual(dataProblems(g), []);
});

test('データの確認: ない役目・ない店 / 鍛冶屋のキー・会話の言葉がない NPC を見つける', () => {
  const g = newGame();
  const town = g.WORLD.zones.town.npcs;
  const merchant = town.find((n) => n.id === 'merchant'), smith = town.find((n) => n.id === 'townSmith');
  merchant.shop = 'nowhere';
  smith.smith = 'noSmith';
  const adv = g.WORLD.zones.townGuild.npcs.find((n) => n.id === 'adventurer');
  adv.lines = [];
  g.WORLD.zones.town.npcs.find((n) => n.id === 'captain').role = 'inn';
  const ps = dataProblems(g);
  assert.ok(ps.includes("world.js town の NPC 'merchant': 店 'nowhere' が data/items.js の shops にない"), ps.join('\n'));
  assert.ok(ps.includes("world.js town の NPC 'townSmith': 鍛冶屋 'noSmith' が data/items.js の smiths にない"));
  assert.ok(ps.includes("world.js townGuild の NPC 'adventurer': 話す言葉 lines がない"));
  assert.ok(ps.includes("world.js town の NPC 'captain': 役目 role 'inn' が NPC_ROLES (src/ui.js) にない"));
  // 役目はあるが、その画面が登録されていない
  defineRole(g, 'inn', { screen: 'innScreen', arg: (n) => n });
  assert.ok(dataProblems(g).includes("world.js town の NPC 'captain': 役目 'inn' の画面 'innScreen' が SCREENS にない"));
});

test('テストで足した施設: 画面と役目を 1 つずつ登録すると、話しかけて開き、キー・ボタン・閉じるが動く', () => {
  const g = newGame();
  const seen = { opened: null, closed: 0, keys: [] };
  let count = 0;
  const render = () => { g.document.getElementById('innPanel').innerHTML = `<p>${count}</p><button data-act="rest">休む</button>`; };
  defineScreen(g, 'inn', {
    overlay: 'innPanel', render, afterAction: render, closeKeys: ['f'],
    open: (n) => { seen.opened = n.id; count = 0; },
    keys: (k) => { seen.keys.push(k); if (k === 'r') { count++; render(); return true; } return false; },
    actions: { rest: () => { count += 10; } },
    onClose: () => { seen.closed++; },
  });
  defineRole(g, 'inn', { screen: 'inn', arg: (n) => n });
  g.WORLD.zones.town.npcs.find((n) => n.id === 'captain').role = 'inn';
  assert.deepStrictEqual(dataProblems(g), []);
  // 町に入り直す (NPC はゾーンを読み込むときに写される)
  const dir = nextToNpc(g, 'captain');
  step(g, dir[0], dir[1]);
  assert.strictEqual(openScreen(g), 'inn');
  assert.strictEqual(seen.opened, 'captain');
  assert.ok(shown(g, 'innPanel'));
  assert.strictEqual(shown(g, 'quest'), false);
  press(g, 'r');
  assert.strictEqual(count, 1);
  clickButton(g, 'innPanel', 'rest');
  assert.strictEqual(count, 11);
  assert.strictEqual(textOf(g, 'innPanel'), '');
  assert.ok(g.document.getElementById('innPanel').innerHTML.startsWith('<p>11</p>'));
  const at = [g.player.tx, g.player.ty];
  press(g, 'd');
  assert.deepStrictEqual([g.player.tx, g.player.ty], at, 'キーはフィールドに漏れない');
  const saves = trackSaves(g), n = saves.count;
  press(g, 'f');
  assert.strictEqual(openScreen(g), null);
  assert.strictEqual(shown(g, 'innPanel'), false);
  assert.strictEqual(seen.closed, 1);
  assert.ok(saves.count > n);
  // 足した画面の overlay も、ほかの画面を閉じたとき・はじめから始めたときに隠れる
  press(g, 'f');
  g.document.getElementById('innPanel').classList.add('show');
  g.startGame(null);
  assert.strictEqual(shown(g, 'innPanel'), false);
});
