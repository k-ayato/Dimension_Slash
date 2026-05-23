import { CardLoader } from '../utils/CardLoader.js';

export class Fusion {
  constructor(field, effectHandler) {
    this.field = field;
    this.effectHandler = effectHandler;
  }

  canFuse(instA, instB, handCard, instC = null) {
    if (!instA || !instB || !handCard) {
      return { ok: false, reason: '対象が不正です' };
    }
    if (instC) {
      // 3枚融合: 同次元×3 + 手札(dim+2)
      const ids = new Set([instA.instanceId, instB.instanceId, instC.instanceId]);
      if (ids.size < 3) return { ok: false, reason: '同じカードが含まれています' };
      if (!(instA.dimension === instB.dimension && instB.dimension === instC.dimension))
        return { ok: false, reason: '3枚の次元が揃っていません' };
      if (handCard.dimension !== instA.dimension + 2)
        return { ok: false, reason: `手札に次元${instA.dimension + 2}のカードが必要です（3枚融合）` };
    } else {
      // 2枚融合: 同次元×2 + 手札(dim+1)
      if (instA.instanceId === instB.instanceId)
        return { ok: false, reason: '同じカードを2枚選択しています' };
      if (instA.dimension !== instB.dimension)
        return { ok: false, reason: '次元が異なるカードは融合できません' };
      if (handCard.dimension !== instA.dimension + 1)
        return { ok: false, reason: `手札に次元${instA.dimension + 1}のカードが必要です` };
    }
    return { ok: true, reason: '' };
  }

  execute(owner, instA, instB, handCard, gameState, instC = null) {
    this.field.removeFromBattle(owner, instA.instanceId);
    this.field.removeFromBattle(owner, instB.instanceId);
    if (instC) this.field.removeFromBattle(owner, instC.instanceId);

    const newInst = CardLoader.createCardInstance(handCard.id);
    const isSpecial = newInst.dimension === 4;

    if (isSpecial) {
      // 共有スロットに既存4Dカードがあれば破壊して置き換える
      const destroyedCard = this.field.getSpecialCard() || null;
      this.field.setSpecial(owner, newInst);
      gameState[owner].fusionCount++;
      this.effectHandler.onFieldEffectActivate(newInst.effect_id, owner);
      return { newCard: newInst, isSpecial, destroyedCard };
    } else {
      this.field.addToBattle(owner, newInst);
      gameState[owner].fusionCount++;
      this.effectHandler.onSummon(newInst, owner, gameState);
      return { newCard: newInst, isSpecial, destroyedCard: null };
    }
  }
}
