// =====================================================================
//  描画 (ワールド)
// =====================================================================
'use strict';

function pathCircle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }

// 強化 (data/buffs.js) のアイコン。(x, y) は左上、s は一辺。地の色に 1 文字、右上に上昇 (▲) か低下 (▼) の印、
// 右下に残りの行動回数。残り 1 行動のときは点滅する。HUD の仲間の欄と、フィールドのキャラの頭上で使う
function drawBuffIcon(b, x, y, s) {
  const d = BUFFS[b.id];
  if (!d) return;
  ctx.save();
  if (b.left <= 1) ctx.globalAlpha *= 0.45 + 0.55 * Math.abs(Math.sin(game.rt * 6));
  ctx.fillStyle = d.color; roundRect(x, y, s, s, s * 0.22); ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.07); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(s * 0.58)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(d.icon, x + s * 0.42, y + s * 0.56);
  const up = d.mult >= 1, ax = x + s * 0.82, ay = y + s * 0.24, a = s * 0.17;
  ctx.fillStyle = up ? '#b9f6ca' : '#ff8a80'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  if (up) { ctx.moveTo(ax, ay - a); ctx.lineTo(ax + a, ay + a * 0.7); ctx.lineTo(ax - a, ay + a * 0.7); }
  else { ctx.moveTo(ax, ay + a); ctx.lineTo(ax + a, ay - a * 0.7); ctx.lineTo(ax - a, ay - a * 0.7); }
  ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.font = `bold ${Math.round(s * 0.42)}px sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = Math.max(2, s * 0.14); ctx.strokeStyle = '#000';
  ctx.strokeText(String(b.left), x + s + 2, y + s + 2); ctx.fillStyle = '#fff'; ctx.fillText(String(b.left), x + s + 2, y + s + 2);
  ctx.restore();
}
// キャラの強化のアイコンを、(cx, bottom) を下の中央にして横に並べる
function drawBuffRow(u, cx, bottom, s) {
  const list = u.buffs || [];
  const gap = s * 0.25, w = list.length * s + (list.length - 1) * gap;
  list.forEach((b, i) => drawBuffIcon(b, cx - w / 2 + i * (s + gap), bottom - s, s));
}

// 絵 (PNG) の読み込み。最初に使うときに読み込みを始め、読み込み終わるまでは null を返す (そのあいだは図形で描く)
// 当たったときの白い光り用に、同じ形の白い絵 (flash) も作っておく
const sprites = {};
function getSprite(src) {
  if (!src) return null;
  let s = sprites[src];
  if (!s) {
    s = sprites[src] = { img: new Image(), flash: null, ready: false };
    s.img.onload = () => {
      const c = document.createElement('canvas');
      c.width = s.img.naturalWidth; c.height = s.img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(s.img, 0, 0);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      s.flash = c; s.ready = true;
    };
    s.img.onerror = () => console.error('[データの確認]', `絵を読み込めない: ${src} (図形で描く)`);
    s.img.src = src;
  }
  return s.ready ? s : null;
}

// 主人公・敵の絵 (data/player.js・data/enemies.js の sprite)
function unitSprite(u) { return getSprite(u.isPlayer ? PLAYER.sprite : u.def.sprite); }

// 主人公・敵の絵を描き、絵の上端の y を返す (HP バーをその上に出すため)。絵がまだなければ null
function drawUnitSprite(u) {
  const s = unitSprite(u);
  if (!s) return null;
  // 右向きの絵。向きの左右成分で反転する (真上・真下に近いときは前の向きのまま)
  const c = Math.cos(u.facing);
  if (c > UNIT_SPRITE.turnDeadZone) u.spriteFlip = false;
  else if (c < -UNIT_SPRITE.turnDeadZone) u.spriteFlip = true;
  const h = u.r * UNIT_SPRITE.scale, w = h * s.img.naturalWidth / s.img.naturalHeight;
  const foot = u.y + u.r * 0.7;   // 影の中心
  ctx.save();
  ctx.translate(u.x, foot);
  if (u.spriteFlip) ctx.scale(-1, 1);
  ctx.drawImage(u.hitFlash > 0 ? s.flash : s.img, -w / 2, -h, w, h);
  ctx.restore();
  return foot - h;
}

// マスの集まりを塗る。col: 'r,g,b' / fill・line: 透明度
function fillTiles(tiles, col, fill, line) {
  ctx.fillStyle = `rgba(${col},${fill})`;
  for (const [x, y] of tiles) ctx.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
  if (line) {
    ctx.strokeStyle = `rgba(${col},${line})`; ctx.lineWidth = 2;
    for (const [x, y] of tiles) ctx.strokeRect(x * T + 2, y * T + 2, T - 4, T - 4);
  }
}

// 予告: 範囲のマスを塗り、主人公があと何回行動できるかを出す (1 なら次に範囲の外へ出ないと当たる)
function drawHazard(h) {
  const u = h.owner, col = FC[h.faction].rgb;
  const n = actionsBefore(u);
  const blink = n <= 1 ? 0.6 + 0.4 * Math.sin(game.rt * 10) : 1;
  fillTiles(h.tiles, col, 0.22 * blink, 0.75 * blink);
  if (h.centers) {
    ctx.strokeStyle = `rgba(${col},0.4)`; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
    for (const [cx, cy] of h.centers) { ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(center(cx), center(cy)); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  // 数字は範囲のうち、一番主人公に近いマスに出す
  let best = h.tiles[0];
  if (!best) return;
  for (const t of h.tiles) if (dist(t[0], t[1], player.tx, player.ty) < dist(best[0], best[1], player.tx, player.ty)) best = t;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 13px sans-serif';
  ctx.lineWidth = 3; ctx.strokeStyle = '#000';
  const text = `あと${n}`;
  ctx.strokeText(text, center(best[0]), center(best[1])); ctx.fillStyle = '#ffccbc'; ctx.fillText(text, center(best[0]), center(best[1]));
}

// 地形を描く。色は world.js の terrain[種類].colors
function drawObstacle(o) {
  const c = WORLD.terrain[o.kind].colors;
  if (o.kind === 'wall') {
    ctx.fillStyle = c.base; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = c.top; ctx.fillRect(o.x, o.y, o.w, Math.min(8, o.h));
    ctx.strokeStyle = c.edge; ctx.lineWidth = 2; ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  } else if (o.kind === 'water') {
    ctx.fillStyle = c.base; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = c.wave; ctx.lineWidth = 2;
    for (let y = o.y + 16; y < o.y + o.h; y += 22) {
      ctx.beginPath();
      for (let x = o.x + 6; x < o.x + o.w - 6; x += 6) {
        const yy = y + Math.sin(x * 0.08 + game.rt * 2) * 3;
        if (x === o.x + 6) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = c.edge; ctx.strokeRect(o.x, o.y, o.w, o.h);
  } else if (o.kind === 'tree') {
    const r = Math.min(o.w, o.h) * 0.45;
    ctx.fillStyle = c.dark; roundRect(o.x, o.y, o.w, o.h, r); ctx.fill();
    ctx.fillStyle = c.mid; roundRect(o.x + 6, o.y + 4, o.w - 12, o.h - 14, r * 0.8); ctx.fill();
    ctx.fillStyle = c.light; pathCircle(o.x + o.w * 0.4, o.y + o.h * 0.38, r * 0.45); ctx.fill();
  } else if (o.kind === 'house') {
    ctx.fillStyle = c.wall; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = c.roof; ctx.fillRect(o.x, o.y, o.w, o.h * 0.62);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    for (let y = o.y + 14; y < o.y + o.h * 0.62; y += 14) { ctx.beginPath(); ctx.moveTo(o.x, y); ctx.lineTo(o.x + o.w, y); ctx.stroke(); }
    ctx.fillStyle = c.door; ctx.fillRect(o.x + o.w / 2 - 12, o.y + o.h - 34, 24, 34);
    ctx.fillStyle = c.window; ctx.fillRect(o.x + 20, o.y + o.h * 0.7, 18, 14); ctx.fillRect(o.x + o.w - 38, o.y + o.h * 0.7, 18, 14);
    ctx.strokeStyle = c.edge; ctx.lineWidth = 2; ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  } else if (o.kind === 'table') {
    ctx.fillStyle = c.edge; roundRect(o.x + 3, o.y + 5, o.w - 6, o.h - 6, 5); ctx.fill();
    ctx.fillStyle = c.top; roundRect(o.x + 3, o.y + 3, o.w - 6, o.h - 12, 5); ctx.fill();
    ctx.fillStyle = c.shine; ctx.fillRect(o.x + 8, o.y + 7, o.w - 16, 4);
  } else { // fence
    ctx.fillStyle = c.rail;
    ctx.fillRect(o.x, o.y + o.h * 0.3, o.w, 5); ctx.fillRect(o.x, o.y + o.h * 0.65, o.w, 5);
    ctx.fillStyle = c.post;
    for (let x = o.x; x < o.x + o.w; x += 20) ctx.fillRect(x, o.y, 7, o.h);
  }
}

function drawUnit(u) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(u.x, u.y + u.r * 0.7, u.r, u.r * 0.45, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = u.invuln ? 0.5 : 1;
  const c = Math.cos(u.facing), s = Math.sin(u.facing);
  // 絵があれば絵で描く (主人公は足元に水色の輪、ボスは金の輪)。なければ下の図形で描く
  if ((u.isPlayer || u.isBoss) && unitSprite(u)) {
    ctx.lineWidth = u.isPlayer ? 2.5 : 3; ctx.strokeStyle = u.isPlayer ? u.color : '#ffd54f';
    ctx.beginPath(); ctx.ellipse(u.x, u.y + u.r * 0.7, u.r + 6, (u.r + 6) * 0.45, 0, 0, TAU); ctx.stroke();
  }
  const spriteTop = drawUnitSprite(u);
  if (spriteTop !== null) {
    // 絵で描いた。体・耳・目・字・剣の線は描かない
  } else if (u.isPlayer) {
    // 武器
    ctx.strokeStyle = '#e0f7fa'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(u.x + c * u.r * 0.6, u.y + s * u.r * 0.6);
    ctx.lineTo(u.x + c * (u.r + 14), u.y + s * (u.r + 14)); ctx.stroke();
  } else {
    // モンスターの耳 (向いている側の左右に 2 つの三角)
    ctx.fillStyle = u.color; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      const a = u.facing + side * 0.75;
      const bx = u.x + Math.cos(a) * u.r * 0.85, by = u.y + Math.sin(a) * u.r * 0.85;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a + side * 0.5) * u.r * 0.35, by + Math.sin(a + side * 0.5) * u.r * 0.35);
      ctx.lineTo(u.x + Math.cos(a) * u.r * 1.4, u.y + Math.sin(a) * u.r * 1.4);
      ctx.lineTo(bx + Math.cos(a - side * 0.9) * u.r * 0.35, by + Math.sin(a - side * 0.9) * u.r * 0.35);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  if (spriteTop === null) {
    // 体
    pathCircle(u.x, u.y, u.r);
    ctx.fillStyle = u.hitFlash > 0 ? '#ffffff' : u.color; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = u.isPlayer ? '#e1f5fe' : 'rgba(0,0,0,0.6)'; ctx.stroke();
    if (!u.isPlayer) {
      // 目 (向いている方向に 2 つ)
      ctx.fillStyle = u.isBoss ? '#ffeb3b' : '#fff';
      for (const side of [-1, 1]) {
        const a = u.facing + side * 0.45;
        pathCircle(u.x + Math.cos(a) * u.r * 0.62, u.y + Math.sin(a) * u.r * 0.62, Math.max(2, u.r * 0.14)); ctx.fill();
      }
    }
    if (u.isBoss) { ctx.lineWidth = 3; ctx.strokeStyle = '#ffd54f'; pathCircle(u.x, u.y, u.r + 4); ctx.stroke(); }
    if (!u.isPlayer) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.font = `bold ${Math.round(u.r * 1.0)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(u.def.glyph, u.x, u.y + 1);
    }
  }
  // 頭上の強化のアイコン (主人公。敵は HP バーのさらに上)
  if (u.buffs && u.buffs.length) drawBuffRow(u, u.x, (spriteTop !== null ? spriteTop : u.y - u.r) - (u.isPlayer ? 4 : 14), 14);
  if (!u.isPlayer) {
    // 頭上の HP バーとレベル (絵のときは絵の上端の上)
    ctx.textBaseline = 'middle';
    const w = Math.max(30, u.r * 2.2), y = spriteTop !== null ? spriteTop - 4 : u.y - u.r - 9;
    ctx.fillStyle = '#000a'; ctx.fillRect(u.x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = u.state === 'return' ? '#8b949e' : '#ef5350'; ctx.fillRect(u.x - w / 2, y, w * u.hp / u.stats.maxHp, 4);
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000';
    ctx.strokeText(`Lv${u.level}`, u.x - w / 2 - 3, y + 3);
    ctx.fillStyle = levelColor(u.level); ctx.fillText(`Lv${u.level}`, u.x - w / 2 - 3, y + 3);
    // 技の構え中 (予告を出している) の印
    if (u.charging) {
      ctx.textAlign = 'center'; ctx.font = 'bold 18px sans-serif'; ctx.lineWidth = 4;
      ctx.strokeText('!', u.x + w / 2 + 6, y - 2); ctx.fillStyle = '#ff7043'; ctx.fillText('!', u.x + w / 2 + 6, y - 2);
    }
  }
  ctx.globalAlpha = 1;
}

function drawAimPreview() {
  if (!aiming || !player || player.dead) return;
  const a = aiming, p = player;
  if (a.type === 'dash') {
    const ang = Math.atan2(mouse.ty - p.ty, mouse.tx - p.tx), oct = Math.round(ang / (Math.PI / 4));
    const dx = Math.round(Math.cos(oct * Math.PI / 4)), dy = Math.round(Math.sin(oct * Math.PI / 4));
    const tiles = [];
    let x = p.tx, y = p.ty;
    for (let i = 0; i < a.distance && canStep(x, y, dx, dy) && isFree(x + dx, y + dy); i++) { x += dx; y += dy; tiles.push([x, y]); }
    fillTiles(tiles, '255,255,255', 0.12, 0.8);
    return;
  }
  const h = planAttack(p, a, mouse.tx, mouse.ty);
  if (a.type === 'lob') {
    // 届く範囲 (射程) を丸で示す
    ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    pathCircle(p.x, p.y, (a.castRange + 0.5) * T); ctx.stroke(); ctx.setLineDash([]);
  }
  fillTiles(h.tiles, '255,255,255', 0.14, 0.85);
}

// マウスを重ねているマスと、クリックで歩く道
function drawCursor() {
  if (!player || game.state !== 'play' || game.paused || !inMap(mouse.tx, mouse.ty)) return;
  ctx.strokeStyle = aiming ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(mouse.tx * T + 1, mouse.ty * T + 1, T - 2, T - 2);
  if (player.travel) {
    ctx.fillStyle = 'rgba(128,222,234,0.5)';
    for (const [x, y] of player.travel) { pathCircle(center(x), center(y), 3); ctx.fill(); }
  }
}

function drawEffect(f) {
  const k = f.t / f.life;
  if (f.type === 'particle') {
    ctx.globalAlpha = 1 - k; ctx.fillStyle = f.color;
    ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
  } else if (f.type === 'ring') {
    ctx.strokeStyle = `rgba(${f.color},${1 - k})`; ctx.lineWidth = 4 * (1 - k) + 1;
    pathCircle(f.x, f.y, f.r0 + (f.r1 - f.r0) * k); ctx.stroke();
  } else if (f.type === 'tiles') {
    fillTiles(f.tiles, FC[f.faction].slash, 0.5 * (1 - k));
  } else if (f.type === 'bolt') {
    // 弾: 線の上を先端が走る
    const col = FC[f.faction].rgb, m = Math.min(1, k * 1.4);
    const x = f.x0 + (f.x1 - f.x0) * m, y = f.y0 + (f.y1 - f.y0) * m;
    ctx.strokeStyle = `rgba(${col},${0.6 * (1 - k)})`; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff'; pathCircle(x, y, 5); ctx.fill();
  } else if (f.type === 'arc') {
    // 投げたもの: 放物線を描いて落ちる
    const fc = FC[f.faction];
    const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(Math.PI * k) * 90;
    ctx.fillStyle = fc.orbGlow; pathCircle(x, y, 16); ctx.fill();
    ctx.fillStyle = fc.orb; pathCircle(x, y, 7); ctx.fill();
  } else if (f.type === 'ghost') {
    ctx.globalAlpha = 0.35 * (1 - k); ctx.fillStyle = f.color; pathCircle(f.x, f.y, f.r); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// 復活地点のかがり火
function drawBonfire() {
  if (!zone.respawn) return;
  const x = center(zone.respawn.tx), y = center(zone.respawn.ty);
  const fl = 1 + Math.sin(game.rt * 9) * 0.12;
  ctx.fillStyle = 'rgba(255,152,0,0.25)'; pathCircle(x, y, 18 * fl); ctx.fill();
  ctx.fillStyle = '#5d4030'; ctx.fillRect(x - 12, y + 2, 24, 6);
  ctx.fillStyle = '#ff9800'; pathCircle(x, y - 2, 8 * fl); ctx.fill();
  ctx.fillStyle = '#ffe082'; pathCircle(x, y, 4 * fl); ctx.fill();
}

// 敵のレベルとプレイヤーのレベルの差で色を変える (高いほど赤、低いと灰色)
function levelColor(lv) {
  const d = lv - (player ? player.level : 1), C = THEME.level;
  if (d >= THEME.levelMuchDiff) return C.much;
  if (d >= 1) return C.higher;
  if (d > -P.enemyLevel.grayDiff) return C.even;
  return C.gray;
}

// 門: 光る床と、行き先の名前 (門から入ってきたときに立つ位置の側に出す)
function drawGate(g) {
  const pulse = 0.5 + 0.5 * Math.sin(game.rt * 3);
  const x = g.tx * T, y = g.ty * T, w = g.tw * T, h = g.th * T;
  if (g.door) {
    // 建物の入口: 家の扉の下を少し光らせるだけ
    ctx.fillStyle = `rgba(255,204,128,${0.25 + 0.25 * pulse})`; ctx.fillRect(x + w / 2 - 14, y + h - 6, 28, 6);
    return;
  }
  ctx.fillStyle = `rgba(100,220,255,${0.15 + 0.15 * pulse})`; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(100,220,255,0.85)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}
function drawGateLabel(g) {
  const dest = WORLD.zones[g.to];
  if (g.door) {
    // 建物の入口は名前だけを家の扉の上に小さく出す
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 12px sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000';
    const lx = (g.tx + g.tw / 2) * T, ly = g.ty * T - 4;
    ctx.strokeText(dest.name, lx, ly); ctx.fillStyle = '#ffe0b2'; ctx.fillText(dest.name, lx, ly);
    return;
  }
  const lx = ((g.tx + g.tw / 2) * T + center(g.sx)) / 2, ly = ((g.ty + g.th / 2) * T + center(g.sy)) / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 14px sans-serif';
  ctx.lineWidth = 4; ctx.strokeStyle = '#000';
  const text = `→ ${dest.name}（${zoneLevelText(dest)}）`;
  ctx.strokeText(text, lx, ly); ctx.fillStyle = '#80deea'; ctx.fillText(text, lx, ly);
}

function drawLoot(l) {
  const fade = l.t > EC.lootLife - 20 ? 0.4 + 0.6 * Math.abs(Math.sin(game.rt * 8)) : 1;
  const x = center(l.tx) + l.ox, y = center(l.ty) + l.oy + Math.sin(game.rt * 4 + l.ox) * 1.5;
  ctx.globalAlpha = fade;
  if (l.kind === 'material') {
    // 素材: 色付きのひし形。ノーマルより上はレア度の色で光る
    const m = IT.materials[l.id];
    if (m.rarity !== 'common') {
      ctx.fillStyle = rarityOf(m.rarity).color; ctx.globalAlpha = fade * (0.25 + 0.15 * Math.sin(game.rt * 5));
      pathCircle(x, y, 11); ctx.fill();
      ctx.globalAlpha = fade;
    }
    ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 6, y); ctx.closePath();
    ctx.fillStyle = m.color; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.stroke();
  } else {
    // 装備: 宝箱。ノーマルより上は光る
    const r = rarityOf(l.item.rarity);
    if (l.item.rarity !== 'common') {
      ctx.fillStyle = r.color; ctx.globalAlpha = fade * (0.25 + 0.15 * Math.sin(game.rt * 5));
      pathCircle(x, y, 14); ctx.fill();
      ctx.globalAlpha = fade;
    }
    ctx.fillStyle = '#5d4030'; ctx.fillRect(x - 7, y - 6, 14, 12);
    ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.strokeRect(x - 7, y - 6, 14, 12);
  }
  ctx.globalAlpha = 1;
}

// NPC: 体と名前。となりのマスにいると操作の案内を出す
function drawNpc(n, near) {
  const x = center(n.tx), y = center(n.ty);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y + 11, 15, 6, 0, 0, TAU); ctx.fill();
  pathCircle(x, y, 15); ctx.fillStyle = n.color; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = near ? '#fff' : 'rgba(0,0,0,0.6)'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(n.glyph, x, y + 1);
  ctx.font = 'bold 13px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
  ctx.strokeText(n.name, x, y - 27); ctx.fillStyle = '#ffe082'; ctx.fillText(n.name, x, y - 27);
  const mark = npcMark(n);
  if (mark) {
    const by = y - 48 + Math.sin(game.rt * 4) * 3;
    ctx.font = 'bold 24px sans-serif'; ctx.lineWidth = 4;
    ctx.strokeText(mark, x, by); ctx.fillStyle = mark === '?' ? '#69f0ae' : '#ffd54f'; ctx.fillText(mark, x, by);
    ctx.font = 'bold 13px sans-serif'; ctx.lineWidth = 3;
  }
  if (near) {
    const t = 'F: 話しかける';
    ctx.strokeText(t, x, y + 32); ctx.fillStyle = '#fff'; ctx.fillText(t, x, y + 32);
  }
}

function drawWorld() {
  ctx.fillStyle = zone.theme.ground; ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.fillStyle = zone.theme.tile;
  for (let y = 0; y < MAP_H; y += 80) for (let x = (y / 80) % 2 ? 80 : 0; x < MAP_W; x += 160) ctx.fillRect(x, y, Math.min(80, MAP_W - x), Math.min(80, MAP_H - y));
  for (const d of decor) { ctx.fillStyle = d.c; ctx.fillRect(d.x, d.y, d.s, d.s); }
  // マス目の線
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = T; x < MAP_W; x += T) { ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); }
  for (let y = T; y < MAP_H; y += T) { ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); }
  ctx.stroke();
  for (const o of obstacles) if (!o.blocksShots) drawObstacle(o);
  for (const o of obstacles) if (o.blocksShots) drawObstacle(o);
  for (const g of zone.gates) drawGate(g);
  drawBonfire();

  for (const s of spawns) fillTiles([[s.tx, s.ty]], THEME.spawn, 0.15 + 0.25 * clamp(s.t / s.total, 0, 1), 0.8);
  if (player) for (const h of hazards) drawHazard(h);
  for (const g of zone.gates) drawGateLabel(g);
  for (const l of loots) drawLoot(l);
  const near = nearNpc();
  for (const n of zone.npcs || []) drawNpc(n, n === near);
  for (const e of effects) if (e.type === 'ghost') drawEffect(e);
  for (const e of enemies) drawUnit(e);
  if (player && !player.dead) drawUnit(player);
  for (const e of effects) if (e.type !== 'ghost') drawEffect(e);
  drawAimPreview();
  drawCursor();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of texts) {
    ctx.globalAlpha = 1 - Math.max(0, (t.t / t.life - 0.5) * 2);
    ctx.font = `bold ${t.size}px sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = '#000';
    ctx.strokeText(t.text, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
  const shx = game.shake ? rand(-game.shake, game.shake) : 0, shy = game.shake ? rand(-game.shake, game.shake) : 0;
  ctx.setTransform(DPR * VIEW, 0, 0, DPR * VIEW, (-cam.x * VIEW + shx) * DPR, (-cam.y * VIEW + shy) * DPR);
  drawWorld();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (game.state !== 'title') drawHUD();
}
