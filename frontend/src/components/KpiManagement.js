// src/components/KpiManagement.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import KpiEditModal from './KpiEditModal'; // New modal for adding/editing KPIs

// Master list of KPI categories for dropdowns
const kpiCategories = [
    { value: 'common', label: 'Common KPIs' },
    { value: 'ecosystem', label: 'Ecosystem and Enterprise Development' },
    { value: 'hospitality', label: 'Hospitality and Tourism Sector' },
    { value: 'agriForest', label: 'Agri industries, Forest based industries, Animal Husbandry Sector' },
    { value: 'dbmsMIS', label: 'DBMS, MIS, Enterprise Portal Synergies' },
];

const KpiManagement = () => {
    const { userToken } = useAuth();
    const [kpis, setKpis] = useState([]); // This will be the master list of KPIs
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showKpiModal, setShowKpiModal] = useState(false);
    const [selectedKpi, setSelectedKpi] = useState(null); // For editing, null for new

    const API_BASE_URL = 'https://ambitious-wave-05ff35700.1.azurestaticapps.net/api';

    const fetchAllKpis = useCallback(async () => {
        setLoading(true);
        setError(null);
        if (!userToken) {
            setError("Admin token not available. Cannot fetch KPIs.");
            setLoading(false);
            return;
        }

        try {
            // Admin fetches all KPIs using GetKPIs with their admin token
            const response = await fetch(`${API_BASE_URL}/GetKPIs`, {
                method: 'POST', // GetKPIs now expects POST with requestedUid
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    // For admin, we don't request a specific UID's KPIs here,
                    // the backend will understand from the admin role token to fetch all.
                    // Or you could explicitly pass an 'admin' flag if needed for backend logic.
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch all KPIs: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            setKpis(data);
        } catch (e) {
            console.error("Error fetching all KPIs for admin:", e);
            setError(`Error fetching all KPIs: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, [userToken]);

    useEffect(() => {
        fetchAllKpis();
    }, [fetchAllKpis]);

    const handleKpiSave = async (kpiData) => {
        // This function will be called by KpiEditModal for both new and existing KPIs
        // This will reuse your existing UpdateKpiSubmission function
        try {
            const updateKpiUrl = `${API_BASE_URL}/UpdateKpiSubmission`;

            const response = await fetch(updateKpiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    kpiId: kpiData.id,
                    kpiName: kpiData.kpiName,
                    description: kpiData.description,
                    monthlyTarget: kpiData.monthlyTarget,
                    reportingFormat: kpiData.reportingFormat,
                    category: kpiData.category,
                    // For an admin "master" update, we don't necessarily update currentValue or submissionHistory
                    // The backend UpdateKpiSubmission is flexible enough to handle this.
                    // You might need to adjust UpdateKpiSubmission to differentiate admin metadata updates
                    // from user value submissions if that separation is critical.
                    // For now, it will update the master KPI document's fields.
                }),
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: "Unknown error" }));
                throw new Error(`Failed to save KPI: ${response.status}. Details: ${errorBody.message || response.statusText}`);
            }

            console.log('KPI saved successfully');
            setShowKpiModal(false);
            setSelectedKpi(null);
            fetchAllKpis(); // Refresh the list
            return true;

        } catch (e) {
            console.error("Error saving KPI:", e);
            setError(`Failed to save KPI: ${e.message}`);
            throw e;
        }
    };


    if (loading) return <div className="text-center text-lg mt-10">Loading KPIs...</div>;
    if (error) return <div className="text-center text-lg mt-10 text-red-500">{error}</div>;

    return (
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-blue-800 mb-6 border-b-2 border-blue-200 pb-3">Master KPI List</h2>
            <button
                onClick={() => { setSelectedKpi(null); setShowKpiModal(true); }}
                className="mb-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300"
            >
                Add New KPI
            </button>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-blue-100">
                        <tr>
                            <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-700">ID</th>
                            <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-700">Name</th>
                            <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-700">Target</th>
                            <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-700">Category</th>
                            <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {kpis.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="py-4 px-4 text-center text-gray-500">No master KPIs found. Add a new one!</td>
                            </tr>
                        ) : (
                            kpis.map(kpi => (
                                <tr key={kpi.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 border-b text-gray-700">{kpi.id}</td>
                                    <td className="py-3 px-4 border-b text-gray-700">{kpi.kpiName}</td>
                                    <td className="py-3 px-4 border-b text-gray-700">{kpi.monthlyTarget}</td>
                                    <td className="py-3 px-4 border-b text-gray-700 capitalize">{kpi.category}</td>
                                    <td className="py-3 px-4 border-b">
                                        <button
                                            onClick={() => { setSelectedKpi(kpi); setShowKpiModal(true); }}
                                            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-1 px-3 rounded transition duration-300"
                                        >
                                            Edit
                                        </button>
                                        {/* Optional: Add Delete button and API */}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showKpiModal && (
                <KpiEditModal
                    kpi={selectedKpi} // Will be null for new KPI
                    onClose={() => setShowKpiModal(false)}
                    onSave={handleKpiSave}
                    kpiCategories={kpiCategories}
                />
            )}
        </div>
    );
};

export default KpiManagement;
