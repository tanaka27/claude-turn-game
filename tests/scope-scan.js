// =====================================================================
//  トップレベルの名前と、それを隠すローカルの名前を拾う小さなスキャナ (tests/globals.test.js が使う)
//  ゲームのファイルはモジュールではなくふつうの <script> で、トップレベルの名前は全ファイルで共有される
//  (IMPLEMENTATION.md の注意)。Node には JS の構文解析器が公開されていないので、字句 (トークン) に分けて
//  かっこの深さを数えるだけの簡単な方法で拾う。完全な構文解析ではない:
//   - 文字列・テンプレート (中の ${ } はコードとして読む)・コメント・正規表現を読み飛ばす
//     (/ を正規表現とみなすのは、直前が値で終わらないとき。) ] } 名前 数 文字列 のあとは割り算)
//   - トップレベルの名前: かっこの深さ 0 の const / let / var (分割代入も) と function / class の名前
//   - ローカルの名前: 深さ 1 以上の const / let / var / function / class、関数の引数
//     (function (…) / (…) => / 名前 => / メソッドの 名前(…) { / catch (e))
//   - 文の終わりは ; か , か閉じかっこ。; を省いた行は、次の行が文の始めのキーワード (const や if など) なら終わりとみなす
//  拾い損ね・拾いすぎがあれば、ここをむりに賢くせず、globals.test.js の許可リストに理由つきで書く
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');

// 予約語など、名前として拾わないもの
const KEYWORDS = new Set(('break case catch class const continue debugger default delete do else export extends finally for ' +
  'function if import in instanceof let new return super switch this throw try typeof var void while with yield ' +
  'await async of static get set null true false undefined').split(' '));
// このあとの / は正規表現 (式が始まるところ)
const BEFORE_EXPR = new Set('return typeof instanceof in of new delete void throw case do else yield await'.split(' '));
// ; を省いた行で、新しい文の始まりとみなすキーワード
const STATEMENT_START = new Set('const let var function class if for while do switch return throw try break continue'.split(' '));
// 名前 ( … ) { をメソッドとみなさないキーワード
const NOT_METHOD = new Set('if for while switch catch function with return typeof new await'.split(' '));
const PUNCS = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '??=', '&&=', '||=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
const OPEN = new Set(['(', '[', '{', '${']);
const CLOSE = { ')': '(', ']': '[', '}': '{', '}$': '${' };

// 字句に分ける。トークン: { type: 'name' | 'num' | 'str' | 'regex' | 'punc', value, line, nl (前に改行があるか) }
// テンプレートの `…${ 式 }…` は str, '${', 式のトークン, '}$', str に分ける
function tokenize(src) {
  const toks = [];
  const stack = []; // 開いている { と ${ (テンプレートの中に戻るため)
  let i = 0, line = 1, nl = true;
  const n = src.length;
  const push = (type, value, l) => { toks.push({ type, value, line: l, nl }); nl = false; };
  const regexOk = () => {
    const p = toks[toks.length - 1];
    if (!p) return true;
    if (p.type === 'name') return BEFORE_EXPR.has(p.value);
    if (p.type === 'punc') return !(p.value === ')' || p.value === ']' || p.value === '}' || p.value === '}$');
    return false;
  };
  // テンプレートの文字の部分を読む (i は ` か } の次)。${ で止まれば true
  const readTemplate = () => {
    const l = line;
    for (; i < n; i++) {
      const c = src[i];
      if (c === '\\') { i++; continue; }
      if (c === '\n') line++;
      if (c === '`') { i++; push('str', '`', l); return false; }
      if (c === '$' && src[i + 1] === '{') { i += 2; push('str', '`', l); push('punc', '${', line); stack.push('${'); return true; }
    }
    throw new Error(`テンプレートが閉じていない (${l} 行)`);
  };
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; nl = true; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) throw new Error(`コメントが閉じていない (${line} 行)`);
      for (let k = i; k < end; k++) if (src[k] === '\n') { line++; nl = true; }
      i = end + 2; continue;
    }
    if (c === '"' || c === "'") {
      const l = line;
      for (i++; i < n && src[i] !== c; i++) {
        if (src[i] === '\\') i++;
        else if (src[i] === '\n') throw new Error(`文字列が閉じていない (${l} 行)`);
      }
      i++; push('str', c, l); continue;
    }
    if (c === '`') { i++; readTemplate(); continue; }
    if (c === '/' && regexOk()) {
      const l = line;
      let inClass = false;
      for (i++; i < n; i++) {
        const d = src[i];
        if (d === '\\') { i++; continue; }
        if (d === '\n') throw new Error(`正規表現が閉じていない (${l} 行)`);
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) break;
      }
      i++;
      while (i < n && /[a-z]/i.test(src[i])) i++;
      push('regex', '/', l); continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      const l = line;
      while (i < n && /[0-9a-zA-Z_.]/.test(src[i])) {
        if (/[eE]/.test(src[i]) && /[+-]/.test(src[i + 1]) && !/^0[xX]/.test(src.slice(i - 20, i))) i++;
        i++;
      }
      push('num', '0', l); continue;
    }
    if (/[\p{ID_Start}$_]/u.test(c)) {
      const m = /^[\p{ID_Continue}$‌‍]+/u.exec(src.slice(i, i + 200));
      push('name', m[0], line); i += m[0].length; continue;
    }
    if (c === '{') { stack.push('{'); push('punc', '{', line); i++; continue; }
    if (c === '}') {
      const top = stack.pop();
      i++;
      if (top === '${') { push('punc', '}$', line); readTemplate(); } else push('punc', '}', line);
      continue;
    }
    const p = PUNCS.find((s) => src.startsWith(s, i)) || c;
    push('punc', p, line); i += p.length;
  }
  return toks;
}

// かっこの対応 (開き → 閉じ、閉じ → 開き) と、各トークンのかっこの深さ
function structure(toks) {
  const match = new Array(toks.length).fill(-1);
  const depth = new Array(toks.length).fill(0);
  const st = [];
  toks.forEach((t, k) => {
    if (t.type === 'punc' && CLOSE[t.value]) {
      const o = st.pop();
      if (o === undefined || toks[o].value !== CLOSE[t.value]) throw new Error(`かっこの対応がおかしい (${t.line} 行)`);
      match[o] = k; match[k] = o;
    }
    depth[k] = st.length;
    if (t.type === 'punc' && OPEN.has(t.value)) st.push(k);
  });
  if (st.length) throw new Error(`かっこが閉じていない (${toks[st[st.length - 1]].line} 行)`);
  return { match, depth };
}

// ファイル 1 つを調べる。戻り値: { tops: [{ name, line }], locals: [{ name, line, kind, within }] }
//   within: そのローカルより前で最後のトップレベルの名前 (どの関数の中かの目安)
function scanSource(src) {
  const toks = tokenize(src);
  const { match, depth } = structure(toks);
  const tops = [], locals = [];
  const at = (k) => toks[k] || { type: 'eof', value: '', line: 0 };
  const isP = (k, v) => at(k).type === 'punc' && at(k).value === v;
  const isName = (k) => at(k).type === 'name';
  const topBefore = (k) => { let w = null; for (const t of tops) if (t.k < k) w = t.name; return w; };
  const addLocal = (k, kind) => locals.push({ name: at(k).value, line: at(k).line, kind, k });

  // 式を読み飛ばす: 同じ深さの , か ; か、閉じかっこ (深さが下がる)、改行のあとの文の始めのキーワードまで
  const skipExpr = (k) => {
    const d0 = depth[k];
    for (; k < toks.length; k++) {
      const t = toks[k];
      if (depth[k] < d0) return k;
      if (depth[k] === d0) {
        if (t.type === 'punc' && (t.value === ',' || t.value === ';')) return k;
        if (t.nl && t.type === 'name' && STATEMENT_START.has(t.value) && k > 0) return k;
      }
      if (t.type === 'punc' && OPEN.has(t.value)) k = match[k]; // 中身はまとめて飛ばす
    }
    return k;
  };
  // 束縛のパターン (名前 / { … } / [ … ]) を読み、名前を out に足す。戻り値はパターンの次の位置
  const pattern = (k, out) => {
    if (isName(k)) { out.push(k); return k + 1; }
    if (isP(k, '{') || isP(k, '[')) {
      const obj = at(k).value === '{';
      const end = match[k];
      let j = k + 1;
      while (j < end) {
        if (isP(j, ',')) { j++; continue; }
        if (isP(j, '...')) { j = pattern(j + 1, out); continue; }
        if (obj) {
          // キー: 名前 / 文字列 / 数 / [計算]
          let key = j;
          if (isP(j, '[')) j = match[j] + 1; else j++;
          if (isP(j, ':')) j = pattern(j + 1, out);
          else if (isName(key)) out.push(key);
        } else {
          j = pattern(j, out);
        }
        if (isP(j, '=')) j = skipExpr(j + 1);
      }
      return end + 1;
    }
    return k + 1; // 想定外の形は読み飛ばす
  };
  // 引数の並び ( … ) の名前 (k は '(')。既定値の式は読み飛ばす
  const paramParen = (k) => {
    const out = [];
    const end = match[k];
    let j = k + 1;
    while (j < end) {
      if (isP(j, ',')) { j++; continue; }
      if (isP(j, '...')) j++;
      j = pattern(j, out);
      if (isP(j, '=')) j = skipExpr(j + 1);
    }
    return out;
  };

  const seenParen = new Set();
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    const prevDot = isP(k - 1, '.') || isP(k - 1, '?.');
    if (t.type === 'name' && !prevDot && !isP(k + 1, ':')) {
      const v = t.value;
      if (v === 'const' || v === 'let' || v === 'var') {
        if (v === 'let' && !(isName(k + 1) || isP(k + 1, '{') || isP(k + 1, '['))) continue;
        let j = k + 1;
        for (;;) {
          const out = [];
          j = pattern(j, out);
          for (const x of out) {
            if (depth[k] === 0) tops.push({ name: at(x).value, line: at(x).line, k: x, kind: v });
            else addLocal(x, v);
          }
          if (isP(j, '=')) j = skipExpr(j + 1);
          if (isP(j, ',') && depth[j] === depth[k]) { j++; continue; }
          break;
        }
        continue;
      }
      if (v === 'function' || v === 'class') {
        let j = k + 1;
        if (isP(j, '*')) j++;
        if (isName(j) && at(j).value !== 'extends') {
          const isDecl = depth[k] === 0 && !(isP(k - 1, '=') || isP(k - 1, '(') || isP(k - 1, ',') || isP(k - 1, ':') || isP(k - 1, '?'));
          if (isDecl) tops.push({ name: at(j).value, line: at(j).line, k: j, kind: v });
          else addLocal(j, v);
          j++;
        }
        if (v === 'function' && isP(j, '(')) { seenParen.add(j); for (const x of paramParen(j)) addLocal(x, 'param'); }
        continue;
      }
      if (v === 'catch' && isP(k + 1, '(')) { seenParen.add(k + 1); for (const x of paramParen(k + 1)) addLocal(x, 'catch'); continue; }
      // メソッド: 名前 ( … ) {
      if (!KEYWORDS.has(v) || v === 'get' || v === 'set' || v === 'static' || v === 'async') {
        if (!NOT_METHOD.has(v) && isP(k + 1, '(') && !seenParen.has(k + 1) && isP(match[k + 1] + 1, '{')) {
          seenParen.add(k + 1);
          for (const x of paramParen(k + 1)) addLocal(x, 'param');
        }
      }
    }
    if (isP(k, '=>')) {
      if (isName(k - 1)) addLocal(k - 1, 'param');
      else if (isP(k - 1, ')')) {
        const o = match[k - 1];
        if (!seenParen.has(o)) { seenParen.add(o); for (const x of paramParen(o)) addLocal(x, 'param'); }
      }
    }
  }
  for (const l of locals) l.within = topBefore(l.k);
  return { tops: tops.map(({ name, line, kind }) => ({ name, line, kind })), locals: locals.map(({ name, line, kind, within }) => ({ name, line, kind, within })) };
}

// index.html の順に、ゲームのファイルを全部調べる。戻り値: [{ file, tops, locals }]
function scanGame(root, scripts) {
  return scripts.map((file) => ({ file, ...scanSource(fs.readFileSync(path.join(root, file), 'utf8')) }));
}

module.exports = { tokenize, scanSource, scanGame };
