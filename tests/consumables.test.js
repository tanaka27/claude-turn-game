// 道具 (data/items.js の ITEMS.consumables): どのキャラも同じ道 useConsumable で使う。効果の種類 (src/items.js の ITEM_EFFECTS)、
// 使えるかの判定 (道具一覧の「使う」と理由も同じ判定)、仲間に使う、クエストの報酬、データの確認 (docs/consumables.md)
'use strict';
const assert = require('assert');
const {
  newGame, arena, press, wait, messages, addAlly, applyBuff, buffsOf, bagOf, consumableDef, healRatio, useItem, defineConsumable, buyButton,
  findButton, clickButton, clickTool, htmlOf, textOf, nextToNpc, setLevel, dataProblems,
} = require('./helpers');

const lastMsg = (g) => messages(g)[messages(g).length - 1];
function open(safe = true) {
  const g = newGame();
  arena(g, { cols: 12, rows: 12, player: [5, 5], safe });
  return { g, p: g.player };
}

test('回復薬と上回復薬: 最大 HP の割合だけ回復し、文・色・頭の上の数・演出は今までどおり。1 つ減って 1 行動', () => {
  for (const [id, key] of [['potion', 'r'], ['hiPotion', 't']]) {
    const { g, p } = open(false);
    bagOf(p).hiPotion = 1;
    p.lastHurt = g.game.time; // 休んでいない (HP 再生はふつうの量)
    p.hp = 2;
    const heal = Math.round(p.stats.maxHp * healRatio(g, id));
    const n = bagOf(p)[id], t = g.game.time, fx0 = g.effects.length;
    press(g, key);
    assert.ok(g.game.time > t, `${id}: 1 行動`);
    assert.strictEqual(bagOf(p)[id], n - 1);
    assert.ok(Math.abs(p.hp - Math.min(p.stats.maxHp, 2 + heal + p.stats.hpRegen)) < 1e-9, `${id}: ${p.hp}`);
    assert.ok(messages(g).includes(`${consumableDef(g, id).name}を使った。HP が ${heal} 回復した。`), JSON.stringify(messages(g)));
    assert.strictEqual(g.logLines.find((l) => l.text.startsWith(consumableDef(g, id).name)).color, '#69f0ae');
    const ft = g.floatTexts.find((x) => x.text === `+${heal}`);
    assert.ok(ft && ft.color === '#69f0ae' && ft.size === 18 && ft.y === p.y - 30);
    assert.ok(g.effects.length > fx0, '回復の演出');
  }
  const { g } = open();
  assert.strictEqual(healRatio(g, 'potion'), 0.4);
  assert.strictEqual(healRatio(g, 'hiPotion'), 0.8);
});

test('HP が満タンなら「HP は満タンだ。」で使わない・持っていなければ「〇〇がない。」。どちらも行動にならない', () => {
  const { g, p } = open();
  const t = g.game.time;
  press(g, 'r');
  assert.strictEqual(lastMsg(g), 'HP は満タンだ。');
  assert.strictEqual(bagOf(p).potion, 3);
  p.hp = 5;
  press(g, 't');
  assert.strictEqual(lastMsg(g), '上回復薬がない。');
  assert.strictEqual(p.hp, 5);
  assert.strictEqual(g.game.time, t);
  assert.strictEqual(useItem(g, p, 'hiPotion'), false);
});

test('MP を回復する道具 (healMp)。満タンなら使わない', () => {
  const { g, p } = open();
  defineConsumable(g, 'ether', { name: '魔力水', key: 'g', start: 2, effects: [{ kind: 'healMp', ratio: 0.5 }] });
  bagOf(p).ether = 2;
  const t = g.game.time;
  press(g, 'g');
  assert.strictEqual(lastMsg(g), 'MP は満タンだ。');
  assert.strictEqual(g.game.time, t);
  p.mp = 0;
  const n = Math.round(p.stats.maxMp * 0.5), hp = p.hp;
  press(g, 'g');
  assert.ok(g.game.time > t);
  assert.ok(p.mp >= n && p.mp < n + 1, `${p.mp}`);
  assert.strictEqual(p.hp, hp);
  assert.strictEqual(bagOf(p).ether, 1);
  assert.ok(messages(g).includes(`魔力水を使った。MP が ${n} 回復した。`));
});

test('強化をかける道具 (addBuff): かかり、使った相手の n 行動のあいだ続く。もっと長くかかっていれば使わない', () => {
  const { g, p } = open();
  defineConsumable(g, 'tonic', { name: '力の薬', key: 'g', effects: [{ kind: 'addBuff', buff: 'atkUp', actions: 3 }] });
  bagOf(p).tonic = 2;
  const atk = p.stats.atk;
  press(g, 'g');
  assert.deepStrictEqual(buffsOf(p), [{ id: 'atkUp' }]);
  assert.ok(p.stats.atk > atk);
  assert.ok(messages(g).includes('力の薬を使った。攻撃力アップ（3 行動）'));
  // もう 3 行動ぶんかかっているので効かない
  assert.strictEqual(useItem(g, p, 'tonic'), false);
  assert.strictEqual(lastMsg(g), '攻撃力アップはもうかかっている。');
  assert.strictEqual(bagOf(p).tonic, 1);
  wait(g, 2);
  assert.deepStrictEqual(buffsOf(p), [{ id: 'atkUp' }], '使った行動は数えず、2 行動ではまだ続く');
  wait(g, 1);
  assert.deepStrictEqual(buffsOf(p), [], '3 行動で切れる');
});

test('効果が 2 つの道具: どれか 1 つでも効けば使え、効くものだけ効かせる。どれも効かなければ最初の効果の文で使わない', () => {
  const { g, p } = open();
  defineConsumable(g, 'elixir', { name: '霊薬', key: 'g', effects: [{ kind: 'healHp', ratio: 0.5 }, { kind: 'addBuff', buff: 'atkUp', actions: 4 }] });
  bagOf(p).elixir = 3;
  // HP は満タンだが強化は効く
  const hp = p.hp;
  assert.strictEqual(useItem(g, p, 'elixir'), true);
  assert.strictEqual(p.hp, hp);
  assert.deepStrictEqual(buffsOf(p), [{ id: 'atkUp' }]);
  assert.strictEqual(lastMsg(g), '霊薬を使った。攻撃力アップ（4 行動）');
  // HP 満タン・強化もかかっている
  assert.strictEqual(useItem(g, p, 'elixir'), false);
  assert.strictEqual(lastMsg(g), 'HP は満タンだ。');
  assert.strictEqual(bagOf(p).elixir, 2);
  // HP が減っていて、強化がもう同じ長さかかっているなら、HP だけ回復する
  p.hp = 3;
  const heal = Math.round(p.stats.maxHp * 0.5);
  assert.strictEqual(useItem(g, p, 'elixir'), true);
  assert.strictEqual(p.hp, 3 + heal);
  assert.strictEqual(lastMsg(g), `霊薬を使った。HP が ${heal} 回復した。`);
  assert.strictEqual(g.floatTexts.filter((t) => t.x === p.x).length, 2, '頭の上の文は使ったときに効いたものだけ (強化 1 回目・回復)');
  assert.strictEqual(bagOf(p).elixir, 1);
});

test('仲間に使う: 仲間が回復し、主人公は回復しない。数は使った主人公から減り、文に仲間の名前が出る', () => {
  const { g, p } = open();
  const ally = addAlly(g, [6, 5], { name: 'リナ' });
  ally.hp = 4; p.hp = 4;
  const heal = Math.round(ally.stats.maxHp * healRatio(g, 'potion'));
  assert.strictEqual(useItem(g, p, 'potion', ally), true);
  assert.strictEqual(ally.hp, 4 + heal);
  assert.strictEqual(p.hp, 4);
  assert.strictEqual(bagOf(p).potion, 2);
  assert.strictEqual(lastMsg(g), `リナに回復薬を使った。リナの HP が ${heal} 回復した。`);
  assert.ok(g.floatTexts.some((t) => t.text === `+${heal}` && t.x === ally.x));
  // 仲間が満タンなら、主人公の HP が減っていても使わない
  ally.hp = ally.stats.maxHp;
  assert.strictEqual(useItem(g, p, 'potion', ally), false);
  assert.strictEqual(lastMsg(g), 'リナの HP は満タンだ。');
  assert.strictEqual(bagOf(p).potion, 2);
  // 仲間に強化をかける: 仲間の次の行動から数える
  defineConsumable(g, 'tonic', { name: '力の薬', effects: [{ kind: 'addBuff', buff: 'atkUp', actions: 2 }] });
  bagOf(p).tonic = 1;
  assert.strictEqual(useItem(g, p, 'tonic', ally), true);
  assert.deepStrictEqual(buffsOf(ally), [{ id: 'atkUp' }]);
  assert.deepStrictEqual(buffsOf(p), []);
  assert.strictEqual(lastMsg(g), 'リナに力の薬を使った。リナの攻撃力アップ（2 行動）');
  // 道具を持っていないキャラ (仲間) は使えない
  assert.strictEqual(useItem(g, ally, 'potion'), false);
  assert.strictEqual(lastMsg(g), '回復薬がない。');
});

test('道具一覧: 「使う」が押せるか・使えない理由は、使うときと同じ判定から出る (テストで足した道具も並ぶ)', () => {
  const { g, p } = open();
  defineConsumable(g, 'ether', { name: '魔力水', key: 'g', effects: [{ kind: 'healMp', ratio: 0.5 }] });
  defineConsumable(g, 'tonic', { name: '力の薬', key: 'h', effects: [{ kind: 'addBuff', buff: 'atkUp', actions: 3 }] });
  bagOf(p).ether = 1; bagOf(p).tonic = 1;
  applyBuff(g, p, 'atkUp', 5);
  press(g, 'i');
  assert.strictEqual(findButton(g, 'menu', 'use', { tool: 'ether' }).disabled, true);
  assert.strictEqual(findButton(g, 'menu', 'use', { tool: 'tonic' }).disabled, true);
  assert.ok(htmlOf(g, 'toolList').includes('最大MPの 50% 回復（今なら'));
  clickTool(g, 'ether');
  assert.ok(htmlOf(g, 'itemPopBody').includes('MP が満タンなので使えない'));
  press(g, 'Escape');
  clickTool(g, 'tonic');
  assert.ok(htmlOf(g, 'itemPopBody').includes('攻撃力アップ中なので使えない'));
  press(g, 'Escape');
  press(g, 'i');
  p.mp = 0;
  press(g, 'i');
  assert.strictEqual(findButton(g, 'menu', 'use', { tool: 'ether' }).disabled, false);
  clickButton(g, 'menu', 'use', { tool: 'ether' });
  assert.ok(p.mp > 0);
  assert.strictEqual(bagOf(p).ether, 0);
});

test('商人はデータに書いた道具を売る (テストで足した道具も)', () => {
  const g = newGame();
  defineConsumable(g, 'ether', { name: '魔力水', price: 40, max: 2, effects: [{ kind: 'healMp', ratio: 0.5 }] });
  g.ITEMS.shops.townGeneral.consumables.push('ether');
  const p = g.player;
  p.gold = 100;
  nextToNpc(g, 'merchant');
  press(g, 'f');
  assert.ok(htmlOf(g, 'shopList').includes('最大MPの 50% 回復'));
  assert.ok(clickButton(g, 'menu', ...buyButton('ether')));
  assert.ok(clickButton(g, 'menu', ...buyButton('ether')));
  assert.strictEqual(bagOf(p).ether, 2);
  assert.strictEqual(p.gold, 20);
  assert.strictEqual(findButton(g, 'menu', ...buyButton('ether')).disabled, true, '持てる数まで');
});

test('クエストの報酬は書いた道具をくれる (2 種類・上限で止まる)。報酬の文にもすべて出る', () => {
  const g = newGame();
  const p = g.player;
  setLevel(g, 3);
  g.questById('c_bee').reward.consumables = [{ id: 'potion', count: 2 }, { id: 'hiPotion', count: 3 }];
  p.quests = { c_wolf: { state: 'claimed', count: 8 }, c_bee: { state: 'ready', count: 5 } };
  bagOf(p).potion = 19; bagOf(p).hiPotion = 1;
  nextToNpc(g, 'captain');
  press(g, 'f');
  press(g, 'Enter');
  assert.strictEqual(bagOf(p).potion, 20);
  assert.strictEqual(bagOf(p).hiPotion, 4);
  assert.strictEqual(textOf(g, 'questNote'), '「毒針の羽音」の報酬を受け取った: 経験値 150、60 G、回復薬 ×2、上回復薬 ×3');
});

test('データの確認: 今のデータには食い違いがない。効果の種類・数値・キー・店とクエストの参照を調べる', () => {
  const g = newGame();
  assert.deepStrictEqual(dataProblems(g), []);
  const C = g.ITEMS.consumables;
  C.bad1 = { name: 'x', rarity: 'common', key: 'g', price: 1, max: 3, start: 0, effects: [{ kind: 'noSuchKind' }] };
  C.bad2 = { name: 'x', rarity: 'common', key: '1', price: 0, max: 3, start: 5, effects: [{ kind: 'healHp', ratio: 2 }] };
  C.bad3 = { name: 'x', rarity: 'common', key: 'w', price: 1, max: 3, start: 0, effects: [{ kind: 'addBuff', buff: 'nope', actions: 2 }] };
  C.bad4 = { name: 'x', rarity: 'common', key: 'r', price: 1, max: 3, start: 0, effects: [] };
  g.ITEMS.shops.wayTools.consumables.push('missing');
  g.questById('g_trial').reward.consumables.push({ id: 'gone', count: 1 }, { id: 'potion', count: 0 });
  const ps = dataProblems(g).join('\n');
  for (const s of [
    "consumables.bad1: 効果の種類 'noSuchKind'",
    "キー '1' は移動・画面・スキルのキーと重なっている",
    "キー 'w' は移動・画面・スキルのキーと重なっている",
    '道具のキーが重なっている',
    'consumables.bad2: price は 1 以上',
    'consumables.bad2: start は 0〜max',
    'consumables.bad2: healHp: ratio は 0 より大きく 1 以下',
    "consumables.bad3: addBuff: buff 'nope' が data/buffs.js にない",
    'consumables.bad4: effects (効果の並び) がない',
    "shops.wayTools: 道具 'missing' が consumables にない",
    "'g_trial': 報酬の道具 'gone' が data/items.js の consumables にない",
    "'g_trial': 報酬の道具 'potion' の count は 1 以上の整数",
  ]) assert.ok(ps.includes(s), `${s}\n---\n${ps}`);
});
