import { Plus, X, GripVertical } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { LineItem } from "@shared/schema";

interface Props {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  taxRate: number;
}

function newItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, total: 0 };
}

export function LineItemsEditor({ items, onChange, taxRate }: Props) {
  const update = (index: number, field: keyof LineItem, value: string | number) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      next[index].total = Number(next[index].quantity) * Number(next[index].unitPrice);
    }
    onChange(next);
  };

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add    = () => onChange([...items, newItem()]);

  const subtotal = items.reduce((s, li) => s + (Number(li.total) || 0), 0);
  const tax      = subtotal * (taxRate / 100);
  const total    = subtotal + tax;

  return (
    <div className="space-y-0">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_56px_96px_80px_28px] gap-0 bg-muted/60 border border-border rounded-t-lg px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Qty</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Unit Price</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Total</span>
        <span />
      </div>

      {/* Rows */}
      <div className="border-x border-border divide-y divide-border/60">
        {items.map((item, i) => (
          <div key={item.id} className="grid grid-cols-[1fr_56px_96px_80px_28px] gap-0 items-center px-2 py-1.5 bg-card hover:bg-muted/20 transition-colors group">
            <Input
              value={item.description}
              onChange={e => update(i, "description", e.target.value)}
              placeholder="Describe the product or service…"
              className="h-8 text-sm border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-blue-400 rounded"
            />
            <Input
              type="number"
              min="0"
              value={item.quantity}
              onChange={e => update(i, "quantity", Number(e.target.value))}
              className="h-8 text-sm text-center border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-blue-400 rounded"
            />
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={item.unitPrice}
                onChange={e => update(i, "unitPrice", Number(e.target.value))}
                className="h-8 text-sm text-right border-0 bg-transparent pl-5 pr-1 focus-visible:ring-1 focus-visible:ring-blue-400 rounded"
              />
            </div>
            <span className="text-sm font-semibold text-foreground text-right pr-1 tabular-nums">
              {formatCurrency(item.total)}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Icon icon={X} size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer: Add + Totals */}
      <div className="border border-t-0 border-border rounded-b-lg bg-muted/30 px-3 py-2 flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-700 transition-colors py-1"
        >
          <Icon icon={Plus} size={14} />
          Add Line Item
        </button>

        <div className="space-y-1 min-w-[160px]">
          <div className="flex items-center justify-between text-xs text-muted-foreground gap-8">
            <span>Subtotal</span>
            <span className="tabular-nums font-medium">{formatCurrency(subtotal)}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground gap-8">
              <span>Tax ({taxRate}%)</span>
              <span className="tabular-nums font-medium">{formatCurrency(tax)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm font-bold text-foreground gap-8 pt-1 border-t border-border">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
