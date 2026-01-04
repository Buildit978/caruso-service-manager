//  /src/utils/invoicePdf.ts
import PDFDocument from "pdfkit";

export async function buildInvoicePdfBuffer(args: {
  invoice: any;
  customer?: any;
}): Promise<Buffer> {
  const { invoice, customer } = args;

  const doc = new PDFDocument({ size: "LETTER", margin: 50 });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const money = (n: any) => Number(n ?? 0).toFixed(2);

  // ---- Header
  const invoiceNumber = invoice.invoiceNumber ?? String(invoice._id).slice(-6);
  doc.fontSize(20).text("INVOICE", { align: "right" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Invoice #: ${invoiceNumber}`, { align: "right" });

  if (invoice.issueDate) {
    doc.text(`Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, { align: "right" });
  }
  if (invoice.dueDate) {
    doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, { align: "right" });
  }

  doc.moveDown(1);

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
