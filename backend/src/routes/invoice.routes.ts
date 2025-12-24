// backend/src/routes/invoices.routes.ts
import { Types } from "mongoose";
import { Router, type Request, type Response, type NextFunction } from "express";
import { WorkOrder } from "../models/workOrder.model";
import { Invoice } from "../models/invoice.model";
import { attachAccountId } from "../middleware/account.middleware";
import { Vehicle } from "../models/vehicle.model";
import { Customer }   from "../models/customer.model";
import PDFDocument from "pdfkit";
import { buildInvoicePdfBuffer } from "../utils/invoicePdf";
import { getMailer } from "../utils/mailer";





const router = Router();

router.get("/__ping", (_req, res) => {
  res.json({ ok: true, where: "invoice.routes.ts" });
});



router.use(attachAccountId);

// backend/src/routes/invoices.routes.ts

/**
  * Generate the next invoice number for a given account.
 */
async function getNextInvoiceNumber(accountId: Types.ObjectId): Promise<string> {
  const [lastInvoice] = await Invoice.aggregate<{ invoiceNumberInt: number }>([
    { $match: { accountId } },
    {
      $addFields: {
        invoiceNumberInt: {
          $convert: {
            input: "$invoiceNumber",
            to: "int",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $match: { invoiceNumberInt: { $ne: null } } },
    { $sort: { invoiceNumberInt: -1 } },
    { $limit: 1 },
  ]);

  const start = 1001;
  const lastNum =
    typeof lastInvoice?.invoiceNumberInt === "number"
      ? lastInvoice.invoiceNumberInt
      : null;

  let next = lastNum !== null ? lastNum + 1 : start;

  // Protect against duplicate key errors if a number was reused anywhere
  while (await Invoice.exists({ accountId, invoiceNumber: String(next) })) {
  next += 1;
}

  return String(next);
}



/**
 * POST /api/invoices/from-work-order/:id
 *
 * Create an invoice from a work order:
 * - Snapshot line items, tax, totals
 * - Snapshot customer + vehicle
 * - Generate invoiceNumber
 * - Mark work order as "invoiced"
 */
// POST /api/invoices/from-work-order/:workOrderId
router.post(
  "/from-work-order/:workOrderId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const { workOrderId } = req.params;

      console.log("[invoice] accountId:", accountId.toString());
      console.log("[invoice] workOrderId param:", workOrderId);

      // debug: see if the work order exists at all, and what accountId it has
      const woById = await WorkOrder.findById(workOrderId).lean();
      console.log("[invoice] debug woById:", {
        exists: !!woById,
        id: woById?._id?.toString(),
        accountId: woById?.accountId?.toString(),
        status: woById?.status,
      });


      // 1) Load work order with customer populated, scoped by account
      const workOrder = await WorkOrder.findOne({
        _id: workOrderId,
        accountId,
      }).populate(
        "customerId",
        "firstName lastName phone email address vehicles"
      );

      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      // 2) Enforce allowed statuses for invoicing
      const allowedStatuses = ["open", "in_progress", "completed"];
      if (!allowedStatuses.includes(workOrder.status)) {
        return res.status(400).json({
          message: `Cannot create invoice from work order with status "${workOrder.status}".`,
        });
      }
       
      // 🔒 2b) PREVENT DUPLICATE INVOICES FOR THIS WORK ORDER
      const existingInvoice = await Invoice.findOne({
        accountId,
        workOrderId: workOrder._id,
      }).lean();

      if (existingInvoice) {
        return res.status(400).json({
          message: "An invoice already exists for this work order.",
          invoiceId: existingInvoice._id,
          invoiceNumber: existingInvoice.invoiceNumber,
        });
      }
      

      // 3) Ensure we have a customer
      const customer: any = workOrder.customerId;
      if (!customer || !customer._id) {
        return res
          .status(400)
          .json({ message: "Work order has no valid customer" });
      }

      // 4) Normalize line items and money fields
      const rawLineItems: any[] = Array.isArray(workOrder.lineItems)
        ? workOrder.lineItems
        : [];

      const normalizedLineItems = rawLineItems.map((item: any) => {
        const quantity = Number(item?.quantity) || 0;
        const unitPrice = Number(item?.unitPrice) || 0;
        const lineTotal =
          typeof item?.lineTotal === "number"
            ? item.lineTotal
            : quantity * unitPrice;

        return {
          type: item?.type,
          description: item?.description ?? "",
          quantity,
          unitPrice,
          lineTotal,
        };
      });

      const subtotal =
        typeof (workOrder as any).subtotal === "number"
          ? (workOrder as any).subtotal
          : normalizedLineItems.reduce(
            (sum: number, item: any) => sum + (item.lineTotal || 0),
            0
          );

      const taxRate =
        typeof (workOrder as any).taxRate === "number" &&
          !Number.isNaN((workOrder as any).taxRate)
          ? (workOrder as any).taxRate
          : 13;

      const taxAmount =
        typeof (workOrder as any).taxAmount === "number"
          ? (workOrder as any).taxAmount
          : subtotal * (taxRate / 100);

      const total =
        typeof (workOrder as any).total === "number"
          ? (workOrder as any).total
          : subtotal + taxAmount;

      // 5) Build snapshots
      // 5) Build snapshots
      const customerSnapshot = {
        customerId: customer._id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      };

      // 🔍 NEW: pull the first vehicle for this customer from the Vehicle collection
      let vehicleSnapshot: any = undefined;

      const vehicles = await Vehicle.find({
        accountId,
        customerId: customer._id,
      })
        .sort({ createdAt: 1 }) // oldest first, or change to -1 for most recent
        .limit(1)
        .lean();

      const primaryVehicle = vehicles[0];

      if (primaryVehicle) {
        vehicleSnapshot = {
          vehicleId: primaryVehicle._id.toString(),
          year: primaryVehicle.year,
          make: primaryVehicle.make,
          model: primaryVehicle.model,
          vin: primaryVehicle.vin,
          licensePlate: primaryVehicle.licensePlate,
          color: primaryVehicle.color,
          notes: primaryVehicle.notes,
        };
      }


      // 6) Generate invoice number + dates
      const invoiceNumber = await getNextInvoiceNumber(accountId);
      const issueDate = new Date();

      let dueDate: Date | undefined;
      if (req.body.dueDate) {
        const parsed = new Date(req.body.dueDate);
        if (!Number.isNaN(parsed.getTime())) {
          dueDate = parsed;
        }
      }
      if (!dueDate) {
        dueDate = new Date(issueDate.getTime());
        dueDate.setDate(issueDate.getDate() + 30);
      }

      // 7) Create invoice
      const invoice = await Invoice.create({
        accountId,
        invoiceNumber,
        status: "sent",
        workOrderId: workOrder._id,
        customerId: customer._id,
        customerSnapshot,
        vehicleSnapshot,
        issueDate,
        dueDate,
        lineItems: normalizedLineItems,
        subtotal,
        taxRate,
        taxAmount,
        total,
        notes: req.body.notes ?? workOrder.notes,
      });

      // 8) Update work order status -> invoiced
      workOrder.status = "invoiced";
      workOrder.invoiceId = invoice._id;
      await workOrder.save();

      return res.status(201).json(invoice);
    } catch (err: any) {
      console.error("[invoice] Create from work order failed:", err);

      if (err?.code === 11000) {
        return res.status(400).json({
          message: "Duplicate key error while creating invoice.",
          details: err.keyValue ?? null,
        });
      }

      return res.status(500).json({
        message: "Failed to create invoice.",
        error: err?.message ?? null,
      });
    }
  }
);


// GET /api/invoices/__ping  (put this ABOVE any :id routes)
router.get("/__ping", (_req, res) => res.json({ ok: true }));

// POST /api/invoices/:id/email
router.post("/:id/email", async (req, res, next) => {
  console.log("🔥 [InvoiceEmail] STEP 1: route entered");
  console.log("[InvoiceEmail] HIT", req.params.id, req.body);
  console.log("🔥 [InvoiceEmail] AFTER HIT - about to verify/send");

  try {
    console.log("🔥 [InvoiceEmail] STEP 2: inside try");

    const accountId = req.accountId;
    console.log("🔥 [InvoiceEmail] STEP 3: accountId", accountId);

    if (!accountId) return res.status(400).json({ message: "Missing accountId" });


    const { id } = req.params;
    console.log("🔥 [InvoiceEmail] STEP 4: id", id);

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid invoice id" });
    }

   

    const { to, message } = req.body as { to?: string; message?: string };
    console.log("🔥 [InvoiceEmail] STEP 5: to", to);

    console.log("[InvoiceEmail] ROUTE HIT", { id, to });
    


    if (!to || !to.includes("@")) {
      return res.status(400).json({ message: "Missing/invalid recipient email (to)" });
    }

    // Load invoice (account-scoped)
    const invoice = await Invoice.findOne({ _id: id, accountId }).lean();
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // Optional: pull customer (if you store customerId)
    let customer: any = null;
    const custId: any = (invoice as any).customerId;
    if (custId && Types.ObjectId.isValid(String(custId))) {
      customer = await Customer.findOne({ _id: custId, accountId }).lean();
    }

    // Build PDF buffer
    const pdfBuffer = await buildInvoicePdfBuffer({ invoice, customer });

    const invoiceNumber = (invoice as any).invoiceNumber ?? String((invoice as any)._id).slice(-6);

    const filename = `invoice-${invoiceNumber}.pdf`;

    console.log("🔥 [InvoiceEmail] STEP 6: before getMailer()");
    // Send email
    const transporter = getMailer();

    // IMPORTANT: For debugging, force FROM to match the authenticated user
    const from = process.env.SMTP_USER!;
    // Later you can revert to:
    // const from = process.env.INVOICE_FROM_EMAIL || process.env.SMTP_USER!;


    const subject = `Invoice #${invoiceNumber}`;
    const text =
      message?.trim() ||
      `Attached is your invoice #${invoiceNumber}.`;

    

    console.log("🔥 [InvoiceEmail] STEP 8: before sendMail()");
     const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });


    console.log("🔥 [InvoiceEmail] STEP 9: after sendMail()");
    console.log("[InvoiceEmail] accepted:", info.accepted);
    console.log("[InvoiceEmail] rejected:", info.rejected);
    console.log("[InvoiceEmail] response:", info.response);

    // Only call success if SMTP accepted at least one recipient
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    if (accepted.length === 0) {
      return res.status(502).json({
        message: "SMTP did not accept any recipients.",
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      });
    }


    console.log("✅ [InvoiceEmail] END - sending response to client");

    return res.json({ ok: true, accepted, messageId: info.messageId });
  } catch (err) {
    console.error("[InvoiceEmail] ERROR", err);
    return res.status(500).json({ message: "Email failed", error: String(err) });
  }
});

router.get("/__ping", (_req, res) => res.json({ ok: true }));


/**
 * GET /api/invoices
 * List invoices (newest first)
 */
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      
       const accountId = req.accountId; // My accountId Edit 
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const filters = { accountId };

      const invoices = await Invoice.find(filters)
        .sort({ createdAt: -1 })
        .populate("customerId", "firstName lastName")
        .populate("workOrderId", "status")
        .lean();

      res.json(invoices);
    } catch (err) {
      next(err);
    }
  }
);


// GET /api/invoices/__ping  (put this ABOVE any :id routes)
router.get("/__ping", (_req, res) => res.json({ ok: true }));
/**
 * GET /api/invoices/:id
 * Fetch a single invoice
 */
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {

      const accountId = req.accountId;  // My accountId Edit 
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      console.log("[invoice GET] accountId:", accountId.toString());
      console.log("[invoice GET] invoiceId param:", req.params.id);
      
      const invoice = await Invoice.findOne({
        _id: req.params.id,
        accountId,
      })
        .populate("customerId", "firstName lastName phone email address vehicles")
        .populate("workOrderId", "status")
        .lean();

      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      res.json(invoice);
    } catch (err) {
      next(err);
    }
  }
);


// GET /api/invoices/__ping  (put this ABOVE any :id routes)
router.get("/__ping", (_req, res) => res.json({ ok: true }));

// GET /api/invoices/:id/pdf
router.get("/:id/pdf", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid invoice id" });
    }

    // ✅ Account-scoped invoice lookup
    const invoice = await Invoice.findOne({ _id: id, accountId })
      .populate("customerId") // if you store customerId as ref
      .lean();

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const invoiceNumber = invoice.invoiceNumber ?? String(invoice._id).slice(-6);
    const filename = `invoice-${invoiceNumber}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    doc.pipe(res);

    // ---------
    // Minimal PDF layout (v1)
    // ---------

    // Header
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

    // Bill To (customer)
    const customer: any = (invoice as any).customerId; // populated
    const customerName =
      customer?.name ||
      customer?.fullName ||
      `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
      "(No name)";

    doc.fontSize(12).text("Bill To:", { underline: true });
    doc.fontSize(11).text(customerName);
    if (customer?.address) doc.text(customer.address);
    if (customer?.phone) doc.text(`Phone: ${customer.phone}`);
    if (customer?.email) doc.text(`Email: ${customer.email}`);

    doc.moveDown(1);

    // --- Vehicle (from invoice) ---
const vehicle: any =
  (invoice as any).vehicleSnapshot ??
  (invoice as any).vehicle ??
  null;

if (vehicle) {
  const vehicleLine = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
  ]
    .filter(Boolean)
    .join(" ");

  doc.moveDown(0.75);
  doc.fontSize(12).text("Vehicle:", { underline: true });
  doc.fontSize(11).text(vehicleLine || "(Vehicle)");
  if (vehicle.licensePlate) doc.text(`Plate: ${vehicle.licensePlate}`);
  if (vehicle.vin) doc.text(`VIN: ${vehicle.vin}`);
  if (vehicle.color) doc.text(`Color: ${vehicle.color}`);
}


    // Line Items table (very simple)
    doc.fontSize(12).text("Items:", { underline: true });
    doc.moveDown(0.5);

    const items = (invoice.lineItems ?? []) as any[];

    const money = (n: any) => Number(n ?? 0).toFixed(2);

    // Table header
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

    doc.moveDown(0.5);

    // Totals (use invoice totals if present, else compute)
    const subtotal =
      typeof (invoice as any).subtotal === "number"
        ? (invoice as any).subtotal
        : items.reduce((s, it) => s + (Number(it.lineTotal) || (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)), 0);

    const taxAmount =
      typeof (invoice as any).taxAmount === "number"
        ? (invoice as any).taxAmount
        : Number((invoice as any).taxRate ?? 13) / 100 * subtotal;

    const total =
      typeof (invoice as any).total === "number"
        ? (invoice as any).total
        : subtotal + taxAmount;

    doc.fontSize(11).text(`Subtotal: $${money(subtotal)}`, { align: "right" });
    doc.text(`Tax: $${money(taxAmount)}`, { align: "right" });
    doc.fontSize(12).text(`Total: $${money(total)}`, { align: "right" });

    // Notes
    if ((invoice as any).notes) {
      doc.moveDown(1);
      doc.fontSize(11).text("Notes:", { underline: true });
      doc.fontSize(10).text(String((invoice as any).notes));
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

export default router;
