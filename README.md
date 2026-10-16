# Saluhan catering inventory

A local inventory prototype for a catering owner or manager. Includes ingredients and consumables, batch expiry and costs, recipes, event reservations and partial usage, buying suggestions, reports, and conversational inventory entry.

## Run locally

```sh
bun install
bun run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000. Sample records load automatically. Changes persist in this browser. Settings > Reset demo restores the sample records after confirmation.

## Enable Quick log

Copy `.env.example` to `.env.local`, set `OPENAI_API_KEY` locally, and restart the server. `OPENAI_MODEL` defaults to `gpt-5-mini`. Keep the key on the server and out of source control.

Quick log sends the message, active conversation, and inventory catalog to OpenAI. It returns a draft for clarification and review. Stock changes only after Save entry. Manual entry works without an API key. Missing configuration or service failures show an error and preserve the draft.

Try these with the sample catalog, then answer requests for supplier, expiry, price basis, event, or batch:

- `Received 2 sacks of rice at PHP 1,250 each.`
- `Nagamit 3 kilo na chicken para sa Santos wedding.`
- `Nasayang 2 liters of milk, panis na.`
- `May 8 kg na rice na lang.`

The endpoint accepts localhost requests only. Before public hosting, add authentication, shared storage with access controls, and durable usage limits. This prototype has no real accounts or cross-device synchronization.

## Verification

```sh
bun test
bun run typecheck
bun run lint
bun run build
```

Tests cover stock calculations, reservation priority, expiry, counts, corrections, catalog changes, structured draft validation, missing configuration, origin checks, and mocked OpenAI transport. Mocked responses do not establish real English or Taglish interpretation accuracy.

For a live evaluation, configure a key and test the examples above plus ambiguous item names, missing costs, multiple items, mixed actions, and changed quantities. Verify that unclear requests ask a question, edits do not change stock, and saving changes it exactly once. Compare movement history and event usage after each save. Live AI evaluation remains pending until a key is configured.

## Implementation notes

- Next.js App Router, React, TypeScript, Tailwind, shadcn/ui and Lucide React.
- React Hook Form and Zod validate forms; TanStack Table provides tables.
- `lib/inventory.ts` owns stock mutations and calculations shared by manual and chat entry.
- `components/store.tsx` validates versioned browser state and reports storage failures.
- `app/api/quick-log/route.ts` uses OpenAI Responses structured outputs. It cannot mutate stock.
- Base units are grams, milliliters, and pieces. Packs are item-specific. Recipe amounts are preserved when a referenced pack changes.
- Confirmed events snapshot their requirements. Recipe changes can be explicitly refreshed. Usage consumes stock immediately; completion releases unused reservations.
- Spreadsheet import is a labeled sample preview only.

The agreed scope and remaining verification are recorded in [the implementation plan](docs/plans/catering-inventory-implementation.md).
