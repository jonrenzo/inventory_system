import { afterEach, expect, spyOn, test } from 'bun:test';
import { POST } from './route';
import { createSeed } from '@/lib/seed';

const originalKey = process.env.OPENAI_API_KEY;
let transport: ReturnType<typeof spyOn> | undefined;
afterEach(() => { transport?.mockRestore(); transport = undefined; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
function request(message: string) {
  const state = createSeed();
  return new Request('http://localhost:3000/api/quick-log', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' }, body: JSON.stringify({ message, history: [], draft: null, eventId: null, catalog: { items: state.items, suppliers: state.suppliers, events: state.events.map(({ id, name, status }) => ({ id, name, status })), batches: state.batches.map(({ id, itemId, expiry, quantity }) => ({ id, itemId, expiry, quantity })) } }) });
}
test('missing API configuration returns an actionable error without a network request', async () => {
  delete process.env.OPENAI_API_KEY;
  const result = await POST(request('Received rice'));
  expect(result.status).toBe(503);
  expect((await result.json()).error.code).toBe('not_configured');
});
test('cross-origin and externally hosted demo requests are denied', async () => {
  expect((await POST(new Request('https://example.com/api/quick-log', { method: 'POST' }))).status).toBe(403);
  expect((await POST(new Request('http://localhost:3000/api/quick-log', { method: 'POST', headers: { origin: 'https://example.com' } }))).status).toBe(403);
});
test('local origin uses the browser host header when Next normalizes the request URL', async () => {
  delete process.env.OPENAI_API_KEY;
  const response = await POST(new Request('http://localhost:3000/api/quick-log', { method: 'POST', headers: { origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' } }));
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe('not_configured');
});
test('invalid requests are rejected before inference', async () => {
  process.env.OPENAI_API_KEY = 'test-placeholder';
  const response = await POST(new Request('http://localhost:3000/api/quick-log', { method: 'POST', body: '{}' }));
  expect(response.status).toBe(400);
});
test('real SDK parsing and endpoint validation return a count draft for review', async () => {
  process.env.OPENAI_API_KEY = 'test-placeholder';
  const draft = { action: 'count', date: '2026-10-05', eventId: null, supplierId: null, reason: 'Physical count', message: 'Review the remaining rice.', questions: [], lines: [{ itemId: 'rice', quantity: 8, unit: 'kg', batchId: null, expiry: null, priceAmount: null, priceBasis: null }] };
  let transmitted = '';
  transport = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (_url: URL | RequestInfo, options?: RequestInit) => {
    transmitted = String(options?.body);
    return new Response(JSON.stringify({ id: 'response-test', object: 'response', created_at: 1, status: 'completed', model: 'gpt-5-mini', output: [{ id: 'message-test', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(draft), annotations: [] }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }, { preconnect: globalThis.fetch.preconnect }));
  const response = await POST(request('May 8 kg na rice na lang'));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.draft.action).toBe('count');
  expect(result.draft.lines[0].batchId).toBe('batch-rice');
  expect(result.draft.questions).toEqual([]);
  expect(JSON.parse(transmitted).store).toBe(false);
  expect(transmitted).not.toContain('movements');
});
test('upstream failures return recoverable errors rather than pretending to save', async () => {
  process.env.OPENAI_API_KEY = 'test-placeholder';
  transport = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Transport unavailable'));
  const response = await POST(request('Used rice'));
  expect(response.status).toBe(502);
  expect((await response.json()).error.code).toBe('upstream_error');
});
