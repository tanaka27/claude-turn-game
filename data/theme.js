// =====================================================================
//  意味を持つ色 (陣営・敵のレベル差など)
//  地形の色は world.js の terrain、レア度の色は data/items.js、敵の色は data/enemies.js
// =====================================================================

const THEME = {
  // 予測線・弾・着弾の色 ('r,g,b'。透明度はあとから付ける)
  faction: {
    player: { rgb: '80,200,255', slash: '200,240,255', spark: '#80d8ff', orbGlow: 'rgba(100,200,255,0.35)', orb: '#e1f5fe' },
    enemy: { rgb: '255,70,70', slash: '255,180,170', spark: '#ffab40', trail: '#ff9e40', orbGlow: 'rgba(255,120,40,0.35)', orb: '#ffcc80' },
  },
  spawn: '179,136,255',   // 敵が湧く前の予告
  // 敵のレベルの文字色 (自分とのレベル差で決まる。格下の境目は params.js の enemyLevel.grayDiff)
  level: { much: '#ff5252', higher: '#ffab40', even: '#e6edf3', gray: '#8b949e' },
  levelMuchDiff: 3,       // このレベル以上高いと much
  mp: '#3d8bfd',          // MP のゲージ (HUD・キャラクターの画面)
  mpShort: '#ff8a80',     // スキル欄の消費 MP (MP が足りないとき)
};
