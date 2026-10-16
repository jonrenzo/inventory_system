'use client';
import Image from 'next/image';
import { createContext, useContext, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { State } from '@/lib/types';
import { createSeed } from '@/lib/seed';
import { stateSchema } from '@/lib/schemas';
import { persistState, StaleStateError, STORAGE_KEY as KEY } from '@/lib/storage';

type Context = { state: State; update: (next: State) => void; reset: () => State; error: string; dismissError: () => void };
const Store = createContext<Context | null>(null);
function reducer(_state: State | null, next: State): State { return next; }
export function InventoryProvider({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  if (!hydrated) return <div className="boot"><Image className="brand-mark" src="/catering-logo.png" alt="Saluhan container mascot" width={48} height={48}/><h1>Opening the pantry…</h1></div>;
  return <BrowserStore>{children}</BrowserStore>;
}
const subscribe = () => () => {};
function BrowserStore({ children }: { children: ReactNode }) {
  const [initial] = useState(() => {
    try { const raw = localStorage.getItem(KEY); return { raw, state: raw ? stateSchema.parse(JSON.parse(raw)) : createSeed(), error: '' }; }
    catch { return { raw: null, state: null, error: 'Saved demo data could not be loaded. Reset the demo to recover.' }; }
  });
  const [state, dispatch] = useReducer(reducer, initial.state);
  const [error, setError] = useState(initial.error);
  const saved = useRef(initial.raw);
  function update(next: State) {
    const parsed = stateSchema.parse(next);
    try { saved.current = persistState(localStorage, saved.current, parsed); setError(''); }
    catch (e) {
      if (e instanceof StaleStateError) {
        try { const latest = e.latest ? stateSchema.parse(JSON.parse(e.latest)) : createSeed(); saved.current = e.latest; dispatch(latest); }
        catch { setError('Saved inventory is invalid. Reload to recover the demo.'); throw new Error('Saved inventory is invalid. Reload to recover the demo.'); }
        setError(e.message); throw e;
      }
      setError('Browser storage is unavailable. Changes are only saved for this session.');
    }
    dispatch(parsed);
  }
  function reset() { try { localStorage.removeItem('saluhan-draft-v1'); if (!state) saved.current = localStorage.getItem(KEY); } catch { /* update reports unavailable storage */ } const next = createSeed(); update(next); return next; }
  if (!state) return <div className="boot"><Image className="brand-mark" src="/catering-logo.png" alt="Saluhan container mascot" width={48} height={48}/><h1>Recover your demo</h1><p>{error}</p><button className="native-button" onClick={reset}>Reset demo data</button></div>;
  return <Store.Provider value={{ state, update, reset, error, dismissError: () => setError('') }}>{children}</Store.Provider>;
}
export function useInventory() { const value = useContext(Store); if (!value) throw new Error('Inventory provider is missing.'); return value; }
