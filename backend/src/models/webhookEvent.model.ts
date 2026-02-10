import { Schema, model, type Document } from "mongoose";

export interface IWebhookEvent extends Document {
  eventId: string;
  type: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    processedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const WebhookEvent = model<IWebhookEvent>("WebhookEvent", webhookEventSchema);

