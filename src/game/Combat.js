const TYPE_ADVANTAGE = {
  delta: 'sigma',
  sigma: 'omega',
  omega: 'delta',
};

export class Combat {
  constructor(field, effectHandler) {
    this.field = field;
    this.effectHandler = effectHandler;
  }

  static calcDimMult(attackerDim, defenderDim) {
    const diff = attackerDim - defenderDim;
    if (diff >= 1) return 1.5;
    if (diff <= -1) return 0.5;
    return 1.0;
  }

  static calcTypeMult(attackerType, defenderType) {
    if (!attackerType || !defenderType) return 1.0;
    if (TYPE_ADVANTAGE[attackerType] === defenderType) return 1.2;
    if (TYPE_ADVANTAGE[defenderType] === attackerType) return 0.8;
    return 1.0;
  }

  calcDamage(attacker, defender, attackerOwner, defenderOwner, ignoreDefFlag = false) {
    const fieldDeltaAttacker = this.field.getActiveFieldEffect(attackerOwner) === 'field_delta';
    const fieldDeltaDefender = this.field.getActiveFieldEffect(defenderOwner) === 'field_delta';
    const fieldOmegaDefender = this.field.getActiveFieldEffect(defenderOwner) === 'field_omega';

    let effectiveAtk = attacker.currentAtk;
    if (fieldDeltaAttacker) effectiveAtk += 2;
    if (fieldDeltaDefender) effectiveAtk += 2;

    const defToUse = ignoreDefFlag ? 0 : defender.currentDef;
    const dimMult = Combat.calcDimMult(attacker.dimension, defender.dimension);
    const typeMult = Combat.calcTypeMult(attacker.type, defender.type);

    let damage = effectiveAtk * dimMult * typeMult * (1 - defToUse / 10);
    if (fieldOmegaDefender) damage *= 0.5;

    return Math.max(0, Math.floor(damage));
  }

  executeAttack(attackerInst, defenderInst, attackerOwner, defenderOwner, gameState) {
    const result = {
      damage: 0,
      overkill: 0,
      defenderDied: false,
      attackerOwner,
      defenderOwner,
      attackerId: attackerInst.instanceId,
      defenderId: defenderInst.instanceId,
      effects: [],
      splashTarget: null,
      splashDamage: 0,
      playerDamage: 0,
    };

    const ignoreDefFlag = this.effectHandler.checkIgnoreDef(attackerInst);
    result.damage = this.calcDamage(attackerInst, defenderInst, attackerOwner, defenderOwner, ignoreDefFlag);

    defenderInst.currentHp -= result.damage;

    if (defenderInst.currentHp <= 0) {
      result.defenderDied = true;
      result.overkill = Math.abs(defenderInst.currentHp);
      defenderInst.currentHp = 0;

      const blockedPierce = this.effectHandler.checkPierceBlock(defenderInst);
      if (blockedPierce) {
        result.overkill = 0;
        result.effects.push('omega_2d_pierce_block');
      }

      if (result.overkill > 0) {
        result.playerDamage = result.overkill;
        this.applyPlayerDamage(defenderOwner, result.overkill, gameState);
      }

      this.field.removeFromBattle(defenderOwner, defenderInst.instanceId);

      const splashResult = this.effectHandler.onKill(attackerInst, defenderInst, attackerOwner, gameState, result.damage);
      if (splashResult) {
        result.splashTarget = splashResult.target;
        result.splashDamage = splashResult.damage;
        result.effects.push('delta_2d_splash');
      }
    }

    attackerInst.hasAttacked = true;
    attackerInst.attackCount++;

    return result;
  }

  applyPlayerDamage(owner, amount, gameState) {
    if (owner === 'player') {
      gameState.player.hp = Math.max(0, gameState.player.hp - amount);
    } else {
      gameState.ai.hp = Math.max(0, gameState.ai.hp - amount);
    }
  }
}
