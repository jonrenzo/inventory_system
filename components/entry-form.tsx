'use client';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Plus, Trash2, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInventory } from './store';
import { ErrorMessage, Field, Modal } from './common';
import { allocations, applyEntry, balances, displayQty, money, today, uid, units } from '@/lib/inventory';
import type { Entry } from '@/lib/types';

export function EntryForm({ initial, onClose, onSaved }: { initial?: Partial<Entry>; onClose: () => void; onSaved?: (id: string) => void }) {
  const { state, update } = useInventory();
  const [error, setError] = useState('');
  const [review, setReview] = useState<{ entry: Entry; revision: number; stock: ReturnType<typeof balances> } | null>(null);
  const form = useForm<Entry>({ defaultValues: { id: uid(), action: 'receive', date: today(), reason: 'Delivery received', supplierId: '', eventId: '', lines: [{ itemId: '', quantity: 1, unit: 'kg', expiry: '', totalCost: undefined, batchId: '' }], ...initial } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const action = useWatch({ control: form.control, name: 'action' }); const lines = useWatch({ control: form.control, name: 'lines' }); const eventId = useWatch({ control: form.control, name: 'eventId' }); const entryDate = useWatch({ control: form.control, name: 'date' });
  const stock = balances(state); const reserved = allocations(state);
  function preview(entry: Entry) {
    try {
      const clean = { ...entry, eventId: entry.action === 'use' ? entry.eventId || undefined : undefined, supplierId: entry.action === 'receive' ? entry.supplierId : undefined };
      const next = applyEntry(state, clean); setReview({ entry: clean, revision: state.revision, stock: balances(next) }); setError('');
    } catch (e) { setError((e as Error).message); }
  }
  function save() {
    if (!review) return;
    if (review.revision !== state.revision) { setError('Stock changed since this review. Review the entry again.'); setReview(null); return; }
    try { update(applyEntry(state, review.entry)); onSaved?.(review.entry.id); onClose(); } catch (e) { setError((e as Error).message); setReview(null); }
  }
  return <Modal wide title={review ? 'Review inventory entry' : 'Log inventory'} description="Your stock changes only when you save the reviewed entry." onClose={onClose}>
    <ErrorMessage message={error}/>
    {review ? <div className="form-body"><div className="review-banner"><Check size={20}/><div><strong>Ready to record {review.entry.action}</strong><p>{review.entry.reason} · {formatReviewDate(review.entry.date)}</p></div></div>{review.entry.lines.map((line, index) => {
      const item = state.items.find(i => i.id === line.itemId)!;
      const batch = state.batches.find(b => b.id === line.batchId);
      return <div className="review-row" key={index}><div><strong>{item.name}</strong><small>{line.quantity} {line.unit}{line.totalCost !== undefined && action === 'receive' ? ` · ${money(line.totalCost)}` : ''}</small><small>{batch ? `Batch ${batch.id.slice(0, 8)}` : action === 'receive' ? 'New batch' : 'Automatic batch selection'}{(line.expiry || batch?.expiry) && ` · Expires ${line.expiry || batch?.expiry}`}</small></div><div className="quantity-change" aria-label="Total stock before and after the complete entry">{displayQty(item, stock[item.id].physical)}<ArrowRight size={15}/><strong>{displayQty(item, review.stock[item.id].physical)}</strong></div></div>;
    })}<p className="muted">Batch allocation and event reservations will be recalculated when saved.</p><div className="form-actions"><Button variant="outline" onClick={() => setReview(null)}>Edit entry</Button><Button onClick={save}><Check size={16}/>Save entry</Button></div></div> : <form onSubmit={form.handleSubmit(preview)} className="form-body">
      <div className="form-grid"><Field label="Action"><select {...form.register('action')} onChange={e => { const v = e.target.value as Entry['action']; form.setValue('action', v); form.setValue('reason', { receive: 'Delivery received', use: 'Kitchen preparation', waste: 'Spoilage', count: 'Physical stock count' }[v]); }}><option value="receive">Receive delivery</option><option value="use">Record usage</option><option value="waste">Record waste</option><option value="count">Physical count</option></select></Field><Field label="Date"><input type="date" max={today()} required {...form.register('date')}/></Field>
      {action === 'receive' && <Field label="Supplier"><select required {...form.register('supplierId')}><option value="">Choose a supplier</option>{state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
      {action === 'use' && <Field label="Assign usage"><select {...form.register('eventId')}><option value="">General usage · no event</option>{state.events.filter(e => e.status === 'Confirmed').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>}
      <Field label="Reason / reference"><input required {...form.register('reason')}/></Field></div>
      {fields.map((field, index) => {
        const line = lines[index]; const item = state.items.find(i => i.id === line?.itemId);
        const batches = state.batches.filter(b => b.itemId === item?.id && (action === 'count' || b.quantity > 0));
        const held = eventId && item ? (reserved[eventId]?.[item.id] || []).reduce((sum, b) => sum + b.quantity, 0) : 0;
        return <div className="line-editor" key={field.id}><div className="line-top"><span>Item {index + 1}</span>{fields.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} onClick={() => remove(index)}><Trash2 size={15}/></Button>}</div><div className="form-grid"><Field label="Inventory item"><select required {...form.register(`lines.${index}.itemId`)} onChange={e => { form.setValue(`lines.${index}.itemId`, e.target.value); const next = state.items.find(i => i.id === e.target.value); form.setValue(`lines.${index}.unit`, next?.unit === 'g' ? 'kg' : next?.unit === 'mL' ? 'L' : 'pcs'); form.setValue(`lines.${index}.batchId`, ''); }}><option value="">Choose an item</option>{state.items.filter(i => !i.archived).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
        <div className="quantity-fields"><Field label={action === 'count' ? 'Counted quantity' : 'Quantity'}><input type="number" min={action === 'count' ? 0 : .001} step="any" required {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })}/></Field><Field label="Unit"><select {...form.register(`lines.${index}.unit`)}>{(item ? units(item) : ['kg']).map(unit => <option key={unit}>{unit}</option>)}</select></Field></div>
        {action === 'receive' ? <><Field label="Total cost (PHP)"><input type="number" min="0" step="0.01" required {...form.register(`lines.${index}.totalCost`, { valueAsNumber: true })}/></Field><Field label={`Expiry${item?.requiresExpiry ? ' · required' : ' · optional'}`}><input type="date" required={item?.requiresExpiry} min={entryDate} {...form.register(`lines.${index}.expiry`)}/></Field></> : <Field label={action === 'count' ? 'Batch to count' : 'Batch selection'} hint={action === 'count' ? 'Enter the quantity remaining in this batch, including zero.' : 'Automatic selection uses eligible batches with the earliest expiry.'}><select required={action === 'count'} {...form.register(`lines.${index}.batchId`)}><option value="">{action === 'count' ? 'Choose a batch' : 'Earliest expiry · automatic'}</option>{batches.map(b => <option key={b.id} value={b.id}>{b.expiry || 'No expiry'} · {item && displayQty(item, b.quantity)} · {b.id.slice(0, 8)}</option>)}</select></Field>}</div>
        {item && <small className="stock-hint">Available: {displayQty(item, stock[item.id].available)}{held > 0 && ` · Reserved for this event: ${displayQty(item, held)}`}</small>}</div>;
      })}
      <Button type="button" variant="outline" onClick={() => append({ itemId: '', quantity: 1, unit: 'kg' })}><Plus size={15}/>Add another item</Button>
      <div className="form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Review entry<ArrowRight size={15}/></Button></div>
    </form>}
  </Modal>;
}
function formatReviewDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }); }
