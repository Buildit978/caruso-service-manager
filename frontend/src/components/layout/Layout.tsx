// src/components/layout/Layout.tsx
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSettingsAccess } from '../../contexts/SettingsAccessContext'
import { useAccess } from '../../contexts/AccessContext'

interface LayoutProps {
    children: ReactNode
}

function Layout({ children }: LayoutProps) {
    const location = useLocation()
    const { hasAccess } = useSettingsAccess()
    const { customersAccess, vehiclesAccess } = useAccess()

    const linkStyle = (path: string) => ({
        display: 'block',
        padding: '0.35rem 0.6rem',
        marginBottom: '0.25rem',
        borderRadius: '4px',
        textDecoration: 'none',
        fontSize: '0.9rem',
        color: location.pathname === path ? '#fff' : '#e5e7eb',
        background: location.pathname === path ? '#1f74d4' : 'transparent',
    })

    const disabledLinkStyle = (path: string) => ({
        ...linkStyle(path),
        opacity: 0.5,
        cursor: 'not-allowed',
        pointerEvents: 'none' as const,
    })

    return (
        <div
            style={{
                display: 'flex',
                minHeight: '100vh',
                width: '100%',
                background: '#020617',
                color: '#e5e7eb',
            }}
        >
            <aside
                style={{
                    width: '220px',
                    padding: '1rem',
                    borderRight: '1px solid #1f2937',
                    background: '#020617',
                    flexShrink: 0,
                    position: 'sticky',
                    top: 0,
                    height: '100vh',
                    overflowY: 'auto',
                }}
            >
                <h1
                    style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        marginBottom: '0.75rem',
                    }}
                >
                    Caruso Service Manager
        </h1>
                <nav>
                    <Link to="/" style={linkStyle('/')}>
                        Dashboard
          </Link>
                    <Link to="/work-orders" style={linkStyle('/work-orders')}>
                        Work Orders
          </Link>
                    
                    {/* Customers link: hide only if server confirmed 403 (customersAccess === false) */}
                    {customersAccess !== false && (
                        <Link to="/customers" style={linkStyle('/customers')}>
                            Customers
                        </Link>
                    )}

                    {/* Vehicles link: hide only if server confirmed 403 (vehiclesAccess === false) */}
                    {vehiclesAccess !== false && (
                        <Link to="/vehicles" style={linkStyle('/vehicles')}>
                            Vehicles
                        </Link>
                    )}
                    
                    {/* Settings link: hide only if server confirmed 403 (hasAccess === false) */}
                    {hasAccess !== false && (
                        <Link to="/settings" style={linkStyle('/settings')}>
                            Settings
                        </Link>
                    )}
                    
                </nav>
                <p
                    style={{
                        marginTop: '1rem',
                        fontSize: '0.8rem',
                        color: '#9ca3af',
                    }}
                >
                    (We&apos;ll polish this sidebar later.)
        </p>
            </aside>

            <main
                style={{
                    flex: 1,
                    padding: '1.5rem 2rem',
                }}
            >
                {children}
            </main>
        </div>
    )
}

export default Layout
