import { expect, test } from 'bun:test';
import { saveItem, requirements } from './inventory';
import { createSeed } from './seed';

test('changing or removing a recipe pack preserves the recipe amount in base units', () => {
  const state = createSeed();
  const rice = state.items.find(i => i.id === 'rice')!;
  state.recipes.find(r => r.id === 'rice-dish')!.ingredients = [{ itemId: 'rice', quantity: 1, unit: 'sack' }];
  const next = saveItem(state, { ...rice, packs: [] });
  expect(next.recipes.find(r => r.id === 'rice-dish')!.ingredients[0]).toEqual({ itemId: 'rice', quantity: 25000, unit: 'g' });
  expect(requirements(next, { ...next.events[0], snapshot: undefined, dishes: [{ recipeId: 'rice-dish', servings: 10 }], supplies: [] }).rice).toBe(25000);
  expect(state.recipes.find(r => r.id === 'rice-dish')!.ingredients[0].unit).toBe('sack');
});
test('editing an item cannot change its base unit or introduce ambiguous packs', () => {
  const state = createSeed(); const rice = state.items.find(i => i.id === 'rice')!;
  expect(() => saveItem(state, { ...rice, unit: 'pcs' })).toThrow();
  expect(() => saveItem(state, { ...rice, packs: [{ name: 'kg', quantity: 20 }] })).toThrow();
});
