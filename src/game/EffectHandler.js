import { CardLoader } from '../utils/CardLoader.js';

// 各タイプのパッシブ説明（UI表示用）
export const TYPE_PASSIVES = {
  delta: { label: '◆ATKダウン無効',        color: '#e63946', desc: '◆[Passive] 受けるATKダウン効果を無効化する' },
  sigma: { label: '◆融合→D0召喚',          color: '#4895ef', desc: '◆[Passive] 融合召喚時、空き枠があれば0Dを追加生成する' },
  omega: { label: (dim) => `◆攻撃ATK-${dim}`, color: '#4cc9a4', desc: (dim) => `◆[Passive] 攻撃時、相手のATKを-${dim}する` },
};

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
      this.onSummon(zero, owner, gameState);
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
    const cards = gameState.field.getFilledSlots(owner);

    // Omega 3D召喚時: 既存の全味方カードにDEF+2
    if (inst.effect_id === 'omega_3d_def_boost') {
      for (const card of cards) {
        if (card.instanceId !== inst.instanceId) {
          card.currentDef += 2;
        }
      }
    }

    // 新規カード召喚時: フィールドに既存Omega 3DがいればそのカードにもDEF+2
    const existingOmega3d = cards.find(
      c => c.effect_id === 'omega_3d_def_boost' && c.instanceId !== inst.instanceId
    );
    if (existingOmega3d) {
      inst.currentDef += 2;
    }
  }

  onFieldEffectActivate(effectId, owner) {
    // フィールド効果発動時の処理はGameManagerがイベント発行で対応
  }

  isDoubleAttacker(inst) {
    return inst.effect_id === 'sigma_1d_double_attack';
  }

  // Omega D1/D2/D3: 攻撃時に相手カードのATKをdimension分下げる
  // Delta passive: ATKダウン免疫
  onOmegaAtkDebuff(attacker, defender) {
    if (!attacker || !defender) return 0;
    if (attacker.type !== 'omega' || attacker.dimension >= 4) return 0;
    if (defender.type === 'delta') return 0; // Delta passive: ATKダウン無効
    const debuff = attacker.dimension;
    defender.currentAtk = Math.max(0, defender.currentAtk - debuff);
    return debuff;
  }

  // Sigma passive: 融合召喚時に空き枠があれば0Dを追加生成
  onFusionSummon(newCard, owner, gameState) {
    if (newCard.type !== 'sigma' || newCard.dimension >= 4) return null;
    if (!gameState.field.hasEmptyBattleSlot(owner)) return null;
    const zero = CardLoader.createCardInstance('0d');
    gameState.field.addToBattle(owner, zero);
    this.onSummon(zero, owner, gameState);
    return zero;
  }
}
