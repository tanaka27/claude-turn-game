// トップレベルの名前 (全ファイルで共有される名前) の見張り。IMPLEMENTATION.md の注意と docs/testing.md の「トップレベルの名前」
//  - ファイルをまたいで同じ名前を 2 回宣言していないか (ブラウザでは読み込みエラーでゲーム全体が止まる)
//  - 関数の引数・ローカルの名前が、ゲームのファイルのトップレベルの名前を隠していないか (許可リストのものだけ認める)
//  名前を拾うのは tests/scope-scan.js (字句に分けてかっこの深さを数えるだけの簡単なスキャナ)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame, scriptList, ROOT } = require('./harness');
const { tokenize, scanSource, scanGame } = require('./scope-scan');

// ローカルの名前がトップレベルの名前を隠してよいもの: [ファイル, 名前, どのトップレベルの名前のあとか (within), 理由]
// 隠すのをやめたら、ここからも消す (使われなくなった行はテストが知らせる)
const SHADOW_ALLOW = [
  ['src/core.js', 'P', 'burst', '名前の付け替えの前 (次の作業で直す)'],
  ['src/core.js', 'H', 'fxHit', '名前の付け替えの前 (次の作業で直す)'],
  ['src/map.js', 'last', 'computeFlow', '名前の付け替えの前 (次の作業で直す)'],
  ['src/ui.js', 'act', 'actButton', '名前の付け替えの前 (次の作業で直す)'],
  ['src/ui.js', 'bar', 'profileHtml', '名前の付け替えの前 (次の作業で直す)'],
  ['src/ui.js', 'last', 'renderTalk', '名前の付け替えの前 (次の作業で直す)'],
  ['src/ui.js', 'act', 'showPause', '名前の付け替えの前 (次の作業で直す)'],
  ['src/hud.js', 'gateAt', 'drawWorldMap', '名前の付け替えの前 (次の作業で直す)'],
];

const scripts = scriptList();
let scanned = null;
const scan = () => (scanned = scanned || scanGame(ROOT, scripts));
const topNames = () => {
  const m = new Map();
  for (const f of scan()) for (const t of f.tops) { if (!m.has(t.name)) m.set(t.name, []); m.get(t.name).push(`${f.file}:${t.line}`); }
  return m;
};

// ----- スキャナそのもの -----
test('スキャナ: トップレベルの宣言 (分割代入・複数・; なしの行) を拾い、中のものはローカルにする', () => {
  const r = scanSource([
    'const A = 1, B = { x: 1, y: [2, 3] }, C = (a, b) => a + b;',
    'let { d, e: E2, f = 3, ...rest } = obj, [g, , h = 1] = arr',
    'const i = 2',
    'function j(k, { l, m: M2 } = {}, [n] = [], ...o) { const p = 1; let q; for (const [r, s] of x) {} }',
    'class K { method(t, u = v => v) { return `${w => w}` } }',
    'try { z() } catch (err) { var inner = 1; }',
    'if (a) { const notTop = 1; }',
  ].join('\n'));
  assert.deepStrictEqual(r.tops.map((t) => t.name), ['A', 'B', 'C', 'd', 'E2', 'f', 'rest', 'g', 'h', 'i', 'j', 'K']);
  assert.deepStrictEqual(r.locals.map((l) => l.name).sort(),
    ['M2', 'a', 'b', 'err', 'inner', 'k', 'l', 'n', 'notTop', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w'].sort());
  assert.strictEqual(r.locals.find((l) => l.name === 'p').within, 'j');
});

test('スキャナ: 文字列・テンプレート・正規表現・コメント・プロパティの中の名前は拾わない', () => {
  const r = scanSource([
    "const s = 'const x = 1', t = \"function y() {}\"; // const z = 1",
    '/* let w = 1 */ const re = /const v = \\/{/g, q = a / b / c;',
    'const tpl = `${ s } const u = 1 ${ `${ t }` }`;',
    'const o = { const: 1, let: 2, function: 3 }; o.let = 4; o?.const;',
    'const obj = { m(a) { return a; }, n: (b) => b };',
  ].join('\n'));
  assert.deepStrictEqual(r.tops.map((t) => t.name), ['s', 't', 're', 'q', 'tpl', 'o', 'obj']);
  assert.deepStrictEqual(r.locals.map((l) => l.name), ['a', 'b']);
});

// 名前として書けないもの (予約語など)。読み込んだゲームで使えるか確かめるときに除く
const RESERVED = new Set(('break case catch class const continue debugger default delete do else export extends finally for function if import ' +
  'in instanceof let new return super switch this throw try typeof var void while with yield await async static get set of ' +
  'null true false arguments eval').split(' '));

test('スキャナ: ゲームのファイルで拾ったトップレベルの名前は、読み込んだゲームにあり、拾い損ねもない', () => {
  const g = loadGame();
  const tops = topNames();
  // ctx で使える名前だけを返す (使えない名前は ReferenceError)。vm の配列はふつうの配列にする
  const usableIn = (ctx, names) => Array.from(vm.runInContext(
    `(() => { const out = []; ${names.map((n) => `try { ${n}; out.push(${JSON.stringify(n)}); } catch (e) {}`).join('\n')} return out; })()`, ctx));
  // 拾った名前はどれも本当にある (ないものを拾っていない)
  const usable = new Set(usableIn(g.context, [...tops.keys()]));
  const missing = [...tops.keys()].filter((n) => !usable.has(n));
  assert.deepStrictEqual(missing, [], `拾ったが読み込んだゲームにない名前: ${missing.join(', ')}`);
  // ゲームのファイルに出てくる名前のうち、読み込んだゲームで使えて、組み込み (空の vm でも使える) でもブラウザの代わりでもないものは、
  // どれもトップレベルで拾えている (拾い損ねがない)。window.__game は window に足したもので宣言ではない
  const idents = new Set();
  for (const f of scripts) {
    const toks = tokenize(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    toks.forEach((t, k) => { if (t.type === 'name' && !RESERVED.has(t.value) && !(k && /^\??\.$/.test(toks[k - 1].value))) idents.add(t.value); });
  }
  const builtin = new Set(usableIn(vm.createContext({}), [...idents]));
  const stubs = new Set([...g.sandboxKeys, '__game']);
  const unscanned = usableIn(g.context, [...idents].filter((n) => !builtin.has(n) && !stubs.has(n))).filter((n) => !tops.has(n));
  assert.deepStrictEqual(unscanned, [], `トップレベルにあるのに拾えていない名前: ${unscanned.join(', ')}`);
});

// ----- 本題 -----
test('トップレベルの名前がファイルをまたいで (同じファイルの中でも) 重なっていない', () => {
  const dups = [...topNames()].filter(([, at]) => at.length > 1).map(([n, at]) => `${n} (${at.join(' と ')})`);
  assert.deepStrictEqual(dups, [], `同じトップレベルの名前が 2 回以上宣言されている (ブラウザでは読み込みエラー): ${dups.join(' / ')}`);
});

test('関数の引数・ローカルの名前がトップレベルの名前を隠していない (許可リストのものを除く)', () => {
  const tops = topNames();
  const allowKey = (file, name, within) => `${file} ${name} ${within}`;
  const allow = new Map(SHADOW_ALLOW.map(([file, name, within, why]) => [allowKey(file, name, within), why]));
  const used = new Set();
  const found = [];
  for (const f of scan()) {
    for (const l of f.locals) {
      if (!tops.has(l.name)) continue;
      const key = allowKey(f.file, l.name, l.within);
      if (allow.has(key)) { used.add(key); continue; }
      found.push(`${f.file}:${l.line} の ${l.name} (${l.kind}, ${l.within} のあと) がトップレベルの ${l.name} (${tops.get(l.name).join(', ')}) を隠している`);
    }
  }
  assert.deepStrictEqual(found, [], `ローカルの名前を変えるか、わざとなら SHADOW_ALLOW に理由つきで足す:\n  ${found.join('\n  ')}`);
  const stale = [...allow.keys()].filter((k) => !used.has(k));
  assert.deepStrictEqual(stale, [], `SHADOW_ALLOW の使われていない行 (消す): ${stale.join(' / ')}`);
});
