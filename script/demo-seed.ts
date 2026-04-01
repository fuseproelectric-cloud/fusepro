/**
 * demo-seed.ts
 * Clears ALL data (keeps admin user + settings) and inserts rich demo data.
 * Run: cd /var/www/fusepro-cloud && set -a && source .env && set +a && npx tsx script/demo-seed.ts
 */
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}
function tsAgo(n: number, hhmm: string): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const [hh, mm] = hhmm.split(":").map(Number);
  d.setUTCHours(hh, mm, 0, 0);
  return d.toISOString();
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. CLEAR (FK-safe order) ─────────────────────────────────────────────
    console.log("Clearing data...");
    await client.query("DELETE FROM chat_messages");
    await client.query("DELETE FROM conv_messages");
    await client.query("DELETE FROM conversation_members");
    await client.query("DELETE FROM conversations");
    await client.query("DELETE FROM notifications");
    await client.query("DELETE FROM timesheets");
    await client.query("DELETE FROM job_materials");
    await client.query("DELETE FROM invoices");
    await client.query("DELETE FROM estimates");
    await client.query("DELETE FROM requests");
    await client.query("DELETE FROM jobs");
    await client.query("DELETE FROM technicians");
    await client.query("DELETE FROM customers");   // cascades customer_addresses
    await client.query("DELETE FROM inventory");
    await client.query("DELETE FROM services");
    await client.query(`DELETE FROM users WHERE role != 'admin'`);
    console.log("  cleared.");

    // ── 2. ENSURE ADMIN ──────────────────────────────────────────────────────
    const adminPass = await bcrypt.hash(process.env.ADMIN_PASSWORD || "FusePro2024!", 12);
    const adminRes = await client.query(
      `INSERT INTO users (email, password, name, role)
       VALUES ($1,$2,$3,'admin')
       ON CONFLICT (email) DO UPDATE SET password=EXCLUDED.password, name=EXCLUDED.name
       RETURNING id`,
      ["admin@fusepro.cloud", adminPass, "Admin User"]
    );
    const adminId: number = adminRes.rows[0].id;

    // ── 3. TECHNICIAN USERS ──────────────────────────────────────────────────
    const techPass = await bcrypt.hash("Tech1234!", 12);

    const uMike = await client.query(
      `INSERT INTO users (email,password,name,role) VALUES ($1,$2,'Mike Johnson','technician') RETURNING id`,
      ["mike.johnson@fusepro.cloud", techPass]
    );
    const uSara = await client.query(
      `INSERT INTO users (email,password,name,role) VALUES ($1,$2,'Sara Lee','technician') RETURNING id`,
      ["sara.lee@fusepro.cloud", techPass]
    );
    const uCarlos = await client.query(
      `INSERT INTO users (email,password,name,role) VALUES ($1,$2,'Carlos Rivera','technician') RETURNING id`,
      ["carlos.rivera@fusepro.cloud", techPass]
    );
    const uDisp = await client.query(
      `INSERT INTO users (email,password,name,role) VALUES ($1,$2,'Lisa Park','dispatcher') RETURNING id`,
      ["dispatch@fusepro.cloud", techPass]
    );

    const mikId: number = uMike.rows[0].id;
    const sarId: number = uSara.rows[0].id;
    const carId: number = uCarlos.rows[0].id;
    const dispId: number = uDisp.rows[0].id;

    const tMike = await client.query(
      `INSERT INTO technicians (user_id,phone,hourly_rate,status,color,skills)
       VALUES ($1,'(312) 555-0101',65,'active','#f97316',$2) RETURNING id`,
      [mikId, ["Electrical Panel", "EV Charger", "Lighting"]]
    );
    const tSara = await client.query(
      `INSERT INTO technicians (user_id,phone,hourly_rate,status,color,skills)
       VALUES ($1,'(312) 555-0202',70,'active','#8b5cf6',$2) RETURNING id`,
      [sarId, ["Commercial Wiring", "Smart Home", "Solar"]]
    );
    const tCarlos = await client.query(
      `INSERT INTO technicians (user_id,phone,hourly_rate,status,color,skills)
       VALUES ($1,'(312) 555-0303',60,'active','#10b981',$2) RETURNING id`,
      [carId, ["Residential", "Outlets", "GFCI"]]
    );

    const techMikeId: number = tMike.rows[0].id;
    const techSaraId: number = tSara.rows[0].id;
    const techCarlosId: number = tCarlos.rows[0].id;

    // ── 4. CUSTOMERS ─────────────────────────────────────────────────────────
    async function addCustomer(
      name: string, email: string, phone: string, company: string | null,
      addr: string, city: string, state: string, zip: string,
      tags: string[] = []
    ): Promise<{ id: number; addrId: number }> {
      const c = await client.query(
        `INSERT INTO customers (name,email,phone,company,tags) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [name, email, phone, company, tags]
      );
      const cid: number = c.rows[0].id;
      const a = await client.query(
        `INSERT INTO customer_addresses (customer_id,label,address,city,state,zip,is_primary)
         VALUES ($1,'Service Address',$2,$3,$4,$5,true) RETURNING id`,
        [cid, addr, city, state, zip]
      );
      return { id: cid, addrId: a.rows[0].id };
    }

    const c1 = await addCustomer("Robert & Linda Thompson", "thompson@email.com", "(847) 555-1001", null,
      "4521 Maple Ave", "Evanston", "IL", "60201", ["vip"]);
    const c2 = await addCustomer("Sunset Cafe", "owner@sunsetcafe.com", "(312) 555-2002", "Sunset Cafe LLC",
      "820 N Michigan Ave", "Chicago", "IL", "60611", ["commercial", "recurring"]);
    const c3 = await addCustomer("David Kim", "david.kim@gmail.com", "(773) 555-3003", null,
      "1130 W Belden Ave", "Chicago", "IL", "60614");
    const c4 = await addCustomer("Greenfield Property Mgmt", "mgmt@greenfield.com", "(224) 555-4004", "Greenfield PM Inc",
      "500 W Madison St", "Chicago", "IL", "60661", ["commercial"]);
    const c5 = await addCustomer("Maria Gonzalez", "maria.g@yahoo.com", "(708) 555-5005", null,
      "2233 Oak Street", "Oak Park", "IL", "60302");
    const c6 = await addCustomer("Harbor View Hotel", "facilities@harborview.com", "(312) 555-6006", "Harbor View LLC",
      "220 N Columbus Dr", "Chicago", "IL", "60601", ["vip", "commercial"]);
    const c7 = await addCustomer("James & Patricia Moore", "jmoore@outlook.com", "(847) 555-7007", null,
      "789 Elm Drive", "Wilmette", "IL", "60091");

    // ── 5. SERVICES ──────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO services (name,description,unit_price,cost,taxable,category) VALUES
      ('Electrical Panel Upgrade','Upgrade main panel to 200A service',1850.00,950.00,true,'Panels'),
      ('EV Charger Installation','Level 2 EV charger install (240V)',650.00,380.00,true,'EV'),
      ('Outlet Installation','Install new 15A/20A outlet',120.00,35.00,true,'Outlets'),
      ('GFCI Outlet','Install GFCI-protected outlet',95.00,28.00,true,'Outlets'),
      ('Ceiling Fan Installation','Install ceiling fan with light kit',180.00,60.00,true,'Lighting'),
      ('Recessed Lighting','Install 6" LED recessed light',95.00,30.00,true,'Lighting'),
      ('Smoke/CO Detector','Install combination detector',85.00,40.00,true,'Safety'),
      ('Circuit Breaker Replacement','Replace faulty circuit breaker',175.00,55.00,true,'Panels'),
      ('Electrical Inspection','Full residential electrical inspection',275.00,80.00,false,'Inspection'),
      ('Smart Switch Installation','Install smart dimmer/switch',145.00,58.00,true,'Smart Home'),
      ('Generator Transfer Switch','Install manual transfer switch',950.00,480.00,true,'Generator'),
      ('Commercial Wiring','Per-hour commercial rough-in wiring',125.00,70.00,true,'Commercial')
    `);

    // ── 6. INVENTORY ─────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO inventory (name,sku,quantity,min_quantity,unit_cost,unit,category) VALUES
      ('20A Circuit Breaker','CB-20A',48,10,8.50,'pcs','Breakers'),
      ('15A Circuit Breaker','CB-15A',62,10,7.00,'pcs','Breakers'),
      ('GFCI Outlet 20A White','GFCI-20W',35,8,12.00,'pcs','Outlets'),
      ('Standard Duplex Outlet','OUT-15W',80,20,3.50,'pcs','Outlets'),
      ('LED Recessed 6" Trim','LED-6R',55,12,14.00,'pcs','Lighting'),
      ('12/2 NM-B Wire (50ft)','WIRE-12-50',18,5,28.00,'roll','Wire'),
      ('14/2 NM-B Wire (50ft)','WIRE-14-50',22,5,22.00,'roll','Wire'),
      ('200A Main Panel Box','PANEL-200A',6,2,185.00,'pcs','Panels'),
      ('Junction Box 4"','JB-4',40,15,2.50,'pcs','Boxes'),
      ('Smoke/CO Combo Detector','SMCO-1',14,4,32.00,'pcs','Safety'),
      ('Smart Dimmer Switch','SMART-DIM',20,5,45.00,'pcs','Smart'),
      ('Level 2 EV Charger 48A','EV-48A',8,2,320.00,'pcs','EV')
    `);

    // ── 7. REQUESTS ──────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO requests
        (customer_id,service_address_id,title,description,priority,status,source,
         category,owner_user_id,created_by_user_id,
         customer_contact_name,customer_phone,created_at)
      VALUES ($1,$2,$3,$4,'high','triaged','phone',$5,$6,$6,$7,$8,$9)`,
      [c1.id, c1.addrId,
       "Panel making buzzing noise",
       "Client reports main panel buzzing and one breaker keeps tripping. Concerned about fire risk.",
       "Panels", adminId, "Linda Thompson", "(847) 555-1001", daysAgo(3)]
    );

    await client.query(`
      INSERT INTO requests
        (customer_id,service_address_id,title,description,priority,status,source,
         category,owner_user_id,created_by_user_id,
         customer_contact_name,customer_phone,requested_date,created_at)
      VALUES ($1,$2,$3,$4,'normal','new','web',$5,$6,$6,$7,$8,$9,$10)`,
      [c3.id, c3.addrId,
       "EV charger installation",
       "Customer purchased a Tesla Model Y and needs a 240V Level 2 charger in the garage.",
       "EV", dispId, "David Kim", "(773) 555-3003",
       daysFromNow(5), daysAgo(1)]
    );

    await client.query(`
      INSERT INTO requests
        (customer_id,service_address_id,title,description,priority,status,source,
         category,owner_user_id,created_by_user_id,
         customer_contact_name,customer_phone,created_at)
      VALUES ($1,$2,$3,$4,'low','assessment_scheduled','email',$5,$6,$6,$7,$8,$9)`,
      [c5.id, c5.addrId,
       "Kitchen remodel — new circuits needed",
       "Remodeling kitchen, need 2 dedicated 20A circuits and 4 new outlets.",
       "Residential", dispId, "Maria Gonzalez", "(708) 555-5005", daysAgo(5)]
    );

    // ── 8. JOBS ───────────────────────────────────────────────────────────────
    // statuses: pending | assigned | in_progress | completed | cancelled
    const j1 = await client.query(`
      INSERT INTO jobs (customer_id,title,description,status,priority,technician_id,
        scheduled_at,estimated_duration,address,city,state,zip,notes,completed_at,created_at)
      VALUES ($1,$2,$3,'completed','high',$4,$5,360,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [c1.id,
       "Panel Upgrade 200A — Thompson",
       "Upgrade existing 100A panel to 200A service. Replace meter base.",
       techMikeId, daysAgo(10),
       "4521 Maple Ave", "Evanston", "IL", "60201",
       "Old Federal Pacific panel. Replaced with Square D QO 200A. All circuits tested.",
       daysAgo(10), daysAgo(12)]
    );

    const j2 = await client.query(`
      INSERT INTO jobs (customer_id,title,description,status,priority,technician_id,
        scheduled_at,estimated_duration,address,city,state,zip,notes,created_at)
      VALUES ($1,$2,$3,'in_progress','normal',$4,$5,720,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [c2.id,
       "Commercial Rewire — Sunset Cafe",
       "Full kitchen electrical rewire per code. Install dedicated circuits for commercial equipment.",
       techSaraId, daysAgo(1),
       "820 N Michigan Ave", "Chicago", "IL", "60611",
       "Day 2 of 3. Rough-in complete. Running circuits to equipment locations today.",
       daysAgo(7)]
    );

    const j3 = await client.query(`
      INSERT INTO jobs (customer_id,title,description,status,priority,technician_id,
        scheduled_at,estimated_duration,address,city,state,zip,created_at)
      VALUES ($1,$2,$3,'assigned','normal',$4,$5,240,$6,$7,$8,$9,$10) RETURNING id`,
      [c3.id,
       "EV Charger Install — Kim",
       "Install Tesla Wall Connector (48A) in garage. Run 60A circuit from panel.",
       techCarlosId, daysFromNow(5),
       "1130 W Belden Ave", "Chicago", "IL", "60614",
       daysAgo(1)]
    );

    const j4 = await client.query(`
      INSERT INTO jobs (customer_id,title,description,status,priority,technician_id,
        scheduled_at,estimated_duration,address,city,state,zip,created_at)
      VALUES ($1,$2,$3,'assigned','normal',$4,$5,480,$6,$7,$8,$9,$10) RETURNING id`,
      [c4.id,
       "Lighting Retrofit — Greenfield Office",
       "Replace 80 fluorescent fixtures with LED. Install occupancy sensors in conference rooms.",
       techSaraId, daysFromNow(3),
       "500 W Madison St", "Chicago", "IL", "60661",
       daysAgo(4)]
    );

    const j5 = await client.query(`
      INSERT INTO jobs (customer_id,title,description,status,priority,technician_id,
        scheduled_at,estimated_duration,address,city,state,zip,created_at)
      VALUES ($1,$2,$3,'pending','low',$4,$5,120,$6,$7,$8,$9,$10) RETURNING id`,
      [c7.id,
       "Smoke Detector Upgrade — Moore",
       "Replace 6 smoke detectors with combination smoke/CO units. Interconnect all units.",
       techCarlosId, daysFromNow(8),
       "789 Elm Drive", "Wilmette", "IL", "60091",
       daysAgo(2)]
    );

    const j6 = await client.query(`
      INSERT INTO jobs (customer_id,title,description,status,priority,technician_id,
        scheduled_at,estimated_duration,address,city,state,zip,notes,completed_at,created_at)
      VALUES ($1,$2,$3,'completed','normal',$4,$5,120,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [c5.id,
       "GFCI Outlets — Gonzalez",
       "Install GFCI outlets in kitchen and two bathrooms.",
       techCarlosId, daysAgo(6),
       "2233 Oak Street", "Oak Park", "IL", "60302",
       "Installed 5 GFCI outlets. All tested.",
       daysAgo(6), daysAgo(8)]
    );

    const j7 = await client.query(`
      INSERT INTO jobs (customer_id,title,description,status,priority,technician_id,
        scheduled_at,estimated_duration,address,city,state,zip,notes,created_at)
      VALUES ($1,$2,$3,'cancelled','normal',$4,$5,360,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [c6.id,
       "Generator Transfer Switch — Harbor View",
       "Install 200A manual transfer switch for backup generator hookup.",
       techMikeId, daysAgo(5),
       "220 N Columbus Dr", "Chicago", "IL", "60601",
       "Client postponed — generator delivery delayed.",
       daysAgo(9)]
    );

    const j1id: number = j1.rows[0].id;
    const j2id: number = j2.rows[0].id;
    const j3id: number = j3.rows[0].id;
    const j6id: number = j6.rows[0].id;

    // ── Job Materials ────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO job_materials (job_id,name,quantity,unit,unit_cost) VALUES
      ($1,'Square D QO 200A Panel',1,'pcs',185.00),
      ($1,'200A Meter Base',1,'pcs',95.00),
      ($1,'10/3 Wire 25ft',2,'roll',38.00),
      ($1,'Junction Boxes',4,'pcs',2.50)`,
      [j1id]
    );
    await client.query(`
      INSERT INTO job_materials (job_id,name,quantity,unit,unit_cost) VALUES
      ($1,'20A Breakers',8,'pcs',8.50),
      ($1,'12/2 NM-B Wire 50ft',6,'roll',28.00),
      ($1,'Commercial Grade Outlets',12,'pcs',9.00)`,
      [j2id]
    );
    await client.query(`
      INSERT INTO job_materials (job_id,name,quantity,unit,unit_cost) VALUES
      ($1,'EV Charger 48A',1,'pcs',320.00),
      ($1,'6/3 Wire 40ft',1,'roll',85.00),
      ($1,'60A 2-Pole Breaker',1,'pcs',22.00)`,
      [j3id]
    );
    await client.query(`
      INSERT INTO job_materials (job_id,name,quantity,unit,unit_cost) VALUES
      ($1,'GFCI Outlet 20A',5,'pcs',12.00)`,
      [j6id]
    );

    // ── 9. TIMESHEETS (event-based: clock_in / clock_out) ────────────────────
    // Mike — panel job (completed)
    await client.query(`
      INSERT INTO timesheets (technician_id,job_id,entry_type,timestamp,notes)
      VALUES ($1,$2,'clock_in',$3,'Starting panel upgrade — Thompson')`,
      [techMikeId, j1id, tsAgo(10, "09:00")]
    );
    await client.query(`
      INSERT INTO timesheets (technician_id,job_id,entry_type,timestamp,notes)
      VALUES ($1,$2,'clock_out',$3,'Panel swap complete. All circuits tested OK.')`,
      [techMikeId, j1id, tsAgo(10, "15:00")]
    );

    // Sara — cafe (day 1)
    await client.query(`
      INSERT INTO timesheets (technician_id,job_id,entry_type,timestamp,notes)
      VALUES ($1,$2,'clock_in',$3,'Day 1 start — demo and rough-in')`,
      [techSaraId, j2id, tsAgo(2, "07:30")]
    );
    await client.query(`
      INSERT INTO timesheets (technician_id,job_id,entry_type,timestamp,notes)
      VALUES ($1,$2,'clock_out',$3,'Day 1 complete. Rough-in done.')`,
      [techSaraId, j2id, tsAgo(2, "15:30")]
    );

    // Carlos — GFCI (completed)
    await client.query(`
      INSERT INTO timesheets (technician_id,job_id,entry_type,timestamp,notes)
      VALUES ($1,$2,'clock_in',$3,'GFCI outlets — Gonzalez')`,
      [techCarlosId, j6id, tsAgo(6, "11:00")]
    );
    await client.query(`
      INSERT INTO timesheets (technician_id,job_id,entry_type,timestamp,notes)
      VALUES ($1,$2,'clock_out',$3,'All 5 GFCI outlets installed and tested.')`,
      [techCarlosId, j6id, tsAgo(6, "13:30")]
    );

    // ── 10. ESTIMATES ─────────────────────────────────────────────────────────
    // status: draft | awaiting_response | changes_requested | approved | converted | archived
    const lineItems = (items: { description: string; quantity: number; unitPrice: number }[]) =>
      JSON.stringify(items.map((i, idx) => ({
        id: String(idx + 1),
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.quantity * i.unitPrice,
      })));

    const est1 = await client.query(`
      INSERT INTO estimates
        (customer_id,title,status,line_items,subtotal,tax,total,notes,valid_until,created_at)
      VALUES ($1,$2,'approved',$3,2850.00,263.63,3113.63,$4,$5,$6) RETURNING id`,
      [c1.id,
       "Panel Upgrade — Thompson Residence",
       lineItems([
         { description: "200A Panel Upgrade (labor)", quantity: 1, unitPrice: 1850 },
         { description: "Materials & permit", quantity: 1, unitPrice: 1000 },
       ]),
       "Includes all labor and materials. Panel permit included.",
       daysFromNow(30), daysAgo(14)]
    );

    await client.query(`
      INSERT INTO estimates
        (customer_id,title,status,line_items,subtotal,tax,total,notes,valid_until,created_at)
      VALUES ($1,$2,'awaiting_response',$3,4200.00,388.50,4588.50,$4,$5,$6)`,
      [c2.id,
       "Commercial Kitchen Rewire — Sunset Cafe",
       lineItems([
         { description: "Commercial wiring (12 hrs)", quantity: 12, unitPrice: 125 },
         { description: "Dedicated circuits x8", quantity: 8, unitPrice: 200 },
         { description: "Materials", quantity: 1, unitPrice: 1100 },
       ]),
       "Three-day job. 50% deposit required before start.",
       daysFromNow(14), daysAgo(8)]
    );

    await client.query(`
      INSERT INTO estimates
        (customer_id,title,status,line_items,subtotal,tax,total,notes,valid_until,created_at)
      VALUES ($1,$2,'draft',$3,780.00,72.15,852.15,$4,$5,$6)`,
      [c3.id,
       "EV Charger Installation — Kim",
       lineItems([
         { description: "Level 2 EV Charger 48A (labor)", quantity: 1, unitPrice: 200 },
         { description: "EV Charger Unit (48A)", quantity: 1, unitPrice: 580 },
       ]),
       "Permit required — included in price.",
       daysFromNow(15), daysAgo(1)]
    );

    await client.query(`
      INSERT INTO estimates
        (customer_id,title,status,line_items,subtotal,tax,total,notes,valid_until,created_at)
      VALUES ($1,$2,'changes_requested',$3,6500.00,601.25,7101.25,$4,$5,$6)`,
      [c4.id,
       "LED Lighting Retrofit — Greenfield Office",
       lineItems([
         { description: "LED Fixture replacement (80 units)", quantity: 80, unitPrice: 55 },
         { description: "Occupancy sensors (6 rooms)", quantity: 6, unitPrice: 180 },
         { description: "Labor (8 hrs)", quantity: 8, unitPrice: 125 },
         { description: "Misc materials", quantity: 1, unitPrice: 20 },
       ]),
       "Client requested to add 2 extra conference rooms to scope.",
       daysFromNow(30), daysAgo(6)]
    );

    // ── 11. INVOICES ──────────────────────────────────────────────────────────
    // invoice_number is required and unique
    await client.query(`
      INSERT INTO invoices
        (customer_id,estimate_id,invoice_number,subject,status,
         line_items,subtotal,tax,total,
         payment_terms,due_date,paid_at,notes,created_at)
      VALUES ($1,$2,'INV-0001',$3,'paid',$4,2850.00,263.63,3113.63,
              'net_30',$5,$6,'Thank you for your business!',$7)`,
      [c1.id, est1.rows[0].id,
       "Panel Upgrade — Thompson Residence",
       lineItems([
         { description: "200A Panel Upgrade (labor)", quantity: 1, unitPrice: 1850 },
         { description: "Materials & permit", quantity: 1, unitPrice: 1000 },
       ]),
       daysAgo(5), daysAgo(3), daysAgo(14)]
    );

    await client.query(`
      INSERT INTO invoices
        (customer_id,invoice_number,subject,status,
         line_items,subtotal,tax,total,
         payment_terms,due_date,notes,created_at)
      VALUES ($1,'INV-0002',$2,'sent',$3,475.00,43.94,518.94,
              'due_on_receipt',$4,'GFCI outlets — 3 locations.',$5)`,
      [c5.id,
       "GFCI Outlets — Gonzalez",
       lineItems([
         { description: "GFCI Outlet installation (5 units)", quantity: 5, unitPrice: 95 },
       ]),
       daysFromNow(0), daysAgo(5)]
    );

    await client.query(`
      INSERT INTO invoices
        (customer_id,invoice_number,subject,status,
         line_items,subtotal,tax,total,
         payment_terms,due_date,notes,created_at)
      VALUES ($1,'INV-0003',$2,'overdue',$3,1200.00,111.00,1311.00,
              'net_15',$4,'Emergency lighting repair — ballast replacements.',$5)`,
      [c6.id,
       "Emergency Lighting Repair — Harbor View",
       lineItems([
         { description: "Ballast replacement (emergency)", quantity: 1, unitPrice: 800 },
         { description: "Replacement fixtures", quantity: 4, unitPrice: 100 },
       ]),
       daysAgo(10), daysAgo(20)]
    );

    await client.query(`
      INSERT INTO invoices
        (customer_id,invoice_number,subject,status,
         line_items,subtotal,tax,total,
         payment_terms,due_date,notes,created_at)
      VALUES ($1,'INV-0004',$2,'draft',$3,510.00,47.18,557.18,
              'due_on_receipt',$4,'Smoke/CO detector replacements — 6 units.',$5)`,
      [c7.id,
       "Smoke Detectors — Moore",
       lineItems([
         { description: "Smoke/CO Detector install", quantity: 6, unitPrice: 85 },
       ]),
       daysFromNow(8), daysAgo(1)]
    );

    // ── 12. NOTIFICATIONS ─────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO notifications (user_id,type,from_name,text,timestamp,is_read) VALUES
      ($1,'activity','System','New request: Thompson — panel buzzing (High priority)',$2,false),
      ($1,'activity','Carlos Rivera','Job completed: GFCI Outlets — Gonzalez',$3,true),
      ($1,'activity','System','Invoice INV-0003 is overdue — Harbor View Hotel $1,311',$4,false),
      ($1,'activity','Mike Johnson','Estimate approved: Panel Upgrade — Thompson',$5,true)`,
      [adminId, daysAgo(3), daysAgo(6), daysAgo(1), daysAgo(11)]
    );

    await client.query("COMMIT");

    console.log("");
    console.log("✓ Demo seed complete!");
    console.log("");
    console.log("─── Logins ─────────────────────────────────────────────");
    console.log("  Admin:      admin@fusepro.cloud           FusePro2024!");
    console.log("  Dispatcher: dispatch@fusepro.cloud        Tech1234!");
    console.log("  Mike:       mike.johnson@fusepro.cloud    Tech1234!");
    console.log("  Sara:       sara.lee@fusepro.cloud        Tech1234!");
    console.log("  Carlos:     carlos.rivera@fusepro.cloud   Tech1234!");
    console.log("────────────────────────────────────────────────────────");
    console.log("");
    console.log("─── Data ───────────────────────────────────────────────");
    console.log("  Customers:   7  (mix residential + commercial)");
    console.log("  Technicians: 3  (Mike, Sara, Carlos)");
    console.log("  Requests:    3  (new, triaged, assessment_scheduled)");
    console.log("  Jobs:        7  (2 completed, 1 in_progress, 2 assigned, 1 pending, 1 cancelled)");
    console.log("  Estimates:   4  (approved, awaiting_response, draft, changes_requested)");
    console.log("  Invoices:    4  (paid, sent, overdue, draft)");
    console.log("  Inventory:  12 items");
    console.log("  Services:   12 items");
    console.log("────────────────────────────────────────────────────────");

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
