import { GameManager } from '../game/GameManager.js';
import { Card } from '../objects/Card.js';

const W = 1280;
const H = 720;
const CARD_W = Card.CARD_W;
const CARD_H = Card.CARD_H;

// フィールドY座標
const AI_SPECIAL_Y    = 78;
const AI_BATTLE_Y     = 185;
const LOG_Y           = 355;
const PLAYER_BATTLE_Y = 455;
const PLAYER_SPECIAL_Y= 555;
const HAND_Y          = 638;

// 右サイドボタン (x=1160 は手札最大幅680px の右端1021px から 39px 離れた場所)
const BTN_X          = 1160;
const BTN_SUMMON_Y   = 557;
const BTN_PHASE_Y    = 622;
const BTN_END_Y      = 688;

// 対戦フィールド5スロットのX中心
const SLOT_GAP = 96;
const FIELD_X_START = W / 2 - SLOT_GAP * 2;

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
    this.load.image('specialFldImg', 'assets/material/energyZone.png');

    // カード画像 (delta=Red, sigma=Blue, omega=Green)
    const cardFiles = {
      'card_delta_1d': 'D1_Red',   'card_sigma_1d': 'D1_Blue',  'card_omega_1d': 'D1_Green',
      'card_delta_2d': 'D2_Red',   'card_sigma_2d': 'D2_Blue',  'card_omega_2d': 'D2_Green',
      'card_delta_3d': 'D3_Red',   'card_sigma_3d': 'D3_Blue',  'card_omega_3d': 'D3_Green',
    };
    for (const [key, file] of Object.entries(cardFiles)) {
      this.load.image(key, `assets/material/cards/${file}.png`);
    }
  }

  create() {
    this._drawBg();
    this._drawFieldLayout();
    this._initUI();

    this._cardObjects = {};
    this._handCardObjects = [];
    this._selectedForFusion = [];
    this._selectedAttacker = null;
    this._aiLocked = false;
    this._gameOver = false;

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
    // ── バトルフィールド画像 ──
    // enemyField.png: 679×228  yourField.png: 727×240
    this.add.image(W / 2, AI_BATTLE_Y,     'enemyFieldImg').setDisplaySize(726, 244);
    this.add.image(W / 2, PLAYER_BATTLE_Y, 'yourFieldImg') .setDisplaySize(726, 240);

    // ── 4D特別フィールドスロット（薄くガイド表示） ──
    // specialField_transparent.png: 331×316
    this._aiSpecialImg = this.add.image(W / 2, AI_SPECIAL_Y, 'specialFldImg')
      .setDisplaySize(82, 78).setAlpha(0.18);
    this._playerSpecialImg = this.add.image(W / 2, PLAYER_SPECIAL_Y, 'specialFldImg')
      .setDisplaySize(82, 78).setAlpha(0.18);

    // ── 中央セパレータ ──
    const sep = this.add.graphics();
    sep.fillStyle(0x010408, 0.80);
    sep.fillRect(0, LOG_Y - 28, W, 56);
    sep.lineStyle(1, 0x162030, 1);
    sep.strokeRect(0, LOG_Y - 28, W, 56);

    // 4D ラベル
    const d4s = { fontSize: '8px', fill: '#5a4500', fontFamily: 'monospace', letterSpacing: 3 };
    this.add.text(W / 2, AI_SPECIAL_Y - 45,      '4D  SPECIAL', d4s).setOrigin(0.5);
    this.add.text(W / 2, PLAYER_SPECIAL_Y + 44,  '4D  SPECIAL', d4s).setOrigin(0.5);
  }

  _initUI() {
    // ── バトルログ（中央セパレータ内） ──
    this._logTexts = [];
    for (let i = 0; i < 3; i++) {
      this._logTexts.push(
        this.add.text(W / 2, LOG_Y - 8 + i * 16, '', {
          fontSize: '10px', fill: '#6688aa', fontFamily: 'monospace',
        }).setOrigin(0.5, 0)
      );
    }

    // ── AI HP パネル（左上） ──
    // enemyHP.png: 320×204 → displaySize(214, 96)
    this.add.image(109, 48, 'enemyHpImg').setDisplaySize(214, 96);
    // 画像内「20」の上書き用暗幕
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
    // playerHP.png: 329×190 → displaySize(214, 124)
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

    // ── フェーズ / ターン表示 ──
    this._phaseText = this.add.text(W / 2, LOG_Y, 'メインフェーズ', {
      fontSize: '13px', fill: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this._turnText = this.add.text(W / 2 - 150, LOG_Y, 'Turn 1', {
      fontSize: '12px', fill: '#445566', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // ── 右サイド: 0D召喚ボタン（カスタム・青スタイル） ──
    this._summonBtn = this._makeSummonButton(BTN_X, BTN_SUMMON_Y, () => this._onSummon());

    // ── 右サイド: 攻撃フェーズ・ターン終了（画像ボタン） ──
    // battleButton.png: 406×132 → displaySize(218, 70)
    this._phaseBtn   = this._makeImageButton(BTN_X, BTN_PHASE_Y, 'battleBtnImg',  218, 70, () => this._onPhaseSwitch());
    // turnEndButton.png: 417×144 → displaySize(218, 65) (下端 720px 内に収まる)
    this._endTurnBtn = this._makeImageButton(BTN_X, BTN_END_Y,   'endTurnBtnImg', 218, 65, () => this._onEndTurn());

    // ── ダイレクトアタックゾーン（AI HP パネル領域を赤枠で囲む） ──
    this._directAttackZone = this.add.graphics();
    this._directAttackZone.lineStyle(2, 0xff2233, 0.9);
    this._directAttackZone.strokeRect(2, 2, 213, 95);
    this._directAttackZone.setAlpha(0);
    this._directAttackZone.setInteractive(
      new Phaser.Geom.Rectangle(2, 2, 213, 95),
      Phaser.Geom.Rectangle.Contains
    );
    this._directAttackZone.on('pointerdown', () => this._onDirectAttack());

    // ── 融合ボタン（特別フィールド上、非表示） ──
    this._fusionBtn = this._makeFusionButton(W / 2, PLAYER_SPECIAL_Y - 34);
    this._fusionBtn.setAlpha(0).setVisible(false);

    // ── フィールドエフェクト表示 ──
    this._playerFieldEffectText = this.add.text(W / 2, PLAYER_SPECIAL_Y + 46, '', {
      fontSize: '11px', fill: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this._aiFieldEffectText = this.add.text(W / 2, AI_SPECIAL_Y - 46, '', {
      fontSize: '11px', fill: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // ── 手札ラベル ──
    this.add.text(232, HAND_Y - 18, '手札', { fontSize: '10px', fill: '#2a3a4a', fontFamily: 'monospace' });
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
    }
    this._log(`${owner === 'player' ? 'あなた' : 'AI'}が${card.name}を召喚`);
  }

  _onCardDied(ev) {
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
    const { owner, newCard, isSpecial, consumedA, consumedB } = ev;
    const objA = this._cardObjects[consumedA.instanceId];
    const objB = this._cardObjects[consumedB.instanceId];
    let done = 0;
    const checkDone = () => {
      done++;
      if (done === 2) this._spawnFusionResult(owner, newCard, isSpecial);
    };
    if (objA) { delete this._cardObjects[consumedA.instanceId]; objA.playFusionAnim(checkDone); } else checkDone();
    if (objB) { delete this._cardObjects[consumedB.instanceId]; objB.playFusionAnim(checkDone); } else checkDone();

    this._log(`${owner === 'player' ? 'あなた' : 'AI'}が融合！→${newCard.name}`);
  }

  _spawnFusionResult(owner, card, isSpecial) {
    const pos = isSpecial ? this._specialFieldPos(owner) : this._fieldPosition(owner, card.instanceId);
    const cardObj = new Card(this, pos.x, pos.y, card);
    this._cardObjects[card.instanceId] = cardObj;
    this.time.delayedCall(10, () => cardObj.playSpawnAnim());

    if (owner === 'player') {
      this._setupPlayerCardInteraction(cardObj);
    }

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
    // 特別フィールド画像を輝かせる
    const specImg = ev.owner === 'player' ? this._playerSpecialImg : this._aiSpecialImg;
    if (specImg) {
      this.tweens.add({ targets: specImg, alpha: 0.9, duration: 300, yoyo: true, hold: 600,
        onComplete: () => specImg.setAlpha(0.18) });
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
    this._phaseText.setText(labels[ev.phase] || ev.phase);
    this._turnText.setText(`Turn ${ev.turn || this._gm.state?.turn || 1}`);
    this._clearFusionSelection();
  }

  _onDrawCard(ev) {
    if (ev.owner === 'player') {
      // stateChangedで手札UIを更新するのでここでは何もしない
    }
  }

  _onTurnChanged(ev) {
    const isPlayer = ev.currentPlayer === 'player';
    this._phaseText.setText(isPlayer ? 'あなたのターン' : 'AIのターン');
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

  _onPlayerCardClick(cardObj) {
    if (this._aiLocked || this._gameOver) return;
    const state = this._gm.state;
    if (state.currentPlayer !== 'player') return;
    const inst = cardObj.cardInstance;

    if (state.phase === 'main') {
      this._handleFusionSelection(cardObj, inst);
    } else if (state.phase === 'attack') {
      this._handleAttackSelection(cardObj, inst);
    }
  }

  _handleFusionSelection(cardObj, inst) {
    if (inst.dimension === 4) return;

    const idx = this._selectedForFusion.indexOf(cardObj);
    if (idx !== -1) {
      this._selectedForFusion.splice(idx, 1);
      cardObj.setSelected(false);
    } else {
      if (this._selectedForFusion.length >= 2) {
        this._selectedForFusion[0].setSelected(false);
        this._selectedForFusion.shift();
      }
      this._selectedForFusion.push(cardObj);
      cardObj.setSelected(true);
    }

    const showFusion = this._selectedForFusion.length === 2 &&
      this._selectedForFusion.every(c => this._isOnPlayerField(c));
    this._fusionBtn.setVisible(showFusion);
    this._fusionBtn.setAlpha(showFusion ? 1 : 0);
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

  _onFusion() {
    if (this._selectedForFusion.length !== 2) return;
    const state = this._gm.state;
    const [cardObjA, cardObjB] = this._selectedForFusion;
    const instA = cardObjA.cardInstance;
    const instB = cardObjB.cardInstance;

    const targetDim = instA.dimension + 1;
    const hand = state.player.hand;
    const handCard = hand.find(c => c.dimension === targetDim);
    if (!handCard) {
      this._log(`融合失敗: 手札に次元${targetDim}のカードがありません`);
      return;
    }

    const result = this._gm.fuse('player', instA.instanceId, instB.instanceId, handCard.instanceId);
    if (!result.ok) {
      this._log(`融合失敗: ${result.reason}`);
    } else {
      this._clearFusionSelection();
    }
  }

  _clearFusionSelection() {
    for (const c of this._selectedForFusion) c.setSelected(false);
    this._selectedForFusion = [];
    this._fusionBtn.setVisible(false);
    this._fusionBtn.setAlpha(0);
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

    // 10枚でも右サイドボタン(x≈1051〜)と重ならないよう最大幅680pxに収める
    const spacing = hand.length > 1 ? Math.min(90, 680 / (hand.length - 1)) : 90;
    const startX = W / 2 - ((hand.length - 1) * spacing) / 2;
    for (let i = 0; i < hand.length; i++) {
      const inst = hand[i];
      const x = startX + i * spacing;
      const cardObj = new Card(this, x, HAND_Y, inst);
      this._handCardObjects.push(cardObj);

      cardObj.on('pointerover', () => {
        if (!this._aiLocked) {
          this.input.setDefaultCursor('pointer');
          this.tweens.add({ targets: cardObj, y: HAND_Y - 15, duration: 150, ease: 'Power2' });
        }
      });
      cardObj.on('pointerout', () => {
        this.input.setDefaultCursor('default');
        this.tweens.add({ targets: cardObj, y: HAND_Y, duration: 150, ease: 'Power2' });
      });
      cardObj.on('pointerdown', () => this._onHandCardClick(cardObj, inst));
    }
  }

  _onHandCardClick(cardObj, inst) {
    if (this._aiLocked || this._gameOver) return;
    const state = this._gm.state;
    if (state.phase !== 'main' || state.currentPlayer !== 'player') return;
    if (inst.dimension === 0) return;

    const idx = this._selectedForFusion.indexOf(cardObj);
    if (idx !== -1) {
      this._selectedForFusion.splice(idx, 1);
      cardObj.setSelected(false);
    } else {
      if (this._selectedForFusion.length < 2) {
        this._selectedForFusion.push(cardObj);
        cardObj.setSelected(true);
      }
    }

    const twoFieldCards = this._selectedForFusion.filter(c => this._isOnPlayerField(c));
    const showFusion = twoFieldCards.length === 2;
    this._fusionBtn.setVisible(showFusion);
    this._fusionBtn.setAlpha(showFusion ? 1 : 0);
  }

  // ===== AIターン =====

  async _runAITurn() {
    if (this._gameOver) return;
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

  _specialFieldPos(owner) {
    return { x: W / 2, y: owner === 'player' ? PLAYER_SPECIAL_Y : AI_SPECIAL_Y };
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

  _log(msg) {
    for (let i = this._logTexts.length - 1; i > 0; i--) {
      this._logTexts[i].setText(this._logTexts[i - 1].text);
      this._logTexts[i].setAlpha(1 - i * 0.3);
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

  // 0D召喚ボタン（battleButton の青系スタイルに合わせたカスタムコンテナ）
  _makeSummonButton(x, y, onClick) {
    const bw = 200, bh = 52;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    const drawBg = (hover) => {
      bg.clear();
      bg.fillStyle(0x0055bb, hover ? 0.55 : 0.22);
      bg.lineStyle(2, hover ? 0x44ddff : 0x0099ee, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 4);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 4);
      if (!hover) {
        bg.lineStyle(1, 0x0077cc, 0.4);
        bg.strokeRect(-bw / 2 + 4, -bh / 2 + 4, bw - 8, bh - 8);
      }
    };
    drawBg(false);

    // ダイヤアイコン（フィールドスロットと共通のシンボル）
    const icon = this.add.text(-bw / 2 + 28, 0, '◇', {
      fontSize: '20px', fill: '#00aaee', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const title = this.add.text(18, -8, '0D SUMMON', {
      fontSize: '12px', fill: '#00bbff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    const sub = this.add.text(18, 7, 'ゼロ次元召喚', {
      fontSize: '8px', fill: '#005577', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);

    container.add([bg, icon, title, sub]);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh),
      Phaser.Geom.Rectangle.Contains
    );

    container.on('pointerover', () => {
      if (container.alpha < 0.5) return;
      drawBg(true);
      this.input.setDefaultCursor('pointer');
    });
    container.on('pointerout', () => { drawBg(false); this.input.setDefaultCursor('default'); });
    container.on('pointerdown', () => { if (container.alpha > 0.5) onClick(); });

    return container;
  }

  // 融合ボタン（黄金の角丸矩形、Container を返す）
  _makeFusionButton(x, y) {
    const bw = 130, bh = 34;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0xffd700, 0.18);
    bg.lineStyle(2, 0xffd700, 1);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);

    const label = this.add.text(0, 0, '⚡ 融合！', {
      fontSize: '13px', fill: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add([bg, label]);
    container.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);
    container.on('pointerover', () => { bg.setAlpha(1.6); this.input.setDefaultCursor('pointer'); });
    container.on('pointerout',  () => { bg.setAlpha(1);   this.input.setDefaultCursor('default'); });
    container.on('pointerdown', () => this._onFusion());

    return container;
  }
}
