import { useState, useRef, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { customersApi } from "@/lib/api";
import type { Customer } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  customers: Customer[];
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  placeholder?: string;
}

export function CustomerCombobox({ customers, value, onChange, placeholder = "Select customer..." }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const selected = customers.find(c => c.id === value);

  const filtered = search.trim()
    ? customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : customers;

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; phone?: string; email?: string }) =>
      customersApi.create(data),
    onSuccess: (created: Customer) => {
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      onChange(created.id);
      setNewOpen(false);
      setNewName(""); setNewPhone(""); setNewEmail("");
    },
  });

  function handleSelect(id: number | null) {
    onChange(id);
    setSearch("");
    setOpen(false);
  }

  function handleOpenDropdown() {
    setOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Trigger */}
        <button
          type="button"
          onClick={handleOpenDropdown}
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "h-9 text-left"
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : placeholder}
          </span>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {selected && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleSelect(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon icon={X} size={14} />
              </button>
            )}
            <Icon icon={ChevronsUpDown} size={14} className="text-muted-foreground" />
          </div>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
            {/* Search input */}
            <div className="p-2 border-b">
              <Input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers..."
                className="h-8 text-sm"
              />
            </div>

            {/* List */}
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No customers found</p>
              ) : (
                filtered.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer text-left",
                      value === c.id && "bg-accent"
                    )}
                    onClick={() => handleSelect(c.id)}
                  >
                    <Icon icon={Check} size={14} className={cn("flex-shrink-0", value === c.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{c.name}</span>
                    {c.phone && <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">{c.phone}</span>}
                  </button>
                ))
              )}
            </div>

            {/* Add new */}
            <div className="border-t p-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                onClick={() => { setOpen(false); setNewName(search); setNewOpen(true); }}
              >
                <Icon icon={Plus} size={14} />
                {search.trim() ? `Add "${search}"` : "Add new customer"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick-add dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="quick-add-name">Name *</Label>
              <Input
                id="quick-add-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Company or person name"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-add-phone">Phone</Label>
              <Input id="quick-add-phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="(555) 000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-add-email">Email</Label>
              <Input id="quick-add-email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!newName.trim()) return;
                createMutation.mutate({
                  name: newName.trim(),
                  phone: newPhone.trim() || undefined,
                  email: newEmail.trim() || undefined,
                });
              }}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
