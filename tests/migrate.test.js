// セーブの形の移し替え (SAVE_MIGRATIONS)、使えないセーブ (新しい版・壊れたもの) の扱い、起動時にブラウザとサーバーのどちらを使うか
'use strict';
const assert = require('assert');
const { loadGame } = require('./harness');
const { plain, bagOf } = require('./helpers');

// 今のセーブの形の版 (src/save.js の SAVE_VERSION。版を上げたらここも上げる)
const CURRENT = 12;
// 形 v1 のセーブ (クエストの id が古い名前のころ)。そのまま書いておく
const V1_SAVE = {
  v: 1, savedAt: 1794000000000,
  player: {
    level: 5, exp: 420,
    base: { maxHp: 30, maxMp: 18, str: 13, vit: 6, agi: 26, int: 19 },
    hp: 21, mp: 9, gold: 210,
    potions: { potion: 5, hiPotion: 1 },
    inventory: [{ id: 'fx-1', slot: 'armor', name: '革の鎧', rarity: 'rare', level: 3, stats: { def: 3, maxHp: 4, vit: 1 } }],
    materials: { wolfPelt: 6, beeStinger: 4 },
    equip: {
      weapon: { id: 'fx-2', slot: 'weapon', name: '銅の剣', rarity: 'common', level: 2, stats: { atk: 3 } },
      armor: null,
      accessory: { id: 'fx-3', slot: 'accessory', name: '銀の指輪', rarity: 'epic', level: 4, stats: { critMult: 0.1, agi: 2 } },
    },
    quests: {
      goblin: { state: 'claimed', count: 8 },
      archer: { state: 'claimed', count: 5 },
      mage: { state: 'ready', count: 6 },
      g_trial: { state: 'claimed', count: 3 },
      g_boar: { state: 'active', count: 2 },
    },
  },
  progress: { kills: 70, time: 1352.5 },
  location: { zone: 'world', tx: 20, ty: 50 },
  home: 'waystation',
};
const V2_QUESTS = {
  c_wolf: { state: 'claimed', count: 8 },
  c_bee: { state: 'claimed', count: 5 },
  c_salamander: { state: 'ready', count: 6 },
  g_trial: { state: 'claimed', count: 3 },
  g_boar: { state: 'active', count: 2 },
};
// 形 v2 のセーブ (覚えたスキルを保存する前)。レベルだけ変えて使う。そのまま書いておく
const V2_SAVE = {
  v: 2, savedAt: 1794500000000,
  player: {
    level: 4, exp: 100,
    base: { maxHp: 28, maxMp: 17, str: 13, vit: 5, agi: 24, int: 16 },
    hp: 20, mp: 10, gold: 150,
    potions: { potion: 3, hiPotion: 0 },
    inventory: [],
    materials: { wolfPelt: 2 },
    equip: { weapon: { id: 'fx-9', slot: 'weapon', name: '銅の剣', rarity: 'common', level: 2, stats: { atk: 3 } }, armor: null, accessory: null },
    quests: { c_wolf: { state: 'claimed', count: 8 }, c_bee: { state: 'active', count: 1 } },
  },
  progress: { kills: 40, time: 800 },
  location: { zone: 'world', tx: 20, ty: 50 },
  home: 'town',
};
// 形 v3 のセーブ (道具の数がまだ player.potions だったころ)。今はない道具の id も入っている。そのまま書いておく
const V3_SAVE = {
  v: 3, savedAt: 1795000000000,
  player: {
    level: 6, exp: 300,
    base: { maxHp: 32, maxMp: 19, str: 14, vit: 6, agi: 28, int: 20 },
    hp: 25, mp: 12, gold: 480,
    potions: { potion: 12, hiPotion: 4, oldElixir: 2 },
    inventory: [],
    materials: { stoneShard: 3 },
    equip: { weapon: null, armor: null, accessory: null },
    quests: { c_wolf: { state: 'claimed', count: 8 } },
    knownSkills: ['shockwave', 'whirlwind', 'meteor', 'dash', 'battleAura'],
  },
  progress: { kills: 120, time: 2400 },
  location: { zone: 'world', tx: 21, ty: 52 },
  home: 'hamlet',
};
// 形 v4 のセーブ (ステータスがレベルアップで伸びていたころ。潜在 potential・熟練度 train がない)。そのまま書いておく
const V4_SAVE = {
  v: 4, savedAt: 1796000000000,
  player: {
    level: 7, exp: 100,
    base: { maxHp: 36, maxMp: 22, str: 16, vit: 6, agi: 29, int: 23 },
    hp: 30, mp: 20, gold: 600,
    consumables: { potion: 3 },
    inventory: [],
    materials: {},
    equip: { weapon: null, armor: null, accessory: null },
    quests: {},
    knownSkills: ['shockwave', 'whirlwind', 'meteor', 'dash', 'battleAura'],
  },
  progress: { kills: 150, time: 3000 },
  location: { zone: 'world', tx: 21, ty: 52 },
  home: 'town',
};
// 形 v5 のセーブ (熟練度 train があり、10 たまると +1 だったころ)
const V5_SAVE = {
  ...V4_SAVE, v: 5,
  player: { ...V4_SAVE.player, potential: { str: 120 }, train: { str: 2.5, vit: 9, int: 'x' } },
};
// 形 v6 のセーブ (さいだいHP・さいだいMP を行動で伸ばしていたころ)
const V6_SAVE = {
  ...V4_SAVE, v: 6,
  player: { ...V4_SAVE.player, base: { ...V4_SAVE.player.base, maxHp: 37.5 }, potential: { maxHp: 130, maxMp: 90, str: 120 } },
};
// 形 v7 のセーブ (知力 wis が かしこさ int と別にあったころ)
const V7_SAVE = {
  ...V4_SAVE, v: 7,
  player: { ...V4_SAVE.player, base: { con: 19, will: 18, wis: 25, spi: 20, str: 16, vit: 6, agi: 29, int: 23 }, potential: { wis: 150, spi: 110 } },
};
// v7 で さいだいHP は 意思 (整数部分の半分、切り捨て) と 体力 (残り) に、さいだいMP は 知力 wis・精神力 にそのまま移り、
// v8 で wis をやめて 精神力 に wis − int を足す (精神力 = 2 × さいだいMP − int)
function v8Base(b) {
  const { maxHp, maxMp, ...rest } = b;
  const will = Math.floor(Math.floor(maxHp) / 2);
  return withMag({ ...rest, con: maxHp - will, will, spi: maxMp + maxMp - b.int });
}
// v9 で 魔力 = (知力 + 精神力) ÷ 2 の切り捨て − ÷ 3 の切り捨て を足す (同じ さいだいMP)
// v10 で ちから str を 筋力・器用さ の両方に移す (同じ ちから)。v11 で みのまもり vit を消す (計算で決まる)
function withMag(b) {
  const sum = Math.floor(b.int) + Math.floor(b.spi);
  const { str, vit, ...rest } = b;
  return { ...rest, mag: Math.floor(sum / 2) - Math.floor(sum / 3), mus: str, dex: str };
}
const copy = (x) => JSON.parse(JSON.stringify(x));
// 起動時の initSave → refreshTitle が終わるまで待つ
const settle = () => new Promise((r) => setTimeout(r, 0));
const title = (g) => ({ continueShown: g.elements.continueBtn.style.display !== 'none', info: g.elements.saveInfo.textContent });

test('v1 のセーブは今の形に直して読め、クエストの進み具合が新しい id でそのまま戻る', () => {
  const g = loadGame();
  const d = g.migrateSave(copy(V1_SAVE));
  assert.ok(d, '読める');
  assert.strictEqual(d.v, CURRENT);
  assert.deepStrictEqual(plain(d.player.quests), V2_QUESTS);
  assert.deepStrictEqual(plain(d.player.knownSkills), ['shockwave', 'whirlwind', 'dash', 'battleAura'], 'Lv5 なのでメテオ (Lv6) 以外');
  assert.deepStrictEqual(plain(d.player.consumables), { potion: 5, hiPotion: 1 }, 'v4: 回復薬の数は道具の数に移る');
  assert.ok(!('potions' in d.player));
  g.startGame(d);
  const p = g.player;
  assert.strictEqual(p.level, 5);
  assert.strictEqual(p.exp, 420);
  assert.deepStrictEqual(plain(p.base), v8Base(V1_SAVE.player.base));
  assert.strictEqual(p.hp, 21);
  assert.strictEqual(p.mp, 9);
  assert.strictEqual(p.gold, 210);
  assert.deepStrictEqual(plain(bagOf(p)), { potion: 5, hiPotion: 1 });
  assert.deepStrictEqual(plain(p.inventory), V1_SAVE.player.inventory);
  // v12 で武器に種類 (剣) が付く
  const sword = (eq) => ({ ...eq, weapon: eq.weapon && { ...eq.weapon, type: 'sword' } });
  assert.deepStrictEqual(plain(p.equip), sword(V1_SAVE.player.equip));
  assert.deepStrictEqual(plain(p.materials), { wolfPelt: 6, beeStinger: 4 });
  assert.deepStrictEqual(plain(p.quests), V2_QUESTS);
  assert.strictEqual(g.questStatus(g.questById('c_salamander')), 'ready');
  assert.strictEqual(g.questStatus(g.questById('c_wolfKing')), 'locked', '前のクエストを報告するまでは受けられない');
  assert.strictEqual(g.zone.id, 'world');
  assert.deepStrictEqual([p.tx, p.ty], [20, 50]);
  assert.strictEqual(p.home, 'waystation');
  assert.strictEqual(g.game.kills, 70);
  assert.strictEqual(g.game.time, 1352.5);
  assert.deepStrictEqual(Array.from(p.knownSkills), ['shockwave', 'whirlwind', 'dash', 'battleAura']);
});

test('v1 から読んだあとのセーブは今の形で書かれ、読み直しても同じ', () => {
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V1_SAVE) } });
  assert.strictEqual(g.readLocalSave().v, CURRENT);
  g.startGame(g.readLocalSave());
  const saved = JSON.parse(g.storage.get('zankai-turn-save'));
  assert.strictEqual(saved.v, CURRENT);
  assert.deepStrictEqual(saved.player.quests, V2_QUESTS);
  assert.ok(!('goblin' in saved.player.quests));
  const g2 = loadGame();
  const d = g2.migrateSave(copy(saved));
  assert.deepStrictEqual(plain(d), saved, '今の形のセーブはそのまま読める');
  g2.startGame(d);
  const again = plain(g2.buildSave());
  delete again.savedAt; delete saved.savedAt;
  assert.deepStrictEqual(again, saved, '読んでからまた書いても同じ');
});

test('v1 → v2 は衛兵隊長の 7 つのクエストの id を変え、ほかは変えない', () => {
  const g = loadGame();
  const quests = {
    goblin: { state: 'claimed', count: 8 }, archer: { state: 'claimed', count: 5 }, mage: { state: 'claimed', count: 6 },
    king: { state: 'claimed', count: 1 }, ogre: { state: 'claimed', count: 6 }, treant: { state: 'ready', count: 1 },
    warlord: { state: 'active', count: 0 }, g_wolf: { state: 'active', count: 4 }, someOldQuest: { state: 'active', count: 1 },
  };
  const d = g.SAVE_MIGRATIONS[1]({ v: 1, player: { quests: copy(quests) } });
  assert.deepStrictEqual(plain(d.player.quests), {
    c_wolf: quests.goblin, c_bee: quests.archer, c_salamander: quests.mage, c_wolfKing: quests.king,
    c_golem: quests.ogre, c_treant: quests.treant, c_dragon: quests.warlord, g_wolf: quests.g_wolf, someOldQuest: quests.someOldQuest,
  });
  for (const id of Object.keys(d.player.quests)) if (id.startsWith('c_')) assert.ok(g.questById(id), `${id} は data/quests.js にある`);
  // ない項目があっても落ちない
  assert.doesNotThrow(() => g.SAVE_MIGRATIONS[1]({ v: 1 }));
  assert.doesNotThrow(() => g.SAVE_MIGRATIONS[1]({ v: 1, player: { quests: null } }));
  // 今のデータに、どの形の直し方もそろっている
  assert.deepStrictEqual(g.consoleLog.filter((l) => l.text.includes('[データの確認]')), []);
});

test('v2 のセーブは、保存したレベルではじめの覚え方 (レベル) で覚えていたスキルを覚えた形に直る (Lv1・Lv4・Lv7)', () => {
  const expected = {
    1: ['shockwave', 'dash', 'battleAura'],
    4: ['shockwave', 'whirlwind', 'dash', 'battleAura'],
    7: ['shockwave', 'whirlwind', 'meteor', 'dash', 'battleAura'],
  };
  for (const lv of [1, 4, 7]) {
    const raw = { ...copy(V2_SAVE), player: { ...copy(V2_SAVE.player), level: lv } };
    const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(raw) } });
    const d = g.readLocalSave();
    assert.strictEqual(d.v, CURRENT);
    assert.deepStrictEqual(plain(d.player.knownSkills), expected[lv], `Lv${lv}`);
    assert.deepStrictEqual(plain(d.player.consumables), V2_SAVE.player.potions);
    g.startGame(d);
    const p = g.player;
    assert.strictEqual(p.level, lv);
    assert.deepStrictEqual(Array.from(p.knownSkills), expected[lv], `Lv${lv}: 読んだあと`);
    assert.deepStrictEqual(plain(p.quests), V2_SAVE.player.quests);
    assert.deepStrictEqual(plain(p.equip), { ...V2_SAVE.player.equip, weapon: { ...V2_SAVE.player.equip.weapon, type: 'sword' } }, 'v12 で武器に種類 (剣) が付く');
    // 書いたものは今の形で、読み直してまた書いても同じ
    const saved = JSON.parse(g.storage.get('zankai-turn-save'));
    assert.strictEqual(saved.v, CURRENT);
    assert.deepStrictEqual(saved.player.knownSkills, expected[lv]);
    const g2 = loadGame();
    const d2 = g2.migrateSave(copy(saved));
    assert.deepStrictEqual(plain(d2), saved, '今の形のセーブはそのまま読める');
    g2.startGame(d2);
    const again = plain(g2.buildSave());
    delete again.savedAt; delete saved.savedAt;
    assert.deepStrictEqual(again, saved, `Lv${lv}: 読んでからまた書いても同じ`);
  }
  // ない項目があっても落ちない
  const g = loadGame();
  assert.doesNotThrow(() => g.SAVE_MIGRATIONS[2]({ v: 2 }));
  assert.deepStrictEqual(plain(g.SAVE_MIGRATIONS[2]({ v: 2, player: { level: 'x' } }).player.knownSkills), expected[1]);
});

test('v3 のセーブは、回復薬の数 (potions) が道具の数 (consumables) に移る。今はない道具は読むときに捨て、上限までにする', () => {
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V3_SAVE) } });
  const d = g.readLocalSave();
  assert.strictEqual(d.v, CURRENT);
  assert.deepStrictEqual(plain(d.player.consumables), { potion: 12, hiPotion: 4, oldElixir: 2 }, '直し方は今のデータを見ない');
  assert.ok(!('potions' in d.player));
  assert.deepStrictEqual(plain(d.player.knownSkills), V3_SAVE.player.knownSkills);
  g.startGame(d);
  const p = g.player;
  assert.deepStrictEqual(plain(bagOf(p)), { potion: 12, hiPotion: 4 });
  assert.strictEqual(p.gold, 480);
  assert.strictEqual(g.zone.id, 'world');
  // 書いたものは今の形で、読み直してまた書いても同じ
  const saved = JSON.parse(g.storage.get('zankai-turn-save'));
  assert.strictEqual(saved.v, CURRENT);
  assert.deepStrictEqual(saved.player.consumables, { potion: 12, hiPotion: 4 });
  assert.ok(!('potions' in saved.player));
  const g2 = loadGame();
  const d2 = g2.migrateSave(copy(saved));
  assert.deepStrictEqual(plain(d2), saved, '今の形のセーブはそのまま読める');
  g2.startGame(d2);
  const again = plain(g2.buildSave());
  delete again.savedAt; delete saved.savedAt;
  assert.deepStrictEqual(again, saved, '読んでからまた書いても同じ');
  // 持てる数を超えていたら上限まで
  const g3 = loadGame();
  g3.startGame(g3.migrateSave({ ...copy(V3_SAVE), player: { ...copy(V3_SAVE.player), potions: { potion: 99, hiPotion: -3 } } }));
  assert.deepStrictEqual(plain(bagOf(g3.player)), { potion: g3.ITEMS.consumables.potion.max, hiPotion: 0 });
});

test('v3 → v4: 数だけ (v1 より前の形) は回復薬 potion の数にし、ない・おかしいときは空にする', () => {
  const g = loadGame();
  const m = (player) => plain(g.SAVE_MIGRATIONS[3]({ v: 3, player }).player);
  assert.deepStrictEqual(m({ potions: 7 }), { consumables: { potion: 7 } });
  assert.deepStrictEqual(m({ potions: { potion: 1, hiPotion: 2 } }), { consumables: { potion: 1, hiPotion: 2 } });
  assert.deepStrictEqual(m({}), { consumables: {} });
  assert.deepStrictEqual(m({ potions: 'a' }), { consumables: {} });
  assert.deepStrictEqual(m({ potions: null }), { consumables: {} });
  assert.deepStrictEqual(m({ potions: [3] }), { consumables: {} });
  assert.doesNotThrow(() => g.SAVE_MIGRATIONS[3]({ v: 3 }));
  assert.doesNotThrow(() => g.SAVE_MIGRATIONS[3]({ v: 3, player: null }));
  // v1 のセーブに数だけ書いてあっても、版の移し替えを通って読める
  const d = g.migrateSave({ ...copy(V1_SAVE), player: { ...copy(V1_SAVE.player), potions: 6 } });
  assert.deepStrictEqual(plain(d.player.consumables), { potion: 6 });
  g.startGame(d);
  assert.deepStrictEqual(plain(bagOf(g.player)), { potion: 6, hiPotion: 0 });
});

test('読むときに渡されたセーブは書き換えない', () => {
  const g = loadGame();
  const input = copy(V1_SAVE);
  input.location = { zone: 'noSuchZone', tx: 3, ty: 3 }; // ゾーンの付け替えも通す
  const before = JSON.stringify(input);
  const d = g.migrateSave(input);
  assert.strictEqual(JSON.stringify(input), before);
  assert.notStrictEqual(d, input);
  assert.strictEqual(d.location.zone, 'waystation');
});

test('壊れた・形のおかしいセーブは落ちずに「読めない」になる', () => {
  const g = loadGame();
  for (const bad of [null, undefined, 'save', 42, [], {}, { v: '1' }, { v: 1.5 }, { v: 1 }, { v: 0, player: {}, progress: {}, location: {} },
    { v: 1, player: null, progress: {}, location: {} }, { v: 1, player: 5, progress: {}, location: {} }, { v: 2, player: {}, progress: 'x', location: {} }]) {
    assert.strictEqual(g.migrateSave(bad), null, JSON.stringify(bad));
  }
  assert.deepStrictEqual(plain(g.readSave(null)), {}, 'null はセーブなし');
  assert.strictEqual(g.readSave({ v: 1 }).problem, 'broken');
  assert.deepStrictEqual(plain(g.readSave({ v: CURRENT + 1, player: {} })), { problem: 'newer', v: CURRENT + 1 });
  // 中身がなくても、型がおかしくても、始められる
  const empty = g.migrateSave({ v: 1, player: {}, progress: {}, location: {} });
  assert.ok(empty);
  assert.doesNotThrow(() => g.startGame(empty));
  assert.strictEqual(g.player.level, 1);
  assert.strictEqual(g.zone.id, 'town');
  const g2 = loadGame();
  const odd = g2.migrateSave({ v: 1, player: { level: 'x', inventory: 'x', equip: 5, materials: null, quests: 3, potions: 'a', base: 7, hp: 'x', mp: 'x' },
    progress: { kills: null }, location: { zone: 'world', tx: 20, ty: 50 } });
  assert.doesNotThrow(() => g2.startGame(odd));
  assert.strictEqual(g2.player.hp, g2.player.stats.maxHp);
  assert.deepStrictEqual(plain(g2.player.inventory), []);
});

test('新しい版のゲームのセーブは読まず、タイトルを開いただけでは上書きしない', async () => {
  const newer = { ...copy(V1_SAVE), v: CURRENT + 1, savedAt: 1795000000000, party: ['someone'] };
  const raw = JSON.stringify(newer);
  const g = loadGame({ storage: { 'zankai-turn-save': raw }, server: { save: copy(newer) } });
  await settle();
  assert.strictEqual(g.saveStore.cached, null);
  assert.strictEqual(title(g).continueShown, false);
  assert.ok(title(g).info.includes('新しい版'), title(g).info);
  assert.strictEqual(g.storage.get('zankai-turn-save'), raw);
  assert.strictEqual(g.storage.get('zankai-turn-save-unread'), raw, '控えも残す');
  assert.deepStrictEqual(g.server.puts, []);
  g.saveGame(); // タイトルでは保存しない
  assert.strictEqual(g.storage.get('zankai-turn-save'), raw);
  // 「はじめから」を確認でやめたら上書きしない。選んだら上書きする
  g.set('confirm', () => false);
  await g.elements.startBtn.onclick();
  assert.strictEqual(g.game.state, 'title');
  assert.strictEqual(g.storage.get('zankai-turn-save'), raw);
  g.set('confirm', () => true);
  await g.elements.startBtn.onclick();
  assert.strictEqual(g.game.state, 'play');
  assert.strictEqual(JSON.parse(g.storage.get('zankai-turn-save')).v, CURRENT);
  assert.strictEqual(g.storage.get('zankai-turn-save-unread'), raw);
});

test('サーバーに新しい版のセーブがあれば、ブラウザの古い版のセーブがあってもサーバーへ送らない', async () => {
  const newer = { ...copy(V1_SAVE), v: CURRENT + 1, savedAt: 1 };
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V1_SAVE) }, server: { save: newer } });
  await settle();
  assert.strictEqual(g.saveStore.cached, null);
  assert.strictEqual(title(g).continueShown, false);
  assert.ok(title(g).info.includes('サーバー（saves/save.json）のセーブデータは新しい版'), title(g).info);
  assert.deepStrictEqual(g.server.puts, []);
});

test('壊れたセーブしかないときは、タイトルで読めなかったことを知らせる', async () => {
  const g = loadGame({ storage: { 'zankai-turn-save': '{"v":1,"player":' } });
  await settle();
  assert.strictEqual(title(g).continueShown, false);
  assert.ok(title(g).info.includes('読めませんでした'), title(g).info);
  assert.strictEqual(g.storage.get('zankai-turn-save-unread'), '{"v":1,"player":');
  // もう一方に使えるセーブがあれば、それで続きから遊べる
  const g2 = loadGame({ storage: { 'zankai-turn-save': '{"v":1}' }, server: { save: copy(V1_SAVE) } });
  await settle();
  assert.strictEqual(title(g2).continueShown, true);
  assert.ok(title(g2).info.includes('もう一方のセーブを使います'), title(g2).info);
  assert.deepStrictEqual(plain(g2.saveStore.cached.player.quests), V2_QUESTS);
});

test('ブラウザが v1・サーバーが今の形でも、直してから savedAt の新しいほうを使う', async () => {
  const g = loadGame();
  g.startGame(g.migrateSave(copy(V1_SAVE)));
  g.player.gold = 999;
  const v2 = plain(g.buildSave()); // 今の形
  // サーバー (今の形) のほうが新しい
  const a = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V1_SAVE) }, server: { save: { ...v2, savedAt: V1_SAVE.savedAt + 1 } } });
  await settle();
  assert.strictEqual(a.saveStore.cached.player.gold, 999);
  assert.deepStrictEqual(a.server.puts, []);
  assert.ok(a.elements.continueBtn.textContent.includes('Lv 5'));
  // ブラウザ (v1) のほうが新しい: ブラウザのものを今の形に直して使い、サーバーにも今の形で送る
  const b = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V1_SAVE) }, server: { save: { ...v2, savedAt: V1_SAVE.savedAt - 1 } } });
  await settle();
  assert.strictEqual(b.saveStore.cached.player.gold, 210);
  assert.strictEqual(b.server.puts.length, 1);
  assert.strictEqual(b.server.puts[0].v, CURRENT);
  assert.deepStrictEqual(b.server.puts[0].player.quests, V2_QUESTS);
  assert.strictEqual(b.server.puts[0].savedAt, V1_SAVE.savedAt);
});

test('v4 のセーブは、成長した値 (base) をそのまま残し、潜在ははじめの値で始まる', () => {
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V4_SAVE) } });
  const d = g.readLocalSave();
  assert.strictEqual(d.v, CURRENT);
  assert.deepStrictEqual(plain(d.player.potential), {});
  assert.ok(!('train' in d.player));
  g.startGame(d);
  const p = g.player;
  assert.deepStrictEqual(plain(p.base), v8Base(V4_SAVE.player.base));
  assert.deepStrictEqual(plain(p.potential), plain(g.startPotential()));
  assert.strictEqual(p.level, 7);
  const saved = JSON.parse(g.storage.get('zankai-turn-save'));
  assert.strictEqual(saved.v, CURRENT);
  assert.deepStrictEqual(saved.player.potential, plain(g.startPotential()));
});

test('v5 のセーブは、熟練度 / 10 を伸びた値 (base) に小数で足して、熟練度を消す', () => {
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V5_SAVE) } });
  const d = g.readLocalSave();
  assert.strictEqual(d.v, CURRENT);
  assert.ok(!('train' in d.player));
  const b = v8Base(V4_SAVE.player.base);
  assert.deepStrictEqual(plain(d.player.base), { ...b, mus: b.mus + 0.25, dex: b.dex + 0.25 }, '数でない熟練度は捨てる');
  g.startGame(d);
  assert.strictEqual(g.player.base.mus, b.mus + 0.25);
  assert.strictEqual(g.player.stats.str, b.mus, 'ちから は v5 と同じ');
  assert.strictEqual(g.player.potential.mus, 120);
  assert.strictEqual(g.player.potential.dex, 120);
});

test('v6 のセーブは、さいだいHP を 体力・意思 に、さいだいMP を 精神力 (と 知力) に移し、さいだいHP・MP は同じまま', () => {
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V6_SAVE) } });
  const d = g.readLocalSave();
  assert.strictEqual(d.v, CURRENT);
  const old = V6_SAVE.player.base;
  assert.deepStrictEqual(plain(d.player.base), v8Base(old));
  assert.deepStrictEqual(plain(d.player.potential), { mus: 120, dex: 120, con: 130, will: 130, spi: 90 }, '潜在も写す (v8 で wis は消える)');
  g.startGame(d);
  const p = g.player;
  assert.deepStrictEqual([p.base.con, p.base.will], [19.5, 18], '37.5 → 体力 19.5・意思 18');
  assert.strictEqual(p.stats.maxHp, Math.floor(old.maxHp), '装備なしなので さいだいHP は v6 と同じ 37');
  assert.strictEqual(p.stats.maxMp, old.maxMp);
  assert.strictEqual(p.potential.con, 130);
  const saved = JSON.parse(g.storage.get('zankai-turn-save'));
  assert.ok(!('maxHp' in saved.player.base) && !('maxHp' in saved.player.potential));
});

test('v7 のセーブは、知力 wis を消して 精神力 に wis − かしこさ を足す (かしこさ が 知力 になる。(知力 + 精神力) は前と同じ)', () => {
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V7_SAVE) } });
  const d = g.readLocalSave();
  assert.strictEqual(d.v, CURRENT);
  const { wis, ...rest } = V7_SAVE.player.base;
  assert.deepStrictEqual(plain(d.player.base), withMag({ ...rest, spi: 20 + 25 - 23 }));
  assert.deepStrictEqual(plain(d.player.potential), { spi: 110 });
  g.startGame(d);
  const p = g.player;
  assert.strictEqual(p.stats.maxMp, Math.floor((25 + 20) / 2), '前の (wis + 精神力) ÷ 2 = 22.5 の切り捨て (v7 は四捨五入だったので 23 → 22)');
  assert.strictEqual(p.stats.int, 23, 'かしこさ の値がそのまま 知力');
  const saved = JSON.parse(g.storage.get('zankai-turn-save'));
  assert.ok(!('wis' in saved.player.base) && !('wis' in saved.player.potential));
});

test('v8 のセーブは、魔力 を (知力 + 精神力) ÷ 2 の切り捨て − ÷ 3 の切り捨て で足し、さいだいMP は同じまま', () => {
  const V8_SAVE = { ...V4_SAVE, v: 8, player: { ...V4_SAVE.player, base: { con: 19, will: 18, spi: 30.6, str: 16, vit: 6, agi: 29, int: 23 }, potential: { spi: 110 } } };
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V8_SAVE) } });
  const d = g.readLocalSave();
  assert.strictEqual(d.v, CURRENT);
  assert.strictEqual(d.player.base.mag, Math.floor(53 / 2) - Math.floor(53 / 3), '23 + 30 = 53 → 26 − 17 = 9');
  g.startGame(d);
  assert.strictEqual(g.player.stats.maxMp, Math.floor((23 + 30) / 2), 'v8 の さいだいMP 26 のまま');
  assert.strictEqual(g.player.potential.mag, g.startPotential().mag, '魔力の潜在ははじめの値');
});

test('v9 のセーブは、ちから を 筋力・器用さ の両方に移し (潜在も)、ちから は同じまま', () => {
  const V9_SAVE = { ...V4_SAVE, v: 9, player: { ...V4_SAVE.player, base: { con: 19, will: 18, mag: 8, spi: 21, str: 17.4, vit: 6, agi: 29, int: 23 }, potential: { str: 130 } } };
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V9_SAVE) } });
  const d = g.readLocalSave();
  assert.strictEqual(d.v, CURRENT);
  assert.ok(!('str' in d.player.base) && !('str' in d.player.potential));
  assert.deepStrictEqual([d.player.base.mus, d.player.base.dex], [17.4, 17.4]);
  assert.deepStrictEqual(plain(d.player.potential), { mus: 130, dex: 130 });
  g.startGame(d);
  assert.strictEqual(g.player.stats.str, 17, 'v9 の ちから 17 のまま (17 × 0.7 + 17 × 0.3)');
});

test('v10 のセーブは、みのまもり (伸びた値・潜在) を消す。ほかの値はそのままで、みのまもり は 筋力・器用さ から計算する', () => {
  const base = { con: 19, will: 18, mag: 8, spi: 21, mus: 20, dex: 15, vit: 9.5, agi: 29, int: 23 };
  const V10_SAVE = { ...V4_SAVE, v: 10, player: { ...V4_SAVE.player, base, potential: { mus: 130, vit: 140 } } };
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V10_SAVE) } });
  const d = g.readLocalSave();
  assert.strictEqual(d.v, CURRENT);
  const { vit, ...rest } = base;
  assert.deepStrictEqual(plain(d.player.base), rest);
  assert.deepStrictEqual(plain(d.player.potential), { mus: 130 });
  g.startGame(d);
  assert.strictEqual(g.player.stats.vit, 7.6, 'みのまもり = 筋力 × 0.32 + 器用さ × 0.08 = 7.6');
  assert.strictEqual(g.player.stats.str, 18.5, 'ちから は同じ式のまま 18.5');
});

test('v11 のセーブは、種類 (武器種) のない武器を剣 (type: sword) にする。防具・装飾品はそのまま、種類のある武器は変えない', () => {
  const V11_SAVE = { ...V4_SAVE, v: 11, player: { ...V4_SAVE.player,
    inventory: [
      { id: 'fx-a', slot: 'weapon', name: '鉄の剣', rarity: 'rare', level: 5, stats: { atk: 5, luk: 6 } },
      { id: 'fx-b', slot: 'armor', name: '革の鎧', rarity: 'common', level: 3, stats: { def: 2, maxHp: 2 } },
      { id: 'fx-c', slot: 'weapon', type: 'axe', name: '手斧', rarity: 'common', level: 1, stats: { atk: 2, agi: -3 } },
    ],
    equip: { weapon: { id: 'fx-d', slot: 'weapon', name: '銅の剣', rarity: 'common', level: 2, stats: { atk: 2 } }, armor: null, accessory: null } } };
  const g = loadGame({ storage: { 'zankai-turn-save': JSON.stringify(V11_SAVE) } });
  const d = g.readLocalSave();
  assert.strictEqual(d.v, CURRENT);
  assert.deepStrictEqual(plain(d.player.inventory.map((it) => it.type || null)), ['sword', null, 'axe']);
  assert.strictEqual(d.player.equip.weapon.type, 'sword');
  g.startGame(d);
  assert.strictEqual(g.player.equip.weapon.name, '銅の剣');
  assert.deepStrictEqual(plain(g.player.inventory.map((it) => it.id)), ['fx-a', 'fx-b', 'fx-c']);
});

test('今はない種類 (武器種) の武器は、読むときに捨てる', () => {
  const g = loadGame();
  g.startGame(null);
  const s = g.buildSave();
  s.player.inventory = [{ id: 'fx-x', slot: 'weapon', type: 'whip', name: '鞭', rarity: 'common', level: 1, stats: { atk: 1 } }];
  g.startGame(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(g.player.inventory.length, 0);
});
