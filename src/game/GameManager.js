import { CardLoader } from '../utils/CardLoader.js';
import { Field } from './Field.js';
import { Combat } from './Combat.js';
import { EffectHandler } from './EffectHandler.js';
import { Fusion } from './Fusion.js';
import { AI } from './AI.js';

export class GameManager {
  constructor() {
    this._listeners = {};
    this.state = null;
    this.combat = null;
    this.effectHandler = null;
    this.fusion = null;
  }

  startGame() {
    const field = new Field();

    const playerDeck = CardLoader.buildDeck();
    const aiDeck = CardLoader.buildDeck();

    this.state = {
      phase: 'main',
      turn: 1,
      currentPlayer: 'player',
      player: {
        hp: 20,
        hand: [],
        deck: playerDeck,
        hasNormalSummoned: false,
        totalDamageDealt: 0,
        cardsSummoned: 0,
        fusionCount: 0,
      },
      ai: {
        hp: 20,
        hand: [],
        deck: aiDeck,
        hasNormalSummoned: false,
        totalDamageDealt: 0,
        cardsSummoned: 0,
        fusionCount: 0,
      },
      field,
    };

    this.effectHandler = new EffectHandler(this.state);
    this.combat = new Combat(field, this.effectHandler);
    this.fusion = new Fusion(field, this.effectHandler);

    this._dealInitialHand('player');
    this._dealInitialHand('ai');

    this._emit('stateChanged', this.state);
    this._emit('phaseChanged', { phase: 'main', currentPlayer: 'player', turn: 1 });
  }

  _dealInitialHand(owner) {
    for (let i = 0; i < 5; i++) {
      this.drawCard(owner, 1, true);
    }
  }

  drawCard(owner, count = 1, silent = false) {
    const ownerState = this.state[owner];
    let actualCount = count;
    if (this.state.field.getActiveFieldEffect(owner) === 'field_sigma' && !silent) {
      actualCount += 1;
    }

    const drawn = [];
    for (let i = 0; i < actualCount; i++) {
      if (ownerState.deck.length === 0) break;
      const card = ownerState.deck.shift();
      if (ownerState.hand.length < 10) {
        ownerState.hand.push(card);
        drawn.push(card);
      }
    }

    if (drawn.length > 0 && !silent) {
      this._emit('drawCard', { owner, cards: drawn });
      this._emit('stateChanged', this.state);
    }
    return drawn;
  }

  normalSummon(owner) {
    const ownerState = this.state[owner];
    if (ownerState.hasNormalSummoned) {
      return { ok: false, reason: 'このターンはすでに通常召喚済みです' };
    }
    if (!this.state.field.hasEmptyBattleSlot(owner)) {
      return { ok: false, reason: 'フィールドが満員です（最大5体）' };
    }

    const zero = CardLoader.createCardInstance('0d');
    this.state.field.addToBattle(owner, zero);
    ownerState.hasNormalSummoned = true;
    ownerState.cardsSummoned++;

    this._emit('cardSummoned', { owner, card: zero, isAdditional: false });
    this._emit('stateChanged', this.state);
    return { ok: true };
  }

  fuse(owner, instAId, instBId, handCardInstanceId) {
    const ownerState = this.state[owner];
    const handIdx = ownerState.hand.findIndex(c => c.instanceId === handCardInstanceId);
    if (handIdx === -1) return { ok: false, reason: '手札にカードが見つかりません' };

    const handCard = ownerState.hand[handIdx];
    const fieldCards = this.state.field.getFilledSlots(owner);
    const instA = fieldCards.find(c => c.instanceId === instAId);
    const instB = fieldCards.find(c => c.instanceId === instBId);

    const check = this.fusion.canFuse(instA, instB, handCard);
    if (!check.ok) return check;

    ownerState.hand.splice(handIdx, 1);

    const result = this.fusion.execute(owner, instA, instB, handCard, this.state);

    this._emit('fusionSuccess', {
      owner,
      newCard: result.newCard,
      isSpecial: result.isSpecial,
      consumedA: instA,
      consumedB: instB,
      destroyedSpecial: result.destroyedCard || null,  // 既存4Dカードが破壊された場合
    });
    if (result.isSpecial) {
      this._emit('fieldEffectActivated', { owner, effectId: result.newCard.effect_id });
    }
    this._emit('stateChanged', this.state);
    return { ok: true, result };
  }

  startAttackPhase() {
    if (this.state.phase !== 'main') return;
    this.state.phase = 'attack';
    const cards = this.state.field.getFilledSlots(this.state.currentPlayer);
    for (const c of cards) {
      c.hasAttacked = false;
      c.attackCount = 0;
    }
    this._emit('phaseChanged', { phase: 'attack', currentPlayer: this.state.currentPlayer });
    this._emit('stateChanged', this.state);
  }

  executeAttack(owner, attackerInstId, defenderInstId, defenderOwner, isDirectAttack = false) {
    const attackerCards = this.state.field.getFilledSlots(owner);
    const attacker = attackerCards.find(c => c.instanceId === attackerInstId);
    if (!attacker) return { ok: false, reason: '攻撃者が見つかりません' };

    const isDoubleAttacker = this.effectHandler.isDoubleAttacker(attacker);
    const maxAttacks = isDoubleAttacker ? 2 : 1;
    if (attacker.attackCount >= maxAttacks) {
      return { ok: false, reason: 'このカードはすでに攻撃済みです' };
    }

    if (isDirectAttack || !defenderInstId) {
      let dmg = attacker.currentAtk;
      if (this.state.field.getActiveFieldEffect(owner) === 'field_delta') dmg += 2;
      if (this.state.field.getActiveFieldEffect(defenderOwner) === 'field_delta') dmg += 2;
      const fieldOmega = this.state.field.getActiveFieldEffect(defenderOwner) === 'field_omega';
      const finalDmg = Math.floor(fieldOmega ? dmg * 0.5 : dmg);
      this.combat.applyPlayerDamage(defenderOwner, finalDmg, this.state);
      attacker.attackCount++;
      if (attacker.attackCount >= maxAttacks) attacker.hasAttacked = true;
      this.state[owner].totalDamageDealt += finalDmg;

      this._emit('attackResult', {
        damage: finalDmg,
        overkill: 0,
        defenderDied: false,
        attackerOwner: owner,
        defenderOwner,
        attackerId: attackerInstId,
        defenderId: null,
        directAttack: true,
        effects: [],
      });
      this._emit('stateChanged', this.state);
      this._checkGameOver();
      return { ok: true };
    }

    const defenderCards = this.state.field.getFilledSlots(defenderOwner);
    const defender = defenderCards.find(c => c.instanceId === defenderInstId);
    if (!defender) return { ok: false, reason: '対象カードが見つかりません' };

    const result = this.combat.executeAttack(attacker, defender, owner, defenderOwner, this.state);
    attacker.attackCount++;
    if (attacker.attackCount >= maxAttacks) attacker.hasAttacked = true;
    this.state[owner].totalDamageDealt += result.damage;

    const afterEffects = this.effectHandler.onAfterAttack(attacker, owner, this.state);
    if (afterEffects) {
      for (const ev of afterEffects) {
        if (ev.type === 'draw') {
          this._emit('drawCard', { owner, cards: ev.cards });
        } else if (ev.type === 'additionalSummon') {
          this._emit('cardSummoned', { owner, card: ev.card, isAdditional: true });
        }
      }
    }

    if (result.splashTarget && result.splashTarget.currentHp <= 0) {
      this._emit('cardDied', { owner: defenderOwner, card: result.splashTarget });
      this.state.field.compactSlots(defenderOwner);
    }

    if (result.defenderDied) {
      this._emit('cardDied', { owner: defenderOwner, card: defender });
      this.state.field.compactSlots(defenderOwner);
    }

    this._emit('attackResult', result);
    this._emit('stateChanged', this.state);
    this._checkGameOver();
    return { ok: true, result };
  }

  endTurn() {
    const owner = this.state.currentPlayer;

    const healed = this.effectHandler.onTurnEnd(owner, this.state);
    if (healed.length > 0) {
      this._emit('stateChanged', this.state);
    }

    this.state[owner].hasNormalSummoned = false;
    const cards = this.state.field.getFilledSlots(owner);
    for (const c of cards) {
      c.hasAttacked = false;
      c.attackCount = 0;
    }

    const nextPlayer = owner === 'player' ? 'ai' : 'player';
    this.state.currentPlayer = nextPlayer;
    this.state.phase = 'main';
    if (nextPlayer === 'player') this.state.turn++;

    this.drawCard(nextPlayer, 1);

    this._emit('turnChanged', { currentPlayer: nextPlayer, turn: this.state.turn });
    this._emit('phaseChanged', { phase: 'main', currentPlayer: nextPlayer, turn: this.state.turn });
    this._emit('stateChanged', this.state);

    if (nextPlayer === 'ai') {
      this._scheduleAITurn();
    }
  }

  _scheduleAITurn() {
    this._emit('aiTurnStart', {});
  }

  async executeAITurn(scene) {
    const owner = 'ai';

    await this._delay(scene, 600);

    const mainActions = AI.planMainPhase(this.state, this.state.field, this.effectHandler);
    for (const action of mainActions) {
      if (action.type === 'normalSummon') {
        this.normalSummon(owner);
        await this._delay(scene, 400);
      } else if (action.type === 'fuse') {
        const handIdx = this.state.ai.hand.findIndex(c => c.instanceId === action.handCardInstanceId);
        if (handIdx !== -1) {
          this.fuse(owner, action.instAId, action.instBId, action.handCardInstanceId);
          await this._delay(scene, 600);
        }
      }
    }

    this.startAttackPhase();
    await this._delay(scene, 400);

    const attackActions = AI.planAttackPhase(this.state, this.state.field);
    for (const act of attackActions) {
      const attacker = this.state.field.getFilledSlots(owner).find(c => c.instanceId === act.attackerInstanceId);
      if (!attacker) continue;

      const isDouble = this.effectHandler.isDoubleAttacker(attacker);
      const maxAtk = isDouble ? 2 : 1;
      if (attacker.attackCount >= maxAtk) continue;

      if (act.directAttack) {
        this.executeAttack(owner, act.attackerInstanceId, null, act.defenderOwner, true);
      } else {
        const defExists = this.state.field.getFilledSlots(act.defenderOwner).find(c => c.instanceId === act.defenderInstanceId);
        if (defExists) {
          this.executeAttack(owner, act.attackerInstanceId, act.defenderInstanceId, act.defenderOwner);
        } else {
          const remaining = this.state.field.getFilledSlots(act.defenderOwner);
          if (remaining.length > 0) {
            const fallback = remaining[Math.floor(Math.random() * remaining.length)];
            this.executeAttack(owner, act.attackerInstanceId, fallback.instanceId, act.defenderOwner);
          } else {
            this.executeAttack(owner, act.attackerInstanceId, null, act.defenderOwner, true);
          }
        }
      }
      await this._delay(scene, 500);

      if (this.state.ai.hp <= 0 || this.state.player.hp <= 0) break;
    }

    if (this.state.player.hp > 0 && this.state.ai.hp > 0) {
      await this._delay(scene, 400);
      this.endTurn();
    }
  }

  _delay(scene, ms) {
    return new Promise(resolve => scene.time.delayedCall(ms, resolve));
  }

  _checkGameOver() {
    if (this.state.player.hp <= 0) {
      this._emit('gameOver', { winner: 'ai', stats: this._buildStats() });
    } else if (this.state.ai.hp <= 0) {
      this._emit('gameOver', { winner: 'player', stats: this._buildStats() });
    }
  }

  _buildStats() {
    return {
      playerDamage: this.state.player.totalDamageDealt,
      aiDamage: this.state.ai.totalDamageDealt,
      playerFusions: this.state.player.fusionCount,
      aiFusions: this.state.ai.fusionCount,
      playerSummons: this.state.player.cardsSummoned,
      aiSummons: this.state.ai.cardsSummoned,
      turns: this.state.turn,
    };
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  off(event, cb) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== cb);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  }

  getState() {
    return this.state;
  }
}
