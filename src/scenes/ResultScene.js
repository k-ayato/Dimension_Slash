export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data) {
    this.resultData = data;
  }

  create() {
    const { width, height } = this.scale;
    const { winner, stats } = this.resultData;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRect(0, 0, width, height);

    const isWin = winner === 'player';
    const resultColor = isWin ? '#ffd700' : '#e63946';
    const resultText = isWin ? '★ WIN ★' : '✗ LOSE ✗';

    const titleStyle = { fontSize: '64px', fill: resultColor, fontFamily: 'monospace', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6 };
    const title = this.add.text(width / 2, height / 2 - 180, resultText, titleStyle).setOrigin(0.5);
    this.tweens.add({ targets: title, scaleX: 1.05, scaleY: 1.05, yoyo: true, repeat: -1, duration: 800 });

    const statLines = [
      `与えたダメージ: ${stats.playerDamage}`,
      `融合回数: ${stats.playerFusions}`,
      `召喚回数: ${stats.playerSummons}`,
      `ターン数: ${stats.turns}`,
    ];
    const statStyle = { fontSize: '16px', fill: '#ccccdd', fontFamily: 'monospace' };
    let sy = height / 2 - 80;
    for (const line of statLines) {
      this.add.text(width / 2, sy, line, statStyle).setOrigin(0.5);
      sy += 30;
    }

    this._makeButton(width / 2 - 120, height / 2 + 120, 'もう一度', 0x4895ef, () => {
      this.scene.start('CoinScene');
    });
    this._makeButton(width / 2 + 120, height / 2 + 120, 'タイトルへ', 0x4cc9a4, () => {
      this.scene.start('TitleScene');
    });
  }

  _makeButton(x, y, label, color, onClick) {
    const bw = 180;
    const bh = 48;
    const btn = this.add.graphics();
    btn.fillStyle(color, 0.3);
    btn.lineStyle(2, color, 1);
    btn.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
    btn.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
    btn.x = x;
    btn.y = y;
    btn.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);

    const labelStyle = { fontSize: '16px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' };
    const text = this.add.text(x, y, label, labelStyle).setOrigin(0.5);

    btn.on('pointerover', () => { btn.setAlpha(1.5); this.input.setDefaultCursor('pointer'); });
    btn.on('pointerout', () => { btn.setAlpha(1); this.input.setDefaultCursor('default'); });
    btn.on('pointerdown', onClick);
    return { btn, text };
  }
}
