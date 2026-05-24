import { GameManager } from '../game/GameManager.js';
import { TYPE_PASSIVES } from '../game/EffectHandler.js';
import { Card } from '../objects/Card.js';

const W = 1280;
const H = 720;
const CARD_W = Card.CARD_W;
const CARD_H = Card.CARD_H;

// ── フィールドY座標 (H=720) ──
// gap=2px, top_margin=3px → 3 + 183 + 2 + 200 + 2 + 183 = 573 = hand_top(650-77)
const AI_BATTLE_Y      = 95;    // AIバトルフィールド中心（高さ183px: 3-186）
const SHARED_SPECIAL_Y = 288;   // 共有特別フィールド中心（高さ200px: 188-388）
const PLAYER_BATTLE_Y  = 482;   // プレイヤーバトルフィールド中心（高さ183px: 390-573）
const HAND_Y           = 650;   // 手札エリア中心（高さ154px: 573-727、HP barはscreen内）
const HAND_SCALE       = 1.3;   // 手札カードを少し大きく表示

// 右サイドボタン（攻撃フェーズ・ターン終了）
const BTN_X       = 1160;
const BTN_PHASE_Y = 565;
const BTN_END_Y   = 660;

// 右中央: 0D召喚（energyZone画像）
const EZ_X = 1168;
const EZ_Y = 310;
const EZ_W = 210;
const EZ_H = 299; // 210 × 337/237 ≈ 299

// 対戦フィールド5スロットのX中心
// yourField.png(727x240)スロット境界から逆算: 中心 ≈ x=99,226,356,488,620 → 画面上376,503,633,765,897
const SLOT_GAP = 130;
const FIELD_X_START = W / 2 - SLOT_GAP * 2 - 4;  // = 376

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('bg',            'assets/material/backGround.png');
    this.load.image('playerHpImg',   'assets/material/PlayerHP2.png');
    this.load.image('enemyHpImg',    'assets/material/EnemyHP2.png');
    this.load.image('yourFieldImg',  'assets/material/yourField.png');
    this.load.image('enemyFieldImg', 'assets/material/enemyField.png');
    this.load.image('battleBtnImg',  'assets/material/battleButton.png');
    this.load.image('endTurnBtnImg', 'assets/material/turnEndButton.png');
    this.load.image('specialFldImg', 'assets/material/specialField_transparent.png');

    // D0カード（タイプなし・共通1枚）
    this.load.image('card_0d', 'assets/material/D0.png');

    this.load.image('energyZoneImg', 'assets/material/energyZone.png');

    // D1〜D3カード画像 (delta=Red, sigma=Blue, omega=Green)
    const cardFiles = {
      'card_delta_1d': 'D1_Red',   'card_sigma_1d': 'D1_Blue',  'card_omega_1d': 'D1_Green',
      'card_delta_2d': 'D2_Red',   'card_sigma_2d': 'D2_Blue',  'card_omega_2d': 'D2_Green',
      'card_delta_3d': 'D3_Red',   'card_sigma_3d': 'D3_Blue',  'card_omega_3d': 'D3_Green',
    };
    for (const [key, file] of Object.entries(cardFiles)) {
      this.load.image(key, `assets/material/cards/${file}.png`);
    }

    // D4カード画像（スペシャルフィールド専用・delta=Red, sigma=Blue, omega=Green）
    this.load.image('card_delta_4d', 'assets/material/D4_red.png');
    this.load.image('card_sigma_4d', 'assets/material/D4_blue.png');
    this.load.image('card_omega_4d', 'assets/material/D4_green.png');
  }

  create() {
    this._drawBg();
    this._drawFieldLayout();
    this._initUI();

    this._cardObjects = {};
    this._handCardObjects = [];
    this._selectedAttacker = null;
    this._isDraggingHandCard = false;
    this._fusionCandidates = null;
    this._aiLocked = false;
    this._gameOver = false;
    this._modalOpen = false;
    this._activeFieldEffectId = null;
    this._pendingDrawnIds = new Set();
    this._initTooltip();
    this.input.dragDistanceThreshold = 8;

    this._gm = new GameManager();
    this._bindEvents();
    this._gm.startGame();

    // 淡いフィルター（blur + パステル調）
    this._applyCanvasFilter();
    this.events.once('shutdown', () => this._clearCanvasFilter());
    this.events.once('destroy',  () => this._clearCanvasFilter());
  }

  _drawBg() {
    this._bgImage = this.add.image(W / 2, H / 2, 'bg').setDisplaySize(W, H);
    // 暗幕オーバーレイ（淡い調整のため従来より薄く）
    const ov = this.add.graphics();
    ov.fillStyle(0x000000, 0.28);
    ov.fillRect(0, 0, W, H);
    // 薄い白オーバーレイでパステル感を加える
    const pale = this.add.graphics();
    pale.fillStyle(0xffffff, 0.05);
    pale.fillRect(0, 0, W, H);
    // D4世界変容オーバーレイ（初期は透明・depth 25でカードの上に乗る）
    this._worldColorOverlay = this.add.graphics().setDepth(25).setAlpha(0);
  }

  _applyCanvasFilter() {
    // blur 0.5px: 微妙なやわらかさ / brightness: 少し明るく / saturate: 淡いパステル調
    this.sys.game.canvas.style.filter = 'blur(0.5px) brightness(1.07) saturate(0.80)';
  }

  _clearCanvasFilter() {
    if (this.sys.game.canvas) {
      this.sys.game.canvas.style.filter = '';
    }
  }

  _drawFieldLayout() {
    // ── 描画順: special背後オーラ → special画像 → バトル画像 → special前景オーラ ──

    // 0. スペシャルフィールド背後のオーラ（最も下層：フィールド画像より先に追加）
    this._startSpecialFieldBgGlow();

    // 1. 共有特別フィールド画像
    this._sharedSpecialImg = this.add.image(W / 2, SHARED_SPECIAL_Y, 'specialFldImg')
      .setDisplaySize(540, 360).setAlpha(0.65);

    // 2. AI バトルフィールド
    this.add.image(W / 2, AI_BATTLE_Y,     'enemyFieldImg').setDisplaySize(726, 183);

    // 3. Player バトルフィールド
    this.add.image(W / 2, PLAYER_BATTLE_Y, 'yourFieldImg') .setDisplaySize(726, 200);

    // 4. スペシャルフィールド前景オーラ（フィールド画像の上・カードの下）
    this._startSpecialFieldFrontGlow();
  }

  _startSpecialFieldBgGlow() {
    const cx = W / 2, cy = SHARED_SPECIAL_Y;

    // 広い金色柔光（大きな円・フィールド画像の背後から滲み出す）
    const bgGold = this.add.graphics();
    bgGold.fillStyle(0xffd700, 1);
    bgGold.fillCircle(cx, cy, 240);
    bgGold.setAlpha(0.07);
    this.tweens.add({ targets: bgGold, alpha: 0.15, yoyo: true, repeat: -1, duration: 2400, ease: 'Sine.easeInOut' });

    // 白い内光（より小さく・明るく）
    const bgWhite = this.add.graphics();
    bgWhite.fillStyle(0xffffff, 1);
    bgWhite.fillCircle(cx, cy, 125);
    bgWhite.setAlpha(0.05);
    this.tweens.add({ targets: bgWhite, alpha: 0.12, yoyo: true, repeat: -1, duration: 1700, ease: 'Sine.easeInOut', delay: 500 });
  }

  _startSpecialFieldFrontGlow() {
    const cx = W / 2, cy = SHARED_SPECIAL_Y;

    // 遅い回転レイ（16本・金色）
    const rays1 = this.add.graphics().setPosition(cx, cy).setAlpha(0.15);
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i / 16);
      const hw = 0.11;
      rays1.fillStyle(0xffd700, 1);
      rays1.fillTriangle(
        Math.cos(a - hw) * 52, Math.sin(a - hw) * 52,
        Math.cos(a + hw) * 52, Math.sin(a + hw) * 52,
        Math.cos(a) * 195,     Math.sin(a) * 195
      );
    }
    this.tweens.add({ targets: rays1, angle: 360, duration: 32000, ease: 'Linear', repeat: -1 });

    // 速い逆回転レイ（8本・白・短め）
    const rays2 = this.add.graphics().setPosition(cx, cy).setAlpha(0.09);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i / 8) + (Math.PI / 8);
      const hw = 0.08;
      rays2.fillStyle(0xffffff, 1);
      rays2.fillTriangle(
        Math.cos(a - hw) * 65, Math.sin(a - hw) * 65,
        Math.cos(a + hw) * 65, Math.sin(a + hw) * 65,
        Math.cos(a) * 148,     Math.sin(a) * 148
      );
    }
    this.tweens.add({ targets: rays2, angle: -360, duration: 20000, ease: 'Linear', repeat: -1 });
  }

  // D4カードが特別フィールドに着いた時の常駐オーラ
  _startD4CardAura(cardObj, card) {
    const cx = cardObj.x;
    const cy = cardObj.y;
    const typeCol = { delta: 0xe63946, sigma: 0x4895ef, omega: 0x4cc9a4 }[card.type] ?? 0xffd700;

    // ── リングをカードの直下に挿入（表示順: ring2 → ring1 → cardObj）──
    // 外リング（タイプカラー）
    const ring2 = this.add.graphics().setPosition(cx, cy);
    ring2.lineStyle(2.5, typeCol, 0.7);
    ring2.strokeCircle(0, 0, 80);
    this.children.moveTo(ring2, this.children.getIndex(cardObj));
    this.tweens.add({ targets: ring2, alpha: 0.18, scaleX: 1.08, scaleY: 1.08,
      yoyo: true, repeat: -1, duration: 1900, ease: 'Sine.easeInOut', delay: 600 });

    // 内リング（金色）
    const ring1 = this.add.graphics().setPosition(cx, cy);
    ring1.lineStyle(3, 0xffd700, 0.9);
    ring1.strokeCircle(0, 0, 62);
    this.children.moveTo(ring1, this.children.getIndex(cardObj));
    this.tweens.add({ targets: ring1, alpha: 0.28, scaleX: 1.10, scaleY: 1.10,
      yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.easeInOut' });

    // カード・リングをまとめてゆっくり浮遊（ring と card が一緒に動く）
    this.tweens.add({
      targets: [cardObj, ring1, ring2], y: '-=7',
      yoyo: true, repeat: -1, duration: 2400, ease: 'Sine.easeInOut',
    });

    // 定期ゴールドスパーク（カードの現在位置を追従）
    const sparkTimer = this.time.addEvent({
      delay: 780,
      loop: true,
      callback: () => {
        if (!cardObj.active) { sparkTimer.destroy(); return; }
        const angle = Math.random() * Math.PI * 2;
        const r = 45 + Math.random() * 40;
        const sp = this.add.graphics();
        sp.fillStyle(0xffd700, 0.9);
        sp.fillCircle(0, 0, 1.8 + Math.random() * 2.5);
        sp.setPosition(cardObj.x + Math.cos(angle) * r, cardObj.y + Math.sin(angle) * r);
        this.children.moveTo(sp, this.children.getIndex(cardObj));
        this.tweens.add({
          targets: sp, alpha: 0, scaleX: 0.2, scaleY: 0.2,
          duration: 650 + Math.random() * 450, ease: 'Power2',
          onComplete: () => sp.destroy(),
        });
      },
    });

    cardObj.on('destroy', () => {
      if (ring1.active) ring1.destroy();
      if (ring2.active) ring2.destroy();
      sparkTimer.destroy();
      this._scheduleWorldColorRevert();
    });
  }

  // ────────── 世界変容カラーシステム ──────────

  _applyWorldColor(effectId) {
    this._activeFieldEffectId = effectId;

    // 属性ごとの色設定
    const OVERLAY_COL = { field_delta: 0xcc1122, field_sigma: 0x1133cc, field_omega: 0x009966 };
    const BG_TINT     = { field_delta: 0xff9999, field_sigma: 0x99aaff, field_omega: 0x99ffdd };
    const CAM_RGB     = { field_delta: [220,40,60], field_sigma: [40,80,220], field_omega: [20,200,160] };

    const col  = OVERLAY_COL[effectId] ?? 0xffd700;
    const tint = BG_TINT[effectId]     ?? 0xffeeaa;
    const rgb  = CAM_RGB[effectId]     ?? [255,215,0];

    // 背景画像にタイント
    if (this._bgImage) this._bgImage.setTint(tint);

    // カメラフラッシュ（属性カラー）
    this.cameras.main.flash(700, rgb[0], rgb[1], rgb[2]);

    // フルスクリーン色オーバーレイをフェードイン
    const ov = this._worldColorOverlay;
    this.tweens.killTweensOf(ov);
    ov.clear();
    ov.fillStyle(col, 1);
    ov.fillRect(0, 0, W, H);
    this.tweens.add({ targets: ov, alpha: 0.13, duration: 1400, ease: 'Sine.easeOut' });
  }

  _revertWorldColor() {
    this._activeFieldEffectId = null;
    if (this._bgImage) this._bgImage.clearTint();
    const ov = this._worldColorOverlay;
    this.tweens.killTweensOf(ov);
    this.tweens.add({
      targets: ov, alpha: 0, duration: 1200, ease: 'Sine.easeOut',
      onComplete: () => ov.clear(),
    });
  }

  // 新D4が発動していなければ色を戻す（新D4置き換え時の誤リバートを防ぐ）
  _scheduleWorldColorRevert() {
    const prevId = this._activeFieldEffectId;
    this.time.delayedCall(350, () => {
      if (this._activeFieldEffectId === prevId) this._revertWorldColor();
    });
  }

  _initUI() {
    // ── バトルログパネル（左中央: y=188〜492 の縦帯）──
    const LOG_PX = 4;           // パネル左端X
    const LOG_PY = 188;         // パネル上端Y
    const LOG_PW = 208;         // パネル幅
    const LOG_PH = 304;         // パネル高さ
    const logBg = this.add.graphics();
    // 外枠グロー（内側に向けて複数描画で光彩）
    logBg.lineStyle(4, 0x224488, 0.18);
    logBg.strokeRoundedRect(LOG_PX - 2, LOG_PY - 2, LOG_PW + 4, LOG_PH + 4, 10);
    // 背景塗り
    logBg.fillStyle(0x060b14, 0.82);
    logBg.fillRoundedRect(LOG_PX, LOG_PY, LOG_PW, LOG_PH, 8);
    // ボーダー
    logBg.lineStyle(1, 0x2255aa, 0.75);
    logBg.strokeRoundedRect(LOG_PX, LOG_PY, LOG_PW, LOG_PH, 8);

    // ヘッダー「BATTLE LOG」
    this.add.text(LOG_PX + LOG_PW / 2, LOG_PY + 12, 'BATTLE LOG', {
      fontSize: '9px', fill: '#4488cc', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    // セパレータ
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x2255aa, 0.5);
    sep.lineBetween(LOG_PX + 6, LOG_PY + 24, LOG_PX + LOG_PW - 6, LOG_PY + 24);

    // ログテキスト行（6行）
    this._logTexts = [];
    for (let i = 0; i < 6; i++) {
      this._logTexts.push(
        this.add.text(LOG_PX + 7, LOG_PY + 32 + i * 42, '', {
          fontSize: '10px', fill: '#8ab8d8', fontFamily: 'monospace',
          wordWrap: { width: LOG_PW - 14 },
        }).setOrigin(0, 0)
      );
    }

    // ── AI HP パネル（左上）EnemyHP2: 953×362 → 220×84 ──
    const AI_HP_CX = 110, AI_HP_CY = 42;
    const AI_HP_W = 220, AI_HP_H = 84;
    this.add.image(AI_HP_CX, AI_HP_CY, 'enemyHpImg').setDisplaySize(AI_HP_W, AI_HP_H);
    this._aiHpText = this.add.text(56, AI_HP_CY, '30', {
      fontSize: '26px', fill: '#ff4455', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this._aiHandCount = this.add.text(AI_HP_CX, AI_HP_CY + AI_HP_H / 2 + 6, '手札: 5', {
      fontSize: '9px', fill: '#884444', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // ── Player HP パネル（左下）PlayerHP2: 935×358 → 220×84 ──
    const PL_HP_CX = 110, PL_HP_CY = H - 42;
    const PL_HP_W = 220, PL_HP_H = 84;
    this.add.image(PL_HP_CX, PL_HP_CY, 'playerHpImg').setDisplaySize(PL_HP_W, PL_HP_H);
    this._playerHpText = this.add.text(56, PL_HP_CY, '20', {
      fontSize: '26px', fill: '#44ccff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this._playerHandCount = this.add.text(PL_HP_CX, PL_HP_CY - PL_HP_H / 2 - 6, '手札: 5', {
      fontSize: '9px', fill: '#336688', fontFamily: 'monospace',
    }).setOrigin(0.5, 1);

    // ── 右中央: 0D召喚ボタン（energyZone画像）──
    this._summonBtn = this._makeImageButton(EZ_X, EZ_Y, 'energyZoneImg', EZ_W, EZ_H, () => this._onSummon());
    this.add.text(EZ_X, EZ_Y + EZ_H / 2 + 7, '0D  SUMMON', {
      fontSize: '10px', fill: '#00aaee', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // ── 召喚回数ゲージ（EZ画像の下）──
    this._summonGaugeGfx = this.add.graphics();
    this._summonGaugeText = this.add.text(EZ_X, EZ_Y + EZ_H / 2 + 48, '', {
      fontSize: '9px', fill: '#88bbcc', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5);

    // ── 右サイド: 攻撃フェーズ・ターン終了（大きめ・余白多め）──
    this._phaseBtn   = this._makeImageButton(BTN_X, BTN_PHASE_Y, 'battleBtnImg',  252, 88, () => this._onPhaseSwitch());
    this._endTurnBtn = this._makeImageButton(BTN_X, BTN_END_Y,   'endTurnBtnImg', 252, 88, () => this._onEndTurn());

    // ── ダイレクトアタックゾーン（AI HP パネル領域） ──
    this._directAttackZone = this.add.graphics();
    this._directAttackZone.lineStyle(2, 0xff2233, 0.9);
    this._directAttackZone.strokeRect(2, 2, 213, 95);
    this._directAttackZone.setAlpha(0);
    this._directAttackZone.setInteractive(
      new Phaser.Geom.Rectangle(2, 2, 213, 95),
      Phaser.Geom.Rectangle.Contains
    );
    this._directAttackZone.on('pointerdown', () => this._onDirectAttack());

    // ── ドロップゾーンハイライト（手札ドラッグ中にプレイヤーフィールドを強調）──
    this._fieldDropHighlight = this.add.graphics();

    // ── フィールドエフェクト表示（共有特別フィールドの左右: 540px幅→x=370-910を避ける）──
    this._aiFieldEffectText = this.add.text(W / 2 - 285, SHARED_SPECIAL_Y, '', {
      fontSize: '10px', fill: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(1, 0.5);
    this._playerFieldEffectText = this.add.text(W / 2 + 285, SHARED_SPECIAL_Y, '', {
      fontSize: '10px', fill: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // ── バフ/デバフパネル（バトルログの上: 敵フィールド / 下: 自フィールド）──
    const BDP_X = LOG_PX;
    const BDP_W = LOG_PW;
    const ROW_H  = 14;
    const MAX_ROWS = 4;

    // 敵フィールドパネル（バトルログ上: y=100〜184）
    const AI_BDP_Y = 100;
    const AI_BDP_H = 84;
    const aiBdpBg = this.add.graphics();
    aiBdpBg.lineStyle(4, 0x442222, 0.15);
    aiBdpBg.strokeRoundedRect(BDP_X - 2, AI_BDP_Y - 2, BDP_W + 4, AI_BDP_H + 4, 10);
    aiBdpBg.fillStyle(0x0a0608, 0.80);
    aiBdpBg.fillRoundedRect(BDP_X, AI_BDP_Y, BDP_W, AI_BDP_H, 8);
    aiBdpBg.lineStyle(1, 0x662233, 0.70);
    aiBdpBg.strokeRoundedRect(BDP_X, AI_BDP_Y, BDP_W, AI_BDP_H, 8);
    this.add.text(BDP_X + BDP_W / 2, AI_BDP_Y + 12, '敵フィールド', {
      fontSize: '9px', fill: '#cc4455', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    const aiSep2 = this.add.graphics();
    aiSep2.lineStyle(1, 0x662233, 0.45);
    aiSep2.lineBetween(BDP_X + 6, AI_BDP_Y + 22, BDP_X + BDP_W - 6, AI_BDP_Y + 22);
    this._aiBdpTexts = [];
    for (let i = 0; i < MAX_ROWS; i++) {
      this._aiBdpTexts.push(this.add.text(BDP_X + 7, AI_BDP_Y + 28 + i * ROW_H, '', {
        fontSize: '9px', fill: '#8ab8d8', fontFamily: 'monospace',
        wordWrap: { width: BDP_W - 14 },
      }).setOrigin(0, 0));
    }

    // 自フィールドパネル（バトルログ下: y=495〜590）
    const PL_BDP_Y = 495;
    const PL_BDP_H = 92;
    const plBdpBg = this.add.graphics();
    plBdpBg.lineStyle(4, 0x224488, 0.15);
    plBdpBg.strokeRoundedRect(BDP_X - 2, PL_BDP_Y - 2, BDP_W + 4, PL_BDP_H + 4, 10);
    plBdpBg.fillStyle(0x060810, 0.80);
    plBdpBg.fillRoundedRect(BDP_X, PL_BDP_Y, BDP_W, PL_BDP_H, 8);
    plBdpBg.lineStyle(1, 0x2244aa, 0.70);
    plBdpBg.strokeRoundedRect(BDP_X, PL_BDP_Y, BDP_W, PL_BDP_H, 8);
    this.add.text(BDP_X + BDP_W / 2, PL_BDP_Y + 12, '自フィールド', {
      fontSize: '9px', fill: '#4488cc', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    const plSep2 = this.add.graphics();
    plSep2.lineStyle(1, 0x2244aa, 0.45);
    plSep2.lineBetween(BDP_X + 6, PL_BDP_Y + 22, BDP_X + BDP_W - 6, PL_BDP_Y + 22);
    this._plBdpTexts = [];
    for (let i = 0; i < MAX_ROWS; i++) {
      this._plBdpTexts.push(this.add.text(BDP_X + 7, PL_BDP_Y + 28 + i * ROW_H, '', {
        fontSize: '9px', fill: '#8ab8d8', fontFamily: 'monospace',
        wordWrap: { width: BDP_W - 14 },
      }).setOrigin(0, 0));
    }
  }

  _bindEvents() {
    const gm = this._gm;

    gm.on('stateChanged', (state) => this._onStateChanged(state));
    gm.on('cardSummoned', (ev) => this._onCardSummoned(ev));
    gm.on('cardDied', (ev) => this._onCardDied(ev));
    gm.on('fusionSuccess', (ev) => this._onFusionSuccess(ev));
    gm.on('attackResult', (ev) => this._onAttackResult(ev));
    gm.on('fieldEffectActivated', (ev) => this._onFieldEffectActivated(ev));
    gm.on('gameOver', (ev) => this._onGameOver(ev));
    gm.on('phaseChanged', (ev) => this._onPhaseChanged(ev));
    gm.on('drawCard', (ev) => this._onDrawCard(ev));
    gm.on('turnChanged', (ev) => this._onTurnChanged(ev));
    gm.on('aiTurnStart', () => this._runAITurn());
  }

  // ===== イベントハンドラ =====

  _onStateChanged(state) {
    if (!state) return;
    this._playerHpText.setText(`${state.player.hp}`);
    this._aiHpText.setText(`${state.ai.hp}`);
    this._playerHandCount.setText(`手札: ${state.player.hand.length}`);
    this._aiHandCount.setText(`手札: ${state.ai.hand.length}`);

    if (state.currentPlayer === 'player') {
      this._refreshHandUI(state.player.hand);
    }

    // フィールド上カードのUI更新
    for (const cardObj of Object.values(this._cardObjects)) {
      cardObj.updateDisplay();
    }

    // フィールドエフェクト表示
    const pEffect = state.field.getActiveFieldEffect('player');
    const aEffect = state.field.getActiveFieldEffect('ai');
    this._playerFieldEffectText.setText(pEffect ? this._effectLabel(pEffect) : '');
    this._aiFieldEffectText.setText(aEffect ? this._effectLabel(aEffect) : '');

    this._updateSummonGauge(state);
    this._updateButtonStates(state);
    this._updateBuffDebuffPanels(state);
  }

  _effectLabel(effectId) {
    const labels = {
      field_delta: '🔴 次元崩壊 (ATK+2)',
      field_sigma: '🔵 次元加速 (+1ドロー)',
      field_omega: '🟢 次元要塞 (ダメージ半減)',
    };
    return labels[effectId] || effectId;
  }

  _onCardSummoned(ev) {
    const { owner, card } = ev;
    const cardObj = new Card(this, 0, 0, card);
    this._cardObjects[card.instanceId] = cardObj;
    const pos = this._fieldPosition(owner, card.instanceId);
    cardObj.x = pos.x;
    cardObj.y = pos.y;
    cardObj.playSpawnAnim();
    this.cameras.main.shake(120, 0.006);
    this._shockwaveRing(pos.x, pos.y, 0xaaddff, 2.8, 380);

    if (owner === 'player') {
      this._setupPlayerCardInteraction(cardObj);
    } else {
      this._setupAICardInteraction(cardObj, card);
    }
    this._attachTooltip(cardObj);
    this._log(`${owner === 'player' ? 'あなた' : 'AI'}が${card.name}を召喚`);
  }

  _onCardDied(ev) {
    this._hideTooltip();
    const { card } = ev;
    const cardObj = this._cardObjects[card.instanceId];
    if (cardObj) {
      cardObj.playDeathAnim(() => {
        delete this._cardObjects[card.instanceId];
        this._repositionFieldCards('player');
        this._repositionFieldCards('ai');
      });
    }
  }

  _onFusionSuccess(ev) {
    const { owner, newCard, isSpecial, consumedA, consumedB, consumedC, destroyedSpecial } = ev;

    // 待機する完了数: 2枚 or 3枚（consumedC）+ 既存4D破壊があれば+1
    let toWait = consumedC ? 3 : 2;
    const spawnWhenReady = () => {
      toWait--;
      if (toWait <= 0) this._spawnFusionResult(owner, newCard, isSpecial);
    };

    // 既存の共有特別フィールドカードを破壊アニメーション
    if (destroyedSpecial) {
      const oldObj = this._cardObjects[destroyedSpecial.instanceId];
      if (oldObj) {
        toWait++;
        delete this._cardObjects[destroyedSpecial.instanceId];
        oldObj.playDeathAnim(spawnWhenReady);
        this._log(`${destroyedSpecial.name}が消滅！`);
      }
    }

    const objA = this._cardObjects[consumedA.instanceId];
    const objB = this._cardObjects[consumedB.instanceId];
    const objC = consumedC ? this._cardObjects[consumedC.instanceId] : null;

    // エネルギー収束ライン（素材カードから中央へ）
    const srcObjs = [objA, objB, objC].filter(Boolean);
    const centerX = srcObjs.reduce((s, o) => s + o.x, 0) / srcObjs.length;
    const centerY = srcObjs.reduce((s, o) => s + o.y, 0) / srcObjs.length;
    this._fusionEnergyLines(srcObjs, centerX, centerY);

    if (objA) { delete this._cardObjects[consumedA.instanceId]; objA.playFusionAnim(spawnWhenReady); } else spawnWhenReady();
    if (objB) { delete this._cardObjects[consumedB.instanceId]; objB.playFusionAnim(spawnWhenReady); } else spawnWhenReady();
    if (consumedC) {
      if (objC) { delete this._cardObjects[consumedC.instanceId]; objC.playFusionAnim(spawnWhenReady); } else spawnWhenReady();
    }

    this._log(`${owner === 'player' ? 'あなた' : 'AI'}が融合！→${newCard.name}`);
  }

  _spawnFusionResult(owner, card, isSpecial) {
    const pos = isSpecial ? this._specialFieldPos(owner) : this._fieldPosition(owner, card.instanceId);
    const cardObj = new Card(this, pos.x, pos.y, card);
    this._cardObjects[card.instanceId] = cardObj;

    if (isSpecial) {
      // D4 グランドエントランス + 神々しいオーラ起動
      this._d4GrandEntrance(pos.x, pos.y);
      this.time.delayedCall(180, () => {
        if (cardObj.active) {
          cardObj.playD4SpawnAnim();
          this._startD4CardAura(cardObj, card);
        }
      });
    } else {
      // 通常融合結果: カラーバーストリング + スポーン
      const col = { delta: 0xe63946, sigma: 0x4895ef, omega: 0x4cc9a4 }[card.type] ?? 0xffffff;
      this._shockwaveRing(pos.x, pos.y, col, 3.2, 500);
      this._particleBurst(pos.x, pos.y, 10, col, 70);
      this.time.delayedCall(10, () => { if (cardObj.active) cardObj.playSpawnAnim(); });
    }

    if (owner === 'player') {
      this._setupPlayerCardInteraction(cardObj);
    } else {
      this._setupAICardInteraction(cardObj, card);
    }
    this._attachTooltip(cardObj);

    if (!isSpecial) {
      this._repositionFieldCards(owner);
    }
  }

  _onAttackResult(ev) {
    const attackerObj = this._cardObjects[ev.attackerId];
    if (!attackerObj) return;

    if (ev.defenderId) {
      const defenderObj = this._cardObjects[ev.defenderId];
      if (defenderObj) {
        attackerObj.playAttackAnim(defenderObj.x, defenderObj.y, () => {
          this._showDamageNumber(defenderObj.x, defenderObj.y, ev.damage);
          if (ev.splashTarget) {
            const splashObj = this._cardObjects[ev.splashTarget.instanceId];
            if (splashObj) this._showDamageNumber(splashObj.x, splashObj.y, ev.splashDamage, '#ff9900');
          }
        });
      }
    } else if (ev.directAttack) {
      const targetX = 56;
      const targetY = ev.defenderOwner === 'player' ? H - 42 : 42;
      attackerObj.playAttackAnim(targetX, targetY, () => {
        this._showDamageNumber(targetX, targetY, ev.damage, '#ff4444');
      });
      this._log(`${ev.attackerOwner === 'player' ? 'あなた' : 'AI'}が直接攻撃！${ev.damage}ダメージ`);
    }

    if (ev.defenderDied) {
      this._log(`カードを撃破！余剰ダメージ: ${ev.overkill}`);
    }

    if (ev.atkDebuff) {
      const t = ev.atkDebuff.target;
      this._log(`Ωデバフ: ${t.name} ATK -${ev.atkDebuff.amount} → ${t.currentAtk}`);
    }
  }

  _onFieldEffectActivated(ev) {
    const labels = {
      field_delta: '次元崩壊発動！全カードATK+2',
      field_sigma: '次元加速発動！毎ターン+1ドロー',
      field_omega: '次元要塞発動！ダメージ半減',
    };
    this._log(labels[ev.effectId] || '4Dフィールド効果発動');
    // 共有特別フィールド画像を輝かせる
    if (this._sharedSpecialImg) {
      this.tweens.add({ targets: this._sharedSpecialImg, alpha: 1, duration: 300, yoyo: true, hold: 600,
        onComplete: () => this._sharedSpecialImg.setAlpha(0.65) });
    }
    // 世界変容エフェクト（D4が顕現する時に世界の色が変わる）
    this._applyWorldColor(ev.effectId);
    // フィールド効果テキストを大きく演出
    const effectColors = { field_delta: '#ff4455', field_sigma: '#4488ff', field_omega: '#44ffbb' };
    const col = effectColors[ev.effectId] || '#ffd700';
    this._fieldEffectAnnounce(labels[ev.effectId] || '4D FIELD ACTIVE', col);
  }

  _onGameOver(ev) {
    this._gameOver = true;
    this._aiLocked = true;
    // 攻撃アニメーション終了を待ってからカットイン
    this.time.delayedCall(520, () => this._showVictoryCutin(ev.winner, ev.stats));
  }

  _showVictoryCutin(winner, stats) {
    const isVic = winner === 'player';
    const D = 300;
    const accentCol = isVic ? 0xffd700 : 0xe63946;
    const accentHex = isVic ? '#ffd700' : '#e63946';

    // ── カメラ演出 ──
    this.cameras.main.shake(isVic ? 280 : 420, isVic ? 0.014 : 0.022);
    this.time.delayedCall(60, () =>
      this.cameras.main.flash(isVic ? 380 : 260, isVic ? 255 : 200, isVic ? 215 : 0, 0)
    );

    // ── 暗幕オーバーレイ ──
    const overlay = this.add.graphics().setDepth(D);
    overlay.fillStyle(0x000000, 1).fillRect(0, 0, W, H);
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 0.90, duration: 520, ease: 'Power2' });

    // ── シネマバー（上下レターボックス）──
    const barH = 88;
    const topBar = this.add.graphics().setDepth(D + 1);
    topBar.fillStyle(0x000000, 1).fillRect(0, 0, W, barH);
    topBar.y = -barH;
    this.tweens.add({ targets: topBar, y: 0, duration: 400, ease: 'Power3.easeOut' });

    const botBar = this.add.graphics().setDepth(D + 1);
    botBar.fillStyle(0x000000, 1).fillRect(0, 0, W, barH);
    botBar.y = H;
    this.tweens.add({ targets: botBar, y: H - barH, duration: 400, ease: 'Power3.easeOut' });

    // ── 放射光線（勝利時のみ）──
    if (isVic) {
      const raysCon = this.add.container(W / 2, H / 2).setDepth(D + 2).setAlpha(0);
      const rGfx = this.add.graphics();
      for (let i = 0; i < 20; i++) {
        const ang = (i / 20) * Math.PI * 2;
        rGfx.lineStyle(24, 0xffd700, i % 2 === 0 ? 0.08 : 0.035);
        rGfx.lineBetween(0, 0, Math.cos(ang) * 950, Math.sin(ang) * 950);
      }
      raysCon.add(rGfx);
      this.tweens.add({ targets: raysCon, alpha: 1, delay: 260, duration: 500 });
      this.tweens.add({ targets: raysCon, rotation: Math.PI * 2, duration: 30000, ease: 'Linear', repeat: -1 });
    }

    // ── バナー「DIMENSION SLASH」(左スライドイン) ──
    const bW = 700, bH = 48;
    const banCon = this.add.container(W / 2, H / 2 - 118).setDepth(D + 3);
    banCon.x = -W;
    banCon.setAlpha(0);
    const bGfx = this.add.graphics();
    bGfx.fillStyle(accentCol, 0.14).fillRect(-bW / 2, -bH / 2, bW, bH);
    bGfx.lineStyle(1.5, accentCol, 0.82).strokeRect(-bW / 2, -bH / 2, bW, bH);
    bGfx.lineStyle(3, accentCol, 1);
    bGfx.lineBetween(-bW / 2 - 26, 0, -bW / 2, 0);
    bGfx.lineBetween(bW / 2, 0, bW / 2 + 26, 0);
    banCon.add(bGfx);
    banCon.add(this.add.text(0, 0, 'D I M E N S I O N   S L A S H', {
      fontSize: '18px', fill: accentHex, fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5));
    this.tweens.add({ targets: banCon, x: W / 2, alpha: 1, delay: 310, duration: 440, ease: 'Power3.easeOut' });

    // ── メインテキスト（上スケールダウンで登場）──
    const label  = isVic ? 'VICTORY' : 'DEFEAT';
    const mHex   = isVic ? '#ffd700' : '#e63946';
    const mStrok = isVic ? '#553300' : '#440011';

    const mainTxt = this.add.text(W / 2, H / 2 + 28, label, {
      fontSize: '108px', fill: mHex, fontFamily: 'monospace', fontStyle: 'bold',
      stroke: mStrok, strokeThickness: 11,
    }).setOrigin(0.5).setDepth(D + 5).setAlpha(0).setScale(1.9);

    this.tweens.add({
      targets: mainTxt,
      alpha: 1, scaleX: 1, scaleY: 1,
      delay: 800,
      duration: 500,
      ease: 'Power3.easeOut',
      onComplete: () => {
        this.cameras.main.flash(130, 255, 255, 255);
        this._particleBurst(W / 2, H / 2 + 28, 26, accentCol, 210);
        if (isVic) this._particleBurst(W / 2, H / 2 + 28, 14, 0xffffff, 155);
        this.tweens.add({ targets: mainTxt, scaleX: 1.06, scaleY: 1.06, yoyo: true, duration: 130, ease: 'Power1' });
      },
    });

    // ── 装飾ライン ──
    const deco = this.add.graphics().setDepth(D + 4).setAlpha(0);
    deco.lineStyle(1.5, accentCol, 0.75).lineBetween(W / 2 - 260, H / 2 + 86, W / 2 + 260, H / 2 + 86);
    // 端のひし形
    [[W / 2 - 264, -1], [W / 2 + 264, 1]].forEach(([dx, dir]) => {
      deco.fillStyle(accentCol, 0.9);
      deco.fillTriangle(dx, H / 2 + 86, dx + dir * 7, H / 2 + 80, dx + dir * 7, H / 2 + 92);
    });
    this.tweens.add({ targets: deco, alpha: 1, delay: 1250, duration: 380 });

    // ── サブテキスト ──
    const subTxt = this.add.text(W / 2, H / 2 + 106, isVic ? '次元の戦いに勝利した' : '次元の戦いに敗れた', {
      fontSize: '16px', fill: '#cccccc', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(D + 4).setAlpha(0);
    this.tweens.add({ targets: subTxt, alpha: 1, delay: 1450, duration: 500 });

    // ── 「クリックでスキップ」テキスト ──
    const skipTxt = this.add.text(W / 2, H - barH - 18, 'クリックでスキップ', {
      fontSize: '10px', fill: '#555566', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(D + 6).setAlpha(0);
    this.tweens.add({ targets: skipTxt, alpha: 1, delay: 1800, duration: 600 });

    // ── 遷移処理 ──
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      this.cameras.main.fade(550, 0, 0, 0);
      this.time.delayedCall(560, () => this.scene.start('ResultScene', { winner, stats }));
    };

    // クリック/タップでスキップ（1秒後に有効化）
    this.time.delayedCall(1000, () => {
      const zone = this.add.zone(0, 0, W, H).setOrigin(0, 0).setDepth(D + 7).setInteractive();
      zone.on('pointerdown', go);
    });

    // 4.2秒後に自動遷移
    this.time.delayedCall(4200, go);
  }

  _onPhaseChanged(ev) {
    const labels = { main: 'メインフェーズ', attack: '攻撃フェーズ' };
    this._showPhaseAnim(labels[ev.phase] || ev.phase);
    this._clearFusionSelection();
  }

  _onDrawCard(ev) {
    if (ev.owner === 'player') {
      for (const card of ev.cards) this._pendingDrawnIds.add(card.instanceId);
      this._deckGlowEffect();
    }
  }

  _onTurnChanged(ev) {
    const isPlayer = ev.currentPlayer === 'player';
    this._showPhaseAnim(isPlayer ? '▶ あなたのターン' : '▶ AI のターン');
    this._aiLocked = !isPlayer;
    if (isPlayer) {
      this._refreshHandUI(this._gm.state.player.hand);
    }
  }

  // ===== プレイヤー操作 =====

  _onSummon() {
    if (this._aiLocked || this._gameOver) return;
    const state = this._gm.state;
    if (state.phase !== 'main' || state.currentPlayer !== 'player') return;
    const result = this._gm.normalSummon('player');
    if (!result.ok) this._log(`召喚失敗: ${result.reason}`);
  }

  _onPhaseSwitch() {
    if (this._aiLocked || this._gameOver) return;
    const state = this._gm.state;
    if (state.currentPlayer !== 'player') return;
    if (state.phase === 'main') {
      this._gm.startAttackPhase();
      this._clearFusionSelection();
    }
  }

  _onEndTurn() {
    if (this._aiLocked || this._gameOver) return;
    const state = this._gm.state;
    if (state.currentPlayer !== 'player') return;
    this._clearFusionSelection();
    this._clearAttackSelection();
    this._gm.endTurn();
  }

  _setupPlayerCardInteraction(cardObj) {
    cardObj.on('pointerover', () => {
      if (!this._aiLocked && !cardObj._selected) this.input.setDefaultCursor('pointer');
    });
    cardObj.on('pointerout', () => this.input.setDefaultCursor('default'));
    cardObj.on('pointerdown', () => this._onPlayerCardClick(cardObj));
  }

  _setupAICardInteraction(cardObj, inst) {
    cardObj.on('pointerover', () => {
      const state = this._gm.state;
      if (state.phase === 'attack' && state.currentPlayer === 'player' && this._selectedAttacker) {
        this.input.setDefaultCursor('crosshair');
      }
    });
    cardObj.on('pointerout', () => this.input.setDefaultCursor('default'));
    cardObj.on('pointerdown', () => {
      if (this._aiLocked || this._gameOver || this._modalOpen) return;
      const state = this._gm.state;
      if (state.phase !== 'attack' || state.currentPlayer !== 'player') return;
      if (!this._selectedAttacker) return;
      const attackerId = this._selectedAttacker.instanceId;
      const result = this._gm.executeAttack('player', attackerId, inst.instanceId, 'ai');
      if (result.ok) {
        this._clearAttackSelection();
        this._unhighlightAllTargets();
      } else {
        this._log(`攻撃失敗: ${result.reason}`);
      }
    });
  }

  _onPlayerCardClick(cardObj) {
    if (this._aiLocked || this._gameOver) return;
    const state = this._gm.state;
    if (state.currentPlayer !== 'player') return;
    const inst = cardObj.cardInstance;

    if (state.phase === 'attack') {
      this._handleAttackSelection(cardObj, inst);
    }
  }

  _isOnPlayerField(cardObj) {
    return this._gm.state.field.getFilledSlots('player').some(c => c.instanceId === cardObj.instanceId);
  }

  _handleAttackSelection(cardObj, inst) {
    const isOnField = this._isOnPlayerField(cardObj);

    if (isOnField) {
      if (this._selectedAttacker) this._selectedAttacker.setSelected(false);
      this._selectedAttacker = cardObj;
      cardObj.setSelected(true);
      this._highlightAttackTargets();
    } else {
      if (!this._selectedAttacker) return;
      const attackerId = this._selectedAttacker.instanceId;
      const result = this._gm.executeAttack('player', attackerId, inst.instanceId, 'ai');
      if (result.ok) {
        this._clearAttackSelection();
        this._unhighlightAllTargets();
      } else {
        this._log(`攻撃失敗: ${result.reason}`);
      }
    }
  }

  _highlightAttackTargets() {
    const aiCards = this._gm.state.field.getFilledSlots('ai');
    for (const inst of aiCards) {
      const obj = this._cardObjects[inst.instanceId];
      if (obj) {
        obj.setInteractive();
        // 視覚的なハイライト
        this.tweens.add({ targets: obj, scaleX: 1.08, scaleY: 1.08, yoyo: true, repeat: -1, duration: 400, key: `highlight_${inst.instanceId}` });
      }
    }
    this._directAttackZone.setAlpha(aiCards.length === 0 ? 0.8 : 0);
  }

  _unhighlightAllTargets() {
    const aiCards = this._gm.state.field.getFilledSlots('ai');
    for (const inst of aiCards) {
      const obj = this._cardObjects[inst.instanceId];
      if (obj) {
        this.tweens.killTweensOf(obj);
        obj.setScale(1);
      }
    }
    this._directAttackZone.setAlpha(0);
  }

  _onDirectAttack() {
    if (!this._selectedAttacker || this._aiLocked || this._gameOver) return;
    const result = this._gm.executeAttack('player', this._selectedAttacker.instanceId, null, 'ai', true);
    if (result.ok) {
      this._clearAttackSelection();
      this._unhighlightAllTargets();
    }
  }

  _clearFusionSelection() {
    this._clearFusionHighlight();
  }

  // ===== ドラッグ融合 =====

  _isOnPlayerBattleField(x, y) {
    return x >= W / 2 - 363 && x <= W / 2 + 363 &&
           y >= PLAYER_BATTLE_Y - 100 && y <= PLAYER_BATTLE_Y + 100;
  }

  _highlightFusionCandidates(handInst) {
    this._clearFusionHighlight();
    const fieldCards = this._gm.state.field.getFilledSlots('player');
    const dim2 = handInst.dimension - 1;  // 2枚融合素材次元
    const dim3 = handInst.dimension - 2;  // 3枚融合素材次元
    const cands2 = fieldCards.filter(c => c.dimension === dim2);
    const cands3 = dim3 >= 0 ? fieldCards.filter(c => c.dimension === dim3) : [];
    // 候補をまとめてハイライト（重複なし）
    const allCands = [...new Map([...cands2, ...cands3].map(c => [c.instanceId, c])).values()];
    this._fusionCandidates = allCands;
    for (const inst of allCands) {
      const obj = this._cardObjects[inst.instanceId];
      if (obj) obj.setSelected(true);
    }
    const canFuse = cands2.length >= 2 || cands3.length >= 3;
    const g = this._fieldDropHighlight;
    g.clear();
    const color = canFuse ? 0xffd700 : 0xff4444;
    g.lineStyle(3, color, 0.9);
    g.fillStyle(color, canFuse ? 0.12 : 0.06);
    g.fillRoundedRect(W / 2 - 363, PLAYER_BATTLE_Y - 100, 726, 200, 10);
    g.strokeRoundedRect(W / 2 - 363, PLAYER_BATTLE_Y - 100, 726, 200, 10);
  }

  _clearFusionHighlight() {
    if (this._fusionCandidates) {
      for (const inst of this._fusionCandidates) {
        const obj = this._cardObjects[inst.instanceId];
        if (obj) obj.setSelected(false);
      }
      this._fusionCandidates = null;
    }
    if (this._fieldDropHighlight) this._fieldDropHighlight.clear();
  }

  _attemptFusionDrop(handCardInst, cardObj) {
    if (this._aiLocked || this._gameOver) return false;
    const state = this._gm.state;
    if (state.phase !== 'main' || state.currentPlayer !== 'player') return false;

    const fieldCards = state.field.getFilledSlots('player');
    const dim2 = handCardInst.dimension - 1;
    const dim3 = handCardInst.dimension - 2;
    const cands2 = fieldCards.filter(c => c.dimension === dim2);
    const cands3 = dim3 >= 0 ? fieldCards.filter(c => c.dimension === dim3) : [];
    const can2 = cands2.length >= 2;
    const can3 = cands3.length >= 3;

    if (!can2 && !can3) {
      this._log(`融合失敗: 素材が不足しています（D${dim2}×2 or D${dim3}×3 が必要）`);
      return false;
    }

    // 両方可能: 選択ダイアログ
    if (can2 && can3) {
      this._showFusionTypeChoiceModal(handCardInst, cardObj, cands2, cands3);
      return true;
    }

    // 2枚融合のみ可能
    if (can2) {
      if (cands2.length >= 3) {
        this._showFusionSelectModal(handCardInst, cardObj, cands2, 2);
        return true;
      }
      const result = this._gm.fuse('player', cands2[0].instanceId, cands2[1].instanceId, handCardInst.instanceId);
      if (!result.ok) { this._log(`融合失敗: ${result.reason}`); return false; }
      return true;
    }

    // 3枚融合のみ可能
    if (cands3.length > 3) {
      this._showFusionSelectModal(handCardInst, cardObj, cands3, 3);
      return true;
    }
    const result = this._gm.fuse(
      'player',
      cands3[0].instanceId, cands3[1].instanceId,
      handCardInst.instanceId,
      cands3[2].instanceId
    );
    if (!result.ok) { this._log(`融合失敗: ${result.reason}`); return false; }
    return true;
  }

  _showFusionSelectModal(handCardInst, cardObj, candidates, requiredCount = 2) {
    this._modalOpen = true;

    const cx = W / 2;
    const mW = 460;
    const ROW_H = 54;
    const HEADER_H = 58;
    const FOOTER_H = 66;
    const mH = HEADER_H + ROW_H * candidates.length + FOOTER_H;
    const mx = cx - mW / 2;
    const my = H / 2 - mH / 2;

    const con = this.add.container(0, 0).setDepth(200);

    const blocker = this.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive();
    con.add(blocker);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, W, H);
    con.add(overlay);

    const panel = this.add.graphics();
    panel.fillStyle(0x080f1e, 0.97);
    panel.fillRoundedRect(mx, my, mW, mH, 12);
    panel.lineStyle(1.5, 0x2255aa, 0.85);
    panel.strokeRoundedRect(mx, my, mW, mH, 12);
    con.add(panel);

    con.add(this.add.text(cx, my + 18, `融合素材を${requiredCount}体選択`, {
      fontSize: '14px', fill: '#aaccff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));
    const srcDim = handCardInst.dimension - (requiredCount === 3 ? 2 : 1);
    con.add(this.add.text(cx, my + 38, `D${srcDim} のカードを${requiredCount}枚選んでください`, {
      fontSize: '9px', fill: '#445577', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5));

    const TYPE_COL = { delta: 0xe63946, sigma: 0x4895ef, omega: 0x4cc9a4 };
    const TYPE_SYM = { delta: 'δ', sigma: 'σ', omega: 'Ω' };

    const selected = new Set();
    const rowBgGfxList = [];
    const checkTexts = [];

    const drawRowBg = (gfx, i, isSel) => {
      gfx.clear();
      const ry = my + HEADER_H + i * ROW_H;
      if (isSel) {
        gfx.fillStyle(0x1a2e50, 0.95);
        gfx.fillRoundedRect(mx + 8, ry + 4, mW - 16, ROW_H - 8, 6);
        gfx.lineStyle(2, 0xffd700, 1);
        gfx.strokeRoundedRect(mx + 8, ry + 4, mW - 16, ROW_H - 8, 6);
      } else {
        gfx.fillStyle(0x111828, 0.85);
        gfx.fillRoundedRect(mx + 8, ry + 4, mW - 16, ROW_H - 8, 6);
        gfx.lineStyle(1, 0x223355, 0.6);
        gfx.strokeRoundedRect(mx + 8, ry + 4, mW - 16, ROW_H - 8, 6);
      }
    };

    const confirmBtnGfx = this.add.graphics();
    const confirmBtnText = this.add.text(cx + 10 + 90, my + mH - FOOTER_H + 33, '融合実行', {
      fontSize: '12px', fill: '#88ccff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const updateConfirm = () => {
      const ready = selected.size === requiredCount;
      confirmBtnGfx.clear();
      confirmBtnGfx.fillStyle(ready ? 0x0e2d6e : 0x0a1525, ready ? 0.95 : 0.6);
      confirmBtnGfx.fillRoundedRect(cx + 10, my + mH - FOOTER_H + 13, 180, 40, 8);
      confirmBtnGfx.lineStyle(1.5, ready ? 0x4488ff : 0x223344, ready ? 0.95 : 0.35);
      confirmBtnGfx.strokeRoundedRect(cx + 10, my + mH - FOOTER_H + 13, 180, 40, 8);
      confirmBtnText.setAlpha(ready ? 1 : 0.35);
    };

    for (let i = 0; i < candidates.length; i++) {
      const inst = candidates[i];
      const ry = my + HEADER_H + i * ROW_H;
      const typeColor = TYPE_COL[inst.type] ?? 0x888888;
      const hexCol = '#' + typeColor.toString(16).padStart(6, '0');

      const rowBgGfx = this.add.graphics();
      drawRowBg(rowBgGfx, i, false);
      rowBgGfxList.push(rowBgGfx);
      con.add(rowBgGfx);

      const typeBar = this.add.graphics();
      typeBar.fillStyle(typeColor, 0.9);
      typeBar.fillRoundedRect(mx + 14, ry + 10, 4, ROW_H - 20, 2);
      con.add(typeBar);

      con.add(this.add.text(mx + 30, ry + ROW_H / 2, TYPE_SYM[inst.type] ?? '?', {
        fontSize: '15px', fill: hexCol, fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5));

      con.add(this.add.text(mx + 48, ry + ROW_H / 2 - 9, inst.name, {
        fontSize: '11px', fill: '#cce0ff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0, 0.5));

      con.add(this.add.text(mx + 48, ry + ROW_H / 2 + 9,
        `ATK:${inst.currentAtk}  DEF:${inst.currentDef}  HP:${inst.currentHp}/${inst.maxHp}`, {
        fontSize: '9px', fill: '#7799bb', fontFamily: 'monospace',
      }).setOrigin(0, 0.5));

      const chk = this.add.text(mx + mW - 20, ry + ROW_H / 2, '✓', {
        fontSize: '16px', fill: '#ffd700', fontFamily: 'monospace',
      }).setOrigin(0.5, 0.5).setAlpha(0);
      checkTexts.push(chk);
      con.add(chk);

      const hitZone = this.add.zone(mx + 8, ry + 4, mW - 16, ROW_H - 8).setOrigin(0, 0).setInteractive();
      hitZone.on('pointerdown', () => {
        if (selected.has(inst.instanceId)) {
          selected.delete(inst.instanceId);
          drawRowBg(rowBgGfxList[i], i, false);
          checkTexts[i].setAlpha(0);
        } else if (selected.size < requiredCount) {
          selected.add(inst.instanceId);
          drawRowBg(rowBgGfxList[i], i, true);
          checkTexts[i].setAlpha(1);
        }
        updateConfirm();
      });
      hitZone.on('pointerover', () => this.input.setDefaultCursor('pointer'));
      hitZone.on('pointerout',  () => this.input.setDefaultCursor('default'));
      con.add(hitZone);
    }

    const cancelGfx = this.add.graphics();
    cancelGfx.fillStyle(0x1a0a0a, 0.9);
    cancelGfx.fillRoundedRect(mx + 8, my + mH - FOOTER_H + 13, 180, 40, 8);
    cancelGfx.lineStyle(1.5, 0x663344, 0.7);
    cancelGfx.strokeRoundedRect(mx + 8, my + mH - FOOTER_H + 13, 180, 40, 8);
    con.add(cancelGfx);

    con.add(this.add.text(mx + 8 + 90, my + mH - FOOTER_H + 33, 'キャンセル', {
      fontSize: '12px', fill: '#cc6677', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5));

    const cancelZone = this.add.zone(mx + 8, my + mH - FOOTER_H + 13, 180, 40).setOrigin(0, 0).setInteractive();
    cancelZone.on('pointerdown', () => {
      con.destroy(true);
      this._modalOpen = false;
      this.input.setDefaultCursor('default');
      if (cardObj.active) {
        this.tweens.add({
          targets: cardObj,
          x: cardObj._handX, y: HAND_Y,
          scaleX: HAND_SCALE, scaleY: HAND_SCALE,
          duration: 200, ease: 'Power2',
        });
      }
    });
    cancelZone.on('pointerover', () => this.input.setDefaultCursor('pointer'));
    cancelZone.on('pointerout',  () => this.input.setDefaultCursor('default'));
    con.add(cancelZone);

    con.add(confirmBtnGfx);
    con.add(confirmBtnText);
    updateConfirm();

    const confirmZone = this.add.zone(cx + 10, my + mH - FOOTER_H + 13, 180, 40).setOrigin(0, 0).setInteractive();
    confirmZone.on('pointerdown', () => {
      if (selected.size !== requiredCount) return;
      const ids = [...selected];
      const result = requiredCount === 3
        ? this._gm.fuse('player', ids[0], ids[1], handCardInst.instanceId, ids[2])
        : this._gm.fuse('player', ids[0], ids[1], handCardInst.instanceId);
      con.destroy(true);
      this._modalOpen = false;
      this.input.setDefaultCursor('default');
      if (!result.ok) this._log(`融合失敗: ${result.reason}`);
    });
    confirmZone.on('pointerover', () => { if (selected.size === requiredCount) this.input.setDefaultCursor('pointer'); });
    confirmZone.on('pointerout',  () => this.input.setDefaultCursor('default'));
    con.add(confirmZone);
  }

  _showFusionTypeChoiceModal(handCardInst, cardObj, cands2, cands3) {
    this._modalOpen = true;

    const cx = W / 2;
    const mW = 380;
    const mH = 200;
    const mx = cx - mW / 2;
    const my = H / 2 - mH / 2;

    const con = this.add.container(0, 0).setDepth(200);

    const blocker = this.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive();
    con.add(blocker);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, W, H);
    con.add(overlay);

    const panel = this.add.graphics();
    panel.fillStyle(0x080f1e, 0.97);
    panel.fillRoundedRect(mx, my, mW, mH, 12);
    panel.lineStyle(1.5, 0x2255aa, 0.85);
    panel.strokeRoundedRect(mx, my, mW, mH, 12);
    con.add(panel);

    con.add(this.add.text(cx, my + 24, '融合方法を選択', {
      fontSize: '14px', fill: '#aaccff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    const close = (chosenCands, required) => {
      con.destroy(true);
      this._modalOpen = false;
      this.input.setDefaultCursor('default');
      if (chosenCands === null) {
        // キャンセル: 手札に戻す
        if (cardObj.active) {
          this.tweens.add({ targets: cardObj, x: cardObj._handX, y: HAND_Y, scaleX: HAND_SCALE, scaleY: HAND_SCALE, duration: 200, ease: 'Power2' });
        }
        return;
      }
      if (chosenCands.length > required) {
        this._showFusionSelectModal(handCardInst, cardObj, chosenCands, required);
      } else {
        const result = required === 3
          ? this._gm.fuse('player', chosenCands[0].instanceId, chosenCands[1].instanceId, handCardInst.instanceId, chosenCands[2].instanceId)
          : this._gm.fuse('player', chosenCands[0].instanceId, chosenCands[1].instanceId, handCardInst.instanceId);
        if (!result.ok) this._log(`融合失敗: ${result.reason}`);
      }
    };

    const BTN_Y = my + 90;
    const BTN_W = 150;
    const BTN_H = 44;
    const GAP = 16;
    const b2x = cx - BTN_W - GAP / 2;
    const b3x = cx + GAP / 2;

    // 2枚融合ボタン
    const g2 = this.add.graphics();
    g2.fillStyle(0x0e2d6e, 0.95);
    g2.fillRoundedRect(b2x, BTN_Y, BTN_W, BTN_H, 8);
    g2.lineStyle(1.5, 0x4488ff, 0.9);
    g2.strokeRoundedRect(b2x, BTN_Y, BTN_W, BTN_H, 8);
    con.add(g2);
    con.add(this.add.text(b2x + BTN_W / 2, BTN_Y + BTN_H / 2 - 7, `2枚融合`, { fontSize: '12px', fill: '#88ccff', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5, 0.5));
    con.add(this.add.text(b2x + BTN_W / 2, BTN_Y + BTN_H / 2 + 9, `D${handCardInst.dimension - 1}×2→D${handCardInst.dimension}`, { fontSize: '9px', fill: '#4477aa', fontFamily: 'monospace' }).setOrigin(0.5, 0.5));
    const z2 = this.add.zone(b2x, BTN_Y, BTN_W, BTN_H).setOrigin(0, 0).setInteractive();
    z2.on('pointerdown', () => close(cands2, 2));
    z2.on('pointerover', () => this.input.setDefaultCursor('pointer'));
    z2.on('pointerout',  () => this.input.setDefaultCursor('default'));
    con.add(z2);

    // 3枚融合ボタン
    const g3 = this.add.graphics();
    g3.fillStyle(0x2d1a0a, 0.95);
    g3.fillRoundedRect(b3x, BTN_Y, BTN_W, BTN_H, 8);
    g3.lineStyle(1.5, 0xff9922, 0.9);
    g3.strokeRoundedRect(b3x, BTN_Y, BTN_W, BTN_H, 8);
    con.add(g3);
    con.add(this.add.text(b3x + BTN_W / 2, BTN_Y + BTN_H / 2 - 7, `3枚融合`, { fontSize: '12px', fill: '#ffbb66', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5, 0.5));
    con.add(this.add.text(b3x + BTN_W / 2, BTN_Y + BTN_H / 2 + 9, `D${handCardInst.dimension - 2}×3→D${handCardInst.dimension}`, { fontSize: '9px', fill: '#886633', fontFamily: 'monospace' }).setOrigin(0.5, 0.5));
    const z3 = this.add.zone(b3x, BTN_Y, BTN_W, BTN_H).setOrigin(0, 0).setInteractive();
    z3.on('pointerdown', () => close(cands3, 3));
    z3.on('pointerover', () => this.input.setDefaultCursor('pointer'));
    z3.on('pointerout',  () => this.input.setDefaultCursor('default'));
    con.add(z3);

    // キャンセル
    con.add(this.add.text(cx, my + mH - 22, 'キャンセル', {
      fontSize: '10px', fill: '#cc6677', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5));
    const zCancel = this.add.zone(cx - 60, my + mH - 34, 120, 24).setOrigin(0, 0).setInteractive();
    zCancel.on('pointerdown', () => close(null, 0));
    zCancel.on('pointerover', () => this.input.setDefaultCursor('pointer'));
    zCancel.on('pointerout',  () => this.input.setDefaultCursor('default'));
    con.add(zCancel);
  }

  _clearAttackSelection() {
    if (this._selectedAttacker) {
      this._selectedAttacker.setSelected(false);
      this._selectedAttacker = null;
    }
    this._unhighlightAllTargets();
  }

  // ===== 手札UI =====

  _refreshHandUI(hand) {
    for (const obj of this._handCardObjects) {
      if (obj && obj.scene) obj.destroy();
    }
    this._handCardObjects = [];

    const scaledW = CARD_W * HAND_SCALE;
    const maxSpacing = scaledW + 10;
    const spacing = hand.length > 1 ? Math.min(maxSpacing, 680 / (hand.length - 1)) : maxSpacing;
    const startX = W / 2 - ((hand.length - 1) * spacing) / 2;

    for (let i = 0; i < hand.length; i++) {
      const inst = hand[i];
      const x = startX + i * spacing;
      const isNew = this._pendingDrawnIds.has(inst.instanceId);
      if (isNew) this._pendingDrawnIds.delete(inst.instanceId);

      const cardObj = new Card(this, x, HAND_Y, inst);
      cardObj.setScale(HAND_SCALE);
      cardObj._handX = x;
      this._handCardObjects.push(cardObj);

      if (isNew) {
        // デッキ位置から手札へフライイン
        cardObj.setPosition(EZ_X, EZ_Y);
        cardObj.setScale(0.4);
        cardObj.setAlpha(0.8);
        const delay = 0;
        this.tweens.add({
          targets: cardObj,
          x, y: HAND_Y,
          scaleX: HAND_SCALE, scaleY: HAND_SCALE,
          alpha: 1,
          duration: 380,
          delay,
          ease: 'Power2.easeOut',
        });
      }

      cardObj.on('pointerover', () => {
        if (!this._aiLocked && !this._isDraggingHandCard) {
          this.input.setDefaultCursor('grab');
          this.tweens.add({ targets: cardObj, y: HAND_Y - 22, duration: 150, ease: 'Power2' });
        }
      });
      cardObj.on('pointerout', () => {
        if (!this._isDraggingHandCard) {
          this.input.setDefaultCursor('default');
          this.tweens.add({ targets: cardObj, y: HAND_Y, duration: 150, ease: 'Power2' });
        }
      });

      // D1+ カードはドラッグして自軍バトルフィールドにドロップで融合召喚
      if (inst.dimension >= 1) {
        this.input.setDraggable(cardObj);

        cardObj.on('dragstart', () => {
          if (this._aiLocked || this._gameOver || this._modalOpen) return;
          const state = this._gm.state;
          if (state.phase !== 'main' || state.currentPlayer !== 'player') return;
          this._isDraggingHandCard = true;
          this._hideTooltip();
          this.tweens.killTweensOf(cardObj);
          this.children.bringToTop(cardObj);
          this.input.setDefaultCursor('grabbing');
          this._highlightFusionCandidates(inst);
        });

        cardObj.on('drag', (pointer, dragX, dragY) => {
          if (!this._isDraggingHandCard) return;
          cardObj.x = dragX;
          cardObj.y = dragY;
        });

        cardObj.on('dragend', (pointer) => {
          if (!this._isDraggingHandCard) return;
          this._isDraggingHandCard = false;
          this._clearFusionHighlight();
          this.input.setDefaultCursor('default');

          const onField = this._isOnPlayerBattleField(pointer.x, pointer.y);
          const fusionOk = onField && this._attemptFusionDrop(inst, cardObj);

          if (!fusionOk && cardObj.active) {
            this.tweens.add({
              targets: cardObj,
              x: cardObj._handX,
              y: HAND_Y,
              scaleX: HAND_SCALE,
              scaleY: HAND_SCALE,
              duration: 200,
              ease: 'Power2',
            });
          }
        });
      }

      this._attachTooltip(cardObj);
    }
  }

  // ===== AIターン =====

  async _runAITurn() {
    if (this._gameOver) return;
    this._hideTooltip();
    this._aiLocked = true;
    this.input.enabled = false;
    await this._gm.executeAITurn(this);
    if (!this._gameOver) {
      this.input.enabled = true;
      this._aiLocked = false;
    }
  }

  // ===== ユーティリティ =====

  _fieldPosition(owner, instanceId) {
    const slots = this._gm.state.field.getSlots(owner);
    const idx = slots.findIndex(c => c && c.instanceId === instanceId);
    const slotIdx = idx === -1 ? 0 : idx;
    const x = FIELD_X_START + slotIdx * SLOT_GAP;
    const y = owner === 'player' ? PLAYER_BATTLE_Y : AI_BATTLE_Y;
    return { x, y };
  }

  _specialFieldPos(_owner) {
    // 共有特別フィールドは画面中央1箇所のみ
    return { x: W / 2, y: SHARED_SPECIAL_Y };
  }

  _repositionFieldCards(owner) {
    const slots = this._gm.state.field.getSlots(owner);
    const baseY = owner === 'player' ? PLAYER_BATTLE_Y : AI_BATTLE_Y;
    for (let i = 0; i < 5; i++) {
      const inst = slots[i];
      if (!inst) continue;
      const cardObj = this._cardObjects[inst.instanceId];
      if (!cardObj) continue;
      const tx = FIELD_X_START + i * SLOT_GAP;
      this.tweens.add({ targets: cardObj, x: tx, y: baseY, duration: 200, ease: 'Power2' });
    }
  }

  _showDamageNumber(x, y, amount, color = '#ff4444') {
    const txt = this.add.text(x, y - 20, `-${amount}`, {
      fontSize: '20px', fill: color, fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: txt,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  _flashEffect(x, y) {
    const flash = this.add.graphics();
    flash.fillStyle(0xffd700, 0.5);
    flash.fillCircle(x, y, 50);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 3,
      scaleY: 3,
      duration: 500,
      onComplete: () => flash.destroy(),
    });
  }

  // 拡張する衝撃波リング
  _shockwaveRing(x, y, color, maxScale = 3, duration = 450) {
    const g = this.add.graphics().setDepth(50);
    g.lineStyle(2.5, color, 0.9);
    g.strokeCircle(x, y, 36);
    this.tweens.add({
      targets: g, scaleX: maxScale, scaleY: maxScale, alpha: 0,
      duration, ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  // 放射状パーティクルバースト（小矩形）
  _particleBurst(x, y, count, color, maxRadius = 80) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const r = maxRadius * (0.5 + Math.random() * 0.5);
      const g = this.add.graphics().setDepth(55);
      const sz = 2.5 + Math.random() * 2.5;
      g.fillStyle(color, 1);
      g.fillRect(-sz / 2, -sz / 2, sz, sz);
      g.x = x; g.y = y;
      this.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * r,
        y: y + Math.sin(angle) * r,
        alpha: 0,
        scaleX: 0.2, scaleY: 0.2,
        duration: 380 + Math.random() * 260,
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }
  }

  // デッキエリアの光るフラッシュ（ドロー時）
  _deckGlowEffect() {
    const g = this.add.graphics().setDepth(60);
    g.fillStyle(0x88ccff, 0.65);
    g.fillCircle(EZ_X, EZ_Y, 52);
    this.tweens.add({
      targets: g, alpha: 0, scaleX: 2.2, scaleY: 2.2,
      duration: 350, ease: 'Power2',
      onComplete: () => g.destroy(),
    });
    // 小さなスパーク（上向き）
    for (let i = 0; i < 6; i++) {
      const spark = this.add.graphics().setDepth(60);
      spark.fillStyle(0xaaddff, 1);
      spark.fillRect(-2, -2, 4, 4);
      spark.x = EZ_X + (Math.random() - 0.5) * 40;
      spark.y = EZ_Y + (Math.random() - 0.5) * 30;
      this.tweens.add({
        targets: spark,
        y: spark.y - 40 - Math.random() * 30,
        alpha: 0,
        duration: 300 + Math.random() * 200,
        ease: 'Power2',
        onComplete: () => spark.destroy(),
      });
    }
  }

  // 融合時のエネルギー収束ライン
  _fusionEnergyLines(srcObjs, cx, cy) {
    for (const obj of srcObjs) {
      const line = this.add.graphics().setDepth(58);
      line.lineStyle(2, 0xffd700, 0.85);
      line.lineBetween(obj.x, obj.y, cx, cy);
      this.tweens.add({
        targets: line, alpha: 0,
        duration: 420, ease: 'Power2',
        onComplete: () => line.destroy(),
      });
      // 軌跡パーティクル
      const steps = 5;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const px = obj.x + (cx - obj.x) * t;
        const py = obj.y + (cy - obj.y) * t;
        const dot = this.add.graphics().setDepth(59);
        dot.fillStyle(0xffd700, 0.9);
        dot.fillCircle(px, py, 3);
        this.tweens.add({
          targets: dot, alpha: 0, scaleX: 0.1, scaleY: 0.1,
          delay: s * 40,
          duration: 300, ease: 'Power2',
          onComplete: () => dot.destroy(),
        });
      }
    }
    // 中心フラッシュ
    this.time.delayedCall(380, () => {
      const flash = this.add.graphics().setDepth(62);
      flash.fillStyle(0xffffff, 0.8);
      flash.fillCircle(cx, cy, 30);
      this.tweens.add({
        targets: flash, alpha: 0, scaleX: 2.5, scaleY: 2.5,
        duration: 300, ease: 'Power2',
        onComplete: () => flash.destroy(),
      });
    });
  }

  // D4 グランドエントランス（召喚前に走るエフェクト群）
  _d4GrandEntrance(x, y) {
    // カメラシェイク
    this.cameras.main.shake(500, 0.018);
    // ゴールドカメラフラッシュ
    this.cameras.main.flash(350, 255, 215, 0);

    // 多重衝撃波
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 120, () => {
        this._shockwaveRing(x, y, 0xffd700, 4.5 + i * 0.5, 600 + i * 80);
      });
    }

    // ゴールドパーティクル大放出
    this._particleBurst(x, y, 18, 0xffd700, 120);
    this._particleBurst(x, y, 10, 0xffffff, 80);

    // 回転するスパークリング
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 55;
      const sp = this.add.graphics().setDepth(65);
      sp.fillStyle(0xffd700, 1);
      sp.fillCircle(0, 0, 4);
      sp.x = x + Math.cos(angle) * r;
      sp.y = y + Math.sin(angle) * r;
      this.tweens.add({
        targets: sp,
        x: x + Math.cos(angle + Math.PI) * r * 1.6,
        y: y + Math.sin(angle + Math.PI) * r * 1.6,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 700,
        ease: 'Power2',
        onComplete: () => sp.destroy(),
      });
    }
  }

  // フィールド効果発動アナウンステキスト
  _fieldEffectAnnounce(text, color) {
    const txt = this.add.text(W / 2, H / 2 + 60, text, {
      fontSize: '22px', fill: color, fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setAlpha(0).setDepth(201);

    this.tweens.chain({
      targets: txt,
      tweens: [
        { alpha: 1, scaleX: 1.1, scaleY: 1.1, y: H / 2 + 40, duration: 200, ease: 'Back.easeOut' },
        { scaleX: 1, scaleY: 1, duration: 100 },
        { alpha: 0, y: H / 2 + 20, duration: 400, delay: 900, ease: 'Power2',
          onComplete: () => txt.destroy() },
      ],
    });
  }

  // フェーズ切り替え時に画面中央に大きく表示 → 1秒後にフェードアウト
  _showPhaseAnim(text) {
    if (this._phaseFlyText && this._phaseFlyText.active) {
      this.tweens.killTweensOf(this._phaseFlyText);
      this._phaseFlyText.destroy();
    }
    this._phaseFlyText = null;

    const txt = this.add.text(W / 2, H / 2 - 40, text, {
      fontSize: '38px', fill: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setAlpha(0).setDepth(200);
    this._phaseFlyText = txt;

    this.tweens.add({
      targets: txt,
      alpha: 1,
      y: H / 2 - 50,
      duration: 180,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(800, () => {
          if (!txt.active) return;
          this.tweens.add({
            targets: txt,
            alpha: 0,
            duration: 300,
            onComplete: () => { if (txt.active) txt.destroy(); },
          });
        });
      },
    });
  }

  _log(msg) {
    for (let i = this._logTexts.length - 1; i > 0; i--) {
      this._logTexts[i].setText(this._logTexts[i - 1].text);
      this._logTexts[i].setAlpha(Math.max(0.12, 1 - i * 0.15));
    }
    this._logTexts[0].setText(msg);
    this._logTexts[0].setAlpha(1);
  }

  _updateBuffDebuffPanels(state) {
    if (!this._aiBdpTexts || !this._plBdpTexts) return;
    this._renderFieldStatusPanel(state, 'ai',     this._aiBdpTexts);
    this._renderFieldStatusPanel(state, 'player', this._plBdpTexts);
  }

  _renderFieldStatusPanel(state, owner, textObjs) {
    const lines = [];
    const cards = state.field.getFilledSlots(owner);

    // D4フィールド効果
    const fe = state.field.getActiveFieldEffect(owner);
    if (fe) {
      const feInfo = {
        field_delta: { icon: '△', label: '次元崩壊 全ATK+2',   color: '#ff6655' },
        field_sigma: { icon: '○', label: '次元加速 毎T+1Draw',  color: '#5599ff' },
        field_omega: { icon: '□', label: '次元要塞 被ダメ×0.5', color: '#44cc99' },
      }[fe];
      if (feInfo) lines.push({ text: `${feInfo.icon} ${feInfo.label}`, color: feInfo.color });
    }

    // Omega 3Dが在場: 全体DEF+2（フィールド持続効果として表示）
    const hasOmega3d = cards.some(c => c.effect_id === 'omega_3d_def_boost');
    if (hasOmega3d) {
      lines.push({ text: 'Ω3D 全体DEF+2', color: '#44ddaa' });
    }

    // Omega ATKデバフ累計: このフィールドのカードが受けた累計ATK低下
    let atkDebuffTotal = 0;
    for (const c of cards) {
      if (c.dimension === 0 || c.dimension >= 4) continue;
      const delta = (c.currentAtk ?? 0) - (c.baseAtk ?? 0);
      if (delta < 0) atkDebuffTotal += delta;
    }
    if (atkDebuffTotal < 0) {
      lines.push({ text: `Ωデバフ ATK合計${atkDebuffTotal}`, color: '#88aaff' });
    }

    if (lines.length === 0) {
      lines.push({ text: 'フィールド効果なし', color: '#334455' });
    }

    for (let i = 0; i < textObjs.length; i++) {
      if (i < lines.length) {
        textObjs[i].setText(lines[i].text);
        textObjs[i].setStyle({ fill: lines[i].color });
        textObjs[i].setAlpha(1);
      } else {
        textObjs[i].setText('');
      }
    }
  }

  _updateSummonGauge(state) {
    if (!this._summonGaugeGfx) return;
    const g = this._summonGaugeGfx;
    g.clear();

    const isPlayerTurn = state.currentPlayer === 'player';
    let used, maxS;
    if (isPlayerTurn) {
      used = state.player.normalSummonCount;
      maxS = GameManager.calcMaxSummons(state.turn, 'player');
    } else {
      // AIターン中: 次のプレイヤーターンの上限をプレビュー
      used = 0;
      maxS = GameManager.calcMaxSummons(state.turn + 1, 'player');
    }
    const remaining = maxS - used;
    const dimAlpha = isPlayerTurn ? 1 : 0.4;

    const DOT_R = 7;
    const DOT_GAP = 16;
    const totalW = maxS * DOT_R * 2 + (maxS - 1) * DOT_GAP;
    const startX = EZ_X - totalW / 2 + DOT_R;
    const dotY = EZ_Y + EZ_H / 2 + 34;

    for (let i = 0; i < maxS; i++) {
      const x = startX + i * (DOT_R * 2 + DOT_GAP);
      if (i < remaining) {
        g.fillStyle(0xffd700, dimAlpha * 0.9);
        g.fillCircle(x, dotY, DOT_R);
        g.lineStyle(1, 0xffcc00, dimAlpha * 0.7);
        g.strokeCircle(x, dotY, DOT_R);
      } else {
        g.fillStyle(0x221a00, dimAlpha * 0.6);
        g.fillCircle(x, dotY, DOT_R);
        g.lineStyle(1.5, 0x554400, dimAlpha * 0.5);
        g.strokeCircle(x, dotY, DOT_R);
      }
    }

    this._summonGaugeText.setText(`召喚 ${remaining} / ${maxS}`);
    this._summonGaugeText.setAlpha(dimAlpha);
  }

  _updateButtonStates(state) {
    if (!state) return;
    const isPlayerTurn = state.currentPlayer === 'player' && !this._aiLocked;
    const isMain = state.phase === 'main';
    const isAttack = state.phase === 'attack';

    const maxS = GameManager.calcMaxSummons(state.turn, 'player');
    const canSummon = state.player.normalSummonCount < maxS;
    this._summonBtn.setAlpha(isPlayerTurn && isMain && canSummon ? 1 : 0.4);
    this._phaseBtn.setAlpha(isPlayerTurn && isMain ? 1 : 0.4);
    this._endTurnBtn.setAlpha(isPlayerTurn && isAttack ? 1 : 0.4);
  }

  // 画像ボタン（Phaser.GameObjects.Image を返す、setAlpha で有効/無効切替）
  _makeImageButton(x, y, key, displayW, displayH, onClick) {
    const img = this.add.image(x, y, key).setDisplaySize(displayW, displayH);
    img.setInteractive();
    const bsX = img.scaleX, bsY = img.scaleY;

    img.on('pointerover', () => {
      if (img.alpha < 0.5) return;
      this.tweens.add({ targets: img, scaleX: bsX * 1.04, scaleY: bsY * 1.04, duration: 80, ease: 'Power2' });
      this.input.setDefaultCursor('pointer');
    });
    img.on('pointerout', () => {
      this.tweens.add({ targets: img, scaleX: bsX, scaleY: bsY, duration: 80 });
      this.input.setDefaultCursor('default');
    });
    img.on('pointerdown', () => { if (img.alpha > 0.5) onClick(); });

    return img;
  }

  // ===== ツールチップ =====

  _initTooltip() {
    this._tooltipContainer = null;
    this._tooltipTimer = null;
  }

  _attachTooltip(cardObj) {
    cardObj.on('pointerover', () => {
      if (this._tooltipTimer) { this._tooltipTimer.remove(); this._tooltipTimer = null; }
      this._tooltipTimer = this.time.delayedCall(500, () => {
        this._tooltipTimer = null;
        if (cardObj.active) this._showTooltip(cardObj);
      });
    });
    cardObj.on('pointerout', () => {
      if (this._tooltipTimer) { this._tooltipTimer.remove(); this._tooltipTimer = null; }
      this._hideTooltip();
    });
  }

  _showTooltip(cardObj) {
    this._hideTooltip();

    const inst = cardObj.cardInstance;
    const content = this._tooltipContent(inst);
    const passive = this._tooltipPassive(inst);
    const padding = 8;
    const arrowH = 10;

    // パッシブ行込みでサイズを計測
    const fullContent = passive ? content + '\n\n' + passive.text : content;
    const probe = this.add.text(0, -9999, fullContent, {
      fontSize: '12px', fill: '#fff', fontFamily: 'monospace',
    });
    const tooltipW = Math.max(probe.width + padding * 2, 160);
    const tooltipH = Math.max(probe.height + padding * 2, 30);
    probe.destroy();

    const cardHalfH = (CARD_H / 2) * (cardObj.scaleY || 1);
    const cardTopWorldY = cardObj.y - cardHalfH;
    const showBelow = cardTopWorldY - arrowH - tooltipH < 10;

    const tooltipX = Phaser.Math.Clamp(cardObj.x, tooltipW / 2 + 4, W - tooltipW / 2 - 4);
    const tooltipY = showBelow
      ? cardObj.y + cardHalfH + arrowH + tooltipH / 2
      : cardObj.y - cardHalfH - arrowH - tooltipH / 2;

    const container = this.add.container(tooltipX, tooltipY).setDepth(1000);

    const bg = this.add.graphics();

    // Fill: box + arrow
    bg.fillStyle(0x080c1e, 0.94);
    bg.fillRoundedRect(-tooltipW / 2, -tooltipH / 2, tooltipW, tooltipH, 6);

    const arrowBaseX = Phaser.Math.Clamp(cardObj.x - tooltipX, -tooltipW / 2 + 14, tooltipW / 2 - 14);
    if (showBelow) {
      bg.fillTriangle(arrowBaseX - 8, -tooltipH / 2, arrowBaseX + 8, -tooltipH / 2, arrowBaseX, -tooltipH / 2 - arrowH);
    } else {
      bg.fillTriangle(arrowBaseX - 8, tooltipH / 2, arrowBaseX + 8, tooltipH / 2, arrowBaseX, tooltipH / 2 + arrowH);
    }

    // Border: box
    bg.lineStyle(1, 0x3a7abf, 0.9);
    bg.strokeRoundedRect(-tooltipW / 2, -tooltipH / 2, tooltipW, tooltipH, 6);

    // Border: arrow sides only (not the base, which merges with box border)
    if (showBelow) {
      bg.lineBetween(arrowBaseX - 8, -tooltipH / 2, arrowBaseX, -tooltipH / 2 - arrowH);
      bg.lineBetween(arrowBaseX + 8, -tooltipH / 2, arrowBaseX, -tooltipH / 2 - arrowH);
    } else {
      bg.lineBetween(arrowBaseX - 8, tooltipH / 2, arrowBaseX, tooltipH / 2 + arrowH);
      bg.lineBetween(arrowBaseX + 8, tooltipH / 2, arrowBaseX, tooltipH / 2 + arrowH);
    }

    const text = this.add.text(
      -tooltipW / 2 + padding,
      -tooltipH / 2 + padding,
      content,
      {
        fontSize: '12px', fill: '#c8d8f0', fontFamily: 'monospace',
        align: 'left',
      }
    ).setOrigin(0, 0);

    container.add([bg, text]);

    // パッシブ行を型の色で描画
    if (passive) {
      const passText = this.add.text(
        -tooltipW / 2 + padding,
        -tooltipH / 2 + padding + text.height + 4,
        passive.text,
        { fontSize: '12px', fill: passive.color, fontFamily: 'monospace', fontStyle: 'bold' }
      ).setOrigin(0, 0);
      container.add(passText);
    }

    this._tooltipContainer = container;
  }

  _tooltipPassive(inst) {
    if (!inst.type || inst.dimension < 1 || inst.dimension > 3) return null;
    const p = TYPE_PASSIVES[inst.type];
    if (!p) return null;
    const text = typeof p.desc === 'function' ? p.desc(inst.dimension) : p.desc;
    return { text, color: p.color };
  }

  _hideTooltip() {
    if (this._tooltipContainer) {
      this._tooltipContainer.destroy();
      this._tooltipContainer = null;
    }
  }

  _tooltipContent(inst) {
    const typeNames = { delta: 'Delta (δ)', sigma: 'Sigma (σ)', omega: 'Omega (Ω)' };
    const typeLine = inst.type ? typeNames[inst.type] : 'No Type';

    const lines = [];
    lines.push(inst.name);
    lines.push(`D${inst.dimension}  ${typeLine}`);

    if (inst.dimension >= 1 && inst.dimension <= 3) {
      lines.push(`ATK:${inst.currentAtk}  DEF:${inst.currentDef}  HP:${inst.currentHp}/${inst.maxHp}`);
    }

    if (inst.effect_desc) {
      lines.push('');
      // Strip the "フィールド効果：" prefix (already implied by D4 label above)
      const desc = inst.effect_desc.replace('フィールド効果：', '');
      // Pre-wrap at 20 full-width-char columns (MAX=40 half-width units ≈ 288px at 12px mono)
      lines.push(this._wrapJaText(desc, 20));
    }

    return lines.join('\n');
  }

  // Wrap mixed Japanese/ASCII text by half-width units (CJK≥0x3000 = 2, ASCII = 1)
  _wrapJaText(text, maxDoubleWidthChars) {
    const MAX = maxDoubleWidthChars * 2;
    const result = [];
    let line = '', w = 0;
    for (const ch of text) {
      const cw = ch.charCodeAt(0) >= 0x3000 ? 2 : 1;
      if (w + cw > MAX && line) {
        result.push(line);
        line = ch;
        w = cw;
      } else {
        line += ch;
        w += cw;
      }
    }
    if (line) result.push(line);
    return result.join('\n');
  }

}
