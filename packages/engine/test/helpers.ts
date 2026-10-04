import type { Ability, Card, Element, Range } from "@amanda/shared";

/** Build a fully-formed Card for tests without repeating boilerplate. */
export function testCard(input: {
  id: string;
  elements?: Element[];
  hp?: number;
  power?: number;
  attackSpeed?: number;
  moveSpeed?: number;
  range?: Range;
  abilities?: Ability[];
}): Card {
  return {
    id: input.id,
    seriesId: "test",
    numberInSeries: 1,
    name: { he: input.id, en: input.id },
    elements: input.elements ?? ["fire"],
    rarity: "common",
    stats: {
      hp: input.hp ?? 100,
      power: input.power ?? 10,
      attackSpeed: input.attackSpeed ?? 1,
      moveSpeed: input.moveSpeed ?? 0,
      range: input.range ?? "melee",
    },
    flying: false,
    midBoss: false,
    launch: true,
    abilities: input.abilities ?? [],
    art: { placeholderColor: "#ffffff", sprite: null },
  };
}

export function catalogOf(...cards: Card[]): Map<string, Card> {
  return new Map(cards.map((c) => [c.id, c]));
}
