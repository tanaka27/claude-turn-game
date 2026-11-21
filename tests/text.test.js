// 画面に出す文章 (data/text.js の TEXT と src/core.js の txt / fmt)。docs/text.md
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadGame } = require('./harness');
const { dataProblems } = require('./helpers');

const SRC = path.join(__dirname, '..', 'src');
const sources = () => fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).map((f) => [f, fs.readFileSync(path.join(SRC, f), 'utf8').replace(/^\s*\/\/.*$/gm, '')]); // 1 行まるごとのコメントは除く
const placeholders = (t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

// src/ の txt('キー', { ... }) を拾う。値の名前は { } の中のいちばん外側の「名前:」と省略形の「名前」(だいたいでよい)
function txtCalls() {
  const calls = [];
  for (const [file, code] of sources()) {
    const re = /\btxt\(\s*'([\w.]+)'/g;
    let m;
    while ((m = re.exec(code))) {
      let i = re.lastIndex;
      while (/\s/.test(code[i])) i++;
      let names = [];
      if (code[i] === ',') {
        i++;
        while (/\s/.test(code[i])) i++;
        if (code[i] === '{') {
          let depth = 0, j = i, body = '';
          // 文字列・テンプレート (中の ${ } も) を読み飛ばす。戻り値は閉じる引用符の位置
          const skipString = (k) => {
            const q = code[k];
            for (k++; k < code.length; k++) {
              if (code[k] === '\\') { k++; continue; }
              if (q === '`' && code[k] === '$' && code[k + 1] === '{') {
                let d = 0;
                for (k++; k < code.length; k++) {
                  if (code[k] === "'" || code[k] === '"' || code[k] === '`') { k = skipString(k); continue; }
                  if (code[k] === '{') d++;
                  if (code[k] === '}' && --d === 0) break;
                }
                continue;
              }
              if (code[k] === q) return k;
            }
            return k;
          };
          for (; j < code.length; j++) {
            const c = code[j];
            if (c === "'" || c === '"' || c === '`') { j = skipString(j); body += ' '; continue; }
            if ('{(['.includes(c)) depth++;
            if ('})]'.includes(c)) depth--;
            if (depth === 1 && j > i) body += c; else if (depth >= 1 && j > i) body += ' ';
            if (depth === 0) break;
          }
          // いちばん外側の , で分けて、名前を取る (文字列・テンプレートの中は上で空白になっている)
          names = body.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.match(/^(\w+)/)[1]);
        } else names = null; // 値をまとめて渡している (調べない)
      }
      calls.push({ file, key: m[1], names });
    }
  }
  return calls;
}

test('src/ で使っている文のキーが data/text.js にあり、渡す値の名前と文の {名前} がそろっている', () => {
  const g = loadGame();
  const calls = txtCalls();
  assert.ok(calls.length > 150, `txt の呼び出しを拾えている (${calls.length})`);
  const bad = [];
  for (const c of calls) {
    const t = g.textTemplate(c.key);
    if (typeof t !== 'string') { bad.push(`${c.file}: '${c.key}' がない`); continue; }
    if (c.names === null) continue;
    const need = placeholders(t);
    for (const n of need) if (!c.names.includes(n)) bad.push(`${c.file}: '${c.key}' の {${n}} の値を渡していない`);
    for (const n of c.names) if (!need.includes(n)) bad.push(`${c.file}: '${c.key}' に {${n}} がない`);
  }
  assert.deepStrictEqual(bad, []);
});

test('fmt は {名前} に値を入れ、ないキー・足りない値はコンソールに 1 回だけ [データの確認] を出す', () => {
  const g = loadGame();
  assert.strictEqual(g.fmt('{a}と{b}と{a}', { a: 1, b: 'x' }), '1とxと1');
  assert.strictEqual(g.txt('combat.heroHurt', { src: 'ウルフ', what: '噛みつき', dmg: 3, crit: '' }), 'ウルフの噛みつき！ 3 のダメージを受けた');
  const before = g.consoleLog.length;
  assert.strictEqual(g.txt('combat.nothing'), 'combat.nothing');
  g.txt('combat.nothing');
  assert.strictEqual(g.txt('combat.defeated', {}), '{who}を倒した。');
  const msgs = g.consoleLog.slice(before).map((m) => m.text);
  assert.strictEqual(msgs.length, 2, msgs.join('\n'));
  assert.ok(msgs.every((m) => m.includes('[データの確認]')));
});

test('データの確認: data/text.js の文が文字列でない・{ } の形がおかしいものを見つける', () => {
  const g = loadGame();
  assert.deepStrictEqual(dataProblems(g).filter((p) => p.includes('text.js')), []);
  g.TEXT.combat.broken = '{who のミス';
  g.TEXT.combat.notText = 3;
  const ps = dataProblems(g).filter((p) => p.includes('text.js'));
  assert.ok(ps.some((p) => p.includes("'combat.broken'")), ps.join('\n'));
  assert.ok(ps.some((p) => p.includes("'combat.notText'")), ps.join('\n'));
});
