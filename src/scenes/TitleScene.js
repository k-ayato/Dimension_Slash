const W = 1280;
const H = 720;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  preload() {
    this.load.image('titleBg',   'assets/material/dimension_slash_title_bg.png');
    this.load.image('titleLogo', 'assets/material/logo_dimension_slash.png');
    this.load.image('btnStart',  'assets/material/btn_game_start.png');
    this.load.image('btnRules',  'assets/material/btn_rules.png');
  }

  create() {
    // 背景（1920×1080 → 画面全体に引き伸ばし）
    this.add.image(W / 2, H / 2, 'titleBg').setDisplaySize(W, H);

    // ロゴ（1200×320 → 700×187）、上部中央に配置してゆったり浮遊
    const logo = this.add.image(W / 2, 215, 'titleLogo').setDisplaySize(700, 187);
    this.tweens.add({
      targets: logo,
      y: logo.y - 9,
      yoyo: true, repeat: -1, duration: 2200, ease: 'Sine.easeInOut',
    });

    // ゲームスタートボタン（500×88 → 320×56）
    this._makeImgButton(W / 2, 460, 'btnStart', 320, 56, () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CoinScene'));
    });

    // ルール説明ボタン
    this._makeImgButton(W / 2, 540, 'btnRules', 320, 56, () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TutorialScene'));
    });

    // 属性三竦み（最下部）
    const infoStyle = { fontSize: '13px', fill: '#aaaacc', fontFamily: 'monospace' };
    this.add.text(W / 2, H - 24, 'δ Delta → σ Sigma → Ω Omega → δ Delta', infoStyle).setOrigin(0.5);

    // フェードイン
    this.cameras.main.fadeIn(350, 0, 0, 0);
  }

  _makeImgButton(x, y, key, dispW, dispH, onClick) {
    const img = this.add.image(x, y, key).setDisplaySize(dispW, dispH);
    img.setInteractive({ useHandCursor: true });

    img.on('pointerover',  () => img.setDisplaySize(dispW * 1.05, dispH * 1.05));
    img.on('pointerout',   () => img.setDisplaySize(dispW, dispH));
    img.on('pointerdown',  () => img.setDisplaySize(dispW * 0.96, dispH * 0.96));
    img.on('pointerup',    () => { img.setDisplaySize(dispW, dispH); onClick(); });

    return img;
  }
}
