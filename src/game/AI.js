import { Fusion } from './Fusion.js';

export class AI {
  static planMainPhase(gameState, field, effectHandler) {
    const actions = [];
    const owner = 'ai';

    if (!gameState.ai.hasNormalSummoned && field.hasEmptyBattleSlot(owner) && Math.random() < 0.7) {
      actions.push({ type: 'normalSummon' });
    }

    const fusion = new Fusion(field, effectHandler);
    let keepFusing = true;
    while (keepFusing) {
      keepFusing = false;
      if (Math.random() > 0.7) break;

      const fieldCards = field.getFilledSlots(owner);
      const hand = gameState.ai.hand;

      for (let i = 0; i < fieldCards.length && !keepFusing; i++) {
        for (let j = i + 1; j < fieldCards.length && !keepFusing; j++) {
          const a = fieldCards[i];
          const b = fieldCards[j];
          if (a.dimension !== b.dimension) continue;

          const targetDim = a.dimension + 1;
          const handIdx = hand.findIndex(c => c.dimension === targetDim);
          if (handIdx === -1) continue;

          const { ok } = fusion.canFuse(a, b, hand[handIdx]);
          if (ok) {
            actions.push({
              type: 'fuse',
              instAId: a.instanceId,
              instBId: b.instanceId,
              handCardInstanceId: hand[handIdx].instanceId,
            });
            keepFusing = true;
            break;
          }
        }
      }
    }

    return actions;
  }

  static planAttackPhase(gameState, field) {
    const owner = 'ai';
    const opponentOwner = 'player';
    const attackActions = [];

    const attackers = field.getFilledSlots(owner).filter(c => !c.hasAttacked);
    const defenders = field.getFilledSlots(opponentOwner);

    for (const attacker of attackers) {
      if (defenders.length > 0) {
        const target = defenders[Math.floor(Math.random() * defenders.length)];
        attackActions.push({
          attackerInstanceId: attacker.instanceId,
          defenderInstanceId: target.instanceId,
          defenderOwner: opponentOwner,
        });

        if (attacker.effect_id === 'sigma_1d_double_attack') {
          const target2 = defenders[Math.floor(Math.random() * defenders.length)];
          attackActions.push({
            attackerInstanceId: attacker.instanceId,
            defenderInstanceId: target2.instanceId,
            defenderOwner: opponentOwner,
            isSecondAttack: true,
          });
        }
      } else {
        attackActions.push({
          attackerInstanceId: attacker.instanceId,
          defenderInstanceId: null,
          defenderOwner: opponentOwner,
          directAttack: true,
        });

        if (attacker.effect_id === 'sigma_1d_double_attack') {
          attackActions.push({
            attackerInstanceId: attacker.instanceId,
            defenderInstanceId: null,
            defenderOwner: opponentOwner,
            directAttack: true,
            isSecondAttack: true,
          });
        }
      }
    }

    return attackActions;
  }
}
