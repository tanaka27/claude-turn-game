// 手動のセーブ (一時停止画面の「セーブ」)、保存できなかったときの知らせ、古いタブで新しい進行を上書きしない (docs/save.md)
'use strict';
const assert = require('assert');
const { loadGame, makeServer, makeBus } = require('./harness');
const { newGame, press, clickButton, shown, textOf, plain } = require('./helpers');

const KEY = 'zankai-turn-save';
// 起動時の initSave → refreshTitle や、送ったセーブの返事が終わるまで待つ
const settle = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const localSave = (g) => JSON.parse(g.storage.get(KEY));

// サーバーつきで起動し、タイトルの「はじめから」/「続きから」で始める
async function serverGame(server, opts = {}) {
  const g = loadGame({ server, ...opts });
  await settle();
  await g.elements[opts.continue ? 'continueBtn' : 'startBtn'].onclick();
  await settle();
  assert.strictEqual(g.game.state, 'play');
  return g;
}

test('一時停止画面の「セーブ」と S キーで、すぐにサーバーとブラウザに保存し、結果を出す', async () => {
  const server = makeServer(null);
  const g = await serverGame(server);
  press(g, 'p');
  assert.strictEqual(textOf(g, 'saveResult'), '', '開いたときは結果なし');
  g.player.gold = 123;
  g.game.saveT = 3;
  const before = server.puts.length;
  const done = clickButton(g, 'pause', 'save');
  assert.strictEqual(textOf(g, 'saveResult'), g.txt('save.saving'));
  assert.strictEqual(localSave(g).player.gold, 123, 'ブラウザにはすぐ書く');
  assert.strictEqual(g.game.saveT, g.PARAMS.save.interval, '自動のセーブの時計を数え直す');
  await done;
  await settle();
  assert.strictEqual(server.puts.length, before + 1);
  assert.strictEqual(server.save.player.gold, 123);
  assert.strictEqual(textOf(g, 'saveResult'), g.txt('save.doneBoth'));
  // S キーでも同じ
  g.player.gold = 456;
  press(g, 's');
  await settle();
  assert.strictEqual(server.save.player.gold, 456);
  assert.strictEqual(textOf(g, 'saveResult'), g.txt('save.doneBoth'));
  // 一時停止していないときの S は移動 (保存しない)
  press(g, 'Escape');
  const n = server.puts.length;
  g.manualSave();
  await settle();
  assert.strictEqual(server.puts.length, n);
});

test('サーバーなし: 「セーブ」はブラウザに保存した、と出す', async () => {
  const g = newGame();
  press(g, 'p');
  g.player.gold = 9;
  await g.manualSave();
  assert.strictEqual(localSave(g).player.gold, 9);
  assert.strictEqual(textOf(g, 'saveResult'), g.txt('save.doneLocal'));
});

test('サーバーに書けないとき: 「セーブ」はブラウザだけに保存したことと理由を出す', async () => {
  const server = makeServer(null);
  const g = await serverGame(server);
  server.fail = true;
  press(g, 'p');
  await g.manualSave();
  assert.ok(textOf(g, 'saveResult').startsWith('ブラウザに保存しました。サーバーには保存できませんでした（HTTP 500）'), textOf(g, 'saveResult'));
  assert.ok(textOf(g, 'saveWhere').includes('HTTP 500'));
});

test('ブラウザに保存できないとき: 保存されている、とは出さない', async () => {
  // サーバーなし → どこにも保存できない
  const g = newGame();
  g.local.fail = true;
  const log0 = g.consoleLog.length;
  await g.saveGame();
  assert.strictEqual(g.saveStore.localOk, false);
  assert.strictEqual(g.saveWhereText(), g.txt('save.nowhere'));
  assert.ok(g.consoleLog.slice(log0).some((l) => l.level === 'warn'));
  assert.ok(g.logLines.some((m) => m.text === g.txt('save.failedLog')), 'ログにも出す');
  await g.saveGame();
  assert.strictEqual(g.logLines.filter((m) => m.text === g.txt('save.failedLog')).length, 1, 'ログは 1 回だけ');
  press(g, 'p');
  assert.strictEqual(textOf(g, 'saveWhere'), g.txt('save.nowhere'));
  await g.manualSave();
  assert.strictEqual(textOf(g, 'saveResult'), g.txt('save.doneNowhere'));
  // 書けるようになれば元の説明に戻る
  g.local.fail = false;
  await g.saveGame();
  assert.strictEqual(g.saveWhereText(), g.txt('save.browserOnly'));

  // サーバーあり → サーバーにだけ保存している
  const server = makeServer(null);
  const g2 = await serverGame(server);
  g2.local.fail = true;
  press(g2, 'p');
  await g2.manualSave();
  assert.strictEqual(textOf(g2, 'saveResult'), g2.txt('save.doneServerOnly'));
  assert.strictEqual(g2.saveWhereText(), g2.txt('save.serverOnly'));
});

test('壊れたセーブ (ゲーム内の時刻・倒した数が数でない) を読んでも、時刻が NaN にならない', () => {
  const g = newGame();
  const raw = plain(g.buildSave());
  for (const [time, kills] of [['abc', '7'], [-5, -1], [null, Infinity], [{}, []]]) {
    raw.progress = { time, kills };
    const g2 = loadGame();
    g2.startGame(g2.migrateSave(raw));
    assert.strictEqual(g2.game.time, 0, JSON.stringify(time));
    assert.strictEqual(g2.game.kills, 0);
    assert.strictEqual(g2.player.next, 0, '次の行動の時刻も数');
  }
  raw.progress = { time: 812.5, kills: 33 };
  const g3 = loadGame();
  g3.startGame(g3.migrateSave(raw));
  assert.strictEqual(g3.game.time, 812.5);
  assert.strictEqual(g3.game.kills, 33);
});

test('サーバーの返事の本文が届かないときも、待ち時間が来たらブラウザだけに切り替える', async () => {
  let aborted = false;
  // 返事の頭は来るが、本文 (json) は中止されるまで終わらない
  const fetch = (url, init = {}) => Promise.resolve({
    ok: true, status: 200,
    json: () => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => { aborted = true; const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
    }),
  });
  const g = loadGame({ fetch });
  g.PARAMS.save.serverTimeout = 0.05;
  const r = await g.fetchServerSave();
  assert.ok(aborted, '待ち時間で中止する');
  assert.deepStrictEqual(plain(r), { ok: false, unreachable: true });
});

test('古いタブ: サーバーに別のタブの新しいセーブがあれば上書きせず、保存をやめて知らせる', async () => {
  const server = makeServer(null);
  const bus = makeBus();
  // タブ A で遊び始める
  const a = await serverGame(server, { bus });
  a.player.gold = 30;
  await a.saveGame();
  assert.strictEqual(server.save.player.gold, 30);
  // BroadcastChannel が届かない (古いブラウザ・別のブラウザ) タブ B が、続きから遊んで進める
  const b = await serverGame(server, { continue: true });
  assert.strictEqual(b.player.gold, 30);
  b.player.gold = 500;
  await b.saveGame();
  assert.strictEqual(server.save.player.gold, 500);
  // 古いタブ A が保存しても、B の進行は残る。A は保存をやめ、遊べなくなる
  const r = await a.saveGame();
  assert.strictEqual(r.server, 'conflict');
  assert.strictEqual(server.save.player.gold, 500);
  assert.strictEqual(a.saveStore.blocked, 'conflict');
  assert.ok(shown(a, 'saveBlocked'));
  assert.strictEqual(textOf(a, 'saveBlockedText'), a.txt('save.blockedConflict'));
  assert.strictEqual(a.game.paused, true);
  const at = [a.player.tx, a.player.ty];
  press(a, 'p'); press(a, 'd');
  assert.deepStrictEqual([a.player.tx, a.player.ty], at, 'キーが効かない');
  const puts = server.puts.length, local = a.storage.get(KEY);
  a.player.gold = 1;
  assert.strictEqual((await a.saveGame()).skipped, true, 'もう保存しない');
  assert.strictEqual(server.puts.length, puts);
  assert.strictEqual(a.storage.get(KEY), local, 'ブラウザにも書かない');
  // B は続けて保存できる (同じタブのセーブ)
  b.player.gold = 600;
  assert.strictEqual((await b.saveGame()).server, 'ok');
  assert.strictEqual(server.save.player.gold, 600);
});

test('同じタブのセーブは続けて書け、順番が入れ替わった古いセーブは書かない', async () => {
  const server = makeServer(null);
  const g = await serverGame(server);
  const s1 = plain(g.buildSave());
  await g.saveGame();
  const s2 = server.save;
  // 同じタブで、今のより古い savedAt のセーブが遅れて届いた
  const res = await server.fetch('api/save', { method: 'PUT', body: JSON.stringify({ ...s1, savedAt: s2.savedAt - 1000, tab: g.saveStore.tab }) });
  assert.deepStrictEqual(await res.json(), { ok: true, stale: true });
  assert.strictEqual(server.save, s2);
  assert.strictEqual(s2.tab, g.saveStore.tab, 'サーバーには書いたタブが残る');
  assert.ok(!('base' in s2), 'base は残さない');
});

test('ほかのタブで「続きから」を選ぶと、今のタブは保存をやめる。新しいタブは一番新しいセーブから始める', async () => {
  const server = makeServer(null);
  const bus = makeBus();
  const a = await serverGame(server, { bus });
  a.player.gold = 70;
  await a.saveGame();
  // タブ B をタイトルまで開いたあとで、A がさらに進める
  const b = loadGame({ server, bus });
  await settle();
  a.player.gold = 90;
  await a.saveGame();
  // B で続きから: A は保存をやめ、B は読み直した (A の最後の) セーブから始める
  await b.elements.continueBtn.onclick();
  await settle();
  assert.strictEqual(a.saveStore.blocked, 'otherTab');
  assert.ok(shown(a, 'saveBlocked'));
  assert.strictEqual(textOf(a, 'saveBlockedText'), a.txt('save.blockedOtherTab'));
  assert.strictEqual(b.game.state, 'play');
  assert.strictEqual(b.player.gold, 90);
  assert.strictEqual(b.saveStore.blocked, '');
  // A がページを閉じても保存しない
  a.player.gold = 1;
  for (const f of a.windowListeners.beforeunload || []) f({});
  await settle();
  assert.strictEqual(server.save.player.gold, 90);
  assert.strictEqual(JSON.parse(a.storage.get(KEY)).player.gold, 90);
  b.player.gold = 95;
  await b.saveGame();
  assert.strictEqual(server.save.player.gold, 95);
});

test('ほかのタブで遊び始めると、タイトルのままのタブも保存をやめる (古い読み込みのまま続きから遊ばない)', async () => {
  const server = makeServer(null);
  const bus = makeBus();
  const a = loadGame({ server, bus });
  await settle();
  const b = await serverGame(server, { bus });
  await settle();
  assert.strictEqual(b.saveStore.blocked, '');
  assert.strictEqual(a.saveStore.blocked, 'otherTab');
  assert.ok(shown(a, 'saveBlocked'));
  await a.elements.continueBtn.onclick();
  assert.strictEqual(a.game.state, 'title', '止めたタブでは始められない');
});
