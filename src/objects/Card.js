const TYPE_COLORS = {
  delta: 0xe63946,
  sigma: 0x4895ef,
  omega: 0x4cc9a4,
  null: 0x888888,
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

    this._bg = this.scene.add.graphics();
    this._drawBg(typeColor, is4D, false);
    this.add(this._bg);

    const nameStyle = { fontSize: '10px', fill: '#ffffff', fontFamily: 'monospace', wordWrap: { width: CARD_W - 8 } };
    this._nameText = this.scene.add.text(0, -CARD_H / 2 + 6, inst.name, nameStyle).setOrigin(0.5, 0);
    this.add(this._nameText);

    const dimStyle = { fontSize: '11px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' };
    const dimLabel = inst.dimension + 'D';
    this._dimText = this.scene.add.text(-CARD_W / 2 + 4, -CARD_H / 2 + 4, dimLabel, dimStyle).setOrigin(0, 0);
    this._dimText.setColor('#' + DIM_COLORS[inst.dimension].toString(16).padStart(6, '0'));
    this.add(this._dimText);

    if (inst.type) {
      const symStyle = { fontSize: '13px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' };
      this._typeSymbol = this.scene.add.text(CARD_W / 2 - 4, -CARD_H / 2 + 4, TYPE_SYMBOLS[inst.type], symStyle).setOrigin(1, 0);
      this.add(this._typeSymbol);
    }

    if (!is4D) {
      const statStyle = { fontSize: '10px', fill: '#ffffff', fontFamily: 'monospace' };
      this._atkText = this.scene.add.text(-CARD_W / 2 + 4, CARD_H / 2 - 36, `ATK:${inst.currentAtk}`, statStyle).setOrigin(0, 0);
      this._defText = this.scene.add.text(-CARD_W / 2 + 4, CARD_H / 2 - 24, `DEF:${inst.currentDef}`, statStyle).setOrigin(0, 0);
      this._hpText = this.scene.add.text(-CARD_W / 2 + 4, CARD_H / 2 - 12, `HP:${inst.currentHp}/${inst.maxHp}`, statStyle).setOrigin(0, 0);
      this.add([this._atkText, this._defText, this._hpText]);

      this._hpBar = this.scene.add.graphics();
      this._drawHpBar();
      this.add(this._hpBar);
    } else {
      const effectStyle = { fontSize: '9px', fill: '#ffd700', fontFamily: 'monospace', wordWrap: { width: CARD_W - 8 }, align: 'center' };
      const label = inst.effect_desc ? inst.effect_desc.replace('フィールド効果：', '') : 'FIELD EFFECT';
      this._effectText = this.scene.add.text(0, 10, label, effectStyle).setOrigin(0.5, 0.5);
      this.add(this._effectText);
    }

    this._glow = this.scene.add.graphics();
    this.add(this._glow);

    this.setSize(CARD_W, CARD_H);
    this.setInteractive();
  }

  _drawBg(color, is4D, attacked) {
    const g = this._bg;
    g.clear();
    const alpha = attacked ? 0.5 : 1.0;
    g.fillStyle(color, alpha);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);

    if (is4D) {
      g.lineStyle(2, 0xffd700, 1);
    } else {
      g.lineStyle(1, 0xffffff, 0.5);
    }
    g.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
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
    const by = CARD_H / 2 - 46;
    g.fillStyle(0x444444, 1);
    g.fillRect(bx, by, barW, barH);
    const fillColor = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffff00 : 0xff4444;
    g.fillStyle(fillColor, 1);
    g.fillRect(bx, by, Math.floor(barW * ratio), barH);
  }

  updateDisplay() {
    const inst = this._inst;
    if (this._atkText) this._atkText.setText(`ATK:${inst.currentAtk}`);
    if (this._defText) this._defText.setText(`DEF:${inst.currentDef}`);
    if (this._hpText) this._hpText.setText(`HP:${inst.currentHp}/${inst.maxHp}`);
    this._drawHpBar();
    if (this._attacked) {
      const typeColor = TYPE_COLORS[inst.type] ?? TYPE_COLORS.null;
      this._drawBg(typeColor, inst.dimension === 4, true);
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
    this._drawBg(typeColor, inst.dimension === 4, val);
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

  get instanceId() { return this._inst.instanceId; }
  get cardInstance() { return this._inst; }
  static get CARD_W() { return CARD_W; }
  static get CARD_H() { return CARD_H; }
}
