// セーブ (buildSave → migrateSave → applySave)
'use strict';
const assert = require('assert');
const { loadGame } = require('./harness');
const { newGame, plain, step, recompute, bagOf } = require('./helpers');

// 遊んだ状態を作ってセーブする (JSON にして戻す = 実際の保存と同じ)
function playedSave() {
  const g = newGame(5);
  const p = g.player;
  p.level = 4;
  const base = plain(g.startBase());
  base.con += 9; base.str += 4.325; // 小数のまま残る
  Object.assign(p.base, base);
  p.potential.str = 87.5; p.potential.int = 140;
  p.exp = 77;
  p.gold = 321;
  bagOf(p).potion = 7; bagOf(p).hiPotion = 2;
  p.inventory.push(g.makeItem('armor', 3, 'rare'), g.makeItem('accessory', 2, 'epic'));
  p.equip.accessory = g.makeItem('accessory', 4, 'common');
  p.materials.wolfPelt = 5; p.materials.honey = 2;
  p.quests.c_wolf = { state: 'claimed', count: 8 };
  p.quests.c_bee = { state: 'active', count: 3 };
  g.enterZone('world', 21, 52);
  g.enterZone('waystation', 20, 16); // 町に入ると戻る先 (home) になる
  g.enterZone('world', 20, 50);
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
  assert.strictEqual(p.potential.str, 87.5);
  assert.strictEqual(p.potential.int, 140);
  assert.strictEqual(p.stats.str, Math.floor(base.str), '戦いで使うのは一の位まで');
  assert.strictEqual(p.gold, 321);
  assert.deepStrictEqual(plain(bagOf(p)), { potion: 7, hiPotion: 2 });
  assert.deepStrictEqual(plain(p.inventory), plain(q.inventory));
  assert.deepStrictEqual(plain(p.equip), plain(q.equip));
  assert.deepStrictEqual(plain(p.materials), { wolfPelt: 5, honey: 2 });
  assert.deepStrictEqual(plain(p.quests), { c_wolf: { state: 'claimed', count: 8 }, c_bee: { state: 'active', count: 3 } });
  assert.strictEqual(g2.zone.id, 'world');
  assert.deepStrictEqual([p.tx, p.ty], [20, 50]);
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

test('セーブの HP・MP の戻し方: HP は 0 より大きい数ならその値 (最大まで)、MP は数なら 0〜最大、それ以外は満タン', () => {
  const { save } = playedSave();
  const load = (hp, mp) => {
    const g2 = loadGame();
    g2.startGame(g2.migrateSave({ ...save, player: { ...save.player, hp, mp } }));
    return { hp: g2.player.hp, mp: g2.player.mp, maxHp: g2.player.stats.maxHp, maxMp: g2.player.stats.maxMp };
  };
  const full = load(null, null);
  assert.ok(full.hp > 1 && full.mp > 1);
  // 生きている主人公は HP 0 では戻せない (倒れている間のセーブは hp: null)。0 以下は満タン
  assert.strictEqual(load(0, 5).hp, full.maxHp, 'HP 0');
  assert.strictEqual(load(-3, 5).hp, full.maxHp, 'HP が負');
  assert.strictEqual(load(0.4, 5).hp, 0.4, 'HP 0.4 は切り上げも切り捨てもしない');
  assert.strictEqual(load(full.maxHp + 50, 5).hp, full.maxHp, 'HP が最大より大きい');
  for (const bad of [null, undefined, '5', 'x', true, [], {}]) assert.strictEqual(load(bad, 5).hp, full.maxHp, `HP ${JSON.stringify(bad)}`);
  // MP は 0 も戻す (技を使い切った状態)。負は 0、最大より大きければ最大
  assert.strictEqual(load(5, 0).mp, 0, 'MP 0');
  assert.strictEqual(load(5, -2).mp, 0, 'MP が負');
  assert.strictEqual(load(5, 0.4).mp, 0.4, 'MP 0.4');
  assert.strictEqual(load(5, full.maxMp + 50).mp, full.maxMp, 'MP が最大より大きい');
  for (const bad of [null, undefined, '5', 'x', true, [], {}]) assert.strictEqual(load(5, bad).mp, full.maxMp, `MP ${JSON.stringify(bad)}`);
});

test('今はないゾーンにいたセーブは、戻る町のかがり火から始まる', () => {
  const { save } = playedSave();
  save.location = { zone: 'noSuchZone', tx: 3, ty: 3 };
  const g2 = loadGame();
  g2.startGame(g2.migrateSave(save));
  assert.strictEqual(g2.zone.id, 'waystation');
  const r = g2.WORLD.zones.waystation.respawn;
  assert.deepStrictEqual([g2.player.tx, g2.player.ty], [Math.floor(r.x / g2.TILE), Math.floor(r.y / g2.TILE)]);
  // 戻る町もおかしければ最初の町
  save.location = { zone: 'noSuchZone', tx: 3, ty: 3 };
  save.home = 'world'; // 町でない (かがり火のない) ゾーン
  const g3 = loadGame();
  g3.startGame(g3.migrateSave(save));
  assert.strictEqual(g3.zone.id, 'town');
});

test('新しい版・古すぎる版・形がおかしいセーブは読まない', () => {
  const { g, save } = playedSave();
  assert.strictEqual(g.migrateSave({ ...save, v: g.SAVE_VERSION + 1 }), null);
  assert.strictEqual(g.migrateSave({ ...save, v: 0 }), null);
  assert.strictEqual(g.migrateSave({ ...save, player: undefined }), null);
  assert.strictEqual(g.migrateSave(null), null);
  assert.strictEqual(g.migrateSave('save'), null);
});

test('おかしな値は直して読む (上限を超えたステータス・範囲外の潜在・知らない素材・壊れた装備)', () => {
  const { save } = playedSave();
  save.player.base.str = 999;
  save.player.base.vit = 'x';
  save.player.potential.agi = 9999;
  save.player.potential.will = -5;
  save.player.materials.unknownThing = 3;
  save.player.inventory.push({ slot: 'hat', stats: { atk: 1 } });
  const g2 = loadGame();
  g2.startGame(g2.migrateSave(save));
  const G = g2.PARAMS.progression.growth;
  assert.strictEqual(g2.player.base.str, G.stats.str.max, '上限まで');
  assert.strictEqual(g2.player.base.vit, g2.PLAYER.stats.vit, '数でなければ Lv1 の値');
  assert.strictEqual(g2.player.potential.agi, G.potential.max);
  assert.strictEqual(g2.player.potential.will, G.potential.min);
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
