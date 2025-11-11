import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function WorkOrderEditPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
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
            const res = await fetch(`http://localhost:4000/api/work-orders/${id}`);
            const data = await res.json();
            setForm({
                complaint: data.complaint || '',
                diagnosis: data.diagnosis || '',
                notes: data.notes || '',
                odometer: data.odometer || '',
                status: data.status || '',
            });
            setLoading(false);
        };
        load();
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch(`http://localhost:4000/api/work-orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
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
        <div style={{ padding: '1.5rem', maxWidth: 600 }}>
            <h1>Edit Work Order</h1>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label>
                    Complaint:
          <input name="complaint" value={form.complaint} onChange={handleChange} />
                </label>
                <label>
                    Diagnosis:
          <input name="diagnosis" value={form.diagnosis} onChange={handleChange} />
                </label>
                <label>
                    Notes:
          <textarea name="notes" value={form.notes} onChange={handleChange} />
                </label>
                <label>
                    Odometer:
          <input name="odometer" value={form.odometer} onChange={handleChange} />
                </label>
                <label>
                    Status:
          <select name="status" value={form.status} onChange={handleChange}>
                        <option value="">Select status</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="invoiced">Invoiced</option>
                    </select>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit">Save</button>
                    <button type="button" onClick={() => navigate(`/work-orders/${id}`)}>
                        Cancel
          </button>
                </div>
            </form>
        </div>
    );
}
