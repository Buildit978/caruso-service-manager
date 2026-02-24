// backend/src/utils/estimatePdf.ts
import PDFDocument from "pdfkit";

export interface EstimateSentSnapshot {
  customer: { firstName: string; lastName: string; email?: string; phone?: string };
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
    licensePlate?: string;
    vin?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  customerNotes?: string;
}

export async function buildEstimatePdfBuffer(args: {
  estimate: { estimateNumber: string; sentAt?: Date | string };
  sentSnapshot: EstimateSentSnapshot;
  settings?: { shopName?: string; invoiceProfile?: { shopName?: string } };
}): Promise<Buffer> {
  const { estimate, sentSnapshot, settings } = args;

  const doc = new PDFDocument({ size: "LETTER", margin: 50 });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const money = (n: any) => Number(n ?? 0).toFixed(2);

  const profile = settings?.invoiceProfile ?? {};
  const shopName = profile.shopName || settings?.shopName || "Estimate";
  const startY = 50;
  const pageWidth = 612;
  const rightWidth = pageWidth - 100;

  // ---- Shop header (left)
  let leftY = startY;
  doc.fontSize(14).font("Helvetica-Bold").text(shopName, 50, leftY);
  leftY += 16;
  doc.font("Helvetica").fontSize(10);
  const p = profile as { address?: string; phone?: string; email?: string; taxId?: string };
  if (p.address) {
    doc.text(p.address, 50, leftY);
    leftY += 14;
  }
  if (p.phone) {
    doc.text(`Phone: ${p.phone}`, 50, leftY);
    leftY += 14;
  }
  if (p.email) {
    doc.text(p.email, 50, leftY);
    leftY += 14;
  }
  if (p.taxId) {
    doc.text(`Tax ID: ${p.taxId}`, 50, leftY);
    leftY += 14;
  }
  const leftBottom = leftY;

  // ---- Estimate header (right)
  doc.y = startY;
  doc.fillColor("#111111");
  const estimateNumber = estimate.estimateNumber ?? "—";
  doc.fontSize(20).text("ESTIMATE", 50, startY, { align: "right", width: rightWidth });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Estimate #: ${estimateNumber}`, { align: "right" });

  if (estimate.sentAt) {
    doc.text(
      `Sent: ${new Date(estimate.sentAt).toLocaleDateString()}`,
      { align: "right" }
    );
  }

  const headerBottom = doc.y;
  doc.y = Math.max(leftBottom, headerBottom) + 16;

  // ---- Customer
  const cust = sentSnapshot.customer;
  const customerName =
    `${cust?.firstName ?? ""} ${cust?.lastName ?? ""}`.trim() || "(No name)";

  doc.fontSize(12).text("Customer:", { underline: true });
  doc.fontSize(11).text(customerName);
  if (cust?.phone) doc.text(`Phone: ${cust.phone}`);
  if (cust?.email) doc.text(`Email: ${cust.email}`);

  // ---- Vehicle
  const vehicle = sentSnapshot.vehicle;
  if (vehicle) {
    const vehicleLine = [vehicle.year, vehicle.make, vehicle.model]
      .filter(Boolean)
      .join(" ");
    doc.moveDown(0.75);
    doc.fontSize(12).text("Vehicle:", { underline: true });
    doc.fontSize(11).text(vehicleLine || "(Vehicle)");
    if (vehicle.licensePlate) doc.text(`Plate: ${vehicle.licensePlate}`);
    if (vehicle.vin) doc.text(`VIN: ${vehicle.vin}`);
  }

  doc.moveDown(1);

  // ---- Line items
  doc.fontSize(12).text("Items:", { underline: true });
  doc.moveDown(0.5);

  const items = sentSnapshot.items ?? [];

  doc.fontSize(10).text("Description", 50, doc.y, { continued: true });
  doc.text("Qty", 330, doc.y, { width: 50, align: "right", continued: true });
  doc.text("Unit", 390, doc.y, { width: 70, align: "right", continued: true });
  doc.text("Total", 0, doc.y, { align: "right" });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
  doc.moveDown(0.5);

  items.forEach((it) => {
    const desc = it.description ?? "";
    const qty = Number(it.quantity ?? 0);
    const unit = Number(it.unitPrice ?? 0);
    const total = Number(it.lineTotal ?? 0);

    const y = doc.y;
    doc.fontSize(10).text(desc, 50, y, { width: 270 });
    doc.text(qty ? String(qty) : "", 330, y, { width: 50, align: "right" });
    doc.text(qty ? `$${money(unit)}` : "", 390, y, { width: 70, align: "right" });
    doc.text(`$${money(total)}`, 0, y, { align: "right" });
    doc.moveDown(0.6);
  });

  const subtotal = Number(sentSnapshot.subtotal ?? 0);
  const taxRate = Number(sentSnapshot.taxRate ?? 13);
  const taxAmount = Number(sentSnapshot.taxAmount ?? 0);
  const total = Number(sentSnapshot.total ?? 0);

  doc.moveDown(0.5);
  doc.fontSize(11).text(`Subtotal: $${money(subtotal)}`, { align: "right" });
  doc.text(`Tax (${taxRate}%): $${money(taxAmount)}`, { align: "right" });
  doc.fontSize(12).text(`Total: $${money(total)}`, { align: "right" });

  if (sentSnapshot.customerNotes && String(sentSnapshot.customerNotes).trim()) {
    doc.moveDown(1);

    const left = doc.page.margins.left;
    const right = doc.page.margins.right;
    const contentWidth = doc.page.width - left - right;

    doc.fontSize(11).text("Notes:", left, doc.y, { underline: true });
    doc.moveDown(0.2);

    doc.fontSize(10).text(String(sentSnapshot.customerNotes).trim(), left, doc.y, {
      width: contentWidth,
      lineGap: 2,
    });
  }

  doc.end();
  return done;
}
