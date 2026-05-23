const TYPE_COLORS = {
  delta: 0xe63946,
  sigma: 0x4895ef,
  omega: 0x4cc9a4,
  null:  0x888888,
};

// タイプ別パッシブバッジ（カード上の小ラベル）
const PASSIVE_BADGE = {
  delta: { label: '◆ATKダウン無効',      color: '#e63946' },
  sigma: { label: '◆融合→D0召喚',        color: '#4895ef' },
  omega: { label: (dim) => `◆攻撃ATK-${dim}`, color: '#4cc9a4' },
};
const TYPE_SYMBOLS = {
  delta: 'δ',
  sigma: 'σ',
  omega: 'Ω',
};
const DIM_COLORS = {
  0: 0x888888,
  1: 0xaaaaaa,
  2: 0x9b59b6,
  3: 0xe67e22,
  4: 0xffd700,
};

// カードid → テクスチャキー (delta=Red, sigma=Blue, omega=Green)
const CARD_IMG_KEYS = {
  '0d':       'card_0d',
  delta_1d:   'card_delta_1d',
  sigma_1d:   'card_sigma_1d',
  omega_1d:   'card_omega_1d',
  delta_2d:   'card_delta_2d',
  sigma_2d:   'card_sigma_2d',
  omega_2d:   'card_omega_2d',
  delta_3d:   'card_delta_3d',
  sigma_3d:   'card_sigma_3d',
  omega_3d:   'card_omega_3d',
  delta_4d:   'card_delta_4d',
  sigma_4d:   'card_sigma_4d',
  omega_4d:   'card_omega_4d',
};

const CARD_W = 82;
const CARD_H = 118;

export class Card extends Phaser.GameObjects.Container {
  constructor(scene, x, y, cardInstance) {
    super(scene, x, y);
    this._inst = cardInstance;
    this._selected = false;
    this._attacked = false;
    this._build();
    scene.add.existing(this);
  }

  _build() {
    const inst = this._inst;
    const typeColor = TYPE_COLORS[inst.type] ?? TYPE_COLORS.null;
    const is4D    = inst.dimension === 4;
    const isZeroD = inst.dimension === 0;
    const imgKey  = CARD_IMG_KEYS[inst.id];
    const hasImage = !!(imgKey && this.scene.textures.exists(imgKey));
    this._hasImage = hasImage;

    if (hasImage) {
      this._cardImg = this.scene.add.image(0, 0, imgKey).setDisplaySize(CARD_W, CARD_H);
      this.add(this._cardImg);

      // D1〜D3のみ下部暗幕（D0・D4はテキスト不要）
      if (!isZeroD && !is4D) {
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.58);
        overlay.fillRect(-CARD_W / 2, CARD_H / 2 - 52, CARD_W, 52);
        this.add(overlay);
      }

      this._bg = this.scene.add.graphics();
      this._drawBorder(typeColor, is4D, false);
      this.add(this._bg);
    } else {
      this._bg = this.scene.add.graphics();
      this._drawBg(typeColor, is4D, false);
      this.add(this._bg);
    }

    // タイプシンボル（右上）— D0はタイプなし(null)のためスキップ
    if (inst.type) {
      const symStyle = { fontSize: '11px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' };
      this._typeSymbol = this.scene.add.text(CARD_W / 2 - 3, -CARD_H / 2 + 3, TYPE_SYMBOLS[inst.type], symStyle).setOrigin(1, 0);
      this.add(this._typeSymbol);
    }

    // カード名・次元数はカード上には描画しない（ホバーツールチップで表示）

    if (!is4D && !isZeroD) {
      // パッシブバッジ（ステータスエリア直上の薄暗ストリップ）
      if (inst.type && PASSIVE_BADGE[inst.type]) {
        const badge = PASSIVE_BADGE[inst.type];
        const passiveLabel = typeof badge.label === 'function' ? badge.label(inst.dimension) : badge.label;
        const passBg = this.scene.add.graphics();
        passBg.fillStyle(0x000000, 0.72);
        passBg.fillRect(-CARD_W / 2, CARD_H / 2 - 64, CARD_W, 12);
        this.add(passBg);
        const pStyle = { fontSize: '7px', fill: badge.color, fontFamily: 'monospace', fontStyle: 'bold' };
        this._passiveBadge = this.scene.add.text(0, CARD_H / 2 - 63, passiveLabel, pStyle).setOrigin(0.5, 0);
        this.add(this._passiveBadge);
      }

      // D1〜D3: ATK / DEF / HP を下部暗幕上に表示
      const statStyle = { fontSize: '9px', fill: '#ccddee', fontFamily: 'monospace' };
      this._atkText = this.scene.add.text(-CARD_W / 2 + 3, CARD_H / 2 - 48, `ATK:${inst.currentAtk}`, statStyle).setOrigin(0, 0);
      this._defText = this.scene.add.text(-CARD_W / 2 + 3, CARD_H / 2 - 36, `DEF:${inst.currentDef}`, statStyle).setOrigin(0, 0);
      this._hpText  = this.scene.add.text(-CARD_W / 2 + 3, CARD_H / 2 - 24, `HP:${inst.currentHp}/${inst.maxHp}`, statStyle).setOrigin(0, 0);
      this.add([this._atkText, this._defText, this._hpText]);

      this._hpBar = this.scene.add.graphics();
      this._drawHpBar();
      this.add(this._hpBar);
    }
    // D4・D0: テキスト不要（ツールチップに表示）

    this._glow = this.scene.add.graphics();
    this.add(this._glow);

    this.setSize(CARD_W, CARD_H);
    this.setInteractive();
  }

  // 画像なし用: 塗りつぶしカード
  _drawBg(color, is4D, attacked) {
    const g = this._bg;
    g.clear();
    g.fillStyle(color, attacked ? 0.5 : 1.0);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    g.lineStyle(is4D ? 2 : 1, is4D ? 0xffd700 : 0xffffff, 0.5);
    g.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
  }

  // 画像あり用: ボーダーのみ
  _drawBorder(color, is4D, attacked) {
    const g = this._bg;
    g.clear();
    g.lineStyle(2, is4D ? 0xffd700 : color, attacked ? 0.4 : 0.9);
    g.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
  }

  _drawHpBar() {
    const g = this._hpBar;
    g.clear();
    const inst = this._inst;
    if (!inst.maxHp) return;
    const ratio = Math.max(0, inst.currentHp / inst.maxHp);
    const barW = CARD_W - 8;
    const barH = 4;
    const bx = -barW / 2;
    const by = CARD_H / 2 - 12;
    g.fillStyle(0x333333, 1);
    g.fillRect(bx, by, barW, barH);
    const fillColor = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffff00 : 0xff4444;
    g.fillStyle(fillColor, 1);
    g.fillRect(bx, by, Math.floor(barW * ratio), barH);
  }

  updateDisplay() {
    const inst = this._inst;
    if (this._atkText) {
      const atkDelta = (inst.currentAtk ?? 0) - (inst.baseAtk ?? 0);
      if (atkDelta !== 0) {
        const sign = atkDelta > 0 ? '+' : '';
        this._atkText.setText(`ATK:${inst.currentAtk}(${sign}${atkDelta})`);
        this._atkText.setStyle({ fill: atkDelta > 0 ? '#ffaa44' : '#88aaff' });
      } else {
        this._atkText.setText(`ATK:${inst.currentAtk}`);
        this._atkText.setStyle({ fill: '#ccddee' });
      }
    }
    if (this._defText) {
      const defDelta = (inst.currentDef ?? 0) - (inst.baseDef ?? 0);
      if (defDelta !== 0) {
        const sign = defDelta > 0 ? '+' : '';
        this._defText.setText(`DEF:${inst.currentDef}(${sign}${defDelta})`);
        this._defText.setStyle({ fill: defDelta > 0 ? '#44ddaa' : '#ff9999' });
      } else {
        this._defText.setText(`DEF:${inst.currentDef}`);
        this._defText.setStyle({ fill: '#ccddee' });
      }
    }
    if (this._hpText)  this._hpText.setText(`HP:${inst.currentHp}/${inst.maxHp}`);
    if (this._hpBar) this._drawHpBar();
    if (this._attacked) {
      const typeColor = TYPE_COLORS[inst.type] ?? TYPE_COLORS.null;
      if (this._hasImage) {
        this._cardImg?.setAlpha(0.5);
        this._drawBorder(typeColor, inst.dimension === 4, true);
      } else {
        this._drawBg(typeColor, inst.dimension === 4, true);
      }
    }
  }

  setSelected(val) {
    this._selected = val;
    const g = this._glow;
    g.clear();
    if (val) {
      g.lineStyle(3, 0xffff00, 1);
      g.strokeRoundedRect(-CARD_W / 2 - 2, -CARD_H / 2 - 2, CARD_W + 4, CARD_H + 4, 10);
    }
  }

  setAttacked(val) {
    this._attacked = val;
    const inst = this._inst;
    const typeColor = TYPE_COLORS[inst.type] ?? TYPE_COLORS.null;
    if (this._hasImage) {
      this._cardImg?.setAlpha(val ? 0.5 : 1);
      this._drawBorder(typeColor, inst.dimension === 4, val);
    } else {
      this._drawBg(typeColor, inst.dimension === 4, val);
    }
  }

  playSpawnAnim() {
    this.setScale(0.2);
    this.setAlpha(0);
    this.setRotation(-0.12);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1, scaleY: 1,
      alpha: 1,
      rotation: 0,
      duration: 320,
      ease: 'Back.easeOut',
    });
    // 衝撃波リング
    const g = this.scene.add.graphics().setDepth(50);
    const col = this._inst.dimension >= 4 ? 0xffd700 : 0xffffff;
    g.lineStyle(2.5, col, 0.85);
    g.strokeCircle(this.x, this.y, 28);
    this.scene.tweens.add({
      targets: g, scaleX: 3.5, scaleY: 3.5, alpha: 0,
      duration: 450, ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  playD4SpawnAnim() {
    this.setScale(0);
    this.setAlpha(0);
    this.scene.tweens.chain({
      targets: this,
      tweens: [
        { scaleX: 1.35, scaleY: 1.35, alpha: 1, duration: 500, ease: 'Back.easeOut' },
        { scaleX: 1, scaleY: 1, duration: 250, ease: 'Power2' },
      ],
    });
    // 二重ゴールドリング
    for (let r = 0, i = 0; i < 2; i++, r += 28) {
      const g = this.scene.add.graphics().setDepth(50);
      g.lineStyle(3 - i, 0xffd700, 0.9 - i * 0.2);
      g.strokeCircle(this.x, this.y, 35 + r);
      this.scene.tweens.add({
        targets: g, scaleX: 4, scaleY: 4, alpha: 0,
        delay: i * 80,
        duration: 700 + i * 100, ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }
  }

  playAttackAnim(tx, ty, callback) {
    const ox = this.x;
    const oy = this.y;
    const dx = (tx - ox) * 0.3;
    const dy = (ty - oy) * 0.3;
    this.scene.tweens.chain({
      targets: this,
      tweens: [
        { x: ox + dx, y: oy + dy, duration: 150, ease: 'Power2' },
        { x: ox, y: oy, duration: 150, ease: 'Power2', onComplete: callback },
      ],
    });
  }

  playDeathAnim(callback) {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 350,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
        if (callback) callback();
      },
    });
  }

  playFusionAnim(callback) {
    // 吸い込み前の白フラッシュ
    const glow = this.scene.add.graphics().setDepth(60);
    glow.fillStyle(0xffffff, 0.6);
    glow.fillCircle(this.x, this.y, 36);
    this.scene.tweens.add({
      targets: glow, alpha: 0, scaleX: 0.1, scaleY: 0.1,
      duration: 200, ease: 'Power2',
      onComplete: () => glow.destroy(),
    });
    this.scene.tweens.add({
      targets: this,
      scaleX: 0, scaleY: 0,
      alpha: 0,
      rotation: Math.PI * 1.5,
      x: this.x,
      y: this.y - 10,
      duration: 450,
      ease: 'Power3.easeIn',
      onComplete: () => {
        this.destroy();
        if (callback) callback();
      },
    });
  }

  get instanceId()   { return this._inst.instanceId; }
  get cardInstance() { return this._inst; }
  static get CARD_W() { return CARD_W; }
  static get CARD_H() { return CARD_H; }
}
