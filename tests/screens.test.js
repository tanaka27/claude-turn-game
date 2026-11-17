// 画面 (道具一覧・キャラクター・商人・鍛冶屋・クエスト・会話・一時停止) の開き方・閉じ方・キー。
// 作りを変える前の動きをそのまま固定する (docs/menu.md)
'use strict';
const assert = require('assert');
const {
  newGame, press, step, el, shown, textOf, openScreen, clickHud, clickButton, clickTool, clickTalkText, trackSaves, nextToNpc, skill,
} = require('./helpers');

const OVERLAYS = ['menu', 'quest', 'talk', 'pause', 'itemPop'];
// 出ている画面 (index.html の overlay) の id の並び
const overlays = (g) => OVERLAYS.filter((id) => shown(g, id));

// 開いた画面を閉じると field に戻ってセーブする
function assertClosed(g, saves, before) {
  assert.strictEqual(g.game.state, 'play');
  assert.strictEqual(openScreen(g), null);
  assert.ok(saves.count > before, '閉じたらセーブする');
}

test('I キーで道具一覧を開き、I / Esc / 閉じるで閉じる (閉じるとセーブ)', () => {
  const g = newGame();
  for (const close of [() => press(g, 'i'), () => press(g, 'Escape'), () => clickButton(g, 'menu', 'close')]) {
    press(g, 'i');
    assert.strictEqual(g.game.state, 'menu');
    assert.strictEqual(openScreen(g), 'inv');
    assert.deepStrictEqual(overlays(g), ['menu']);
    assert.strictEqual(textOf(g, 'menuTitle'), '道具一覧');
    assert.strictEqual(el(g, 'shopCol').style.display, 'none');
    const saves = trackSaves(g), n = saves.count;
    close();
    assertClosed(g, saves, n);
    assert.deepStrictEqual(overlays(g), []);
    saves.stop();
  }
});

test('HUD の「道具」ボタンで道具一覧を開くと、構えていたスキルと歩く道が消える', () => {
  const g = newGame();
  g.aiming = skill(g, '1');
  g.player.travel = [[1, 1]];
  clickHud(g, 'items');
  assert.strictEqual(openScreen(g), 'inv');
  assert.strictEqual(g.aiming, null);
  assert.strictEqual(g.player.travel, null);
  assert.deepStrictEqual(overlays(g), ['menu']);
});

test('Tab と HUD の仲間の欄でキャラクターを開き、C / Tab / Esc で閉じる (一時停止には戻らない)', () => {
  const g = newGame();
  for (const [open, close] of [['tab', 'c'], ['tab', 'Tab'], ['hud', 'Escape']]) {
    if (open === 'hud') { g.aiming = skill(g, '1'); clickHud(g, 'char'); assert.strictEqual(g.aiming, null); } else press(g, 'Tab');
    assert.strictEqual(openScreen(g), 'char');
    assert.strictEqual(textOf(g, 'menuTitle'), 'キャラクター');
    assert.ok(el(g, 'profile').innerHTML.includes('class="profile"'));
    assert.deepStrictEqual(overlays(g), ['menu']);
    const saves = trackSaves(g), n = saves.count;
    press(g, close);
    assertClosed(g, saves, n);
    assert.deepStrictEqual(overlays(g), []);
    assert.strictEqual(g.game.paused, false);
    saves.stop();
  }
});

test('一時停止: P / Esc で切り替え、止まっている間はフィールドのキーが効かない', () => {
  const g = newGame();
  const at = [g.player.tx, g.player.ty], t = g.game.time;
  press(g, 'p');
  assert.strictEqual(g.game.paused, true);
  assert.deepStrictEqual(overlays(g), ['pause']);
  assert.ok(textOf(g, 'saveWhere').length > 0);
  for (const k of ['d', 's', ' ', 'i', 'Tab', 'f', 'r', '1']) press(g, k);
  assert.deepStrictEqual([g.player.tx, g.player.ty], at);
  assert.strictEqual(g.game.time, t);
  assert.strictEqual(g.game.state, 'play');
  assert.strictEqual(g.aiming, null);
  assert.deepStrictEqual(overlays(g), ['pause']);
  press(g, 'Escape');
  assert.strictEqual(g.game.paused, false);
  assert.deepStrictEqual(overlays(g), []);
  press(g, 'Escape');
  assert.strictEqual(g.game.paused, true);
  clickButton(g, 'pause', 'resume');
  assert.strictEqual(g.game.paused, false);
  assert.deepStrictEqual(overlays(g), []);
});

test('スキルを構えているときの Esc は構えをやめるだけ (一時停止しない)', () => {
  const g = newGame();
  press(g, '1');
  assert.ok(g.aiming);
  press(g, 'Escape');
  assert.strictEqual(g.aiming, null);
  assert.strictEqual(g.game.paused, false);
});

test('一時停止から C / 「キャラクター」ボタンでキャラクターを開き、閉じると一時停止に戻る', () => {
  const g = newGame();
  for (const [open, close] of [['c', 'Escape'], ['button', 'c'], ['c', 'Tab'], ['button', 'close']]) {
    press(g, 'p');
    if (open === 'c') press(g, 'c'); else clickButton(g, 'pause', 'char');
    assert.strictEqual(openScreen(g), 'char');
    assert.deepStrictEqual(overlays(g), ['menu'], '一時停止の画面は隠れる');
    assert.strictEqual(g.game.paused, true);
    const saves = trackSaves(g), n = saves.count;
    if (close === 'close') clickButton(g, 'menu', 'close'); else press(g, close);
    assertClosed(g, saves, n);
    assert.strictEqual(g.game.paused, true);
    assert.deepStrictEqual(overlays(g), ['pause'], '一時停止の画面に戻る');
    saves.stop();
    press(g, 'p');
    assert.deepStrictEqual(overlays(g), []);
  }
});

test('一時停止中に開いたキャラクターの画面では道具の「使う」が出ない', () => {
  const g = newGame();
  g.player.hp = 1;
  press(g, 'p');
  press(g, 'c');
  assert.ok(!el(g, 'toolList').innerHTML.includes('data-act="use"'));
  clickTool(g, 'potion');
  assert.ok(shown(g, 'itemPop'));
  assert.ok(!el(g, 'itemPopBody').innerHTML.includes('data-act="use"'));
});

test('画面を開いている間はフィールドのキーが効かない (動かない・時間が進まない)', () => {
  const g = newGame();
  const at = [g.player.tx, g.player.ty], t = g.game.time;
  g.player.hp = 1;
  press(g, 'i');
  for (const k of ['d', 'w', ' ', 'r', 'p', 'm', 'Tab', '1', 'Enter', 'f']) press(g, k);
  assert.strictEqual(openScreen(g), 'inv');
  assert.deepStrictEqual([g.player.tx, g.player.ty], at);
  assert.strictEqual(g.game.time, t);
  assert.strictEqual(g.player.hp, 1);
  assert.strictEqual(g.game.paused, false);
  assert.strictEqual(g.worldMapOn, false);
  assert.strictEqual(g.aiming, null);
});

test('画面ごとの閉じるキー: 道具一覧は C / F で閉じない、キャラクターは I / F で閉じない', () => {
  const g = newGame();
  press(g, 'i');
  press(g, 'c'); press(g, 'f'); press(g, 'Tab');
  assert.strictEqual(openScreen(g), 'inv');
  press(g, 'Escape');
  press(g, 'Tab');
  press(g, 'i'); press(g, 'f');
  assert.strictEqual(openScreen(g), 'char');
  press(g, 'Escape');
  assert.strictEqual(openScreen(g), null);
});

test('押しっぱなし (repeat) のキーでは画面を閉じない', () => {
  const g = newGame();
  press(g, 'i');
  press(g, 'Escape', { repeat: true });
  press(g, 'i', { repeat: true });
  assert.strictEqual(openScreen(g), 'inv');
});

test('詳細のポップアップを開いているときの Esc はポップアップだけ閉じる', () => {
  const g = newGame();
  press(g, 'i');
  clickTool(g, 'potion');
  assert.deepStrictEqual(overlays(g), ['menu', 'itemPop']);
  const saves = trackSaves(g), n = saves.count;
  press(g, 'Escape');
  assert.deepStrictEqual(overlays(g), ['menu']);
  assert.strictEqual(openScreen(g), 'inv');
  assert.strictEqual(saves.count, n, 'ポップアップを閉じてもセーブしない');
  press(g, 'Escape');
  assert.strictEqual(openScreen(g), null);
  assert.ok(saves.count > n);
});

test('ポップアップを開いたまま I で閉じると、ポップアップも消える', () => {
  const g = newGame();
  press(g, 'i');
  clickTool(g, 'potion');
  press(g, 'i');
  assert.strictEqual(openScreen(g), null);
  assert.deepStrictEqual(overlays(g), []);
  press(g, 'i');
  assert.deepStrictEqual(overlays(g), ['menu'], '開き直してもポップアップは出ない');
});

// ----- NPC に話しかける -----
const NPC_SCREENS = [
  { id: 'merchant', mode: 'shop', overlay: 'menu', title: '始まりの町の商店' },
  { id: 'townSmith', mode: 'smith', overlay: 'menu', title: '始まりの町の鍛冶屋' },
  { id: 'herbalist', mode: 'shop', overlay: 'menu', title: '隠れ里の薬師' },
  { id: 'waySmith', mode: 'smith', overlay: 'menu', title: '宿場の鍛冶屋' },
  { id: 'captain', mode: 'quest', overlay: 'quest', title: '衛兵隊長' },
  { id: 'guildClerk', mode: 'quest', overlay: 'quest', title: 'ギルド受付' },
  { id: 'adventurer', mode: 'talk', overlay: 'talk', title: '冒険者' },
];
const titleOf = (g, mode) => textOf(g, mode === 'quest' ? 'questTitle' : mode === 'talk' ? 'talkName' : 'menuTitle');

for (const s of NPC_SCREENS) {
  test(`${s.id}: ぶつかる・となりで F で ${s.mode} の画面が開き、Esc で閉じる (行動にならない)`, () => {
    const g = newGame();
    for (const how of ['bump', 'f']) {
      const dir = nextToNpc(g, s.id);
      const at = [g.player.tx, g.player.ty], t = g.game.time;
      if (how === 'bump') step(g, dir[0], dir[1]); else press(g, 'f');
      assert.strictEqual(g.game.state, 'menu', how);
      assert.strictEqual(openScreen(g), s.mode);
      assert.deepStrictEqual(overlays(g), [s.overlay]);
      assert.strictEqual(titleOf(g, s.mode), s.title);
      assert.deepStrictEqual([g.player.tx, g.player.ty], at, '動かない');
      assert.strictEqual(g.game.time, t, '時間は進まない');
      assert.strictEqual(g.aiming, null);
      assert.strictEqual(g.player.travel, null);
      if (s.overlay === 'menu') assert.strictEqual(el(g, 'shopCol').style.display, '');
      const saves = trackSaves(g), n = saves.count;
      press(g, 'Escape');
      assertClosed(g, saves, n);
      assert.deepStrictEqual(overlays(g), []);
      saves.stop();
    }
  });
}

test('商人・鍛冶屋・クエストは F で閉じ、I / C / Tab では閉じない', () => {
  const g = newGame();
  for (const id of ['merchant', 'townSmith', 'captain']) {
    nextToNpc(g, id);
    press(g, 'f');
    const mode = openScreen(g);
    for (const k of ['i', 'c', 'Tab']) press(g, k);
    assert.strictEqual(openScreen(g), mode, id);
    const saves = trackSaves(g), n = saves.count;
    press(g, 'f');
    assertClosed(g, saves, n);
    saves.stop();
  }
});

test('話しかける人がいないときの F は文を出すだけ', () => {
  const g = newGame();
  const t = g.game.time;
  press(g, 'f');
  assert.strictEqual(openScreen(g), null);
  assert.strictEqual(g.game.time, t);
  assert.strictEqual(g.logLines[g.logLines.length - 1].text, '話しかけられる人がいない。となりのマスで F を押そう。');
});

test('会話: F / Enter / スペース / クリックで次へ、最後の言葉のあとで閉じる', () => {
  const g = newGame();
  const lines = g.WORLD.zones.townGuild.npcs.find((n) => n.id === 'adventurer').lines;
  assert.ok(lines.length >= 2, 'このテストは 2 行以上の会話を前提にする');
  for (const adv of [() => press(g, 'f'), () => press(g, 'Enter'), () => press(g, ' '), () => clickTalkText(g)]) {
    nextToNpc(g, 'adventurer');
    press(g, 'f');
    assert.strictEqual(textOf(g, 'talkText'), lines[0]);
    assert.strictEqual(textOf(g, 'talkNext'), `次へ（F）　1 / ${lines.length}`);
    assert.strictEqual(el(g, 'talkName').style.color, g.WORLD.zones.townGuild.npcs.find((n) => n.id === 'adventurer').color);
    const t = g.game.time, at = [g.player.tx, g.player.ty];
    for (let i = 1; i < lines.length; i++) {
      adv();
      assert.strictEqual(openScreen(g), 'talk');
      assert.strictEqual(textOf(g, 'talkText'), lines[i]);
    }
    assert.strictEqual(textOf(g, 'talkNext'), '閉じる（F）');
    const saves = trackSaves(g), n = saves.count;
    adv();
    assertClosed(g, saves, n);
    assert.deepStrictEqual(overlays(g), []);
    assert.strictEqual(g.game.time, t);
    assert.deepStrictEqual([g.player.tx, g.player.ty], at);
    saves.stop();
  }
});

test('会話: Esc / 閉じるでいつでも閉じる。I / 移動キーでは閉じない・動かない。押しっぱなしでは進まない', () => {
  const g = newGame();
  const lines = g.WORLD.zones.townGuild.npcs.find((n) => n.id === 'adventurer').lines;
  for (const close of [() => press(g, 'Escape'), () => clickButton(g, 'talk', 'close')]) {
    nextToNpc(g, 'adventurer');
    press(g, 'f');
    const at = [g.player.tx, g.player.ty];
    for (const k of ['i', 'c', 'Tab', 'd', 'w']) press(g, k);
    press(g, 'f', { repeat: true });
    assert.strictEqual(openScreen(g), 'talk');
    assert.strictEqual(textOf(g, 'talkText'), lines[0]);
    assert.deepStrictEqual([g.player.tx, g.player.ty], at);
    const saves = trackSaves(g), n = saves.count;
    close();
    assertClosed(g, saves, n);
    saves.stop();
  }
});

test('話しかけた NPC の画面を開いている間のキーはフィールドに漏れない', () => {
  const g = newGame();
  for (const id of ['merchant', 'captain', 'adventurer']) {
    nextToNpc(g, id);
    press(g, 'f');
    const at = [g.player.tx, g.player.ty], t = g.game.time;
    for (const k of ['d', 'a', 's', '.', 'p', 'r']) press(g, k);
    assert.deepStrictEqual([g.player.tx, g.player.ty], at, id);
    assert.strictEqual(g.game.time, t, id);
    assert.strictEqual(g.game.paused, false, id);
    press(g, 'Escape');
  }
});
