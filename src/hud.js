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
function drawBar(x, y, w, h, ratio, color, label) {
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
  const x = clamp(mouse.x + TT.offset, 0, VIEW_W - w), y = clamp(mouse.y + TT.offset, 0, VIEW_H - h);
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
const PARTY_CARD = THEME.hud.card;
function drawPartyCard(u, x, y) {
  const st = u.stats, f = PARTY_CARD.face, pad = (PARTY_CARD.h - f) / 2;
  const hover = mouse.x >= x && mouse.x <= x + PARTY_CARD.w && mouse.y >= y && mouse.y <= y + PARTY_CARD.h;
  hudButtons.push({ id: 'char', x, y, w: PARTY_CARD.w, h: PARTY_CARD.h });
  ctx.fillStyle = hover ? PARTY_CARD.bgHover : PARTY_CARD.bg; roundRect(x, y, PARTY_CARD.w, PARTY_CARD.h, PARTY_CARD.radius); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = hover ? PARTY_CARD.edgeHover : PARTY_CARD.edge; ctx.stroke();
  // 顔の絵 (読み込めないうちは色の付いた四角に名前の 1 文字目)
  const fx = x + pad, fy = y + pad, face = getSprite(u.isPlayer ? PLAYER.face : u.def && u.def.face);
  ctx.save(); roundRect(fx, fy, f, f, 8); ctx.clip();
  ctx.fillStyle = PARTY_CARD.faceBg; ctx.fillRect(fx, fy, f, f);
  if (face) ctx.drawImage(face.img, fx, fy, f, f);
  else {
    ctx.fillStyle = u.color; ctx.font = fontOf(26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.name[0], fx + f / 2, fy + f / 2 + 1); ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = u.color; roundRect(fx, fy, f, f, 8); ctx.stroke();
  // 名前・レベル・HP・MP
  const tx = fx + f + 10, bw = x + PARTY_CARD.w - tx - 10;
  ctx.textAlign = 'left'; ctx.font = fontOf(14); ctx.fillStyle = PARTY_CARD.name;
  ctx.fillText(u.name, tx, y + 21);
  // 名前の右に強化のアイコン (マウスを重ねると説明。drawTooltip)
  const bs = PARTY_CARD.buffSize;
  let bx = tx + ctx.measureText(u.name).width + 8;
  for (const b of u.buffs || []) {
    drawBuffIcon(b, bx, y + 6, bs);
    buffIcons.push({ x: bx, y: y + 6, s: bs, b });
    bx += bs + PARTY_CARD.buffGap;
  }
  ctx.font = fontOf(14);
  ctx.textAlign = 'right'; ctx.fillStyle = PARTY_CARD.level; ctx.fillText(txt('hud.level', { level: u.level }), tx + bw, y + 21);
  const hpR = u.hp / st.maxHp;
  drawBar(tx, y + 30, bw, 16, hpR, hpR > THEME.bars.hpLowRatio ? THEME.bars.hp : THEME.bars.hpLow, txt('hud.hpBar', { hp: Math.ceil(u.hp), max: Math.round(st.maxHp) }));
  drawBar(tx, y + 52, bw, 12, u.mp / st.maxMp, THEME.mp);
  ctx.fillStyle = PARTY_CARD.mpText; ctx.font = fontOf(11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt('hud.mpBar', { mp: Math.floor(u.mp), max: Math.round(st.maxMp) }), tx + bw / 2, y + 59);
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
  party.forEach((u, i) => drawPartyCard(u, 16, 16 + i * (PARTY_CARD.h + PARTY_CARD.gap)));
  const partyBottom = 16 + party.length * (PARTY_CARD.h + PARTY_CARD.gap);

  // スキルバー (主人公のスキル欄の並び。覚えていないスキルは lock に出す文)
  const slots = skillSlotsOf(p).map(({ key, sk: s }) => ({ label: key.toUpperCase(), name: s.name, cd: cooldownLeft(p, s), max: skillCooldown(p, s), active: aiming === s,
      lock: knowsSkill(p, s) ? '' : learnLevelOf(s) ? txt('hud.skillLocked', { level: learnLevelOf(s) }) : txt('hud.skillUnknown'), mp: skillMp(s), short: !enoughMp(p, s) }))
    .concat(Object.entries(ITEMS.consumables).map(([id, c]) => ({ label: c.key.toUpperCase(), name: c.name, cd: 0, max: 1, count: consumableCount(p, id) })))
    .concat([{ label: txt('hud.itemsKey'), name: txt('hud.itemsButton'), cd: 0, max: 1, button: 'items' }]);
  const SB = THEME.hud.skillBar;
  const sz = SB.size, gap = SB.gap, total = slots.length * sz + (slots.length - 1) * gap;
  let sx = (VIEW_W - total) / 2;
  const sy = VIEW_H - sz - SB.bottom;
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
      ctx.fillText(txt('hud.skillMp', { mp: s.mp }), sx + sz - 6, sy + 15);
      ctx.textAlign = 'center';
    }
    if (s.count !== undefined) {
      ctx.textAlign = 'right'; ctx.font = fontOf(13);
      ctx.fillStyle = s.count > 0 ? SB.countOk : SB.countNone;
      ctx.fillText(txt('hud.itemCount', { n: s.count }), sx + sz - 6, sy + 16);
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
    const bw = Math.min(520, VIEW_W - 420), bx = (VIEW_W - bw) / 2;
    drawBar(bx, bx < 16 + PARTY_CARD.w + 12 ? partyBottom + 4 : 58, bw, 18, boss.hp / boss.stats.maxHp, THEME.bars.boss,
      txt('hud.bossBar', { level: boss.level, name: boss.name, hp: Math.ceil(boss.hp), max: boss.stats.maxHp }));
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
    outlineText(game.msg, VIEW_W / 2, VIEW_H * 0.28, M.main, 6);
    // 小さい文字は改行 (\n) で何行かに分けられる
    ctx.font = fontOf(20);
    game.sub.split('\n').filter(Boolean).forEach((line, i) => {
      outlineText(line, VIEW_W / 2, VIEW_H * 0.28 + 40 + i * 28, M.sub, 4);
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
  const s = Math.min(200 / MAP_W, 150 / MAP_H), mw = MAP_W * s, mh = MAP_H * s, mx = VIEW_W - mw - 16, my = VIEW_H - mh - 16;
  hudButtons.push({ id: 'map', x: mx - 3, y: my - 3, w: mw + 6, h: mh + 6 });
  mapHint(mx - 3, my - 3, mw + 6, txt('hud.mapHintWorld'));
  ctx.fillStyle = C.bg; ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
  for (const [kind, x, y, w, h] of zone.grounds || []) {
    ctx.fillStyle = WORLD.grounds[kind].minimap;
    ctx.fillRect(mx + x * s, my + y * s, Math.max(1, w * s), Math.max(1, h * s));
  }
  for (const o of obstacles) {
    ctx.fillStyle = WORLD.terrain[o.kind].minimap;
    ctx.fillRect(mx + o.x * s, my + o.y * s, Math.max(1, o.w * s), Math.max(1, o.h * s));
  }
  ctx.fillStyle = C.gate;
  for (const g of zone.gates) ctx.fillRect(mx + g.tx * TILE * s, my + g.ty * TILE * s, Math.max(3, g.tw * TILE * s), Math.max(3, g.th * TILE * s));
  if (zone.respawn) { ctx.fillStyle = C.bonfire; pathCircle(mx + tileCenter(zone.respawn.tx) * s, my + tileCenter(zone.respawn.ty) * s, 3); ctx.fill(); }
  ctx.fillStyle = C.npc;
  for (const n of zone.npcs || []) { pathCircle(mx + tileCenter(n.tx) * s, my + tileCenter(n.ty) * s, 3); ctx.fill(); }
  ctx.strokeStyle = C.view; ctx.lineWidth = 1;
  ctx.strokeRect(mx + camera.x * s, my + camera.y * s, (VIEW_W / VIEW_SCALE) * s, (VIEW_H / VIEW_SCALE) * s);
  ctx.fillStyle = C.spawn;
  for (const sp of spawns) ctx.fillRect(mx + tileCenter(sp.tx) * s - 2, my + tileCenter(sp.ty) * s - 2, 4, 4);
  for (const e of factionUnits('enemy')) {
    ctx.fillStyle = e.isBoss ? C.boss : e.state === 'chase' ? C.enemyChase : C.enemy;
    const r = e.isBoss ? 4 : 2.5;
    ctx.fillRect(mx + e.x * s - r, my + e.y * s - r, r * 2, r * 2);
  }
  ctx.fillStyle = C.ours;
  for (const u of units) if (u !== player && u.faction === 'player' && !u.dead) ctx.fillRect(mx + u.x * s - 2.5, my + u.y * s - 2.5, 5, 5);
  pathCircle(mx + player.x * s, my + player.y * s, 3.5); ctx.fill();
}

// 世界地図: ワールドマップ (WORLD.overworld) 全体を縮めて描き、町・ダンジョンの入口に印と名前、地方の名前を出す。
// 主人公の位置: ワールドマップにいるときはその場所、町・ダンジョン・建物の中にいるときはその入口
// 地形の絵は一度だけ別のキャンバスに描いておく (1 マス = 1 px)
let worldMapImage = null;
function worldMapCanvas() {
  if (worldMapImage) return worldMapImage;
  const z = WORLD.zones[WORLD.overworld], cv = document.createElement('canvas');
  cv.width = z.w / TILE; cv.height = z.h / TILE;
  const g = cv.getContext('2d');
  g.fillStyle = WORLD.grounds[z.ground].minimap; g.fillRect(0, 0, cv.width, cv.height);
  for (const [kind, x, y, w, h] of z.grounds) { g.fillStyle = WORLD.grounds[kind].minimap; g.fillRect(x / TILE, y / TILE, w / TILE, h / TILE); }
  for (const [kind, x, y, w, h] of z.obstacles) { g.fillStyle = WORLD.terrain[kind].minimap; g.fillRect(x / TILE, y / TILE, w / TILE, h / TILE); }
  return (worldMapImage = cv);
}
function drawWorldMap() {
  const M = WORLD.worldMap, C = THEME.map, z = WORLD.zones[WORLD.overworld];
  const pad = 8, margin = 13;
  // 大きさ: スキル欄の右と、上中央の行動順 (HUD_TOP) の下に収まるように縮める (文字は縮めない)
  const sb = hudButtons.find((b) => b.id === 'items');
  const availW = VIEW_W - margin - (sb ? sb.x + sb.w + 12 : 0) - pad * 2, availH = VIEW_H - margin - HUD_TOP - 12 - pad * 2;
  const fit = Math.min(M.maxW / z.w, M.maxH / z.h);
  const s = fit * clamp(Math.min(1, availW / (z.w * fit), availH / (z.h * fit)), M.minScale, 1);
  const mw = z.w * s, mh = z.h * s, ww = mw + pad * 2, wh = mh + pad * 2;
  const ox = VIEW_W - ww - margin, oy = VIEW_H - wh - margin, mx = ox + pad, my = oy + pad;
  hudButtons.push({ id: 'map', x: ox, y: oy, w: ww, h: wh });
  mapHint(ox, oy, ww, txt('hud.mapHintZone'));
  ctx.fillStyle = C.worldBg; roundRect(ox, oy, ww, wh, 8); ctx.fill();
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(worldMapCanvas(), mx, my, mw, mh);
  ctx.imageSmoothingEnabled = smooth;
  // 地方の名前 (地方の四角のまん中に薄く)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontOf(11); ctx.fillStyle = C.region;
  for (const g of z.regions || []) ctx.fillText(g.name, mx + (g.x + g.w / 2) * s, my + (g.y + g.h / 2) * s);
  // 入口の印と名前 (倒れたときに戻る町はかがり火の色)
  for (const g of z.gates) {
    if (!g.place) continue;
    const cx = mx + (g.x + g.w / 2) * s, cy = my + (g.y + g.h / 2) * s, dest = WORLD.zones[g.to];
    ctx.fillStyle = g.to === player.home ? C.bonfire : g.place === 'dungeon' ? C.dungeon : C.town;
    if (g.place === 'dungeon') { ctx.beginPath(); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 5, cy + 4); ctx.lineTo(cx - 5, cy + 4); ctx.closePath(); ctx.fill(); }
    else ctx.fillRect(cx - 4, cy - 4, 8, 8);
    ctx.font = fontOf(10); ctx.textBaseline = 'alphabetic';
    outlineText(dest.name, cx, cy - 7, C.name, 3);
  }
  // 主人公
  const spot = zone.id === WORLD.overworld ? player : worldPlaceOf(zone.id);
  if (spot) {
    const px = spot === player ? player.x : spot.x + spot.w / 2, py = spot === player ? player.y : spot.y + spot.h / 2;
    ctx.fillStyle = C.here; pathCircle(mx + px * s, my + py * s, 3.5 + Math.sin(game.rt * 6)); ctx.fill();
  }
}

// マウスを重ねたものの説明 (強化のアイコン → 敵 → NPC の順に探し、最初に見つかったものだけ出す)
function drawTooltip() {
  if (drawBuffTooltip()) return;
  const e = factionUnits('enemy').find((u) => u.tx === mouse.tx && u.ty === mouse.ty);
  if (!e) { drawNpcTooltip(); return; }
  const st = e.stats;
  drawTooltipBox(txt('hud.unitTitle', { level: e.level, name: e.name }), levelColor(e.level), [
    hpMpLine(e), stats4Line(st),
    txt('hud.speed', { speed: Math.round(st.speed), ratio: (st.speed / player.stats.speed).toFixed(2) }),
    txt('hud.attacks', { list: e.def.attacks.map((a) => a.name + (a.kind === 'magic' ? txt('hud.attackMagic') : '') + (a.mp ? txt('hud.attackMp', { mp: a.mp }) : '')).join(txt('hud.listSep')) }),
    txt('hud.drops', { list: (e.def.drops || []).map((m) => ITEMS.materials[m.id].name).join(txt('hud.listSep')) }),
    txt('hud.expCamp', { exp: e.exp, camp: e.camp.name }),
  ], e.color, 100);
}

// ツールチップの HP・MP の行と、こうげき・まもり・知力・まほうのまもりの行 (敵・NPC)
const hpMpLine = (u) => txt('hud.hpMp', { hp: Math.ceil(u.hp), maxHp: u.stats.maxHp, mp: Math.floor(u.mp), maxMp: u.stats.maxMp });
const stats4Line = (st) => txt('hud.stats4', { atkLabel: STATS.atk.label, atk: st.atk.toFixed(0), defLabel: STATS.def.label, def: st.def.toFixed(0),
  intLabel: STATS.int.label, int: st.int.toFixed(0), mdefLabel: STATS.mdef.label, mdef: st.mdef.toFixed(0) });

// 仲間の欄の強化のアイコンにマウスを乗せたとき: 名前・効果・残り。出したら true
function drawBuffTooltip() {
  const it = buffIcons.find((r) => mouse.x >= r.x && mouse.x <= r.x + r.s && mouse.y >= r.y && mouse.y <= r.y + r.s);
  if (!it) return false;
  const d = BUFFS[it.b.id];
  const pct = Math.round((d.mult - 1) * 100);
  drawTooltipBox(d.name, THEME.tooltip.buffTitle, [txt('hud.buffEffect', { stat: STATS[d.stat].label, pct: `${pct >= 0 ? '+' : ''}${pct}` }), txt('hud.buffLeft', { n: it.b.left })], d.color, 110);
  return true;
}

// NPC にマウスを乗せたとき: 種類とステータス (今は NPC に攻撃は当たらない)
function drawNpcTooltip() {
  const n = (zone.npcs || []).find((u) => u.tx === mouse.tx && u.ty === mouse.ty);
  if (!n) return;
  const st = n.stats;
  drawTooltipBox(txt('hud.npcTitle', { name: n.name, kind: n.kindLabel }), n.color, [
    hpMpLine(n), stats4Line(st),
    txt('hud.npcSpeed', { speedLabel: STATS.speed.label, speed: Math.round(st.speed), critLabel: STATS.critRate.label, crit: Math.round(st.critRate * 100) }),
    txt('hud.npcNoHit'),
  ], n.color, 100);
}

// 行動順: これから誰がどの順に動くか (速いキャラほど何度も出てくる)
function drawTurnOrder() {
  const O = THEME.hud.turnOrder;
  const list = turnOrder(TURN.orderCount);
  const sz = O.size, gap = O.gap, w = list.length * (sz + gap) - gap;
  const x0 = (VIEW_W - w) / 2, y = O.top;
  ctx.fillStyle = O.bg; roundRect(x0 - 60, y - 6, w + 70, sz + 12, 8); ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = O.label; ctx.font = fontOf(12);
  ctx.fillText(txt('hud.turnOrder'), x0 - 52, y + sz / 2);
  list.forEach((u, i) => {
    const x = x0 + i * (sz + gap);
    ctx.fillStyle = u.faction === 'player' ? O.cellOurs : O.cellTheirs; roundRect(x, y, sz, sz, 6); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = u.isPlayer ? O.edgeHero : u.charging ? O.edgeCharging : u.color; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = u.isPlayer ? O.heroGlyph : u.color; ctx.font = fontOf(15);
    ctx.fillText(u.isPlayer ? txt('hud.turnHero') : u.def.glyph, x + sz / 2, y + sz / 2 + 1);
  });
  ctx.textBaseline = 'alphabetic';
}

// メッセージ欄 (左下)。古いものほど薄く
function drawLog() {
  const x = 20, lh = 19, y0 = VIEW_H - 22 - (logLines.length - 1) * lh;
  ctx.font = fontOf(13, false); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  logLines.forEach((l, i) => {
    ctx.globalAlpha = 0.45 + 0.55 * (i + 1) / logLines.length;
    outlineText(l.text, x, y0 + i * lh, l.color, 3, THEME.hud.logOutline);
  });
  ctx.globalAlpha = 1;
}
