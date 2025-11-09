// src/pages/CustomersPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Customer } from '../types/api'
import { fetchCustomers } from '../api/customers'

function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                setError(null)
                const data = await fetchCustomers()
                setCustomers(data)
            } catch (err) {
                console.error(err)
                setError('Unable to load customers.')
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [])

    const handleViewWorkOrders = (customer: Customer) => {
        const fullName = `${customer.firstName} ${customer.lastName}`.trim()
        const params = new URLSearchParams({
            customerId: customer._id,
            customerName: fullName,
        })

        navigate(`/work-orders?${params.toString()}`)
    }

    if (loading) return <p>Loading customers...</p>
    if (error) return <p style={{ color: 'red' }}>{error}</p>

    if (customers.length === 0) {
        return (
            <div>
                <h2>Customers</h2>
                <p>No customers found.</p>
            </div>
        )
    }

    return (
        <div>
            <h2>Customers</h2>
            <p style={{ margin: '0.25rem 0 1rem', color: '#555', fontSize: '0.9rem' }}>
                Click &ldquo;View Work Orders&rdquo; to jump straight to this customer&apos;s jobs.
      </p>

            <table
                style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginTop: '0.5rem',
                    fontSize: '0.9rem',
                }}
            >
                <thead>
                    <tr style={{ background: '#f3f3f3' }}>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '0.4rem' }}>
                            Name
            </th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '0.4rem' }}>
                            Contact
            </th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '0.4rem' }}>
                            Vehicle
            </th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '0.4rem' }}>
                            Created
            </th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '0.4rem' }}>
                            Actions
            </th>
                    </tr>
                </thead>
                <tbody>
                    {customers.map((c, index) => {
                        const fullName = `${c.firstName} ${c.lastName}`.trim()
                        const vehicle =
                            (c.vehicleYear ? `${c.vehicleYear} ` : '') +
                            [c.vehicleMake, c.vehicleModel].filter(Boolean).join(' ')
                        const rowBg = index % 2 === 0 ? '#fff' : '#fafafa'

                        return (
                            <tr key={c._id} style={{ background: rowBg }}>
                                <td style={{ borderBottom: '1px solid #eee', padding: '0.4rem' }}>{fullName}</td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '0.4rem' }}>
                                    <div>{c.phone || '-'}</div>
                                    <div style={{ color: '#555' }}>{c.email || ''}</div>
                                </td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '0.4rem' }}>
                                    {vehicle || '-'}
                                </td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '0.4rem' }}>
                                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}
                                </td>
                                <td style={{ borderBottom: '1px solid #eee', padding: '0.4rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleViewWorkOrders(c)}
                                        style={{
                                            padding: '0.25rem 0.6rem',
                                            fontSize: '0.8rem',
                                            borderRadius: '4px',
                                            border: '1px solid #1f74d4',
                                            background: '#1f74d4',
                                            color: '#fff',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        View Work Orders
                  </button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export default CustomersPage
