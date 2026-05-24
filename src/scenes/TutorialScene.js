const W = 1280;
const H = 720;
const CARD_W  = 86;
const CARD_H  = 120;
const AI_Y    = 168;   // 敵フィールド中心
const PL_Y    = 472;   // 自フィールド中心
const HAND_Y  = 322;   // 手札デモ中心（フィールド間）
const CX      = W / 2;
const SLOTS_X = [CX - 192, CX - 96, CX, CX + 96, CX + 192]; // 5スロット
const COL_TYPE = { delta: 0xe63946, sigma: 0x4895ef, omega: 0x4cc9a4 };
const COL_ZERO  = 0x666677;

export class TutorialScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TutorialScene' });
  }

  preload() {
    this.load.image('tutBg', 'assets/material/backGround.png');
  }

  create() {
    // ── 背景 ──
    this.add.image(CX, H / 2, 'tutBg').setDisplaySize(W, H);
    const ov = this.add.graphics();
    ov.fillStyle(0x000000, 0.52);
    ov.fillRect(0, 0, W, H);

    // ── フィールドゾーン（固定）──
    this._drawFieldZones();

    // ── 敵 HP 表示（固定・左上）──
    const hpBgA = this.add.graphics();
    hpBgA.fillStyle(0x1a0505, 0.88);
    hpBgA.lineStyle(2, 0x883344, 0.75);
    hpBgA.fillRoundedRect(8, 8, 200, 44, 8);
    hpBgA.strokeRoundedRect(8, 8, 200, 44, 8);
    this._aiHpTxt = this.add.text(108, 30, 'Enemy HP : 30', {
      fontSize: '15px', fill: '#ff4455', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // ── メッセージボックス（固定・下部）──
    const MB_X = 8, MB_Y = 546, MB_W = W - 16, MB_H = 166;
    const msgBg = this.add.graphics();
    msgBg.fillStyle(0x060812, 0.92);
    msgBg.lineStyle(2, 0x334466, 0.7);
    msgBg.fillRoundedRect(MB_X, MB_Y, MB_W, MB_H, 10);
    msgBg.strokeRoundedRect(MB_X, MB_Y, MB_W, MB_H, 10);

    this._msgTitle = this.add.text(MB_X + 18, MB_Y + 14, '', {
      fontSize: '18px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0, 0);
    this._msgSub = this.add.text(MB_X + 18, MB_Y + 46, '', {
      fontSize: '13px', fill: '#9999cc', fontFamily: 'monospace',
      wordWrap: { width: MB_W - 200 },
    }).setOrigin(0, 0);
    this._stepInd = this.add.text(MB_X + MB_W - 12, MB_Y + 14, '', {
      fontSize: '11px', fill: '#445566', fontFamily: 'monospace',
    }).setOrigin(1, 0);

    // ── 次へボタン（固定グラフィクスを再利用）──
    this._nextGfx = this.add.graphics();
    this._nextLbl = this.add.text(0, 0, '', {
      fontSize: '15px', fill: '#88ccff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this._nextActive = false;

    // ── タイトルへ（左上リンク）──
    const backTxt = this.add.text(W - 10, 10, 'タイトルへ戻る', {
      fontSize: '11px', fill: '#445566', fontFamily: 'monospace',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    backTxt.on('pointerover', () => backTxt.setStyle({ fill: '#8899bb' }));
    backTxt.on('pointerout',  () => backTxt.setStyle({ fill: '#445566' }));
    backTxt.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
    });

    // ── 動的要素 ──
    this._dyn = [];
    this._totalSteps = 7;
    this._stepIdx = 0;

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.time.delayedCall(500, () => this._runStep(0));
  }

  // ─────────────────────────────
  // フィールドゾーン（固定背景）
  // ─────────────────────────────
  _drawFieldZones() {
    const zoneStyle = (col, fillAlpha) => {
      const g = this.add.graphics();
      g.fillStyle(col, fillAlpha);
      g.lineStyle(1, col, 0.4);
      return g;
    };

    // 敵フィールド
    const fA = zoneStyle(0x552222, 0.35);
    fA.fillRoundedRect(CX - 276, AI_Y - CARD_H / 2 - 6, 552, CARD_H + 12, 8);
    fA.strokeRoundedRect(CX - 276, AI_Y - CARD_H / 2 - 6, 552, CARD_H + 12, 8);
    this.add.text(CX, AI_Y - CARD_H / 2 - 3, '─── 敵 フ ィ ー ル ド ───', {
      fontSize: '10px', fill: '#664444', fontFamily: 'monospace',
    }).setOrigin(0.5, 1);

    // 手札エリア（デモ用）
    const fH = zoneStyle(0x224422, 0.20);
    fH.strokeRoundedRect(CX - 220, HAND_Y - CARD_H / 2 - 4, 440, CARD_H + 8, 6);
    this.add.text(CX, HAND_Y - CARD_H / 2 - 3, '─── 手  札 ───', {
      fontSize: '10px', fill: '#446644', fontFamily: 'monospace',
    }).setOrigin(0.5, 1);

    // 自フィールド
    const fP = zoneStyle(0x222255, 0.35);
    fP.fillRoundedRect(CX - 276, PL_Y - CARD_H / 2 - 6, 552, CARD_H + 12, 8);
    fP.strokeRoundedRect(CX - 276, PL_Y - CARD_H / 2 - 6, 552, CARD_H + 12, 8);
    this.add.text(CX, PL_Y + CARD_H / 2 + 3, '─── 自 フ ィ ー ル ド ───', {
      fontSize: '10px', fill: '#445577', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
  }

  // ─────────────────────────────
  // カード作成ヘルパー
  // ─────────────────────────────
  _makeCard(x, y, dim, type) {
    const col = (dim === 0 || !type) ? COL_ZERO : (COL_TYPE[type] ?? COL_ZERO);

    const body = this.add.graphics();
    body.fillStyle(col, 0.9);
    body.lineStyle(2, 0xffffff, 0.20);
    body.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    body.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);

    const dimTxt = this.add.text(0, -28, `${dim}D`, {
      fontSize: '26px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    const items = [body, dimTxt];
    if (type) {
      items.push(this.add.text(0, 10, type.toUpperCase(), {
        fontSize: '9px', fill: 'rgba(255,255,255,0.65)', fontFamily: 'monospace',
      }).setOrigin(0.5));
    }

    const con = this.add.container(x, y, items);
    con.setAlpha(0);
    return con;
  }

  // ─────────────────────────────
  // 動的要素の登録・クリア
  // ─────────────────────────────
  _reg(obj) { this._dyn.push(obj); return obj; }

  _clearDyn() {
    for (const e of this._dyn) {
      if (e && e.active) e.destroy();
    }
    this._dyn = [];
  }

  // ─────────────────────────────
  // メッセージ・ボタン
  // ─────────────────────────────
  _setMsg(title, sub = '') {
    this._msgTitle.setText(title);
    this._msgSub.setText(sub);
  }

  _showNext(label = '次 へ  ▶') {
    const bw = 150, bh = 42;
    const bx = W - 8 - bw / 2 - 8;
    const by = 546 + 166 / 2 + 10; // メッセージボックス内・右寄り

    this._nextGfx.clear();
    this._nextGfx.fillStyle(0x4895ef, 0.28);
    this._nextGfx.lineStyle(2, 0x4895ef, 0.85);
    this._nextGfx.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
    this._nextGfx.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
    this._nextGfx.setInteractive(
      new Phaser.Geom.Rectangle(bx - bw / 2, by - bh / 2, bw, bh),
      Phaser.Geom.Rectangle.Contains
    );

    this._nextLbl.setPosition(bx, by).setText(label).setAlpha(1);
    this._nextActive = true;

    this._nextGfx.removeAllListeners();
    this._nextGfx.on('pointerover', () => { this._nextGfx.setAlpha(1.5); this.input.setDefaultCursor('pointer'); });
    this._nextGfx.on('pointerout',  () => { this._nextGfx.setAlpha(1);   this.input.setDefaultCursor('default'); });
    this._nextGfx.on('pointerdown', () => {
      if (!this._nextActive) return;
      this._nextActive = false;
      this.input.setDefaultCursor('default');
      this._stepIdx++;
      this._runStep(this._stepIdx);
    });
  }

  _hideNext() {
    this._nextGfx.clear();
    this._nextGfx.removeAllListeners();
    this._nextLbl.setAlpha(0);
    this._nextActive = false;
  }

  // ─────────────────────────────
  // ステップ制御
  // ─────────────────────────────
  _runStep(idx) {
    this._clearDyn();
    this._hideNext();
    this._stepInd.setText(`STEP  ${idx + 1} / ${this._totalSteps}`);

    const steps = [
      () => this._s0_intro(),
      () => this._s1_summon(),
      () => this._s2_fusion2(),
      () => this._s3_fusion3(),
      () => this._s4_attack(),
      () => this._s5_win(),
      () => this._s6_end(),
    ];
    if (idx < steps.length) steps[idx]();
  }

  // ─────────────────────────────
  // STEP 0 : イントロ
  // ─────────────────────────────
  _s0_intro() {
    this._setMsg(
      '◆  Dimension Slash チュートリアル',
      'カードを召喚・融合させて相手のHPを0にした方が勝ちです。\nこのチュートリアルでは基本の流れを順番に解説します。'
    );

    const mkArrow = (y, col, txt, delay) => {
      const t = this._reg(this.add.text(CX, y, txt, {
        fontSize: '14px', fill: col, fontFamily: 'monospace',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0));
      this.tweens.add({ targets: t, alpha: 1, duration: 500, delay });
      return t;
    };

    mkArrow(AI_Y,   '#cc5555', '← ─ ─  敵フィールド  ─ ─ →', 300);
    mkArrow(HAND_Y, '#559944', '← ─ ─  手  札  ─ ─ →',       600);
    mkArrow(PL_Y,   '#5588cc', '← ─ ─  自フィールド  ─ ─ →', 900);

    this.time.delayedCall(1600, () => this._showNext());
  }

  // ─────────────────────────────
  // STEP 1 : 召喚
  // ─────────────────────────────
  _s1_summon() {
    this._setMsg(
      '◆  カード召喚',
      '「0D SUMMON」ボタンで0Dカードをフィールドに召喚します。\n先行1T目：最大 1体　／　以降：最大 3体'
    );

    // 召喚ボタン模型
    const btnBg = this._reg(this.add.graphics());
    btnBg.fillStyle(0x00aaee, 0.15);
    btnBg.lineStyle(2, 0x00ccff, 0.7);
    btnBg.fillRoundedRect(W - 196, H / 2 - 64, 178, 90, 10);
    btnBg.strokeRoundedRect(W - 196, H / 2 - 64, 178, 90, 10);
    btnBg.setAlpha(0);

    const btnTxt = this._reg(this.add.text(W - 107, H / 2 - 18, '0D  SUMMON', {
      fontSize: '17px', fill: '#00ddff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5).setAlpha(0));

    this.tweens.add({ targets: [btnBg, btnTxt], alpha: 1, duration: 400 });

    // ボタン点滅
    this.time.delayedCall(700, () => {
      this.tweens.add({
        targets: [btnBg, btnTxt], alpha: 0.35,
        yoyo: true, repeat: 2, duration: 380,
        onComplete: () => {
          // 0D カードがフィールドに落ちてくる
          const card = this._reg(this._makeCard(SLOTS_X[2], PL_Y - 50, 0, null));
          this.tweens.add({
            targets: card, y: PL_Y, alpha: 1,
            duration: 520, ease: 'Back.easeOut',
            onComplete: () => {
              // 「先行1T目：1体まで」ラベル
              const lim = this._reg(this.add.text(CX, PL_Y + CARD_H / 2 + 22,
                '▲ 先行1ターン目：1体まで', {
                  fontSize: '12px', fill: '#88aacc', fontFamily: 'monospace',
                }).setOrigin(0.5).setAlpha(0));
              this.tweens.add({ targets: lim, alpha: 1, duration: 400,
                onComplete: () => this._showNext(),
              });
            }
          });
        }
      });
    });
  }

  // ─────────────────────────────
  // STEP 2 : 融合パターンA（D×2 + D+1手札）
  // ─────────────────────────────
  _s2_fusion2() {
    this._setMsg(
      '◆  融合召喚 パターンA  ─  2枚融合',
      '同じDのカード × 2枚  ＋  手札の「1つ上のD」カード  →  融合召喚！\n例：0D × 2枚  ＋  手札 1D  →  1D カード召喚'
    );

    const cA = this._reg(this._makeCard(SLOTS_X[1], PL_Y, 0, null));
    const cB = this._reg(this._makeCard(SLOTS_X[3], PL_Y, 0, null));
    const cH = this._reg(this._makeCard(SLOTS_X[2], HAND_Y, 1, 'sigma'));

    this.tweens.add({ targets: [cA, cB], alpha: 1, duration: 380 });
    this.tweens.add({ targets: cH, alpha: 1, duration: 380, delay: 250 });

    // 説明ラベル
    const mkLbl = (x, y, txt, col, delay) => {
      const t = this._reg(this.add.text(x, y, txt, {
        fontSize: '11px', fill: col, fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setAlpha(0));
      this.tweens.add({ targets: t, alpha: 1, duration: 300, delay });
      return t;
    };
    mkLbl(SLOTS_X[1], PL_Y - CARD_H / 2 - 6, '× フィールド', '#aaaacc', 450);
    mkLbl(SLOTS_X[3], PL_Y - CARD_H / 2 - 6, '× フィールド', '#aaaacc', 550);
    mkLbl(SLOTS_X[2], HAND_Y - CARD_H / 2 - 6, '＋ 手 札', '#88cc88', 650);

    // 「→」テキスト
    const arrow = this._reg(this.add.text(CX, (PL_Y + HAND_Y) / 2, '↑  融 合 ！', {
      fontSize: '14px', fill: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0));
    this.tweens.add({ targets: arrow, alpha: 1, duration: 300, delay: 900 });

    this.time.delayedCall(1600, () =>
      this._fusionAnim([cA, cB, cH], SLOTS_X[2], PL_Y, 1, 'sigma', COL_TYPE.sigma,
        () => this._showNext())
    );
  }

  // ─────────────────────────────
  // STEP 3 : 融合パターンB（D×3 + D+2手札）
  // ─────────────────────────────
  _s3_fusion3() {
    this._setMsg(
      '◆  融合召喚 パターンB  ─  3枚融合',
      '2つ下のDカード × 3枚  ＋  手札の目標Dカード  →  融合召喚！\n例：0D × 3枚  ＋  手札 2D  →  2D カード召喚'
    );

    const cA = this._reg(this._makeCard(SLOTS_X[1], PL_Y, 0, null));
    const cB = this._reg(this._makeCard(SLOTS_X[2], PL_Y, 0, null));
    const cC = this._reg(this._makeCard(SLOTS_X[3], PL_Y, 0, null));
    const cH = this._reg(this._makeCard(SLOTS_X[2], HAND_Y, 2, 'delta'));

    this.tweens.add({ targets: [cA, cB, cC], alpha: 1, duration: 380 });
    this.tweens.add({ targets: cH, alpha: 1, duration: 380, delay: 250 });

    const mkLbl = (x, y, txt, col, delay) => {
      const t = this._reg(this.add.text(x, y, txt, {
        fontSize: '11px', fill: col, fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setAlpha(0));
      this.tweens.add({ targets: t, alpha: 1, duration: 300, delay });
      return t;
    };
    mkLbl(SLOTS_X[1], PL_Y - CARD_H / 2 - 6, '× フィールド', '#aaaacc', 450);
    mkLbl(SLOTS_X[2], PL_Y - CARD_H / 2 - 6, '× フィールド', '#aaaacc', 550);
    mkLbl(SLOTS_X[3], PL_Y - CARD_H / 2 - 6, '× フィールド', '#aaaacc', 650);
    mkLbl(SLOTS_X[2], HAND_Y - CARD_H / 2 - 6, '＋ 手 札 (2つ上)', '#88cc88', 750);

    const arrow = this._reg(this.add.text(CX, (PL_Y + HAND_Y) / 2, '↑  3枚融合 ！', {
      fontSize: '14px', fill: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0));
    this.tweens.add({ targets: arrow, alpha: 1, duration: 300, delay: 950 });

    this.time.delayedCall(1700, () =>
      this._fusionAnim([cA, cB, cC, cH], SLOTS_X[2], PL_Y, 2, 'delta', COL_TYPE.delta,
        () => this._showNext())
    );
  }

  // ─────────────────────────────
  // 融合アニメーション共通
  // ─────────────────────────────
  _fusionAnim(cards, tx, ty, dim, type, col, onDone) {
    for (const c of cards) {
      this.tweens.add({ targets: c, x: tx, y: ty, alpha: 0, duration: 400, ease: 'Power2' });
    }

    this.time.delayedCall(440, () => {
      // フラッシュ
      const flash = this._reg(this.add.graphics());
      flash.fillStyle(col, 1);
      flash.fillCircle(tx, ty, 76);
      this.tweens.add({ targets: flash, alpha: 0, scaleX: 2.5, scaleY: 2.5,
        duration: 460, ease: 'Power2.easeOut' });

      // リング
      const ring = this._reg(this.add.graphics());
      ring.lineStyle(4, col, 0.8);
      ring.strokeCircle(tx, ty, 50);
      this.tweens.add({ targets: ring, alpha: 0, scaleX: 2.8, scaleY: 2.8,
        duration: 500, ease: 'Power2.easeOut' });

      // 結果カード
      const result = this._reg(this._makeCard(tx, ty, dim, type));
      result.setScale(1.25);
      this.tweens.add({
        targets: result, alpha: 1, scaleX: 1, scaleY: 1,
        duration: 320, ease: 'Back.easeOut',
        onComplete: () => { if (onDone) onDone(); }
      });
    });
  }

  // ─────────────────────────────
  // STEP 4 : 攻撃
  // ─────────────────────────────
  _s4_attack() {
    this._setMsg(
      '◆  攻撃フェーズ',
      '攻撃フェーズで自カードを選んで攻撃します。\n敵フィールドが空のとき、相手HP へ直接ダメージを与えられます！'
    );

    // プレイヤーカード（1D sigma）
    const plCard = this._reg(this._makeCard(SLOTS_X[2], PL_Y, 1, 'sigma'));
    this.tweens.add({ targets: plCard, alpha: 1, duration: 380, delay: 200 });

    // 敵フィールドが空の表示
    const emptyTxt = this._reg(this.add.text(CX, AI_Y, '（敵フィールド  空）', {
      fontSize: '13px', fill: '#664444', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0));
    this.tweens.add({ targets: emptyTxt, alpha: 1, duration: 380, delay: 400 });

    // 選択ハイライト
    this.time.delayedCall(1000, () => {
      const sel = this._reg(this.add.graphics());
      sel.lineStyle(3, 0xffd700, 0.95);
      sel.strokeRoundedRect(
        SLOTS_X[2] - CARD_W / 2 - 5, PL_Y - CARD_H / 2 - 5,
        CARD_W + 10, CARD_H + 10, 10
      );
      this.tweens.add({ targets: sel, alpha: 0.4, yoyo: true, repeat: 2, duration: 280 });

      this.time.delayedCall(800, () => {
        // HP バーをターゲット枠で強調
        const tgt = this._reg(this.add.graphics());
        tgt.lineStyle(3, 0xff2233, 0.9);
        tgt.strokeRoundedRect(6, 6, 204, 46, 8);

        this.time.delayedCall(600, () => {
          const origY = plCard.y;
          // カード突進
          this.tweens.add({
            targets: plCard, y: AI_Y,
            duration: 340, ease: 'Power2.easeIn',
            onComplete: () => {
              this.cameras.main.shake(180, 0.012);

              // インパクトフラッシュ
              const flash = this._reg(this.add.graphics());
              flash.fillStyle(0xff2233, 1).fillCircle(108, 30, 60);
              this.tweens.add({ targets: flash, alpha: 0, scaleX: 2.4, scaleY: 2.4,
                duration: 380, ease: 'Power2.easeOut' });

              // HP 減少（30 → 26）
              let hp = 30;
              const tick = this.time.addEvent({
                delay: 80, repeat: 3,
                callback: () => {
                  if (!this._aiHpTxt.active) return;
                  hp--;
                  this._aiHpTxt.setText(`Enemy HP : ${hp}`);
                }
              });

              // カードが戻る
              this.tweens.add({
                targets: plCard, y: origY,
                duration: 300, delay: 220, ease: 'Power2.easeOut',
                onComplete: () => this._showNext(),
              });
            }
          });
        });
      });
    });
  }

  // ─────────────────────────────
  // STEP 5 : 勝利条件
  // ─────────────────────────────
  _s5_win() {
    this._setMsg(
      '◆  勝利条件',
      '相手の HP を 0 にした瞬間、あなたの勝利です！\nカードを融合させて強化し、一気に攻め込みましょう。'
    );

    // HP を 8 からカウントダウン
    let hp = 8;
    this._aiHpTxt.setText(`Enemy HP : ${hp}`);

    const countDown = this.time.addEvent({
      delay: 220, repeat: 7,
      callback: () => {
        if (!this._aiHpTxt.active) return;
        hp = Math.max(0, hp - 1);
        this._aiHpTxt.setText(`Enemy HP : ${hp}`);

        if (hp <= 0) {
          this.time.delayedCall(350, () => {
            this.cameras.main.flash(650, 255, 215, 0);
            this.cameras.main.shake(300, 0.018);

            // パーティクル
            for (let i = 0; i < 12; i++) {
              const p = this._reg(this.add.graphics());
              p.fillStyle(0xffd700, 0.9);
              p.fillCircle(0, 0, Phaser.Math.Between(4, 9));
              p.setPosition(108, 30);
              const angle = (i / 12) * Math.PI * 2;
              const dist  = Phaser.Math.Between(60, 130);
              this.tweens.add({
                targets: p,
                x: 108 + Math.cos(angle) * dist,
                y:  30 + Math.sin(angle) * dist,
                alpha: 0, scaleX: 0.2, scaleY: 0.2,
                duration: Phaser.Math.Between(500, 900),
                ease: 'Power2.easeOut',
                onComplete: () => { if (p.active) p.destroy(); },
              });
            }

            // WIN テキスト
            const winTxt = this._reg(this.add.text(CX, H / 2 - 100, '★  WIN  ★', {
              fontSize: '62px', fill: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
              stroke: '#000000', strokeThickness: 8,
            }).setOrigin(0.5).setAlpha(0));
            this.tweens.add({ targets: winTxt, alpha: 1, duration: 520 });

            this.time.delayedCall(1100, () => this._showNext('完 了  ▶'));
          });
        }
      }
    });
  }

  // ─────────────────────────────
  // STEP 6 : 完了
  // ─────────────────────────────
  _s6_end() {
    this._aiHpTxt.setText('Enemy HP : 30');
    this._setMsg(
      'チュートリアル完了！',
      '基本ルールをマスターしました。コインフリップで先行後攻を決めてゲームを始めましょう！'
    );
    this._stepInd.setText('');

    this.cameras.main.flash(500, 80, 160, 255);

    const readyTxt = this.add.text(CX, H / 2 - 90, 'READY !', {
      fontSize: '64px', fill: '#4895ef', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: readyTxt, alpha: 1, y: H / 2 - 100, duration: 600 });

    this.time.delayedCall(2400, () => {
      this.cameras.main.fadeOut(450, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
    });
  }
}
