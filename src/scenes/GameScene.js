import { GameManager } from '../game/GameManager.js';
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
    this.load.image('playerHpImg',   'assets/material/playerHP.png');
    this.load.image('enemyHpImg',    'assets/material/enemyHP.png');
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
    this._initTooltip();
    this.input.dragDistanceThreshold = 8;

    this._gm = new GameManager();
    this._bindEvents();
    this._gm.startGame();
  }

  _drawBg() {
    this.add.image(W / 2, H / 2, 'bg').setDisplaySize(W, H);
    // 可読性向上のための暗幕オーバーレイ
    const ov = this.add.graphics();
    ov.fillStyle(0x000000, 0.42);
    ov.fillRect(0, 0, W, H);
  }

  _drawFieldLayout() {
    // ── 描画順: special(最下層) → enemyField → yourField(最上層) ──
    // specialが大きくてバトルフィールドと被っても、バトルフィールドが上に描かれるので隠れない

    // 1. 共有特別フィールド（最下層・540×360で大胆に大きく）
    // specialField_transparent.png: 1536×1024(3:2) → 540×360 で原比率維持
    this._sharedSpecialImg = this.add.image(W / 2, SHARED_SPECIAL_Y, 'specialFldImg')
      .setDisplaySize(540, 360).setAlpha(0.75);

    // 2. AI バトルフィールド（中層・高さ183px）
    this.add.image(W / 2, AI_BATTLE_Y,     'enemyFieldImg').setDisplaySize(726, 183);

    // 3. Player バトルフィールド（最上層・高さ200px: 少し縦に引き伸ばし）
    this.add.image(W / 2, PLAYER_BATTLE_Y, 'yourFieldImg') .setDisplaySize(726, 200);
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

    // ── AI HP パネル（左上） ──
    this.add.image(109, 48, 'enemyHpImg').setDisplaySize(214, 96);
    const aiCov = this.add.graphics();
    aiCov.fillStyle(0x050005, 0.92);
    aiCov.fillRect(5, 28, 98, 48);
    this._aiHpText = this.add.text(54, 52, '20', {
      fontSize: '24px', fill: '#ff4455', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this._aiHandCount = this.add.text(109, 98, '手札: 5', {
      fontSize: '9px', fill: '#884444', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // ── Player HP パネル（左下） ──
    this.add.image(109, H - 62, 'playerHpImg').setDisplaySize(214, 124);
    const plCov = this.add.graphics();
    plCov.fillStyle(0x000508, 0.92);
    plCov.fillRect(5, H - 100, 98, 50);
    this._playerHpText = this.add.text(54, H - 75, '20', {
      fontSize: '24px', fill: '#44ccff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this._playerHandCount = this.add.text(109, H - 128, '手札: 5', {
      fontSize: '9px', fill: '#336688', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    // ── 右中央: 0D召喚ボタン（energyZone画像）──
    this._summonBtn = this._makeImageButton(EZ_X, EZ_Y, 'energyZoneImg', EZ_W, EZ_H, () => this._onSummon());
    this.add.text(EZ_X, EZ_Y + EZ_H / 2 + 7, '0D  SUMMON', {
      fontSize: '10px', fill: '#00aaee', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

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

    this._updateButtonStates(state);
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
    const { owner, newCard, isSpecial, consumedA, consumedB, destroyedSpecial } = ev;

    // 待機する完了数: 通常2枚（consumedA/B）+ 既存4D破壊があれば+1
    let toWait = 2;
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
    if (objA) { delete this._cardObjects[consumedA.instanceId]; objA.playFusionAnim(spawnWhenReady); } else spawnWhenReady();
    if (objB) { delete this._cardObjects[consumedB.instanceId]; objB.playFusionAnim(spawnWhenReady); } else spawnWhenReady();

    this._log(`${owner === 'player' ? 'あなた' : 'AI'}が融合！→${newCard.name}`);
  }

  _spawnFusionResult(owner, card, isSpecial) {
    const pos = isSpecial ? this._specialFieldPos(owner) : this._fieldPosition(owner, card.instanceId);
    const cardObj = new Card(this, pos.x, pos.y, card);
    this._cardObjects[card.instanceId] = cardObj;
    this.time.delayedCall(10, () => cardObj.playSpawnAnim());

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
      const targetX = 54;
      const targetY = ev.defenderOwner === 'player' ? H - 75 : 52;
      attackerObj.playAttackAnim(targetX, targetY, () => {
        this._showDamageNumber(targetX, targetY, ev.damage, '#ff4444');
      });
      this._log(`${ev.attackerOwner === 'player' ? 'あなた' : 'AI'}が直接攻撃！${ev.damage}ダメージ`);
    }

    if (ev.defenderDied) {
      this._log(`カードを撃破！余剰ダメージ: ${ev.overkill}`);
    }
  }

  _onFieldEffectActivated(ev) {
    const labels = {
      field_delta: '次元崩壊発動！全カードATK+2',
      field_sigma: '次元加速発動！毎ターン+1ドロー',
      field_omega: '次元要塞発動！ダメージ半減',
    };
    this._log(labels[ev.effectId] || '4Dフィールド効果発動');
    const pos = this._specialFieldPos(ev.owner);
    this._flashEffect(pos.x, pos.y);
    // 共有特別フィールド画像を輝かせる
    if (this._sharedSpecialImg) {
      this.tweens.add({ targets: this._sharedSpecialImg, alpha: 1, duration: 300, yoyo: true, hold: 600,
        onComplete: () => this._sharedSpecialImg.setAlpha(0.55) });
    }
  }

  _onGameOver(ev) {
    this._gameOver = true;
    this._aiLocked = true;
    const msg = ev.winner === 'player' ? '★ YOU WIN ★' : '✗ YOU LOSE ✗';
    const color = ev.winner === 'player' ? '#ffd700' : '#e63946';
    const txt = this.add.text(W / 2, H / 2, msg, {
      fontSize: '60px', fill: color, fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);
    this.tweens.add({ targets: txt, scaleX: 1.1, scaleY: 1.1, yoyo: true, repeat: 2, duration: 400, onComplete: () => {
      this.time.delayedCall(600, () => {
        this.scene.start('ResultScene', { winner: ev.winner, stats: ev.stats });
      });
    }});
  }

  _onPhaseChanged(ev) {
    const labels = { main: 'メインフェーズ', attack: '攻撃フェーズ' };
    this._showPhaseAnim(labels[ev.phase] || ev.phase);
    this._clearFusionSelection();
  }

  _onDrawCard(ev) {
    if (ev.owner === 'player') {
      // stateChangedで手札UIを更新するのでここでは何もしない
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
    const targetDim = handInst.dimension - 1;
    const fieldCards = this._gm.state.field.getFilledSlots('player');
    this._fusionCandidates = fieldCards.filter(c => c.dimension === targetDim).slice(0, 2);
    for (const inst of this._fusionCandidates) {
      const obj = this._cardObjects[inst.instanceId];
      if (obj) obj.setSelected(true);
    }
    // バトルフィールドをハイライト
    const canFuse = this._fusionCandidates.length >= 2;
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

    const targetDim = handCardInst.dimension - 1;
    const fieldCards = state.field.getFilledSlots('player');
    const candidates = fieldCards.filter(c => c.dimension === targetDim);

    if (candidates.length < 2) {
      this._log(`融合失敗: D${targetDim}のカードが2体必要です（現在${candidates.length}体）`);
      return false;
    }

    // 候補が3体以上: 選択ダイアログを表示（cardObjはキャンセル時に手札に戻す）
    if (candidates.length >= 3) {
      this._showFusionSelectModal(handCardInst, cardObj, candidates);
      return true;
    }

    const result = this._gm.fuse(
      'player',
      candidates[0].instanceId,
      candidates[1].instanceId,
      handCardInst.instanceId
    );
    if (!result.ok) {
      this._log(`融合失敗: ${result.reason}`);
      return false;
    }
    return true;
  }

  _showFusionSelectModal(handCardInst, cardObj, candidates) {
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

    // 全画面ブロッカー（背後のゲーム要素への入力を遮断）
    const blocker = this.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive();
    con.add(blocker);

    // 暗幕オーバーレイ
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, W, H);
    con.add(overlay);

    // パネル背景
    const panel = this.add.graphics();
    panel.fillStyle(0x080f1e, 0.97);
    panel.fillRoundedRect(mx, my, mW, mH, 12);
    panel.lineStyle(1.5, 0x2255aa, 0.85);
    panel.strokeRoundedRect(mx, my, mW, mH, 12);
    con.add(panel);

    // タイトル
    con.add(this.add.text(cx, my + 18, '融合素材を2体選択', {
      fontSize: '14px', fill: '#aaccff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));
    con.add(this.add.text(cx, my + 38, `D${handCardInst.dimension - 1} のカードを2枚選んでください`, {
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

    // 確定ボタン（参照を先に確保してupdateConfirmで使う）
    const confirmBtnGfx = this.add.graphics();
    const confirmBtnText = this.add.text(cx + 10 + 90, my + mH - FOOTER_H + 33, '融合実行', {
      fontSize: '12px', fill: '#88ccff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const updateConfirm = () => {
      const ready = selected.size === 2;
      confirmBtnGfx.clear();
      confirmBtnGfx.fillStyle(ready ? 0x0e2d6e : 0x0a1525, ready ? 0.95 : 0.6);
      confirmBtnGfx.fillRoundedRect(cx + 10, my + mH - FOOTER_H + 13, 180, 40, 8);
      confirmBtnGfx.lineStyle(1.5, ready ? 0x4488ff : 0x223344, ready ? 0.95 : 0.35);
      confirmBtnGfx.strokeRoundedRect(cx + 10, my + mH - FOOTER_H + 13, 180, 40, 8);
      confirmBtnText.setAlpha(ready ? 1 : 0.35);
    };

    // 候補カード行
    for (let i = 0; i < candidates.length; i++) {
      const inst = candidates[i];
      const ry = my + HEADER_H + i * ROW_H;
      const typeColor = TYPE_COL[inst.type] ?? 0x888888;
      const hexCol = '#' + typeColor.toString(16).padStart(6, '0');

      const rowBgGfx = this.add.graphics();
      drawRowBg(rowBgGfx, i, false);
      rowBgGfxList.push(rowBgGfx);
      con.add(rowBgGfx);

      // タイプカラーバー
      const typeBar = this.add.graphics();
      typeBar.fillStyle(typeColor, 0.9);
      typeBar.fillRoundedRect(mx + 14, ry + 10, 4, ROW_H - 20, 2);
      con.add(typeBar);

      // タイプ記号
      con.add(this.add.text(mx + 30, ry + ROW_H / 2, TYPE_SYM[inst.type] ?? '?', {
        fontSize: '15px', fill: hexCol, fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5));

      // カード名
      con.add(this.add.text(mx + 48, ry + ROW_H / 2 - 9, inst.name, {
        fontSize: '11px', fill: '#cce0ff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0, 0.5));

      // ステータス
      con.add(this.add.text(mx + 48, ry + ROW_H / 2 + 9,
        `ATK:${inst.currentAtk}  DEF:${inst.currentDef}  HP:${inst.currentHp}/${inst.maxHp}`, {
        fontSize: '9px', fill: '#7799bb', fontFamily: 'monospace',
      }).setOrigin(0, 0.5));

      // チェックマーク
      const chk = this.add.text(mx + mW - 20, ry + ROW_H / 2, '✓', {
        fontSize: '16px', fill: '#ffd700', fontFamily: 'monospace',
      }).setOrigin(0.5, 0.5).setAlpha(0);
      checkTexts.push(chk);
      con.add(chk);

      // クリック領域
      const hitZone = this.add.zone(mx + 8, ry + 4, mW - 16, ROW_H - 8).setOrigin(0, 0).setInteractive();
      hitZone.on('pointerdown', () => {
        if (selected.has(inst.instanceId)) {
          selected.delete(inst.instanceId);
          drawRowBg(rowBgGfxList[i], i, false);
          checkTexts[i].setAlpha(0);
        } else if (selected.size < 2) {
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

    // キャンセルボタン
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

    // 確定ボタン（Graphics/Textは先に宣言済み）
    con.add(confirmBtnGfx);
    con.add(confirmBtnText);
    updateConfirm();

    const confirmZone = this.add.zone(cx + 10, my + mH - FOOTER_H + 13, 180, 40).setOrigin(0, 0).setInteractive();
    confirmZone.on('pointerdown', () => {
      if (selected.size !== 2) return;
      const [idA, idB] = [...selected];
      const result = this._gm.fuse('player', idA, idB, handCardInst.instanceId);
      con.destroy(true);
      this._modalOpen = false;
      this.input.setDefaultCursor('default');
      if (!result.ok) {
        this._log(`融合失敗: ${result.reason}`);
      }
    });
    confirmZone.on('pointerover', () => { if (selected.size === 2) this.input.setDefaultCursor('pointer'); });
    confirmZone.on('pointerout',  () => this.input.setDefaultCursor('default'));
    con.add(confirmZone);
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
      const cardObj = new Card(this, x, HAND_Y, inst);
      cardObj.setScale(HAND_SCALE);
      cardObj._handX = x;
      this._handCardObjects.push(cardObj);

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

  _updateButtonStates(state) {
    if (!state) return;
    const isPlayerTurn = state.currentPlayer === 'player' && !this._aiLocked;
    const isMain = state.phase === 'main';
    const isAttack = state.phase === 'attack';

    this._summonBtn.setAlpha(isPlayerTurn && isMain && !state.player.hasNormalSummoned ? 1 : 0.4);
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
    const padding = 8;
    const arrowH = 10;

    // Measure actual rendered size — content is pre-wrapped so no wordWrap needed
    const probe = this.add.text(0, -9999, content, {
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
    this._tooltipContainer = container;
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
