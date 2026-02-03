// src/components/layout/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar: React.FC = () => {
    const linkBase =
        'block px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700';

    return (
        <aside className="w-64 bg-gray-100 dark:bg-black-000 h-screen p-4">
            <h1 className="text-xl font-bold mb-6">Shop Service Manager</h1>
            <nav className="space-y-2">
                <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                        `${linkBase} ${isActive ? 'bg-gray-300 dark:bg-gray-800' : ''}`
                    }
                >
                    Dashboard
        </NavLink>
                <NavLink
                    to="/work-orders"
                    className={({ isActive }) =>
                        `${linkBase} ${isActive ? 'bg-gray-300 dark:bg-gray-800' : ''}`
                    }
                >
                    Work Orders
        </NavLink>
                <NavLink
                    to="/customers"
                    className={({ isActive }) =>
                        `${linkBase} ${isActive ? 'bg-gray-300 dark:bg-gray-800' : ''}`
                    }
                >
                    Customers
        </NavLink>
                <NavLink
                    to="/vehicles"
                    className={({ isActive }) =>
                        `${linkBase} ${isActive ? 'bg-gray-300 dark:bg-gray-800' : ''}`
                    }
                    >
                    Vehicles
                 </NavLink>

            </nav>
        </aside>
    );
};

export default Sidebar;
