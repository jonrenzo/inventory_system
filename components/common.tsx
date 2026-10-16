'use client';
import { Dialog } from 'radix-ui';
import { X, Search, ArrowUpDown, Inbox } from 'lucide-react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function Modal({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className={`modal-content ${wide ? 'wide' : ''}`} aria-describedby={description ? undefined : undefined}><header className="modal-header"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description || 'Review the details below before saving.'}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close dialog"><X size={19}/></Button></Dialog.Close></header>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Status({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'teal' }) { return <span className={`status ${tone}`}><span className="status-dot"/>{children}</span>; }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="empty"><Inbox size={28}/><h3>{title}</h3>{children}</div>; }
export function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) { return <div className="search-box"><Search size={17}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/></div>; }
export function DataTable<T>({ data, columns }: { data: T[]; columns: ColumnDef<T>[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  // TanStack v8 owns its memoization; this component is not compiled with React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  return <div className="table-scroll"><table><thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(header => <th key={header.id}>{header.column.getCanSort() ? <button onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<ArrowUpDown size={12}/></button> : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table>{data.length === 0 && <Empty title="No matching records"><p>Try a different search or add your first record.</p></Empty>}</div>;
}
export function ErrorMessage({ message }: { message: string }) { return message ? <div className="error-message" role="alert">{message}</div> : null; }
export const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
