import { expect, test } from 'bun:test';
import { persistState, StaleStateError } from './storage';
import { createSeed } from './seed';

test('a stale tab cannot overwrite another tab even when revisions match', () => {
  let saved: string | null = null;
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
  const initial = createSeed();
  const baseline = persistState(storage, null, initial);
  const changed = { ...initial, settings: { ...initial.settings, name: 'New kitchen' } };
  const latest = persistState(storage, baseline, changed);
  expect(() => persistState(storage, baseline, initial)).toThrow(StaleStateError);
  expect(storage.getItem()).toBe(latest);
});
