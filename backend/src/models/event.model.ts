import { Schema, model, type Document } from "mongoose";
import { Types } from "mongoose";

export type EventActorRole = "owner" | "manager" | "technician" | "superadmin";
export type EventEntityKind = "account" | "customer" | "work_order" | "invoice" | "user";

export interface IEventEntity {
  kind: EventEntityKind;
  id: Types.ObjectId;
}

export interface IEvent extends Document {
  accountId?: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorRole?: EventActorRole;
  type: string;
  entity?: IEventEntity;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const eventEntitySchema = new Schema<IEventEntity>(
  {
    kind: {
      type: String,
      enum: ["account", "customer", "work_order", "invoice", "user"],
      required: true,
    },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false }
);

const eventSchema = new Schema<IEvent>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    actorRole: {
      type: String,
      enum: ["owner", "manager", "technician", "superadmin"],
      index: true,
    },
    type: { type: String, required: true, index: true },
    entity: eventEntitySchema,
    meta: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

eventSchema.index({ createdAt: -1, type: 1 });
eventSchema.index({ accountId: 1, createdAt: -1 });
eventSchema.index({ actorId: 1, createdAt: -1 });

export const Event = model<IEvent>("Event", eventSchema);
