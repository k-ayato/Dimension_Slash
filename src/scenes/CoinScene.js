const W = 1280;
const H = 720;
const CW = 160;
const CH = 224;

export class CoinScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CoinScene' });
  }

  preload() {
    this.load.image('coinBg', 'assets/material/backGround.png');
  }

  create() {
    this.add.image(W / 2, H / 2, 'coinBg').setDisplaySize(W, H);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.55);
    overlay.fillRect(0, 0, W, H);

    this.add.text(W / 2, 110, '先 行 ・ 後 攻 決 定', {
      fontSize: '30px', fill: '#ccccee', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(W / 2, 158, 'D0カードをフリップして決めます', {
      fontSize: '15px', fill: '#8888aa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this._result = Math.random() < 0.5 ? 'player' : 'ai';

    this._card = this.add.container(W / 2, H / 2);
    this._buildD0Content();

    this._floatTween = this.tweens.add({
      targets: this._card,
      y: H / 2 - 14,
      yoyo: true, repeat: -1, duration: 1900, ease: 'Sine.easeInOut',
    });

    this.cameras.main.fadeIn(450, 0, 0, 0);
    this.time.delayedCall(1400, () => this._startFlip());
  }

  _buildD0Content() {
    this._card.removeAll(true);

    const body = this.add.graphics();
    body.fillStyle(0x333355, 1);
    body.lineStyle(2, 0x9999bb, 1);
    body.fillRoundedRect(-CW / 2, -CH / 2, CW, CH, 12);
    body.strokeRoundedRect(-CW / 2, -CH / 2, CW, CH, 12);

    const inner = this.add.graphics();
    inner.fillStyle(0x555577, 0.35);
    inner.fillRoundedRect(-CW / 2 + 8, -CH / 2 + 8, CW - 16, CH - 16, 8);

    const dimText = this.add.text(0, -38, '0', {
      fontSize: '64px', fill: '#777799', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    const labelA = this.add.text(0, 30, 'NULL', {
      fontSize: '14px', fill: '#777799', fontFamily: 'monospace', letterSpacing: 6,
    }).setOrigin(0.5);
    const labelB = this.add.text(0, 52, 'DIMENSION', {
      fontSize: '11px', fill: '#555577', fontFamily: 'monospace', letterSpacing: 3,
    }).setOrigin(0.5);

    this._card.add([body, inner, dimText, labelA, labelB]);
  }

  _buildRevealContent() {
    this._card.removeAll(true);

    const isPlayer = this._result === 'player';
    const mainLabel = isPlayer ? '先行' : '後攻';
    const fillCol   = isPlayer ? 0x221a00 : 0x1a0012;
    const lineCol   = isPlayer ? 0xffd700 : 0xe63946;
    const textCol   = isPlayer ? '#ffd700' : '#e63946';

    const body = this.add.graphics();
    body.fillStyle(fillCol, 1);
    body.lineStyle(3, lineCol, 1);
    body.fillRoundedRect(-CW / 2, -CH / 2, CW, CH, 12);
    body.strokeRoundedRect(-CW / 2, -CH / 2, CW, CH, 12);

    const accent = this.add.graphics();
    accent.lineStyle(1, lineCol, 0.4);
    accent.strokeRoundedRect(-CW / 2 + 7, -CH / 2 + 7, CW - 14, CH - 14, 8);

    const mainText = this.add.text(0, -18, mainLabel, {
      fontSize: '56px', fill: textCol, fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);
    const subText = this.add.text(0, 54, isPlayer ? 'あなたが先行' : '相手が先行', {
      fontSize: '13px', fill: '#ccccdd', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this._card.add([body, accent, mainText, subText]);
  }

  _startFlip() {
    this._floatTween.stop();
    this._card.y = H / 2;

    const durations = [70, 70, 75, 95, 125, 165, 220, 295];
    const TOTAL = durations.length;
    const revealAt = Math.floor(TOTAL / 2);
    let flipCount = 0;

    const doFlip = () => {
      if (flipCount >= TOTAL) {
        this._revealResult();
        return;
      }

      const dur = durations[flipCount];
      const isReveal = flipCount === revealAt;

      this.tweens.add({
        targets: this._card,
        scaleX: 0,
        duration: Math.max(dur / 2, 30),
        ease: 'Sine.easeIn',
        onComplete: () => {
          if (isReveal) this._buildRevealContent();
          this.tweens.add({
            targets: this._card,
            scaleX: 1,
            duration: Math.max(dur / 2, 30),
            ease: 'Sine.easeOut',
            onComplete: () => {
              flipCount++;
              doFlip();
            },
          });
        },
      });
    };

    doFlip();
  }

  _revealResult() {
    const isPlayer = this._result === 'player';
    const lineCol = isPlayer ? 0xffd700 : 0xe63946;
    const r = (lineCol >> 16) & 0xff;
    const g = (lineCol >> 8) & 0xff;
    const b = lineCol & 0xff;

    this.cameras.main.flash(700, r, g, b);

    // Burst particles
    for (let i = 0; i < 14; i++) {
      const p = this.add.graphics();
      p.fillStyle(lineCol, 0.85);
      p.fillCircle(0, 0, Phaser.Math.Between(4, 9));
      p.setPosition(W / 2, H / 2);
      const angle = (i / 14) * Math.PI * 2;
      const dist  = Phaser.Math.Between(100, 210);
      this.tweens.add({
        targets: p,
        x: W / 2 + Math.cos(angle) * dist,
        y: H / 2 + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.3, scaleY: 0.3,
        duration: Phaser.Math.Between(600, 950),
        ease: 'Power2.easeOut',
        onComplete: () => p.destroy(),
      });
    }

    // Expanding ring
    const ring = this.add.graphics();
    ring.lineStyle(5, lineCol, 0.8);
    ring.strokeCircle(0, 0, 80);
    ring.setPosition(W / 2, H / 2);
    this.tweens.add({
      targets: ring,
      scaleX: 2.8, scaleY: 2.8,
      alpha: 0,
      duration: 1000,
      ease: 'Power2.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Announce text
    const annoText = isPlayer ? 'あなたが先行です！' : '相手が先行です';
    const anno = this.add.text(W / 2, H / 2 + 145, annoText, {
      fontSize: '22px',
      fill: isPlayer ? '#ffd700' : '#e63946',
      fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: anno, alpha: 1, duration: 500, delay: 250 });

    // Resume float
    this._floatTween = this.tweens.add({
      targets: this._card,
      y: H / 2 - 14,
      yoyo: true, repeat: -1, duration: 1900, ease: 'Sine.easeInOut',
    });

    this.time.delayedCall(950, () => this._showStartButton());
  }

  _showStartButton() {
    const bw = 240, bh = 54;
    const by = H / 2 + 208;

    const btn = this.add.graphics();
    btn.fillStyle(0x4895ef, 0.25);
    btn.lineStyle(2, 0x4895ef, 1);
    btn.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);
    btn.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);
    btn.setPosition(W / 2, by);
    btn.setInteractive(
      new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh),
      Phaser.Geom.Rectangle.Contains
    );
    btn.setAlpha(0);

    const label = this.add.text(W / 2, by, 'ゲームを開始する', {
      fontSize: '19px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [btn, label], alpha: 1, duration: 500 });

    btn.on('pointerover', () => { btn.setAlpha(1.4); this.input.setDefaultCursor('pointer'); });
    btn.on('pointerout',  () => { btn.setAlpha(1);   this.input.setDefaultCursor('default'); });
    btn.on('pointerdown', () => {
      this.input.setDefaultCursor('default');
      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene', { firstPlayer: this._result });
      });
    });
  }
}
