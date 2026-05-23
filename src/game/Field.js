export class Field {
  constructor() {
    this.playerBattleSlots = new Array(5).fill(null);
    this.aiBattleSlots     = new Array(5).fill(null);

    // 共有特別フィールド（全体で1枚のみ存在できる）
    this.specialSlot  = null;   // CardInstance | null
    this.specialOwner = null;   // 'player' | 'ai' | null
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

  // 共有特別スロットに配置（既存カードは呼び出し元で破壊済みのこと）
  setSpecial(owner, inst) {
    this.specialSlot  = inst;
    this.specialOwner = owner;
  }

  // 特別スロットを空にする
  clearSpecial() {
    this.specialSlot  = null;
    this.specialOwner = null;
  }

  // そのオーナーが置いた4Dカードを返す（他オーナーが置いた場合は null）
  getSpecial(owner) {
    return this.specialOwner === owner ? this.specialSlot : null;
  }

  // 現在の特別スロットの中身をオーナー問わず返す
  getSpecialCard() {
    return this.specialSlot;
  }

  // そのオーナーの4Dカードが発動しているフィールド効果を返す
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
