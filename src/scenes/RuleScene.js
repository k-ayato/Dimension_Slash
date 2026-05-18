export class RuleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RuleScene' });
  }

  create() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRect(0, 0, width, height);

    const titleStyle = { fontSize: '28px', fill: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold' };
    this.add.text(width / 2, 30, 'RULE / ルール説明', titleStyle).setOrigin(0.5, 0);

    const sections = [
      {
        title: '【フィールド構造】',
        lines: [
          '特別フィールド　… 4Dカードのみ（最大1体）',
          '対戦フィールド　… 0D〜3D（最大5体）',
          'エネルギーゾーン … 0Dを毎ターン1体無料召喚',
        ],
      },
      {
        title: '【ターンの流れ】',
        lines: [
          '① ドロー（1枚。手札上限10枚）',
          '② メインフェーズ',
          '   ・通常召喚: 0Dを対戦フィールドへ（1ターン1体）',
          '   ・融合: 同次元2体 + 手札の上位カード → 次元昇格',
          '   ・連続融合可能（回数制限なし）',
          '③ 攻撃フェーズ（各カード1回・召喚酔いなし）',
          '④ ターン終了',
        ],
      },
      {
        title: '【次元相性（縦軸）】',
        lines: [
          '次元差 +1以上（高次元が攻撃） … ×1.5',
          '次元差  0（同次元）              … ×1.0',
          '次元差 -1以下（低次元が攻撃） … ×0.5',
        ],
      },
      {
        title: '【タイプ相性（横軸・三竦み）】',
        lines: [
          'δ Delta → σ Sigma → Ω Omega → δ Delta',
          '有利タイプ攻撃 ×1.2 / 不利タイプ攻撃 ×0.8',
        ],
      },
      {
        title: '【ダメージ計算】',
        lines: [
          'ダメージ = ATK × 次元倍率 × タイプ倍率 × (1 - DEF/10)',
          'カードHP超過分はプレイヤーHPに貫通',
          'プレイヤーHP初期値: 20',
        ],
      },
      {
        title: '【4Dフィールド効果】',
        lines: [
          '3D+3D融合 → 4Dが特別フィールドへ（後出し上書き可）',
          'Delta 4D: 次元崩壊 … 全カードATK+2',
          'Sigma 4D: 次元加速 … 毎ターン+1ドロー',
          'Omega 4D: 次元要塞 … 受けるダメージ半減',
        ],
      },
    ];

    let y = 80;
    const sectionTitleStyle = { fontSize: '14px', fill: '#4895ef', fontFamily: 'monospace', fontStyle: 'bold' };
    const lineStyle = { fontSize: '12px', fill: '#ccccdd', fontFamily: 'monospace' };

    for (const sec of sections) {
      this.add.text(40, y, sec.title, sectionTitleStyle);
      y += 22;
      for (const line of sec.lines) {
        this.add.text(60, y, line, lineStyle);
        y += 18;
      }
      y += 8;
    }

    this._makeButton(width / 2, height - 35, 'タイトルへ戻る', 0x4895ef, () => {
      this.scene.start('TitleScene');
    });
  }

  _makeButton(x, y, label, color, onClick) {
    const bw = 200;
    const bh = 40;
    const btn = this.add.graphics();
    btn.fillStyle(color, 0.3);
    btn.lineStyle(2, color, 1);
    btn.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    btn.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    btn.x = x;
    btn.y = y;
    btn.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);

    const labelStyle = { fontSize: '15px', fill: '#ffffff', fontFamily: 'monospace' };
    const text = this.add.text(x, y, label, labelStyle).setOrigin(0.5);

    btn.on('pointerover', () => { btn.setAlpha(1.4); this.input.setDefaultCursor('pointer'); });
    btn.on('pointerout', () => { btn.setAlpha(1); this.input.setDefaultCursor('default'); });
    btn.on('pointerdown', onClick);
    return { btn, text };
  }
}
