import { CardLoader } from '../utils/CardLoader.js';

export class Fusion {
  constructor(field, effectHandler) {
    this.field = field;
    this.effectHandler = effectHandler;
  }

  canFuse(instA, instB, handCard) {
    if (!instA || !instB || !handCard) {
      return { ok: false, reason: '対象が不正です' };
    }
    if (instA.instanceId === instB.instanceId) {
      return { ok: false, reason: '同じカードを2枚選択しています' };
    }
    if (instA.dimension !== instB.dimension) {
      return { ok: false, reason: '次元が異なるカードは融合できません' };
    }
    if (handCard.dimension !== instA.dimension + 1) {
      return { ok: false, reason: `手札に次元${instA.dimension + 1}のカードが必要です` };
    }
    return { ok: true, reason: '' };
  }

  execute(owner, instA, instB, handCard, gameState) {
    this.field.removeFromBattle(owner, instA.instanceId);
    this.field.removeFromBattle(owner, instB.instanceId);

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
