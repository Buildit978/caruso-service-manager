import type { Request } from "express";
import { Types } from "mongoose";
import { Event } from "../models/event.model";

type EventEntityKind = "account" | "customer" | "work_order" | "invoice" | "user";

export interface TrackEventEntity {
  kind: EventEntityKind;
  id: Types.ObjectId | string;
}

export interface TrackEventParams {
  req: Request;
  type: string;
  entity?: TrackEventEntity;
  meta?: Record<string, any>;
}

export async function trackEvent({
  req,
  type,
  entity: entityIn,
  meta,
}: TrackEventParams): Promise<void> {
  try {
    const accountId = (req as any).accountId;
    const actorId = (req as any).actor?._id;
    const actorRole = (req as any).actor?.role;

    let entity: { kind: EventEntityKind; id: Types.ObjectId } | undefined;
    if (entityIn?.kind && entityIn?.id != null) {
      const id =
        typeof entityIn.id === "string"
          ? Types.ObjectId.isValid(entityIn.id)
            ? new Types.ObjectId(entityIn.id)
            : undefined
          : entityIn.id;
      if (id) {
        entity = { kind: entityIn.kind, id };
      }
    }

    await Event.create({
      accountId: accountId ?? undefined,
      actorId: actorId ?? undefined,
      actorRole: actorRole ?? undefined,
      type,
      entity,
      meta,
    });
  } catch {
    // Swallow; analytics must not block app flows.
  }
}
