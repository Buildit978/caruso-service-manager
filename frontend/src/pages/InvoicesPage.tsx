import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Invoice } from '../api/invoices';

interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}

interface CustomerRef {
    _id: string;
    name?: string;
    companyName?: string;
    // add any other fields if you want
}

interface WorkOrderRef {
    _id: string;
    description?: string;
}

export interface Invoice {
    _id: string;
    customerId: string | CustomerRef;
    workOrderId?: string | WorkOrderRef;
    items: InvoiceItem[];
    total: number;
    status: 'draft' | 'sent' | 'paid' | 'void';
    issuedAt: string;
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                const res = await fetch('/api/invoices');
                if (!res.ok) {
                    throw new Error('Failed to load invoices');
                }

                const data = (await res.json()) as Invoice[];
                setInvoices(data);
            } catch (err: any) {
                setError(err.message || 'Error loading invoices');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    const formatCurrency = (value: number) =>
        value.toLocaleString('en-CA', {
            style: 'currency',
            currency: 'CAD',
        });

    const formatDate = (value: string) =>
        new Date(value).toLocaleDateString('en-CA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });

    const getCustomerName = (customer: Invoice['customerId']) => {
        if (typeof customer === 'string') return customer;
        return customer.companyName || customer.name || customer._id;
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Invoices</h1>
            </div>

            {loading && <p>Loading invoices…</p>}
            {error && <p className="text-red-500">{error}</p>}

            {!loading && !error && invoices.length === 0 && (
                <p>No invoices yet. Create one from a work order to get started.</p>
            )}

            {!loading && !error && invoices.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="px-3 py-2 text-left">Invoice #</th>
                                <th className="px-3 py-2 text-left">Customer</th>
                                <th className="px-3 py-2 text-left">Work Order</th>
                                <th className="px-3 py-2 text-right">Total</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-left">Date</th>
                                <th className="px-3 py-2 text-right"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((invoice) => {
                                const wo =
                                    typeof invoice.workOrderId === 'string'
                                        ? null
                                        : (invoice.workOrderId as WorkOrderRef | null);

                                return (
                                    <tr key={invoice._id} className="border-b hover:bg-zinc-900/50">
                                        <td className="px-3 py-2 align-middle">
                                            {invoice._id.slice(-6)}
                                        </td>
                                        <td className="px-3 py-2 align-middle">
                                            {getCustomerName(invoice.customerId)}
                                        </td>
                                        <td className="px-3 py-2 align-middle">
                                            {wo ? (
                                                <Link
                                                    to={`/work-orders/${wo._id}`}
                                                    className="underline"
                                                >
                                                    {wo._id.slice(-6)}
                                                </Link>
                                            ) : (
                                                    '—'
                                                )}
                                        </td>
                                        <td className="px-3 py-2 align-middle text-right">
                                            {formatCurrency(invoice.total)}
                                        </td>
                                        <td className="px-3 py-2 align-middle capitalize">
                                            {invoice.status}
                                        </td>
                                        <td className="px-3 py-2 align-middle">
                                            {formatDate(invoice.issuedAt)}
                                        </td>
                                        <td className="px-3 py-2 align-middle text-right">
                                            <Link
                                                to={`/invoices/${invoice._id}`}
                                                className="text-blue-400 underline"
                                            >
                                                View
                      </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

