// backend/src/routes/invoices.routes.ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { WorkOrder } from "../models/workOrder.model";
import { Invoice } from "../models/invoice.model";

const router = Router();

/**
 * Simple helper to generate the next invoice number.
 * For now: numeric sequence as a string, starting at 1001.
 */
async function getNextInvoiceNumber(): Promise<string> {
  const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 }).lean();

  if (!lastInvoice) {
    return "1001";
  }

  const lastNum = parseInt(lastInvoice.invoiceNumber, 10);
  if (Number.isNaN(lastNum)) {
    // Fallback if someone ever changes invoiceNumber format
    return String(Date.now());
  }

  return String(lastNum + 1);
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
router.post(
  "/from-work-order/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // 1) Load work order with customer populated
      const workOrder = await WorkOrder.findById(id).populate(
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

      // 3) Ensure we have a customer
      const customer: any = workOrder.customerId;
      if (!customer || !customer._id) {
        return res
          .status(400)
          .json({ message: "Work order has no valid customer" });
      }

      // 4) Normalize line items and money fields (mirror your GET /:id logic)
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
      const customerSnapshot = {
        customerId: customer._id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      };

      const vehicleSnapshot = workOrder.vehicle
        ? {
            vehicleId: (workOrder as any).vehicle?.vehicleId,
            year: (workOrder as any).vehicle?.year,
            make: (workOrder as any).vehicle?.make,
            model: (workOrder as any).vehicle?.model,
            vin: (workOrder as any).vehicle?.vin,
            licensePlate: (workOrder as any).vehicle?.licensePlate,
            color: (workOrder as any).vehicle?.color,
            notes: (workOrder as any).vehicle?.notes,
          }
        : undefined;

      // 6) Generate invoice number + dates
      const invoiceNumber = await getNextInvoiceNumber();
      const issueDate = new Date();

      let dueDate: Date | undefined;
      if (req.body.dueDate) {
        // allow override from body if you want
        const parsed = new Date(req.body.dueDate);
        if (!Number.isNaN(parsed.getTime())) {
          dueDate = parsed;
        }
      }
      if (!dueDate) {
        // default: 30 days after issue
        dueDate = new Date(issueDate.getTime());
        dueDate.setDate(issueDate.getDate() + 30);
      }

      // 7) Create invoice
      const invoice = await Invoice.create({
        invoiceNumber,
        status: "sent", // or "draft" if you prefer
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
      await workOrder.save();

      return res.status(201).json(invoice);
    } catch (err) {
      next(err);
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
      const invoices = await Invoice.find()
        .sort({ createdAt: -1 })
        .populate("customerId", "firstName lastName")
        .populate("workOrderId", "status");

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
      const invoice = await Invoice.findById(req.params.id)
        .populate("customerId", "firstName lastName")
        .populate("workOrderId", "status");

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
