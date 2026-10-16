import { describe, expect, test } from 'bun:test';
import { applyEntry, balances, confirmEvent, requirements, completeEvent, convert, buyList, reverseEntry, latestCost, saveEvent } from './inventory';
import type { State } from './types';

function fixture(): State {
  return {
    version: 1, revision: 0, settings: { name: 'Test', logo: '', categories: ['Dry goods'], expiryDays: 7 },
    items: [{ id: 'rice', name: 'Rice', category: 'Dry goods', kind: 'ingredient', unit: 'g', threshold: 2000, requiresExpiry: true, packs: [{ name: 'sack', quantity: 25000 }], archived: false }],
    suppliers: [{ id: 'supplier', name: 'Market' }],
    batches: [{ id: 'batch', itemId: 'rice', received: '2026-10-01', expiry: '2026-12-01', quantity: 10000, cost: 0.05, supplierId: 'supplier' }],
    movements: [], recipes: [{ id: 'recipe', name: 'Rice bowl', servings: 10, ingredients: [{ itemId: 'rice', quantity: 1000, unit: 'g' }] }],
    events: [{ id: 'event', name: 'Wedding', date: '2026-10-12', prepDate: '2026-10-11', guests: 50, status: 'Draft', dishes: [{ recipeId: 'recipe', servings: 50 }], supplies: [] }], templates: [],
  };
}
describe('inventory rules', () => {
  test('metadata edits preserve confirmed recipe snapshots while menu edits refresh them', () => {
    const state = confirmEvent(fixture(), 'event');
    const original = state.events[0];
    state.recipes[0].ingredients[0].quantity = 2000;
    const renamed = saveEvent(state, { ...original, name: 'Renamed wedding' });
    expect(renamed.events[0].snapshot).toEqual(original.snapshot);
    expect(renamed.events[0].estimatedCost).toBe(original.estimatedCost);
    const changed = saveEvent(renamed, { ...renamed.events[0], guests: 60, dishes: [{ recipeId: 'recipe', servings: 60 }] });
    expect(changed.events[0].snapshot?.rice).toBe(12000);
  });
  test('latest purchase cost uses the last receipt on the same day', () => {
    const state = fixture();
    state.batches.push({ ...state.batches[0], id: 'new-batch', cost: 0.2 });
    expect(latestCost(state, 'rice')).toBe(0.2);
  });
  test('old events cannot consume stock expired on the usage date', () => {
    let state = fixture();
    state.events[0].date = '2026-10-02'; state.events[0].prepDate = '2026-10-01';
    state.batches[0].expiry = '2026-10-03';
    state = confirmEvent(state, 'event', '2026-10-01T00:00:00Z');
    expect(() => applyEntry(state, { id: 'late', action: 'use', date: '2026-10-05', reason: 'Late preparation', eventId: 'event', lines: [{ itemId: 'rice', quantity: 1, unit: 'kg' }] })).toThrow();
  });
  test('converts known units and packs but rejects guessed conversions', () => {
    const item = fixture().items[0];
    expect(convert(item, 2, 'sack')).toBe(50000);
    expect(convert(item, 0.5, 'kg')).toBe(500);
    expect(() => convert(item, 1, 'L')).toThrow();
  });
  test('scales recipe yield and snapshots requirements on confirmation', () => {
    let state = fixture();
    expect(requirements(state, state.events[0])).toEqual({ rice: 5000 });
    state = confirmEvent(state, 'event', '2026-10-04T00:00:00Z');
    state.recipes[0].ingredients[0].quantity = 2000;
    expect(requirements(state, state.events[0])).toEqual({ rice: 5000 });
    expect(balances(state, '2026-10-04').rice.reserved).toBe(5000);
  });
  test('partial usage is consumed once and completion releases unused stock', () => {
    let state = confirmEvent(fixture(), 'event');
    state = applyEntry(state, { id: 'use-1', action: 'use', date: '2026-10-05', eventId: 'event', reason: 'Preparation', lines: [{ itemId: 'rice', quantity: 2, unit: 'kg' }] });
    expect(balances(state, '2026-10-05').rice.physical).toBe(8000);
    expect(balances(state, '2026-10-05').rice.reserved).toBe(3000);
    state = completeEvent(state, 'event');
    expect(balances(state, '2026-10-05').rice.physical).toBe(8000);
    expect(balances(state, '2026-10-05').rice.reserved).toBe(0);
    expect(state.movements[0].cost).toBe(100);
  });
  test('rejects duplicate saves and negative stock atomically', () => {
    const input = { id: 'use-1', action: 'use' as const, date: '2026-10-05', reason: 'General usage', lines: [{ itemId: 'rice', quantity: 2, unit: 'kg' }] };
    const state = applyEntry(fixture(), input);
    expect(() => applyEntry(state, input)).toThrow();
    expect(() => applyEntry(state, { ...input, id: 'use-2', lines: [{ itemId: 'rice', quantity: 100, unit: 'kg' }] })).toThrow();
    expect(state.batches[0].quantity).toBe(8000);
  });
  test('count is an absolute balance, not a consumption quantity', () => {
    const state = applyEntry(fixture(), { id: 'count', action: 'count', date: '2026-10-05', reason: 'Stocktake', lines: [{ itemId: 'rice', quantity: 8, unit: 'kg', batchId: 'batch' }] });
    expect(state.batches[0].quantity).toBe(8000);
    expect(state.movements[0].quantity).toBe(-2000);
  });
  test('reserves earlier events first and combines threshold with shortages once', () => {
    let state = fixture();
    state.events.push({ ...state.events[0], id: 'earlier', prepDate: '2026-10-10', dishes: [{ recipeId: 'recipe', servings: 80 }] });
    state = confirmEvent(confirmEvent(state, 'event'), 'earlier');
    const balance = balances(state, '2026-10-05').rice;
    expect(balance.reserved).toBe(10000);
    expect(balance.shortage).toBe(3000);
    expect(buyList(state, '2026-10-05', '2026-10-20')[0].quantity).toBe(5000);
  });
  test('stock expiring before an event cannot cover its requirements', () => {
    const state = fixture(); state.batches[0].expiry = '2026-10-10';
    const confirmed = confirmEvent(state, 'event');
    expect(balances(confirmed, '2026-10-05').rice.reserved).toBe(0);
    expect(balances(confirmed, '2026-10-05').rice.shortage).toBe(5000);
  });
  test('usage cannot consume another event reservation but waste exposes the shortage', () => {
    const state = confirmEvent(fixture(), 'event');
    expect(() => applyEntry(state, { id: 'general', action: 'use', date: '2026-10-05', reason: 'General usage', lines: [{ itemId: 'rice', quantity: 6, unit: 'kg' }] })).toThrow();
    const wasted = applyEntry(state, { id: 'waste', action: 'waste', date: '2026-10-05', reason: 'Damaged stock', lines: [{ itemId: 'rice', quantity: 6, unit: 'kg' }] });
    expect(balances(wasted, '2026-10-05').rice.shortage).toBe(1000);
  });
  test('cancellation preserves consumed stock and releases remaining reservations', () => {
    let state = confirmEvent(fixture(), 'event');
    state = applyEntry(state, { id: 'use', action: 'use', date: '2026-10-05', reason: 'Prep', eventId: 'event', lines: [{ itemId: 'rice', quantity: 2, unit: 'kg' }] });
    state.events[0].status = 'Canceled';
    expect(balances(state, '2026-10-05').rice.physical).toBe(8000);
    expect(balances(state, '2026-10-05').rice.reserved).toBe(0);
  });
  test('corrections retain history and reverse both quantities and costs once', () => {
    const state = applyEntry(fixture(), { id: 'use', action: 'use', date: '2026-10-05', reason: 'Prep', lines: [{ itemId: 'rice', quantity: 2, unit: 'kg' }] });
    const reversed = reverseEntry(state, 'use', 'Wrong quantity');
    expect(reversed.batches[0].quantity).toBe(10000);
    expect(reversed.movements).toHaveLength(2);
    expect(reversed.movements[1].cost).toBe(-100);
    expect(() => reverseEntry(reversed, 'use', 'Again')).toThrow();
  });
  test('rejects invalid calendar dates and use of stock before it arrived', () => {
    const state = fixture();
    expect(() => applyEntry(state, { id: 'bad-date', action: 'use', date: '2026-02-30', reason: 'Prep', lines: [{ itemId: 'rice', quantity: 1, unit: 'kg' }] })).toThrow();
    expect(() => applyEntry(state, { id: 'early-use', action: 'use', date: '2026-09-30', reason: 'Prep', lines: [{ itemId: 'rice', quantity: 1, unit: 'kg' }] })).toThrow();
  });
});
