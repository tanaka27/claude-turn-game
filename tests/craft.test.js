// 武器の種類 (武器種) と、鍛冶屋で武器を作る (docs/items.md・docs/menu.md)
'use strict';
const assert = require('assert');
const {
  newGame, press, htmlOf, findButton, buttonLabels, clickButton, clickGear, nextToNpc, fillInventory, smithStock, giveItem,
  clickRecipe, smithView, recipeIds, craftWith, plain, messages, clickStaleButton,
  arena, step, addAlly, clickTile, recompute,
} = require('./helpers');

function openNpc(g, id) { nextToNpc(g, id); press(g, 'f'); }
const label = (b) => b && b.text.trim();
// 作り方 id の素材とお金をちょうど持たせる
function haveFor(g, id) {
  const r = g.ITEMS.recipes[id], p = g.player;
  for (const [m, n] of Object.entries(r.materials)) p.materials[m] = n;
  p.gold = r.gold;
}

// ----- 武器の種類 -----
test('武器種: 武器はどれも種類 (剣・短剣・斧・杖・槍・弓) を持ち、基本性能は種類で決まる。防具・装飾品は種類を持たない', () => {
  const g = newGame();
  const types = g.ITEMS.slots.weapon.types;
  assert.deepStrictEqual(Object.keys(types), ['sword', 'dagger', 'axe', 'staff', 'spear', 'bow']);
  for (const t of Object.keys(types)) {
    const it = g.makeItem('weapon', 5, 'common', false, { type: t });
    assert.strictEqual(it.type, t);
    assert.deepStrictEqual(Object.keys(it.stats).sort(), [...Object.keys(types[t].base), ...Object.keys(types[t].fixed || {})].sort(), `${t} の基本性能`);
    assert.strictEqual(it.name, types[t].names[2], 'Lv5 は 3 つ目の名前');
  }
  assert.ok(!('type' in g.makeItem('armor', 3, 'rare')));
  assert.ok(!('type' in g.makeItem('accessory', 3, 'rare')));
  // 種類を書かなければくじ (どれかの種類になる)
  for (let i = 0; i < 20; i++) assert.ok(types[g.makeItem('weapon', 1).type]);
});

test('武器種: 斧はすばやさが下がり (負の値。レア度の倍率はかけない)、杖は術攻撃力が上がる', () => {
  const g = newGame();
  const axe = g.makeItem('weapon', 1, 'epic', false, { type: 'axe' });
  assert.strictEqual(axe.stats.agi, -3);
  assert.strictEqual(axe.stats.atk, Math.round(1.8 * 1.35));
  const p = g.player, agi = p.stats.agi;
  p.inventory.push(axe);
  p.equip.weapon = axe;
  g.refreshStats(p);
  assert.strictEqual(p.stats.agi, agi - 3);
  const staff = g.makeItem('weapon', 5, 'common', false, { type: 'staff' });
  assert.strictEqual(staff.stats.matk, Math.round(1.6 + 0.8 * 4));
  const matk = p.stats.matk;
  p.equip.weapon = staff;
  g.refreshStats(p);
  assert.ok(p.stats.matk > matk);
});

test('武器種: はじめの武器は剣。持ち物の装備の欄には武器種を出す', () => {
  const g = newGame();
  assert.strictEqual(g.player.equip.weapon.type, 'sword');
  const it = g.makeItem('weapon', 3, 'common', false, { type: 'dagger' });
  g.player.inventory.push(it);
  press(g, 'i');
  assert.ok(htmlOf(g, 'invList').includes('短剣 Lv3'));
  assert.ok(htmlOf(g, 'equipList').includes('剣 Lv1'));
});

test('武器種: 種類の違う武器を選ぶと、装備中の武器にだけある基本性能を基本性能の欄に出す', () => {
  const g = newGame();
  const p = g.player;
  p.equip.weapon = g.makeItem('weapon', 3, 'common', false, { type: 'staff' });
  g.refreshStats(p);
  const sword = g.makeItem('weapon', 3, 'common', false, { type: 'sword' });
  p.inventory.push(sword);
  openNpc(g, 'townSmith');
  clickGear(g, 'inv', sword.id);
  const html = htmlOf(g, 'detail');
  const base = html.slice(html.indexOf('基本性能'), html.indexOf('追加性能'));
  assert.ok(base.includes('こうげき力'));
  assert.ok(/class="row lost"><span>術攻撃力/.test(base), '杖にだけある術攻撃力は基本性能の欄に薄く出る');
  assert.ok(!html.slice(html.indexOf('追加性能')).includes('術攻撃力'));
});

// ----- 槍 (攻撃範囲) -----
// 試験場に主人公 (5, 7) と敵を置き、槍 (攻撃範囲 reach) を持たせる
function spearArena(enemies, opts = {}) {
  const g = newGame();
  const es = arena(g, { cols: 15, rows: 15, player: [5, 7], enemies, ...opts });
  const p = g.player;
  if (opts.reach !== 0) {
    const spear = g.makeItem('weapon', 1, 'common', false, { type: 'spear' });
    if (opts.reach) spear.stats.reach = opts.reach;
    p.equip.weapon = spear;
    recompute(g, p);
  }
  g.rng.force(0.99, 0.5); // 外れない
  return { g, p, es };
}

test('槍: 攻撃範囲 +1 を持つ。レベル・レア度で変わらず、追加性能にも付かない。つよさに出る', () => {
  const g = newGame();
  for (const [lv, r] of [[1, 'common'], [12, 'legendary']]) {
    const it = g.makeItem('weapon', lv, r, false, { type: 'spear' });
    assert.strictEqual(it.stats.reach, 1);
    assert.ok(it.stats.atk >= 1);
  }
  assert.ok(!('reach' in g.ITEMS.affixes));
  const p = g.player;
  press(g, 'i');
  assert.ok(htmlOf(g, 'detail').includes('攻撃範囲'), '槍がなくても つよさ に 攻撃範囲 0 を出す');
  press(g, 'i');
  p.equip.weapon = g.makeItem('weapon', 3, 'common', false, { type: 'spear' });
  recompute(g, p);
  assert.strictEqual(p.stats.reach, 1);
});

test('槍: 2 マス先の敵へ動こうとすると、動かずに突く。槍でなければ 1 歩進む', () => {
  const { g, p, es: [e] } = spearArena([{ type: 'golem', at: [7, 7] }]);
  step(g, 1, 0);
  assert.deepStrictEqual([p.tx, p.ty], [5, 7]);
  assert.ok(e.hp < e.stats.maxHp, '離れた敵に当たる');
  const b = spearArena([{ type: 'golem', at: [7, 7] }], { reach: 0 });
  step(b.g, 1, 0);
  assert.deepStrictEqual([b.p.tx, b.p.ty], [6, 7], '剣なら歩く');
  assert.strictEqual(b.es[0].hp, b.es[0].stats.maxHp);
});

test('槍: 当たるのは範囲の中でいちばん近い敵だけ。斜めにも届く', () => {
  const { g, es: [near, far] } = spearArena([{ type: 'golem', at: [7, 7] }, { type: 'golem', at: [8, 7], camp: 'b' }], { reach: 2 });
  step(g, 1, 0);
  assert.ok(near.hp < near.stats.maxHp);
  assert.strictEqual(far.hp, far.stats.maxHp, '奥の敵には当たらない');
  const d = spearArena([{ type: 'golem', at: [7, 9] }]);
  step(d.g, 1, 1);
  assert.deepStrictEqual([d.p.tx, d.p.ty], [5, 7]);
  assert.ok(d.es[0].hp < d.es[0].stats.maxHp);
});

test('槍: 壁の向こう・手前に仲間がいるときは届かない', () => {
  const w = spearArena([{ type: 'golem', at: [7, 7] }], { walls: [[6, 7, 1, 1]] });
  const t0 = w.g.game.time;
  step(w.g, 1, 0);
  assert.strictEqual(w.es[0].hp, w.es[0].stats.maxHp);
  assert.strictEqual(w.g.game.time, t0, '壁には進めず、行動にもならない');
  const a = spearArena([{ type: 'golem', at: [7, 7] }]);
  addAlly(a.g, [6, 7]);
  step(a.g, 1, 0);
  assert.strictEqual(a.es[0].hp, a.es[0].stats.maxHp);
  assert.deepStrictEqual([a.p.tx, a.p.ty], [5, 7]);
});

test('槍: 届く敵をクリックすると突く。届かない敵をクリックしたら歩き、歩く途中では離れた敵を突かない', () => {
  const { g, p, es: [e] } = spearArena([{ type: 'golem', at: [7, 7] }]);
  clickTile(g, 7, 7);
  assert.deepStrictEqual([p.tx, p.ty], [5, 7]);
  assert.ok(e.hp < e.stats.maxHp);
  const f = spearArena([{ type: 'golem', at: [9, 7] }]);
  clickTile(f.g, 9, 7);
  assert.strictEqual(f.es[0].hp, f.es[0].stats.maxHp);
  assert.ok(f.p.travel, '届かないので歩く');
  f.g.tryMove(1, 0, true); // 歩く 1 歩 (この先 2 マスに敵がいても突かない)
  assert.deepStrictEqual([f.p.tx, f.p.ty], [6, 7]);
  assert.strictEqual(f.es[0].hp, f.es[0].stats.maxHp);
});

// ----- 鍛冶屋の品ぞろえ -----
test('鍛冶屋: 売る装備はコモンかアンコモンだけ (どの鍛冶屋・どのレベルでも)', () => {
  const g = newGame();
  assert.deepStrictEqual(plain(g.ITEMS.smithRarities), ['common', 'uncommon']);
  for (const lv of [1, 6, 12]) {
    g.player.level = lv;
    for (const id of Object.keys(g.ITEMS.smiths)) {
      g.refreshSmith(id);
      for (const it of smithStock(g, id)) assert.ok(['common', 'uncommon'].includes(it.rarity), `${id} Lv${lv}: ${it.rarity}`);
    }
  }
});

// ----- 作る -----
test('作る: 素材とお金を使って、作り方の名前・武器種・レベルの武器が持ち物に入る', () => {
  const g = newGame();
  const p = g.player, r = g.ITEMS.recipes.fangKnife;
  haveFor(g, 'fangKnife');
  p.materials.wolfPelt += 2;
  const it = craftWith(g, 'fangKnife');
  assert.ok(it);
  assert.deepStrictEqual([it.name, it.slot, it.type, it.level, it.recipe], [r.name, 'weapon', 'dagger', r.level, 'fangKnife']);
  assert.ok(p.inventory.includes(it));
  assert.strictEqual(p.gold, 0);
  assert.deepStrictEqual(plain(p.materials), { wolfPelt: 2 }, '使い切った素材は消え、余りは残る');
});

test('作る: レア度はアンコモン・レア・エピックのくじ (80% / 17% / 3%)', () => {
  const g = newGame(7);
  const count = { uncommon: 0, rare: 0, epic: 0 };
  const N = 2000;
  for (let i = 0; i < N; i++) {
    haveFor(g, 'hornAxe');
    const it = craftWith(g, 'hornAxe');
    count[it.rarity]++;
    g.player.inventory.length = 0;
  }
  assert.strictEqual(count.uncommon + count.rare + count.epic, N, 'ほかのレア度は出ない');
  assert.ok(Math.abs(count.uncommon / N - 0.8) < 0.04, `アンコモン ${count.uncommon}`);
  assert.ok(Math.abs(count.rare / N - 0.17) < 0.04, `レア ${count.rare}`);
  assert.ok(Math.abs(count.epic / N - 0.03) < 0.02, `エピック ${count.epic}`);
});

test('作る: 素材・お金が足りない、持ち物がいっぱいなら作れず、何も減らない', () => {
  const g = newGame();
  const p = g.player;
  haveFor(g, 'jellyStaff');
  p.materials.slimeCore = 0;
  assert.strictEqual(craftWith(g, 'jellyStaff'), null);
  haveFor(g, 'jellyStaff');
  p.gold -= 1;
  assert.strictEqual(craftWith(g, 'jellyStaff'), null);
  haveFor(g, 'jellyStaff');
  fillInventory(g);
  assert.strictEqual(craftWith(g, 'jellyStaff'), null);
  assert.strictEqual(p.gold, g.ITEMS.recipes.jellyStaff.gold);
  assert.strictEqual(p.materials.slimeJelly, 6);
});

// ----- 鍛冶屋の画面: 売買と作るの切り替え -----
test('鍛冶屋の画面: はじめは売買。上のボタン・1 / 2・← → で「武器を作る」と切り替わり、開き直すと売買に戻る', () => {
  const g = newGame();
  openNpc(g, 'townSmith');
  assert.strictEqual(smithView(g), 'trade');
  assert.deepStrictEqual(buttonLabels(g, 'menu').slice(0, 2), ['売買1', '武器を作る2']);
  assert.ok(htmlOf(g, 'shopList').includes('data-from="shop"'));
  clickButton(g, 'menu', 'view', { view: 'craft' });
  assert.strictEqual(smithView(g), 'craft');
  assert.deepStrictEqual(recipeIds(g), Array.from(g.ITEMS.smiths.townSmith.recipes));
  assert.ok(!htmlOf(g, 'shopList').includes('data-from="shop"'), '作るときは売り物を出さない');
  assert.strictEqual(g.document.getElementById('shopHead').textContent, '作れる武器');
  press(g, '1');
  assert.strictEqual(smithView(g), 'trade');
  assert.strictEqual(g.document.getElementById('shopHead').textContent, '商品');
  press(g, 'arrowright');
  assert.strictEqual(smithView(g), 'craft');
  press(g, 'f');
  openNpc(g, 'townSmith');
  assert.strictEqual(smithView(g), 'trade');
});

test('鍛冶屋の画面: 作り方を選ぶと素材と代金を出し、「作る」で作って右の欄に作った武器を出す', () => {
  const g = newGame();
  const p = g.player, r = g.ITEMS.recipes.stingerSword;
  openNpc(g, 'townSmith');
  press(g, '2');
  clickRecipe(g, 'stingerSword');
  let html = htmlOf(g, 'detail');
  assert.ok(html.includes(r.name) && html.includes('蜂の毒針') && html.includes('できあがるレア度'));
  assert.ok(html.includes('80%') && html.includes('17%') && html.includes('3%'));
  assert.strictEqual(findButton(g, 'menu', 'craft').disabled, true, '素材がないと押せない');
  assert.ok(html.includes('素材が足りないので作れない'));
  press(g, 'f');
  haveFor(g, 'stingerSword');
  openNpc(g, 'townSmith');
  press(g, '2');
  clickRecipe(g, 'stingerSword');
  const b = findButton(g, 'menu', 'craft');
  assert.strictEqual(label(b), `作る（${r.gold} G）`);
  assert.strictEqual(b.disabled, false);
  clickButton(g, 'menu', 'craft');
  const it = p.inventory[p.inventory.length - 1];
  assert.strictEqual(it.recipe, 'stingerSword');
  assert.strictEqual(p.gold, 0);
  html = htmlOf(g, 'detail');
  assert.ok(html.includes(it.name) && html.includes('装備する'));
  assert.ok(!buttonLabels(g, 'menu').some((l) => l.startsWith('売る')), '作るときは売るボタンを出さない');
  assert.ok(messages(g).some((m) => m.includes(`${it.name}（`) && m.includes('を作った')));
});

test('鍛冶屋の画面: ほかの鍛冶屋の作り方・売買のときの「作る」・作るときの「売る」「買う」は効かない', () => {
  const g = newGame();
  const p = g.player;
  haveFor(g, 'flameSword');
  openNpc(g, 'townSmith');
  press(g, '2');
  g.menuState.recipe = 'flameSword'; // 宿場の鍛冶屋の作り方 (始まりの町の鍛冶屋では作れない)
  clickStaleButton(g, 'menu', 'craft');
  assert.strictEqual(p.inventory.length, 0);
  haveFor(g, 'fangKnife');
  g.menuState.view = 'trade';
  g.menuState.recipe = 'fangKnife';
  clickStaleButton(g, 'menu', 'craft');
  assert.strictEqual(p.inventory.length, 0, '売買のときは作らない');
  const it = giveItem(g, 'weapon', 2, 'common');
  g.menuState.view = 'craft';
  g.menuState.sel = { from: 'inv', id: it.id };
  const gold = p.gold;
  clickStaleButton(g, 'menu', 'sell');
  assert.ok(p.inventory.includes(it), '作るときは売らない');
  assert.strictEqual(p.gold, gold);
});
