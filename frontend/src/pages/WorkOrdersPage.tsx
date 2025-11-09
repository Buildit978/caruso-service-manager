// src/pages/WorkOrdersPage.tsx
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { WorkOrder, WorkOrderStatus } from '../types/api'
import { fetchWorkOrders } from '../api/workOrders'

type StatusFilter = WorkOrderStatus | 'ALL'

const statusOptions: StatusFilter[] = ['ALL', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

function WorkOrdersPage() {
    const [searchParams] = useSearchParams()
    const initialCustomerId = searchParams.get('customerId') || ''
    const customerName = searchParams.get('customerName') || ''

    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
    const [customerIdFilter, setCustomerIdFilter] = useState(initialCustomerId)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = async (status: StatusFilter, customerId: string) => {
        try {
            setLoading(true)
            setError(null)

            const filters: { status?: WorkOrderStatus; customerId?: string } = {}

            if (status !== 'ALL') filters.status = status
            if (customerId) filters.customerId = customerId

            const data = await fetchWorkOrders(filters)
            setWorkOrders(data)
        } catch (err) {
            console.error(err)
            setError('Unable to load work orders.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Keep state in sync with URL if user lands here from /customers
        setCustomerIdFilter(initialCustomerId)
    }, [initialCustomerId])

    useEffect(() => {
        void load(statusFilter, customerIdFilter)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, customerIdFilter])

    const clearCustomerFilter = () => {
        setCustomerIdFilter('')
    }

    return (
        <div>
            <h2>Work Orders</h2>

            {customerIdFilter && (
                <div
                    style={{
                        margin: '0.5rem 0 0.75rem',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        background: '#e6f0ff',
                        border: '1px solid #b3ceff',
                        fontSize: '0.85rem',
                    }}
                >
                    Viewing work orders for:{' '}
                    <strong>{customerName || customerIdFilter}</strong>
                    <button
                        type="button"
                        onClick={clearCustomerFilter}
                        style={{
                            marginLeft: '0.6rem',
                            padding: '0.1rem 0.4rem',
                            fontSize: '0.75rem',
                            borderRadius: '3px',
                            border: '1px solid #666',
                            background: '#fff',
                            cursor: 'pointer',
                        }}
                    >
                        Clear filter
          </button>
                </div>
            )}

            <div style={{ margin: '0.5rem 0 0.75rem' }}>
                <label style={{ marginRight: '0.5rem', fontSize: '0.9rem' }}>Status:</label>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.85rem' }}
                >
                    {statusOptions.map((status) => (
                        <option key={status} value={status}>
                            {status === 'ALL' ? 'All' : status.replace('_', ' ')}
                        </option>
                    ))}
                </select>
            </div>

            {loading && <p>Loading work orders...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && (
                <>
                    {workOrders.length === 0 ? (
                        <p>No work orders found.</p>
                    ) : (
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
                                            ID
                  </th>
                                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '0.4rem' }}>
                                            Description
                  </th>
                                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '0.4rem' }}>
                                            Status
                  </th>
                                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '0.4rem' }}>
                                            Total
                  </th>
                                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '0.4rem' }}>
                                            Created
                  </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workOrders.map((wo, index) => {
                                        const rowBg = index % 2 === 0 ? '#fff' : '#fafafa'
                                        return (
                                            <tr key={wo._id} style={{ background: rowBg }}>
                                                <td style={{ borderBottom: '1px solid #eee', padding: '0.4rem' }}>{wo._id}</td>
                                                <td style={{ borderBottom: '1px solid #eee', padding: '0.4rem' }}>{wo.description}</td>
                                                <td style={{ borderBottom: '1px solid #eee', padding: '0.4rem' }}>
                                                    {wo.status.replace('_', ' ')}
                                                </td>
                                                <td style={{ borderBottom: '1px solid #eee', padding: '0.4rem' }}>
                                                    {typeof wo.totalAmount === 'number' ? `$${wo.totalAmount.toFixed(2)}` : '-'}
                                                </td>
                                                <td style={{ borderBottom: '1px solid #eee', padding: '0.4rem' }}>
                                                    {new Date(wo.createdAt).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                </>
            )}
        </div>
    )
}

export default WorkOrdersPage
