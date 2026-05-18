import { Card } from './Card.js';

const SLOT_W = Card.CARD_W + 8;
const SLOT_H = Card.CARD_H + 8;

export class FieldSlot extends Phaser.GameObjects.Container {
  constructor(scene, x, y, slotIndex, owner) {
    super(scene, x, y);
    this.slotIndex = slotIndex;
    this.owner = owner;
    this._card = null;
    this._highlighted = false;
    this._bg = scene.add.graphics();
    this._drawSlot(false);
    this.add(this._bg);
    scene.add.existing(this);
  }

  _drawSlot(highlighted) {
    const g = this._bg;
    g.clear();
    if (highlighted) {
      g.lineStyle(2, 0xff6600, 0.9);
      g.fillStyle(0xff6600, 0.15);
    } else {
      g.lineStyle(1, 0x445566, 0.6);
      g.fillStyle(0x1a2a3a, 0.4);
    }
    g.fillRoundedRect(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H, 10);
    g.strokeRoundedRect(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H, 10);
  }

  placeCard(cardObj) {
    if (this._card) {
      this.remove(this._card);
    }
    this._card = cardObj;
    cardObj.x = 0;
    cardObj.y = 0;
    // card は scene に直接追加済みなので位置だけ合わせる
    cardObj.x = this.x;
    cardObj.y = this.y;
  }

  removeCard() {
    this._card = null;
  }

  highlight(val) {
    this._highlighted = val;
    this._drawSlot(val);
    if (val) {
      this.scene.tweens.add({
        targets: this._bg,
        alpha: { from: 0.5, to: 1.0 },
        yoyo: true,
        repeat: -1,
        duration: 500,
      });
    } else {
      this.scene.tweens.killTweensOf(this._bg);
      this._bg.setAlpha(1);
    }
  }

  get isEmpty() { return this._card === null; }
  get card() { return this._card; }
  static get SLOT_W() { return SLOT_W; }
  static get SLOT_H() { return SLOT_H; }
}
