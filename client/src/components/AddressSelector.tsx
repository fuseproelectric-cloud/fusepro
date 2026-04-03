import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { customersApi } from "@/lib/api";
import { loadMapsLib } from "@/lib/google-maps";
import { AddressAutocompleteInput, type PlaceResult } from "./AddressAutocompleteInput";
import { MapPin, Plus } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

type CustomerAddress = {
  id: number; customerId: number; label: string;
  address: string | null; city: string | null; state: string | null;
  zip: string | null; isPrimary: boolean; notes: string | null;
};

const addrSchema = z.object({
  label:   z.string().optional(),
  address: z.string().min(1, "Street address is required"),
  city:    z.string().min(1, "City is required"),
  state:   z.string().min(1, "State is required"),
  zip:     z.string().min(1, "ZIP is required"),
});
type AddrForm = z.infer<typeof addrSchema>;

// ── Mini map (renders after autocomplete selects a place) ─────────────────────
function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current) return;
    loadMapsLib().then(() => {
      if (!divRef.current) return;
      const g = (window as any).google.maps;
      const map = new g.Map(divRef.current, {
        center: { lat, lng }, zoom: 15,
        disableDefaultUI: true, gestureHandling: "none", clickableIcons: false,
      });
      new g.Marker({ position: { lat, lng }, map });
    }).catch(console.error);
  }, [lat, lng]);

  return (
    <div
      ref={divRef}
      className="w-full h-36 rounded-md overflow-hidden border border-border"
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  customerId: number | null | undefined;
  value: number | null;
  onChange: (addressId: number | null, address: CustomerAddress | null) => void;
}

export function AddressSelector({ customerId, value, onChange }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [mapPin, setMapPin]   = useState<{ lat: number; lng: number } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const form = useForm<AddrForm>({
    resolver: zodResolver(addrSchema),
    defaultValues: { label: "Service Address", address: "", city: "", state: "", zip: "" },
  });

  const { data: addresses = [], isLoading } = useQuery<CustomerAddress[]>({
    queryKey: ["/api/customers", customerId, "addresses"],
    queryFn: () => customersApi.getAddresses(customerId!),
    enabled: !!customerId,
  });

  // Auto-select when exactly 1 address
  useEffect(() => {
    if (!customerId || isLoading) return;
    if (addresses.length === 1) {
      onChangeRef.current(addresses[0].id, addresses[0]);
    } else if (addresses.length === 0) {
      onChangeRef.current(null, null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, isLoading, addresses.length]);

  const createMutation = useMutation({
    mutationFn: (data: AddrForm) => customersApi.createAddress(customerId!, data),
    onSuccess: (newAddr: CustomerAddress) => {
      qc.invalidateQueries({ queryKey: ["/api/customers", customerId, "addresses"] });
      onChangeRef.current(newAddr.id, newAddr);
      setAddOpen(false);
      setMapPin(null);
      form.reset({ label: "Service Address", address: "", city: "", state: "", zip: "" });
    },
  });

  const [watchedCity,  setWatchedCity]  = useState("");
  const [watchedState, setWatchedState] = useState("");
  const [watchedZip,   setWatchedZip]   = useState("");

  const openAdd = () => {
    form.reset({ label: "Service Address", address: "", city: "", state: "", zip: "" });
    setWatchedCity(""); setWatchedState(""); setWatchedZip("");
    setMapPin(null);
    setAddOpen(true);
  };

  const onSubmit = (d: AddrForm) => {
    const label = d.label || d.address || "Service Address";
    createMutation.mutate({ ...d, label });
  };

  if (!customerId) return null;

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Address</Label>
        <div className="h-9 rounded-md bg-muted animate-pulse" />
      </div>
    );
  }

  const selected   = addresses.find(a => a.id === value);
  const formatAddr = (a: CustomerAddress) =>
    [a.address, a.city, a.state].filter(Boolean).join(", ") || a.label;

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Address</Label>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-0.5 text-[11px] text-blue-500 hover:text-blue-700 font-medium"
          >
            <Icon icon={Plus} size={12} /> Add
          </button>
        </div>

        {addresses.length === 0 && (
          <div
            className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
            onClick={openAdd}
          >
            <Icon icon={MapPin} size={14} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">No addresses — click to add</span>
          </div>
        )}

        {addresses.length === 1 && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
            <Icon icon={MapPin} size={14} className="text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{addresses[0].label}</p>
              {(addresses[0].address || addresses[0].city) && (
                <p className="text-[11px] text-muted-foreground truncate">{formatAddr(addresses[0])}</p>
              )}
            </div>
          </div>
        )}

        {addresses.length > 1 && (
          <div className="relative">
            <Icon icon={MapPin} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={value ?? ""}
              onChange={e => {
                const id   = e.target.value ? Number(e.target.value) : null;
                const addr = addresses.find(a => a.id === id) ?? null;
                onChange(id, addr);
              }}
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
            >
              <option value="">Select address…</option>
              {addresses.map(a => (
                <option key={a.id} value={a.id}>
                  {a.label}{a.address ? ` — ${a.address}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Add Address Dialog */}
      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) { setMapPin(null); } }}>
        <DialogContent
          onPointerDownOutside={(e: Event) => { if ((e.target as HTMLElement)?.closest?.(".pac-container")) e.preventDefault(); }}
          onInteractOutside={(e: Event) => { if ((e.target as HTMLElement)?.closest?.(".pac-container")) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>Add Address</DialogTitle>
          </DialogHeader>
          <form
            id="add-addr-selector-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-3 px-6 pb-2"
          >
            {/* Map preview */}
            {mapPin && <MiniMap lat={mapPin.lat} lng={mapPin.lng} />}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Street Address <span className="text-destructive">*</span></Label>
                <AddressAutocompleteInput
                  {...form.register("address")}
                  onPlaceSelect={(r: PlaceResult) => {
                    form.setValue("label",   r.address || "Service Address");
                    form.setValue("address", r.address);
                    form.setValue("city",    r.city);
                    form.setValue("state",   r.state);
                    form.setValue("zip",     r.zip);
                    setWatchedCity(r.city);
                    setWatchedState(r.state);
                    setWatchedZip(r.zip);
                    if (r.lat !== null && r.lng !== null) setMapPin({ lat: r.lat, lng: r.lng });
                  }}
                  placeholder="123 Main St"
                  className="h-9"
                />
                {form.formState.errors.address && (
                  <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 space-y-1.5">
                  <Label className="text-xs font-semibold">City <span className="text-destructive">*</span></Label>
                  <Input {...form.register("city")} value={watchedCity} onChange={e => { setWatchedCity(e.target.value); form.setValue("city", e.target.value); }} placeholder="Chicago" className="h-9" />
                  {form.formState.errors.city && <p className="text-xs text-destructive">{form.formState.errors.city.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">State <span className="text-destructive">*</span></Label>
                  <Input {...form.register("state")} value={watchedState} onChange={e => { setWatchedState(e.target.value); form.setValue("state", e.target.value); }} placeholder="IL" className="h-9" />
                  {form.formState.errors.state && <p className="text-xs text-destructive">{form.formState.errors.state.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ZIP <span className="text-destructive">*</span></Label>
                  <Input {...form.register("zip")} value={watchedZip} onChange={e => { setWatchedZip(e.target.value); form.setValue("zip", e.target.value); }} placeholder="60601" className="h-9" />
                  {form.formState.errors.zip && <p className="text-xs text-destructive">{form.formState.errors.zip.message}</p>}
                </div>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="h-9">Cancel</Button>
            <Button
              type="submit"
              form="add-addr-selector-form"
              className="h-9 bg-blue-500 hover:bg-blue-700 text-white"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Adding…" : "Add Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
