// セーブ (buildSave → migrateSave → applySave)
'use strict';
const assert = require('assert');
const { loadGame } = require('./harness');
const { newGame, plain, step, recompute } = require('./helpers');

// 遊んだ状態を作ってセーブする (JSON にして戻す = 実際の保存と同じ)
function playedSave() {
  const g = newGame(5);
  const p = g.player;
  p.level = 4;
  const base = plain(g.growthBase(4));
  base.maxHp += 1; base.str += 1;
  Object.assign(p.base, base);
  p.exp = 77;
  p.gold = 321;
  p.potions.potion = 7; p.potions.hiPotion = 2;
  p.inventory.push(g.makeItem('armor', 3, 'rare'), g.makeItem('accessory', 2, 'epic'));
  p.equip.accessory = g.makeItem('accessory', 4, 'common');
  p.materials.wolfPelt = 5; p.materials.honey = 2;
  p.quests.goblin = { state: 'claimed', count: 8 };
  p.quests.archer = { state: 'active', count: 3 };
  g.enterZone('plains', 30, 30);
  g.enterZone('waystation', 20, 16); // 町に入ると戻る先 (home) になる
  g.enterZone('plains', 31, 32);
  g.game.kills = 12;
  recompute(g, p);
  return { g, save: JSON.parse(JSON.stringify(g.buildSave())), base };
}

test('セーブを読み直すと、レベル・ステータス・お金・持ち物・装備・素材・クエスト・場所・戻る町が戻る', () => {
  const { g, save, base } = playedSave();
  const g2 = loadGame({ seed: 9 });
  const d = g2.migrateSave(save);
  assert.ok(d, '読める');
  g2.startGame(d);
  const p = g2.player, q = g.player;
  assert.strictEqual(p.level, 4);
  assert.strictEqual(p.exp, 77);
  assert.deepStrictEqual(plain(p.base), base);
  assert.strictEqual(p.gold, 321);
  assert.deepStrictEqual(plain(p.potions), { potion: 7, hiPotion: 2 });
  assert.deepStrictEqual(plain(p.inventory), plain(q.inventory));
  assert.deepStrictEqual(plain(p.equip), plain(q.equip));
  assert.deepStrictEqual(plain(p.materials), { wolfPelt: 5, honey: 2 });
  assert.deepStrictEqual(plain(p.quests), { goblin: { state: 'claimed', count: 8 }, archer: { state: 'active', count: 3 } });
  assert.strictEqual(g2.zone.id, 'plains');
  assert.deepStrictEqual([p.tx, p.ty], [31, 32]);
  assert.strictEqual(p.home, 'waystation');
  assert.strictEqual(g2.game.kills, 12);
  assert.strictEqual(g2.game.time, g.game.time);
  assert.deepStrictEqual(plain(p.stats), plain(q.stats), 'ステータスも同じ');
});

test('セーブの HP・MP はそのまま戻る (最大を超える分は切る)', () => {
  const { save } = playedSave();
  save.player.hp = 7.5; save.player.mp = 3.25;
  const g2 = loadGame();
  g2.startGame(g2.migrateSave(save));
  assert.strictEqual(g2.player.hp, 7.5);
  assert.strictEqual(g2.player.mp, 3.25);
  save.player.hp = 9999;
  const g3 = loadGame();
  g3.startGame(g3.migrateSave(save));
  assert.strictEqual(g3.player.hp, g3.player.stats.maxHp);
});

test('今はないゾーンにいたセーブは、戻る町のかがり火から始まる', () => {
  const { save } = playedSave();
  save.location = { zone: 'noSuchZone', tx: 3, ty: 3 };
  const g2 = loadGame();
  g2.startGame(g2.migrateSave(save));
  assert.strictEqual(g2.zone.id, 'waystation');
  const r = g2.WORLD.zones.waystation.respawn;
  assert.deepStrictEqual([g2.player.tx, g2.player.ty], [Math.floor(r.x / g2.T), Math.floor(r.y / g2.T)]);
  // 戻る町もおかしければ最初の町
  save.location = { zone: 'noSuchZone', tx: 3, ty: 3 };
  save.home = 'plains';
  const g3 = loadGame();
  g3.startGame(g3.migrateSave(save));
  assert.strictEqual(g3.zone.id, 'town');
});

test('版が違う・形がおかしいセーブは読まない', () => {
  const { g, save } = playedSave();
  assert.strictEqual(g.migrateSave({ ...save, v: 2 }), null);
  assert.strictEqual(g.migrateSave({ ...save, v: 0 }), null);
  assert.strictEqual(g.migrateSave({ ...save, player: undefined }), null);
  assert.strictEqual(g.migrateSave(null), null);
  assert.strictEqual(g.migrateSave('save'), null);
});

test('おかしな値は直して読む (目安から離れすぎたステータス・知らない素材・壊れた装備)', () => {
  const { save } = playedSave();
  save.player.base.str = 999;
  save.player.materials.unknownThing = 3;
  save.player.inventory.push({ slot: 'hat', stats: { atk: 1 } });
  const g2 = loadGame();
  g2.startGame(g2.migrateSave(save));
  assert.strictEqual(g2.player.base.str, g2.growthBase(4).str);
  assert.ok(!('unknownThing' in g2.player.materials));
  assert.strictEqual(g2.player.inventory.length, 2);
});

test('自動のセーブはブラウザの localStorage (zankai-turn-save) に書かれ、続きからで読める', () => {
  const g = newGame();
  step(g, 1, 0);
  g.player.gold = 77;
  g.saveGame();
  const raw = g.storage.get('zankai-turn-save');
  assert.ok(raw);
  assert.strictEqual(JSON.parse(raw).player.gold, 77);
  assert.strictEqual(g.readLocalSave().player.gold, 77);
});
