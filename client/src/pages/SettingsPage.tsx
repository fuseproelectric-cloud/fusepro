import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsApi, usersApi, authApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Pencil, Trash2, Plus, Shield, User, Building2, Key, Tag } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TextInput, SelectInput, FormActions } from "@/components/forms";
import { AddressAutocompleteTextInput } from "@/components/AddressAutocompleteInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const userSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Valid email required"),
  role: z.string(),
  password: z.string().optional(),
});

type PasswordForm = z.infer<typeof passwordSchema>;
type UserForm = z.infer<typeof userSchema>;

interface AppUser {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    queryFn: usersApi.getAll,
    enabled: user?.role === "admin",
  });

  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: settingsApi.getAll,
  });

  // Password change
  const {
    register: pwReg,
    handleSubmit: pwSubmit,
    reset: pwReset,
    formState: { errors: pwErrors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const changePwMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordForm) =>
      authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      pwReset();
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (err) => toast({ title: "Could not change password", description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" }),
  });

  // User management
  const {
    register: userReg,
    handleSubmit: userSubmit,
    reset: userReset,
    setValue: userSetValue,
    watch: userWatch,
    formState: { errors: userErrors },
  } = useForm<UserForm>({ resolver: zodResolver(userSchema), defaultValues: { role: "technician" } });

  const createUserMutation = useMutation({
    mutationFn: (data: UserForm) => usersApi.create({ ...data, password: data.password || "TempPass123!" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); closeUserDialog(); },
    onError: (err) => toast({ title: "Failed to create user", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserForm> }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); closeUserDialog(); },
    onError: (err) => toast({ title: "Failed to update user", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/users"] }),
    onError: (err) => toast({ title: "Failed to delete user", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  function openCreateUser() {
    setEditUser(null);
    userReset({ role: "technician" });
    setUserDialogOpen(true);
  }

  function openEditUser(u: AppUser) {
    setEditUser(u);
    userReset({ name: u.name, email: u.email, role: u.role });
    setUserDialogOpen(true);
  }

  function closeUserDialog() {
    setUserDialogOpen(false);
    setEditUser(null);
    userReset();
  }

  const onUserSubmit = (data: UserForm) => {
    if (editUser) {
      updateUserMutation.mutate({ id: editUser.id, data });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const [companySaved, setCompanySaved] = useState(false);

  const saveSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => settingsApi.update(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/settings"] }),
    onError: (err) => toast({ title: "Failed to save setting", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  const companyFields = [
    { key: "company_name", label: "Company Name", placeholder: "FusePro Cloud" },
    { key: "company_phone", label: "Phone", placeholder: "+1 (555) 000-0000" },
    { key: "company_email", label: "Email", placeholder: "info@fusepro.cloud" },
    { key: "company_website", label: "Website", placeholder: "https://fusepro.cloud" },
    { key: "company_address", label: "Street Address", placeholder: "123 Main St" },
    { key: "company_city", label: "City", placeholder: "New York" },
    { key: "company_state", label: "State", placeholder: "NY" },
    { key: "company_zip", label: "ZIP Code", placeholder: "10001" },
  ];

  const [companyDraft, setCompanyDraft] = useState<Record<string, string>>({});
  const companyValues = { ...settings, ...companyDraft };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCompanyDraft((prev) => ({ ...prev, company_logo: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const saveCompany = async () => {
    const allKeys = [...companyFields.map((f) => f.key), "company_logo"];
    try {
      await Promise.all(
        allKeys.map((key) =>
          companyValues[key] !== undefined
            ? saveSettingMutation.mutateAsync({ key, value: companyValues[key] ?? "" })
            : Promise.resolve()
        )
      );
      setCompanyDraft({});
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 3000);
    } catch {
      // Individual save errors are already surfaced via saveSettingMutation.onError toast
    }
  };

  const roleColors: Record<string, string> = {
    admin: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    dispatcher: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    technician: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile"><Icon icon={User} size={16} className="mr-2" />Profile</TabsTrigger>
          <TabsTrigger value="security"><Icon icon={Key} size={16} className="mr-2" />Security</TabsTrigger>
          {user?.role === "admin" && (
            <TabsTrigger value="company"><Icon icon={Building2} size={16} className="mr-2" />Company</TabsTrigger>
          )}
          {user?.role === "admin" && (
            <TabsTrigger value="users"><Icon icon={Shield} size={16} className="mr-2" />Users</TabsTrigger>
          )}
          {user?.role === "admin" && (
            <TabsTrigger value="services"><Icon icon={Tag} size={16} className="mr-2" />Services</TabsTrigger>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Your Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center text-xl font-bold text-orange-400">
                  {(user?.name ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Badge variant="outline" className={`text-xs border mt-1 capitalize ${roleColors[user?.role ?? ""] ?? ""}`}>
                    {user?.role}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              {passwordSuccess && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
                  Password changed successfully!
                </div>
              )}
              <form onSubmit={pwSubmit((d) => changePwMutation.mutate(d))} noValidate className="space-y-3 max-w-sm">
                <TextInput label="Current Password" type="password" required error={pwErrors.currentPassword} {...pwReg("currentPassword")} />
                <TextInput label="New Password"     type="password" required error={pwErrors.newPassword}     hint="At least 8 characters" {...pwReg("newPassword")} />
                <TextInput label="Confirm Password" type="password" required error={pwErrors.confirmPassword} {...pwReg("confirmPassword")} />
                <FormActions submitLabel="Update Password" loadingLabel="Updating…" loading={changePwMutation.isPending} align="start" />
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Tab (admin only) */}
        {user?.role === "admin" && (
          <TabsContent value="company">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon icon={Building2} size={16} />
                  Company Information
                </CardTitle>
                <p className="text-xs text-muted-foreground">This information appears on invoices and estimates.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {companySaved && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
                    Company info saved successfully!
                  </div>
                )}
                {/* Logo upload */}
                <div className="space-y-2">
                  <Label>Company Logo</Label>
                  <div className="flex items-center gap-4">
                    {companyValues.company_logo ? (
                      <div className="relative group">
                        <img
                          src={companyValues.company_logo}
                          alt="Logo"
                          className="h-16 max-w-[200px] object-contain rounded border border-border bg-muted/30 p-1"
                        />
                        <button
                          type="button"
                          onClick={() => setCompanyDraft((prev) => ({ ...prev, company_logo: "" }))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="h-16 w-32 rounded border-2 border-dashed border-border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">
                        No logo
                      </div>
                    )}
                    <div>
                      <Label
                        htmlFor="logo-upload"
                        className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted/50 transition-colors"
                      >
                        Upload Logo
                      </Label>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="sr-only"
                        onChange={handleLogoUpload}
                      />
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG — max 2 MB</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {companyFields.map(({ key, label, placeholder }) => {
                    if (key === "company_address") {
                      return (
                        <AddressAutocompleteTextInput
                          key={key}
                          label={label}
                          placeholder={placeholder}
                          value={companyValues[key] ?? ""}
                          onChange={(e) => setCompanyDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                          onPlaceSelect={(r) => {
                            setCompanyDraft((prev) => ({
                              ...prev,
                              company_address: r.address,
                              company_city:    r.city,
                              company_state:   r.state,
                              company_zip:     r.zip,
                            }));
                          }}
                        />
                      );
                    }
                    return (
                      <TextInput
                        key={key}
                        label={label}
                        value={companyValues[key] ?? ""}
                        onChange={(e) => setCompanyDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={saveCompany}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={saveSettingMutation.isPending}
                  >
                    Save Company Info
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Users Tab (admin only) */}
        {user?.role === "admin" && (
          <TabsContent value="users">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">User Management</CardTitle>
                  <Button size="sm" onClick={openCreateUser} className="bg-orange-500 hover:bg-orange-600 text-white">
                    <Icon icon={Plus} size={16} className="mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/20"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                            {u.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs border capitalize ${roleColors[u.role] ?? ""}`}>
                            {u.role}
                          </Badge>
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEditUser(u)}>
                            <Icon icon={Pencil} size={14} />
                          </Button>
                          {u.id !== user.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-destructive hover:text-destructive"
                              onClick={() => { if (confirm(`Delete user ${u.name}?`)) deleteUserMutation.mutate(u.id); }}
                            >
                              <Icon icon={Trash2} size={14} />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
        {user?.role === "admin" && (
          <TabsContent value="services">
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Products & Services</CardTitle>
                <Button
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => navigate("/services")}
                >
                  <Icon icon={Tag} size={16} className="mr-2" />
                  Manage Services
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage your service catalog. Services can be used as line items when creating estimates and invoices.
                </p>
                <div className="mt-4">
                  <Button variant="outline" onClick={() => navigate("/services")}>
                    Go to Services Catalog
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* User Create/Edit Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={(o) => !o && closeUserDialog()}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>{editUser ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={userSubmit(onUserSubmit)} className="space-y-4 px-6 pb-2">
            <TextInput
              label="Full Name" required
              error={userErrors.name}
              {...userReg("name")}
            />
            <TextInput
              label="Email" type="email" required
              error={userErrors.email}
              {...userReg("email")}
            />
            <SelectInput
              label="Role"
              options={[
                { value: "admin",       label: "Admin" },
                { value: "dispatcher",  label: "Dispatcher" },
                { value: "technician",  label: "Technician" },
              ]}
              value={userWatch("role")}
              onValueChange={(v) => userSetValue("role", v)}
            />
            {!editUser && (
              <TextInput
                label="Password" type="password"
                hint="Leave blank to use the system default"
                {...userReg("password")}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeUserDialog}>Cancel</Button>
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={createUserMutation.isPending || updateUserMutation.isPending}
              >
                {editUser ? "Update" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
