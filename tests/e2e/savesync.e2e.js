// ブラウザの通しテスト: 本物の server.py と Chromium (Playwright) で、手動のセーブと古いタブの扱いを確かめる (docs/testing.md の「ブラウザの通しテスト」)
//   node tests/e2e/savesync.e2e.js
// Playwright が入っていないときは何もせずに終わる (終了コード 0)。失敗すると終了コード 1
// サーバーは空いているポートと一時フォルダのセーブ (環境変数 ZANKAI_SAVE_DIR) で起動するので、saves/ の本物のセーブには触らない
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (err) {
  console.log('skipped: playwright が見つかりません (npm install playwright と npx playwright install chromium で入れられます)');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..', '..');
const python = ['python3', 'python'].find((c) => spawnSync(c, ['--version']).status === 0);
if (!python) { console.log('skipped: python が見つかりません'); process.exit(0); }

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
async function startServer(port, saveDir) {
  const proc = spawn(python, [path.join(ROOT, 'server.py'), String(port)], { env: { ...process.env, ZANKAI_SAVE_DIR: saveDir }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/save`)).ok) return proc; } catch (err) { /* まだ起動していない */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error('server.py が起動しませんでした');
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// 開いたページ: タイトルのボタンが押せるまで待つ。ページのエラーは errors に残す
async function openTab(ctx, base, errors) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  // 409 (サーバーが古いタブの保存を断った) はブラウザが自動で出す表示なので、エラーに数えない
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 409/.test(m.text())) errors.push(m.text()); });
  await page.goto(base);
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  return page;
}
const playing = (page) => page.waitForFunction(() => window.__game.game.state === 'play');
const setGold = (page, n) => page.evaluate((v) => { window.__game.player.gold = v; }, n);
async function manualSave(page) {
  if (!(await page.isVisible('#pause'))) await page.keyboard.press('p');
  await page.click('#pause [data-act="save"]');
  await page.waitForFunction(() => !document.getElementById('saveResult').textContent.includes('…'));
  return page.textContent('#saveResult');
}

test('一時停止画面の「セーブ」で、サーバーとブラウザに保存した、と出る', async ({ ctx, base, errors, serverSave }) => {
  const a = await openTab(ctx, base, errors);
  await a.click('#startBtn');
  await playing(a);
  await setGold(a, 500);
  assert.strictEqual(await manualSave(a), '保存しました（サーバーとブラウザ）。');
  assert.strictEqual((await serverSave()).player.gold, 500);
  // S キーでも保存する
  await setGold(a, 520);
  await a.keyboard.press('s');
  await a.waitForFunction(() => window.__game.saveStore.cached.player.gold === 520);
  await a.waitForTimeout(200);
  assert.strictEqual((await serverSave()).player.gold, 520);
});

test('ほかのタブで続きから遊ぶと、前のタブは保存をやめ、閉じても新しい進行を上書きしない', async ({ ctx, base, errors, serverSave }) => {
  const a = await openTab(ctx, base, errors);
  await a.click('#startBtn');
  await playing(a);
  await setGold(a, 500);
  await manualSave(a);
  const b = await openTab(ctx, base, errors);
  await b.click('#continueBtn');
  await playing(b);
  assert.strictEqual(await b.evaluate(() => window.__game.player.gold), 500, '最新のセーブから始まる');
  await a.waitForFunction(() => window.__game.saveStore.blocked === 'otherTab');
  assert.ok(await a.isVisible('#saveBlocked'), '前のタブに「保存を止めました」が出る');
  await setGold(b, 700);
  assert.strictEqual(await manualSave(b), '保存しました（サーバーとブラウザ）。');
  await setGold(a, 1);
  await a.close({ runBeforeUnload: true });
  await b.waitForTimeout(300);
  const save = await serverSave();
  assert.strictEqual(save.player.gold, 700);
  assert.ok(save.tab && !('base' in save), 'tab は残り base は残らない');
});

test('知らせが届かない古いタブ (別のブラウザ) の保存は、サーバーが断って古いタブを止める', async ({ browser, base, errors, serverSave }) => {
  // BroadcastChannel は同じブラウザの中だけなので、別々のコンテキストにして届かないようにする
  const ctxA = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const ctxB = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  try {
    const a = await openTab(ctxA, base, errors);
    await a.click('#startBtn');
    await playing(a);
    await setGold(a, 30);
    await manualSave(a);
    const b = await openTab(ctxB, base, errors);
    await b.click('#continueBtn');
    await playing(b);
    await setGold(b, 500);
    await manualSave(b);
    assert.strictEqual(await a.evaluate(() => window.__game.saveStore.blocked), '', 'まだ止まっていない');
    await setGold(a, 30);
    await manualSave(a);
    await a.waitForFunction(() => window.__game.saveStore.blocked === 'conflict');
    assert.ok(await a.isVisible('#saveBlocked'));
    assert.strictEqual((await serverSave()).player.gold, 500, '新しい進行が残る');
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

(async () => {
  const port = await freePort();
  const saveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zankai-e2e-'));
  const server = await startServer(port, saveDir);
  const base = `http://127.0.0.1:${port}/`;
  const serverSave = async () => (await (await fetch(`${base}api/save`)).json()).save;
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const t of tests) {
      // テストごとにセーブを消して、新しいブラウザ (localStorage が空) で始める
      fs.rmSync(path.join(saveDir, 'save.json'), { force: true });
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      const errors = [];
      try {
        await t.fn({ browser, ctx, base, errors, serverSave });
        assert.deepStrictEqual(errors, [], 'ページにエラーが出ない');
        console.log(`  ok   ${t.name}`);
      } catch (err) {
        failed++;
        console.log(`  FAIL ${t.name}\n${err.stack}`);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    server.kill();
    fs.rmSync(saveDir, { recursive: true, force: true });
  }
  console.log(`\n${tests.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
