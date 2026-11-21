// 描画 (src/render.js / src/hud.js) がいろいろな場面で例外を出さないこと。
// 土台の canvas は何も描かないので、絵の見た目は確かめない (見た目はブラウザで確かめる。docs/testing.md)
'use strict';
const assert = require('assert');
const { loadGame } = require('./harness');
const {
  newGame, arena, addAlly, applyBuff, press, castAt, step, nextToNpc, useSkillBy, enemyAttack, setCooldown,
  renderFrame, hoverTile, hoverBuffIcon, fakeSpriteLoaded, dropAt, skill, teach,
} = require('./helpers');

// コンソールにエラーや [データの確認] が出ていない
function noProblems(g) {
  const bad = g.consoleLog.filter((m) => m.level === 'error' || m.text.includes('[データの確認]'));
  assert.deepStrictEqual(bad.map((m) => m.text), []);
}

// 戦いの場面: 敵 (ふつう・帰還中で無敵・当たって光る・強化つき)・ボス・予告中の敵 2 体・仲間・落とし物・出現予告・演出 (技・ダメージ・強化)
function battle(g) {
  const [wolf, boar, sal, golem, king, bee] = arena(g, {
    cols: 24, rows: 18, player: [10, 9], walls: [[3, 3, 1, 4]], water: [[15, 12, 2, 2]],
    enemies: [
      { type: 'wolf', at: [12, 9] }, { type: 'boar', at: [13, 6] }, { type: 'salamander', at: [6, 11] },
      { type: 'golem', at: [10, 12] }, { type: 'wolfKing', at: [16, 11], level: 6 }, { type: 'bee', at: [7, 6] },
    ],
  });
  for (const e of [boar, sal]) {
    const sk = e.def.attacks[0];
    setCooldown(g, e, sk, 0);
    assert.ok(useSkillBy(g, e, sk, g.player.tx, g.player.ty), `${e.name} が予告の技を構える`);
  }
  assert.ok(boar.charging && sal.charging && g.hazards.length >= 2);
  king.state = 'chase';                  // 上中央にボスの HP バーが出る
  bee.state = 'return'; bee.invuln = true; // 帰還中 (灰色の HP バー・半透明)
  golem.hitFlash = 0.1;                  // 当たった瞬間の白い光り
  applyBuff(g, golem, 'atkUp', 1);
  const ally = addAlly(g, [9, 9]);
  applyBuff(g, ally, 'atkUp', 2);
  castAt(g, '5', g.player.tx, g.player.ty); // 闘気 (自分に強化。輪と火花の演出)
  step(g, 1, 0);                         // ウルフを殴る (ダメージの数字と火花)
  dropAt(g, 11, 8, { kind: 'material', id: wolf.def.drops[0].id, amount: 2 });
  dropAt(g, 9, 7, { kind: 'item', item: g.makeItem('weapon', 3, 'rare') });
  assert.ok(g.player.buffs.length > 0, '主人公に強化がかかっている');
  return { wolf, king };
}

test('タイトル画面を描いても落ちない', () => {
  const g = loadGame();
  assert.strictEqual(g.game.state, 'title');
  renderFrame(g);
  noProblems(g);
});

test('町 (NPC・話しかける案内・NPC の説明・強化のアイコンの説明・はじめの大きい文字) と世界地図を描いても落ちない', () => {
  const g = newGame();
  renderFrame(g);
  nextToNpc(g, 'captain');
  applyBuff(g, g.player, 'atkUp', 3);
  const captain = g.zone.npcs.find((n) => n.id === 'captain');
  hoverTile(g, captain.tx, captain.ty);
  renderFrame(g);
  assert.ok(hoverBuffIcon(g), '仲間の欄に強化のアイコンがある');
  renderFrame(g);
  press(g, 'm');                         // 世界地図 (テスト用のゾーンは地図の位置がないので、本物のゾーンで)
  assert.ok(g.worldMapOn);
  renderFrame(g);
  noProblems(g);
});

test('戦いの場面 (敵・ボス・予告・仲間・落とし物・演出・敵の説明・スキルの範囲) を、図形でも絵でも描いても落ちない', () => {
  const g = newGame(3);
  const { wolf } = battle(g);
  assert.ok(g.effects.length > 0 && g.loots.length > 0);
  hoverTile(g, wolf.tx, wolf.ty);
  renderFrame(g);                        // 絵がまだない (図形で描く)
  fakeSpriteLoaded(g, g.PLAYER.sprite);
  for (const u of g.units) if (u.def) fakeSpriteLoaded(g, u.def.sprite);
  renderFrame(g);                        // 絵で描く
  teach(g, g.player, skill(g, '3').id);  // メテオ (投げる技。届く範囲の円も出す)
  g.player.mp = g.player.stats.maxMp;
  for (const key of ['1', '3', '4']) {   // スキルを構えて範囲を出す (弾・投げる・ダッシュ)
    press(g, key);
    assert.ok(g.aiming, key);
    renderFrame(g);
    press(g, 'escape');
  }
  noProblems(g);
});

test('画面 (道具一覧・キャラクター・一時停止) を開いたまま描いても落ちない', () => {
  const g = newGame();
  for (const key of ['i', 'tab']) {
    press(g, key);
    assert.strictEqual(g.game.state, 'menu', key);
    renderFrame(g);
    press(g, 'escape');
  }
  press(g, 'escape');                    // 一時停止
  assert.ok(g.game.paused);
  renderFrame(g);
  noProblems(g);
});
