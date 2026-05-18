export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const { width, height } = this.scale;
    this._drawBg(width, height);

    // ロゴ
    const titleStyle = {
      fontSize: '56px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#4895ef',
      strokeThickness: 4,
    };
    const title = this.add.text(width / 2, height / 2 - 160, 'DIMENSION', titleStyle).setOrigin(0.5);
    const title2 = this.add.text(width / 2, height / 2 - 90, 'SLASH', {
      ...titleStyle,
      fontSize: '72px',
      fill: '#ffd700',
      stroke: '#e63946',
    }).setOrigin(0.5);

    this.tweens.add({ targets: [title, title2], y: '-=8', yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });

    const subStyle = { fontSize: '14px', fill: '#aaaacc', fontFamily: 'monospace' };
    this.add.text(width / 2, height / 2 - 20, '次元斬りカードゲーム', subStyle).setOrigin(0.5);

    this._makeButton(width / 2, height / 2 + 60, 'ゲームスタート', 0x4895ef, () => {
      this.scene.start('GameScene');
    });

    this._makeButton(width / 2, height / 2 + 130, 'ルール説明', 0x4cc9a4, () => {
      this.scene.start('RuleScene');
    });

    // 三竦み表示
    const infoStyle = { fontSize: '12px', fill: '#666688', fontFamily: 'monospace' };
    this.add.text(width / 2, height - 30, 'δ Delta → σ Sigma → Ω Omega → δ Delta', infoStyle).setOrigin(0.5);
  }

  _drawBg(width, height) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x0d1b2a, 0x0d1b2a, 1);
    bg.fillRect(0, 0, width, height);

    // 星
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 1.5;
      const a = 0.3 + Math.random() * 0.7;
      bg.fillStyle(0xffffff, a);
      bg.fillCircle(x, y, r);
    }
  }

  _makeButton(x, y, label, color, onClick) {
    const bw = 240;
    const bh = 48;
    const btn = this.add.graphics();
    btn.fillStyle(color, 0.2);
    btn.lineStyle(2, color, 1);
    btn.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
    btn.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
    btn.x = x;
    btn.y = y;
    btn.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);

    const labelStyle = { fontSize: '18px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' };
    const text = this.add.text(x, y, label, labelStyle).setOrigin(0.5);

    btn.on('pointerover', () => {
      btn.clear();
      btn.fillStyle(color, 0.6);
      btn.lineStyle(2, color, 1);
      btn.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
      btn.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
      this.input.setDefaultCursor('pointer');
    });
    btn.on('pointerout', () => {
      btn.clear();
      btn.fillStyle(color, 0.2);
      btn.lineStyle(2, color, 1);
      btn.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
      btn.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
      this.input.setDefaultCursor('default');
    });
    btn.on('pointerdown', onClick);
    return { btn, text };
  }
}
