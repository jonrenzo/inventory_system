import { z } from 'zod';
import { convert, today } from './inventory';
import type { Entry, State } from './types';

export const draftSchema = z.object({
  action: z.enum(['receive', 'use', 'waste', 'count']).nullable(),
  date: z.string().nullable(), eventId: z.string().nullable(), supplierId: z.string().nullable(),
  reason: z.string(), message: z.string(), questions: z.array(z.string()),
  lines: z.array(z.object({ itemId: z.string().nullable(), quantity: z.number().nullable(), unit: z.string().nullable(), batchId: z.string().nullable(), expiry: z.string().nullable(), priceAmount: z.number().nullable(), priceBasis: z.enum(['total', 'per-unit']).nullable() })),
});
export type QuickDraft = z.infer<typeof draftSchema>;
export type Catalog = Pick<State, 'items' | 'suppliers' | 'events' | 'batches'>;
export function normalizeDraft(input: unknown, catalog: Catalog): QuickDraft {
  const draft = draftSchema.parse(input); const questions = [...draft.questions];
  if (!draft.action) questions.push('Choose one action: receiving, usage, waste, or physical count.');
  if (!draft.date || !z.iso.date().safeParse(draft.date).success || draft.date > today()) questions.push('Which date should this entry use? It cannot be in the future.');
  if (!draft.reason.trim()) questions.push('Add a reason or reference for this entry.');
  if (draft.eventId && !catalog.events.some(e => e.id === draft.eventId && e.status === 'Confirmed')) { draft.eventId = null; questions.push('Choose a confirmed event, or explicitly select general usage.'); }
  if (draft.action !== 'use') draft.eventId = null;
  if (draft.action === 'receive' && !catalog.suppliers.some(s => s.id === draft.supplierId)) { draft.supplierId = null; questions.push('Which supplier delivered these items?'); }
  if (!draft.lines.length) questions.push('Which inventory items should be logged?');
  for (const [index, line] of draft.lines.entries()) {
    const item = catalog.items.find(i => i.id === line.itemId && !i.archived);
    if (!item) { line.itemId = null; questions.push(`Choose an existing item for line ${index + 1}.`); continue; }
    if (line.quantity === null || line.unit === null || !Number.isFinite(line.quantity) || line.quantity < 0 || (draft.action !== 'count' && line.quantity === 0)) questions.push(`What quantity and unit of ${item.name}?`);
    else { try { convert(item, line.quantity, line.unit); } catch { questions.push(`Choose a compatible unit or known pack for ${item.name}.`); } }
    if (draft.action === 'receive') {
      if (line.priceAmount === null || !Number.isFinite(line.priceAmount) || line.priceAmount < 0 || !line.priceBasis) questions.push(`What was the price of ${item.name}, and was it a total or per ${line.unit || 'unit'}?`);
      if (item.requiresExpiry && !line.expiry) questions.push(`What is the expiry date for ${item.name}?`);
      if (line.expiry && (!z.iso.date().safeParse(line.expiry).success || line.expiry < (draft.date || ''))) questions.push(`Check the expiry date for ${item.name}.`);
    }
    const batches = catalog.batches.filter(b => b.itemId === item.id);
    if (line.batchId && !batches.some(b => b.id === line.batchId)) { line.batchId = null; questions.push(`Choose an existing batch of ${item.name}.`); }
    if (draft.action === 'count' && !line.batchId) {
      if (batches.length === 1) line.batchId = batches[0].id;
      else questions.push(`Reconcile ${item.name} by batch: choose a batch and its remaining count.`);
    }
  }
  draft.questions = [...new Set(questions)]; return draft;
}
export function draftToEntry(draft: QuickDraft, id: string): Entry {
  if (draft.questions.length || !draft.action || !draft.date) throw new Error('Resolve the missing details before reviewing this entry.');
  return { id, action: draft.action, date: draft.date, reason: draft.reason, supplierId: draft.supplierId || undefined, eventId: draft.eventId || undefined, lines: draft.lines.map(line => ({ itemId: line.itemId!, quantity: line.quantity!, unit: line.unit!, batchId: line.batchId || undefined, expiry: line.expiry || undefined, totalCost: line.priceAmount === null ? undefined : line.priceBasis === 'per-unit' ? Math.round(line.priceAmount * line.quantity! * 100) / 100 : line.priceAmount })) };
}
