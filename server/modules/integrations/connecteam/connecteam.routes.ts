import { Router } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../../../storage";
import { requireRole } from "../../../core/middleware/auth.middleware";
import { connecteamToken } from "./connecteam.client";

export const connecteamRouter = Router();

// ─── Connecteam Integration ───────────────────────────────────────────────────

// GET status + settings (credentials masked)
connecteamRouter.get("/api/integrations/connecteam", requireRole("admin"), async (_req, res) => {
  try {
    const settings = await storage.getAllSettings();
    const map: Record<string, string> = {};
    settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
    const clientId     = map["connecteam_client_id"]     || "";
    const clientSecret = map["connecteam_client_secret"] || "";
    const lastSync     = map["connecteam_last_sync"]     || null;
    const enabled      = map["connecteam_enabled"]       === "true";
    res.json({
      clientId,
      clientSecretMasked: clientSecret ? "●".repeat(8) + clientSecret.slice(-4) : "",
      hasCredentials: !!(clientId && clientSecret),
      enabled,
      lastSync,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load Connecteam settings" });
  }
});

// PUT save credentials
connecteamRouter.put("/api/integrations/connecteam", requireRole("admin"), async (req, res) => {
  try {
    const { clientId, clientSecret, enabled } = req.body;
    if (clientId   !== undefined) await storage.upsertSetting("connecteam_client_id",     clientId);
    if (clientSecret !== undefined) await storage.upsertSetting("connecteam_client_secret", clientSecret);
    if (enabled    !== undefined) await storage.upsertSetting("connecteam_enabled",        String(enabled));
    res.json({ message: "Settings saved" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save Connecteam settings" });
  }
});

// POST test connection
connecteamRouter.post("/api/integrations/connecteam/test", requireRole("admin"), async (req, res) => {
  try {
    const settings = await storage.getAllSettings();
    const map: Record<string, string> = {};
    settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
    const clientId     = map["connecteam_client_id"]     || "";
    const clientSecret = map["connecteam_client_secret"] || "";
    if (!clientId || !clientSecret) return res.status(400).json({ message: "Credentials not configured" });
    const token = await connecteamToken(clientId, clientSecret);
    // Fetch company info to confirm access
    const infoRes = await fetch("https://api.connecteam.com/users/v1/users?limit=1", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!infoRes.ok) throw new Error("API call failed");
    res.json({ message: "Connection successful", token: token.slice(0, 20) + "..." });
  } catch (err: any) {
    console.error("[connecteam] test connection error:", err);
    res.status(400).json({ message: "Connection failed. Check your Connecteam credentials and try again." });
  }
});

// GET users from Connecteam
connecteamRouter.get("/api/integrations/connecteam/users", requireRole("admin"), async (_req, res) => {
  try {
    const settings = await storage.getAllSettings();
    const map: Record<string, string> = {};
    settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
    const token = await connecteamToken(map["connecteam_client_id"], map["connecteam_client_secret"]);
    const r = await fetch("https://api.connecteam.com/users/v1/users?limit=50", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data: any = await r.json();
    res.json(data.data?.users ?? []);
  } catch (err: any) {
    console.error("[connecteam] fetch users error:", err);
    res.status(500).json({ message: "Failed to fetch Connecteam users." });
  }
});

// GET jobs from Connecteam
connecteamRouter.get("/api/integrations/connecteam/jobs", requireRole("admin"), async (_req, res) => {
  try {
    const settings = await storage.getAllSettings();
    const map: Record<string, string> = {};
    settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
    const token = await connecteamToken(map["connecteam_client_id"], map["connecteam_client_secret"]);
    const r = await fetch("https://api.connecteam.com/jobs/v1/jobs?limit=100", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data: any = await r.json();
    res.json(data.data?.jobs ?? []);
  } catch (err: any) {
    console.error("[connecteam] fetch jobs error:", err);
    res.status(500).json({ message: "Failed to fetch Connecteam jobs." });
  }
});

// GET time activities from Connecteam
connecteamRouter.get("/api/integrations/connecteam/time", requireRole("admin"), async (req, res) => {
  try {
    const settings = await storage.getAllSettings();
    const map: Record<string, string> = {};
    settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
    const token = await connecteamToken(map["connecteam_client_id"], map["connecteam_client_secret"]);
    const { startDate, endDate } = req.query as any;
    const params = new URLSearchParams({ limit: "100" });
    if (startDate) params.set("startDate", startDate);
    if (endDate)   params.set("endDate",   endDate);
    const r = await fetch(`https://api.connecteam.com/time_clock/v1/time_activities?${params}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data: any = await r.json();
    res.json(data.data ?? []);
  } catch (err: any) {
    console.error("[connecteam] fetch time activities error:", err);
    res.status(500).json({ message: "Failed to fetch Connecteam time activities." });
  }
});

// POST sync employees → create as technicians in FusPro
connecteamRouter.post("/api/integrations/connecteam/sync-employees", requireRole("admin"), async (req, res) => {
  try {
    const settings = await storage.getAllSettings();
    const map: Record<string, string> = {};
    settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
    const token = await connecteamToken(map["connecteam_client_id"], map["connecteam_client_secret"]);
    const r = await fetch("https://api.connecteam.com/users/v1/users?limit=50", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data: any = await r.json();
    const ctUsers: any[] = data.data?.users ?? [];

    // Get existing FusPro users by email
    const existingUsers = await storage.getAllUsers();
    const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));

    let created = 0; let skipped = 0;
    for (const u of ctUsers) {
      if (u.userType === "owner") { skipped++; continue; }
      const email = (u.email || "").toLowerCase();
      if (!email || existingEmails.has(email)) { skipped++; continue; }
      // Create user as technician
      const hashedPw = await bcrypt.hash("FusePro123!", 12);
      const newUser = await storage.createUser({
        email,
        password: hashedPw,
        name: `${u.firstName} ${u.lastName}`.trim(),
        role: "technician",
      });
      // Create technician profile and add to team conversation
      await storage.createTechnician({ userId: newUser.id, status: "available" });
      await storage.ensureTeamMember(newUser.id).catch(() => {});
      created++;
    }

    await storage.upsertSetting("connecteam_last_sync", new Date().toISOString());
    res.json({ message: `Sync complete: ${created} created, ${skipped} skipped`, created, skipped });
  } catch (err: any) {
    console.error("[connecteam] sync-employees error:", err);
    res.status(500).json({ message: "Employee sync failed." });
  }
});
