import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Invoice } from './InvoicesPage';

export default function InvoiceDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                const res = await fetch(`/api/invoices/${id}`);
                if (!res.ok) {
                    throw new Error('Failed to load invoice');
                }

                const data = (await res.json()) as Invoice;
                setInvoice(data);
            } catch (err: any) {
                setError(err.message || 'Error loading invoice');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [id]);

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

    if (loading) return <p>Loading invoice…</p>;
    if (error) return <p className="text-red-500">{error}</p>;
    if (!invoice) return <p>Invoice not found.</p>;

    const wo =
        typeof invoice.workOrderId === 'string'
            ? null
            : (invoice.workOrderId as any);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">
                        Invoice #{invoice._id.slice(-6)}
                    </h1>
                    <p className="text-sm text-zinc-400">
                        Issued {formatDate(invoice.issuedAt)} • Status:{' '}
                        <span className="capitalize">{invoice.status}</span>
                    </p>
                </div>

                <Link to="/invoices" className="text-blue-400 underline text-sm">
                    Back to invoices
        </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-zinc-800 p-4">
                    <h2 className="text-lg font-medium mb-2">Customer</h2>
                    <p>{getCustomerName(invoice.customerId)}</p>
                </div>

                <div className="rounded-lg border border-zinc-800 p-4">
                    <h2 className="text-lg font-medium mb-2">Work Order</h2>
                    {wo ? (
                        <p>
                            Linked to{' '}
                            <Link
                                to={`/work-orders/${wo._id}`}
                                className="text-blue-400 underline"
                            >
                                Work Order #{wo._id.slice(-6)}
                            </Link>
                        </p>
                    ) : (
                            <p>No linked work order.</p>
                        )}
                </div>
            </div>

            <div className="rounded-lg border border-zinc-800 p-4">
                <h2 className="text-lg font-medium mb-2">Line Items</h2>

                {invoice.items.length === 0 ? (
                    <p>No items on this invoice.</p>
                ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="px-3 py-2 text-left">Description</th>
                                        <th className="px-3 py-2 text-right">Qty</th>
                                        <th className="px-3 py-2 text-right">Unit</th>
                                        <th className="px-3 py-2 text-right">Line Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.items.map((item, idx) => (
                                        <tr key={idx} className="border-b">
                                            <td className="px-3 py-2 align-middle">
                                                {item.description}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-right">
                                                {item.quantity}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-right">
                                                {formatCurrency(item.unitPrice)}
                                            </td>
                                            <td className="px-3 py-2 align-middle text-right">
                                                {formatCurrency(item.lineTotal)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={3} className="px-3 py-2 text-right font-medium">
                                            Total
                  </td>
                                        <td className="px-3 py-2 text-right font-semibold">
                                            {formatCurrency(invoice.total)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
            </div>
        </div>
    );
}
