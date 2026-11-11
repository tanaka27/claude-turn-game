// =====================================================================
//  テストの実行: node tests/run.js [名前の一部]
//  tests/*.test.js を全部読み込み、test(...) で登録したものを順に実行する。1 つでも失敗したら終了コード 1
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');

const registry = [];
let currentFile = '';
global.test = (name, fn, opts = {}) => registry.push({ name, fn, file: currentFile, ...opts });
global.test.skip = (name, fn, reason) => registry.push({ name, fn, file: currentFile, skip: reason || true });

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
for (const f of files) {
  currentFile = f;
  require(path.join(__dirname, f));
}

const filter = process.argv[2] || '';
let pass = 0, fail = 0, skip = 0;
const failures = [];
const t0 = Date.now();
(async () => {
for (const t of registry) {
  const label = `${t.file} > ${t.name}`;
  if (filter && !label.includes(filter)) continue;
  if (t.skip) {
    skip++;
    console.log(`  - SKIP ${label}${typeof t.skip === 'string' ? ` (${t.skip})` : ''}`);
    continue;
  }
  const ts = Date.now();
  try {
    await t.fn(); // async のテスト (Promise を返すもの) は終わるまで待つ
    pass++;
    const ms = Date.now() - ts;
    console.log(`  ok   ${label}${ms >= 500 ? ` (${(ms / 1000).toFixed(1)}s)` : ''}`);
  } catch (err) {
    fail++;
    failures.push({ label, err });
    console.log(`  FAIL ${label}`);
  }
}
for (const { label, err } of failures) {
  console.log(`\n--- ${label}\n${(err && err.stack) || err}`);
}
console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(fail ? 1 : 0);
})();
