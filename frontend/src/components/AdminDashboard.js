// frontend/src/components/AdminDashboard.js
import React, { useState } from 'react';
// Removed useAuth import as it's not directly used in this component. Child components will import it.
import DashboardView from './DashboardView'; // Import the DashboardView component
import UserManagement from './UserManagement'; // User Management component
import KpiManagement from './KpiManagement'; // KPI Management component

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('user-management'); // 'user-management', 'kpi-management', 'view-user-kpis'
    const [selectedUdyamMitra, setSelectedUdyamMitra] = useState(null); // User object from Firebase Auth

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
                    <>
                        {/* WARNING: This section relies on the 'GetUsers' and 'SetUserRole' Azure Functions. */}
                        {/* If these functions are not deployed in your 'kpifirestoredb-chinmoy-unique' Function App, */}
                        {/* this UserManagement component will likely show errors or empty lists. */}
                        <UserManagement onSelectUdyamMitra={(user) => {
                            setSelectedUdyamMitra(user);
                            setActiveTab('view-user-kpis');
                        }} />
                        <p className="text-red-500 text-center mt-4 text-sm">
                            Note: User Management requires 'GetUsers' and 'SetUserRole' Azure Functions to be deployed.
                        </p>
                    </>
                )}

                {activeTab === 'kpi-management' && (
                    <>
                        {/* WARNING: This section's full functionality (e.g., assigning KPIs) */}
                        {/* would ideally rely on an 'AssignKPIsToUser' Azure Function. */}
                        {/* Currently, it will only use GetKPIs and UpdateKpiSubmission to manage master KPI definitions. */}
                        <KpiManagement />
                        <p className="text-orange-500 text-center mt-4 text-sm">
                            Note: KPI Assignment features are limited without 'AssignKPIsToUser' Azure Function.
                        </p>
                    </>
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
