// src/components/AdminDashboard.js
import React, { useState } from 'react'; // Removed useCallback as it's no longer used in this component
import { useAuth } from '../AuthContext'; // Keeping useAuth import as it's conceptually used by child components
import DashboardView from './DashboardView'; // Import the new DashboardView component
import UserManagement from './UserManagement'; // New component for user management
import KpiManagement from './KpiManagement'; // New component for KPI management

const AdminDashboard = () => {
    // No direct destructuring from useAuth() here as currentUser, userToken are not directly used
    // in AdminDashboard's logic or JSX. Child components will access useAuth directly if needed.
    // This resolves the 'Unexpected empty object pattern' warning.
    
    const [activeTab, setActiveTab] = useState('user-management'); // 'user-management', 'kpi-management', 'view-user-kpis'
    const [selectedUdyamMitra, setSelectedUdyamMitra] = useState(null); // User object from Firebase Auth

    // The fetchKpiDataForAdminView was a placeholder and is no longer needed.
    // DashboardView now handles its own fetching logic based on the targetUidForAdminView prop.
    // This part of the code has been entirely removed from the component to resolve the 'never used' warning.

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <header className="mb-8 text-center">
                <h1 className="text-4xl font-extrabold text-blue-800 tracking-tight">Admin Dashboard</h1>
                <p className="text-xl text-gray-600 mt-2">Manage Users and Key Performance Indicators</p>
                <div className="mt-6 flex justify-center space-x-4">
                    <button
                        onClick={() => { setActiveTab('user-management'); setSelectedUdyamMitra(null); }}
                        className={`py-2 px-6 rounded-full font-semibold transition duration-300 ${activeTab === 'user-management' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                    >
                        User Management
                    </button>
                    <button
                        onClick={() => { setActiveTab('kpi-management'); setSelectedUdyamMitra(null); }}
                        className={`py-2 px-6 rounded-full font-semibold transition duration-300 ${activeTab === 'kpi-management' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                    >
                        KPI Management
                    </button>
                </div>
            </header>

            <main>
                {activeTab === 'user-management' && !selectedUdyamMitra && (
                    <UserManagement onSelectUdyamMitra={(user) => {
                        setSelectedUdyamMitra(user);
                        setActiveTab('view-user-kpis');
                    }} />
                )}

                {activeTab === 'kpi-management' && (
                    <KpiManagement />
                )}

                {activeTab === 'view-user-kpis' && selectedUdyamMitra && (
                    <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-xl p-6 mb-10">
                        <h2 className="text-3xl font-bold text-blue-700 mb-4">
                            KPI Dashboard for {selectedUdyamMitra.displayName || selectedUdyamMitra.email}
                        </h2>
                        <button
                            onClick={() => { setSelectedUdyamMitra(null); setActiveTab('user-management'); }}
                            className="mb-6 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300"
                        >
                            ← Back to User Management
                        </button>
                        {/* Re-use the DashboardView but pass the selected user's UID */}
                        <DashboardView targetUidForAdminView={selectedUdyamMitra.uid} />
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
