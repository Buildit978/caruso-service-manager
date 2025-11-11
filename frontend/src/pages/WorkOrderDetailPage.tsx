import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

type Customer = {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
};

type WorkOrder = {
    _id: string;
    customerId: Customer | string;
    complaint: string;
    notes?: string;
    odometer?: number;
    diagnosis?: string;
    status: string;
    date?: string;
    createdAt?: string;
    updatedAt?: string;
};

export default function WorkOrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        const fetchWorkOrder = async () => {
            try {
                const res = await fetch(`http://localhost:4000/api/work-orders/${id}`);
                if (!res.ok) {
                    throw new Error(`Failed to fetch work order (status ${res.status})`);
                }
                const data = await res.json();
                setWorkOrder(data);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to load work order');
            } finally {
                setLoading(false);
            }
        };

        fetchWorkOrder();
    }, [id]);

    const handleBack = () => {
        navigate('/work-orders');
    };

    const handleEdit = () => {
        if (!workOrder?._id) return;
        navigate(`/work-orders/${workOrder._id}/edit`);
    };


    const handleMarkComplete = async () => {
        if (!workOrder?._id) return;
        try {
            const res = await fetch(
                `http://localhost:4000/api/work-orders/${workOrder._id}/status`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'completed' }),
                }
            );

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to update status');
            }

            const updated = await res.json();
            setWorkOrder(updated); // refresh UI immediately
            alert('✅ Work order marked complete!');
        } catch (err: any) {
            console.error(err);
            alert(`Error: ${err.message}`);
        }
    };


    const handleGenerateInvoice = async () => {
        if (!workOrder?._id) return;
        try {
            const res = await fetch(
                `http://localhost:4000/api/invoices/from-workorder/${workOrder._id}`,
                { method: 'POST' }
            );
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to generate invoice');
            }
            const invoice = await res.json();
            alert(`✅ Invoice #${invoice.invoiceId} created for ${invoice.customer.name}`);
            // later: navigate(`/invoices/${invoice._id}`)
        } catch (err: any) {
            console.error(err);
            alert(`❌ ${err.message}`);
        }
    };


    if (loading) {
        return <div style={{ padding: '1rem' }}>Loading work order…</div>;
    }

    if (error) {
        return (
            <div style={{ padding: '1rem' }}>
                <p style={{ color: 'red' }}>{error}</p>
                <button onClick={handleBack}>Back to Work Orders</button>
            </div>
        );
    }

    if (!workOrder) {
        return (
            <div style={{ padding: '1rem' }}>
                <p>Work order not found.</p>
                <button onClick={handleBack}>Back to Work Orders</button>
            </div>
        );
    }

    const customer =
        typeof workOrder.customerId === 'string'
            ? null
            : (workOrder.customerId as Customer);

    return (
        <div style={{ padding: '1.5rem', maxWidth: 800 }}>
            <button onClick={handleBack} style={{ marginBottom: '1rem' }}>
                ← Back to Work Orders
      </button>

            <h1 style={{ marginBottom: '0.5rem' }}>Work Order Detail</h1>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
                ID: {workOrder._id}
            </p>

            {/* Customer info */}
            <section style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>Customer</h2>
                {customer ? (
                    <div>
                        <div>
                            <strong>Name:</strong> {customer.name}
                        </div>
                        {customer.phone && (
                            <div>
                                <strong>Phone:</strong> {customer.phone}
                            </div>
                        )}
                        {customer.email && (
                            <div>
                                <strong>Email:</strong> {customer.email}
                            </div>
                        )}
                    </div>
                ) : (
                        <p>No customer information.</p>
                    )}
            </section>

            {/* Complaint / notes / odometer / diagnosis */}
            <section style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>Work Details</h2>
                <div>
                    <div>
                        <strong>Complaint:</strong>{' '}
                        {workOrder.complaint || (
                            <span style={{ color: '#999' }}>Not set</span>
                        )}
                    </div>
                    <div>
                        <strong>Diagnosis:</strong>{' '}
                        {workOrder.diagnosis || (
                            <span style={{ color: '#999' }}>Not set</span>
                        )}
                    </div>
                    <div>
                        <strong>Odometer:</strong>{' '}
                        {typeof workOrder.odometer === 'number' ? (
                            workOrder.odometer
                        ) : (
                                <span style={{ color: '#999' }}>Not set</span>
                            )}
                    </div>
                    <div>
                        <strong>Notes:</strong>{' '}
                        {workOrder.notes || (
                            <span style={{ color: '#999' }}>No notes</span>
                        )}
                    </div>
                </div>
            </section>

            {/* Status + dates */}
            <section style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>Status & Dates</h2>
                <div>
                    <div>
                        <strong>Status:</strong> {workOrder.status}
                    </div>
                    {workOrder.date && (
                        <div>
                            <strong>Date:</strong>{' '}
                            {new Date(workOrder.date).toLocaleDateString()}
                        </div>
                    )}
                    {workOrder.createdAt && (
                        <div>
                            <strong>Created:</strong>{' '}
                            {new Date(workOrder.createdAt).toLocaleString()}
                        </div>
                    )}
                    {workOrder.updatedAt && (
                        <div>
                            <strong>Last Updated:</strong>{' '}
                            {new Date(workOrder.updatedAt).toLocaleString()}
                        </div>
                    )}
                </div>
            </section>

            {/* Actions */}
            <section>
                <h2 style={{ marginBottom: '0.5rem' }}>Actions</h2>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={handleEdit}>Edit</button>
                    <button onClick={handleMarkComplete}>Mark Complete</button>
                    <button onClick={handleGenerateInvoice}>Generate Invoice</button>
                </div>
            </section>
        </div>
    );
}
