import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Pencil, Trash2, MoreVertical, Package, AlertTriangle, DollarSign } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { MetricCard, EmptyState, TableSkeleton, SearchInput } from "@/components/page";
import { useInventoryPage } from "./hooks/useInventoryPage";

export function InventoryPageContainer() {
  const { user } = useAuth();
  const isTechnician = user?.role === "technician";
  const p = useInventoryPage();

  return (
    <Stack spacing={3}>
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard label="Total Items" value={p.isLoading ? "—" : p.items.length}                      icon={Package}       color="slate" />
        <MetricCard label="Low Stock"   value={p.isLoading ? "—" : p.lowStockItems.length}              icon={AlertTriangle} color="yellow" />
        <MetricCard
          label="Total Value"
          value={p.isLoading ? "—" : formatCurrency(p.totalValue)}
          icon={DollarSign}
          color="green"
        />
      </div>

      {p.lowStockItems.length > 0 && (
        <div
          className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg cursor-pointer"
          onClick={() => p.setShowLowOnly(!p.showLowOnly)}
        >
          <Icon icon={AlertTriangle} size={20} className="text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-400">
            <strong>{p.lowStockItems.length}</strong> item{p.lowStockItems.length > 1 ? "s" : ""} are low on stock.
            {p.showLowOnly ? " Showing low stock only." : " Click to filter."}
          </p>
          {p.showLowOnly && <Button variant="ghost" size="sm" className="ml-auto text-yellow-400 h-6 text-xs">Show all</Button>}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={p.search}
          onChange={p.setSearch}
          placeholder="Search inventory..."
        />
        {!isTechnician && (
          <Button onClick={p.openCreate} className="bg-blue-500 hover:bg-blue-700 text-white ml-auto">
            <Icon icon={Plus} size={16} className="mr-2" /> Add Item
          </Button>
        )}
      </div>

      {/* Table */}
      <Paper variant="outlined">
        {p.isLoading ? (
          <TableSkeleton count={5} />
        ) : p.filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No inventory items found"
            description="Add items to track your parts and materials."
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Unit Cost</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell padding="none" />
                </TableRow>
              </TableHead>
              <TableBody>
                {p.filtered.map(item => {
                  const isLow = item.minQuantity !== null && item.minQuantity !== undefined && item.quantity <= item.minQuantity;
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{item.name}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary" }}>{item.sku ?? "—"}</TableCell>
                      <TableCell>
                        {item.category ? <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{item.category}</span> : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium", isLow ? "text-yellow-400" : "text-foreground")}>{item.quantity} {item.unit ?? ""}</span>
                          {isLow && <Icon icon={AlertTriangle} size={14} className="text-yellow-400" />}
                        </div>
                        {item.minQuantity !== null && item.minQuantity !== undefined && (
                          <p className="text-xs text-muted-foreground">min: {item.minQuantity}</p>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{formatCurrency(item.unitCost ?? "0")}</TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: "0.75rem" }}>{item.location ?? "—"}</TableCell>
                      <TableCell padding="none">
                        {!isTechnician && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-7 h-7"><Icon icon={MoreVertical} size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => p.openEdit(item)}><Icon icon={Pencil} size={16} className="mr-2" />Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (confirm("Delete item?")) p.deleteMutation.mutate(item.id); }}><Icon icon={Trash2} size={16} className="mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Create / Edit Dialog */}
      <Dialog open={p.dialogOpen} onOpenChange={o => !o && p.closeDialog()} maxWidth="sm" fullWidth>
        <DialogTitle onClose={p.closeDialog}>{p.editItem ? "Edit Item" : "Add Inventory Item"}</DialogTitle>
        <DialogContent>
          <form onSubmit={p.form.handleSubmit(p.onSubmit)} noValidate className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input {...p.form.register("name")} placeholder="20A Circuit Breaker" />
                {p.form.formState.errors.name && <p className="text-xs text-destructive">{p.form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1.5"><Label>SKU</Label><Input {...p.form.register("sku")} placeholder="CB-20A-001" /></div>
              <div className="space-y-1.5"><Label>Category</Label><Input {...p.form.register("category")} placeholder="Breakers, Wire, Tools..." /></div>
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" {...p.form.register("quantity")} /></div>
              <div className="space-y-1.5"><Label>Min Quantity</Label><Input type="number" {...p.form.register("minQuantity")} /></div>
              <div className="space-y-1.5"><Label>Unit Cost ($)</Label><Input type="number" step="0.01" {...p.form.register("unitCost")} /></div>
              <div className="space-y-1.5"><Label>Unit</Label><Input {...p.form.register("unit")} placeholder="each, ft, box..." /></div>
              <div className="space-y-1.5"><Label>Location</Label><Input {...p.form.register("location")} placeholder="Warehouse A, Shelf 3..." /></div>
            </div>
          </form>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={p.closeDialog}>Cancel</Button>
          <Button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white"
            disabled={p.createMutation.isPending || p.updateMutation.isPending}
            onClick={p.form.handleSubmit(p.onSubmit)}
          >
            {p.editItem ? "Update" : "Add Item"}
          </Button>
        </DialogFooter>
      </Dialog>
    </Stack>
  );
}
