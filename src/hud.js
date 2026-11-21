// =====================================================================
//  HUD (仲間の欄・スキル欄・行動順・ミニマップ・ツールチップ)
//  色と大きさは data/theme.js の THEME (hud / bars / map / tooltip)
// =====================================================================
'use strict';

// ----- HUD -----
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function bar(x, y, w, h, ratio, color, label) {
  ctx.fillStyle = THEME.bars.back; roundRect(x - 2, y - 2, w + 4, h + 4, 5); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(ratio, 0, 1), h);
  if (label) {
    ctx.fillStyle = THEME.bars.label; ctx.font = fontOf(13);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  }
}

// マウスを重ねたときの説明の枠: 見出し (title を titleColor で) と、その下に lines を 1 行ずつ。枠の色は border。
// マウスの右下に出し、画面からはみ出さないように寄せる。minW: 中身の最小の幅 (px)
function drawTooltipBox(title, titleColor, lines, border, minW) {
  const TT = THEME.tooltip;
  ctx.font = fontOf(TT.font, false);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width), minW) + TT.pad * 2;
  const h = 30 + lines.length * TT.lineH;
  const x = clamp(mouse.x + TT.offset, 0, W - w), y = clamp(mouse.y + TT.offset, 0, H - h);
  ctx.fillStyle = TT.bg; roundRect(x, y, w, h, TT.radius); ctx.fill();
  ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = titleColor; ctx.font = fontOf(TT.titleFont); ctx.fillText(title, x + TT.pad, y + 20);
  ctx.fillStyle = TT.text; ctx.font = fontOf(TT.font, false);
  lines.forEach((l, i) => ctx.fillText(l, x + TT.pad, y + 40 + i * TT.lineH));
}

// HUD の上のクリックできるボタン ({ id, x, y, w, h })。drawHUD が毎回作り直す
const hudButtons = [];
const HUD_TOP = 56; // 上中央の行動順の下端 (世界地図がこれより下に収まるようにする)
const hudButtonAt = (x, y) => hudButtons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;

// HUD に出した強化のアイコン ({ x, y, s, b })。マウスを重ねると説明を出す
const buffIcons = [];

// 左上に並べる仲間 (今は主人公だけ。仲間を足したらここに並べる)
const partyMembers = () => [player];

// 左上の 1 人分の欄: 顔の絵・名前・レベル・HP・MP だけ (ほかはキャラクターの画面で見る)。クリックでキャラクターの画面
const CARD = THEME.hud.card;
function drawPartyCard(u, x, y) {
  const st = u.stats, f = CARD.face, pad = (CARD.h - f) / 2;
  const hover = mouse.x >= x && mouse.x <= x + CARD.w && mouse.y >= y && mouse.y <= y + CARD.h;
  hudButtons.push({ id: 'char', x, y, w: CARD.w, h: CARD.h });
  ctx.fillStyle = hover ? CARD.bgHover : CARD.bg; roundRect(x, y, CARD.w, CARD.h, CARD.radius); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = hover ? CARD.edgeHover : CARD.edge; ctx.stroke();
  // 顔の絵 (読み込めないうちは色の付いた四角に名前の 1 文字目)
  const fx = x + pad, fy = y + pad, face = getSprite(u.isPlayer ? PLAYER.face : u.def && u.def.face);
  ctx.save(); roundRect(fx, fy, f, f, 8); ctx.clip();
  ctx.fillStyle = CARD.faceBg; ctx.fillRect(fx, fy, f, f);
  if (face) ctx.drawImage(face.img, fx, fy, f, f);
  else {
    ctx.fillStyle = u.color; ctx.font = fontOf(26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.name[0], fx + f / 2, fy + f / 2 + 1); ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = u.color; roundRect(fx, fy, f, f, 8); ctx.stroke();
  // 名前・レベル・HP・MP
  const tx = fx + f + 10, bw = x + CARD.w - tx - 10;
  ctx.textAlign = 'left'; ctx.font = fontOf(14); ctx.fillStyle = CARD.name;
  ctx.fillText(u.name, tx, y + 21);
  // 名前の右に強化のアイコン (マウスを重ねると説明。drawTooltip)
  const bs = CARD.buffSize;
  let bx = tx + ctx.measureText(u.name).width + 8;
  for (const b of u.buffs || []) {
    drawBuffIcon(b, bx, y + 6, bs);
    buffIcons.push({ x: bx, y: y + 6, s: bs, b });
    bx += bs + CARD.buffGap;
  }
  ctx.font = fontOf(14);
  ctx.textAlign = 'right'; ctx.fillStyle = CARD.level; ctx.fillText(`Lv ${u.level}`, tx + bw, y + 21);
  const hpR = u.hp / st.maxHp;
  bar(tx, y + 30, bw, 16, hpR, hpR > THEME.bars.hpLowRatio ? THEME.bars.hp : THEME.bars.hpLow, `HP ${Math.ceil(u.hp)} / ${Math.round(st.maxHp)}`);
  bar(tx, y + 52, bw, 12, u.mp / st.maxMp, THEME.mp);
  ctx.fillStyle = CARD.mpText; ctx.font = fontOf(11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`MP ${Math.floor(u.mp)} / ${Math.round(st.maxMp)}`, tx + bw / 2, y + 59);
  ctx.textBaseline = 'alphabetic';
}

function drawHUD() {
  if (!player) return;
  const p = player;
  ctx.textBaseline = 'alphabetic';
  hudButtons.length = 0;
  buffIcons.length = 0;
  // 左上: 仲間の欄 (上から順に)
  const party = partyMembers();
  party.forEach((u, i) => drawPartyCard(u, 16, 16 + i * (CARD.h + CARD.gap)));
  const partyBottom = 16 + party.length * (CARD.h + CARD.gap);

  // スキルバー (主人公のスキル欄の並び。覚えていないスキルは lock に出す文)
  const slots = skillSlotsOf(p).map(({ key, sk: s }) => ({ label: key.toUpperCase(), name: s.name, cd: cooldownLeft(p, s), max: skillCooldown(p, s), active: aiming === s,
      lock: knowsSkill(p, s) ? '' : learnLevelOf(s) ? `Lv${learnLevelOf(s)} で解放` : '未習得', mp: skillMp(s), short: !enoughMp(p, s) }))
    .concat(Object.entries(IT.potions).map(([id, po]) => ({ label: po.key.toUpperCase(), name: po.name, cd: 0, max: 1, count: p.potions[id] || 0 })))
    .concat([{ label: 'I', name: '道具', cd: 0, max: 1, button: 'items' }]);
  const SB = THEME.hud.skillBar;
  const sz = SB.size, gap = SB.gap, total = slots.length * sz + (slots.length - 1) * gap;
  let sx = (W - total) / 2;
  const sy = H - sz - SB.bottom;
  for (const s of slots) {
    // ボタンの枠 (クリックで開く。マウスを重ねると明るくする)
    const hover = s.button && mouse.x >= sx && mouse.x <= sx + sz && mouse.y >= sy && mouse.y <= sy + sz;
    if (s.button) hudButtons.push({ id: s.button, x: sx, y: sy, w: sz, h: sz });
    ctx.fillStyle = s.active ? SB.bgActive : hover ? SB.bgHover : s.button ? SB.bgButton : SB.bg;
    roundRect(sx, sy, sz, sz, SB.radius); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = s.button ? SB.edgeButton : s.cd > 0 || s.lock || s.short ? SB.edgeOff : SB.edge; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = SB.name; ctx.font = fontOf(14);
    if (s.lock) {
      // まだ覚えていないスキルは名前を暗くし、使えるようになるレベルを出す
      ctx.fillStyle = SB.lockName; ctx.font = fontOf(12);
      ctx.fillText(s.name, sx + sz / 2, sy + sz / 2 - 6);
      ctx.fillStyle = SB.lockText; ctx.font = fontOf(11);
      ctx.fillText(s.lock, sx + sz / 2, sy + sz / 2 + 14);
    } else {
      ctx.fillText(s.name, sx + sz / 2, sy + sz / 2 + 5);
    }
    if (s.mp && !s.lock) {
      // 消費 MP (足りないときは色を変える)
      ctx.textAlign = 'right'; ctx.font = fontOf(12);
      ctx.fillStyle = s.short ? THEME.mpShort : THEME.mp;
      ctx.fillText(`MP${s.mp}`, sx + sz - 6, sy + 15);
      ctx.textAlign = 'center';
    }
    if (s.count !== undefined) {
      ctx.textAlign = 'right'; ctx.font = fontOf(13);
      ctx.fillStyle = s.count > 0 ? SB.countOk : SB.countNone;
      ctx.fillText(`×${s.count}`, sx + sz - 6, sy + 16);
      ctx.textAlign = 'center';
    }
    if (s.cd > 0) {
      ctx.save();
      roundRect(sx, sy, sz, sz, SB.radius); ctx.clip();
      ctx.fillStyle = SB.cdShade;
      ctx.beginPath(); ctx.moveTo(sx + sz / 2, sy + sz / 2);
      ctx.arc(sx + sz / 2, sy + sz / 2, sz, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(s.cd / s.max, 0, 1)); ctx.closePath(); ctx.fill();
      ctx.restore();
      // 残りは行動回数
      ctx.fillStyle = SB.cdText; ctx.font = fontOf(18);
      ctx.fillText(String(Math.ceil(s.cd)), sx + sz / 2, sy + sz / 2 + 24);
    }
    ctx.fillStyle = SB.key; ctx.font = fontOf(12);
    ctx.fillText(s.label, sx + sz / 2, sy + sz + 16);
    sx += sz + gap;
  }

  // ボスHP
  const boss = factionUnits('enemy').find((e) => e.isBoss && e.state === 'chase');
  if (boss) {
    // 画面が狭いと左上の仲間の欄と重なるので、そのときは欄の下に出す
    const bw = Math.min(520, W - 420), bx = (W - bw) / 2;
    bar(bx, bx < 16 + CARD.w + 12 ? partyBottom + 4 : 58, bw, 18, boss.hp / boss.stats.maxHp, THEME.bars.boss, `Lv${boss.level} ${boss.name}  ${Math.ceil(boss.hp)} / ${boss.stats.maxHp}`);
  }

  drawTurnOrder();
  drawLog();
  drawMinimap();
  drawTooltip();

  // メッセージ
  if (game.msgT > 0) {
    const M = THEME.hud.message;
    ctx.globalAlpha = clamp(game.msgT, 0, 1);
    ctx.textAlign = 'center'; ctx.font = fontOf(44);
    outlineText(game.msg, W / 2, H * 0.28, M.main, 6);
    // 小さい文字は改行 (\n) で何行かに分けられる
    ctx.font = fontOf(20);
    game.sub.split('\n').filter(Boolean).forEach((line, i) => {
      outlineText(line, W / 2, H * 0.28 + 40 + i * 28, M.sub, 4);
    });
    ctx.globalAlpha = 1;
  }
}

// 右下の地図。M キーかクリックで、今いるゾーンの地図 (minimap) と世界地図 (worldMap) を切り替える
let worldMapOn = false;
function toggleWorldMap() { worldMapOn = !worldMapOn; }
function mapHint(x, y, w, text) {
  ctx.font = fontOf(11, false); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = THEME.map.hintBg; ctx.fillRect(x + w - ctx.measureText(text).width - 9, y - 19, ctx.measureText(text).width + 12, 16);
  ctx.fillStyle = THEME.map.hint; ctx.fillText(text, x + w + 1, y - 7);
}
function drawMinimap() {
  if (worldMapOn) { drawWorldMap(); return; }
  const C = THEME.map;
  const s = Math.min(200 / MAP_W, 150 / MAP_H), mw = MAP_W * s, mh = MAP_H * s, mx = W - mw - 16, my = H - mh - 16;
  hudButtons.push({ id: 'map', x: mx - 3, y: my - 3, w: mw + 6, h: mh + 6 });
  mapHint(mx - 3, my - 3, mw + 6, 'M: 世界地図');
  ctx.fillStyle = C.bg; ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
  for (const o of obstacles) {
    ctx.fillStyle = WORLD.terrain[o.kind].minimap;
    ctx.fillRect(mx + o.x * s, my + o.y * s, Math.max(1, o.w * s), Math.max(1, o.h * s));
  }
  ctx.fillStyle = C.gate;
  for (const g of zone.gates) ctx.fillRect(mx + g.tx * T * s, my + g.ty * T * s, Math.max(3, g.tw * T * s), Math.max(3, g.th * T * s));
  if (zone.respawn) { ctx.fillStyle = C.bonfire; pathCircle(mx + center(zone.respawn.tx) * s, my + center(zone.respawn.ty) * s, 3); ctx.fill(); }
  ctx.fillStyle = C.npc;
  for (const n of zone.npcs || []) { pathCircle(mx + center(n.tx) * s, my + center(n.ty) * s, 3); ctx.fill(); }
  ctx.strokeStyle = C.view; ctx.lineWidth = 1;
  ctx.strokeRect(mx + cam.x * s, my + cam.y * s, (W / VIEW) * s, (H / VIEW) * s);
  ctx.fillStyle = C.spawn;
  for (const sp of spawns) ctx.fillRect(mx + center(sp.tx) * s - 2, my + center(sp.ty) * s - 2, 4, 4);
  for (const e of factionUnits('enemy')) {
    ctx.fillStyle = e.isBoss ? C.boss : e.state === 'chase' ? C.enemyChase : C.enemy;
    const r = e.isBoss ? 4 : 2.5;
    ctx.fillRect(mx + e.x * s - r, my + e.y * s - r, r * 2, r * 2);
  }
  ctx.fillStyle = C.ours;
  for (const u of units) if (u !== player && u.faction === 'player' && !u.dead) ctx.fillRect(mx + u.x * s - 2.5, my + u.y * s - 2.5, 5, 5);
  pathCircle(mx + player.x * s, my + player.y * s, 3.5); ctx.fill();
}

// 世界地図: 全ゾーンを world.js の mapPos に並べ、地形・門・かがり火・NPC と、門どうしのつながりを描く。
// 今いるゾーンは枠を明るくし、主人公の位置を出す。ゾーンの大きさは実際の比率 (fullW が枠の幅いっぱい)
// 建物の中 (parent のあるゾーン) は描かず、外のゾーンの入口にいることにする
function drawWorldMap() {
  const M = WORLD.worldMap, C = THEME.map, zones = Object.entries(WORLD.zones).filter(([, z]) => !z.parent);
  const hereId = zone.parent || zone.id;
  const door = zone.parent && WORLD.zones[hereId].gates.find((g) => g.to === zone.id);
  const here = door ? { x: door.x + door.w / 2, y: door.y + door.h / 2 } : player;
  const cols = Math.max(...zones.map(([, z]) => z.mapPos[0])) + 1, rows = Math.max(...zones.map(([, z]) => z.mapPos[1])) + 1;
  const pad = 8, labelH = 26, margin = 13;
  // 枠の大きさ: スキル欄の右と、上中央の行動順 (HUD_TOP) の下に収まるように縮める (文字は縮めない)
  const sb = hudButtons.find((b) => b.id === 'items');
  const availW = W - margin - (sb ? sb.x + sb.w + 12 : 0), availH = H - margin - HUD_TOP - 12;
  const k = clamp(Math.min(1, (availW - (cols - 1) * M.gap - pad * 2) / (cols * M.cellW),
    (availH - rows * labelH - (rows - 1) * M.gap - pad * 2) / (rows * M.cellH)), M.minScale, 1);
  const cellW = M.cellW * k, cellH = M.cellH * k;
  const ww = cols * cellW + (cols - 1) * M.gap + pad * 2, wh = rows * (cellH + labelH) + (rows - 1) * M.gap + pad * 2;
  const ox = W - ww - margin, oy = H - wh - margin;
  hudButtons.push({ id: 'map', x: ox, y: oy, w: ww, h: wh });
  mapHint(ox, oy, ww, 'M: このエリアの地図');
  ctx.fillStyle = C.worldBg; roundRect(ox, oy, ww, wh, 8); ctx.fill();
  // 縮尺: fullW の幅が枠いっぱい。高さが枠をはみ出すゾーンがあればそれに合わせて小さくする
  const zs = Math.min(cellW / M.fullW, ...zones.map(([, z]) => cellH / z.h));
  // ゾーンを描く左上 (x, y。枠の中央) と枠の左上 (cx, cy。枠の下に名前を書く)
  const pos = {};
  for (const [id, z] of zones) {
    const [c, r] = z.mapPos;
    const cx = ox + pad + c * (cellW + M.gap), cy = oy + pad + r * (cellH + labelH + M.gap);
    pos[id] = { x: cx + (cellW - z.w * zs) / 2, y: cy + (cellH - z.h * zs) / 2, cx, cy };
  }
  const gateAt = (id, g) => ({ x: pos[id].x + (g.x + g.w / 2) * zs, y: pos[id].y + (g.y + g.h / 2) * zs });
  // 門どうしのつながり (同じ組を 2 回描かないよう、id の小さいほうからだけ)
  ctx.strokeStyle = C.link; ctx.lineWidth = 2;
  for (const [id, z] of zones) for (const g of z.gates) {
    if (id > g.to || !pos[g.to]) continue;
    const dest = WORLD.zones[g.to].gates.find((t) => t.id === g.toGate);
    if (!dest) continue;
    const a = gateAt(id, g), b = gateAt(g.to, dest);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const [id, z] of zones) {
    const p = pos[id], isHere = id === hereId;
    ctx.fillStyle = z.theme.ground; ctx.fillRect(p.x, p.y, z.w * zs, z.h * zs);
    for (const [kind, x, y, w, h] of z.obstacles) {
      ctx.fillStyle = WORLD.terrain[kind].minimap;
      ctx.fillRect(p.x + x * zs, p.y + y * zs, Math.max(1, w * zs), Math.max(1, h * zs));
    }
    ctx.fillStyle = C.gate;
    for (const g of z.gates) ctx.fillRect(p.x + g.x * zs, p.y + g.y * zs, Math.max(2, g.w * zs), Math.max(2, g.h * zs));
    if (z.respawn) { ctx.fillStyle = C.bonfire; pathCircle(p.x + z.respawn.x * zs, p.y + z.respawn.y * zs, 2.5); ctx.fill(); }
    ctx.fillStyle = C.npc;
    for (const n of z.npcs || []) { pathCircle(p.x + n.x * zs, p.y + n.y * zs, 2); ctx.fill(); }
    ctx.strokeStyle = isHere ? C.here : C.zoneEdge; ctx.lineWidth = isHere ? 2 : 1;
    ctx.strokeRect(p.x, p.y, z.w * zs, z.h * zs);
    if (isHere) { ctx.fillStyle = C.here; pathCircle(p.x + here.x * zs, p.y + here.y * zs, 3.5); ctx.fill(); }
    // 名前と敵レベル (町は「安全」)
    const lx = p.cx + cellW / 2, ly = p.cy + cellH + 11;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = fontOf(11); ctx.fillStyle = isHere ? C.here : C.name; ctx.fillText(z.name, lx, ly);
    ctx.font = fontOf(10, false); ctx.fillStyle = z.safe ? C.safeLevel : C.level; ctx.fillText(zoneLevelText(z), lx, ly + 12);
  }
}

// マウスを重ねたものの説明 (強化のアイコン → 敵 → NPC の順に探し、最初に見つかったものだけ出す)
function drawTooltip() {
  if (drawBuffTooltip()) return;
  const e = factionUnits('enemy').find((u) => u.tx === mouse.tx && u.ty === mouse.ty);
  if (!e) { drawNpcTooltip(); return; }
  const st = e.stats;
  drawTooltipBox(`Lv${e.level} ${e.name}`, levelColor(e.level), [
    `HP ${Math.ceil(e.hp)} / ${st.maxHp}　MP ${Math.floor(e.mp)} / ${st.maxMp}`, `${STATS.atk.label} ${st.atk.toFixed(0)}  ${STATS.def.label} ${st.def.toFixed(0)}  ${STATS.int.label} ${st.int.toFixed(0)}  ${STATS.mdef.label} ${st.mdef.toFixed(0)}`,
    `速度 ${Math.round(st.speed)}（あなたの ${(st.speed / player.stats.speed).toFixed(2)} 倍）`,
    `技: ${e.def.attacks.map((a) => a.name + (a.kind === 'magic' ? '（術）' : '') + (a.mp ? ` MP${a.mp}` : '')).join(' / ')}`,
    `素材: ${(e.def.drops || []).map((m) => IT.materials[m.id].name).join(' / ')}`,
    `経験値 ${e.exp}　${e.camp.name}`,
  ], e.color, 100);
}

// 仲間の欄の強化のアイコンにマウスを乗せたとき: 名前・効果・残り。出したら true
function drawBuffTooltip() {
  const it = buffIcons.find((r) => mouse.x >= r.x && mouse.x <= r.x + r.s && mouse.y >= r.y && mouse.y <= r.y + r.s);
  if (!it) return false;
  const d = BUFFS[it.b.id];
  const pct = Math.round((d.mult - 1) * 100);
  drawTooltipBox(d.name, THEME.tooltip.buffTitle, [`${STATS[d.stat].label} ${pct >= 0 ? '+' : ''}${pct}%`, `あと ${it.b.left} 行動`], d.color, 110);
  return true;
}

// NPC にマウスを乗せたとき: 種類とステータス (今は NPC に攻撃は当たらない)
function drawNpcTooltip() {
  const n = (zone.npcs || []).find((u) => u.tx === mouse.tx && u.ty === mouse.ty);
  if (!n) return;
  const st = n.stats;
  drawTooltipBox(`${n.name}（${n.kindLabel}）`, n.color, [
    `HP ${Math.ceil(n.hp)} / ${st.maxHp}　MP ${Math.floor(n.mp)} / ${st.maxMp}`,
    `${STATS.atk.label} ${st.atk.toFixed(0)}  ${STATS.def.label} ${st.def.toFixed(0)}  ${STATS.int.label} ${st.int.toFixed(0)}  ${STATS.mdef.label} ${st.mdef.toFixed(0)}`,
    `${STATS.speed.label} ${Math.round(st.speed)}  ${STATS.critRate.label} ${Math.round(st.critRate * 100)}%`,
    '攻撃は当たらない',
  ], n.color, 100);
}

// 行動順: これから誰がどの順に動くか (速いキャラほど何度も出てくる)
function drawTurnOrder() {
  const O = THEME.hud.turnOrder;
  const list = turnOrder(TN.orderCount);
  const sz = O.size, gap = O.gap, w = list.length * (sz + gap) - gap;
  const x0 = (W - w) / 2, y = O.top;
  ctx.fillStyle = O.bg; roundRect(x0 - 60, y - 6, w + 70, sz + 12, 8); ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = O.label; ctx.font = fontOf(12);
  ctx.fillText('行動順', x0 - 52, y + sz / 2);
  list.forEach((u, i) => {
    const x = x0 + i * (sz + gap);
    ctx.fillStyle = u.faction === 'player' ? O.cellOurs : O.cellTheirs; roundRect(x, y, sz, sz, 6); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = u.isPlayer ? O.edgeHero : u.charging ? O.edgeCharging : u.color; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = u.isPlayer ? O.heroGlyph : u.color; ctx.font = fontOf(15);
    ctx.fillText(u.isPlayer ? '自' : u.def.glyph, x + sz / 2, y + sz / 2 + 1);
  });
  ctx.textBaseline = 'alphabetic';
}

// メッセージ欄 (左下)。古いものほど薄く
function drawLog() {
  const x = 20, lh = 19, y0 = H - 22 - (logLines.length - 1) * lh;
  ctx.font = fontOf(13, false); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  logLines.forEach((l, i) => {
    ctx.globalAlpha = 0.45 + 0.55 * (i + 1) / logLines.length;
    outlineText(l.text, x, y0 + i * lh, l.color, 3, THEME.hud.logOutline);
  });
  ctx.globalAlpha = 1;
}
