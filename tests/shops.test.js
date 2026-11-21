// 商人・鍛冶屋・道具一覧の画面の中身とボタン (買う・売る・装備・外す・捨てる・使う・詳細のポップアップ)。
// 作りを変える前の動きをそのまま固定する (docs/menu.md・docs/items.md)
'use strict';
const assert = require('assert');
const {
  newGame, press, el, shown, textOf, htmlOf, openScreen, findButton, buttonLabels, clickButton, clickGear, clickTool, clickMat, clickPopBackdrop,
  nextToNpc, giveItem, fillInventory, smithStock, setLevel, trackSaves, screenNodes, clickNode, clickStaleButton, staleSelect,
} = require('./helpers');

function openNpc(g, id) { nextToNpc(g, id); press(g, 'f'); }
const label = (b) => b && b.text.trim();

// ----- 商人 -----
test('商人: 回復薬を買うとお金が減って数が増え、お金が足りなくなるとボタンが押せない', () => {
  const g = newGame();
  const p = g.player, po = g.IT.potions.potion;
  openNpc(g, 'merchant');
  assert.strictEqual(textOf(g, 'menuGold'), `所持金 ${p.gold} G`);
  const b = findButton(g, 'menu', 'potion', { potion: 'potion' });
  assert.strictEqual(label(b), `買う（${po.price} G）`);
  assert.strictEqual(b.disabled, false);
  assert.strictEqual(findButton(g, 'menu', 'potion', { potion: 'hiPotion' }), null, '始まりの町の商店に上回復薬はない');
  const gold = p.gold, n = p.potions.potion, t = g.game.time;
  assert.ok(clickButton(g, 'menu', 'potion', { potion: 'potion' }));
  assert.strictEqual(p.gold, gold - po.price);
  assert.strictEqual(p.potions.potion, n + 1);
  assert.strictEqual(g.game.time, t, '買うのは行動にならない');
  assert.strictEqual(textOf(g, 'menuGold'), `所持金 ${p.gold} G`);
  assert.ok(p.gold < po.price);
  assert.strictEqual(findButton(g, 'menu', 'potion', { potion: 'potion' }).disabled, true);
  clickButton(g, 'menu', 'potion', { potion: 'potion' }, { force: true });
  assert.strictEqual(p.potions.potion, n + 1, '押せないボタンが押されても買えない');
  assert.strictEqual(p.gold, gold - po.price);
});

test('商人: 持てる上限まで持っていると買えない', () => {
  const g = newGame();
  const p = g.player, po = g.IT.potions.potion;
  p.gold = 1000;
  p.potions.potion = po.max;
  openNpc(g, 'merchant');
  assert.strictEqual(findButton(g, 'menu', 'potion', { potion: 'potion' }).disabled, true);
  clickButton(g, 'menu', 'potion', { potion: 'potion' }, { force: true });
  assert.strictEqual(p.potions.potion, po.max);
  assert.strictEqual(p.gold, 1000);
});

test('隠れ里の薬師は上回復薬も売る', () => {
  const g = newGame();
  const p = g.player;
  p.gold = 1000;
  openNpc(g, 'herbalist');
  clickButton(g, 'menu', 'potion', { potion: 'hiPotion' });
  assert.strictEqual(p.potions.hiPotion, 1);
  assert.strictEqual(p.gold, 1000 - g.IT.potions.hiPotion.price);
});

test('商人: 素材を 1 つ・種類ごと全部・全部売る', () => {
  const g = newGame();
  const p = g.player, M = g.IT.materials;
  p.materials = { wolfPelt: 3, boarHorn: 2, honey: 1 };
  openNpc(g, 'merchant');
  const total = 3 * M.wolfPelt.price + 2 * M.boarHorn.price + M.honey.price;
  assert.strictEqual(label(findButton(g, 'menu', 'sellAllMat')), `全部売る（${total} G）`);
  assert.strictEqual(label(findButton(g, 'menu', 'sellMat', { mat: 'wolfPelt', all: 1 })), `全部（${3 * M.wolfPelt.price} G）`);
  const gold = p.gold;
  clickButton(g, 'menu', 'sellMat', { mat: 'wolfPelt' });
  assert.strictEqual(p.materials.wolfPelt, 2);
  assert.strictEqual(p.gold, gold + M.wolfPelt.price);
  clickButton(g, 'menu', 'sellMat', { mat: 'wolfPelt', all: 1 });
  assert.ok(!('wolfPelt' in p.materials), '売り切ったら記録を消す');
  assert.strictEqual(p.gold, gold + 3 * M.wolfPelt.price);
  clickButton(g, 'menu', 'sellAllMat');
  assert.deepStrictEqual(Object.keys(p.materials), []);
  assert.strictEqual(p.gold, gold + total);
  assert.strictEqual(findButton(g, 'menu', 'sellAllMat'), null, '素材がなくなったら「全部売る」は消える');
  assert.ok(htmlOf(g, 'matList').includes('素材は魔物を倒すと手に入る'));
});

test('素材を売るボタンは商人にだけ出る (道具一覧・鍛冶屋では出ず、押されても売れない)', () => {
  const g = newGame();
  const p = g.player;
  p.materials = { wolfPelt: 3 };
  press(g, 'i');
  assert.strictEqual(findButton(g, 'menu', 'sellMat', { mat: 'wolfPelt' }), null);
  assert.strictEqual(findButton(g, 'menu', 'sellAllMat'), null);
  press(g, 'Escape');
  openNpc(g, 'townSmith');
  assert.strictEqual(findButton(g, 'menu', 'sellMat', { mat: 'wolfPelt' }), null);
  // 古い画面に残ったボタンが押されたとき (画面の処理の見張り)
  clickStaleButton(g, 'menu', 'sellMat', { mat: 'wolfPelt' });
  clickStaleButton(g, 'menu', 'sellAllMat');
  assert.strictEqual(p.materials.wolfPelt, 3);
  press(g, 'f');
  press(g, 'i');
  clickStaleButton(g, 'menu', 'sellMat', { mat: 'wolfPelt', all: 1 });
  clickStaleButton(g, 'menu', 'sellAllMat');
  assert.strictEqual(p.materials.wolfPelt, 3);
  assert.strictEqual(p.gold, g.EC.startGold);
});

test('商人の画面: 装備を選ぶと右の欄に詳細が出て (ポップアップなし)、「捨てる」が出る', () => {
  const g = newGame();
  const it = giveItem(g, 'weapon', 2, 'rare');
  openNpc(g, 'merchant');
  clickGear(g, 'inv', it.id);
  assert.strictEqual(shown(g, 'itemPop'), false);
  assert.ok(htmlOf(g, 'detail').includes(it.name));
  assert.deepStrictEqual(buttonLabels(g, 'menu').filter((l) => /装備する|捨てる|売る（/.test(l)), ['装備する', '捨てる']);
  clickTool(g, 'potion');
  assert.strictEqual(shown(g, 'itemPop'), false, '店では道具をクリックしても詳細は出ない');
});

// ----- 鍛冶屋 -----
test('鍛冶屋: 品ぞろえは自分のレベルで決まり、同じレベルなら開き直しても同じ、レベルが変わると入れ替わる', () => {
  const g = newGame();
  const d = g.IT.smiths.townSmith;
  openNpc(g, 'townSmith');
  const first = smithStock(g, 'townSmith');
  assert.deepStrictEqual(first.map((it) => [it.slot, it.rarity, it.level]), Array.from(d.gear, ([s, r]) => [s, r, 1]));
  for (const it of first) assert.ok(htmlOf(g, 'shopList').includes(`data-id="${it.id}"`));
  press(g, 'f');
  openNpc(g, 'townSmith');
  assert.deepStrictEqual(smithStock(g, 'townSmith').map((it) => it.id), first.map((it) => it.id));
  press(g, 'f');
  setLevel(g, 3);
  openNpc(g, 'townSmith');
  assert.deepStrictEqual(smithStock(g, 'townSmith').map((it) => it.level), [3, 3, 3]);
  assert.ok(htmlOf(g, 'shopList').includes('Lv3'));
  press(g, 'f');
  setLevel(g, 7);
  openNpc(g, 'townSmith');
  assert.deepStrictEqual(smithStock(g, 'townSmith').map((it) => it.level), [d.maxLevel, d.maxLevel, d.maxLevel], '装備レベルの上限');
});

test('鍛冶屋: 隠れ里は自分のレベル + levelOffset の装備', () => {
  const g = newGame();
  setLevel(g, 4);
  openNpc(g, 'hamletSmith');
  const lv = 4 + g.IT.smiths.hamletSmith.levelOffset;
  assert.ok(smithStock(g, 'hamletSmith').every((it) => it.level === lv));
});

test('鍛冶屋: 装備を買うとお金が減って持ち物に入り、品ぞろえから消える。選んだのは持ち物の側に移る', () => {
  const g = newGame();
  const p = g.player;
  p.gold = 500;
  openNpc(g, 'townSmith');
  const it = smithStock(g, 'townSmith')[0], price = g.itemValue(it);
  clickGear(g, 'shop', it.id);
  assert.strictEqual(shown(g, 'itemPop'), false, '店ではポップアップを使わない');
  assert.ok(htmlOf(g, 'detail').includes(it.name));
  const b = findButton(g, 'menu', 'buy');
  assert.strictEqual(label(b), `買う（${price} G）`);
  assert.strictEqual(b.disabled, false);
  clickButton(g, 'menu', 'buy');
  assert.strictEqual(p.gold, 500 - price);
  assert.ok(p.inventory.includes(it));
  assert.ok(!smithStock(g, 'townSmith').includes(it));
  assert.ok(!htmlOf(g, 'shopList').includes(`data-id="${it.id}"`));
  assert.ok(htmlOf(g, 'invList').includes(`data-id="${it.id}"`));
  assert.deepStrictEqual(buttonLabels(g, 'menu').filter((l) => /装備する|捨てる|売る（/.test(l)), ['装備する', `売る（${g.sellPrice(it)} G）`]);
});

test('鍛冶屋: お金が足りない・持ち物がいっぱいのときは買えない', () => {
  const g = newGame();
  const p = g.player;
  p.gold = 0;
  openNpc(g, 'townSmith');
  const it = smithStock(g, 'townSmith')[0];
  clickGear(g, 'shop', it.id);
  assert.strictEqual(findButton(g, 'menu', 'buy').disabled, true);
  clickButton(g, 'menu', 'buy', {}, { force: true });
  assert.strictEqual(p.inventory.length, 0);
  assert.ok(smithStock(g, 'townSmith').includes(it));
  press(g, 'f');
  p.gold = 500;
  fillInventory(g);
  openNpc(g, 'townSmith');
  clickGear(g, 'shop', it.id);
  assert.strictEqual(findButton(g, 'menu', 'buy').disabled, true);
  clickButton(g, 'menu', 'buy', {}, { force: true });
  assert.strictEqual(p.gold, 500);
  assert.ok(!p.inventory.includes(it));
  assert.ok(smithStock(g, 'townSmith').includes(it));
});

test('鍛冶屋: 持ち物の装備を売る (どの鍛冶屋でも売れる)', () => {
  const g = newGame();
  const p = g.player;
  const it = giveItem(g, 'armor', 3, 'epic');
  openNpc(g, 'waySmith');
  clickGear(g, 'inv', it.id);
  const gold = p.gold;
  clickButton(g, 'menu', 'sell');
  assert.strictEqual(p.gold, gold + g.sellPrice(it));
  assert.ok(!p.inventory.includes(it));
  assert.ok(htmlOf(g, 'detail').includes('つよさ'), '売ったら選んでいたものは消えて、つよさに戻る');
});

test('鍛冶屋: 装備中のものを選ぶと「外す」だけ (売れない)', () => {
  const g = newGame();
  const p = g.player, w = p.equip.weapon;
  openNpc(g, 'townSmith');
  clickGear(g, 'equip', w.id);
  assert.deepStrictEqual(buttonLabels(g, 'menu').filter((l) => /装備する|捨てる|売る（|外す/.test(l)), ['外す']);
  const gold = p.gold;
  // 古い画面に残った「売る」が押されても、選んでいるのが持ち物の装備でなければ売れない
  clickStaleButton(g, 'menu', 'sell');
  assert.strictEqual(p.gold, gold);
  assert.strictEqual(p.equip.weapon, w);
});

// ----- 道具一覧・キャラクター -----
test('道具一覧: 装備をクリックすると詳細のポップアップが開き、装備する・外すとポップアップのまま表示が変わる', () => {
  const g = newGame();
  const p = g.player, old = p.equip.weapon;
  const it = giveItem(g, 'weapon', 2, 'rare');
  press(g, 'i');
  clickGear(g, 'inv', it.id);
  assert.ok(shown(g, 'itemPop'));
  assert.ok(htmlOf(g, 'itemPopBody').includes(it.name));
  assert.ok(htmlOf(g, 'detail').includes('アイテムをクリックすると詳しく表示します'), '右の欄はいつもつよさ');
  assert.deepStrictEqual(buttonLabels(g, 'menu').filter((l) => /装備する|捨てる|外す|売る（/.test(l)), ['装備する', '捨てる']);
  const t = g.game.time;
  clickButton(g, 'menu', 'equip');
  assert.strictEqual(p.equip.weapon, it);
  assert.ok(p.inventory.includes(old), '前の装備は持ち物に戻る');
  assert.ok(shown(g, 'itemPop'), 'ポップアップは開いたまま');
  assert.deepStrictEqual(buttonLabels(g, 'menu').filter((l) => /装備する|捨てる|外す/.test(l)), ['外す']);
  assert.strictEqual(g.game.time, t, '付け替えは行動にならない');
  clickButton(g, 'menu', 'unequip');
  assert.strictEqual(p.equip.weapon, null);
  assert.ok(p.inventory.includes(it));
  assert.deepStrictEqual(buttonLabels(g, 'menu').filter((l) => /装備する|捨てる|外す/.test(l)), ['装備する', '捨てる']);
  assert.strictEqual(openScreen(g), 'inv');
});

test('道具一覧: 持ち物がいっぱいだと外せない', () => {
  const g = newGame();
  const p = g.player, w = p.equip.weapon;
  fillInventory(g);
  press(g, 'i');
  clickGear(g, 'equip', w.id);
  assert.strictEqual(findButton(g, 'menu', 'unequip').disabled, true);
  clickButton(g, 'menu', 'unequip', {}, { force: true });
  assert.strictEqual(p.equip.weapon, w);
  assert.strictEqual(p.inventory.length, g.EC.inventorySize);
});

test('道具一覧: 捨てるとなくなり、ポップアップも閉じる', () => {
  const g = newGame();
  const p = g.player;
  const it = giveItem(g);
  press(g, 'i');
  clickGear(g, 'inv', it.id);
  clickButton(g, 'menu', 'drop');
  assert.ok(!p.inventory.includes(it));
  assert.strictEqual(shown(g, 'itemPop'), false);
  assert.strictEqual(openScreen(g), 'inv');
  assert.strictEqual(findButton(g, 'menu', 'sell'), null, '道具一覧では売れない');
});

test('道具一覧: ポップアップは「閉じる」・幕のクリックで閉じる', () => {
  const g = newGame();
  const it = giveItem(g);
  press(g, 'i');
  clickGear(g, 'inv', it.id);
  clickButton(g, 'menu', 'popClose');
  assert.strictEqual(shown(g, 'itemPop'), false);
  assert.strictEqual(openScreen(g), 'inv');
  clickGear(g, 'inv', it.id);
  clickPopBackdrop(g);
  assert.strictEqual(shown(g, 'itemPop'), false);
  assert.strictEqual(openScreen(g), 'inv');
});

test('道具一覧: 素材・道具をクリックすると詳細が出る', () => {
  const g = newGame();
  const p = g.player, M = g.IT.materials;
  p.materials = { wolfPelt: 4 };
  press(g, 'i');
  clickMat(g, 'wolfPelt');
  assert.ok(shown(g, 'itemPop'));
  assert.ok(htmlOf(g, 'itemPopBody').includes(`${M.wolfPelt.price} G（全部で ${M.wolfPelt.price * 4} G）`));
  assert.strictEqual(el(g, 'itemPopBody').style['--rc'], g.rarityOf(M.wolfPelt.rarity).color);
  press(g, 'Escape');
  clickTool(g, 'potion');
  assert.ok(htmlOf(g, 'itemPopBody').includes('持っている数'));
  assert.ok(findButton(g, 'menu', 'use', { tool: 'potion' }));
});

test('道具一覧: 回復薬を「使う」と画面を閉じて 1 行動 (一覧のボタン・ポップアップのボタン)', () => {
  for (const where of ['list', 'pop']) {
    const g = newGame();
    const p = g.player;
    p.hp = 5;
    const n = p.potions.potion, t = g.game.time;
    press(g, 'i');
    const saves = trackSaves(g), s0 = saves.count;
    if (where === 'pop') clickTool(g, 'potion');
    const b = useButton(g, where === 'pop');
    assert.strictEqual(b.disabled, false);
    clickNode(g, 'menu', b);
    assert.strictEqual(openScreen(g), null, where);
    assert.strictEqual(shown(g, 'menu'), false);
    assert.strictEqual(shown(g, 'itemPop'), false);
    assert.strictEqual(p.potions.potion, n - 1);
    assert.ok(p.hp > 5);
    assert.ok(g.game.time > t, '1 行動した');
    assert.ok(saves.count > s0);
  }
});
// 道具の「使う」ボタン (inPop: ポップアップの中のもの / 一覧のもの)
const useButton = (g, inPop) => screenNodes(g, 'menu').find((n) => n.tag === 'button' && n.dataset.act === 'use' && !!n.closest('#itemPop') === inPop);

test('道具一覧: HP が満タン・持っていない回復薬の「使う」は押せない', () => {
  const g = newGame();
  const p = g.player;
  press(g, 'i');
  assert.strictEqual(findButton(g, 'menu', 'use', { tool: 'potion' }).disabled, true, 'HP 満タン');
  assert.strictEqual(findButton(g, 'menu', 'use', { tool: 'hiPotion' }).disabled, true, '持っていない');
  clickTool(g, 'potion');
  assert.ok(htmlOf(g, 'itemPopBody').includes('HP が満タンなので使えない'));
  clickButton(g, 'menu', 'use', { tool: 'potion' }, { force: true });
  assert.strictEqual(openScreen(g), 'inv');
  assert.strictEqual(p.potions.potion, g.IT.potions.potion.start);
});

test('キャラクターの画面でも装備の付け替えはできるが、道具は使えない', () => {
  const g = newGame();
  const p = g.player;
  p.hp = 5;
  const it = giveItem(g, 'armor', 2, 'rare');
  press(g, 'Tab');
  assert.strictEqual(findButton(g, 'menu', 'use', { tool: 'potion' }), null);
  clickGear(g, 'inv', it.id);
  assert.ok(shown(g, 'itemPop'));
  clickButton(g, 'menu', 'equip');
  assert.strictEqual(p.equip.armor, it);
  assert.strictEqual(openScreen(g), 'char');
});

test('画面の処理の見張り: 開いている画面に合わないボタンが押されても何も起きない', () => {
  const g = newGame();
  const p = g.player;
  p.gold = 1000;
  p.hp = 5;
  // 鍛冶屋で回復薬を買う・道具を使う
  openNpc(g, 'townSmith');
  const n = p.potions.potion;
  clickStaleButton(g, 'menu', 'potion', { potion: 'potion' });
  clickStaleButton(g, 'menu', 'use', { tool: 'potion' });
  assert.strictEqual(p.potions.potion, n);
  assert.strictEqual(openScreen(g), 'smith');
  press(g, 'f');
  // 商人で、その店にない回復薬を買う・装備を買う・売る
  const it = giveItem(g);
  openNpc(g, 'merchant');
  clickStaleButton(g, 'menu', 'potion', { potion: 'hiPotion' });
  assert.ok(!p.potions.hiPotion);
  clickGear(g, 'inv', it.id);
  clickStaleButton(g, 'menu', 'sell');
  clickStaleButton(g, 'menu', 'buy');
  assert.ok(p.inventory.includes(it));
  assert.strictEqual(p.gold, 1000);
  press(g, 'f');
  // キャラクターの画面で道具を使う
  press(g, 'Tab');
  clickStaleButton(g, 'menu', 'use', { tool: 'potion' });
  assert.strictEqual(openScreen(g), 'char');
  assert.strictEqual(p.potions.potion, n);
  // 何も選んでいないときの装備する・捨てる・外す
  clickStaleButton(g, 'menu', 'equip');
  clickStaleButton(g, 'menu', 'drop');
  clickStaleButton(g, 'menu', 'unequip');
  assert.ok(p.inventory.includes(it));
  press(g, 'Escape');
  // 閉じたあとのクリック
  clickStaleButton(g, 'menu', 'use', { tool: 'potion' });
  clickStaleButton(g, 'menu', 'close');
  assert.strictEqual(p.potions.potion, n);
  assert.strictEqual(g.game.state, 'play');
});

// ----- 装備のボタンの見張り: detailHtml がそのボタンを出す選び方 (inv: 装備する + 捨てる / 売る、equip: 外す、shop: 買う) のときだけ効く -----
// 持ち物・装備・品ぞろえ・お金をまとめて写す (比べる用)
const gearState = (g, id) => JSON.stringify({
  gold: g.player.gold, inv: g.player.inventory.map((x) => x.id), equip: Object.values(g.player.equip).map((x) => x && x.id),
  stock: smithStock(g, id).map((x) => x.id),
});

test('鍛冶屋: 持ち物の装備を選んでいるときに古い「買う」が押されても、お金も持ち物も変わらない', () => {
  const g = newGame();
  const p = g.player;
  p.gold = 500;
  const it = giveItem(g, 'weapon', 1, 'common');
  openNpc(g, 'townSmith');
  clickGear(g, 'inv', it.id);
  assert.strictEqual(findButton(g, 'menu', 'buy'), null, '持ち物の装備には「買う」は出ない');
  const before = gearState(g, 'townSmith');
  clickStaleButton(g, 'menu', 'buy');
  assert.strictEqual(gearState(g, 'townSmith'), before);
  assert.strictEqual(p.inventory.filter((x) => x === it).length, 1, '増えない');
  assert.strictEqual(openScreen(g), 'smith');
});

test('鍛冶屋: 「買う」を 2 回押しても (2 回目は買った装備が持ち物の側で選ばれている) 1 回ぶんしか払わない', () => {
  const g = newGame();
  const p = g.player;
  p.gold = 500;
  openNpc(g, 'townSmith');
  const it = smithStock(g, 'townSmith')[0], price = g.itemValue(it);
  clickGear(g, 'shop', it.id);
  clickButton(g, 'menu', 'buy');
  clickStaleButton(g, 'menu', 'buy');
  assert.strictEqual(p.gold, 500 - price);
  assert.strictEqual(p.inventory.filter((x) => x === it).length, 1);
});

test('鍛冶屋: もう品ぞろえにない装備 (選んだまま残っていた) の古い「買う」は何もしない', () => {
  const g = newGame();
  const p = g.player;
  p.gold = 500;
  openNpc(g, 'townSmith');
  const it = smithStock(g, 'townSmith')[0];
  clickGear(g, 'shop', it.id);
  clickButton(g, 'menu', 'buy');
  // 品ぞろえの側で選ばれたまま残っていたことにする (もう品ぞろえにない)
  staleSelect(g, 'shop', it.id);
  const before = gearState(g, 'townSmith');
  clickStaleButton(g, 'menu', 'buy');
  assert.strictEqual(gearState(g, 'townSmith'), before);
  // ほかの鍛冶屋の品ぞろえの装備も、この鍛冶屋では買えない
  press(g, 'f');
  openNpc(g, 'waySmith');
  press(g, 'f');
  openNpc(g, 'townSmith');
  const other = smithStock(g, 'waySmith')[0];
  staleSelect(g, 'shop', other.id);
  const before2 = gearState(g, 'townSmith');
  clickStaleButton(g, 'menu', 'buy');
  assert.strictEqual(gearState(g, 'townSmith'), before2);
  assert.ok(smithStock(g, 'waySmith').includes(other));
});

test('鍛冶屋: 品ぞろえの装備を選んでいるときに古い「装備する」「売る」「捨てる」「外す」が押されても何も起きない', () => {
  const g = newGame();
  const p = g.player;
  p.gold = 500;
  openNpc(g, 'townSmith');
  const it = smithStock(g, 'townSmith')[0];
  clickGear(g, 'shop', it.id);
  assert.deepStrictEqual(buttonLabels(g, 'menu').filter((l) => /装備する|捨てる|売る（|外す|買う/.test(l)), [`買う（${g.itemValue(it)} G）`]);
  const before = gearState(g, 'townSmith');
  for (const act of ['equip', 'sell', 'drop', 'unequip']) {
    clickStaleButton(g, 'menu', act);
    assert.strictEqual(gearState(g, 'townSmith'), before, act);
  }
  assert.ok(!Object.values(p.equip).includes(it), 'ただで装備できない');
  assert.ok(htmlOf(g, 'detail').includes(it.name), '選んだまま');
});

test('鍛冶屋: 持ち物の装備には「捨てる」が出ないので、古い「捨てる」は何もしない', () => {
  const g = newGame();
  const it = giveItem(g);
  openNpc(g, 'townSmith');
  clickGear(g, 'inv', it.id);
  const before = gearState(g, 'townSmith');
  clickStaleButton(g, 'menu', 'drop');
  assert.strictEqual(gearState(g, 'townSmith'), before);
});

test('道具一覧: 装備中のものを選んでいるときの古い「装備する」「捨てる」、持ち物の装備を選んでいるときの古い「外す」は何もしない', () => {
  const g = newGame();
  const p = g.player, w = p.equip.weapon;
  const it = giveItem(g, 'weapon', 2, 'rare');
  press(g, 'i');
  clickGear(g, 'equip', w.id);
  const before = gearState(g, 'townSmith');
  clickStaleButton(g, 'menu', 'equip');
  clickStaleButton(g, 'menu', 'drop');
  assert.strictEqual(gearState(g, 'townSmith'), before, '装備中のものが持ち物に増えたり消えたりしない');
  clickGear(g, 'inv', it.id);
  clickStaleButton(g, 'menu', 'unequip');
  assert.strictEqual(gearState(g, 'townSmith'), before, '装備中のものが外れたり持ち物が増えたりしない');
  assert.strictEqual(p.equip.weapon, w);
});

test('鍛冶屋: 買う → 装備する → 外す → 売る の流れ (お金はちょうど値段と売値のぶん)', () => {
  const g = newGame();
  const p = g.player;
  p.gold = 500;
  openNpc(g, 'townSmith');
  const it = smithStock(g, 'townSmith')[0], price = g.itemValue(it), old = p.equip[it.slot];
  const inv0 = p.inventory.length;
  clickGear(g, 'shop', it.id);
  assert.ok(clickButton(g, 'menu', 'buy'));
  assert.strictEqual(p.gold, 500 - price);
  assert.ok(clickButton(g, 'menu', 'equip'));
  assert.strictEqual(p.equip[it.slot], it);
  assert.ok(!p.inventory.includes(it));
  assert.ok(clickButton(g, 'menu', 'unequip'));
  assert.strictEqual(p.equip[it.slot], null);
  assert.ok(p.inventory.includes(it));
  const sell = g.sellPrice(it);
  assert.strictEqual(label(findButton(g, 'menu', 'sell')), `売る（${sell} G）`);
  assert.ok(clickButton(g, 'menu', 'sell'));
  assert.strictEqual(p.gold, 500 - price + sell);
  assert.ok(!p.inventory.includes(it));
  assert.strictEqual(p.inventory.length, inv0 + (old ? 1 : 0), '前の装備だけが持ち物に残る');
  if (old) assert.ok(p.inventory.includes(old));
  assert.ok(!smithStock(g, 'townSmith').includes(it));
});

test('道具一覧を開くたびに選んでいたもの・ポップアップは消える', () => {
  const g = newGame();
  const it = giveItem(g);
  openNpc(g, 'townSmith');
  clickGear(g, 'inv', it.id);
  press(g, 'f');
  press(g, 'i');
  assert.strictEqual(shown(g, 'itemPop'), false);
  assert.ok(!htmlOf(g, 'invList').includes(' sel'), '選んでいる印はない');
  press(g, 'i');
  openNpc(g, 'townSmith');
  assert.ok(htmlOf(g, 'detail').includes('装備を選ぶと詳しく表示します'));
});
