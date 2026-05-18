import { CardLoader } from '../utils/CardLoader.js';

export class EffectHandler {
  constructor(gameState) {
    this.gameState = gameState;
  }

  checkIgnoreDef(attacker) {
    return attacker.effect_id === 'delta_1d_def_ignore';
  }

  checkPierceBlock(defender) {
    return defender.effect_id === 'omega_2d_pierce_block';
  }

  onKill(attacker, killed, owner, gameState, rawDamage) {
    if (attacker.effect_id === 'delta_3d_atk_boost') {
      attacker.currentAtk += 2;
    }

    if (attacker.effect_id === 'delta_2d_splash') {
      const opponentOwner = owner === 'player' ? 'ai' : 'player';
      const targets = gameState.field.getFilledSlots(opponentOwner).filter(c => c.instanceId !== killed.instanceId);
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        const splashDmg = Math.floor(rawDamage * 0.5);
        target.currentHp -= splashDmg;
        if (target.currentHp <= 0) {
          target.currentHp = 0;
          gameState.field.removeFromBattle(opponentOwner, target.instanceId);
        }
        return { target, damage: splashDmg };
      }
    }

    return null;
  }

  onAfterAttack(attacker, owner, gameState) {
    if (attacker.effect_id !== 'sigma_2d_draw_and_summon') return;

    const events = [];

    if (gameState[owner].deck.length > 0) {
      const drawn = gameState[owner].deck.splice(0, 1);
      if (gameState[owner].hand.length < 10) {
        gameState[owner].hand.push(...drawn);
        events.push({ type: 'draw', cards: drawn, owner });
      }
    }

    if (gameState.field.hasEmptyBattleSlot(owner)) {
      const zero = CardLoader.createCardInstance('0d');
      gameState.field.addToBattle(owner, zero);
      events.push({ type: 'additionalSummon', card: zero, owner });
    }

    return events;
  }

  onTurnEnd(owner, gameState) {
    const cards = gameState.field.getFilledSlots(owner);
    const healed = [];
    for (const card of cards) {
      if (card.effect_id === 'omega_1d_regen' && card.currentHp < card.maxHp) {
        card.currentHp = Math.min(card.maxHp, card.currentHp + 1);
        healed.push(card);
      }
    }
    return healed;
  }

  onSummon(inst, owner, gameState) {
    if (inst.effect_id !== 'omega_3d_def_boost') return;
    const cards = gameState.field.getFilledSlots(owner);
    for (const card of cards) {
      if (card.instanceId !== inst.instanceId) {
        card.currentDef += 2;
      }
    }
  }

  onFieldEffectActivate(effectId, owner) {
    // フィールド効果発動時の処理はGameManagerがイベント発行で対応
  }

  isDoubleAttacker(inst) {
    return inst.effect_id === 'sigma_1d_double_attack';
  }
}
