# Catering inventory prototype with conversational quick logging

Status: local prototype implemented; live AI evaluation remains pending. This is the agreed plan from the planning conversation.

## Summary

Build an interactive prototype for one catering business, used by its owner or manager on phones and computers. Combine conventional inventory screens with a Quick log assistant that understands English and Taglish. Managers type inventory updates, review the interpreted entry, and save it.

Inventory remains in versioned local browser storage with realistic sample data and a confirmed Reset demo action. Chat uses a real OpenAI connection through the Next.js server. Production authentication, shared database storage, and hosting remain deferred. Events support multiple usage entries during preparation, replacing the earlier single-entry proposal.

## Screens and workflows

| Area | Behavior |
| --- | --- |
| Dashboard | Upcoming preparation, shortages, low stock, and expiring batches linked to records. |
| Inventory | Searchable ingredients and consumables; physical, reserved, and available quantities; batches and movement history. |
| Receiving and adjustments | Deliveries, suppliers, purchase costs, pack conversions, expiry, counts, and waste with reasons. |
| Recipes | Editable serving yields, ingredient quantities, and estimated costs per serving. |
| Events | Event/preparation dates, guest counts, dish-serving overrides, consumables, reservations, and usage history. |
| Buy list | Combine shortages and low-stock requirements for a selected period without double counting. |
| Reports | Stock value, purchase spending, waste costs, usage, and planned versus actual event costs. |
| Settings | Business name/logo, categories, suppliers, units, pack sizes, thresholds, and reusable consumable lists. |

Working forms, filters, and edits; archive referenced items instead of deleting history. Include a labeled sample spreadsheet-import preview; real spreadsheet processing is deferred.

## Stock rules

- One stock pool, separate received batches; optional expiry for nonperishables.
- kg/g, L/mL, item-specific packs; reject incompatible conversions.
- Scale recipes by serving yield; guest-count default with dish overrides. Consumables support per-guest and fixed quantities.
- Event states: Draft, Confirmed, Completed, Canceled.
- Confirmation reserves remaining requirements without reducing physical stock; shortages permitted and flagged.
- Allocate by preparation date then confirmation order. Prefer earliest expiry usable through the event date.
- Usage immediately reduces stock and remaining reservations. Completion records only additional usage and releases remaining reservations.
- Cancellation releases reservations without restoring consumed stock. Waste/counts expose affected shortages.
- Linked corrections preserve history. Reject negative stock and duplicate saves.
- Batch costs determine valuation and actual costs. Planned estimates use allocated costs and latest purchase costs for shortages. Snapshot confirmed requirements and estimates; recipe updates require explicit refresh.

## Quick log

Persistent desktop panel/mobile full-screen entry, with visible event context when applicable. English and Taglish input; English review fields.

Examples: "Received 2 sacks of rice at PHP 1,250 each", "Nagamit 3 kilo na chicken para sa Santos wedding", "Nasayang 2 liters of milk, panis na", "May 8 kg na rice na lang".

Interpret into a draft, ask for missing details, show editable entries and stock effects, save only on explicit review confirmation, then show a movement receipt. Support multiple items per action; mixed action types require separate drafts.

- Distinguish consumption from a remaining physical count.
- Resolve existing item/supplier/event IDs; clarify ambiguous matches. Never invent units, packs, prices, expiry, or catalog entries.
- Clarify unit/pack/total price ambiguity. Receiving requires supplier and cost, and expiry when configured.
- General usage can explicitly omit an event. Suggest eligible batches; physical counts reconcile all batches.
- Revalidate on save; changed stock requires refreshed review. Same mutations for chat and forms.
- Draft edits/cancel do not change stock. Corrections use movement history.
- Text only: no voice, receipt images, reporting assistant, or autonomous stock changes.

## Architecture and interfaces

Existing Next.js App Router, TypeScript, Tailwind, Bun; installed Next.js docs are authoritative. shadcn/ui, lucide-react, React Hook Form, Zod, TanStack Table. React context/reducer with shared pure calculations; no separate global-state library.

Shared types: settings, items, suppliers, batches, movements, recipes, events, consumable templates, quick-log drafts.

POST /api/quick-log accepts bounded message/conversation, draft, catalog and optional event context. Returns structured validated draft and clarification needs or typed errors. Actions: receive/use/waste/count. Never writes stock or executes tools.

Official OpenAI JavaScript SDK, Responses API, structured outputs; server-side OPENAI_API_KEY and OPENAI_MODEL, default gpt-5-mini. store:false, size/output limits and timeout. Send relevant catalog only. Validate model schema and identifiers; perform math in code. Preserve drafts and offer manual entry on missing configuration or API failure. Never silently simulate real AI.

Load browser state after hydration, recover invalid saved data, warn on failed saves. Persist inventory and unfinished drafts, limit conversation to active draft.

Light UI: white, slate, teal actions, amber warnings/red critical; Geist. Desktop sidebar/mobile drawer, readable stock rows and short forms, keyboard access and textual status.

## Verification and defaults

Walk through receiving, planning, competing reservations, partial usage, completion, cancellation, waste, counts, costs, refresh and reset.

Tests: conversions, scaling, expiry, reservations, partial usage/no double deduction, English/Taglish, ambiguity, missing fields, multiple items, used vs remaining, malformed model data/IDs, stale drafts, duplicate saves, timeouts and missing keys. Mock AI transport for automated tests; small live evaluation when credentials are configured. Lint, typecheck, build, mobile/desktop walkthrough.

Defaults: English, PHP, metric, Asia/Manila; fictional caterer, approximately 25 items, six recipes, four suppliers, five events; dates relative to initialization. Local AI demo requires API key/usage budget. Public deployment requires access protection and usage limits. Supabase proposed later; hosting undecided.

Deferred: equipment, offline updates, custom fields, workflow builder, purchase orders, profitability, multi-business onboarding.

## Implementation sequence and progress

1. Shared types, sample records, stock engine and focused tests.
2. Persistent state and accessible shadcn interface with all workflow screens.
3. Real AI draft endpoint and shared quick-log review workflow.
4. Integration/browser checks, review, documentation, and completion audit.

Ruling: use a feature branch in the existing clean checkout to keep the user's workspace directly usable; no separate worktree is needed for this single-agent implementation.

Ruling: follow the accepted in-chat specification directly; saving it does not introduce another approval gate before the explicitly requested implementation.


## Verification record, October 16, 2026

- Implemented all planned screens, shared manual/chat review, local persistence, and the real structured-output endpoint.
- 27 automated tests passed, including stale-tab writes, recipe snapshot preservation, same-day receipt pricing, expired usage, and pack changes.
- Production build, including TypeScript checking, passed. ESLint passed.
- Browser checks covered a two-line delivery of the same item, final stock preview, save, reload persistence, category rename propagation, mobile navigation, and missing-key/manual-entry fallback. Mobile 390 × 844 and desktop 1440 × 1000 layouts were inspected. No captured browser console errors remained.
- Independent review findings were addressed. Stale writes reload the latest inventory and require review again; metadata-only event edits preserve snapshots. Menu edits explicitly refresh recipe quantities.
- Setup instructions and `.env.example` are saved. No credentials were added.

Pending: configure OPENAI_API_KEY locally and run the live English/Taglish evaluation in README.md. Mocked transport tests verify the integration contract, not model interpretation accuracy. A full customer acceptance walkthrough remains appropriate before using real stock records. Browser storage, sample import preview, and local-only access remain deliberate prototype limits.
