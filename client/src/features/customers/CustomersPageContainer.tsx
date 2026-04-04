import { useAutoCreate } from "@/hooks/useAutoCreate";
import { useLocation } from "wouter";
import { cn, formatDate } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, MoreVertical, Users, Building2,
  Phone, Mail, ExternalLink, Briefcase, UserPlus, TrendingUp, ArrowUpDown, SlidersHorizontal,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { TextInput, TextareaInput, FormSection, FormRow, FormActions } from "@/components/forms";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard, EmptyState, TableSkeleton, SearchInput, TableFooter } from "@/components/page";
import { useCustomersData } from "./hooks/useCustomersData";
import { useCustomersMutations } from "./hooks/useCustomersMutations";

// ── Local UI helpers ──────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
function avatarColor(name: string) {
  const palette = [
    "bg-blue-100 text-blue-700", "bg-blue-100 text-blue-600",
    "bg-emerald-100 text-emerald-600", "bg-purple-100 text-purple-600",
    "bg-rose-100 text-rose-600", "bg-amber-100 text-amber-600",
    "bg-cyan-100 text-cyan-600",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

// ── Container ─────────────────────────────────────────────────────────────────

export function CustomersPageContainer() {
  const data = useCustomersData();
  const m    = useCustomersMutations();
  useAutoCreate(m.openCreate);
  const [, navigate] = useLocation();

  const { newThisMonth, withJobs, activeCount } = data.metrics;
  const isFiltered = !!(data.search || data.tagFilter !== "all");

  return (
    <Stack spacing={3}>
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Clients"    value={data.customers.length} icon={Users}      color="blue" />
        <MetricCard label="New This Month"   value={newThisMonth}          icon={UserPlus}   sub={`of ${data.customers.length} total`} />
        <MetricCard label="Currently Active" value={activeCount}           icon={TrendingUp} sub="scheduled or in progress" />
        <MetricCard label="Have Jobs"        value={withJobs}              icon={Briefcase}  sub="at least one job" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <SearchInput
          value={data.search}
          onChange={data.setSearch}
          placeholder="Search clients..."
        />
        <Select value={data.tagFilter} onValueChange={data.setTagFilter}>
          <SelectTrigger className="h-8 w-36 text-sm bg-card">
            <Icon icon={SlidersHorizontal} size={14} className="mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {data.allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={data.sortBy} onValueChange={v => data.setSortBy(v as any)}>
          <SelectTrigger className="h-8 w-36 text-sm bg-card">
            <Icon icon={ArrowUpDown} size={14} className="mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="createdAt">Recently Added</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={m.openCreate} className="ml-auto h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm px-3">
          <Icon icon={Plus} size={14} className="mr-1.5" /> New Client
        </Button>
      </div>

      {/* Table */}
      <Paper variant="outlined">
        {data.isLoading ? (
          <TableSkeleton count={6} />
        ) : data.filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={isFiltered ? "No clients match your filters" : "No clients yet"}
            description={isFiltered ? "Try a different search term or clear the filters." : "Add your first client to get started."}
            action={!isFiltered && (
              <Button onClick={m.openCreate} className="mt-4 h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm">
                <Icon icon={Plus} size={14} className="mr-1.5" /> New Client
              </Button>
            )}
          />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell align="center">Jobs</TableCell>
                    <TableCell>Added</TableCell>
                    <TableCell padding="none" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.filtered.map(c => {
                    const jobs      = data.getJobs(c.id);
                    const tags      = c.tags ?? [] as string[];
                    const activeJob = jobs.find(j => ["scheduled","in_progress"].includes(j.status));
                    return (
                      <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/customers/${c.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0", avatarColor(c.name))}>
                              {getInitials(c.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground truncate">{c.name}</span>
                                {activeJob && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">Active</span>}
                              </div>
                              {c.company && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                  <Icon icon={Building2} size={12} className="flex-shrink-0" />{c.company}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Icon icon={Phone} size={12} className="text-muted-foreground/60 flex-shrink-0" />{c.phone}</p>}
                            {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate max-w-[180px]"><Icon icon={Mail} size={12} className="text-muted-foreground/60 flex-shrink-0" />{c.email}</p>}
                          </div>
                        </TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">—</span></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag: string) => (
                              <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">{tag}</span>
                            ))}
                            {tags.length > 3 && <span className="text-[10px] text-muted-foreground/60">+{tags.length - 3}</span>}
                          </div>
                        </TableCell>
                        <TableCell align="center">
                          <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold", jobs.length > 0 ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground")}>
                            {jobs.length}
                          </span>
                        </TableCell>
                        <TableCell><span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.createdAt)}</span></TableCell>
                        <TableCell padding="none" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-7 h-7"><Icon icon={MoreVertical} size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => navigate(`/customers/${c.id}`)}><Icon icon={ExternalLink} size={16} className="mr-2" />View Profile</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => m.openEdit(c)}><Icon icon={Pencil} size={16} className="mr-2" />Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (confirm(`Delete ${c.name}?`)) m.deleteMutation.mutate(c.id); }}><Icon icon={Trash2} size={16} className="mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TableFooter filtered={data.filtered.length} total={data.customers.length} label="clients" />
          </>
        )}
      </Paper>

      {/* Create / Edit Dialog */}
      <Dialog open={m.dialogOpen} onOpenChange={o => !o && m.closeDialog()}>
        <DialogTitle onClose={m.closeDialog}>{m.editCustomer ? "Edit Client" : "New Client"}</DialogTitle>
        <DialogContent>
          <form onSubmit={m.form.handleSubmit(m.onSubmit)} noValidate className="space-y-4">
            <FormSection title="Client Name">
              <FormRow cols={2}>
                <TextInput label="Full Name" required placeholder="John Smith"       error={m.form.formState.errors.name}  {...m.form.register("name")} />
                <TextInput label="Company"              placeholder="Business name"                                          {...m.form.register("company")} />
              </FormRow>
            </FormSection>
            <FormSection title="Contact Info">
              <FormRow cols={2}>
                <TextInput label="Phone" placeholder="(555) 555-5555"                                                        {...m.form.register("phone")} />
                <TextInput label="Email" type="email" placeholder="john@example.com" error={m.form.formState.errors.email}  {...m.form.register("email")} />
              </FormRow>
            </FormSection>
            <FormSection title="Additional Info">
              <FormRow cols={2}>
                <TextInput label="Lead Source" placeholder="Referral, Google, Yelp"                                          {...m.form.register("leadSource")} />
                <TextInput label="Tags"        placeholder="residential, vip"        hint="Comma-separated"                  {...m.form.register("tags")} />
              </FormRow>
            </FormSection>
            <FormSection title="Notes">
              <TextareaInput label="" rows={3} placeholder="Add any notes about this client for your team..." {...m.form.register("notes")} />
            </FormSection>
            <FormActions
              submitLabel={m.editCustomer ? "Save Changes" : "Create Client"}
              loading={m.createMutation.isPending || m.updateMutation.isPending}
              onCancel={m.closeDialog}
            />
          </form>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
