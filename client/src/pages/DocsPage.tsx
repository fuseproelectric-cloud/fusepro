import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "overview",      label: "Overview" },
  { id: "stack",         label: "Tech Stack" },
  { id: "architecture",  label: "Architecture" },
  { id: "database",      label: "Database Schema" },
  { id: "api",           label: "API Reference" },
  { id: "features",      label: "Features" },
  { id: "deployment",    label: "Deployment" },
];

function Code({ children }: { children: string }) {
  return (
    <code className="bg-muted/40 text-orange-700 px-1.5 py-0.5 rounded text-[13px] font-mono">
      {children}
    </code>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono overflow-x-auto leading-relaxed">
      {children}
    </pre>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold text-foreground mt-10 mb-4 pb-2 border-b border-border scroll-mt-6">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-foreground mt-6 mb-2">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>;
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/30">
            {headers.map(h => (
              <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2 border border-border">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 border border-border text-foreground font-mono text-xs align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide", color)}>
      {children}
    </span>
  );
}

export function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex gap-6 max-w-6xl mx-auto">
      {/* TOC sidebar */}
      <aside className="hidden lg:block w-44 flex-shrink-0">
        <div className="sticky top-4 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-2">Contents</p>
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={cn(
                "block px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeSection === s.id
                  ? "bg-orange-50 text-orange-600"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {s.label}
            </a>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 min-w-0 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-foreground">FusePro Cloud</h1>
            <Badge color="bg-orange-100 text-orange-700">v1.0</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Field service management platform for electrical contractors — jobs, scheduling, timesheets, invoicing, and team chat.
          </p>
        </div>

        {/* ── Overview ─────────────────────────────────── */}
        <H2 id="overview">Overview</H2>
        <P>
          FusePro Cloud is a full-stack web application built for electrical service companies. It covers the full job lifecycle:
          dispatch → scheduling → technician field tracking → invoicing → payroll-ready timesheets.
        </P>
        <P>
          The system has three user roles: <Code>admin</Code>, <Code>dispatcher</Code>, and <Code>technician</Code>.
          Admins and dispatchers manage the back-office; technicians use a mobile-optimised view to clock in, track jobs, and chat.
        </P>

        <H3>Role capabilities</H3>
        <Table
          headers={["Role", "Capabilities"]}
          rows={[
            ["admin", "Full access — users, settings, all reports, approve timesheets, manage rates"],
            ["dispatcher", "Jobs, schedule, customers, estimates, timesheets (read), team chat"],
            ["technician", "My jobs, my schedule, timesheet clock-in/out, job chat, inventory view"],
          ]}
        />

        {/* ── Tech Stack ───────────────────────────────── */}
        <H2 id="stack">Tech Stack</H2>
        <Table
          headers={["Layer", "Technology"]}
          rows={[
            ["Runtime", "Node.js 20 + TypeScript"],
            ["Framework", "Express.js"],
            ["Database", "PostgreSQL 15 via Drizzle ORM"],
            ["Frontend", "React 18 + Vite + TailwindCSS + shadcn/ui"],
            ["Routing", "wouter (client-side)"],
            ["Data fetching", "TanStack Query v5"],
            ["Real-time", "Socket.IO 4"],
            ["Auth", "express-session + bcryptjs + connect-pg-simple"],
            ["Forms", "react-hook-form + zod"],
            ["Process manager", "PM2"],
          ]}
        />

        {/* ── Architecture ─────────────────────────────── */}
        <H2 id="architecture">Architecture</H2>
        <Pre>{`fusepro-cloud/
├── client/src/
│   ├── pages/          # One file per page/route
│   ├── components/
│   │   ├── layout/     # Sidebar, AppLayout, TopBar
│   │   ├── ui/         # shadcn/ui primitives
│   │   └── chat/       # Chat-specific components
│   ├── hooks/          # useAuth, useUnreadMessages
│   └── lib/            # api.ts, queryClient.ts, time.ts, utils.ts
├── server/
│   ├── routes.ts       # All API endpoints (~1600 lines)
│   ├── storage.ts      # All DB queries (Storage class)
│   ├── db.ts           # Drizzle + pool init
│   ├── index.ts        # Express app bootstrap
│   └── lib/time.ts     # Timezone helpers (America/Chicago)
├── shared/
│   └── schema.ts       # Drizzle table defs + Zod schemas (shared by server & client)
└── dist/               # Build output`}</Pre>

        <H3>Request flow</H3>
        <Pre>{`Browser → Vite dev server (dev) / Express static (prod)
       → Express API routes (requireAuth / requireRole middleware)
       → Storage class methods (Drizzle ORM)
       → PostgreSQL

Socket.IO: Browser ↔ Express HTTP server (same port)
  Rooms: staff:notifications | user:{id} | job:{id} | conv:{id}`}</Pre>

        <H3>Timezone</H3>
        <P>
          All date logic uses <Code>America/Chicago</Code> (CT). Helpers in <Code>server/lib/time.ts</Code> and
          <Code>client/src/lib/time.ts</Code> convert between UTC storage and CT display.
          Week boundaries are Mon–Sun CT. Never use <Code>new Date().toISOString().slice(0,10)</Code> for date comparison — use <Code>dateStrCT()</Code>.
        </P>

        {/* ── Database ─────────────────────────────────── */}
        <H2 id="database">Database Schema</H2>

        <H3>Tables</H3>
        <Table
          headers={["Table", "Key columns", "Notes"]}
          rows={[
            ["users", "id, email, password, name, role", "role: admin | dispatcher | technician"],
            ["technicians", "id, user_id, phone, skills[], status, color, hourly_rate", "Links to users. status: available|active|inactive (admin label; write-blocked on on_job)"],
            ["customers", "id, name, email, phone, address, city, state, zip", ""],
            ["jobs", "id, title, customer_id, technician_id, status, priority, scheduled_at", "status: pending|assigned|on_the_way|in_progress|completed|cancelled"],
            ["timesheets", "id, technician_id, job_id, entry_type, timestamp, lat, lng, address", "entry_type: day_start|day_end|travel_start|travel_end|work_start|work_end|break_start|break_end"],
            ["timesheet_approvals", "id, technician_id, date (YYYY-MM-DD), approved_by, approved_at", "UNIQUE(technician_id, date)"],
            ["estimates", "id, job_id, customer_id, title, status, line_items (JSON), subtotal, tax, total", "status: draft|sent|approved|rejected"],
            ["invoices", "id, job_id, estimate_id, customer_id, invoice_number, status, line_items", "status: draft|sent|paid|overdue"],
            ["inventory", "id, name, sku, category, quantity, min_quantity, unit_cost, unit", ""],
            ["job_notes", "id, job_id, user_id, content", "Used as job-level chat"],
            ["job_note_reads", "user_id, job_id, last_read_note_id", "Composite PK — tracks unread per user per job"],
            ["conversations", "id, type, name, job_id, created_by", "type: team|group|direct|job"],
            ["conversation_members", "conversation_id, user_id, last_read_id", ""],
            ["conv_messages", "id, conversation_id, user_id, content", ""],
            ["notifications", "id, user_id, type, job_id, from_name, text, is_read", "type: message|activity"],
            ["admin_settings", "id, key, value", "Key-value store for company settings"],
            ["session", "sid, sess, expire", "express-session store"],
          ]}
        />

        <H3>Important: no ORM migrations</H3>
        <P>
          There is no auto-migration runner. Schema changes must be applied manually via <Code>psql</Code>.
          The Drizzle schema in <Code>shared/schema.ts</Code> is the source of truth — keep it in sync with the live DB.
        </P>
        <Pre>{`psql "postgresql://fusepro_cloud:<pass>@localhost:5432/fusepro_cloud_db"
# Example: ALTER TABLE technicians ADD COLUMN hourly_rate numeric(8,2) DEFAULT 25.00;`}</Pre>

        {/* ── API ──────────────────────────────────────── */}
        <H2 id="api">API Reference</H2>
        <P>All endpoints are under <Code>/api</Code>. Auth: session cookie. Middleware: <Code>requireAuth</Code> (any role) or <Code>requireRole(...roles)</Code>.</P>

        <H3>Auth</H3>
        <Table
          headers={["Method", "Path", "Auth", "Description"]}
          rows={[
            ["POST", "/api/auth/login", "—", "Login. Rate limited: 10 req/IP/15min"],
            ["POST", "/api/auth/logout", "any", "Destroy session"],
            ["GET", "/api/auth/me", "any", "Current user {id, email, name, role}"],
            ["PUT", "/api/auth/password", "any", "Change password (regenerates session)"],
          ]}
        />

        <H3>Jobs</H3>
        <Table
          headers={["Method", "Path", "Auth", "Description"]}
          rows={[
            ["GET", "/api/jobs", "any", "All jobs with technician+customer names"],
            ["GET", "/api/jobs/my", "tech", "Today's jobs for the logged-in technician"],
            ["GET", "/api/jobs/:id", "any", "Job + notes"],
            ["POST", "/api/jobs", "admin|disp", "Create job"],
            ["PUT", "/api/jobs/:id", "any", "Update job (techs limited to status/notes on own jobs)"],
            ["DELETE", "/api/jobs/:id", "admin|disp", "Delete job"],
            ["PUT", "/api/jobs/:id/status", "any", "Status update with auto-timesheet entries"],
            ["GET", "/api/jobs/:id/notes", "any", "Job notes/chat"],
            ["POST", "/api/jobs/:id/notes", "any", "Post note + notifies members"],
            ["PUT", "/api/jobs/:id/notes/read", "any", "Mark notes read up to lastNoteId"],
            ["GET", "/api/jobs/:id/materials", "any", "Job materials"],
            ["POST", "/api/jobs/:id/materials", "any", "Add material"],
          ]}
        />

        <H3>Timesheets</H3>
        <Table
          headers={["Method", "Path", "Auth", "Description"]}
          rows={[
            ["GET", "/api/timesheet/today", "tech", "Today's entries + running status"],
            ["GET", "/api/timesheet/week?weekOf=YYYY-MM-DD", "tech", "Week data + approvals for own technician"],
            ["GET", "/api/timesheet/earnings?from=&to=", "tech", "Earnings breakdown by job/day"],
            ["POST", "/api/timesheet", "tech", "Create entry {entryType, jobId?, lat?, lng?, address?, notes?}"],
            ["GET", "/api/admin/timesheets?date=YYYY-MM-DD", "admin|disp", "All techs for a day"],
            ["GET", "/api/admin/timesheets/report?from=&to=", "admin|disp", "Range report"],
            ["GET", "/api/admin/timesheets/week/:techId?weekOf=", "admin|disp", "Week view for specific tech + approvals"],
            ["PUT", "/api/admin/timesheets/entries/:id", "admin|disp", "Edit entry {entryType, timestamp, notes}"],
            ["DELETE", "/api/admin/timesheets/entries/:id", "admin|disp", "Delete entry"],
            ["POST", "/api/admin/timesheets/approve", "admin|disp", "Approve a day {technicianId, date}"],
            ["DELETE", "/api/admin/timesheets/approve", "admin|disp", "Un-approve a day"],
            ["PUT", "/api/technicians/:id/rate", "admin", "Set hourly rate"],
          ]}
        />

        <H3>Chat & Conversations</H3>
        <Table
          headers={["Method", "Path", "Auth", "Description"]}
          rows={[
            ["GET", "/api/conversations", "any", "User's conversations with unread counts"],
            ["POST", "/api/conversations", "any", "Create group/direct conversation"],
            ["POST", "/api/conversations/direct/:userId", "any", "Get or create DM"],
            ["GET", "/api/conversations/:id/messages", "any", "Messages (paginated via ?before=id)"],
            ["POST", "/api/conversations/:id/messages", "any", "Send message"],
            ["PUT", "/api/conversations/:id/read", "any", "Mark read up to lastId"],
            ["GET", "/api/conversations/job-list", "any", "Job chats with unread counts"],
            ["GET", "/api/chat", "any", "Legacy team chat messages"],
            ["POST", "/api/chat", "any", "Send team chat message"],
          ]}
        />

        <H3>Socket.IO events</H3>
        <Table
          headers={["Direction", "Event", "Payload", "Description"]}
          rows={[
            ["client→server", "join:user userId", "number", "Join own notification room (validated against session)"],
            ["client→server", "join:staff", "—", "Join staff broadcast room (requires auth)"],
            ["client→server", "join:job jobId", "number", "Join job room for live updates"],
            ["client→server", "join:conv convId", "number", "Join conversation room"],
            ["server→client", "job:created", "Job", "New job (staff room)"],
            ["server→client", "job:updated", "Job", "Job changed (staff room + job room)"],
            ["server→client", "conv:message", "ConvMessage", "New conversation message"],
            ["server→client", "conv:unread", "{conversationId}", "Unread bump for a conversation"],
            ["server→client", "job:note", "JobNote", "New job note posted"],
            ["server→client", "notification:new_message", "Notification", "Chat notification"],
            ["server→client", "notification:activity", "Notification", "Job activity notification"],
          ]}
        />

        {/* ── Features ─────────────────────────────────── */}
        <H2 id="features">Features</H2>

        <H3>Timesheet clock-in flow</H3>
        <Pre>{`day_start  →  (travel_start → travel_end)?  →  work_start → work_end
                                                ↕ break_start ↔ break_end
           →  day_end

First job of day: skip travel (work_start direct)
Subsequent jobs: full travel_start → travel_end → work_start → work_end cycle`}</Pre>

        <H3>Technician earnings</H3>
        <P>
          Earnings = <Code>(workMinutes / 60) × hourlyRate</Code>. Rate stored in <Code>technicians.hourly_rate</Code>.
          Admin sets it via <Code>PUT /api/technicians/:id/rate</Code>. Technician sees breakdown per-job and per-day with bar chart.
        </P>

        <H3>Timesheet approval</H3>
        <P>
          Admin opens Weekly view → selects technician → browses weeks → clicks a day → reviews entries (can edit/delete) → clicks "Approve Day".
          Approval stored in <Code>timesheet_approvals</Code>. Technician sees green ✓ on approved day cells with "Approved by manager" label.
        </P>

        <H3>Job chat vs. Team chat</H3>
        <Table
          headers={["", "Job Chat", "Team Chat", "Direct / Group"]}
          rows={[
            ["Storage", "job_notes", "chat_messages (legacy)", "conv_messages"],
            ["Read tracking", "job_note_reads", "chat_reads", "conversation_members.last_read_id"],
            ["Access", "Job participants", "All users", "Members only"],
          ]}
        />

        <H3>Notifications</H3>
        <P>
          Stored in <Code>notifications</Code> table. Two types: <Code>message</Code> (chat) and <Code>activity</Code> (job events).
          Delivered via Socket.IO to <Code>user:{"{id}"}</Code> room. Badge counts shown in sidebar via <Code>useUnreadMessages</Code> hook.
        </P>

        {/* ── Deployment ───────────────────────────────── */}
        <H2 id="deployment">Deployment</H2>

        <H3>Build & restart</H3>
        <Pre>{`cd /var/www/fusepro-cloud
npm run build          # Vite client build + esbuild server build → dist/
pm2 restart fusepro-cloud`}</Pre>

        <H3>Environment variables (.env)</H3>
        <Table
          headers={["Variable", "Description"]}
          rows={[
            ["DATABASE_URL", "PostgreSQL connection string"],
            ["SESSION_SECRET", "express-session signing secret (min 32 chars)"],
            ["NODE_ENV", "production | development"],
            ["PORT", "HTTP port (default 5000)"],
          ]}
        />

        <H3>PM2 processes</H3>
        <Pre>{`pm2 list
# ID 0: fusepro        (fusepro.us — old app)
# ID 1: fusepro-cloud  (fusepro.cloud — this app, port 5000)`}</Pre>

        <H3>Database connection</H3>
        <Pre>{`psql "postgresql://fusepro_cloud:<password>@localhost:5432/fusepro_cloud_db"`}</Pre>

        <H3>File uploads</H3>
        <P>
          Photos uploaded to <Code>/var/www/fusepro-cloud/uploads/</Code> and served at <Code>/uploads/*</Code>.
          Max 10 MB per file, images only. Filenames use <Code>Date.now() + crypto.randomBytes(8)</Code>.
        </P>

        <div className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground text-center">
          FusePro Cloud internal docs — updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </div>
      </div>
    </div>
  );
}
