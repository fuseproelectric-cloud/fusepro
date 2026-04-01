/**
 * JobFormFields — canonical reusable form UI for all job create/edit contexts.
 *
 * Renders all job fields using the shared form component library.
 * Consumer passes UseFormReturn from react-hook-form bound to JobFormValues.
 *
 * Props control which sections are visible and whether certain fields are locked.
 */
import type { UseFormReturn } from "react-hook-form";
import type { JobFormValues } from "./jobForm";
import { JOB_PRIORITY_OPTIONS, JOB_STATUS_OPTIONS } from "./jobForm";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { AddressSelector } from "@/components/AddressSelector";
import { AddressAutocompleteTextInput } from "@/components/AddressAutocompleteInput";
import {
  FormSection, FormRow, FormField,
  TextInput, TextareaInput, DateInput, SelectInput,
  type SelectOption,
} from "@/components/forms";
import { Building2, Lock, MapPin } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import type { Customer, Technician } from "@shared/schema";

type TechWithUser = Technician & { user?: { id: number; name: string } };

interface LockedAddress {
  label?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

interface JobFormFieldsProps {
  form: UseFormReturn<JobFormValues>;
  customers: Customer[];
  technicians: TechWithUser[];
  /** When set, customer selector is replaced with a locked display badge */
  lockedCustomerName?: string;
  /** When set, address fields are replaced with a locked display badge */
  lockedAddress?: LockedAddress;
  /** When set, technician select shows a read-only display instead of a dropdown */
  lockedTechnicianName?: string;
  /** Show status field (edit mode only; in create mode status is auto-derived) */
  showStatus?: boolean;
  /** Address selector ID for a pre-selected address (edit mode) */
  selectedAddressId?: number | null;
  onAddressIdChange?: (id: number | null, addr: LockedAddress | null) => void;
}

const PRIORITY_OPTIONS: SelectOption[] = JOB_PRIORITY_OPTIONS.map(o => ({ value: o.value, label: o.label }));
const STATUS_OPTIONS:   SelectOption[] = JOB_STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }));

export function JobFormFields({
  form,
  customers,
  technicians,
  lockedCustomerName,
  lockedAddress,
  lockedTechnicianName,
  showStatus = false,
  selectedAddressId = null,
  onAddressIdChange,
}: JobFormFieldsProps) {
  const { register, setValue, watch, formState: { errors } } = form;

  const customerId   = watch("customerId");
  const technicianId = watch("technicianId");

  const techOptions: SelectOption[] = [
    { value: "none", label: "Unassigned" },
    ...technicians.map(t => ({ value: String(t.id), label: t.user?.name ?? `Tech #${t.id}` })),
  ];

  return (
    <>
      {/* ── Job Details ── */}
      <FormSection title="Job Details">
        <TextInput
          label="Title"
          required
          placeholder="Panel upgrade, AC inspection, rewiring…"
          error={errors.title}
          {...register("title")}
        />
        <TextareaInput
          label="Description"
          rows={3}
          placeholder="Describe the work to be done…"
          {...register("description")}
        />
      </FormSection>

      {/* ── Client & Address ── */}
      <FormSection title="Client">
        {lockedCustomerName ? (
          <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Icon icon={Building2} size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground">{lockedCustomerName}</span>
              <Icon icon={Lock} size={12} className="text-muted-foreground ml-auto" />
            </div>
            {lockedAddress && (lockedAddress.address || lockedAddress.city) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Icon icon={MapPin} size={14} className="flex-shrink-0" />
                <span>
                  {lockedAddress.label && `${lockedAddress.label} · `}
                  {[lockedAddress.address, lockedAddress.city, lockedAddress.state, lockedAddress.zip]
                    .filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            <CustomerCombobox
              customers={customers}
              value={customerId ?? null}
              onChange={id => {
                setValue("customerId", id);
                onAddressIdChange?.(null, null);
              }}
            />
            {customerId && (
              <AddressSelector
                customerId={customerId}
                value={selectedAddressId}
                onChange={(id, addr) => {
                  onAddressIdChange?.(id, addr ? { address: addr.address, city: addr.city, state: addr.state, zip: addr.zip } : null);
                  if (addr) {
                    setValue("address", addr.address ?? "");
                    setValue("city",    addr.city    ?? "");
                    setValue("state",   addr.state   ?? "");
                    setValue("zip",     addr.zip     ?? "");
                  }
                }}
              />
            )}
          </>
        )}
      </FormSection>

      {/* ── Service Address (manual entry / autocomplete) — hidden when address is locked ── */}
      {!lockedAddress && (
        <FormSection title="Service Address">
          <AddressAutocompleteTextInput
            label="Street Address"
            placeholder="123 Main St"
            {...register("address")}
            onPlaceSelect={r => {
              setValue("address", r.address);
              setValue("city",    r.city);
              setValue("state",   r.state);
              setValue("zip",     r.zip);
            }}
          />
          <FormRow cols={3}>
            <TextInput label="City"  placeholder="Chicago" error={errors.city}  {...register("city")}  />
            <TextInput label="State" placeholder="IL"      error={errors.state} {...register("state")} />
            <TextInput label="ZIP"   placeholder="60601"   error={errors.zip}   {...register("zip")}   />
          </FormRow>
        </FormSection>
      )}

      {/* ── Assign To ── */}
      <FormSection title="Assign To">
        {lockedTechnicianName ? (
          <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed">
            {lockedTechnicianName}
          </div>
        ) : (
          <SelectInput
            label="Technician"
            options={techOptions}
            value={technicianId ? String(technicianId) : "none"}
            onValueChange={v => setValue("technicianId", v === "none" ? null : Number(v))}
          />
        )}
      </FormSection>

      {/* ── Schedule ── */}
      <FormSection title="Schedule">
        <FormRow cols={3}>
          <DateInput label="Date"  variant="date" {...register("dateStr")}    />
          <DateInput label="Start" variant="time" {...register("timeStr")}    />
          <DateInput label="End"   variant="time" {...register("endTimeStr")} />
        </FormRow>
      </FormSection>

      {/* ── Status & Priority ── */}
      <FormSection title={showStatus ? "Status & Priority" : "Priority"}>
        {showStatus && (
          <SelectInput
            label="Status"
            options={STATUS_OPTIONS}
            value={watch("status")}
            onValueChange={v => setValue("status", v)}
          />
        )}
        <SelectInput
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={watch("priority")}
          onValueChange={v => setValue("priority", v)}
        />
      </FormSection>

      {/* ── Field Instructions ── */}
      <FormSection title="Field Instructions">
        <TextareaInput
          label=""
          rows={3}
          placeholder="Access codes, special requirements, what to bring…"
          className="bg-amber-50 border-amber-200 placeholder:text-amber-400 focus-visible:ring-amber-400"
          hint="Visible to the assigned field technician"
          {...register("instructions")}
        />
      </FormSection>

      {/* ── Internal Notes ── */}
      <FormSection title="Internal Notes">
        <TextareaInput
          label=""
          rows={2}
          placeholder="Internal notes (not visible to technician)…"
          {...register("notes")}
        />
      </FormSection>
    </>
  );
}
