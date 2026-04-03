import type { Customer } from "@shared/schema";
import type { LineItem } from "@shared/schema";

export interface PrintDocumentOptions {
  type: "invoice" | "estimate";
  number: string;
  title?: string;
  status: string;
  customer: Customer;
  /** Optional service / billing address to show on the document */
  serviceAddress?: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
  lineItems: LineItem[];
  subtotal: string | number;
  tax: string | number;
  total: string | number;
  notes?: string | null;
  createdAt: string | Date;
  dueDate?: string | Date | null;
  validUntil?: string | Date | null;
  paymentTerms?: string | null;
  company?: Record<string, string>;
}

function fmt$(val: string | number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(val));
}

function fmtDate(val: string | Date | null | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function statusColors(s: string): { bg: string; fg: string } {
  const map: Record<string, { bg: string; fg: string }> = {
    paid:              { bg: "#dcfce7", fg: "#166534" },
    approved:          { bg: "#dcfce7", fg: "#166534" },
    sent:              { bg: "#dbeafe", fg: "#1e40af" },
    awaiting_response: { bg: "#dbeafe", fg: "#1e40af" },
    draft:             { bg: "#f3f4f6", fg: "#374151" },
    overdue:           { bg: "#fee2e2", fg: "#991b1b" },
    rejected:          { bg: "#fee2e2", fg: "#991b1b" },
    changes_requested: { bg: "#fef3c7", fg: "#92400e" },
  };
  return map[s] ?? { bg: "#f3f4f6", fg: "#374151" };
}

function fmtPaymentTerms(pt: string | null | undefined): string {
  if (!pt) return "";
  const map: Record<string, string> = {
    due_on_receipt: "Due on Receipt",
    net_15:         "Net 15",
    net_30:         "Net 30",
    net_60:         "Net 60",
  };
  return map[pt] ?? pt.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function buildDocumentHtml(options: PrintDocumentOptions): string {
  const {
    type, number, title, status, customer,
    serviceAddress,
    lineItems, subtotal, tax, total, notes,
    createdAt, dueDate, validUntil, paymentTerms, company = {},
  } = options;

  const companyName    = company.company_name    || "FusePro Cloud";
  const companyAddress = company.company_address || "";
  const companyCity    = company.company_city    || "";
  const companyState   = company.company_state   || "";
  const companyZip     = company.company_zip     || "";
  const companyPhone   = company.company_phone   || "";
  const companyEmail   = company.company_email   || "";
  const companyWebsite = company.company_website || "";
  const companyLogo    = company.company_logo    || "";

  const companyCityLine = [companyCity, companyState, companyZip].filter(Boolean).join(", ");
  const svcCityLine     = [serviceAddress?.city, serviceAddress?.state, serviceAddress?.zip].filter(Boolean).join(", ");

  const { bg, fg } = statusColors(status);
  const docLabel = type === "invoice" ? "INVOICE" : "ESTIMATE";
  const termsLabel = fmtPaymentTerms(paymentTerms);

  const lineItemsHtml = lineItems.map((li, i) => `
    <tr class="${i % 2 === 1 ? "row-alt" : ""}">
      <td class="td-desc">${li.description || ""}</td>
      <td class="td-center">${li.quantity}</td>
      <td class="td-right">${fmt$(li.unitPrice)}</td>
      <td class="td-right td-bold">${fmt$(li.total)}</td>
    </tr>`).join("");

  const logoHtml = companyLogo
    ? `<img src="${companyLogo}" alt="${companyName}" class="logo" />`
    : `<div class="co-wordmark">${companyName}</div>`;

  // Bill-to block rows
  const billRows = [
    `<div class="bt-name">${customer.name}</div>`,
    customer.company ? `<div class="bt-line">${customer.company}</div>` : "",
    serviceAddress?.address ? `<div class="bt-line">${serviceAddress.address}</div>` : "",
    svcCityLine ? `<div class="bt-line">${svcCityLine}</div>` : "",
    customer.phone ? `<div class="bt-line">${customer.phone}</div>` : "",
    customer.email ? `<div class="bt-line">${customer.email}</div>` : "",
  ].filter(Boolean).join("\n");

  // Details table rows
  const detailRows = [
    `<tr><td class="dt-label">${type === "invoice" ? "Invoice #" : "Estimate #"}</td><td class="dt-val">${number}</td></tr>`,
    `<tr><td class="dt-label">Date Issued</td><td class="dt-val">${fmtDate(createdAt)}</td></tr>`,
    dueDate    ? `<tr><td class="dt-label">Due Date</td><td class="dt-val">${fmtDate(dueDate)}</td></tr>` : "",
    validUntil ? `<tr><td class="dt-label">Valid Until</td><td class="dt-val">${fmtDate(validUntil)}</td></tr>` : "",
    termsLabel ? `<tr><td class="dt-label">Payment Terms</td><td class="dt-val">${termsLabel}</td></tr>` : "",
  ].filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${docLabel} #${number}</title>
  <style>
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

    @page { size: A4 portrait; margin: 0; }

    html, body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 12mm 14mm 14mm;
      min-height: 297mm;
    }

    /* ── Header band ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      margin-bottom: 24px;
      border-bottom: 3px solid #2563eb;
    }
    .co-block { display: flex; flex-direction: column; gap: 2px; }
    .logo { max-height: 60px; max-width: 180px; object-fit: contain; margin-bottom: 8px; display: block; }
    .co-wordmark { font-size: 24px; font-weight: 900; color: #2563eb; letter-spacing: -0.5px; margin-bottom: 6px; }
    .co-name-under { font-size: 12.5px; font-weight: 700; color: #222; margin-bottom: 4px; }
    .co-detail { font-size: 11px; color: #666; line-height: 1.8; }

    .doc-block { text-align: right; }
    .doc-type {
      font-size: 30px; font-weight: 900; color: #111;
      letter-spacing: 4px; text-transform: uppercase; line-height: 1;
    }
    .doc-num { font-size: 12px; color: #999; margin-top: 6px; letter-spacing: 0.5px; }
    .status-badge {
      display: inline-block; margin-top: 10px;
      padding: 4px 14px; border-radius: 20px;
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1px;
      background: ${bg}; color: ${fg};
    }

    /* ── Subject line ── */
    .subject-row {
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 1px dashed #e5e7eb;
    }
    .subject-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #bbb; margin-bottom: 4px; }
    .subject-text { font-size: 16px; font-weight: 700; color: #111; }

    /* ── Bill-to / Details row ── */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }
    .meta-card {
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .mc-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #bbb; margin-bottom: 10px; }
    .bt-name { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 3px; }
    .bt-line { font-size: 11.5px; color: #555; line-height: 1.8; }

    /* Details table inside meta-card */
    .dt { width: 100%; border-collapse: collapse; }
    .dt-label { font-size: 11px; color: #999; padding: 3px 12px 3px 0; white-space: nowrap; vertical-align: top; }
    .dt-val   { font-size: 11.5px; font-weight: 600; color: #111; padding: 3px 0; text-align: right; }

    /* ── Line items ── */
    .items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .items thead tr {
      background: #2563eb;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .items th {
      padding: 9px 12px; text-align: left;
      font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px;
      color: #fff;
    }
    .items th.th-right  { text-align: right; }
    .items th.th-center { text-align: center; }
    .items tbody tr { border-bottom: 1px solid #f0f0f0; }
    .items tbody tr:last-child { border-bottom: 2px solid #e0e0e0; }
    .row-alt { background: #fafafa; }
    .items td { padding: 9px 12px; font-size: 12.5px; color: #333; vertical-align: top; }
    .td-desc   { color: #222; max-width: 260px; }
    .td-center { text-align: center; }
    .td-right  { text-align: right; }
    .td-bold   { font-weight: 700; color: #111; }

    /* ── Totals ── */
    .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 28px; }
    .totals { width: 260px; border-collapse: collapse; }
    .totals td { padding: 5px 0; font-size: 12.5px; }
    .totals td:first-child { color: #666; }
    .totals td:last-child  { text-align: right; font-weight: 500; color: #333; }
    .totals .sep td { border-top: 1px solid #e5e7eb; padding-top: 10px; }
    .totals .grand td {
      font-size: 17px; font-weight: 800; color: #111;
      border-top: 2px solid #2563eb; padding-top: 10px;
    }

    /* ── Notes ── */
    .notes {
      background: #fff8f5; border-left: 4px solid #2563eb;
      padding: 12px 16px; border-radius: 4px; margin-bottom: 32px;
    }
    .notes-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #2563eb; margin-bottom: 6px; }
    .notes p { font-size: 12px; color: #444; line-height: 1.7; }

    /* ── Footer ── */
    .footer {
      text-align: center; color: #bbb; font-size: 10px;
      padding-top: 16px; border-top: 1px solid #eee;
      line-height: 1.8;
    }

    /* ── Screen preview ── */
    @media screen {
      body { background: #e5e7eb; }
      .page {
        background: #fff;
        box-shadow: 0 4px 32px rgba(0,0,0,.12);
        margin: 24px auto;
        border-radius: 6px;
      }
    }

    @media print {
      html, body { background: #fff !important; }
      .page { margin: 0; padding: 12mm 14mm 14mm; box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="co-block">
      ${logoHtml}
      ${companyLogo ? `<div class="co-name-under">${companyName}</div>` : ""}
      <div class="co-detail">
        ${companyAddress ? `${companyAddress}<br>` : ""}
        ${companyCityLine ? `${companyCityLine}<br>` : ""}
        ${companyPhone   ? `${companyPhone}<br>` : ""}
        ${companyEmail   ? `${companyEmail}<br>` : ""}
        ${companyWebsite ? `${companyWebsite}` : ""}
      </div>
    </div>
    <div class="doc-block">
      <div class="doc-type">${docLabel}</div>
      <div class="doc-num"># ${number}</div>
      <div><span class="status-badge">${statusLabel(status)}</span></div>
    </div>
  </div>

  ${title ? `
  <div class="subject-row">
    <div class="subject-label">Subject</div>
    <div class="subject-text">${title}</div>
  </div>` : ""}

  <!-- Bill To / Details -->
  <div class="meta-grid">
    <div class="meta-card">
      <div class="mc-label">Bill To</div>
      ${billRows}
    </div>
    <div class="meta-card">
      <div class="mc-label">Details</div>
      <table class="dt">
        ${detailRows}
      </table>
    </div>
  </div>

  <!-- Line Items -->
  <table class="items">
    <thead>
      <tr>
        <th>Description</th>
        <th class="th-center" style="width:56px">Qty</th>
        <th class="th-right"  style="width:110px">Unit Price</th>
        <th class="th-right"  style="width:110px">Amount</th>
      </tr>
    </thead>
    <tbody>${lineItemsHtml}</tbody>
  </table>

  <!-- Totals -->
  <div class="totals-wrap">
    <table class="totals">
      <tr><td>Subtotal</td><td>${fmt$(subtotal)}</td></tr>
      <tr><td>Tax</td><td>${fmt$(tax)}</td></tr>
      <tr class="sep"><td></td><td></td></tr>
      <tr class="grand"><td>Total</td><td>${fmt$(total)}</td></tr>
    </table>
  </div>

  ${notes ? `
  <div class="notes">
    <div class="notes-label">Notes</div>
    <p>${notes}</p>
  </div>` : ""}

  <!-- Footer -->
  <div class="footer">
    <p>Thank you for your business!</p>
    ${companyWebsite ? `<p>${companyWebsite}</p>` : ""}
  </div>

</div>
</body>
</html>`;
}
