import type { Item, State } from './types';
import { confirmEvent, today } from './inventory';

export function day(offset: number, base = today()) { const d = new Date(`${base}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); }
export function createSeed(): State {
  const catalog: [string, string, string, Item['unit'], number, number, number][] = [
    ['rice', 'Jasmine rice', 'Dry goods', 'g', 48000, 10000, .058],
    ['chicken', 'Chicken thigh', 'Meat & seafood', 'g', 12000, 5000, .195],
    ['pork', 'Pork shoulder', 'Meat & seafood', 'g', 18000, 5000, .285],
    ['beef', 'Beef brisket', 'Meat & seafood', 'g', 8500, 3000, .42],
    ['fish', 'Cream dory', 'Meat & seafood', 'g', 7000, 3000, .21],
    ['shrimp', 'White shrimp', 'Meat & seafood', 'g', 2500, 3000, .48],
    ['carrot', 'Carrots', 'Produce', 'g', 8000, 2000, .085],
    ['potato', 'Potatoes', 'Produce', 'g', 10000, 2000, .095],
    ['onion', 'Red onions', 'Produce', 'g', 6000, 2000, .12],
    ['garlic', 'Garlic', 'Produce', 'g', 1800, 2000, .16],
    ['cabbage', 'Cabbage', 'Produce', 'g', 6000, 2000, .075],
    ['pepper', 'Bell peppers', 'Produce', 'g', 4000, 1000, .18],
    ['noodles', 'Pancit noodles', 'Dry goods', 'g', 10000, 3000, .11],
    ['flour', 'All-purpose flour', 'Dry goods', 'g', 15000, 3000, .045],
    ['sugar', 'White sugar', 'Dry goods', 'g', 10000, 2000, .082],
    ['oil', 'Cooking oil', 'Pantry', 'mL', 18000, 5000, .105],
    ['soy', 'Soy sauce', 'Pantry', 'mL', 8000, 2000, .065],
    ['vinegar', 'Cane vinegar', 'Pantry', 'mL', 8000, 2000, .038],
    ['milk', 'Fresh milk', 'Dairy & eggs', 'mL', 5000, 2000, .095],
    ['eggs', 'Eggs', 'Dairy & eggs', 'pcs', 120, 60, 8.5],
    ['butter', 'Butter', 'Dairy & eggs', 'g', 3000, 1000, .35],
    ['boxes', 'Takeaway boxes', 'Disposables', 'pcs', 180, 100, 6],
    ['napkins', 'Paper napkins', 'Disposables', 'pcs', 800, 200, .65],
    ['bags', 'Garbage bags', 'Cleaning', 'pcs', 40, 20, 8],
    ['soap', 'Dishwashing liquid', 'Cleaning', 'mL', 6000, 2000, .06],
  ];
  let state: State = {
    version: 1, revision: 0,
    settings: { name: 'Saluhan Catering', logo: '', categories: ['Dry goods', 'Meat & seafood', 'Produce', 'Pantry', 'Dairy & eggs', 'Disposables', 'Cleaning'], expiryDays: 7 },
    items: catalog.map(([id, name, category, unit, , threshold]) => ({ id, name, category, unit, threshold, kind: ['Disposables', 'Cleaning'].includes(category) ? 'consumable' : 'ingredient', requiresExpiry: !['Disposables', 'Cleaning'].includes(category), packs: id === 'rice' ? [{ name: 'sack', quantity: 25000 }] : id === 'eggs' ? [{ name: 'tray', quantity: 30 }] : unit === 'pcs' ? [{ name: 'pack', quantity: 50 }] : [], archived: false })),
    suppliers: [{ id: 's1', name: 'Bayan Fresh Market' }, { id: 's2', name: 'Metro Wholesale' }, { id: 's3', name: 'Prime Meat Supply' }, { id: 's4', name: 'Pack & Go Supplies' }],
    batches: catalog.map(([id, , category, , quantity, , cost], index) => ({ id: `batch-${id}`, itemId: id, received: day(-3), expiry: ['Disposables', 'Cleaning'].includes(category) ? '' : day(id === 'milk' ? 2 : id === 'chicken' ? 6 : category === 'Produce' ? 10 : 45), quantity, cost, supplierId: `s${index % 4 + 1}` })),
    movements: [],
    recipes: [
      { id: 'adobo', name: 'Chicken adobo', servings: 10, ingredients: [{ itemId: 'chicken', quantity: 2, unit: 'kg' }, { itemId: 'soy', quantity: 150, unit: 'mL' }, { itemId: 'vinegar', quantity: 100, unit: 'mL' }, { itemId: 'garlic', quantity: 80, unit: 'g' }] },
      { id: 'rice-dish', name: 'Steamed jasmine rice', servings: 10, ingredients: [{ itemId: 'rice', quantity: 1, unit: 'kg' }] },
      { id: 'pancit', name: 'Pancit canton', servings: 10, ingredients: [{ itemId: 'noodles', quantity: 800, unit: 'g' }, { itemId: 'carrot', quantity: 300, unit: 'g' }, { itemId: 'cabbage', quantity: 500, unit: 'g' }, { itemId: 'soy', quantity: 80, unit: 'mL' }] },
      { id: 'caldereta', name: 'Beef caldereta', servings: 10, ingredients: [{ itemId: 'beef', quantity: 2, unit: 'kg' }, { itemId: 'potato', quantity: 600, unit: 'g' }, { itemId: 'carrot', quantity: 400, unit: 'g' }, { itemId: 'pepper', quantity: 300, unit: 'g' }] },
      { id: 'fish-dish', name: 'Crispy fish fillet', servings: 10, ingredients: [{ itemId: 'fish', quantity: 2, unit: 'kg' }, { itemId: 'flour', quantity: 300, unit: 'g' }, { itemId: 'oil', quantity: 300, unit: 'mL' }] },
      { id: 'flan', name: 'Leche flan', servings: 10, ingredients: [{ itemId: 'eggs', quantity: 10, unit: 'pcs' }, { itemId: 'milk', quantity: 500, unit: 'mL' }, { itemId: 'sugar', quantity: 200, unit: 'g' }] },
    ],
    events: [
      { id: 'santos', name: 'Santos–Reyes wedding', date: day(3), prepDate: day(2), guests: 120, status: 'Draft', dishes: [{ recipeId: 'adobo', servings: 100 }, { recipeId: 'rice-dish', servings: 120 }, { recipeId: 'pancit', servings: 80 }], supplies: [{ itemId: 'napkins', quantity: 2, perGuest: true }, { itemId: 'bags', quantity: 10, perGuest: false }] },
      { id: 'acme', name: 'Meridian team lunch', date: day(5), prepDate: day(4), guests: 60, status: 'Draft', dishes: [{ recipeId: 'caldereta', servings: 60 }, { recipeId: 'rice-dish', servings: 60 }], supplies: [{ itemId: 'boxes', quantity: 1, perGuest: true }] },
      { id: 'birthday', name: 'Lola Carmen’s 70th', date: day(8), prepDate: day(7), guests: 80, status: 'Draft', dishes: [{ recipeId: 'fish-dish', servings: 60 }, { recipeId: 'flan', servings: 80 }], supplies: [] },
      { id: 'school', name: 'Westbridge recognition day', date: day(12), prepDate: day(11), guests: 150, status: 'Draft', dishes: [{ recipeId: 'pancit', servings: 150 }], supplies: [] },
      { id: 'launch', name: 'Studio opening', date: day(-2), prepDate: day(-3), guests: 40, status: 'Completed', dishes: [{ recipeId: 'rice-dish', servings: 40 }], supplies: [], snapshot: { rice: 4000 }, estimatedCost: 232 },
    ],
    templates: [{ id: 'buffet', name: 'Buffet essentials', supplies: [{ itemId: 'napkins', quantity: 2, perGuest: true }, { itemId: 'bags', quantity: 10, perGuest: false }] }, { id: 'packed', name: 'Packed lunch', supplies: [{ itemId: 'boxes', quantity: 1, perGuest: true }, { itemId: 'napkins', quantity: 1, perGuest: true }] }],
  };
  state.movements = state.batches.map(b => ({ id: `movement-${b.id}`, entryId: `opening-${b.id}`, itemId: b.itemId, batchId: b.id, action: 'receive', quantity: b.quantity, cost: b.quantity * b.cost, date: b.received, reason: 'Opening stock' }));
  state = confirmEvent(state, 'santos'); state = confirmEvent(state, 'acme');
  return state;
}
