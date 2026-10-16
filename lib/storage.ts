import type { State } from './types';

export const STORAGE_KEY = 'saluhan-inventory-v1';
export class StaleStateError extends Error {
  constructor(public readonly latest: string | null) { super('Inventory changed in another tab. Review your changes again.'); }
}
export function persistState(storage: Pick<Storage, 'getItem' | 'setItem'>, expected: string | null, state: State) {
  const latest = storage.getItem(STORAGE_KEY);
  if (latest !== expected) throw new StaleStateError(latest);
  const serialized = JSON.stringify(state);
  storage.setItem(STORAGE_KEY, serialized);
  return serialized;
}
