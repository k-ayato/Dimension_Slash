let cardDefsCache = null;
let deckConfigCache = null;

export class CardLoader {
  static async load() {
    if (cardDefsCache) return;
    const [cardsRes, deckRes] = await Promise.all([
      fetch('./data/cards.json'),
      fetch('./data/deck.json'),
    ]);
    const cardsData = await cardsRes.json();
    const deckData = await deckRes.json();
    cardDefsCache = cardsData.cards;
    deckConfigCache = deckData.deck;
  }

  static getCardDef(id) {
    return cardDefsCache.find(c => c.id === id) || null;
  }

  static getAllDefs() {
    return cardDefsCache;
  }

  static getDeckConfig() {
    return deckConfigCache;
  }

  static createCardInstance(id) {
    const def = CardLoader.getCardDef(id);
    if (!def) throw new Error(`Unknown card id: ${id}`);
    return {
      id: def.id,
      name: def.name,
      type: def.type,
      dimension: def.dimension,
      baseAtk: def.atk,
      baseDef: def.def,
      baseHp: def.hp,
      currentAtk: def.atk,
      currentDef: def.def,
      currentHp: def.hp,
      maxHp: def.hp,
      effect_id: def.effect_id,
      effect_desc: def.effect_desc,
      hasAttacked: false,
      attackCount: 0,
      instanceId: crypto.randomUUID(),
    };
  }

  static buildDeck() {
    const deck = [];
    for (const entry of deckConfigCache) {
      for (let i = 0; i < entry.count; i++) {
        deck.push(CardLoader.createCardInstance(entry.id));
      }
    }
    return shuffle(deck);
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
