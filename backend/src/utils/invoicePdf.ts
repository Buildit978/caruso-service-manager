//  /src/utils/invoicePdf.ts
import PDFDocument from "pdfkit";

export async function buildInvoicePdfBuffer(args: {
  invoice: any;
  customer?: any;
  settings?: any;
}): Promise<Buffer> {
  const { invoice, customer, settings } = args;

  const doc = new PDFDocument({ size: "LETTER", margin: 50 });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const money = (n: any) => Number(n ?? 0).toFixed(2);

  const profile = invoice.invoiceProfileSnapshot ?? settings?.invoiceProfile ?? {};
  const shopName = profile.shopName || settings?.shopName || "Invoice";
  const startY = 50;
  const pageWidth = 612;
  const rightWidth = pageWidth - 100;

  // ---- Shop header (left) at fixed positions
  let leftY = startY;
  doc.fontSize(14).font("Helvetica-Bold").text(shopName, 50, leftY);
  leftY += 16;
  doc.font("Helvetica").fontSize(10);
  if (profile.address) {
    doc.text(profile.address, 50, leftY);
    leftY += 14;
  }
  if (profile.phone) {
    doc.text(`Phone: ${profile.phone}`, 50, leftY);
    leftY += 14;
  }
  if (profile.email) {
    doc.text(profile.email, 50, leftY);
    leftY += 14;
  }
  if (profile.taxId) {
    doc.text(`Tax ID: ${profile.taxId}`, 50, leftY);
    leftY += 14;
  }
  const leftBottom = leftY;

  // ---- Invoice header (right)
  doc.y = startY;
  doc.fillColor("#111111");
  const invoiceNumber = invoice.invoiceNumber ?? String(invoice._id).slice(-6);
  doc.fontSize(20).text("INVOICE", 50, startY, { align: "right", width: rightWidth });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Invoice #: ${invoiceNumber}`, { align: "right" });

    const finStatus = String(invoice.financialStatus ?? "").toLowerCase();
  if (finStatus === "partial") {
    doc.moveDown(0.2);
    doc.fontSize(12).fillColor("#b45309").text("STATEMENT", { align: "right" });
    doc.fillColor("#111111"); // reset
  }


  if (invoice.issueDate) {
    doc.text(`Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, { align: "right" });
  }
  if (invoice.dueDate) {
    doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, { align: "right" });
  }

      // ---- Payments summary (truth from backend fields)
  const totalAmt = Number(invoice.total ?? 0);
  const paidAmt = Number(invoice.paidAmount ?? 0);
  const balanceAmt =
    invoice.balanceDue != null
      ? Number(invoice.balanceDue)
      : Math.max(0, totalAmt - paidAmt);

  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#111111").text(`Total: ${money(totalAmt)}`, { align: "right" });
  doc.text(`Paid: ${money(paidAmt)}`, { align: "right" });

  doc.font("Helvetica-Bold").text(`Balance Due: ${money(balanceAmt)}`, { align: "right" });
  doc.font("Helvetica"); // reset


    // ---- Payment history (tiny, last 5)
  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
  if (payments.length > 0) {
    const sorted = [...payments].sort((a, b) => {
      const da = new Date(a?.createdAt ?? a?.date ?? 0).getTime();
      const db = new Date(b?.createdAt ?? b?.date ?? 0).getTime();
      return db - da; // newest first
    });

    const recent = sorted.slice(0, 5);

    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text("Payment History", { align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor("#374151");

    for (const p of recent) {
      const amt = Number(p?.amount ?? 0);
      const method = String(p?.method ?? "").toUpperCase();
      const ref = String(p?.reference ?? "").trim();

      const dtRaw = p?.createdAt ?? p?.date;
      const dt = dtRaw ? new Date(dtRaw) : null;
      const dtText = dt ? dt.toLocaleDateString() : "";

      const lineParts = [
        dtText,
        method ? method : null,
        `$${money(amt)}`,
        ref ? `(${ref})` : null,
      ].filter(Boolean);

      doc.text(lineParts.join(" "), { align: "right" });
    }

    doc.fillColor("#111111"); // reset
  }

  const finStatusPaidInFull = String(invoice.financialStatus ?? "").toLowerCase();
  if (finStatusPaidInFull === "paid") {
    doc.moveDown(0.2);
    doc.fontSize(15).fillColor("#16a34a").text("PAID IN FULL", { align: "right" });
    doc.fillColor("#111111");
  }

  const headerBottom = doc.y;
  doc.y = Math.max(leftBottom, headerBottom) + 16;

  // ---- Bill To
  const cust = customer ?? (invoice as any).customerId;
  const customerName =
    cust?.name ||
    cust?.fullName ||
    `${cust?.firstName ?? ""} ${cust?.lastName ?? ""}`.trim() ||
    "(No name)";

  doc.fontSize(12).text("Bill To:", { underline: true });
  doc.fontSize(11).text(customerName);
  if (cust?.address) doc.text(cust.address);
  if (cust?.phone) doc.text(`Phone: ${cust.phone}`);
  if (cust?.email) doc.text(`Email: ${cust.email}`);

  // ---- Vehicle (you confirmed invoice has it)
  const vehicle: any = invoice.vehicleSnapshot ?? invoice.vehicle ?? null;
  if (vehicle) {
    const vehicleLine = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
    doc.moveDown(0.75);
    doc.fontSize(12).text("Vehicle:", { underline: true });
    doc.fontSize(11).text(vehicleLine || "(Vehicle)");
    if (vehicle.licensePlate) doc.text(`Plate: ${vehicle.licensePlate}`);
    if (vehicle.vin) doc.text(`VIN: ${vehicle.vin}`);
    if (vehicle.color) doc.text(`Color: ${vehicle.color}`);
  }

  doc.moveDown(1);

  // ---- Line items
  doc.fontSize(12).text("Items:", { underline: true });
  doc.moveDown(0.5);

  const items = (invoice.lineItems ?? []) as any[];

  doc.fontSize(10).text("Description", 50, doc.y, { continued: true });
  doc.text("Qty", 330, doc.y, { width: 50, align: "right", continued: true });
  doc.text("Unit", 390, doc.y, { width: 70, align: "right", continued: true });
  doc.text("Total", 0, doc.y, { align: "right" });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
  doc.moveDown(0.5);

  items.forEach((it) => {
    const desc = it.description || it.type || "";
    const qty = Number(it.quantity ?? 0);
    const unit = Number(it.unitPrice ?? 0);
    const total = typeof it.lineTotal === "number" ? it.lineTotal : qty * unit;

    const y = doc.y;
    doc.fontSize(10).text(desc, 50, y, { width: 270 });
    doc.text(qty ? String(qty) : "", 330, y, { width: 50, align: "right" });
    doc.text(qty ? `$${money(unit)}` : "", 390, y, { width: 70, align: "right" });
    doc.text(`$${money(total)}`, 0, y, { align: "right" });
    doc.moveDown(0.6);
  });

  const subtotal =
    typeof invoice.subtotal === "number"
      ? invoice.subtotal
      : items.reduce((s, it) => s + (Number(it.lineTotal) || (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)), 0);

  const taxAmount =
    typeof invoice.taxAmount === "number"
      ? invoice.taxAmount
      : (Number(invoice.taxRate ?? 13) / 100) * subtotal;

  const total =
    typeof invoice.total === "number" ? invoice.total : subtotal + taxAmount;

  doc.moveDown(0.5);
  doc.fontSize(11).text(`Subtotal: $${money(subtotal)}`, { align: "right" });
  doc.text(`Tax: $${money(taxAmount)}`, { align: "right" });
  doc.fontSize(12).text(`Total: $${money(total)}`, { align: "right" });

    if (invoice.notes) {
    doc.moveDown(1);

    const left = doc.page.margins.left; // should be 50 based on your doc settings
    const right = doc.page.margins.right; // 50
    const contentWidth = doc.page.width - left - right;

    doc.fontSize(11).text("Notes:", left, doc.y, { underline: true });
    doc.moveDown(0.2);

    doc.fontSize(10).text(String(invoice.notes), left, doc.y, {
      width: contentWidth,
      lineGap: 2,
    });
  }


  doc.end();
  return done;
}
