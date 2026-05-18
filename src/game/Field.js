export class Field {
  constructor() {
    this.playerBattleSlots = new Array(5).fill(null);
    this.aiBattleSlots = new Array(5).fill(null);
    this.playerSpecialSlot = null;
    this.aiSpecialSlot = null;
  }

  _slots(owner) {
    return owner === 'player' ? this.playerBattleSlots : this.aiBattleSlots;
  }

  addToBattle(owner, inst) {
    const slots = this._slots(owner);
    const idx = slots.indexOf(null);
    if (idx === -1) return false;
    slots[idx] = inst;
    return true;
  }

  removeFromBattle(owner, instanceId) {
    const slots = this._slots(owner);
    const idx = slots.findIndex(c => c && c.instanceId === instanceId);
    if (idx === -1) return false;
    slots[idx] = null;
    return true;
  }

  getSlots(owner) {
    return [...this._slots(owner)];
  }

  getFilledSlots(owner) {
    return this._slots(owner).filter(c => c !== null);
  }

  hasEmptyBattleSlot(owner) {
    return this._slots(owner).includes(null);
  }

  setSpecial(owner, inst) {
    if (owner === 'player') {
      this.playerSpecialSlot = inst;
    } else {
      this.aiSpecialSlot = inst;
    }
  }

  clearSpecial(owner) {
    if (owner === 'player') {
      this.playerSpecialSlot = null;
    } else {
      this.aiSpecialSlot = null;
    }
  }

  getSpecial(owner) {
    return owner === 'player' ? this.playerSpecialSlot : this.aiSpecialSlot;
  }

  getActiveFieldEffect(owner) {
    const special = this.getSpecial(owner);
    return special ? special.effect_id : null;
  }

  compactSlots(owner) {
    const slots = this._slots(owner);
    const filled = slots.filter(c => c !== null);
    for (let i = 0; i < 5; i++) {
      slots[i] = filled[i] || null;
    }
  }
}
