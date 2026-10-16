'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import { ArrowUp, Check, MessageSquareText, Plus, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInventory } from './store';
import { ErrorMessage } from './common';
import { draftSchema, draftToEntry, type QuickDraft } from '@/lib/quick-log';
import { uid } from '@/lib/inventory';
import type { Entry } from '@/lib/types';
type Message = { role: 'user' | 'assistant'; content: string };
function loadDraft(eventId?: string) {
  const empty = { messages: [] as Message[], draft: null as QuickDraft | null, text: '', entryId: uid(), error: '' };
  try {
    const raw = localStorage.getItem('saluhan-draft-v1'); if (!raw) return empty;
    const data = JSON.parse(raw); if ((data.eventId || '') !== (eventId || '')) return empty;
    return { ...empty, draft: data.draft ? draftSchema.parse(data.draft) : null, messages: Array.isArray(data.messages) ? data.messages.filter((m: Message) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-10) : [], text: typeof data.text === 'string' ? data.text : '', entryId: typeof data.entryId === 'string' ? data.entryId : empty.entryId };
  } catch { return { ...empty, error: 'The previous draft could not be loaded. Start a new entry.' }; }
}
export function QuickLogPanel({ onClose, eventId, review, receipt }: { onClose: () => void; eventId?: string; review: (entry: Partial<Entry>) => void; receipt?: string }) {
  const { state } = useInventory(); const [initial] = useState(() => loadDraft(eventId)); const [messages, setMessages] = useState<Message[]>(initial.messages); const [draft, setDraft] = useState<QuickDraft | null>(initial.draft); const [text, setText] = useState(initial.text); const [error, setError] = useState(initial.error); const [busy, setBusy] = useState(false); const [entryId, setEntryId] = useState(initial.entryId); const end = useRef<HTMLDivElement>(null);
  const event = state.events.find(e => e.id === eventId);
  // A failed write to the external storage system must be reported in the UI.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { localStorage.setItem('saluhan-draft-v1', JSON.stringify({ messages: messages.slice(-10), draft, text, eventId, entryId })); } catch { setError('Draft could not be saved in this browser. Keep this panel open.'); } }, [messages, draft, text, eventId, entryId]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
  const saved = state.movements.some(m => m.entryId === entryId) || receipt === entryId;
  function reset() { setMessages([]); setDraft(null); setText(''); setError(''); setEntryId(uid()); }
  async function send() {
    if (!text.trim() || busy || saved) return;
    const message = text.trim(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/quick-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history: messages.slice(-8), draft, eventId: eventId || null, catalog: { items: state.items.filter(i => !i.archived), suppliers: state.suppliers, events: state.events.filter(e => e.status === 'Confirmed').map(({ id, name, status }) => ({ id, name, status })), batches: state.batches.map(({ id, itemId, expiry, quantity }) => ({ id, itemId, expiry, quantity })) } }), signal: AbortSignal.timeout(35000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'Unable to interpret your message.');
      const next = draftSchema.parse(data.draft); setDraft(next); setMessages([...messages, { role: 'user', content: message }, { role: 'assistant', content: next.questions.length ? `${next.message}\n\n${next.questions.join('\n')}` : next.message }]); setText('');
    } catch (e) { setError(e instanceof Error && e.name === 'TimeoutError' ? 'The assistant took too long. Your message is kept; try again.' : (e as Error).message); } finally { setBusy(false); }
  }
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="chat-overlay"/><Dialog.Content className="chat-panel"><header className="chat-header"><div className="quick-symbol"><Sparkles size={19}/></div><div><Dialog.Title>Quick log</Dialog.Title><Dialog.Description>A conversation, then a stock entry.</Dialog.Description></div><Dialog.Close asChild><Button size="icon" variant="ghost" aria-label="Close Quick log"><X size={20}/></Button></Dialog.Close></header>{event && <div className="chat-context">Logging for <strong>{event.name}</strong></div>}<div className="chat-body">{messages.length === 0 && <div className="chat-welcome"><MessageSquareText size={32}/><h2>What moved in your kitchen?</h2><p>Tell me what arrived, what you used, or what’s left. English or Taglish is fine.</p><div className="chat-examples">{['Received 2 sacks of rice at ₱1,250 each', 'Nagamit 3 kilo na chicken para sa Santos wedding', 'May 8 kg na rice na lang'].map(example => <button key={example} onClick={() => setText(example)}>{example}<ArrowUp size={14}/></button>)}</div><small>You’ll review every entry before stock changes.</small></div>}{messages.map((m, i) => <div className={`chat-message ${m.role}`} key={i}>{m.role === 'assistant' && <Sparkles size={14}/>}<p>{m.content}</p></div>)}{busy && <div className="chat-thinking" role="status"><span/>Reading your inventory update…</div>}{draft && !draft.questions.length && !saved && <div className="chat-review"><h3>Draft ready for review</h3>{draft.lines.map((line, i) => <div key={i}><span>{state.items.find(it => it.id === line.itemId)?.name}</span><strong>{line.quantity} {line.unit}</strong></div>)}<Button className="full-width" onClick={() => { try { review(draftToEntry(draft, entryId)); } catch (e) { setError((e as Error).message); } }}>Review & edit entry</Button></div>}{saved && <div className="chat-saved"><Check size={22}/><h3>Entry saved</h3><p>Stock and event reservations have been updated.</p><a href="#activity" onClick={onClose}>View movement history</a><Button variant="outline" onClick={reset}><Plus size={15}/>Start another entry</Button></div>}<ErrorMessage message={error}/>{error && <Button variant="outline" onClick={() => { review({ eventId }); }}>Use regular inventory form</Button>}<div ref={end}/></div><footer className="chat-compose"><form onSubmit={e => { e.preventDefault(); void send(); }}><textarea aria-label="Inventory message" placeholder="e.g. Received 10 kg chicken…" rows={2} maxLength={2000} value={text} disabled={saved} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}/><Button type="submit" size="icon" disabled={busy || !text.trim() || saved} aria-label="Send message"><ArrowUp size={19}/></Button></form><div><span>AI drafts can be wrong. Review before saving.</span><button onClick={reset} disabled={busy}>New entry</button></div></footer></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
