import type { Allocation, CateringEvent, Entry, Item, State } from './types';
import { z } from 'zod';

export const uid = () => crypto.randomUUID();
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const money = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(amount);
export const round = (n: number) => Math.round(n * 1e6) / 1e6;
export function displayQty(item: Item, quantity: number) {
  const scaled = item.unit !== 'pcs' && Math.abs(quantity) >= 1000;
  return `${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 }).format(scaled ? quantity / 1000 : quantity)} ${scaled ? item.unit === 'g' ? 'kg' : 'L' : item.unit}`;
}
export function units(item: Item) { return [...(item.unit === 'g' ? ['g', 'kg'] : item.unit === 'mL' ? ['mL', 'L'] : ['pcs']), ...item.packs.map(p => p.name)]; }
export function convert(item: Item, quantity: number, unit: string) {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Enter a valid nonnegative quantity.');
  const factor = unit === item.unit ? 1 : unit === 'kg' && item.unit === 'g' || unit === 'L' && item.unit === 'mL' ? 1000 : item.packs.find(p => p.name === unit)?.quantity;
  if (!factor || !Number.isFinite(factor)) throw new Error(`Choose a compatible unit for ${item.name}.`);
  const result = round(quantity * factor);
  if (item.unit === 'pcs' && !Number.isInteger(result)) throw new Error('Piece quantities must be whole numbers.');
  return result;
}
export function saveItem(state: State, item: Item): State {
  const previous = state.items.find(i => i.id === item.id);
  if (previous && previous.unit !== item.unit) throw new Error('Base stock units cannot change after an item is created.');
  if (state.items.some(i => i.id !== item.id && i.name.toLowerCase() === item.name.toLowerCase())) throw new Error('An item with this name already exists.');
  const names = new Set(['g', 'kg', 'ml', 'l', 'pcs']);
  for (const pack of item.packs) {
    const name = pack.name.trim().toLowerCase();
    if (!name || names.has(name) || !Number.isFinite(pack.quantity) || pack.quantity <= 0 || (item.unit === 'pcs' && !Number.isInteger(pack.quantity))) throw new Error('Pack names must be unique and quantities must be positive base units. Piece packs require whole numbers.');
    names.add(name);
  }
  const recipes = state.recipes.map(recipe => ({ ...recipe, ingredients: recipe.ingredients.map(line => {
    const oldPack = previous?.packs.find(p => p.name === line.unit);
    if (line.itemId !== item.id || !previous || !oldPack || item.packs.some(p => p.name === oldPack.name && p.quantity === oldPack.quantity)) return line;
    return { ...line, quantity: convert(previous, line.quantity, line.unit), unit: previous.unit };
  }) }));
  return { ...state, revision: state.revision + 1, recipes, items: previous ? state.items.map(i => i.id === item.id ? item : i) : [...state.items, item] };
}
export function menuChanged(previous: CateringEvent, next: CateringEvent) {
  return previous.guests !== next.guests || JSON.stringify(previous.dishes) !== JSON.stringify(next.dishes) || JSON.stringify(previous.supplies) !== JSON.stringify(next.supplies);
}
export function saveEvent(state: State, event: CateringEvent): State {
  const previous = state.events.find(e => e.id === event.id);
  const next = { ...state, revision: state.revision + 1, events: previous ? state.events.map(e => e.id === event.id ? event : e) : [...state.events, event] };
  return previous && event.status === 'Confirmed' && menuChanged(previous, event) ? confirmEvent(next, event.id, undefined, true) : next;
}
export function requirements(state: State, event: CateringEvent, fresh = false): Record<string, number> {
  if (!fresh && event.snapshot) return event.snapshot;
  const result: Record<string, number> = {};
  for (const dish of event.dishes) {
    const recipe = state.recipes.find(r => r.id === dish.recipeId);
    if (!recipe || recipe.servings <= 0 || dish.servings < 0) throw new Error('Check the recipe and serving quantities.');
    for (const ingredient of recipe.ingredients) {
      const item = state.items.find(i => i.id === ingredient.itemId);
      if (!item) throw new Error('A recipe ingredient is missing.');
      result[item.id] = round((result[item.id] || 0) + convert(item, ingredient.quantity, ingredient.unit) * dish.servings / recipe.servings);
    }
  }
  for (const supply of event.supplies) result[supply.itemId] = round((result[supply.itemId] || 0) + supply.quantity * (supply.perGuest ? event.guests : 1));
  for (const id of Object.keys(result)) if (state.items.find(i => i.id === id)?.unit === 'pcs') result[id] = Math.ceil(result[id]);
  return result;
}
export function used(state: State, eventId: string, itemId: string) {
  return round(-state.movements.filter(m => m.eventId === eventId && m.itemId === itemId && (m.action === 'use' || m.action === 'correction')).reduce((a, m) => a + m.quantity, 0));
}
export function latestCost(state: State, itemId: string) {
  return [...state.batches].reverse().filter(b => b.itemId === itemId).sort((a, b) => b.received.localeCompare(a.received))[0]?.cost || 0;
}
export function allocations(state: State, date = today()) {
  const remaining = new Map(state.batches.map(b => [b.id, b.expiry && b.expiry < date ? 0 : b.quantity]));
  const result: Record<string, Record<string, Allocation[]>> = {};
  const events = state.events.filter(e => e.status === 'Confirmed').sort((a, b) => a.prepDate.localeCompare(b.prepDate) || (a.confirmedAt || '').localeCompare(b.confirmedAt || '') || a.id.localeCompare(b.id));
  for (const event of events) {
    result[event.id] = {};
    for (const [itemId, total] of Object.entries(requirements(state, event))) {
      let need = Math.max(0, total - used(state, event.id, itemId));
      const selected: Allocation[] = [];
      for (const batch of [...state.batches].filter(b => b.itemId === itemId && (!b.expiry || b.expiry >= event.date)).sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999') || a.received.localeCompare(b.received))) {
        const take = Math.min(need, remaining.get(batch.id) || 0);
        if (take > 0) { selected.push({ batchId: batch.id, quantity: take }); remaining.set(batch.id, round((remaining.get(batch.id) || 0) - take)); need = round(need - take); }
      }
      result[event.id][itemId] = selected;
    }
  }
  return result;
}
export function balances(state: State, date = today()) {
  const reserved = allocations(state, date);
  return Object.fromEntries(state.items.map(item => {
    const batches = state.batches.filter(b => b.itemId === item.id);
    const physical = round(batches.reduce((a, b) => a + b.quantity, 0));
    const usable = round(batches.filter(b => !b.expiry || b.expiry >= date).reduce((a, b) => a + b.quantity, 0));
    const held = round(Object.values(reserved).flatMap(e => e[item.id] || []).reduce((a, b) => a + b.quantity, 0));
    const demand = round(state.events.filter(e => e.status === 'Confirmed').reduce((a, e) => a + Math.max(0, (requirements(state, e)[item.id] || 0) - used(state, e.id, item.id)), 0));
    return [item.id, { physical, usable, reserved: held, available: round(usable - held), shortage: Math.max(0, round(demand - held)), value: batches.reduce((a, b) => a + b.quantity * b.cost, 0) }];
  }));
}
export function eventShortage(state: State, event: CateringEvent) {
  const allocated = allocations(state)[event.id] || {};
  return Object.fromEntries(Object.entries(requirements(state, event)).map(([id, total]) => [id, Math.max(0, total - used(state, event.id, id) - (allocated[id] || []).reduce((a, b) => a + b.quantity, 0))]));
}
export function buyList(state: State, from: string, to: string) {
  const windowed = { ...state, events: state.events.filter(e => e.prepDate <= to) };
  const bs = balances(windowed, from);
  return state.items.filter(i => !i.archived).map(item => ({ item, quantity: round(bs[item.id].shortage + Math.max(0, item.threshold - bs[item.id].available)), shortage: bs[item.id].shortage })).filter(row => row.quantity > 0);
}
export function confirmEvent(state: State, id: string, time = new Date().toISOString(), refresh = false): State {
  const copy = structuredClone(state); const event = copy.events.find(e => e.id === id);
  if (!event || !['Draft', 'Confirmed'].includes(event.status)) throw new Error('Only draft or confirmed events can be planned.');
  if (event.prepDate > event.date || event.guests <= 0 || !event.name.trim()) throw new Error('Check the event dates, name, and guest count.');
  if (event.status === 'Confirmed' && !refresh) throw new Error('This event is already confirmed.');
  event.snapshot = requirements(copy, event, true); event.status = 'Confirmed'; event.confirmedAt ||= time;
  const held = allocations(copy, time.slice(0, 10))[id] || {};
  event.estimatedCost = Object.entries(event.snapshot).reduce((sum, [itemId, total]) => {
    const rows = held[itemId] || []; const qty = rows.reduce((a, b) => a + b.quantity, 0);
    return sum + rows.reduce((a, row) => a + row.quantity * (copy.batches.find(b => b.id === row.batchId)?.cost || 0), 0) + Math.max(0, total - qty) * latestCost(copy, itemId);
  }, 0);
  copy.revision++; return copy;
}
export function completeEvent(state: State, id: string): State {
  const copy = structuredClone(state); const event = copy.events.find(e => e.id === id);
  if (!event || event.status !== 'Confirmed') throw new Error('Only confirmed events can be completed.');
  event.status = 'Completed'; copy.revision++; return copy;
}
export function applyEntry(state: State, entry: Entry): State {
  if (!entry.id || state.movements.some(m => m.entryId === entry.id)) throw new Error('This entry has already been saved.');
  if (!entry.lines.length || !entry.reason.trim()) throw new Error('Add items and a reason.');
  if (!z.iso.date().safeParse(entry.date).success || entry.date > today()) throw new Error('Choose a valid date no later than today.');
  const copy = structuredClone(state);
  const event = entry.eventId ? copy.events.find(e => e.id === entry.eventId) : undefined;
  if (entry.eventId && (!event || event.status !== 'Confirmed' || entry.action !== 'use')) throw new Error('Usage can only be linked to a confirmed event.');
  if (entry.action === 'receive' && !copy.suppliers.some(s => s.id === entry.supplierId)) throw new Error('Choose a supplier.');
  const counted = new Set<string>();
  for (const line of entry.lines) {
    const item = copy.items.find(i => i.id === line.itemId && !i.archived);
    if (!item) throw new Error('Choose an active inventory item.');
    const quantity = convert(item, line.quantity, line.unit);
    if (entry.action !== 'count' && quantity <= 0) throw new Error('Quantity must be greater than zero.');
    const record = (batchId: string, delta: number, cost: number) => copy.movements.push({ id: uid(), entryId: entry.id, itemId: item.id, batchId, action: entry.action, quantity: round(delta), cost: Math.abs(delta) * cost, date: entry.date, reason: entry.reason, eventId: entry.eventId });
    if (entry.action === 'receive') {
      if (line.totalCost === undefined || !Number.isFinite(line.totalCost) || line.totalCost < 0) throw new Error('Enter the total purchase cost.');
      if (item.requiresExpiry && !line.expiry) throw new Error(`Enter the expiry date for ${item.name}.`);
      if (line.expiry && (!z.iso.date().safeParse(line.expiry).success || line.expiry < entry.date)) throw new Error('Enter a valid expiry on or after receiving.');
      const batch = { id: uid(), itemId: item.id, received: entry.date, expiry: line.expiry || '', quantity, cost: line.totalCost / quantity, supplierId: entry.supplierId! };
      copy.batches.push(batch); record(batch.id, quantity, batch.cost); continue;
    }
    const batches = copy.batches.filter(b => b.itemId === item.id);
    if (entry.action === 'count') {
      const batch = line.batchId ? batches.find(b => b.id === line.batchId) : batches.length === 1 ? batches[0] : undefined;
      if (!batch) throw new Error('Choose a batch to reconcile this physical count.');
      if (batch.received > entry.date) throw new Error('This batch had not arrived on the count date.');
      if (counted.has(batch.id)) throw new Error('Count each batch only once.'); counted.add(batch.id);
      record(batch.id, quantity - batch.quantity, batch.cost); batch.quantity = quantity; continue;
    }
    const holds = allocations(copy, entry.date);
    let need = quantity;
    const usableThrough = event && event.date > entry.date ? event.date : entry.date;
    const eligible = batches.filter(b => b.received <= entry.date && (!line.batchId || b.id === line.batchId) && (entry.action === 'waste' || !b.expiry || b.expiry >= usableThrough)).sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999') || a.received.localeCompare(b.received));
    for (const batch of eligible) {
      const otherHeld = entry.action === 'waste' ? 0 : Object.entries(holds).filter(([eventId]) => eventId !== entry.eventId).flatMap(([, items]) => items[item.id] || []).filter(a => a.batchId === batch.id).reduce((a, row) => a + row.quantity, 0);
      const take = Math.min(need, Math.max(0, batch.quantity - otherHeld));
      if (take > 0) { batch.quantity = round(batch.quantity - take); record(batch.id, -take, batch.cost); need = round(need - take); }
    }
    if (need > 0) throw new Error(`Not enough eligible, unreserved ${item.name}. Receive stock or review event reservations.`);
  }
  copy.revision++; return copy;
}
export function reverseEntry(state: State, entryId: string, reason: string): State {
  const rows = state.movements.filter(m => m.entryId === entryId);
  if (!rows.length || rows.some(m => m.action === 'correction') || state.movements.some(m => m.corrects === entryId) || !reason.trim()) throw new Error('This entry cannot be reversed, or a correction reason is missing.');
  const copy = structuredClone(state); const correctionId = uid();
  for (const row of rows) {
    const batch = copy.batches.find(b => b.id === row.batchId)!;
    if (batch.quantity - row.quantity < 0) throw new Error('This stock has already been consumed. Reconcile it with a physical count instead.');
    batch.quantity = round(batch.quantity - row.quantity);
    copy.movements.push({ ...row, id: uid(), entryId: correctionId, action: 'correction', quantity: -row.quantity, cost: -row.cost, date: today(), reason, corrects: entryId });
  }
  copy.revision++; return copy;
}
