import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createInvoiceFromWorkOrder } from '../api/invoices';

interface Customer {
    _id: string;
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
}

interface WorkOrder {
    _id: string;
    customerId: Customer | string; // allow string or populated object
    description: string;
    status: string;
    total: number;
    createdAt: string;
    updatedAt: string;
}

export default function WorkOrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creatingInvoice, setCreatingInvoice] = useState(false);


    useEffect(() => {
        if (!id) {
            console.warn('[WO Detail] No :id in route — skipping fetch');
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        (async () => {
            try {
                setLoading(true);
                setError(null);

                const url = `/api/work-orders/${id}`; // ← proxied path
                console.log('[WO Detail] id:', id);
                console.log('[WO Detail] Fetching:', url);

                const res = await fetch(url, { signal: controller.signal });
                console.log('[WO Detail] Status:', res.status);

                if (!res.ok) {
                    const raw = await res.text();
                    console.error('[WO Detail] Non-OK body:', raw);
                    throw new Error(`Failed to load work order (status ${res.status})`);
                }

                const data = (await res.json()) as any;

                const normalized = {
                    ...data,
                    customerId:
                        typeof data.customerId === 'object'
                            ? data.customerId
                            : data.customer ?? data.customerId,
                };

                console.log('[WO Detail] Success. _id:', normalized._id);
                setWorkOrder(normalized);
            } catch (e: any) {
                if (e?.name === 'AbortError') {
                    setError('Request timed out. Server did not respond.');
                    console.error('[WO Detail] Aborted (timeout)');
                } else {
                    setError(e.message || 'Error loading work order.');
                    console.error('[WO Detail] Error:', e);
                }
            } finally {
                clearTimeout(timeout);
                setLoading(false);
                console.log('[WO Detail] Done. loading=false');
            }
        })();

        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [id]);


    const handleBack = () => navigate('/work-orders');

    const handleGenerateInvoice = async () => {
        if (!workOrder?._id) return;

        try {
            setCreatingInvoice(true);
            const invoice = await createInvoiceFromWorkOrder(workOrder._id);

            // figure out a display name even if customerId is a string
            let customerName = 'customer';
            if (workOrder.customerId && typeof workOrder.customerId === 'object') {
                customerName =
                    workOrder.customerId.companyName || workOrder.customerId.name || 'customer';
            }

            alert(`✅ Invoice #${invoice._id.slice(-6)} created for ${customerName}.`);
            navigate(`/invoices/${invoice._id}`);
        } catch (err: any) {
            console.error(err);
            alert(`❌ ${err.message || 'Failed to create invoice.'}`);
        } finally {
            setCreatingInvoice(false);
        }
    };

    // Early returns
    if (loading) {
        return <div className="p-4">Loading work order…</div>;
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="text-red-500 mb-3">{error}</div>
                <button
                    onClick={handleBack}
                    className="px-3 py-1 border border-gray-600 rounded hover:bg-gray-700"
                >
                    Back to Work Orders
        </button>
            </div>
        );
    }

    if (!workOrder) {
        return (
            <div className="p-4">
                <div className="mb-3">Work order not found.</div>
                <button
                    onClick={handleBack}
                    className="px-3 py-1 border border-gray-600 rounded hover:bg-gray-700"
                >
                    Back to Work Orders
        </button>
            </div>
        );
    }

    // Safe access to customer object
    const customerObj =
        workOrder.customerId && typeof workOrder.customerId === 'object'
            ? (workOrder.customerId as Customer)
            : undefined;

    return (
        <div className="flex flex-col gap-4 p-4">
            {/* tiny on-page debug strip */}
            <div className="text-xs text-slate-400">
                Debug — id: {id} · loading: {String(loading)} · error:{' '}
                {error ?? 'none'} · got WO: {workOrder?._id ?? 'no'}
            </div>

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">
                    Work Order #{workOrder._id.slice(-6)}
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleBack}
                        className="px-3 py-1 border border-gray-600 rounded hover:bg-gray-700"
                    >
                        Back
          </button>

                    <button
                        onClick={handleGenerateInvoice}
                        disabled={creatingInvoice}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
                    >
                        {creatingInvoice ? 'Creating…' : 'Generate Invoice'}
                    </button>
                </div>
            </div>

            <div className="rounded-lg border border-gray-700 p-4">
                <h2 className="text-lg font-medium mb-2">Customer Info</h2>
                {customerObj ? (
                    <>
                        <p className="font-semibold">
                            {customerObj.companyName || customerObj.name}
                        </p>
                        {customerObj.email && <p>Email: {customerObj.email}</p>}
                        {customerObj.phone && <p>Phone: {customerObj.phone}</p>}
                    </>
                ) : (
                        <p className="text-sm text-slate-400">Customer details not populated.</p>
                    )}
            </div>

            <div className="rounded-lg border border-gray-700 p-4">
                <h2 className="text-lg font-medium mb-2">Work Order Details</h2>
                <p>{workOrder.description}</p>
                <p className="mt-2 text-sm text-gray-400">
                    Status: <span className="capitalize">{workOrder.status}</span>
                </p>
                <p className="mt-1 font-semibold">
                    Total{' '}
                    {workOrder.total.toLocaleString('en-CA', {
                        style: 'currency',
                        currency: 'CAD',
                    })}
                </p>
                <div className="text-sm text-gray-500 mt-2">
                    Created: {new Date(workOrder.createdAt).toLocaleString('en-CA')}
                    <br />
          Updated: {new Date(workOrder.updatedAt).toLocaleString('en-CA')}
                </div>
            </div>
        </div>
    );
}
