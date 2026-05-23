const TYPE_COLORS = {
  delta: 0xe63946,
  sigma: 0x4895ef,
  omega: 0x4cc9a4,
  null:  0x888888,
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
  delta_1d: 'card_delta_1d',
  sigma_1d:  'card_sigma_1d',
  omega_1d:  'card_omega_1d',
  delta_2d: 'card_delta_2d',
  sigma_2d:  'card_sigma_2d',
  omega_2d:  'card_omega_2d',
  delta_3d: 'card_delta_3d',
  sigma_3d:  'card_sigma_3d',
  omega_3d:  'card_omega_3d',
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
    const is4D = inst.dimension === 4;
    const imgKey = CARD_IMG_KEYS[inst.id];
    const hasImage = !!(imgKey && this.scene.textures.exists(imgKey));
    this._hasImage = hasImage;

    if (hasImage) {
      // カード画像を背景として表示
      this._cardImg = this.scene.add.image(0, 0, imgKey).setDisplaySize(CARD_W, CARD_H);
      this.add(this._cardImg);

      // テキスト可読性のための半透明暗幕（上部: 名前用、下部: ステータス用）
      const overlay = this.scene.add.graphics();
      overlay.fillStyle(0x000000, 0.58);
      overlay.fillRect(-CARD_W / 2, -CARD_H / 2,      CARD_W, 18);  // top
      overlay.fillRect(-CARD_W / 2,  CARD_H / 2 - 52, CARD_W, 52);  // bottom
      this.add(overlay);

      // タイプカラーのボーダー
      this._bg = this.scene.add.graphics();
      this._drawBorder(typeColor, is4D, false);
      this.add(this._bg);
    } else {
      // 画像なし → プログラム描画カード
      this._bg = this.scene.add.graphics();
      this._drawBg(typeColor, is4D, false);
      this.add(this._bg);
    }

    // カード名（上部）
    const nameStyle = { fontSize: '9px', fill: '#ffffff', fontFamily: 'monospace', wordWrap: { width: CARD_W - 8 } };
    this._nameText = this.scene.add.text(0, -CARD_H / 2 + 3, inst.name, nameStyle).setOrigin(0.5, 0);
    this.add(this._nameText);

    // 次元ラベル（左上）
    const dimStyle = { fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold' };
    this._dimText = this.scene.add.text(-CARD_W / 2 + 3, -CARD_H / 2 + 3, inst.dimension + 'D', dimStyle).setOrigin(0, 0);
    this._dimText.setColor('#' + DIM_COLORS[inst.dimension].toString(16).padStart(6, '0'));
    this.add(this._dimText);

    // タイプシンボル（右上）
    if (inst.type) {
      const symStyle = { fontSize: '11px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' };
      this._typeSymbol = this.scene.add.text(CARD_W / 2 - 3, -CARD_H / 2 + 3, TYPE_SYMBOLS[inst.type], symStyle).setOrigin(1, 0);
      this.add(this._typeSymbol);
    }

    if (!is4D) {
      const statStyle = { fontSize: '9px', fill: '#ccddee', fontFamily: 'monospace' };
      this._atkText = this.scene.add.text(-CARD_W / 2 + 3, CARD_H / 2 - 48, `ATK:${inst.currentAtk}`, statStyle).setOrigin(0, 0);
      this._defText = this.scene.add.text(-CARD_W / 2 + 3, CARD_H / 2 - 36, `DEF:${inst.currentDef}`, statStyle).setOrigin(0, 0);
      this._hpText  = this.scene.add.text(-CARD_W / 2 + 3, CARD_H / 2 - 24, `HP:${inst.currentHp}/${inst.maxHp}`, statStyle).setOrigin(0, 0);
      this.add([this._atkText, this._defText, this._hpText]);

      this._hpBar = this.scene.add.graphics();
      this._drawHpBar();
      this.add(this._hpBar);
    } else {
      const effectStyle = {
        fontSize: '8px', fill: '#ffd700', fontFamily: 'monospace',
        wordWrap: { width: CARD_W - 8 }, align: 'center',
      };
      const label = inst.effect_desc ? inst.effect_desc.replace('フィールド効果：', '') : 'FIELD EFFECT';
      this._effectText = this.scene.add.text(0, 10, label, effectStyle).setOrigin(0.5, 0.5);
      this.add(this._effectText);
    }

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
    if (this._atkText) this._atkText.setText(`ATK:${inst.currentAtk}`);
    if (this._defText) this._defText.setText(`DEF:${inst.currentDef}`);
    if (this._hpText)  this._hpText.setText(`HP:${inst.currentHp}/${inst.maxHp}`);
    this._drawHpBar();
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
    this.setScale(0);
    this.setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1, scaleY: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
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
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      rotation: Math.PI,
      duration: 400,
      ease: 'Power2',
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
