// =====================================================================
//  マップ (マス目・視線・経路探索・ゾーンの読み込みと切り替え)
// =====================================================================
'use strict';

// ===================================================================
//  マス目。world.js の px の値を、読み込むときにマスに直す (1 マス = T px。T は core.js)
// ===================================================================
let zone = null, MAP_W = 0, MAP_H = 0, COLS = 0, ROWS = 0;
// obstacles: マスにそろえた障害物 (描画用。x, y, w, h は px)
let obstacles = [], decor = [];
// blocked: 1 なら通れない (地形と NPC) / shotBlocked: 1 なら攻撃も通らない / gateAt: 門の番号 (なければ -1)
let blocked = null, shotBlocked = null, gateAt = null, flow = null;
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const idx = (x, y) => y * COLS + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const tileOf = (px) => Math.floor(px / T);
const center = (t) => (t + 0.5) * T;
const isBlocked = (x, y) => !inMap(x, y) || !!blocked[idx(x, y)];
const isShotBlocked = (x, y) => !inMap(x, y) || !!shotBlocked[idx(x, y)];
// マスどうしの距離。dist はマスの中心どうしの直線距離、steps は何歩か (斜めも 1 歩)
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const steps = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

// px の範囲を、いちばん近いマスの境目にそろえる (最低 1 マス)
function snapRect(x, y, w, h) {
  const x0 = Math.round(x / T), y0 = Math.round(y / T);
  const x1 = Math.max(x0 + 1, Math.round((x + w) / T)), y1 = Math.max(y0 + 1, Math.round((y + h) / T));
  return { tx: x0, ty: y0, tw: x1 - x0, th: y1 - y0 };
}

// (dx, dy) 方向へ 1 歩動けるか (地形だけを見る。斜めは角をすり抜けられない)
function canStep(x, y, dx, dy) {
  const nx = x + dx, ny = y + dy;
  if (isBlocked(nx, ny)) return false;
  if (dx && dy && (isBlocked(x + dx, y) || isBlocked(x, y + dy))) return false;
  return true;
}

// 視線: マスの中心どうしを結ぶ線が、攻撃を遮る地形を通らないか (両端のマスは見ない)
//   線の上の点を 1/4 マスごとに調べる。点の位置は整数で計算する (どちら向きに調べても同じ点になる)
//   点がマスの境目の辺にちょうど乗ったら、辺の両側のマスを見る
//   線がマスの角をちょうど通るとき (点が角に乗るかによらない): 角で触れるだけの 2 マス (角を挟む 2 マス) は、
//   両方とも遮るときだけ通らない (斜めに並んだ壁の間は抜けられない。壁 1 つの角をかすめるだけなら通る)
//   こうすると、線の向きを逆にしても、地形を左右・上下に裏返しても、結果は同じになる
function hasLOS(x1, y1, x2, y2) {
  const n = Math.ceil(dist(x1, y1, x2, y2) * 4), D = 2 * n, dx = x2 - x1, dy = y2 - y1;
  const wall = (x, y) => (x !== x1 || y !== y1) && (x !== x2 || y !== y2) && isShotBlocked(x, y);
  // 斜めに隣り合う 2 マス (a → b) の間で、線が 2 マスの共有する角をちょうど通り、角を挟む 2 マスが両方とも遮るか
  const sealed = (ax, ay, bx, by) => {
    if (ax === bx || ay === by) return false;
    const cx = Math.max(ax, bx), cy = Math.max(ay, by);
    return (2 * cx - 2 * x1 - 1) * dy === (2 * cy - 2 * y1 - 1) * dx && wall(bx, ay) && wall(ax, by);
  };
  let px = x1, py = y1; // 直前の点のマス (辺や角に乗った点は除く)
  for (let i = 1; i < n; i++) {
    // 点の位置 × 2n (マスの中心は x + 0.5 なので 2 倍して整数にする)
    const X = (2 * x1 + 1) * n + 2 * dx * i, Y = (2 * y1 + 1) * n + 2 * dy * i;
    const x = Math.floor(X / D), y = Math.floor(Y / D);
    const onX = x * D === X, onY = y * D === Y;
    if (onX && onY) continue;
    if (onX || onY) {
      if (wall(x, y) || wall(onX ? x - 1 : x, onY ? y - 1 : y)) return false;
      continue;
    }
    if (wall(x, y) || sealed(px, py, x, y)) return false;
    px = x; py = y;
  }
  return !sealed(px, py, x2, y2);
}

// (x, y) のマスから dir の向きへ伸ばした直線が通るマス (近い順。攻撃を遮る地形の手前まで)
//   len: 長さ (マス)。斜めでも len 歩ぶん届くように、縦横の大きいほうで測る
//   ちょうど斜め (45°) の直線はマスの角をちょうど通るので、角を挟む 2 マスが両方とも遮るならそこで止まる (視線 hasLOS と同じ決まり)
function rayTiles(x, y, dir, len) {
  const c = Math.cos(dir), s = Math.sin(dir);
  const diag = Math.abs(Math.abs(c) - Math.abs(s)) < 1e-9; // cos と sin の誤差だけ違う
  const max = len / Math.max(Math.abs(c), Math.abs(s));
  const out = [];
  let lx = x, ly = y;
  for (let d = 0.25; d <= max + 1e-6; d += 0.25) {
    const tx = Math.floor(x + 0.5 + c * d), ty = Math.floor(y + 0.5 + s * d);
    if (tx === lx && ty === ly) continue;
    if (isShotBlocked(tx, ty) || (diag && tx !== lx && ty !== ly && isShotBlocked(tx, ly) && isShotBlocked(lx, ty))) break;
    out.push([tx, ty]);
    lx = tx; ly = ty;
  }
  return out;
}

// ===================================================================
//  経路探索 (目的地までの歩数の場 / Dijkstra)
//  flow はプレイヤーまで。湧き場所ごとの場は帰還に使う
// ===================================================================
function computeFlow(tx, ty, field) {
  field.fill(1e9);
  if (!inMap(tx, ty)) return;
  const s = idx(tx, ty);
  field[s] = 0;
  const heap = [[0, s]];
  const push = (n) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [c, i] = pop();
    if (c > field[i]) continue;
    const x = i % COLS, y = (i / COLS) | 0;
    for (const [dx, dy] of NB) {
      if (!canStep(x, y, dx, dy)) continue;
      // 斜めも 1 歩。ただしまっすぐの道を少しだけ好む (ジグザグに歩かないように)
      const ni = idx(x + dx, y + dy), nc = c + (dx && dy ? 1.01 : 1);
      if (nc < field[ni]) { field[ni] = nc; push([nc, ni]); }
    }
  }
}

// キャラ u のマスまでの歩数の場。主人公は flow (主人公が行動するたびに作り直す)。
// ほかのキャラは、そのキャラが持つ場 (u.pathField) を、いるマスかゾーンが変わったときだけ作り直す
function flowTo(u) {
  if (u === player) return flow;
  const key = `${zone.id}:${u.tx},${u.ty}`;
  if (u.pathKey !== key) {
    if (!u.pathField || u.pathField.length !== COLS * ROWS) u.pathField = new Float64Array(COLS * ROWS);
    computeFlow(u.tx, u.ty, u.pathField);
    u.pathKey = key;
  }
  return u.pathField;
}

// field の値が一番小さくなるとなりのマスへの 1 歩 ([dx, dy])。ほかのキャラがいるマスは避ける。なければ null
function stepDownhill(u, field) {
  let best = field[idx(u.tx, u.ty)], pick = null;
  for (const [dx, dy] of NB) {
    if (!canStep(u.tx, u.ty, dx, dy) || unitAt(u.tx + dx, u.ty + dy)) continue;
    const v = field[idx(u.tx + dx, u.ty + dy)];
    if (v < best - 1e-6) { best = v; pick = [dx, dy]; }
  }
  return pick;
}

// クリックで遠くへ歩くときの道 (主人公のマスから (tx, ty) まで。最初の 1 歩から順に [x, y])。行けなければ null
function findPath(tx, ty) {
  if (isBlocked(tx, ty)) return null;
  const field = new Float64Array(COLS * ROWS);
  computeFlow(tx, ty, field);
  if (field[idx(player.tx, player.ty)] >= 1e9) return null;
  const path = [];
  let x = player.tx, y = player.ty;
  while (x !== tx || y !== ty) {
    let best = field[idx(x, y)], nx = -1, ny = -1;
    for (const [dx, dy] of NB) {
      if (!canStep(x, y, dx, dy)) continue;
      const v = field[idx(x + dx, y + dy)];
      if (v < best) { best = v; nx = x + dx; ny = y + dy; }
    }
    if (nx < 0) return null;
    path.push([nx, ny]);
    x = nx; y = ny;
  }
  return path;
}

// ===================================================================
//  ゾーン
// ===================================================================
function loadZone(id) {
  const z = WORLD.zones[id];
  zone = { id, ...z };
  MAP_W = z.w; MAP_H = z.h;
  COLS = MAP_W / T; ROWS = MAP_H / T;
  blocked = new Uint8Array(COLS * ROWS);
  shotBlocked = new Uint8Array(COLS * ROWS);
  gateAt = new Int16Array(COLS * ROWS).fill(-1);
  flow = new Float64Array(COLS * ROWS);
  obstacles = [];
  const add = (kind, tx, ty, tw, th) => {
    const shots = !!WORLD.terrain[kind].blocksShots;
    obstacles.push({ x: tx * T, y: ty * T, w: tw * T, h: th * T, kind, blocksShots: shots });
    for (let y = Math.max(0, ty); y < Math.min(ROWS, ty + th); y++) for (let x = Math.max(0, tx); x < Math.min(COLS, tx + tw); x++) {
      blocked[idx(x, y)] = 1;
      if (shots) shotBlocked[idx(x, y)] = 1;
    }
  };
  add('wall', 0, 0, COLS, 1); add('wall', 0, ROWS - 1, COLS, 1);
  add('wall', 0, 0, 1, ROWS); add('wall', COLS - 1, 0, 1, ROWS);
  for (const [kind, x, y, w, h] of z.obstacles) {
    const r = snapRect(x, y, w, h);
    add(kind, r.tx, r.ty, r.tw, r.th);
  }
  // 門はマスにそろえ、通れるようにする (外周の壁に重なっていても入れるように)
  zone.gates = z.gates.map((g, i) => {
    const r = snapRect(g.x, g.y, g.w, g.h);
    for (let y = r.ty; y < r.ty + r.th; y++) for (let x = r.tx; x < r.tx + r.tw; x++) {
      if (!inMap(x, y)) continue;
      gateAt[idx(x, y)] = i;
      blocked[idx(x, y)] = 0; shotBlocked[idx(x, y)] = 0;
    }
    return { ...g, ...r, sx: tileOf(g.spawn.x), sy: tileOf(g.spawn.y) };
  });
  zone.npcs = (z.npcs || []).map((n) => createNpc(n));
  for (const n of zone.npcs) blocked[idx(n.tx, n.ty)] = 1;
  zone.respawn = z.respawn ? { tx: tileOf(z.respawn.x), ty: tileOf(z.respawn.y) } : null;
  // 地面の装飾 (ゾーンごとに固定の乱数)
  decor = [];
  let seed = 7 + id.length * 131 + MAP_W;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = Math.round(MAP_W * MAP_H / 9000);
  for (let i = 0; i < n; i++) decor.push({ x: r() * MAP_W, y: r() * MAP_H, s: 1 + r() * 2.5, c: z.theme.decor[r() < 0.5 ? 0 : 1] });
  camps = (z.camps || []).map((c) => ({ ...c, tx: tileOf(c.x), ty: tileOf(c.y), spreadT: c.spread / T,
    field: new Float64Array(COLS * ROWS), slots: c.members.map((type) => ({ type, enemy: null, pending: false, timer: 0 })) }));
  for (const c of camps) computeFlow(c.tx, c.ty, c.field);
}

// 敵レベルの範囲 (表示用)
function zoneLevelText(z) {
  if (z.safe || !z.camps || !z.camps.length) return '安全地帯';
  const lv = z.camps.map((c) => c.level);
  const lo = Math.min(...lv), hi = Math.max(...lv);
  return lo === hi ? `Lv${lo}` : `Lv${lo}〜${hi}`;
}

// 今のゾーンの湧き場所の状態を覚えておく (戻ってきたとき、倒した敵がすぐ復活しないように)
function rememberZone() {
  zoneMemory[zone.id] = { at: game.time, timers: camps.map((c) => c.slots.map((s) => (s.enemy ? 0 : Math.max(0, s.timer)))) };
}

// 別のゾーンに入る。(tx, ty) のマスが通れなければ、復活地点か最初の門の前に立つ
function enterZone(id, tx, ty) {
  if (zone) rememberZone();
  units = player ? [player] : []; hazards = []; spawns = []; effects = []; texts = []; loots = [];
  loadZone(id);
  if (isBlocked(tx, ty) || gateAt[idx(tx, ty)] >= 0) {
    const r = zone.respawn || { tx: zone.gates[0].sx, ty: zone.gates[0].sy };
    tx = r.tx; ty = r.ty;
  }
  placeUnit(player, tx, ty);
  Object.assign(player, { travel: null, next: game.time });
  // かがり火のある安全なゾーン (町) に入ったら、倒れたときに戻る先にする
  if (zone.safe && zone.respawn) player.home = id;
  aiming = null;
  const mem = zoneMemory[id];
  camps.forEach((c, ci) => c.slots.forEach((s, si) => {
    const left = mem ? mem.timers[ci][si] - (game.time - mem.at) : 0;
    if (left > 0) s.timer = left;
    else {
      const at = pickCampTile(c);
      if (at) placeEnemy(s.type, at[0], at[1], c, s);
      else s.timer = 1;
    }
  }));
  computeFlow(player.tx, player.ty, flow);
  showMsg(zone.name, zoneLevelText(zone));
  log(`${zone.name}に入った。`, '#80deea');
}

// 主人公が門のマスに立ったら行き先のゾーンへ移る
function checkGate() {
  const gi = gateAt[idx(player.tx, player.ty)];
  if (gi < 0) return false;
  const g = zone.gates[gi];
  const dest = WORLD.zones[g.to].gates.find((t) => t.id === g.toGate);
  enterZone(g.to, tileOf(dest.spawn.x), tileOf(dest.spawn.y));
  saveGame();
  return true;
}
