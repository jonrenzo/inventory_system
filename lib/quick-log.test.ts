import { expect, test } from 'bun:test';
import { normalizeDraft, draftToEntry } from './quick-log';
import { createSeed } from './seed';

const draft = () => ({ action: 'receive' as const, date: '2026-10-05', eventId: null, supplierId: 's1', reason: 'Delivery', message: 'Review your delivery.', questions: [], lines: [{ itemId: 'rice', quantity: 2, unit: 'sack', batchId: null, expiry: '2026-12-01', priceAmount: 1250, priceBasis: 'per-unit' as const }] });
test('converts price per entered pack into total purchase cost without model arithmetic', () => {
  const entry = draftToEntry(normalizeDraft(draft(), createSeed()), 'entry');
  expect(entry.lines[0].totalCost).toBe(2500);
  expect(entry.lines[0].unit).toBe('sack');
});
test('invented item IDs and incompatible units become clarification needs', () => {
  const input = draft(); input.lines[0].itemId = 'invented';
  expect(normalizeDraft(input, createSeed()).questions.length).toBeGreaterThan(0);
  const badUnit = draft(); badUnit.lines[0].unit = 'L';
  expect(normalizeDraft(badUnit, createSeed()).questions.length).toBeGreaterThan(0);
});
test('missing receipt cost and required expiry cannot become a ready draft', () => {
  const input = { ...draft(), lines: [{ ...draft().lines[0], priceAmount: null, expiry: null }] };
  const normalized = normalizeDraft(input, createSeed());
  expect(normalized.questions.length).toBeGreaterThanOrEqual(2);
  expect(() => draftToEntry(normalized, 'entry')).toThrow();
});
test('count stays a count and does not become usage', () => {
  const input = { ...draft(), action: 'count' as const, supplierId: null, lines: [{ ...draft().lines[0], batchId: 'batch-rice', quantity: 8, unit: 'kg' }] };
  const entry = draftToEntry(normalizeDraft(input, createSeed()), 'entry');
  expect(entry.action).toBe('count'); expect(entry.lines[0].quantity).toBe(8);
});
