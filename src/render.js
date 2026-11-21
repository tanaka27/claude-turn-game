// =====================================================================
//  描画 (ワールド)
//  色は data/theme.js の THEME (field / unit / npc / buffIcon)、地形の色は world.js の terrain
// =====================================================================
'use strict';

function pathCircle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
// canvas の文字の書き方 (太字か・大きさ px)。書体は THEME.font
const fontOf = (px, bold = true) => `${bold ? 'bold ' : ''}${px}px ${THEME.font}`;
// 縁取りした文字: 縁 (stroke。太さ lineWidth) を描いてから中を fill で塗る。書体・寄せ方は呼ぶ側で先に決めておく
function outlineText(text, x, y, fill, lineWidth, stroke = THEME.text.outline) {
  ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

// 強化 (data/buffs.js) のアイコン。(x, y) は左上、s は一辺。地の色に 1 文字、右上に上昇 (▲) か低下 (▼) の印、
// 右下に残りの行動回数。残り 1 行動のときは点滅する。HUD の仲間の欄と、フィールドのキャラの頭上で使う
function drawBuffIcon(b, x, y, s) {
  const d = BUFFS[b.id], C = THEME.buffIcon;
  if (!d) return;
  ctx.save();
  if (b.left <= 1) ctx.globalAlpha *= 0.45 + 0.55 * Math.abs(Math.sin(game.rt * 6));
  ctx.fillStyle = d.color; roundRect(x, y, s, s, s * 0.22); ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.07); ctx.strokeStyle = C.edge; ctx.stroke();
  ctx.fillStyle = C.glyph; ctx.font = fontOf(Math.round(s * 0.58));
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(d.icon, x + s * 0.42, y + s * 0.56);
  const up = d.mult >= 1, ax = x + s * 0.82, ay = y + s * 0.24, a = s * 0.17;
  ctx.fillStyle = up ? C.up : C.down; ctx.strokeStyle = C.arrowEdge; ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  if (up) { ctx.moveTo(ax, ay - a); ctx.lineTo(ax + a, ay + a * 0.7); ctx.lineTo(ax - a, ay + a * 0.7); }
  else { ctx.moveTo(ax, ay + a); ctx.lineTo(ax + a, ay - a * 0.7); ctx.lineTo(ax - a, ay - a * 0.7); }
  ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.font = fontOf(Math.round(s * 0.42)); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  outlineText(String(b.left), x + s + 2, y + s + 2, C.count, Math.max(2, s * 0.14));
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
      g.globalCompositeOperation = 'source-in'; g.fillStyle = THEME.unit.hitFlash; g.fillRect(0, 0, c.width, c.height);
      s.flash = c; s.ready = true;
    };
    s.img.onerror = () => console.error('[データの確認]', `絵を読み込めない: ${src} (図形で描く)`);
    s.img.src = src;
  }
  return s.ready ? s : null;
}

// ----- キャラの絵 -----
// 種類 (unitKind) ごとの絵の指定のありか。主人公は data/player.js、敵・ボス・仲間はその種類 (def)、NPC は world.js の NPC の sprite
const SPRITE_SOURCE = {
  hero: () => PLAYER.sprite,
  enemy: (u) => u.def.sprite,
  boss: (u) => u.def.sprite,
  ally: (u) => u.def.sprite,
  npc: (u) => u.sprite,
};
// 絵の指定 (entry) から、いま描く 1 枚の絵のパスを選ぶ。今は指定がそのまま 1 枚の絵のパス (右向きの PNG / WebP)。
// アニメーションのコマ・向きごとの絵を足すときは、指定を { frames: [...], ... } のようなオブジェクトにして、ここで
// u (向き u.facing、描く位置が追いついたか、game.rt など) からコマを選んで返す
// (起動時のデータの確認 src/validate.js の sprite の形の確認も合わせて直す。docs/render.md の「アニメーションを足すとき」)
function spriteFrameSrc(entry, u) { return typeof entry === 'string' ? entry : null; }
// キャラ u の読み込み済みの絵 (まだないか、指定がなければ null。そのときは図形で描く)
function unitSprite(u) { return getSprite(spriteFrameSrc(SPRITE_SOURCE[unitKind(u)](u), u)); }

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
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontOf(13);
  outlineText(txt('world.hazardLeft', { n }), center(best[0]), center(best[1]), THEME.field.hazardCount, 3);
}

// 地形の種類 (world.js の terrain のキー) → 描き方 (o: 障害物 { kind, x, y, w, h } (px)、c: その種類の colors)。
// 種類を足すときは world.js の terrain に 1 行、ここに 1 つ足す (ここにない種類は柵と同じ描き方になる)
const TERRAIN_DRAW = {
  wall(o, c) {
    ctx.fillStyle = c.base; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = c.top; ctx.fillRect(o.x, o.y, o.w, Math.min(8, o.h));
    ctx.strokeStyle = c.edge; ctx.lineWidth = 2; ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  },
  water(o, c) {
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
  },
  tree(o, c) {
    const r = Math.min(o.w, o.h) * 0.45;
    ctx.fillStyle = c.dark; roundRect(o.x, o.y, o.w, o.h, r); ctx.fill();
    ctx.fillStyle = c.mid; roundRect(o.x + 6, o.y + 4, o.w - 12, o.h - 14, r * 0.8); ctx.fill();
    ctx.fillStyle = c.light; pathCircle(o.x + o.w * 0.4, o.y + o.h * 0.38, r * 0.45); ctx.fill();
  },
  house(o, c) {
    ctx.fillStyle = c.wall; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = c.roof; ctx.fillRect(o.x, o.y, o.w, o.h * 0.62);
    ctx.strokeStyle = c.roofLine; ctx.lineWidth = 2;
    for (let y = o.y + 14; y < o.y + o.h * 0.62; y += 14) { ctx.beginPath(); ctx.moveTo(o.x, y); ctx.lineTo(o.x + o.w, y); ctx.stroke(); }
    ctx.fillStyle = c.door; ctx.fillRect(o.x + o.w / 2 - 12, o.y + o.h - 34, 24, 34);
    ctx.fillStyle = c.window; ctx.fillRect(o.x + 20, o.y + o.h * 0.7, 18, 14); ctx.fillRect(o.x + o.w - 38, o.y + o.h * 0.7, 18, 14);
    ctx.strokeStyle = c.edge; ctx.lineWidth = 2; ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  },
  table(o, c) {
    ctx.fillStyle = c.edge; roundRect(o.x + 3, o.y + 5, o.w - 6, o.h - 6, 5); ctx.fill();
    ctx.fillStyle = c.top; roundRect(o.x + 3, o.y + 3, o.w - 6, o.h - 12, 5); ctx.fill();
    ctx.fillStyle = c.shine; ctx.fillRect(o.x + 8, o.y + 7, o.w - 16, 4);
  },
  fence(o, c) {
    ctx.fillStyle = c.rail;
    ctx.fillRect(o.x, o.y + o.h * 0.3, o.w, 5); ctx.fillRect(o.x, o.y + o.h * 0.65, o.w, 5);
    ctx.fillStyle = c.post;
    for (let x = o.x; x < o.x + o.w; x += 20) ctx.fillRect(x, o.y, 7, o.h);
  },
};
function drawObstacle(o) { (TERRAIN_DRAW[o.kind] || TERRAIN_DRAW.fence)(o, WORLD.terrain[o.kind].colors); }

// ----- キャラ (主人公・敵・ボス・仲間・NPC) -----
// 描き方の種類 (data/theme.js の UNIT_LOOK のキー)
const unitKind = (u) => (u.isPlayer ? 'hero' : u.faction === 'npc' ? 'npc' : u.isBoss ? 'boss' : u.faction === 'player' ? 'ally' : 'enemy');
const glyphOf = (u) => (u.def ? u.def.glyph : u.glyph);

// 足元の影の楕円 (中心の下へのずれ dy と半径 rx, ry)。種類に shadow (px) があればそれ、なければ大きさ r に THEME.unit.shadowShape を掛ける
function shadowOf(v) {
  const S = THEME.unit.shadowShape;
  return v.look.shadow || { dy: v.r * S.dy, rx: v.r * S.rx, ry: v.r * S.ry };
}
function drawShadow(v) {
  const sh = shadowOf(v);
  ctx.fillStyle = THEME.unit.shadow;
  ctx.beginPath(); ctx.ellipse(v.x, v.y + sh.dy, sh.rx, sh.ry, 0, 0, TAU); ctx.fill();
}
// 絵で描くときの足元の輪 (種類の footRing。color が 'own' ならキャラの色。nearOnly ならとなりにいるときだけ)
function drawFootRing(v) {
  const R = v.look.footRing;
  if (!R || (R.nearOnly && !v.near)) return;
  const rx = v.r + THEME.unit.footRingPad;
  ctx.lineWidth = R.width; ctx.strokeStyle = R.color === 'own' ? v.u.color : R.color;
  ctx.beginPath(); ctx.ellipse(v.x, v.y + shadowOf(v).dy, rx, rx * THEME.unit.shadowShape.ry, 0, 0, TAU); ctx.stroke();
}
// 絵を描き、絵の上端の y を返す (頭上のものをその上に出すため)。足元は影の中心にそろえる。
// 右向きの絵を、向きの左右成分で反転する (真上・真下に近いときは前の向きのまま)。当たった瞬間は同じ形の白
function drawUnitSprite(v, s) {
  const u = v.u, c = Math.cos(u.facing);
  if (c > UNIT_SPRITE.turnDeadZone) u.spriteFlip = false;
  else if (c < -UNIT_SPRITE.turnDeadZone) u.spriteFlip = true;
  const h = v.r * UNIT_SPRITE.scale, w = h * s.img.naturalWidth / s.img.naturalHeight;
  const foot = v.y + shadowOf(v).dy;
  ctx.save();
  ctx.translate(v.x, foot);
  if (u.spriteFlip) ctx.scale(-1, 1);
  ctx.drawImage(u.hitFlash > 0 ? s.flash : s.img, -w / 2, -h, w, h);
  ctx.restore();
  return foot - h;
}
// 絵がないときの形: 種類の部品を順に描く (武器の線 weapon → 耳 ears → 丸い体 → 目 eyes → 体の輪 bodyRing → 字 glyph)
function drawUnitShape(v) {
  const u = v.u, L = v.look, C = THEME.unit, x = v.x, y = v.y, r = v.r;
  if (L.weapon) {
    const c = Math.cos(u.facing), s = Math.sin(u.facing);
    ctx.strokeStyle = L.weapon; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + c * r * 0.6, y + s * r * 0.6);
    ctx.lineTo(x + c * (r + 14), y + s * (r + 14)); ctx.stroke();
  }
  if (L.ears) {
    // 向いている側の左右に 2 つの三角
    ctx.fillStyle = u.color; ctx.strokeStyle = C.edge; ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      const a = u.facing + side * 0.75;
      const bx = x + Math.cos(a) * r * 0.85, by = y + Math.sin(a) * r * 0.85;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a + side * 0.5) * r * 0.35, by + Math.sin(a + side * 0.5) * r * 0.35);
      ctx.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4);
      ctx.lineTo(bx + Math.cos(a - side * 0.9) * r * 0.35, by + Math.sin(a - side * 0.9) * r * 0.35);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  pathCircle(x, y, r);
  ctx.fillStyle = u.hitFlash > 0 ? C.hitFlash : u.color; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = v.near && L.nearEdge ? L.nearEdge : L.edge; ctx.stroke();
  if (L.eyes) {
    // 向いている方向に 2 つ
    ctx.fillStyle = L.eyes;
    for (const side of [-1, 1]) {
      const a = u.facing + side * 0.45;
      pathCircle(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, Math.max(2, r * 0.14)); ctx.fill();
    }
  }
  if (L.bodyRing) { ctx.lineWidth = 3; ctx.strokeStyle = L.bodyRing; pathCircle(x, y, r + 4); ctx.stroke(); }
  if (L.glyph) {
    ctx.fillStyle = C.glyph;
    ctx.font = fontOf(L.glyphPx || Math.round(r * 1.0));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(glyphOf(u), x, y + 1);
  }
}

// 頭 (絵の上端か、図形の体の上端) の y
const headOf = (v) => (v.spriteTop !== null ? v.spriteTop : v.y - v.r);
// 頭上の HP バーの幅 w と上端 y (絵のときは絵の上端の上、図形のときは体の上)
function headBar(v) {
  const B = THEME.bars;
  return { w: Math.max(B.unitMinW, v.r * B.unitWPerR), y: v.spriteTop !== null ? v.spriteTop - 4 : v.y - v.r - 9 };
}
// 頭上などに描くもの (UNIT_LOOK の overlays に書く名前 → 描き方)。v: { u: キャラ, look: 種類の描き方, x, y, r, near, spriteTop }
const UNIT_OVERLAYS = {
  // 強化・弱体のアイコン (頭から look.buffLift 上に並べる)
  buffs(v) {
    if (v.u.buffs && v.u.buffs.length) drawBuffRow(v.u, v.x, headOf(v) - v.look.buffLift, THEME.buffIcon.fieldSize);
  },
  // HP バー (帰還中は look.hpReturn の色)
  hpBar(v) {
    const u = v.u, B = THEME.bars, { w, y } = headBar(v);
    ctx.fillStyle = B.unitBack; ctx.fillRect(v.x - w / 2 - 1, y - 1, w + 2, B.unitH + 2);
    ctx.fillStyle = u.state === 'return' ? v.look.hpReturn : v.look.hp; ctx.fillRect(v.x - w / 2, y, w * u.hp / u.stats.maxHp, B.unitH);
  },
  // HP バーの左にレベル (主人公とのレベル差で色分け)
  level(v) {
    const { w, y } = headBar(v);
    ctx.textBaseline = 'middle'; ctx.font = fontOf(11); ctx.textAlign = 'right';
    outlineText(txt('world.unitLevel', { level: v.u.level }), v.x - w / 2 - 3, y + 3, levelColor(v.u.level), 3);
  },
  // 技の構え中 (予告を出している) の「!」 (HP バーの右)
  charge(v) {
    if (!v.u.charging) return;
    const { w, y } = headBar(v);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.font = fontOf(18);
    outlineText(txt('world.chargeMark'), v.x + w / 2 + 6, y - 2, THEME.unit.charge, 4);
  },
  // 名前 (頭から look.nameLift 上)
  name(v) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontOf(13);
    outlineText(v.u.name, v.x, headOf(v) - v.look.nameLift, THEME.npc.name, 3);
  },
  // 受けられるクエストの「!」・報告できるクエストの「?」 (頭から look.markLift 上で上下に揺れる。npcMark の '!' / '?' で分け、書く字は data/text.js)
  questMark(v) {
    const mark = npcMark(v.u);
    if (!mark) return;
    ctx.font = fontOf(24);
    outlineText(txt(mark === '?' ? 'world.reportMark' : 'world.questMark'), v.x, headOf(v) - v.look.markLift + Math.sin(game.rt * 4) * 3, mark === '?' ? THEME.npc.report : THEME.npc.quest, 4);
  },
  // となりにいるときの操作の案内 (中心から look.hintDrop 下)
  talkHint(v) {
    if (!v.near) return;
    ctx.font = fontOf(13);
    outlineText(txt('world.talkHint'), v.x, v.y + v.look.hintDrop, THEME.npc.hint, 3);
  },
};

// キャラを描く: 影 → 体 (絵があれば足元の輪と絵、なければ図形) → 種類の overlays を順に。
// 種類ごとの違いは data/theme.js の UNIT_LOOK に書く。near: (NPC が) 主人公のとなりにいるか
function drawUnit(u, near = false) {
  const look = UNIT_LOOK[unitKind(u)];
  // NPC (look.onTile) は描く位置 (x, y) を持たないので、いるマスの中心に描く
  const v = { u, look, near, x: look.onTile ? center(u.tx) : u.x, y: look.onTile ? center(u.ty) : u.y, r: look.r || u.r, spriteTop: null };
  drawShadow(v);
  ctx.globalAlpha = u.invuln ? 0.5 : 1;
  const s = unitSprite(u);
  if (s) { drawFootRing(v); v.spriteTop = drawUnitSprite(v, s); }
  else drawUnitShape(v);
  for (const o of look.overlays) UNIT_OVERLAYS[o](v);
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
    fillTiles(tiles, THEME.field.aim, 0.12, 0.8);
    return;
  }
  const h = planAttack(p, a, mouse.tx, mouse.ty);
  if (a.type === 'lob') {
    // 届く範囲 (射程) を丸で示す
    ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = THEME.field.aimRange;
    pathCircle(p.x, p.y, (a.castRange + 0.5) * T); ctx.stroke(); ctx.setLineDash([]);
  }
  fillTiles(h.tiles, THEME.field.aim, 0.14, 0.85);
}

// マウスを重ねているマスと、クリックで歩く道
function drawCursor() {
  if (!player || game.state !== 'play' || game.paused || !inMap(mouse.tx, mouse.ty)) return;
  ctx.strokeStyle = aiming ? THEME.field.cursorAiming : THEME.field.cursor; ctx.lineWidth = 2;
  ctx.strokeRect(mouse.tx * T + 1, mouse.ty * T + 1, T - 2, T - 2);
  if (player.travel) {
    ctx.fillStyle = THEME.field.travel;
    for (const [x, y] of player.travel) { pathCircle(center(x), center(y), 3); ctx.fill(); }
  }
}

// 演出の種類 (effects の type) → 描き方 draw(f, k) (k: 0〜1 の進み具合 t / life)。
//   under: true ならキャラより下に描く / update(f, dt): 毎フレーム動かすもの (src/main.js の updateFx が呼ぶ)
// 種類を足すときはここに 1 つと、src/core.js に作る関数 (fxRing など) を 1 つ足す
const EFFECT_TYPES = {
  // 飛び散る火花 (burst)。だんだん薄く・遅くなる
  particle: {
    draw(f, k) {
      ctx.globalAlpha = 1 - k; ctx.fillStyle = f.color;
      ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
    },
    update(f, dt) {
      const drag = THEME.fx.particle.drag;
      f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= drag; f.vy *= drag;
    },
  },
  // 広がる輪 (color は 'r,g,b')
  ring: {
    draw(f, k) {
      ctx.strokeStyle = `rgba(${f.color},${1 - k})`; ctx.lineWidth = 4 * (1 - k) + 1;
      pathCircle(f.x, f.y, f.r0 + (f.r1 - f.r0) * k); ctx.stroke();
    },
  },
  // 判定の出たマスが一瞬光る
  tiles: { draw(f, k) { fillTiles(f.tiles, FC[f.faction].slash, 0.5 * (1 - k)); } },
  // 弾: 線の上を先端が走る
  bolt: {
    draw(f, k) {
      const col = FC[f.faction].rgb, m = Math.min(1, k * 1.4);
      const x = f.x0 + (f.x1 - f.x0) * m, y = f.y0 + (f.y1 - f.y0) * m;
      ctx.strokeStyle = `rgba(${col},${0.6 * (1 - k)})`; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = THEME.text.white; pathCircle(x, y, 5); ctx.fill();
    },
  },
  // 投げたもの: 放物線を描いて落ちる
  arc: {
    draw(f, k) {
      const fc = FC[f.faction];
      const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(Math.PI * k) * 90;
      ctx.fillStyle = fc.orbGlow; pathCircle(x, y, 16); ctx.fill();
      ctx.fillStyle = fc.orb; pathCircle(x, y, 7); ctx.fill();
    },
  },
  // ダッシュの残像 (キャラより下)
  ghost: {
    under: true,
    draw(f, k) { ctx.globalAlpha = 0.35 * (1 - k); ctx.fillStyle = f.color; pathCircle(f.x, f.y, f.r); ctx.fill(); },
  },
};
const effectUnder = (f) => !!(EFFECT_TYPES[f.type] && EFFECT_TYPES[f.type].under);
function drawEffect(f) {
  const d = EFFECT_TYPES[f.type];
  if (d) d.draw(f, f.t / f.life);
  ctx.globalAlpha = 1;
}

// 復活地点のかがり火
function drawBonfire() {
  if (!zone.respawn) return;
  const x = center(zone.respawn.tx), y = center(zone.respawn.ty);
  const fl = 1 + Math.sin(game.rt * 9) * 0.12, C = THEME.field.bonfire;
  ctx.fillStyle = C.glow; pathCircle(x, y, 18 * fl); ctx.fill();
  ctx.fillStyle = C.log; ctx.fillRect(x - 12, y + 2, 24, 6);
  ctx.fillStyle = C.flame; pathCircle(x, y - 2, 8 * fl); ctx.fill();
  ctx.fillStyle = C.core; pathCircle(x, y, 4 * fl); ctx.fill();
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
    ctx.fillStyle = `rgba(${THEME.field.door},${0.25 + 0.25 * pulse})`; ctx.fillRect(x + w / 2 - 14, y + h - 6, 28, 6);
    return;
  }
  ctx.fillStyle = `rgba(${THEME.field.gate},${0.15 + 0.15 * pulse})`; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = `rgba(${THEME.field.gate},0.85)`; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}
function drawGateLabel(g) {
  const dest = WORLD.zones[g.to];
  if (g.door) {
    // 建物の入口は名前だけを家の扉の上に小さく出す
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontOf(12);
    outlineText(dest.name, (g.tx + g.tw / 2) * T, g.ty * T - 4, THEME.field.doorLabel, 3);
    return;
  }
  const lx = ((g.tx + g.tw / 2) * T + center(g.sx)) / 2, ly = ((g.ty + g.th / 2) * T + center(g.sy)) / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontOf(14);
  outlineText(txt('world.gateLabel', { zone: dest.name, level: zoneLevelText(dest) }), lx, ly, THEME.field.gateLabel, 4);
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
    ctx.fillStyle = m.color; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = THEME.field.lootEdge; ctx.stroke();
  } else {
    // 装備: 宝箱。ノーマルより上は光る
    const r = rarityOf(l.item.rarity);
    if (l.item.rarity !== 'common') {
      ctx.fillStyle = r.color; ctx.globalAlpha = fade * (0.25 + 0.15 * Math.sin(game.rt * 5));
      pathCircle(x, y, 14); ctx.fill();
      ctx.globalAlpha = fade;
    }
    ctx.fillStyle = THEME.field.chest; ctx.fillRect(x - 7, y - 6, 14, 12);
    ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.strokeRect(x - 7, y - 6, 14, 12);
  }
  ctx.globalAlpha = 1;
}

function drawWorld() {
  ctx.fillStyle = zone.theme.ground; ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.fillStyle = zone.theme.tile;
  for (let y = 0; y < MAP_H; y += 80) for (let x = (y / 80) % 2 ? 80 : 0; x < MAP_W; x += 160) ctx.fillRect(x, y, Math.min(80, MAP_W - x), Math.min(80, MAP_H - y));
  for (const d of decor) { ctx.fillStyle = d.c; ctx.fillRect(d.x, d.y, d.s, d.s); }
  // マス目の線
  ctx.strokeStyle = THEME.field.grid; ctx.lineWidth = 1;
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
  for (const n of zone.npcs || []) drawUnit(n, n === near);
  for (const e of effects) if (effectUnder(e)) drawEffect(e);
  for (const u of units) if (u !== player) drawUnit(u);
  if (player && !player.dead) drawUnit(player);
  for (const e of effects) if (!effectUnder(e)) drawEffect(e);
  drawAimPreview();
  drawCursor();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of texts) {
    ctx.globalAlpha = 1 - Math.max(0, (t.t / t.life - 0.5) * 2);
    ctx.font = fontOf(t.size);
    outlineText(t.text, t.x, t.y, t.color, 3);
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = THEME.background; ctx.fillRect(0, 0, W, H);
  const shx = game.shake ? rand(-game.shake, game.shake) : 0, shy = game.shake ? rand(-game.shake, game.shake) : 0;
  ctx.setTransform(DPR * VIEW, 0, 0, DPR * VIEW, (-cam.x * VIEW + shx) * DPR, (-cam.y * VIEW + shy) * DPR);
  drawWorld();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (game.state !== 'title') drawHUD();
}
