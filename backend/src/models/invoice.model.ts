import { Schema, model, Document, Types } from 'mongoose';

export interface IInvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}

export interface IInvoice extends Document {
    customerId: Types.ObjectId;
    workOrderId?: Types.ObjectId;
    items: IInvoiceItem[];
    total: number;
    status: 'draft' | 'sent' | 'paid' | 'void';
    issuedAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
    {
        description: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        lineTotal: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
    {
        customerId: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        workOrderId: {
            type: Schema.Types.ObjectId,
            ref: 'WorkOrder',
        },
        items: {
            type: [invoiceItemSchema],
            default: [],
        },
        total: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        status: {
            type: String,
            enum: ['draft', 'sent', 'paid', 'void'],
            default: 'draft',
        },
        issuedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

export const Invoice = model<IInvoice>('Invoice', invoiceSchema);
