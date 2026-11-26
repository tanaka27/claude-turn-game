// 弓 (射程・矢・投擲の命中の減衰) (docs/crafting.md の「弓」・docs/consumables.md の「矢」)
'use strict';
const assert = require('assert');
const { loadGame } = require('./harness');
const {
  newGame, renderFrame, press, htmlOf, findButton, clickButton, nextToNpc, arena, step, clickTile, recompute, messages, plain, bagOf, buyButton, dataProblems,
} = require('./helpers');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''}: ${a} ≠ ${b}`);
const label = (b) => b && b.text.trim();

// 試験場に主人公 (3, 7) と敵を置き、弓と矢を持たせる。opts.arrows: { 矢のキー: 数 } (省略時は木の矢 10 本)
function bowArena(enemies, opts = {}) {
  const g = newGame();
  const es = arena(g, { cols: 15, rows: 15, player: [3, 7], enemies, ...opts });
  const p = g.player;
  p.equip.weapon = g.makeItem('weapon', 1, 'common', false, { type: 'bow' });
  Object.assign(p.consumables, opts.arrows || { woodArrow: 10 });
  recompute(g, p);
  if (opts.force !== false) g.rng.force(0.99, 0.5); // 外れない (次の 1 回の攻撃)
  return { g, p, es };
}
const hurt = (e) => e.hp < e.stats.maxHp;

test('弓: 射程 5 を持ち (レベル・レア度で変わらない)、矢を撃つ武器 (ammo)。つよさに 射程 を出す', () => {
  const g = newGame();
  const bow = g.ITEMS.slots.weapon.types.bow;
  assert.strictEqual(bow.label, '弓');
  assert.ok(bow.ammo);
  for (const [lv, r] of [[1, 'common'], [12, 'legendary']]) {
    const it = g.makeItem('weapon', lv, r, false, { type: 'bow' });
    assert.strictEqual(it.stats.range, 5);
    assert.ok(it.stats.atk >= 1);
  }
  assert.ok(!('range' in g.ITEMS.affixes));
  press(g, 'i');
  assert.ok(htmlOf(g, 'detail').includes('射程'), '弓がなくても つよさ に 射程 0 を出す');
  assert.deepStrictEqual(dataProblems(g), []);
});

test('投擲の命中: となりは減らず、1 マス離れるごとに −5%。命中が 100% を超えた分が外れを埋め、下限は 50%', () => {
  const g = newGame();
  const at = (hit, eva, d) => g.hitChance({ tx: 0, ty: 0, stats: { hit, eva } }, { tx: d, ty: 0, stats: { hit: 0, eva } }, { thrown: true });
  near(at(1, 0.05, 1), 0.95, '距離 1');
  near(at(1, 0.05, 2), 0.9, '距離 2');
  near(at(1, 0.05, 5), 0.75, '距離 5');
  near(at(1.1, 0.05, 2), 1, '器用さ 30 (命中 110%) なら距離 2 まで 100%');
  near(at(1.1, 0.05, 5), 0.85, '器用さ 30 で距離 5');
  near(at(1, 0.05, 20), 0.5, '下限 50%');
  // 斜めも 1 歩 (縦・横の大きいほう)
  near(g.hitChance({ tx: 0, ty: 0, stats: { hit: 1, eva: 0 } }, { tx: 3, ty: 3, stats: { eva: 0 } }, { thrown: true }), 0.9);
  // 投擲でない物理は距離で変わらない (下限 75%)
  near(g.hitChance({ tx: 0, ty: 0, stats: { hit: 1, eva: 0.05 } }, { tx: 5, ty: 0, stats: { eva: 0.05 } }), 0.95);
});

test('弓: 射程の中の敵をクリックすると、動かずに撃つ。矢を 1 本使い、まっすぐ並んでいなくてもよい', () => {
  const { g, p, es: [e] } = bowArena([{ type: 'golem', at: [7, 9] }]);
  const t0 = g.game.time;
  clickTile(g, 7, 9);
  assert.deepStrictEqual([p.tx, p.ty], [3, 7]);
  assert.ok(hurt(e), '4 マス先 (斜めでもまっすぐでもない) に当たる');
  assert.strictEqual(bagOf(p).woodArrow, 9);
  assert.ok(g.game.time > t0, '1 行動');
  assert.ok(messages(g).some((m) => m.startsWith('木の矢: ')), messages(g).join('\n'));
});

test('弓: 射程より遠い敵・壁の向こうの敵をクリックしたら撃たずに歩く', () => {
  const f = bowArena([{ type: 'golem', at: [9, 7] }]);
  clickTile(f.g, 9, 7);
  assert.ok(!hurt(f.es[0]));
  assert.strictEqual(bagOf(f.p).woodArrow, 10);
  assert.ok(f.p.travel, '6 マス先は届かないので歩く');
  const w = bowArena([{ type: 'golem', at: [7, 7] }], { walls: [[5, 4, 1, 7]] });
  clickTile(w.g, 7, 7);
  assert.ok(!hurt(w.es[0]), '壁の向こうには撃てない');
  assert.strictEqual(bagOf(w.p).woodArrow, 10);
});

test('弓: 敵の方向へ動こうとすると、その向きの射程の中でいちばん近い敵を撃つ (動かない)', () => {
  const { g, p, es: [a, b] } = bowArena([{ type: 'golem', at: [6, 7] }, { type: 'golem', at: [8, 7], camp: 'b' }]);
  step(g, 1, 0);
  assert.deepStrictEqual([p.tx, p.ty], [3, 7]);
  assert.ok(hurt(a));
  assert.ok(!hurt(b), '奥の敵には当たらない');
  assert.strictEqual(bagOf(p).woodArrow, 9);
  // となりの敵も撃つ
  const n = bowArena([{ type: 'golem', at: [4, 7] }]);
  step(n.g, 1, 0);
  assert.ok(hurt(n.es[0]));
  assert.strictEqual(bagOf(n.p).woodArrow, 9);
});

test('弓: 矢の攻撃力をこうげき力に足す (強い矢ほど大きいダメージ)', () => {
  const dmg = (arrow) => {
    const { g, es: [e] } = bowArena([{ type: 'golem', at: [5, 7] }], { arrows: { [arrow]: 1 } });
    clickTile(g, 5, 7);
    return e.stats.maxHp - e.hp;
  };
  const wood = dmg('woodArrow'), steel = dmg('steelArrow');
  assert.ok(steel > wood, `鋼の矢 ${steel} > 木の矢 ${wood}`);
  const g = newGame();
  const s = { atk: 10, def: 0, critRate: 0, critMult: 1.5, hit: 1, eva: 0 };
  const u = { tx: 0, ty: 0, stats: s }, t = { tx: 1, ty: 0, stats: { ...s } };
  g.rng.force(0.99, 0.5);
  const a = g.rollDamage(u, t, { power: 1, atkBonus: 9, thrown: true }).dmg;
  g.rng.force(0.99, 0.5);
  const b = g.rollDamage(u, t, { power: 1 }).dmg;
  assert.strictEqual(a, Math.round(19 * 0.5));
  assert.strictEqual(b, Math.round(10 * 0.5));
});

test('弓: 外れても矢は減る。遠いほど外れやすい (同じ乱数で、となりは当たり 5 マス先は外れる)', () => {
  const far = bowArena([{ type: 'golem', at: [8, 7] }], { force: false });
  far.p.stats.critRate = 0;
  far.g.rng.force(0.2, 0.5);
  clickTile(far.g, 8, 7);
  assert.ok(!hurt(far.es[0]), '5 マス先は外れる');
  assert.strictEqual(bagOf(far.p).woodArrow, 9);
  const nb = bowArena([{ type: 'golem', at: [4, 7] }], { force: false });
  nb.p.stats.critRate = 0;
  nb.g.rng.force(0.2, 0.5);
  clickTile(nb.g, 4, 7);
  assert.ok(hurt(nb.es[0]), 'となりは当たる');
});

test('弓: 矢がないと離れた敵には撃てず、となりの敵は素手で殴る (弓のこうげき力は乗らない)。最後の 1 本で「矢が尽きた」', () => {
  const { g, p, es: [e] } = bowArena([{ type: 'golem', at: [5, 7] }], { arrows: { woodArrow: 1 } });
  clickTile(g, 5, 7);
  assert.strictEqual(bagOf(p).woodArrow, 0);
  assert.ok(messages(g).includes('矢が尽きた。'));
  const hp = e.hp;
  clickTile(g, 5, 7);
  assert.strictEqual(e.hp, hp, '矢がないので撃たない');
  assert.ok(p.travel, '歩く');
  // となりの敵
  const n = bowArena([{ type: 'golem', at: [4, 7] }], { arrows: { woodArrow: 0 } });
  n.p.equip.weapon.stats.atk = 999; // 弓のこうげき力が乗るなら一撃で倒れる
  recompute(n.g, n.p);
  step(n.g, 1, 0);
  assert.ok(messages(n.g).includes('矢がない！ 素手で殴る。'));
  assert.ok(!n.es[0].dead, '弓のこうげき力は乗らない');
  assert.ok(messages(n.g).some((m) => m.startsWith('素手: ')));
});

test('矢の選び方: 選んでいなければ先の矢 (木の矢) から。道具一覧の「使う矢にする」で選べ (行動にならない)、尽きたら先の矢に戻る', () => {
  const { g, p, es: [e] } = bowArena([{ type: 'golem', at: [5, 7] }], { arrows: { woodArrow: 5, steelArrow: 1 } });
  assert.strictEqual(g.currentArrow(p), 'woodArrow');
  press(g, 'i');
  assert.strictEqual(label(findButton(g, 'menu', 'use', { tool: 'woodArrow' })), '使用中');
  assert.strictEqual(findButton(g, 'menu', 'use', { tool: 'woodArrow' }).disabled, true);
  assert.strictEqual(label(findButton(g, 'menu', 'use', { tool: 'steelArrow' })), '使う矢にする');
  assert.strictEqual(findButton(g, 'menu', 'use', { tool: 'ironArrow' }).disabled, true, '持っていない矢は選べない');
  const t0 = g.game.time;
  clickButton(g, 'menu', 'use', { tool: 'steelArrow' });
  assert.strictEqual(g.game.state, 'menu', '画面は閉じない');
  assert.strictEqual(g.game.time, t0, '行動にならない');
  assert.strictEqual(label(findButton(g, 'menu', 'use', { tool: 'steelArrow' })), '使用中');
  assert.ok(htmlOf(g, 'toolList').includes('こうげき力 +9'));
  press(g, 'i');
  clickTile(g, 5, 7);
  assert.strictEqual(bagOf(p).steelArrow, 0);
  assert.strictEqual(bagOf(p).woodArrow, 5);
  assert.strictEqual(g.currentArrow(p), 'woodArrow', '尽きたら先の矢');
  assert.ok(hurt(e));
});

test('商人: 矢は 10 本ずつ買う (持てる 99 本を超える分は買わない)。隠れ里より先で鉄の矢、霜の村・砂の都で鋼の矢', () => {
  const g = newGame();
  const p = g.player, c = g.ITEMS.consumables.woodArrow;
  p.gold = 1000;
  nextToNpc(g, 'merchant'); press(g, 'f');
  assert.strictEqual(label(findButton(g, 'menu', ...buyButton('woodArrow'))), `10 本買う（${c.price * 10} G）`);
  assert.strictEqual(findButton(g, 'menu', ...buyButton('ironArrow')), null);
  clickButton(g, 'menu', ...buyButton('woodArrow'));
  assert.strictEqual(bagOf(p).woodArrow, 10);
  assert.strictEqual(p.gold, 1000 - c.price * 10);
  bagOf(p).woodArrow = 95;
  press(g, 'f'); nextToNpc(g, 'merchant'); press(g, 'f');
  assert.strictEqual(label(findButton(g, 'menu', ...buyButton('woodArrow'))), `4 本買う（${c.price * 4} G）`);
  clickButton(g, 'menu', ...buyButton('woodArrow'));
  assert.strictEqual(bagOf(p).woodArrow, 99);
  assert.strictEqual(findButton(g, 'menu', ...buyButton('woodArrow')).disabled, true);
  const S = g.ITEMS.shops;
  assert.ok(S.hamletHerbs.consumables.includes('ironArrow') && !S.hamletHerbs.consumables.includes('steelArrow'));
  assert.ok(S.frostHerbs.consumables.includes('steelArrow') && S.desertBazaar.consumables.includes('steelArrow'));
});

test('HUD: 弓を装備しているときは、スキル欄に次に撃つ矢と数を出す。矢はキーで使う道具ではない', () => {
  const g = newGame();
  for (const id of g.arrowIds()) assert.strictEqual(g.ITEMS.consumables[id].key, undefined);
  assert.ok(!g.wieldsBow(g.player), 'はじめは剣');
  const b = bowArena([], { arrows: { ironArrow: 7 } });
  assert.ok(b.g.wieldsBow(b.p));
  assert.strictEqual(b.g.currentArrow(b.p), 'ironArrow');
  renderFrame(b.g); // スキル欄に矢の欄を描いてもエラーにならない
  b.p.consumables.ironArrow = 0;
  renderFrame(b.g); // 矢なし
});

test('作る: 器用さの補正のある弓 (作り方の bonus) は 器用さ も基本性能に持つ。各鍛冶屋で弓が作れる', () => {
  const g = newGame();
  const r = g.ITEMS.recipes.hunterBow, p = g.player;
  for (const [m, n] of Object.entries(r.materials)) p.materials[m] = n;
  p.gold = r.gold;
  const it = g.craftItem(p, 'hunterBow');
  assert.strictEqual(it.type, 'bow');
  assert.strictEqual(it.stats.range, 5);
  assert.ok(it.stats.dex >= Math.round(2 + 0.2 * 2), `器用さ ${it.stats.dex}`);
  for (const [id, sm] of Object.entries(g.ITEMS.smiths)) assert.ok(sm.recipes.some((k) => g.ITEMS.recipes[k].type === 'bow'), `${id} で弓が作れる`);
  // 器用さの補正のない弓
  const r2 = g.ITEMS.recipes.silkBow;
  for (const [m, n] of Object.entries(r2.materials)) p.materials[m] = n;
  p.gold = r2.gold;
  assert.ok(!('dex' in g.craftItem(p, 'silkBow').stats), '器用さ は追加性能の候補にもないので付かない');
});

test('セーブ: 使う矢に選んだものが戻る。今はない矢・矢でない道具は選んでいないことにする', () => {
  const { g, p } = bowArena([], { arrows: { woodArrow: 3, ironArrow: 4 } });
  g.selectArrow(p, 'ironArrow');
  const save = JSON.parse(JSON.stringify(g.buildSave()));
  assert.strictEqual(save.player.arrow, 'ironArrow');
  const g2 = loadGame({ seed: 3 });
  g2.startGame(g2.migrateSave(save));
  assert.strictEqual(g2.player.arrow, 'ironArrow');
  assert.deepStrictEqual(plain(g2.player.equip.weapon.stats), plain(p.equip.weapon.stats));
  for (const bad of ['potion', 'nope', 3]) {
    const g3 = loadGame({ seed: 3 });
    g3.startGame(g3.migrateSave({ ...save, player: { ...save.player, arrow: bad } }));
    assert.strictEqual(g3.player.arrow, null, String(bad));
  }
});
