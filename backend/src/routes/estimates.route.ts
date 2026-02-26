// backend/src/routes/estimates.route.ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { Types } from "mongoose";
import { Estimate } from "../models/estimate.model";
import { WorkOrder } from "../models/workOrder.model";
import { Vehicle } from "../models/vehicle.model";
import { Customer } from "../models/customer.model";
import { Settings } from "../models/settings.model";
import { normalizeTaxRatePercent } from "../utils/normalizeTaxRate";
import { requireRole } from "../middleware/requireRole";
import { requireActiveBilling } from "../middleware/requireBillingActive";
import { applyWorkOrderLifecycle } from "../utils/workOrderLifecycle";
import { trackEvent } from "../utils/trackEvent";
import { buildEstimatePdfBuffer } from "../utils/estimatePdf";
import { sendEmail } from "../utils/email";

const router = Router();

/**
 * Role gating: owner/manager only (inline, applies to all routes)
 */
router.use(requireRole(["owner", "manager"]));

/* =========================================================
   Query parsing (copied from adminBeta.route.ts)
========================================================= */

function parseQ(query: Request["query"]): string | undefined {
  const raw = typeof query.q === "string" ? query.q.trim() : "";
  return raw === "" ? undefined : raw;
}

function parseLimit(query: Request["query"]): number {
  const raw = query.limit;
  if (raw == null || raw === "") return 50;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(Math.max(n, 1), 200);
}

function parseSkip(query: Request["query"]): number {
  const raw = query.skip;
  if (raw == null || raw === "") return 0;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.max(n, 0), 5000);
}

type SortOption = "createdAt_desc" | "createdAt_asc";
function parseSort(query: Request["query"]): SortOption {
  const raw = String(query.sort ?? "createdAt_desc").trim();
  if (raw === "createdAt_asc") return raw;
  return "createdAt_desc";
}

async function getNextEstimateNumber(accountId: Types.ObjectId): Promise<string> {
  const [lastEstimate] = await Estimate.aggregate<{ estimateNumberInt: number }>([
    { $match: { accountId } },
    {
      $addFields: {
        estimateNumberInt: {
          $convert: {
            input: "$estimateNumber",
            to: "int",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $match: { estimateNumberInt: { $ne: null } } },
    { $sort: { estimateNumberInt: -1 } },
    { $limit: 1 },
  ]);

  const start = 1001;
  const lastNum =
    typeof lastEstimate?.estimateNumberInt === "number"
      ? lastEstimate.estimateNumberInt
      : null;

  let next = lastNum !== null ? lastNum + 1 : start;

  while (await Estimate.exists({ accountId, estimateNumber: String(next) })) {
    next += 1;
  }

  return String(next);
}

/* =========================================================
   POST /api/estimates
   Create a new draft estimate for a customer.
========================================================= */

router.post(
  "/",
  requireActiveBilling,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const kind = req.body?.kind === "non_client" ? "non_client" : "client";

      if (kind === "non_client") {
        const estimateNumber = await getNextEstimateNumber(accountId);
        const settings = await Settings.findOne({ accountId }).lean();
        const taxRatePercent = normalizeTaxRatePercent(settings?.taxRate) ?? 13;

        const estimate = await Estimate.create({
          accountId,
          estimateNumber,
          kind: "non_client",
          items: [],
          status: "draft",
          taxRate: taxRatePercent,
        });

        trackEvent({
          req,
          type: "estimate.created",
          entity: { kind: "estimate", id: estimate._id },
        });

        return res.status(201).json(estimate);
      }

      const { customerId } = req.body ?? {};
      if (!customerId || !Types.ObjectId.isValid(customerId)) {
        return res.status(400).json({ message: "customerId is required" });
      }

      const { Customer } = await import("../models/customer.model");
      const customer = await Customer.findOne({
        _id: customerId,
        accountId,
      }).lean();
      if (!customer) {
        return res.status(400).json({ message: "Invalid customerId" });
      }

      const estimateNumber = await getNextEstimateNumber(accountId);

      const settings = await Settings.findOne({ accountId }).lean();
      const taxRatePercent = normalizeTaxRatePercent(settings?.taxRate) ?? 13;

      const estimate = await Estimate.create({
        accountId,
        estimateNumber,
        kind: "client",
        customerId: new Types.ObjectId(customerId),
        items: [],
        status: "draft",
        taxRate: taxRatePercent,
      });

      trackEvent({
        req,
        type: "estimate.created",
        entity: { kind: "estimate", id: estimate._id },
      });

      return res.status(201).json(estimate);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   GET /api/estimates
   view=open|drafts|all (default: open)
   open = convertedToWorkOrderId does NOT exist
   all = no filter on convertedToWorkOrderId
   q, limit, skip, sort
========================================================= */

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountId = req.accountId;
    if (!accountId) {
      return res.status(400).json({ message: "Missing accountId" });
    }

    const view = String(req.query.view ?? "open").trim().toLowerCase();
    const effectiveView =
      view === "all" ? "all" : view === "drafts" ? "drafts" : "open";
    const customerId = req.query.customerId;
    const qParam = parseQ(req.query);
    const limit = parseLimit(req.query);
    const skip = parseSkip(req.query);
    const sortOption = parseSort(req.query);

    const filter: Record<string, unknown> = { accountId };

    // Optional customer filter (e.g. CustomerDetailPage estimates section)
    if (typeof customerId === "string" && customerId.trim() !== "") {
      filter.customerId = customerId.trim();
    }

    // view=open: exclude converted (pipeline only)
    if (effectiveView === "open") {
      filter.$or = [
        { convertedToWorkOrderId: { $exists: false } },
        { convertedToWorkOrderId: null },
      ];
    }

    // view=drafts: status=draft AND not converted
    if (effectiveView === "drafts") {
      filter.status = "draft";
      filter.$or = [
        { convertedToWorkOrderId: { $exists: false } },
        { convertedToWorkOrderId: null },
      ];
    }

    // Optional q: match estimateNumber OR customer first/last name (case-insensitive)
    if (qParam) {
      const qLower = qParam.trim().toLowerCase();
      if (qLower === "draft" || qLower === "sent") {
        filter.status = qLower;
      } else {
        const re = new RegExp(
          qParam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        );
        const matchingCustomers = await Customer.find({
          accountId,
          $or: [{ firstName: re }, { lastName: re }],
        })
          .select("_id")
          .lean();
        const customerIds = matchingCustomers.map((c) => c._id);

        const qOr: Record<string, unknown>[] = [
          { estimateNumber: re },
          { "nonClient.name": re },
          { "nonClient.lastName": re },
          { "nonClient.email": re },
          { "nonClient.phone": re },
          { "nonClient.vehicle.make": re },
          { "nonClient.vehicle.model": re },
        ];
        if (customerIds.length > 0) {
          qOr.push({ customerId: { $in: customerIds } });
        }

        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { $or: qOr }];
          delete filter.$or;
        } else {
          filter.$or = qOr;
        }
      }
    }

    const sortObj: Record<string, 1 | -1> =
      sortOption === "createdAt_asc" ? { createdAt: 1 } : { createdAt: -1 };

    const [total, estimates] = await Promise.all([
      Estimate.countDocuments(filter),
      Estimate.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate("customerId", "firstName lastName")
        .populate("vehicleId", "year make model licensePlate vin")
        .lean(),
    ]);

    return res.json({
      view: effectiveView,
      q: qParam ?? undefined,
      paging: { skip, limit, returned: estimates.length, total },
      items: estimates,
    });
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   GET /api/estimates/:id/pdf
   Owner/manager only. Returns PDF for sent estimates with sentSnapshot.
========================================================= */

router.get(
  "/:id/pdf",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid estimate id" });
      }

      const estimate = await Estimate.findOne({ _id: id, accountId }).lean();
      if (!estimate) {
        return res.status(404).json({ message: "Estimate not found" });
      }

      if ((estimate as any).status !== "sent") {
        return res.status(400).json({
          message: "PDF is only available for sent estimates.",
        });
      }

      const sentSnapshot = (estimate as any).sentSnapshot;
      if (!sentSnapshot) {
        return res.status(400).json({
          message: "Estimate has no sent snapshot. Re-send the estimate to generate a PDF.",
        });
      }

      const settings = await Settings.findOne({ accountId }).lean();

      const pdfBuffer = await buildEstimatePdfBuffer({
        estimate: {
          estimateNumber: (estimate as any).estimateNumber,
          sentAt: (estimate as any).sentAt,
        },
        sentSnapshot,
        settings: settings as any,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="Estimate-${(estimate as any).estimateNumber || id}.pdf"`
      );

      return res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   GET /api/estimates/:id
========================================================= */

router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid estimate id" });
      }

      const estimate = await Estimate.findOne({ _id: id, accountId })
        .populate("customerId", "firstName lastName")
        .populate("vehicleId", "year make model licensePlate vin")
        .lean();

      if (!estimate) {
        return res.status(404).json({ message: "Estimate not found" });
      }

      return res.json(estimate);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   PATCH /api/estimates/:id
   Owner/manager only. Update estimate. internalNotes anytime.
   If status !== 'draft', reject items/customerNotes/vehicleId.
   Validate vehicleId belongs to account and customer.
   Recompute subtotal/tax/total if items change (Settings.taxRate).
========================================================= */

router.patch(
  "/:id",
  requireActiveBilling,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid estimate id" });
      }

      const estimate = await Estimate.findOne({ _id: id, accountId });
      if (!estimate) {
        return res.status(404).json({ message: "Estimate not found" });
      }

      const patch = req.body ?? {};
      const status = String(estimate.status || "").toLowerCase();
      const isDraft = status === "draft";
      const kind = String((estimate as any).kind ?? "client").toLowerCase();
      const isNonClient = kind === "non_client";

      // internalNotes: allowed anytime
      if (typeof patch.internalNotes !== "undefined") {
        (estimate as any).internalNotes =
          patch.internalNotes == null ? undefined : String(patch.internalNotes).trim();
      }

      // items, customerNotes, vehicleId: only when draft
      if (!isDraft) {
        if (patch.items !== undefined) {
          return res.status(400).json({
            message: "Cannot update items when estimate is not in draft status.",
          });
        }
        if (patch.customerNotes !== undefined) {
          return res.status(400).json({
            message: "Cannot update customerNotes when estimate is not in draft status.",
          });
        }
        if (patch.vehicleId !== undefined) {
          return res.status(400).json({
            message: "Cannot update vehicleId when estimate is not in draft status.",
          });
        }
      }

      if (isDraft) {
        if (typeof patch.customerNotes !== "undefined") {
          (estimate as any).customerNotes =
            patch.customerNotes == null ? undefined : String(patch.customerNotes).trim();
        }

        if (isNonClient) {
          const nc = patch.nonClient;
          if (!nc || typeof nc !== "object") {
            return res.status(400).json({
              message: "nonClient is required for non-client estimates.",
            });
          }
          const v = nc.vehicle;
          if (!v || typeof v !== "object") {
            return res.status(400).json({
              message: "nonClient.vehicle is required.",
            });
          }
          const name = String(nc.name ?? "").trim();
          const lastName = String(nc.lastName ?? "").trim();
          const phone = String(nc.phone ?? "").trim();
          const year = typeof v.year === "number" ? v.year : Number(v.year);
          const make = String(v.make ?? "").trim();
          const model = String(v.model ?? "").trim();
          if (!name) {
            return res.status(400).json({
              message: "nonClient.name is required and must be non-empty.",
            });
          }
          if (!phone) {
            return res.status(400).json({
              message: "nonClient.phone is required and must be non-empty.",
            });
          }
          if (!Number.isFinite(year)) {
            return res.status(400).json({
              message: "nonClient.vehicle.year must be a number.",
            });
          }
          if (!make) {
            return res.status(400).json({
              message: "nonClient.vehicle.make is required and must be non-empty.",
            });
          }
          if (!model) {
            return res.status(400).json({
              message: "nonClient.vehicle.model is required and must be non-empty.",
            });
          }
          const emailRaw = String(nc.email ?? "").trim().toLowerCase();
          const email = emailRaw || undefined;
          (estimate as any).nonClient = {
            name,
            lastName: lastName || undefined,
            phone,
            email,
            vehicle: { year, make, model },
          };
          (estimate as any).vehicleId = undefined;
        } else {
          // vehicleId required for client draft estimates (non-bypassable)
          const vehicleId = patch.vehicleId;
          if (vehicleId === null || vehicleId === "" || vehicleId === undefined) {
            return res.status(400).json({
              code: "VEHICLE_REQUIRED",
              message: "Vehicle Year, Make, and Model are required.",
            });
          }
          if (!Types.ObjectId.isValid(String(vehicleId))) {
            return res.status(400).json({
              code: "INVALID_VEHICLE",
              message: "Invalid vehicle reference.",
            });
          }
          const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            accountId,
            customerId: estimate.customerId,
          }).lean();
          if (!vehicle) {
            return res.status(400).json({
              message: "vehicleId must belong to this account and customer.",
            });
          }
          (estimate as any).vehicleId = new Types.ObjectId(vehicleId);
        }

        if (Array.isArray(patch.items)) {
          const normalizedItems = patch.items.map((it: any) => {
            const qty = Number(it?.quantity) ?? 0;
            const price = Number(it?.unitPrice) ?? 0;
            const lineTotal =
              typeof it?.lineTotal === "number" ? it.lineTotal : qty * price;
            return {
              type: it?.type || "service",
              description: String(it?.description ?? "").trim(),
              quantity: qty,
              unitPrice: price,
              lineTotal,
              approved: it?.approved !== false,
            };
          });
          (estimate as any).items = normalizedItems;
        }
      }

      await estimate.save();

      // Compute subtotal/tax/total for response (Estimate model does not store them)
      const items = Array.isArray((estimate as any).items) ? (estimate as any).items : [];
      const subtotal = items.reduce((sum: number, it: any) => sum + (it.lineTotal ?? 0), 0);
      const settings = await Settings.findOne({ accountId }).lean();
      const taxRatePercent = normalizeTaxRatePercent(settings?.taxRate) ?? 13;
      const taxAmount = subtotal * (taxRatePercent / 100);
      const total = subtotal + taxAmount;

      const obj = estimate.toObject ? estimate.toObject() : estimate;
      return res.json({
        ...obj,
        subtotal,
        taxAmount,
        total,
        taxRate: taxRatePercent,
      });
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   POST /api/estimates/:id/send
   Only when status is draft. Set status='sent', sentAt=now, sentSnapshot.
   Return updated estimate populated (customerId, vehicleId).
========================================================= */

router.post(
  "/:id/send",
  requireActiveBilling,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid estimate id" });
      }

      const estimate = await Estimate.findOne({ _id: id, accountId });
      if (!estimate) {
        return res.status(404).json({ message: "Estimate not found" });
      }

      const kind = String((estimate as any).kind ?? "client").toLowerCase();
      const isNonClient = kind === "non_client";

      const status = String(estimate.status || "").toLowerCase();
      const hasSnapshot = !!(estimate as any).sentSnapshot;

      if (status === "sent" && hasSnapshot) {
        return res.status(400).json({
          message: "Estimate already sent",
        });
      }
      if (status !== "draft" && status !== "sent") {
        return res.status(400).json({
          message: "Can only send estimates that are in draft status.",
        });
      }

      let snapshotCustomer: {
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
      };
      let snapshotVehicle: {
        year?: number;
        make?: string;
        model?: string;
        licensePlate?: string;
        vin?: string;
      } | null = null;
      let emailTo: string;

      if (isNonClient) {
        const nc = (estimate as any).nonClient;
        if (!nc || typeof nc !== "object") {
          return res.status(400).json({
            code: "NON_CLIENT_INFO_REQUIRED",
            message: "Non-client info (name, phone, email, vehicle) is required before sending.",
          });
        }
        const name = String(nc.name ?? "").trim();
        const lastName = String(nc.lastName ?? "").trim();
        const phone = String(nc.phone ?? "").trim();
        const email = String(nc.email ?? "").trim().toLowerCase();
        const v = nc.vehicle;
        if (!name) {
          return res.status(400).json({
            code: "NON_CLIENT_NAME_REQUIRED",
            message: "Non-client name is required before sending.",
          });
        }
        if (!phone) {
          return res.status(400).json({
            code: "NON_CLIENT_PHONE_REQUIRED",
            message: "Non-client phone is required before sending.",
          });
        }
        if (!email) {
          return res.status(400).json({
            code: "NON_CLIENT_EMAIL_REQUIRED",
            message: "This non-client estimate has no email address.",
          });
        }
        if (!v || typeof v !== "object") {
          return res.status(400).json({
            code: "NON_CLIENT_VEHICLE_REQUIRED",
            message: "Non-client vehicle (year, make, model) is required before sending.",
          });
        }
        const year = typeof v.year === "number" ? v.year : Number(v.year);
        const make = String(v.make ?? "").trim();
        const model = String(v.model ?? "").trim();
        if (!Number.isFinite(year) || !make || !model) {
          return res.status(400).json({
            code: "NON_CLIENT_VEHICLE_REQUIRED",
            message: "Non-client vehicle year, make, and model are required before sending.",
          });
        }
        snapshotCustomer = {
          firstName: name,
          lastName,
          email,
          phone,
        };
        snapshotVehicle = { year, make, model };
        emailTo = email;
      } else {
        if (!estimate.customerId) {
          return res.status(400).json({
            code: "RECIPIENT_REQUIRED",
            message: "Select a customer before sending this estimate.",
          });
        }
        if (!Types.ObjectId.isValid(String(estimate.customerId))) {
          return res.status(400).json({
            code: "INVALID_CUSTOMER",
            message: "Invalid customer reference.",
          });
        }
        const customer = await Customer.findOne({
          _id: estimate.customerId,
          accountId,
        }).lean();

        if (!customer) {
          return res.status(400).json({
            code: "CUSTOMER_NOT_FOUND",
            message: "The selected customer could not be found.",
          });
        }

        if (!customer.email) {
          return res.status(400).json({
            code: "CUSTOMER_EMAIL_REQUIRED",
            message: "This customer has no email address.",
          });
        }

        if (estimate.vehicleId) {
          const v = await Vehicle.findOne({
            _id: estimate.vehicleId,
            accountId,
          }).lean();
          if (v) {
            snapshotVehicle = {
              year: (v as any).year,
              make: (v as any).make,
              model: (v as any).model,
              licensePlate: (v as any).licensePlate,
              vin: (v as any).vin,
            };
          }
        }
        snapshotCustomer = {
          firstName: (customer as any)?.firstName ?? "",
          lastName: (customer as any)?.lastName ?? "",
          email: (customer as any)?.email,
          phone: (customer as any)?.phone,
        };
        emailTo = (customer as any).email;
      }

      const rawItems = Array.isArray((estimate as any).items) ? (estimate as any).items : [];
      const taxRatePercent = normalizeTaxRatePercent((estimate as any).taxRate) ?? 13;

      const snapshotItems = rawItems.map((it: any) => {
        const qty = Number(it?.quantity);
        const price = Number(it?.unitPrice);
        const safeQty = Number.isFinite(qty) ? qty : 0;
        const safePrice = Number.isFinite(price) ? price : 0;
        const lineTotal = Math.round(safeQty * safePrice * 100) / 100;
        return {
          description: String(it?.description ?? "").trim(),
          quantity: safeQty,
          unitPrice: safePrice,
          lineTotal,
        };
      });

      const hasInvalidDescription = snapshotItems.some(
        (it: any) => String(it?.description ?? "").trim().length === 0
      );
      if (hasInvalidDescription) {
        return res.status(400).json({
          code: "ITEM_DESCRIPTION_REQUIRED",
          message: "Each line item must have a description before sending.",
        });
      }

      const subtotal = snapshotItems.reduce((sum: number, it: any) => sum + it.lineTotal, 0);

      if (snapshotItems.length === 0 || subtotal <= 0) {
        return res.status(400).json({
          code: "EMPTY_ESTIMATE",
          message: "Cannot send an empty estimate. Please add items and save before sending.",
        });
      }

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const taxAmount = round2(subtotal * (taxRatePercent / 100));
      const total = round2(subtotal + taxAmount);

      if (
        !Number.isFinite(taxRatePercent) ||
        !Number.isFinite(subtotal) ||
        !Number.isFinite(taxAmount) ||
        !Number.isFinite(total)
      ) {
        return res.status(400).json({ message: "Invalid estimate totals" });
      }

      const sentSnapshot = {
        customer: snapshotCustomer,
        ...(snapshotVehicle ? { vehicle: snapshotVehicle } : {}),
        items: snapshotItems,
        subtotal,
        taxRate: taxRatePercent,
        taxAmount,
        total,
        customerNotes: (estimate as any).customerNotes,
      };

      const settings = await Settings.findOne({ accountId }).lean();
      const sentAt = new Date();
      const pdfBuffer = await buildEstimatePdfBuffer({
        estimate: { estimateNumber: (estimate as any).estimateNumber, sentAt },
        sentSnapshot,
        settings: settings as any,
      });

      const estimateNumber = (estimate as any).estimateNumber ?? id;
      const filename = `estimate-${estimateNumber}.pdf`;
      const subject = `Estimate #${estimateNumber}`;
      const text = `Attached is your estimate #${estimateNumber}.`;

      try {
        await sendEmail({
          to: emailTo,
          subject,
          text,
          attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
          accountId: req.accountId,
        });
      } catch (emailErr: any) {
        console.error("estimate.send email failed", {
          estimateId: id,
          accountId: req.accountId,
          to: emailTo,
          message: emailErr?.message,
          stack: emailErr?.stack,
        });
        return res.status(502).json({
          code: "EMAIL_SEND_FAILED",
          message: "Could not email the estimate. Please try again.",
        });
      }

      const emailSentAt = new Date();
      (estimate as any).status = "sent";
      (estimate as any).sentAt = sentAt;
      (estimate as any).emailSentAt = emailSentAt;
      (estimate as any).sentSnapshot = sentSnapshot;

      await estimate.save();

      /* id="b1-safe-populate" - populate only when refs exist and valid (client or non-client) */
      let sendQuery = Estimate.findById(estimate._id);
      const customerIdVal = (estimate as any).customerId;
      if (customerIdVal && Types.ObjectId.isValid(String(customerIdVal))) {
        sendQuery = sendQuery.populate("customerId", "firstName lastName");
      }
      const vehicleIdVal = (estimate as any).vehicleId;
      if (vehicleIdVal && Types.ObjectId.isValid(String(vehicleIdVal))) {
        sendQuery = sendQuery.populate("vehicleId", "year make model licensePlate vin");
      }
      const updated = await sendQuery.lean();

      return res.json(updated);
    } catch (err: any) {
      console.error("estimate.send failed", {
        estimateId: req.params.id,
        accountId: req.accountId,
        message: err?.message,
        stack: err?.stack,
      });
      return res.status(500).json({ message: "Failed to send estimate" });
    }
  }
);

/* =========================================================
   POST /api/estimates/:id/resend
   Re-email an already-sent estimate using sentSnapshot (no recompute).
========================================================= */
router.post(
  "/:id/resend",
  requireActiveBilling,
  async (req: Request, res: Response) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid estimate id" });
      }

      const estimate = await Estimate.findOne({ _id: id, accountId });
      if (!estimate) {
        return res.status(404).json({ message: "Estimate not found" });
      }

      const sentSnapshot = (estimate as any).sentSnapshot;
      if (!sentSnapshot) {
        return res.status(400).json({
          code: "MISSING_SNAPSHOT",
          message: "Estimate has not been finalized for sending yet.",
        });
      }

      // Recipient email: prefer live customer email, fallback to snapshot email
      let to = "";
      const customerId = (estimate as any).customerId;

      if (customerId && Types.ObjectId.isValid(String(customerId))) {
        const customer = await Customer.findOne({ _id: customerId, accountId }).lean();
        if (customer?.email) to = String(customer.email).trim();
      }

      if (!to) {
        const snapEmail = sentSnapshot?.customer?.email;
        if (snapEmail) to = String(snapEmail).trim();
      }

      if (!to) {
        return res.status(400).json({
          code: "CUSTOMER_EMAIL_REQUIRED",
          message: "This customer has no email address.",
        });
      }

      // Cooldown (optional)
      const now = new Date();
      const lastAttempt = (estimate as any).emailLastAttemptAt
        ? new Date((estimate as any).emailLastAttemptAt)
        : null;

      if (lastAttempt && now.getTime() - lastAttempt.getTime() < 30_000) {
        return res.status(429).json({
          code: "RESEND_COOLDOWN",
          message: "Please wait a moment before resending.",
        });
      }

      // Persist attempt metadata BEFORE sending (only if fields exist in schema)
      if ("emailLastAttemptAt" in estimate) (estimate as any).emailLastAttemptAt = now;
      if ("emailAttemptCount" in estimate)
        (estimate as any).emailAttemptCount = Number((estimate as any).emailAttemptCount ?? 0) + 1;

      await estimate.save();

      // Load lightweight settings for PDF (optional)
      const s = await Settings.findOne({ accountId }).lean();
      const settings = s
        ? { shopName: (s as any).shopName, invoiceProfile: (s as any).invoiceProfile }
        : undefined;

      // Build PDF from snapshot (no recompute)
      const pdfBuffer = await buildEstimatePdfBuffer({
        estimate: {
          estimateNumber: String((estimate as any).estimateNumber ?? ""),
          sentAt: (estimate as any).sentAt ?? now,
        },
        sentSnapshot,
        settings,
      });

      // Send email
      try {
        await sendEmail({
          to,
          subject: `Estimate ${String((estimate as any).estimateNumber ?? "")}`,
          text: `Please find your estimate attached.`,
          attachments: [
            {
              filename: `estimate-${String((estimate as any).estimateNumber ?? estimate._id)}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
          accountId,
        });
      } catch (mailErr: any) {
        const msg = String(mailErr?.message ?? "Unknown email error");

        if ("emailLastError" in estimate) (estimate as any).emailLastError = msg;
        await estimate.save();

        console.error("estimate.resend email failed", {
          estimateId: String(estimate._id),
          accountId,
          to,
          message: mailErr?.message,
          stack: mailErr?.stack,
        });

        return res.status(502).json({
          code: "EMAIL_SEND_FAILED",
          message: "Could not email the estimate. Please try again.",
        });
      }

      // Success: record email sent time + clear error
      if ("emailSentAt" in estimate) (estimate as any).emailSentAt = now;
      if ("emailLastError" in estimate) (estimate as any).emailLastError = null;

      await estimate.save();

      /* id="b1-safe-populate-vehicle" - avoid 500 from invalid vehicleId on legacy records */
      let resendQuery = Estimate.findById(estimate._id).populate("customerId", "firstName lastName");
      const resendVehicleIdVal = (estimate as any).vehicleId;
      if (resendVehicleIdVal && Types.ObjectId.isValid(String(resendVehicleIdVal))) {
        resendQuery = resendQuery.populate("vehicleId", "year make model licensePlate vin");
      }
      const updated = await resendQuery.lean();

      return res.json(updated);
    } catch (err: any) {
      console.error("estimate.resend failed", {
        estimateId: req.params.id,
        accountId: req.accountId,
        message: err?.message,
        stack: err?.stack,
      });
      return res.status(500).json({ message: "Failed to resend estimate" });
    }
  }
);

/* =========================================================
   POST /api/estimates/:id/approve
   Only when status is sent or accepted. Set status='approved'.
========================================================= */

router.post(
  "/:id/approve",
  requireActiveBilling,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid estimate id" });
      }

      const estimate = await Estimate.findOne({ _id: id, accountId });
      if (!estimate) {
        return res.status(404).json({ message: "Estimate not found" });
      }

      const status = String(estimate.status || "").toLowerCase();
      if (status === "approved") {
        const estimateObj = estimate.toObject ? estimate.toObject() : estimate;
        return res.json({ estimate: estimateObj });
      }
      if (status !== "sent" && status !== "accepted") {
        return res.status(400).json({
          message: `Cannot approve estimate with status "${estimate.status}". Status must be sent or accepted.`,
        });
      }

      (estimate as any).status = "approved";
      await estimate.save();

      const estimateObj = estimate.toObject ? estimate.toObject() : estimate;
      return res.json({ estimate: estimateObj });
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   POST /api/estimates/:id/convert
   - Validate status is approved or partially_approved
   - Ensure not already converted
   - Create WorkOrder using approved items only
   - Set estimate.convertedToWorkOrderId
   - Return both estimate and workOrder
========================================================= */

router.post(
  "/:id/convert",
  requireActiveBilling,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.accountId;
      if (!accountId) {
        return res.status(400).json({ message: "Missing accountId" });
      }

      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid estimate id" });
      }

      const estimate = await Estimate.findOne({ _id: id, accountId });
      if (!estimate) {
        return res.status(404).json({ message: "Estimate not found" });
      }

      const status = String(estimate.status || "").toLowerCase();

      if (status !== "approved" && status !== "partially_approved") {
        return res.status(400).json({
          message: `Cannot convert estimate with status "${estimate.status}". Status must be approved or partially_approved.`,
        });
      }

      if (estimate.convertedToWorkOrderId) {
        return res.status(400).json({
          message: "Estimate has already been converted to a work order.",
        });
      }

      // Get approved items: approved = all items; partially_approved = items with approved === true
      const items = Array.isArray(estimate.items) ? estimate.items : [];
      const approvedItems =
        status === "approved"
          ? items
          : items.filter((it: any) => it.approved === true);

      if (approvedItems.length === 0) {
        return res.status(400).json({
          message:
            status === "partially_approved"
              ? "No approved items to convert. Select at least one item."
              : "Estimate has no line items to convert.",
        });
      }

      // Non-client: create Customer from nonClient if customerId missing
      let effectiveCustomerId = estimate.customerId;
      let nonClientVehicleId: Types.ObjectId | undefined;
      let nonClientVehicleYear: number | undefined;
      let nonClientVehicleMake: string | undefined;
      let nonClientVehicleModel: string | undefined;
      if (!effectiveCustomerId) {
        const nc = (estimate as any).nonClient;
        if (!nc || typeof nc !== "object") {
          return res.status(400).json({
            code: "NON_CLIENT_INFO_REQUIRED",
            message: "Non-client estimate requires nonClient info for conversion.",
          });
        }
        const firstName = String(nc.name ?? "").trim();
        const lastName = String(nc.lastName ?? "").trim();
        if (!firstName) {
          return res.status(400).json({
            code: "NON_CLIENT_NAME_REQUIRED",
            message: "Missing nonClient.name (name and lastName required for conversion).",
          });
        }
        if (!lastName) {
          return res.status(400).json({
            code: "NON_CLIENT_LASTNAME_REQUIRED",
            message: "Missing nonClient.lastName (name and lastName required for conversion).",
          });
        }
        const v = nc.vehicle;
        if (!v || typeof v !== "object") {
          return res.status(400).json({
            code: "NON_CLIENT_VEHICLE_REQUIRED",
            message: "Missing nonClient.vehicle (year/make/model required for conversion).",
          });
        }
        const year = typeof v.year === "number" ? v.year : undefined;
        const make = v.make ? String(v.make).trim() : undefined;
        const model = v.model ? String(v.model).trim() : undefined;
        if (year === undefined) {
          return res.status(400).json({
            code: "NON_CLIENT_VEHICLE_YEAR_REQUIRED",
            message: "Missing nonClient.vehicle.year (year/make/model required for conversion).",
          });
        }
        if (!make) {
          return res.status(400).json({
            code: "NON_CLIENT_VEHICLE_MAKE_REQUIRED",
            message: "Missing nonClient.vehicle.make (year/make/model required for conversion).",
          });
        }
        if (!model) {
          return res.status(400).json({
            code: "NON_CLIENT_VEHICLE_MODEL_REQUIRED",
            message: "Missing nonClient.vehicle.model (year/make/model required for conversion).",
          });
        }

        const newCustomer = await Customer.create({
          accountId,
          firstName,
          lastName,
          phone: nc.phone ? String(nc.phone).trim() : undefined,
          email: nc.email ? String(nc.email).trim().toLowerCase() : undefined,
        });
        (estimate as any).customerId = newCustomer._id;
        await estimate.save();
        effectiveCustomerId = newCustomer._id as Types.ObjectId;

        try {
          const createdVehicle = await Vehicle.create({
            accountId,
            customerId: newCustomer._id,
            year,
            make,
            model,
          });
          nonClientVehicleId = createdVehicle._id as Types.ObjectId;
          nonClientVehicleYear = year;
          nonClientVehicleMake = make;
          nonClientVehicleModel = model;
        } catch (vehErr: any) {
          return res.status(400).json({
            code: "VEHICLE_CREATE_FAILED",
            message: vehErr?.message ?? "Could not create vehicle for non-client estimate.",
          });
        }
      }

      // Map to WorkOrder line items
      const lineItems = approvedItems.map((it: any) => ({
        type: (it.type || "service") as "labour" | "part" | "service",
        description: String(it.description ?? "").trim(),
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        lineTotal: Number(it.lineTotal) || 0,
      }));

      const subtotal = lineItems.reduce((sum, li) => sum + (li.lineTotal || 0), 0);

      const settings = await Settings.findOne({ accountId }).lean();
      const taxRatePercent =
        normalizeTaxRatePercent(settings?.taxRate) ?? 13;
      const taxAmount = subtotal * (taxRatePercent / 100);
      const total = subtotal + taxAmount;

      // Build vehicle snapshot: from vehicleId or from nonClient.vehicle (non-client)
      let vehicle: any = undefined;
      if (estimate.vehicleId) {
        const v = await Vehicle.findOne({
          _id: estimate.vehicleId,
          accountId,
        }).lean();
        if (v) {
          vehicle = {
            vehicleId: v._id,
            year: (v as any).year,
            make: (v as any).make,
            model: (v as any).model,
            vin: (v as any).vin,
            licensePlate: (v as any).licensePlate,
            color: (v as any).color,
            notes: (v as any).notes,
          };
        }
      } else if (nonClientVehicleId !== undefined) {
        vehicle = {
          vehicleId: nonClientVehicleId,
          year: nonClientVehicleYear,
          make: nonClientVehicleMake,
          model: nonClientVehicleModel,
        };
      }

      const workOrder = new WorkOrder({
        accountId,
        customerId: effectiveCustomerId,
        sourceEstimateId: estimate._id,
        complaint: `Converted from estimate ${estimate.estimateNumber}`,
        diagnosis: (estimate as any).internalNotes,
        notes: (estimate as any).customerNotes,
        status: "open",
        date: new Date(),
        vehicle,
        lineItems,
        taxRate: taxRatePercent,
        subtotal,
        taxAmount,
        total,
      });

      applyWorkOrderLifecycle(workOrder, { status: "open" });
      await workOrder.save();

      estimate.convertedToWorkOrderId = workOrder._id as Types.ObjectId;
      await estimate.save();

      trackEvent({
        req,
        type: "estimate.converted",
        entity: { kind: "estimate", id: estimate._id },
        meta: { workOrderId: workOrder._id },
      });

      const estimateObj = estimate.toObject ? estimate.toObject() : estimate;

      return res.status(201).json({
        estimate: { ...estimateObj, convertedToWorkOrderId: workOrder._id },
        workOrder: workOrder.toObject ? workOrder.toObject() : workOrder,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
