import { z } from 'zod';
const id = z.string().min(1).max(120);
const text = z.string().max(500);
const nonnegative = z.number().finite().nonnegative();
export const itemSchema = z.object({ id, name: z.string().trim().min(1).max(100), category: z.string().min(1), kind: z.enum(['ingredient', 'consumable']), unit: z.enum(['g', 'mL', 'pcs']), threshold: nonnegative, requiresExpiry: z.boolean(), packs: z.array(z.object({ name: z.string().min(1), quantity: z.number().positive() })), archived: z.boolean() });
const supplySchema = z.object({ itemId: id, quantity: nonnegative, perGuest: z.boolean() });
export const recipeSchema = z.object({ id, name: z.string().trim().min(1), servings: z.number().positive(), ingredients: z.array(z.object({ itemId: id, quantity: z.number().positive(), unit: z.string().min(1) })).min(1) });
export const eventSchema = z.object({ id, name: z.string().trim().min(1), date: z.iso.date(), prepDate: z.iso.date(), guests: z.number().int().positive(), status: z.enum(['Draft', 'Confirmed', 'Completed', 'Canceled']), dishes: z.array(z.object({ recipeId: id, servings: z.number().nonnegative() })), supplies: z.array(supplySchema), confirmedAt: z.string().optional(), snapshot: z.record(z.string(), nonnegative).optional(), estimatedCost: nonnegative.optional() }).refine(e => e.prepDate <= e.date, { message: 'Preparation must be on or before the event date.', path: ['prepDate'] });
export const stateSchema = z.object({
  version: z.literal(1), revision: z.number().int().nonnegative(),
  settings: z.object({ name: z.string().trim().min(1), logo: z.union([z.literal(''), z.url({ protocol: /^https?$/ }).max(500)]), categories: z.array(z.string().min(1)), expiryDays: z.number().int().min(1).max(90) }),
  items: z.array(itemSchema), suppliers: z.array(z.object({ id, name: z.string().min(1) })),
  batches: z.array(z.object({ id, itemId: id, received: z.iso.date(), expiry: z.union([z.iso.date(), z.literal('')]), quantity: nonnegative, cost: nonnegative, supplierId: id })),
  movements: z.array(z.object({ id, entryId: id, itemId: id, batchId: id, action: z.enum(['receive', 'use', 'waste', 'count', 'correction']), quantity: z.number().finite(), cost: z.number().finite(), date: z.iso.date(), reason: text, eventId: id.optional(), corrects: id.optional() })),
  recipes: z.array(recipeSchema), events: z.array(eventSchema), templates: z.array(z.object({ id, name: z.string().min(1), supplies: z.array(supplySchema) })),
});
