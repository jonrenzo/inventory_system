'use client';
import { useState } from 'react';
import { Plus, ChefHat, Pencil, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { useInventory } from './store';
import { ErrorMessage, Field, Modal, SearchBox } from './common';
import { convert, displayQty, latestCost, money, uid, units } from '@/lib/inventory';
import { recipeSchema } from '@/lib/schemas';
import type { Recipe } from '@/lib/types';

export function RecipesScreen() {
  const { state } = useInventory(); const [query, setQuery] = useState(''); const [edit, setEdit] = useState<Recipe | 'new'>();
  return <><div className="page-heading"><div><p className="eyebrow">Consistency starts here</p><h1>Recipes</h1><p>Your kitchen’s know-how, measured and ready to scale.</p></div><Button onClick={() => setEdit('new')}><Plus size={16}/>Add recipe</Button></div><div className="standalone-search"><SearchBox value={query} onChange={setQuery} placeholder="Search recipes…"/></div><div className="recipe-grid">{state.recipes.filter(r => r.name.toLowerCase().includes(query.toLowerCase())).map(recipe => {
    const cost = recipe.ingredients.reduce((sum, line) => { const item = state.items.find(i => i.id === line.itemId)!; return sum + convert(item, line.quantity, line.unit) * latestCost(state, item.id); }, 0);
    return <article className="panel recipe-card" key={recipe.id}><div className="recipe-top"><div className="recipe-symbol"><ChefHat size={25}/></div><Button variant="ghost" size="icon" aria-label={`Edit ${recipe.name}`} onClick={() => setEdit(recipe)}><Pencil size={16}/></Button></div><h2>{recipe.name}</h2><p className="muted">Makes {recipe.servings} servings · {recipe.ingredients.length} ingredients</p><div className="recipe-ingredients">{recipe.ingredients.slice(0, 4).map((line, i) => { const item = state.items.find(it => it.id === line.itemId)!; return <div key={i}><span>{item.name}</span><strong>{displayQty(item, convert(item, line.quantity, line.unit))}</strong></div>; })}</div><footer><div><small>Estimated per serving</small><strong>{money(cost / recipe.servings)}</strong></div><span>{money(cost)} / batch</span></footer></article>;
  })}</div>{edit && <RecipeEditor recipe={edit === 'new' ? undefined : edit} onClose={() => setEdit(undefined)}/>}</>;
}
function RecipeEditor({ recipe, onClose }: { recipe?: Recipe; onClose: () => void }) {
  const { state, update } = useInventory(); const [error, setError] = useState('');
  const form = useForm<Recipe>({ resolver: zodResolver(recipeSchema), defaultValues: recipe || { id: uid(), name: '', servings: 10, ingredients: [{ itemId: '', quantity: 1, unit: 'kg' }] } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'ingredients' }); const ingredients = useWatch({ control: form.control, name: 'ingredients' });
  return <Modal wide title={recipe ? 'Edit recipe' : 'New recipe'} description="Define one batch. Events scale these quantities to the servings you need." onClose={onClose}><form className="form-body" onSubmit={form.handleSubmit(value => { try {
    value.ingredients.forEach(line => { const item = state.items.find(i => i.id === line.itemId); if (!item) throw new Error('Select an ingredient.'); convert(item, line.quantity, line.unit); });
    update({ ...state, revision: state.revision + 1, recipes: recipe ? state.recipes.map(r => r.id === recipe.id ? value : r) : [...state.recipes, value] }); onClose();
  } catch (e) { setError((e as Error).message); } }, () => setError('Add a recipe name, positive yield, and valid ingredients.'))}><ErrorMessage message={error}/><div className="form-grid"><Field label="Recipe name"><input required {...form.register('name')}/></Field><Field label="Batch yield · servings"><input type="number" required min="1" {...form.register('servings', { valueAsNumber: true })}/></Field></div>{fields.map((field, index) => { const item = state.items.find(i => i.id === ingredients[index]?.itemId); return <div className="recipe-line" key={field.id}><Field label="Ingredient"><select required {...form.register(`ingredients.${index}.itemId`)} onChange={e => { form.setValue(`ingredients.${index}.itemId`, e.target.value); form.setValue(`ingredients.${index}.unit`, state.items.find(i => i.id === e.target.value)?.unit || 'g'); }}><option value="">Choose ingredient</option>{state.items.filter(i => i.kind === 'ingredient' && (!i.archived || i.id === item?.id)).map(i => <option key={i.id} value={i.id}>{i.name}{i.archived ? ' · archived' : ''}</option>)}</select></Field><Field label="Quantity"><input type="number" min="0.001" step="any" required {...form.register(`ingredients.${index}.quantity`, { valueAsNumber: true })}/></Field><Field label="Unit"><select {...form.register(`ingredients.${index}.unit`)}>{(item ? units(item) : ['kg']).map(u => <option key={u}>{u}</option>)}</select></Field><Button type="button" variant="ghost" size="icon" disabled={fields.length === 1} aria-label={`Remove ingredient ${index + 1}`} onClick={() => remove(index)}><Trash2 size={15}/></Button></div>; })}<Button type="button" variant="outline" onClick={() => append({ itemId: '', quantity: 1, unit: 'g' })}><Plus size={16}/>Add ingredient</Button><p className="muted">Confirmed events keep their existing ingredient plan until you explicitly refresh it.</p><div className="form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save recipe</Button></div></form></Modal>;
}
