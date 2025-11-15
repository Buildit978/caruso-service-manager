import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

type Customer = {
    _id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    phone?: string;
    email?: string;
    address?: string;
};

type WorkOrder = {
    _id: string;
    customerId?: Customer; // populated from backend
    complaint: string;
    diagnosis?: string;
    notes?: string;
    odometer?: number;
    status: string;
    // ... any other fields you already have
};

export default function WorkOrderEditPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // 👉 this is the work order we're editing
    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);

    const [form, setForm] = useState({
        complaint: '',
        diagnosis: '',
        notes: '',
        odometer: '',
        status: '',
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const load = async () => {
            try {
                const res = await fetch(`http://localhost:4000/api/work-orders/${id}`);
                if (!res.ok) {
                    throw new Error(`Failed to load work order (${res.status})`);
                }
                const data = await res.json();

                // keep full work order (with customer) here
                setWorkOrder(data);

                // and copy the editable fields into the form
                setForm({
                    complaint: data.complaint || '',
                    diagnosis: data.diagnosis || '',
                    notes: data.notes || '',
                    odometer:
                        data.odometer !== undefined && data.odometer !== null
                            ? String(data.odometer)
                            : '',
                    status: data.status || '',
                });
            } catch (err) {
                console.error('Error loading work order', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [id]);

    // 👉 derive customer + display name from workOrder
    const customer = workOrder?.customerId;

    const customerName =
        customer?.fullName ||
        `${customer?.firstName ?? ''} ${customer?.lastName ?? ''}`.trim() ||
        '(No name)';

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
    ) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const res = await fetch(`http://localhost:4000/api/work-orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...form,
                odometer:
                    form.odometer.trim() === ''
                        ? undefined
                        : Number(form.odometer.trim()),
            }),
        });

        if (res.ok) {
            alert('✅ Work order updated');
            navigate(`/work-orders/${id}`);
        } else {
            alert('❌ Failed to update work order');
        }
    };

    if (loading) return <div style={{ padding: '1rem' }}>Loading...</div>;

    return (
        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '720px' }}>
                {/* Header row */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1.5rem',
                    }}
                >
                    <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>
                        Edit Work Order
          </h1>

                    <button
                        type="button"
                        onClick={() => navigate(`/work-orders/${id}`)}
                        style={{
                            fontSize: '0.9rem',
                            padding: '0.4rem 0.9rem',
                            borderRadius: '0.4rem',
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            color: '#0f172a',
                        }}
                    >
                        Back
          </button>
                </div>

                {/* Card */}
                <div
                    style={{
                        width: '100%',
                        padding: '1.25rem 1.5rem',
                        borderRadius: '0.75rem',
                        background: '#020617',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                    }}
                >
                    {/* CUSTOMER CONTEXT */}
                    {customer && (
                        <section
                            style={{
                                marginBottom: '1.25rem',
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                border: '1px solid #1f2937',
                                background: '#020617',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                fontSize: '0.9rem',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600 }}>{customerName}</div>
                                    <div style={{ color: '#9ca3af' }}>
                                        {customer.phone && <>📞 {customer.phone}</>}
                                        {customer.phone && customer.email && ' · '}
                                        {customer.email && <>✉️ {customer.email}</>}
                                    </div>
                                    {customer.address && (
                                        <div style={{ color: '#9ca3af' }}>{customer.address}</div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            `/customers/${customer._id}/edit?returnTo=/work-orders/${workOrder?._id}/edit`
                                        )
                                    }
                                    style={{
                                        fontSize: '0.8rem',
                                        padding: '0.3rem 0.7rem',
                                        borderRadius: '0.4rem',
                                        border: '1px solid #4b5563',
                                        background: 'transparent',
                                        color: '#e5e7eb',
                                        cursor: 'pointer',
                                        height: 'fit-content',
                                    }}
                                >
                                    Edit Customer
                </button>
                            </div>
                        </section>
                    )}

                    {/* FORM */}
                    <form
                        onSubmit={handleSubmit}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            margin: 0,
                            padding: 0,
                        }}
                    >
                        <label
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                fontSize: '0.9rem',
                            }}
                        >
                            <span>Complaint</span>
                            <textarea
                                name="complaint"
                                value={form.complaint}
                                onChange={handleChange}
                                rows={4}
                                style={{
                                    width: '100%',
                                    marginTop: '0.25rem',
                                    marginBottom: '0.25rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #4b5563',
                                    backgroundColor: '#303036',
                                    fontSize: '1rem',
                                    lineHeight: '1.4',
                                    resize: 'vertical',
                                }}
                            />
                        </label>

                        <label
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                fontSize: '0.9rem',
                            }}
                        >
                            <span>Diagnosis</span>
                            <textarea
                                name="diagnosis"
                                value={form.diagnosis}
                                onChange={handleChange}
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #475569',
                                    fontSize: '1rem',
                                    lineHeight: '1.4',
                                    resize: 'vertical',
                                }}
                            />
                        </label>

                        <label
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                fontSize: '0.9rem',
                            }}
                        >
                            <span>Notes</span>
                            <textarea
                                name="notes"
                                value={form.notes}
                                onChange={handleChange}
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #475569',
                                    fontSize: '1rem',
                                    lineHeight: '1.4',
                                    resize: 'vertical',
                                }}
                            />
                        </label>

                        <label
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                fontSize: '0.9rem',
                            }}
                        >
                            <span>Odometer</span>
                            <input
                                name="odometer"
                                value={form.odometer}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #475569',
                                    fontSize: '1rem',
                                }}
                            />
                        </label>

                        <label
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                fontSize: '0.9rem',
                            }}
                        >
                            <span>Status</span>
                            <select
                                name="status"
                                value={form.status}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #475569',
                                    fontSize: '1rem',
                                }}
                            >
                                <option value="">Select status</option>
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="invoiced">Invoiced</option>
                            </select>
                        </label>

                        <div
                            style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}
                        >
                            <button
                                type="submit"
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    background: '#2563eb',
                                    color: '#fff',
                                    fontWeight: 500,
                                    fontSize: '0.95rem',
                                }}
                            >
                                Save
              </button>
                            <button
                                type="button"
                                onClick={() => navigate(`/work-orders/${id}`)}
                                style={{
                                    padding: '0.5rem 1.1rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #475569',
                                    background: 'transparent',
                                    color: '#e5e7eb',
                                    fontSize: '0.95rem',
                                }}
                            >
                                Cancel
              </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
