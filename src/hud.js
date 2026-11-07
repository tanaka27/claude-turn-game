// =====================================================================
//  HUD (ステータス・スキル欄・クエスト・ミニマップ・ツールチップ)
// =====================================================================
'use strict';

// ----- HUD -----
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function bar(x, y, w, h, ratio, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(x - 2, y - 2, w + 4, h + 4, 5); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(ratio, 0, 1), h);
  if (label) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  }
}

// HUD の上のクリックできるボタン ({ id, x, y, w, h })。drawHUD が毎回作り直す
const hudButtons = [];
let statsBottom = 0; // 右上のステータス欄の下端 (世界地図がこれより下に収まるようにする)
const hudButtonAt = (x, y) => hudButtons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;

function drawHUD() {
  if (!player) return;
  const p = player, st = p.stats;
  ctx.textBaseline = 'alphabetic';
  // HP・MP・経験値
  bar(20, 20, 300, 22, p.hp / st.maxHp, p.hp / st.maxHp > 0.3 ? '#43a047' : '#e53935', `HP ${Math.ceil(p.hp)} / ${Math.round(st.maxHp)}`);
  bar(20, 50, 300, 16, p.mp / st.maxMp, THEME.mp, `MP ${Math.floor(p.mp)} / ${Math.round(st.maxMp)}`);
  const maxed = p.level >= PG.maxLevel, need = expToNext(p.level);
  bar(20, 74, 300, 8, maxed ? 1 : p.exp / need, '#9575cd');
  ctx.textAlign = 'left'; ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`Lv ${p.level}  ${p.name}`, 20, 104);
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#b39ddb';
  ctx.fillText(maxed ? 'EXP MAX' : `EXP ${p.exp} / ${need}`, 150, 104);
  ctx.fillStyle = '#9da7b3';
  const status = inSafeZone() ? '安全地帯' : game.time - p.lastHurt >= PG.restDelay ? '休息中' : '戦闘中';
  ctx.fillText(`撃破 ${game.kills}   ${status}   ターン ${Math.floor(game.time)}`, 20, 124);
  ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`${p.gold} G`, 220, 124);
  ctx.fillStyle = '#80deea'; ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`${zone.name}（${zoneLevelText(zone)}）`, 20, 146);

  // ステータス
  // 並び順と表示のしかたは data/stats.js の hud
  const lines = Object.keys(STATS).filter((k) => STATS[k].hud).map((k) => {
    const { label, pct, hud } = STATS[k];
    const v = (pct ? (st[k] * 100).toFixed(hud.dec) + '%' : st[k].toFixed(hud.dec));
    return [label, (hud.prefix || '') + v + (hud.suffix || '')];
  });
  const px = W - 190, py = 16;
  statsBottom = py + 18 + lines.length * 19;
  ctx.fillStyle = 'rgba(13,17,23,0.75)'; roundRect(px, py, 174, 18 + lines.length * 19, 8); ctx.fill();
  ctx.font = '13px sans-serif';
  lines.forEach(([k, v], i) => {
    ctx.textAlign = 'left'; ctx.fillStyle = '#9da7b3'; ctx.fillText(k, px + 12, py + 24 + i * 19);
    ctx.textAlign = 'right'; ctx.fillStyle = '#e6edf3'; ctx.fillText(v, px + 162, py + 24 + i * 19);
  });

  // スキルバー
  const slots = SKILLS.map((s) => ({ label: s.label, name: s.name, cd: p.skillCd[s.key], max: skillCooldown(s), active: aiming === s,
      lock: p.level < s.unlockLevel ? s.unlockLevel : 0, mp: skillMp(s), short: !enoughMp(s) }))
    .concat(Object.entries(IT.potions).map(([id, po]) => ({ label: po.key.toUpperCase(), name: po.name, cd: 0, max: 1, count: p.potions[id] || 0 })))
    .concat([{ label: 'I', name: '道具', cd: 0, max: 1, button: 'items' }]);
  hudButtons.length = 0;
  const sz = 62, gap = 12, total = slots.length * sz + (slots.length - 1) * gap;
  let sx = (W - total) / 2;
  const sy = H - sz - 34;
  for (const s of slots) {
    // ボタンの枠 (クリックで開く。マウスを重ねると明るくする)
    const hover = s.button && mouse.x >= sx && mouse.x <= sx + sz && mouse.y >= sy && mouse.y <= sy + sz;
    if (s.button) hudButtons.push({ id: s.button, x: sx, y: sy, w: sz, h: sz });
    ctx.fillStyle = s.active ? 'rgba(80,200,255,0.35)' : hover ? 'rgba(48,80,110,0.95)' : s.button ? 'rgba(30,40,55,0.9)' : 'rgba(13,17,23,0.85)';
    roundRect(sx, sy, sz, sz, 10); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = s.button ? '#ffd54f' : s.cd > 0 || s.lock || s.short ? '#30363d' : '#4fc3f7'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 14px sans-serif';
    if (s.lock) {
      // まだ使えないスキルは名前を暗くし、使えるようになるレベルを出す
      ctx.fillStyle = '#6e7681'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText(s.name, sx + sz / 2, sy + sz / 2 - 6);
      ctx.fillStyle = '#9da7b3'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`Lv${s.lock} で解放`, sx + sz / 2, sy + sz / 2 + 14);
    } else {
      ctx.fillText(s.name, sx + sz / 2, sy + sz / 2 + 5);
    }
    if (s.mp && !s.lock) {
      // 消費 MP (足りないときは色を変える)
      ctx.textAlign = 'right'; ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = s.short ? THEME.mpShort : THEME.mp;
      ctx.fillText(`MP${s.mp}`, sx + sz - 6, sy + 15);
      ctx.textAlign = 'center';
    }
    if (s.count !== undefined) {
      ctx.textAlign = 'right'; ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = s.count > 0 ? '#69f0ae' : '#ff5252';
      ctx.fillText(`×${s.count}`, sx + sz - 6, sy + 16);
      ctx.textAlign = 'center';
    }
    if (s.cd > 0) {
      ctx.save();
      roundRect(sx, sy, sz, sz, 10); ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.moveTo(sx + sz / 2, sy + sz / 2);
      ctx.arc(sx + sz / 2, sy + sz / 2, sz, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(s.cd / s.max, 0, 1)); ctx.closePath(); ctx.fill();
      ctx.restore();
      // 残りは行動回数
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif';
      ctx.fillText(String(Math.ceil(s.cd)), sx + sz / 2, sy + sz / 2 + 24);
    }
    ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText(s.label, sx + sz / 2, sy + sz + 16);
    sx += sz + gap;
  }

  // クエスト
  const qs = QUESTS.filter((q) => p.quests[q.id] && p.quests[q.id].state !== 'claimed');
  if (qs.length) {
    const qy = py + 18 + lines.length * 19 + 10;
    ctx.fillStyle = 'rgba(13,17,23,0.75)'; roundRect(px, qy, 174, 26 + qs.length * 34, 8); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText('クエスト', px + 12, qy + 18);
    qs.forEach((q, i) => {
      const st = p.quests[q.id], y = qy + 38 + i * 34;
      ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(q.name, px + 12, y);
      ctx.font = '12px sans-serif';
      if (st.state === 'ready') { ctx.fillStyle = '#69f0ae'; ctx.fillText(`${npcById(q.giver).name}に報告`, px + 12, y + 15); }
      else { ctx.fillStyle = '#9da7b3'; ctx.fillText(`${enemyName(q.target)} ${st.count} / ${q.count}`, px + 12, y + 15); }
    });
  }

  // ボスHP
  const boss = enemies.find((e) => e.isBoss && e.state === 'chase');
  if (boss) {
    // 画面が狭いと左上の HP バーと重なるので、そのときは少し下に出す
    const bw = Math.min(520, W - 420), bx = (W - bw) / 2;
    bar(bx, bx < 340 ? 160 : 58, bw, 18, boss.hp / boss.stats.maxHp, '#c62828', `Lv${boss.level} ${boss.name}  ${Math.ceil(boss.hp)} / ${boss.stats.maxHp}`);
  }

  drawTurnOrder();
  drawLog();
  drawMinimap();
  drawTooltip();

  // メッセージ
  if (game.msgT > 0) {
    ctx.globalAlpha = clamp(game.msgT, 0, 1);
    ctx.textAlign = 'center'; ctx.font = 'bold 44px sans-serif';
    ctx.lineWidth = 6; ctx.strokeStyle = '#000';
    ctx.strokeText(game.msg, W / 2, H * 0.28); ctx.fillStyle = '#ffd54f'; ctx.fillText(game.msg, W / 2, H * 0.28);
    // 小さい文字は改行 (\n) で何行かに分けられる
    ctx.font = 'bold 20px sans-serif'; ctx.lineWidth = 4; ctx.fillStyle = '#e6edf3';
    game.sub.split('\n').filter(Boolean).forEach((line, i) => {
      const y = H * 0.28 + 40 + i * 28;
      ctx.strokeText(line, W / 2, y); ctx.fillText(line, W / 2, y);
    });
    ctx.globalAlpha = 1;
  }
}

// 右下の地図。M キーかクリックで、今いるゾーンの地図 (minimap) と世界地図 (worldMap) を切り替える
let worldMapOn = false;
function toggleWorldMap() { worldMapOn = !worldMapOn; }
function mapHint(x, y, w, text) {
  ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(13,17,23,0.8)'; ctx.fillRect(x + w - ctx.measureText(text).width - 9, y - 19, ctx.measureText(text).width + 12, 16);
  ctx.fillStyle = '#9da7b3'; ctx.fillText(text, x + w + 1, y - 7);
}
function drawMinimap() {
  if (worldMapOn) { drawWorldMap(); return; }
  const s = Math.min(200 / MAP_W, 150 / MAP_H), mw = MAP_W * s, mh = MAP_H * s, mx = W - mw - 16, my = H - mh - 16;
  hudButtons.push({ id: 'map', x: mx - 3, y: my - 3, w: mw + 6, h: mh + 6 });
  mapHint(mx - 3, my - 3, mw + 6, 'M: 世界地図');
  ctx.fillStyle = 'rgba(13,17,23,0.8)'; ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
  for (const o of obstacles) {
    ctx.fillStyle = WORLD.terrain[o.kind].minimap;
    ctx.fillRect(mx + o.x * s, my + o.y * s, Math.max(1, o.w * s), Math.max(1, o.h * s));
  }
  ctx.fillStyle = '#80deea';
  for (const g of zone.gates) ctx.fillRect(mx + g.tx * T * s, my + g.ty * T * s, Math.max(3, g.tw * T * s), Math.max(3, g.th * T * s));
  if (zone.respawn) { ctx.fillStyle = '#ff9800'; pathCircle(mx + center(zone.respawn.tx) * s, my + center(zone.respawn.ty) * s, 3); ctx.fill(); }
  ctx.fillStyle = '#ffe082';
  for (const n of zone.npcs || []) { pathCircle(mx + center(n.tx) * s, my + center(n.ty) * s, 3); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
  ctx.strokeRect(mx + cam.x * s, my + cam.y * s, (W / VIEW) * s, (H / VIEW) * s);
  ctx.fillStyle = '#b388ff';
  for (const sp of spawns) ctx.fillRect(mx + center(sp.tx) * s - 2, my + center(sp.ty) * s - 2, 4, 4);
  for (const e of enemies) {
    ctx.fillStyle = e.isBoss ? '#ffd54f' : e.state === 'chase' ? '#ff1744' : '#c96b6b';
    const r = e.isBoss ? 4 : 2.5;
    ctx.fillRect(mx + e.x * s - r, my + e.y * s - r, r * 2, r * 2);
  }
  ctx.fillStyle = '#4fc3f7';
  pathCircle(mx + player.x * s, my + player.y * s, 3.5); ctx.fill();
}

// 世界地図: 全ゾーンを world.js の mapPos に並べ、地形・門・かがり火・NPC と、門どうしのつながりを描く。
// 今いるゾーンは枠を明るくし、主人公の位置を出す。ゾーンの大きさは実際の比率 (fullW が枠の幅いっぱい)
// 建物の中 (parent のあるゾーン) は描かず、外のゾーンの入口にいることにする
function drawWorldMap() {
  const M = WORLD.worldMap, zones = Object.entries(WORLD.zones).filter(([, z]) => !z.parent);
  const hereId = zone.parent || zone.id;
  const door = zone.parent && WORLD.zones[hereId].gates.find((g) => g.to === zone.id);
  const here = door ? { x: door.x + door.w / 2, y: door.y + door.h / 2 } : player;
  const cols = Math.max(...zones.map(([, z]) => z.mapPos[0])) + 1, rows = Math.max(...zones.map(([, z]) => z.mapPos[1])) + 1;
  const pad = 8, labelH = 26, margin = 13;
  // 枠の大きさ: スキル欄の右と、右上のステータス (statsBottom) の下に収まるように縮める (文字は縮めない)
  const sb = hudButtons.find((b) => b.id === 'items');
  const availW = W - margin - (sb ? sb.x + sb.w + 12 : 0), availH = H - margin - statsBottom - 12;
  const k = clamp(Math.min(1, (availW - (cols - 1) * M.gap - pad * 2) / (cols * M.cellW),
    (availH - rows * labelH - (rows - 1) * M.gap - pad * 2) / (rows * M.cellH)), M.minScale, 1);
  const cellW = M.cellW * k, cellH = M.cellH * k;
  const ww = cols * cellW + (cols - 1) * M.gap + pad * 2, wh = rows * (cellH + labelH) + (rows - 1) * M.gap + pad * 2;
  const ox = W - ww - margin, oy = H - wh - margin;
  hudButtons.push({ id: 'map', x: ox, y: oy, w: ww, h: wh });
  mapHint(ox, oy, ww, 'M: このエリアの地図');
  ctx.fillStyle = 'rgba(13,17,23,0.88)'; roundRect(ox, oy, ww, wh, 8); ctx.fill();
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
  ctx.strokeStyle = 'rgba(128,222,234,0.55)'; ctx.lineWidth = 2;
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
    ctx.fillStyle = '#80deea';
    for (const g of z.gates) ctx.fillRect(p.x + g.x * zs, p.y + g.y * zs, Math.max(2, g.w * zs), Math.max(2, g.h * zs));
    if (z.respawn) { ctx.fillStyle = '#ff9800'; pathCircle(p.x + z.respawn.x * zs, p.y + z.respawn.y * zs, 2.5); ctx.fill(); }
    ctx.fillStyle = '#ffe082';
    for (const n of z.npcs || []) { pathCircle(p.x + n.x * zs, p.y + n.y * zs, 2); ctx.fill(); }
    ctx.strokeStyle = isHere ? '#4fc3f7' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = isHere ? 2 : 1;
    ctx.strokeRect(p.x, p.y, z.w * zs, z.h * zs);
    if (isHere) { ctx.fillStyle = '#4fc3f7'; pathCircle(p.x + here.x * zs, p.y + here.y * zs, 3.5); ctx.fill(); }
    // 名前と敵レベル (町は「安全」)
    const lx = p.cx + cellW / 2, ly = p.cy + cellH + 11;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = isHere ? '#4fc3f7' : '#e6edf3'; ctx.fillText(z.name, lx, ly);
    ctx.font = '10px sans-serif'; ctx.fillStyle = z.safe ? '#a5d6a7' : '#9da7b3'; ctx.fillText(zoneLevelText(z), lx, ly + 12);
  }
}

function drawTooltip() {
  const e = enemies.find((u) => u.tx === mouse.tx && u.ty === mouse.ty);
  if (!e) return;
  const st = e.stats;
  const lines = [
    `HP ${Math.ceil(e.hp)} / ${st.maxHp}`, `${STATS.atk.label} ${st.atk.toFixed(0)}  ${STATS.def.label} ${st.def.toFixed(0)}  ${STATS.int.label} ${st.int.toFixed(0)}  ${STATS.mdef.label} ${st.mdef.toFixed(0)}`,
    `速度 ${Math.round(st.speed)}（あなたの ${(st.speed / player.stats.speed).toFixed(2)} 倍）`,
    `技: ${e.def.attacks.map((a) => a.name + (a.kind === 'magic' ? '（術）' : '')).join(' / ')}`,
    `素材: ${(e.def.drops || []).map((m) => IT.materials[m.id].name).join(' / ')}`,
    `経験値 ${e.exp}　${e.camp.name}`,
  ];
  ctx.font = '13px sans-serif';
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width), 100) + 20;
  const h = 30 + lines.length * 18;
  const x = clamp(mouse.x + 16, 0, W - w), y = clamp(mouse.y + 16, 0, H - h);
  ctx.fillStyle = 'rgba(13,17,23,0.92)'; roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = e.color; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = levelColor(e.level); ctx.font = 'bold 14px sans-serif'; ctx.fillText(`Lv${e.level} ${e.name}`, x + 10, y + 20);
  ctx.fillStyle = '#e6edf3'; ctx.font = '13px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, x + 10, y + 40 + i * 18));
}

// 行動順: これから誰がどの順に動くか (速いキャラほど何度も出てくる)
function drawTurnOrder() {
  const list = turnOrder(TN.orderCount);
  const sz = 30, gap = 4, w = list.length * (sz + gap) - gap;
  const x0 = (W - w) / 2, y = 14;
  ctx.fillStyle = 'rgba(13,17,23,0.75)'; roundRect(x0 - 60, y - 6, w + 70, sz + 12, 8); ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#9da7b3'; ctx.font = 'bold 12px sans-serif';
  ctx.fillText('行動順', x0 - 52, y + sz / 2);
  list.forEach((u, i) => {
    const x = x0 + i * (sz + gap);
    ctx.fillStyle = u.isPlayer ? '#0b3a52' : '#3a1a1a'; roundRect(x, y, sz, sz, 6); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = u.isPlayer ? '#4fc3f7' : u.charging ? '#ff7043' : u.color; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = u.isPlayer ? '#e1f5fe' : u.color; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(u.isPlayer ? '自' : u.def.glyph, x + sz / 2, y + sz / 2 + 1);
  });
  ctx.textBaseline = 'alphabetic';
}

// メッセージ欄 (左下)。古いものほど薄く
function drawLog() {
  const x = 20, lh = 19, y0 = H - 22 - (logLines.length - 1) * lh;
  ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  logLines.forEach((l, i) => {
    ctx.globalAlpha = 0.45 + 0.55 * (i + 1) / logLines.length;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(l.text, x, y0 + i * lh); ctx.fillStyle = l.color; ctx.fillText(l.text, x, y0 + i * lh);
  });
  ctx.globalAlpha = 1;
}
