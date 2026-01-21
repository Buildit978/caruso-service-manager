// backend/src/routes/invoices.routes.ts
import { Types } from "mongoose";
import { Router, type Request, type Response, type NextFunction } from "express";
import { WorkOrder } from "../models/workOrder.model";
import Invoice from "../models/invoice.model"; // ✅ default export = runtime model
import { Vehicle } from "../models/vehicle.model";
import { Customer } from "../models/customer.model";
import { buildInvoicePdfBuffer } from "../utils/invoicePdf";
import { getMailer } from "../utils/mailer";
import { assertCanEditInvoice, assertValidInvoiceTransition, } from "../domain/invoices/invoiceLifecycle";
import { requireInvoiceEditable, requireInvoiceNotPaid, } from "../middleware/invoiceLocks";
import { applyInvoiceFinancials, computeInvoiceFinancials } from "../utils/invoiceFinancials";
import { requireRole } from "../middleware/requireRole";
import { sanitizeCustomerForActor } from "../utils/customerRedaction";

const router = Router();

/**
 * ✅ 0) Health check BEFORE middleware (useful even when auth/account not present)
 */
router.get("/__ping", (_req, res) => {
  res.json({ ok: true, where: "invoice.routes.ts" });
});

router.use(requireRole(["owner", "manager"]));

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

  while (await Invoice.exists({ accountId, invoiceNumber: String(next) })) {
    next += 1;
  }

  return String(next);
}

/**
 * ✅ 1) Static / report routes (MOST SPECIFIC FIRST)
 */

// GET /api/invoices/financial/summary
router.get(
  "/financial/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) return res.status(400).json({ message: "Missing accountId" });

      const now = new Date();
      const startDefault = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDefault = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const fromStr = typeof req.query.from === "string" ? req.query.from : "";
      const toStr = typeof req.query.to === "string" ? req.query.to : "";

      const from = fromStr ? new Date(fromStr) : startDefault;
      const to = toStr ? new Date(toStr) : endDefault;

      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return res.status(400).json({ message: "Invalid from/to date. Use YYYY-MM-DD." });
      }

      const baseMatch = { accountId };

      const [totals] = await Invoice.aggregate([
        { $match: baseMatch },
        {
          $facet: {
            // ✅ Paid = canonical (status is only set to paid when balanceDue hits 0 in our backend logic)
            // ✅ Paid Revenue = sum of PAYMENTS in range (counts partials + deposits)
              revenuePaid: [
                // never count void invoices as paid revenue
                { $match: { status: { $ne: "void" } } },

                // unwind payments and filter by paidAt range
                { $unwind: "$payments" },
                { $match: { "payments.paidAt": { $gte: from, $lt: to } } },

                // group by invoice first (so count = number of invoices with at least one payment in range)
                {
                  $group: {
                    _id: "$_id",
                    amount: { $sum: "$payments.amount" },
                  },
                },

                // now compute totals
                {
                  $group: {
                    _id: null,
                    count: { $sum: 1 },          // invoices that had payments in range
                    amount: { $sum: "$amount" }, // total payments received in range
                    tax: { $sum: 0 },            // not meaningful for payments; keep 0 for now
                    subtotal: { $sum: 0 },       // not meaningful for payments; keep 0 for now
                  },
                },
              ],


            // ✅ Outstanding = sent + money still due (prevents "sent but actually paid" drift)
            outstandingSent: [
              {
                $match: {
                  status: "sent",
                  sentAt: { $exists: true },
                  balanceDue: { $gt: 0 },
                },
              },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  amount: { $sum: "$balanceDue" }, // outstanding dollars
                },
              },
            ],

            drafts: [
              { $match: { status: "draft", createdAt: { $gte: from, $lt: to } } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  amount: { $sum: "$total" },
                },
              },
            ],

            voided: [
              { $match: { status: "void", voidedAt: { $gte: from, $lt: to } } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  amount: { $sum: "$total" },
                },
              },
            ],

            // ✅ Aging only for invoices that are truly still outstanding
            aging: [
              {
                $match: {
                  status: "sent",
                  sentAt: { $exists: true },
                  balanceDue: { $gt: 0 },
                },
              },
              {
                $addFields: {
                  daysOutstanding: {
                    $dateDiff: { startDate: "$sentAt", endDate: now, unit: "day" },
                  },
                },
              },
              {
                $group: {
                  _id: {
                    $switch: {
                      branches: [
                        { case: { $lte: ["$daysOutstanding", 7] }, then: "0-7" },
                        { case: { $lte: ["$daysOutstanding", 14] }, then: "8-14" },
                        { case: { $lte: ["$daysOutstanding", 30] }, then: "15-30" },
                      ],
                      default: "31+",
                    },
                  },
                  count: { $sum: 1 },
                  amount: { $sum: "$balanceDue" }, // outstanding dollars in bucket
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
        {
          $project: {
            revenuePaid: {
              $let: {
                vars: {
                  r: {
                    $ifNull: [
                      { $arrayElemAt: ["$revenuePaid", 0] },
                      { count: 0, amount: 0, tax: 0, subtotal: 0 },
                    ],
                  },
                },
                in: {
                  count: "$$r.count",
                  amount: { $round: ["$$r.amount", 2] },
                  tax: { $round: ["$$r.tax", 2] },
                  subtotal: { $round: ["$$r.subtotal", 2] },
                },
              },
            },

            outstandingSent: {
              $let: {
                vars: {
                  o: {
                    $ifNull: [{ $arrayElemAt: ["$outstandingSent", 0] }, { count: 0, amount: 0 }],
                  },
                },
                in: {
                  count: "$$o.count",
                  amount: { $round: ["$$o.amount", 2] },
                },
              },
            },

            drafts: {
              $let: {
                vars: {
                  d: { $ifNull: [{ $arrayElemAt: ["$drafts", 0] }, { count: 0, amount: 0 }] },
                },
                in: {
                  count: "$$d.count",
                  amount: { $round: ["$$d.amount", 2] },
                },
              },
            },

            voided: {
              $let: {
                vars: {
                  v: { $ifNull: [{ $arrayElemAt: ["$voided", 0] }, { count: 0, amount: 0 }] },
                },
                in: {
                  count: "$$v.count",
                  amount: { $round: ["$$v.amount", 2] },
                },
              },
            },

            aging: {
              $map: {
                input: "$aging",
                as: "a",
                in: {
                  _id: "$$a._id",
                  count: "$$a.count",
                  amount: { $round: ["$$a.amount", 2] },
                },
              },
            },
          },
        },
      ]);

      return res.json({
        range: { from: from.toISOString(), to: to.toISOString() },
        revenuePaid: totals?.revenuePaid ?? { count: 0, amount: 0, tax: 0, subtotal: 0 },
        outstandingSent: totals?.outstandingSent ?? { count: 0, amount: 0 },
        drafts: totals?.drafts ?? { count: 0, amount: 0 },
        voided: totals?.voided ?? { count: 0, amount: 0 },
        aging: totals?.aging ?? [],
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * ✅ 2) Collection routes
 */

// GET /api/invoices (list)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const invoices = await Invoice.find({ accountId })
      .sort({ createdAt: -1 })
      .populate("customerId", "firstName lastName")
      .populate("workOrderId", "status")
      .lean();

    const withFinancials = invoices.map((inv: any) => {
      const fin = computeInvoiceFinancials(inv);
      return { ...inv, ...fin };
    });

    return res.json(withFinancials);
  } catch (err) {
    next(err);
  }
});



// GET /api/invoices/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid invoice id" });

    const invoice = await Invoice.findOne({ _id: id, accountId })
      .populate("customerId", "firstName lastName phone email address vehicles")
      .populate("workOrderId", "status")
      .lean();

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

/**
 * ✅ 3) Creation routes (specific)
 */

// POST /api/invoices/from-work-order/:workOrderId
router.post(
  "/from-work-order/:workOrderId",
  async (req: Request, res: Response) => {
    try {
      const accountId = req.accountId;
      if (!accountId)
        return res.status(400).json({ message: "Missing accountId" });

      const { workOrderId } = req.params;

      const workOrder = await WorkOrder.findOne({
        _id: workOrderId,
        accountId,
      }).populate("customerId", "firstName lastName phone email address vehicles");

      if (!workOrder)
        return res.status(404).json({ message: "Work order not found" });

      // ✅ allow creating invoice from these statuses only
      const allowedStatuses = ["open", "in_progress", "completed"];
      if (!allowedStatuses.includes(workOrder.status)) {
        return res.status(400).json({
          message: `Cannot create invoice from work order with status "${workOrder.status}".`,
        });
      }

      // ✅ If invoice already exists, return it (include financialStatus)
      const existingInvoice = await Invoice.findOne({
        accountId,
        workOrderId: workOrder._id,
      })
        // include what computeInvoiceFinancials needs
        .select(
          "_id invoiceNumber status total payments paidAmount balanceDue sentAt paidAt voidedAt"
        )
        .lean();

      if (existingInvoice) {
        if (!workOrder.invoiceId) workOrder.invoiceId = existingInvoice._id as any;
        if (workOrder.status !== "invoiced") workOrder.status = "invoiced";
        await workOrder.save();

        const total = Number(existingInvoice.total ?? 0);
        const payments = Array.isArray(existingInvoice.payments)
          ? existingInvoice.payments
          : [];

        // ✅ authoritative financial truth
        const fin = computeInvoiceFinancials({ total, payments } as any);

        return res.status(200).json({
          ok: true,
          alreadyExists: true,
          invoice: {
            _id: existingInvoice._id,
            invoiceNumber: existingInvoice.invoiceNumber,

            // lifecycle (keep)
            status: existingInvoice.status,

            // financial truth (add)
            financialStatus: fin.financialStatus,

            // helpful totals (consistent with other endpoints)
            total,
            paidAmount: fin.paidAmount,
            balanceDue: fin.balanceDue,

            // timestamps if you need them in UI
            sentAt: existingInvoice.sentAt ?? null,
            paidAt: existingInvoice.paidAt ?? null,
            voidedAt: existingInvoice.voidedAt ?? null,
          },
        });
      }

      const customer: any = workOrder.customerId;
      if (!customer || !customer._id) {
        return res
          .status(400)
          .json({ message: "Work order has no valid customer" });
      }

      // ✅ normalize line items
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

      // ✅ totals
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

      // ✅ customer snapshot
      const customerSnapshot = {
        customerId: customer._id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      };

      // ✅ vehicle snapshot (kept exactly as your approach)
      let vehicleSnapshot: any = undefined;

      const vehicles = await Vehicle.find({ accountId, customerId: customer._id })
        .sort({ createdAt: 1 })
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

      const invoiceNumber = await getNextInvoiceNumber(accountId);
      const issueDate = new Date();

      let dueDate: Date | undefined;
      if (req.body.dueDate) {
        const parsed = new Date(req.body.dueDate);
        if (!Number.isNaN(parsed.getTime())) dueDate = parsed;
      }
      if (!dueDate) {
        dueDate = new Date(issueDate.getTime());
        dueDate.setDate(issueDate.getDate() + 30);
      }

      const invoice = await Invoice.create({
        accountId,
        invoiceNumber,
        status: "draft",
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

        // ✅ payments v1
        payments: [],
        paidAmount: 0,
        balanceDue: total,

        notes: req.body.notes ?? workOrder.notes,
      });

      workOrder.status = "invoiced";
      workOrder.invoiceId = invoice._id;
      await workOrder.save();

      // ✅ return invoice with computed truth attached
      const fin = computeInvoiceFinancials({ total, payments: [] } as any);

      return res.status(201).json({
        ...invoice.toObject?.() ?? invoice,
        financialStatus: fin.financialStatus,
        paidAmount: fin.paidAmount,
        balanceDue: fin.balanceDue,
      });
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

/**
 * ✅ 4) Action routes (still specific, but include :id)
 * Keep these ABOVE the generic GET/PATCH /:id.
 */

// POST /api/invoices/:id/send
router.post("/:id/send", requireInvoiceNotPaid, async (req, res, next) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid invoice id" });

    const invoice = await Invoice.findOne({ _id: id, accountId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const from = String((invoice as any).status || "draft").toLowerCase() as any;
    assertValidInvoiceTransition(from, "sent");

    const now = new Date();
    (invoice as any).status = "sent";
    (invoice as any).sentAt = (invoice as any).sentAt ?? now;

    await invoice.save();
    return res.json({ invoice });
  } catch (err) {
    next(err);
  }
});





// POST /api/invoices/:id/pay
router.post("/:id/pay", async (req, res, next) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;

    const { method, amount, reference } = req.body as {
      method: "cash" | "card" | "e-transfer" | "cheque";
      amount: number;
      reference?: string;
    };

    if (!accountId) return res.status(400).json({ message: "Missing accountId" });
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid invoice id" });

    const n = Number(amount);
    if (!method || !Number.isFinite(n) || n <= 0) {
      return res.status(400).json({ message: "Payment method + positive amount required" });
    }

    const invoice = await Invoice.findOne({ _id: id, accountId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // lifecycle only: draft|sent|void
    const lifecycle = String((invoice as any).status || "draft").toLowerCase();
    const finStatus = String((invoice as any).financialStatus || "").toLowerCase();

    // ✅ payments allowed only once sent
    if (lifecycle === "draft") {
      return res.status(400).json({ message: "Invoice must be sent before recording payment." });
    }
    if (lifecycle === "void") {
      return res.status(400).json({ message: "Cannot record payment when invoice is void." });
    }
    // block if already fully paid (financial truth)
// IMPORTANT: some older invoices may not have balanceDue stored, so compute safely.
  const finPre = computeInvoiceFinancials(invoice as any);
  const balPre =
    finPre.balanceDue != null
      ? Number(finPre.balanceDue)
      : Number((invoice as any).balanceDue); // last resort

  if (finPre.financialStatus === "paid" || (Number.isFinite(balPre) && balPre <= 0.01)) {
    return res
      .status(400)
      .json({ message: "Invoice is fully paid. No further payments can be recorded." });
  }


    // ✅ append payment
    const payment = {
      method,
      reference: (reference || "").trim(),
      amount: n,
      paidAt: new Date(),
    };

    (invoice as any).payments = Array.isArray((invoice as any).payments)
      ? (invoice as any).payments
      : [];
    (invoice as any).payments.push(payment);

    // ✅ canonical money + authoritative financial truth
    // IMPORTANT: this must NOT set invoice.status = "paid"
    applyInvoiceFinancials(invoice as any);

    await invoice.save();

    // ✅ if fully paid, also close the WorkOrder (financial truth)
    const finNow = computeInvoiceFinancials(invoice as any);
    if (finNow.financialStatus === "paid" || Number((invoice as any).balanceDue ?? 0) === 0) {
      await WorkOrder.updateOne(
        { _id: (invoice as any).workOrderId, accountId },
        { $set: { closedAt: new Date() } }
      );
    }

    // ✅ return canonical view for frontend
    return res.json({ ...invoice.toObject(), ...finNow });
  } catch (err) {
    next(err);
  }
});



// POST /api/invoices/:id/void
router.post("/:id/void", requireInvoiceNotPaid, async (req, res, next) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid invoice id" });

    const { reason } = req.body as { reason?: string };
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "Void reason is required" });
    }

    const invoice = await Invoice.findOne({ _id: id, accountId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // ✅ keep cached paidAmount/balanceDue aligned before checks
    applyInvoiceFinancials(invoice as any);

    const from = String((invoice as any).status || "draft").toLowerCase() as any;
    assertValidInvoiceTransition(from, "void");

    const now = new Date();
    (invoice as any).status = "void";
    (invoice as any).voidedAt = (invoice as any).voidedAt ?? now;
    (invoice as any).voidReason = reason.trim();

    // ✅ keep cached money fields aligned (safe even when voiding)
    applyInvoiceFinancials(invoice as any);

    await invoice.save();

    // ✅ Keep "Archive = closed financial record" consistent
    await WorkOrder.updateOne(
      { _id: (invoice as any).workOrderId, accountId },
      { $set: { closedAt: now } }
    );

    const fin = computeInvoiceFinancials(invoice as any);
    return res.json({ ...invoice.toObject(), ...fin });
  } catch (err) {
    next(err);
  }
});



// POST /api/invoices/:id/email
router.post("/:id/email", async (req, res) => {
  try {
    const accountId = req.accountId;
    if (!accountId) return res.status(400).json({ message: "Missing accountId" });

    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid invoice id" });

    const invoice = await Invoice.findOne({ _id: id, accountId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // ✅ keep cached paidAmount/balanceDue aligned (safe, no behavior change)
    applyInvoiceFinancials(invoice as any);

    let customer: any = null;
    const custId: any = (invoice as any).customerId;
    if (custId && Types.ObjectId.isValid(String(custId))) {
      customer = await Customer.findOne({ _id: custId, accountId }).lean();
    }

    const toEmail = (customer?.email || (invoice as any).customerSnapshot?.email || "").trim();
    if (!toEmail || !toEmail.includes("@")) {
      return res.status(400).json({ message: "No valid customer email found for this invoice." });
    }

    const pdfBuffer = await buildInvoicePdfBuffer({ invoice, customer });
    const invoiceNumber = (invoice as any).invoiceNumber ?? String((invoice as any)._id).slice(-6);
    const filename = `invoice-${invoiceNumber}.pdf`;

    const transporter = getMailer();
    const from = process.env.SMTP_USER!;
    const subject = `Invoice #${invoiceNumber}`;
    const text = `Attached is your invoice #${invoiceNumber}.`;

    (invoice as any).email = {
      ...((invoice as any).email ?? {}),
      status: "sending",
      lastTo: toEmail,
      lastError: "",
      attempts: (((invoice as any).email?.attempts ?? 0) + 1),
    };
    await invoice.save();

    try {
      const info = await transporter.sendMail({
        from,
        to: toEmail,
        subject,
        text,
        attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
      });

      (invoice as any).email = {
        ...((invoice as any).email ?? {}),
        status: "sent",
        lastTo: toEmail,
        lastSentAt: new Date(),
        lastMessageId: info?.messageId ?? "",
        lastError: "",
      };

      // ✅ email implies "sent" (truth stamp)
            const now = new Date();

            // ALWAYS stamp sentAt after a successful email
            (invoice as any).sentAt = (invoice as any).sentAt ?? now;

            // Only upgrade lifecycle status if still draft
            const curStatus = String((invoice as any).status || "draft").toLowerCase();
            if (curStatus === "draft") {
              (invoice as any).status = "sent";
            }


      // ✅ re-apply financials in case total/payments changed elsewhere before save
      applyInvoiceFinancials(invoice as any);

      await invoice.save();

      const fin = computeInvoiceFinancials(invoice as any);

      return res.json({
        ok: true,
        message: "Invoice emailed.",
        email: (invoice as any).email,
        status: (invoice as any).status,
        financialStatus: fin.financialStatus,
        paidAmount: fin.paidAmount,
        balanceDue: fin.balanceDue,
      });
    } catch (err: any) {
      (invoice as any).email = {
        ...((invoice as any).email ?? {}),
        status: "failed",
        lastTo: toEmail,
        lastError: err?.message ?? "Unknown email error",
      };
      await invoice.save();

      return res.status(500).json({
        ok: false,
        message: "Failed to email invoice.",
        error: (invoice as any).email?.lastError,
        email: (invoice as any).email,
      });
    }
  } catch (err: any) {
    console.error("[InvoiceEmail] ERROR", err);
    return res.status(500).json({ message: "Email failed", error: String(err) });
  }
});


/**
 * ✅ 5) Document routes
 */

// invoices.route.ts (or wherever your invoice routes are)

// GET /api/invoices/:id/pdf
router.get("/:id/pdf", async (req, res, next) => {
  try {
    const accountId = req.accountId;
    const { id } = req.params;

    // 1) Fetch invoice (scoped)
    const invoice = await Invoice.findOne({ _id: id, accountId }).lean();
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const customer = await Customer.findById(invoice.customerId).lean();
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // ✅ Attach canonical financial truth for PDF rendering
    const fin = computeInvoiceFinancials(invoice as any);
    const invoiceForPdf = { ...invoice, ...fin };

    // 2) Generate PDF buffer (reuse your existing PDF builder)
    const pdfBuffer = await buildInvoicePdfBuffer({
      invoice: invoiceForPdf,
      customer,
    });

    // 3) Stream PDF to browser
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="invoice-${invoice.invoiceNumber || id}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});



/**
 * ✅ 6) Generic mutation routes (draft-only edit)
 */

// PATCH /api/invoices/:id
router.patch(
  "/:id",
  requireInvoiceEditable,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId)
        return res.status(400).json({ message: "Missing accountId" });

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id))
        return res.status(400).json({ message: "Invalid invoice id" });

      const invoice = await Invoice.findOne({ _id: id, accountId });
      if (!invoice)
        return res.status(404).json({ message: "Invoice not found" });

      const { issueDate, dueDate, notes, taxRate, lineItems } = req.body ?? {};

      if (typeof issueDate !== "undefined")
        (invoice as any).issueDate = new Date(issueDate);

      if (typeof dueDate !== "undefined")
        (invoice as any).dueDate = dueDate ? new Date(dueDate) : undefined;

      if (typeof notes !== "undefined")
        (invoice as any).notes = String(notes);

      if (typeof taxRate !== "undefined") {
        const n = Number(taxRate);
        if (Number.isNaN(n) || n < 0)
          return res.status(400).json({ message: "taxRate must be >= 0" });
        (invoice as any).taxRate = n;
      }

      if (typeof lineItems !== "undefined") {
        if (!Array.isArray(lineItems))
          return res.status(400).json({ message: "lineItems must be an array" });
        (invoice as any).lineItems = lineItems;
      }

      // recompute totals
      const items = ((invoice as any).lineItems ?? []) as Array<{
        quantity?: number;
        unitPrice?: number;
      }>;

      const subtotal = items.reduce(
        (sum, it) => sum + Number(it.quantity ?? 0) * Number(it.unitPrice ?? 0),
        0
      );

      const rate = Number((invoice as any).taxRate ?? 0);
      const taxAmount = subtotal * rate;
      const total = subtotal + taxAmount;

      (invoice as any).subtotal = Math.max(0, subtotal);
      (invoice as any).taxAmount = Math.max(0, taxAmount);
      (invoice as any).total = Math.max(0, total);

      // ✅ canonical financial truth after total changes
      applyInvoiceFinancials(invoice as any);

      await invoice.save();

      const fin = computeInvoiceFinancials(invoice as any);
      return res.json({ ...invoice.toObject(), ...fin });
    } catch (err) {
      next(err);
    }
  }
);



/**
 * ✅ 7) Lifecycle status route
 */

// PATCH /api/invoices/:id/status
router.patch(
  "/:id/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId)
        return res.status(400).json({ message: "Missing accountId" });

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id))
        return res.status(400).json({ message: "Invalid invoice id" });

      const nextStatus = (req.body?.status || "").trim().toLowerCase();
      if (!nextStatus)
        return res.status(400).json({ message: "status is required" });

      if (nextStatus === "draft") {
        return res
          .status(400)
          .json({ message: "Reverting invoices to draft is not supported in V1." });
      }

      const allowed = ["sent", "paid", "void"] as const;
      if (!allowed.includes(nextStatus as any)) {
        return res
          .status(400)
          .json({ message: `Invalid status. Allowed: ${allowed.join(", ")}` });
      }

      const invoice = await Invoice.findOne({ _id: id, accountId });
      if (!invoice)
        return res.status(404).json({ message: "Invoice not found" });

      const currentStatus = ((invoice as any).status || "draft")
        .toString()
        .toLowerCase();

      // ✅ Canonical financial truth BEFORE allowing a manual "paid" flip
      const finNow = computeInvoiceFinancials(invoice as any);

      // If there is still money due, block setting status=paid here.
      // Paid status must come from payments (our backend truth).
      if (nextStatus === "paid" && finNow.financialStatus !== "paid") {
        return res.status(400).json({
          message:
            "Cannot mark as paid while balance is still due. Record a payment instead.",
        });
      }

      assertValidInvoiceTransition(currentStatus as any, nextStatus as any);

      const now = new Date();
      (invoice as any).status = nextStatus;

      if (nextStatus === "sent" && !(invoice as any).sentAt)
        (invoice as any).sentAt = now;

      if (nextStatus === "paid" && !(invoice as any).paidAt)
        (invoice as any).paidAt = now;

      if (nextStatus === "void") {
        if (!(req.body?.reason || "").trim())
          return res
            .status(400)
            .json({ message: "Void reason is required" });

        if (!(invoice as any).voidedAt) (invoice as any).voidedAt = now;
        (invoice as any).voidReason = (req.body.reason || "").trim();
      }

      // ✅ Keep cached money fields aligned (paidAmount/balanceDue) no matter what
      applyInvoiceFinancials(invoice as any);

      await invoice.save();

      if (nextStatus === "paid" || nextStatus === "void") {
        await WorkOrder.updateOne(
          { _id: (invoice as any).workOrderId, accountId },
          { $set: { closedAt: now } }
        );
      } else {
        await WorkOrder.updateOne(
          { _id: (invoice as any).workOrderId, accountId },
          { $unset: { closedAt: 1 } }
        );
      }

      const fin = computeInvoiceFinancials(invoice as any);
      return res.json({ ...invoice.toObject(), ...fin });
    } catch (err) {
      next(err);
    }
  }
);


/**
 * ✅ 8) Most generic route LAST
 */



export default router;
