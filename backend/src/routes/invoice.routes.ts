// backend/src/routes/invoices.routes.ts
import { Types } from "mongoose";
import { Router, type Request, type Response, type NextFunction } from "express";
import { WorkOrder } from "../models/workOrder.model";
import { Invoice } from "../models/invoice.model";
import { attachAccountId } from "../middleware/account.middleware";
import { Vehicle } from "../models/vehicle.model";


const router = Router();

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

export default router;
