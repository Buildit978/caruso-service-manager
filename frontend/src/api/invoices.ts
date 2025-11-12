import type { Invoice } from '../pages/InvoicesPage';

export async function createInvoiceFromWorkOrder(
    workOrderId: string
): Promise<Invoice> {
    const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workOrderId }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to create invoice');
    }

    return (await res.json()) as Invoice;
}
