// スキルを覚える (覚えているスキルはキャラの状態。はじめの覚え方はレベル)・スキル欄 (キー → スキル)・覚えたスキルのセーブ
'use strict';
const assert = require('assert');
const { loadGame } = require('./harness');
const {
  plain, newGame, arena, addAlly, press, castAt, messages, levelUp, skill, skillById, keyOf, knows, knownSkillIds, teach, defineSkill,
  bindSkill, storedCooldown, cooldownLeftOf, cooldownLengthOf, dataProblems,
} = require('./helpers');

const LV1 = ['shockwave', 'dash', 'battleAura'];
const last = (g) => messages(g)[messages(g).length - 1];
// 主人公の左に敵 (ゴーレム。HP が多い) を 1 体
const field = (g) => arena(g, { cols: 15, rows: 15, player: [3, 7], enemies: [{ type: 'golem', at: [8, 7] }] });

test('はじめから遊ぶと Lv1 のスキルだけを覚えていて、スキル欄は 1〜5 にいつもの並び', () => {
  const g = newGame();
  assert.deepStrictEqual(knownSkillIds(g.player), LV1);
  const ids = ['1', '2', '3', '4', '5'].map((k) => skill(g, k).id);
  assert.deepStrictEqual(ids, ['shockwave', 'whirlwind', 'meteor', 'dash', 'battleAura']);
  assert.deepStrictEqual(['1', '2', '3', '4', '5'].map((k) => knows(g, g.player, skill(g, k))), [true, false, false, true, true]);
  assert.deepStrictEqual(['衝撃波', '旋風斬', 'メテオ', 'ダッシュ', '闘気'], ['1', '2', '3', '4', '5'].map((k) => skill(g, k).name));
});

test('Lv3 で旋風斬、Lv6 でメテオを覚え、レベルアップの表示に今までどおり出る', () => {
  const g = newGame();
  const subs = {};
  for (let lv = 2; lv <= 7; lv++) {
    levelUp(g);
    assert.strictEqual(g.game.msg, `LEVEL UP!  Lv ${lv}`);
    subs[lv] = g.game.sub.split('\n');
  }
  assert.strictEqual(subs[3][subs[3].length - 1], '新しいスキル: 旋風斬（2）');
  assert.strictEqual(subs[6][subs[6].length - 1], '新しいスキル: メテオ（3）');
  for (const lv of [2, 4, 5, 7]) assert.ok(!subs[lv].some((l) => l.includes('新しいスキル')), `Lv${lv}: ${subs[lv]}`);
  assert.deepStrictEqual(knownSkillIds(g.player), [...LV1, 'whirlwind', 'meteor']);
});

test('覚えていないスキルのキーは今までどおりの文を出すだけで、構えず時間も進まない', () => {
  const g = newGame();
  field(g);
  const p = g.player, t0 = g.game.time, mp0 = p.mp;
  press(g, '2');
  assert.strictEqual(last(g), '旋風斬は Lv3 で使えるようになる。');
  assert.strictEqual(g.aiming, null);
  press(g, '3');
  assert.strictEqual(last(g), 'メテオは Lv6 で使えるようになる。');
  assert.strictEqual(g.aiming, null);
  assert.strictEqual(g.game.time, t0);
  assert.strictEqual(p.mp, mp0);
  assert.strictEqual(storedCooldown(g, p, skill(g, '3')), 0);
});

test('レベルを通さずに覚えさせれば、覚えるレベルより下でも使える (覚えているかはレベルから決まらない)', () => {
  const g = newGame();
  const [e] = field(g);
  const p = g.player, meteor = skillById(g, 'meteor');
  assert.strictEqual(p.level, 1);
  assert.strictEqual(teach(g, p, 'meteor'), true);
  assert.strictEqual(teach(g, p, 'meteor'), false, '2 回目は何もしない');
  assert.strictEqual(teach(g, p, 'noSuchSkill'), false, 'ないスキルは覚えない');
  assert.deepStrictEqual(knownSkillIds(p), [...LV1, 'meteor']);
  const hp0 = e.hp, mp0 = p.mp;
  g.rng.force(0.5);
  castAt(g, '3', 8, 7);
  assert.ok(messages(g).includes('メテオ！'));
  assert.ok(e.hp < hp0, '当たる');
  assert.ok(p.mp < mp0 - meteor.mp + 1, 'MP を払う');
  assert.ok(cooldownLeftOf(g, p, meteor) > 0, '再使用待ちになる');
  // あとで Lv6 になっても、もう覚えているので「新しいスキル」には出ない (旋風斬は Lv3 で出る)
  const subs = [];
  for (let i = 0; i < 5; i++) { levelUp(g); subs.push(g.game.sub); }
  assert.strictEqual(p.level, 6);
  assert.ok(subs[1].endsWith('新しいスキル: 旋風斬（2）'), subs[1]);
  assert.ok(!subs[4].includes('新しいスキル'), subs[4]);
  assert.deepStrictEqual(knownSkillIds(p), [...LV1, 'meteor', 'whirlwind']);
});

test('テストで足した 6 つ目のスキルを覚えさせ、キー 6 に置けば、そのキーで使える', () => {
  const g = newGame();
  const [e] = field(g);
  const p = g.player;
  const bolt = defineSkill(g, { id: 'testBolt', name: '試しの弾', type: 'projectile', range: 6, width: 1, cooldown: 3, mp: 1, power: 1 });
  press(g, '6');
  assert.strictEqual(g.aiming, null, 'キーに置くまでは何も起きない');
  bindSkill(g, '6', 'testBolt');
  assert.strictEqual(skill(g, '6'), bolt);
  assert.strictEqual(keyOf(g, bolt), '6');
  press(g, '6');
  assert.strictEqual(last(g), '試しの弾はまだ覚えていない。', 'レベルで覚えるスキルではない');
  assert.strictEqual(g.aiming, null);
  teach(g, p, 'testBolt');
  const hp0 = e.hp, t0 = g.game.time;
  g.rng.force(0.99, 0.5);
  castAt(g, '6', 8, 7);
  assert.ok(messages(g).includes('試しの弾！'));
  assert.ok(e.hp < hp0);
  assert.ok(g.game.time > t0, '1 行動');
  assert.strictEqual(g.skillKey(p, bolt), 'testBolt', '再使用待ちはスキルの id で持つ');
  assert.strictEqual(storedCooldown(g, p, bolt), cooldownLengthOf(g, p, bolt) - 1);
  // 1〜5 はそのまま
  assert.deepStrictEqual(['1', '2', '3', '4', '5'].map((k) => skill(g, k).id), ['shockwave', 'whirlwind', 'meteor', 'dash', 'battleAura']);
});

test('仲間 (テスト用) は自分の技の並びを覚えている。id のない技はそのまま使える', () => {
  const g = newGame();
  arena(g, { cols: 15, rows: 15, player: [3, 7] });
  const slam = { name: '試しの一撃', type: 'melee', shape: 'circle', range: 1.5, cooldown: 2, power: 1 };
  const ally = addAlly(g, [6, 7], { skills: [skill(g, '1'), skill(g, '4'), slam] });
  assert.deepStrictEqual(knownSkillIds(ally), ['shockwave', 'dash']);
  assert.ok(knows(g, ally, skill(g, '1')));
  assert.ok(!knows(g, ally, skill(g, '2')));
  assert.strictEqual(g.skillKey(ally, skill(g, '1')), 'shockwave');
  assert.strictEqual(g.skillKey(ally, slam), 2, 'id のない技は並びの位置');
  assert.deepStrictEqual(knownSkillIds(g.player), LV1, '主人公とは別');
});

test('覚えたスキルはセーブに残り、ないスキルの id は捨て、レベルで覚えているはずのものは足す', () => {
  const g = newGame();
  teach(g, g.player, 'meteor');
  const save = plain(g.buildSave());
  assert.strictEqual(save.v, g.SAVE_VERSION);
  assert.deepStrictEqual(save.player.knownSkills, [...LV1, 'meteor']);
  const g2 = loadGame();
  g2.startGame(g2.migrateSave(save));
  assert.deepStrictEqual(knownSkillIds(g2.player), [...LV1, 'meteor']);
  // ない id・重なり・id でないものは捨て、Lv4 なら旋風斬も足す (覚えていない Lv1 のスキルも足す)
  const odd = { ...plain(save), player: { ...plain(save.player), level: 4, knownSkills: ['meteor', 'fireball', 'meteor', 5, null, 'dash'] } };
  const g3 = loadGame();
  g3.startGame(g3.migrateSave(odd));
  assert.deepStrictEqual(knownSkillIds(g3.player), ['meteor', 'dash', 'shockwave', 'whirlwind', 'battleAura']);
  // 並びでないものは、レベルで覚えるものだけになる
  const none = { ...plain(save), player: { ...plain(save.player), knownSkills: 'x' } };
  const g4 = loadGame();
  g4.startGame(g4.migrateSave(none));
  assert.deepStrictEqual(knownSkillIds(g4.player), LV1);
});

test('データの確認: スキルの id・覚え方・スキル欄の食い違いを見つける', () => {
  const g = loadGame();
  assert.deepStrictEqual(dataProblems(g), []);
  g.PLAYER.learnAtLevel.nope = 0;
  g.PLAYER.skillSlots.push({ key: '1', skill: 'missing' }, { key: '7', skill: 'dash' });
  g.SKILLS.push({ id: 'dash', name: '重なり', type: 'dash', distance: 1, cooldown: 1 });
  const ps = dataProblems(g);
  for (const part of ["learnAtLevel: スキル 'nope'", 'learnAtLevel.nope: レベル 0', "スキル 'missing' が data/skills.js にない", '同じスキルを 2 つのキーに置いている',
    'スキルのキーが重なっている', 'スキルの id が重なっている']) {
    assert.ok(ps.some((m) => m.includes(part)), `${part}: ${ps.join(' / ')}`);
  }
});
