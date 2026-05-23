import { Fusion } from './Fusion.js';

export class AI {
  // メインフェーズ1ループ分: 召喚 + 融合1回を計画して返す
  // executeAITurnから「行動が0になるまで」繰り返し呼ぶことで連続融合を実現
  static planMainPhase(gameState, field, effectHandler, maxSummons = 1) {
    const actions = [];
    const owner = 'ai';
    const fusion = new Fusion(field, effectHandler);

    // 召喚: live な normalSummonCount を見て上限まで必ず召喚
    let summonsDone = gameState.ai.normalSummonCount;
    while (summonsDone < maxSummons && field.hasEmptyBattleSlot(owner)) {
      actions.push({ type: 'normalSummon' });
      summonsDone++;
    }

    const fieldCards = field.getFilledSlots(owner);
    const hand = gameState.ai.hand;
    // 高次元から優先して融合を試みる
    const dims = [...new Set(fieldCards.map(c => c.dimension))].sort((a, b) => b - a);

    // 3枚融合チェック（高次元優先）
    outerLoop3:
    for (const dim of dims) {
      const group = fieldCards.filter(c => c.dimension === dim);
      if (group.length < 3) continue;
      const targetDim = dim + 2;
      const handCard = hand.find(hc => hc.dimension === targetDim);
      if (!handCard) continue;
      for (let i = 0; i < group.length - 2; i++) {
        for (let j = i + 1; j < group.length - 1; j++) {
          for (let k = j + 1; k < group.length; k++) {
            const { ok } = fusion.canFuse(group[i], group[j], handCard, group[k]);
            if (ok) {
              actions.push({
                type: 'fuse3',
                instAId: group[i].instanceId,
                instBId: group[j].instanceId,
                instCId: group[k].instanceId,
                handCardInstanceId: handCard.instanceId,
              });
              return actions; // 1融合ずつ実行→再計画
            }
          }
        }
      }
    }

    // 2枚融合チェック（高次元優先）
    for (const dim of dims) {
      const group = fieldCards.filter(c => c.dimension === dim);
      if (group.length < 2) continue;
      const targetDim = dim + 1;
      const handCard = hand.find(hc => hc.dimension === targetDim);
      if (!handCard) continue;
      for (let i = 0; i < group.length - 1; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const { ok } = fusion.canFuse(group[i], group[j], handCard);
          if (ok) {
            actions.push({
              type: 'fuse',
              instAId: group[i].instanceId,
              instBId: group[j].instanceId,
              handCardInstanceId: handCard.instanceId,
            });
            return actions; // 1融合ずつ実行→再計画
          }
        }
      }
    }

    return actions;
  }

  static planAttackPhase(gameState, field, effectHandler) {
    const owner = 'ai';
    const opponentOwner = 'player';
    const attackActions = [];

    // ATK高順に攻撃（強いカードが先に動く）
    const attackers = field.getFilledSlots(owner)
      .filter(c => !c.hasAttacked)
      .sort((a, b) => b.currentAtk - a.currentAtk);

    for (const attacker of attackers) {
      const defenders = field.getFilledSlots(opponentOwner);

      if (defenders.length === 0) {
        attackActions.push({
          attackerInstanceId: attacker.instanceId,
          defenderInstanceId: null,
          defenderOwner: opponentOwner,
          directAttack: true,
        });
      } else {
        const target = AI._chooseBestTarget(attacker, defenders, field, owner, opponentOwner);
        attackActions.push({
          attackerInstanceId: attacker.instanceId,
          defenderInstanceId: target.instanceId,
          defenderOwner: opponentOwner,
        });
      }

      // ダブルアタックカードは2回分を計画
      if (attacker.effect_id === 'sigma_1d_double_attack') {
        const defenders2 = field.getFilledSlots(opponentOwner);
        if (defenders2.length === 0) {
          attackActions.push({
            attackerInstanceId: attacker.instanceId,
            defenderInstanceId: null,
            defenderOwner: opponentOwner,
            directAttack: true,
          });
        } else {
          const target2 = AI._chooseBestTarget(attacker, defenders2, field, owner, opponentOwner);
          attackActions.push({
            attackerInstanceId: attacker.instanceId,
            defenderInstanceId: target2.instanceId,
            defenderOwner: opponentOwner,
          });
        }
      }
    }

    return attackActions;
  }

  // 攻撃対象選択:
  //   撃破可能なカードがあれば → その中で最大ATK(脅威排除)
  //   なければ → 最低HP(次ターン以降に倒しやすい)
  static _chooseBestTarget(attacker, defenders, field, attackerOwner, defenderOwner) {
    const ignoreDef = attacker.effect_id === 'delta_1d_def_ignore';
    const fieldDeltaAtk = field.getActiveFieldEffect(attackerOwner) === 'field_delta';
    const fieldDeltaDef = field.getActiveFieldEffect(defenderOwner) === 'field_delta';
    const fieldOmegaDef = field.getActiveFieldEffect(defenderOwner) === 'field_omega';

    let effectiveAtk = attacker.currentAtk;
    if (fieldDeltaAtk) effectiveAtk += 2;
    if (fieldDeltaDef) effectiveAtk += 2;

    const estimateDmg = (defender) => {
      const defVal = ignoreDef ? 0 : defender.currentDef;
      const dimMult = attacker.dimension > defender.dimension ? 1.5
                    : attacker.dimension < defender.dimension ? 0.5 : 1.0;
      let dmg = effectiveAtk * dimMult * (1 - defVal / 10);
      if (fieldOmegaDef) dmg *= 0.5;
      return Math.max(0, Math.floor(dmg));
    };

    const killable = defenders.filter(d => estimateDmg(d) >= d.currentHp);

    if (killable.length > 0) {
      return killable.reduce((best, d) => d.currentAtk > best.currentAtk ? d : best, killable[0]);
    }

    return defenders.reduce((best, d) => d.currentHp < best.currentHp ? d : best, defenders[0]);
  }
}
