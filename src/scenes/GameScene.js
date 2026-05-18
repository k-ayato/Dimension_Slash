import { GameManager } from '../game/GameManager.js';
import { Card } from '../objects/Card.js';

const W = 1280;
const H = 720;
const CARD_W = Card.CARD_W;
const CARD_H = Card.CARD_H;

// フィールドY座標
const AI_SPECIAL_Y = 80;
const AI_BATTLE_Y = 185;
const LOG_Y = 360;
const PLAYER_BATTLE_Y = 460;
const PLAYER_SPECIAL_Y = 565;
const HAND_Y = 645;
const BTN_Y = 698;

// 対戦フィールド5スロットのX中心
const SLOT_GAP = 96;
const FIELD_X_START = W / 2 - SLOT_GAP * 2;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
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
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x050510, 0x050510, 0x0a1020, 0x0a1020, 1);
    bg.fillRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 1.2;
      bg.fillStyle(0xffffff, 0.2 + Math.random() * 0.4);
      bg.fillCircle(x, y, r);
    }
  }

  _drawFieldLayout() {
    const g = this.add.graphics();

    // AI フィールドヘッダ
    g.lineStyle(1, 0x334455, 0.6);
    g.strokeRect(10, 40, W - 20, 280);

    // プレイヤー フィールドヘッダ
    g.strokeRect(10, 420, W - 20, 260);

    // 中央セパレータ
    g.lineStyle(2, 0x334466, 0.8);
    g.strokeRect(40, 330, W - 80, 50);

    const labelStyle = { fontSize: '11px', fill: '#445566', fontFamily: 'monospace' };
    this.add.text(15, 44, 'AI', labelStyle);
    this.add.text(15, 424, 'PLAYER', labelStyle);
    this.add.text(W / 2, 42, '特別フィールド（4D）', { ...labelStyle, fill: '#ffd700' }).setOrigin(0.5, 0);
    this.add.text(W / 2, 152, '対戦フィールド', labelStyle).setOrigin(0.5, 0);
    this.add.text(W / 2, 435, '対戦フィールド', labelStyle).setOrigin(0.5, 0);
    this.add.text(W / 2, 543, '特別フィールド（4D）', { ...labelStyle, fill: '#ffd700' }).setOrigin(0.5, 0);
  }

  _initUI() {
    // バトルログ
    this._logTexts = [];
    for (let i = 0; i < 3; i++) {
      this._logTexts.push(
        this.add.text(W / 2, LOG_Y - 10 + i * 18, '', { fontSize: '11px', fill: '#8899aa', fontFamily: 'monospace' }).setOrigin(0.5, 0)
      );
    }

    // HP表示
    const hpStyle = { fontSize: '18px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' };
    this._playerHpText = this.add.text(W - 120, H - 80, 'HP: 20', hpStyle).setOrigin(1, 0.5);
    this._aiHpText = this.add.text(W - 120, 20, 'HP: 20', hpStyle).setOrigin(1, 0.5);
    this._playerHandCount = this.add.text(20, H - 80, '手札: 5', { fontSize: '13px', fill: '#aaaacc', fontFamily: 'monospace' });
    this._aiHandCount = this.add.text(20, 20, '手札: 5', { fontSize: '13px', fill: '#aaaacc', fontFamily: 'monospace' });

    // フェーズ表示
    this._phaseText = this.add.text(W / 2, 335, 'メインフェーズ', {
      fontSize: '14px', fill: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this._turnText = this.add.text(W / 2 - 120, 335, 'Turn 1', {
      fontSize: '13px', fill: '#aaaacc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // ボタン
    this._summonBtn = this._makeButton(W / 2 - 200, BTN_Y, '0D召喚', 0x4895ef, () => this._onSummon());
    this._phaseBtn = this._makeButton(W / 2, BTN_Y, '攻撃フェーズへ', 0xe67e22, () => this._onPhaseSwitch());
    this._endTurnBtn = this._makeButton(W / 2 + 200, BTN_Y, 'ターン終了', 0x9b59b6, () => this._onEndTurn());

    // 手札領域の説明
    this.add.text(20, HAND_Y - 20, '手札', { fontSize: '11px', fill: '#556677', fontFamily: 'monospace' });

    // ターゲットポインタ
    this._directAttackZone = this.add.graphics();
    this._directAttackZone.lineStyle(2, 0xff4444, 0.7);
    this._directAttackZone.strokeRect(W - 120, 10, 115, 35);
    this._directAttackZone.setAlpha(0);
    this._directAttackZone.setInteractive(new Phaser.Geom.Rectangle(W - 120, 10, 115, 35), Phaser.Geom.Rectangle.Contains);
    this._directAttackZone.on('pointerdown', () => this._onDirectAttack());

    // 融合ボタン（非表示）
    this._fusionBtn = this._makeButton(W / 2, HAND_Y - 30, '融合！', 0xffd700, () => this._onFusion());
    this._fusionBtn.setAlpha(0);
    this._fusionBtn.setVisible(false);

    // フィールドエフェクト表示
    this._playerFieldEffectText = this.add.text(W / 2, PLAYER_SPECIAL_Y + 50, '', {
      fontSize: '12px', fill: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this._aiFieldEffectText = this.add.text(W / 2, AI_SPECIAL_Y + 50, '', {
      fontSize: '12px', fill: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0.5);
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
    this._playerHpText.setText(`HP: ${state.player.hp}`);
    this._aiHpText.setText(`HP: ${state.ai.hp}`);
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
      const targetX = ev.defenderOwner === 'player' ? W - 60 : W - 60;
      const targetY = ev.defenderOwner === 'player' ? H - 60 : 20;
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

    const startX = W / 2 - ((hand.length - 1) * 90) / 2;
    for (let i = 0; i < hand.length; i++) {
      const inst = hand[i];
      const x = startX + i * 90;
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

  _makeButton(x, y, label, color, onClick) {
    const bw = 160;
    const bh = 38;
    const btn = this.add.graphics();
    btn.fillStyle(color, 0.3);
    btn.lineStyle(2, color, 1);
    btn.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    btn.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    btn.x = x;
    btn.y = y;
    btn.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);

    const labelStyle = { fontSize: '13px', fill: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' };
    const text = this.add.text(x, y, label, labelStyle).setOrigin(0.5);

    btn.on('pointerover', () => {
      if (btn.alpha < 0.5) return;
      btn.setAlpha(1.4);
      this.input.setDefaultCursor('pointer');
    });
    btn.on('pointerout', () => { btn.setAlpha(1); this.input.setDefaultCursor('default'); });
    btn.on('pointerdown', () => { if (btn.alpha > 0.5) onClick(); });

    return btn;
  }
}
