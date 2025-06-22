// frontend/src/components/KpiManagement.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import KpiEditModal from './KpiEditModal';

const kpiCategories = [
    { value: 'common', label: 'Common KPIs' },
    { value: 'ecosystem', label: 'Ecosystem and Enterprise Development' },
    { value: 'hospitality', label: 'Hospitality and Tourism Sector' },
    { value: 'agriForest', label: 'Agri industries, Forest based industries, Animal Husbandry Sector' },
    { value: 'dbmsMIS', label: 'DBMS, MIS, Enterprise Portal Synergies' },
];

const KpiManagement = () => {
    const { userToken } = useAuth();
    const [kpis, setKpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showKpiModal, setShowKpiModal] = useState(false);
    const [selectedKpi, setSelectedKpi] = useState(null);

    // Using environment variables for API URL and keys
    const FUNCTION_APP_BASE_URL = process.env.REACT_APP_FUNCTION_APP_BASE_URL;
    const GET_KPIS_KEY = process.env.REACT_APP_GET_KPIS_KEY; 
    const UPDATE_KPI_SUBMISSION_KEY = process.env.REACT_APP_UPDATE_KPI_SUBMISSION_KEY;

    const ASSIGN_KPIS_TO_USER_KEY = process.env.REACT_APP_ASSIGN_KPIS_TO_USER_KEY; // Placeholder for future KPI assignment UI/logic


    const fetchAllKpis = useCallback(async () => {
        setLoading(true);
        setError(null);
        if (!userToken) {
            setError("Admin token not available. Cannot fetch KPIs.");
            setLoading(false);
            return;
        }

        // Basic check for missing environment variables
        if (!FUNCTION_APP_BASE_URL || !GET_KPIS_KEY) {
            setError("API URL or GetKPIs key is not configured in environment variables. Cannot fetch KPIs.");
            setLoading(false);
            return;
        }

        try {
            // Admin fetches all KPIs using GetKPIs with their admin token and function key
            const response = await fetch(`${FUNCTION_APP_BASE_URL}/GetKPIs?code=${GET_KPIS_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    // No specific UID requested here; backend GetKPIs should understand admin role from token
                    // and return all master KPIs if called by an admin.
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 401 || response.status === 403) {
                    setError("Authorization error. You might not have admin permissions or your token expired. Please re-login.");
                } else {
                    setError(`Failed to fetch all KPIs: ${response.status} - ${errorText}`);
                }
                throw new Error(`Failed to fetch all KPIs: ${response.status} - ${errorText}`);
            } else {
                const data = await response.json();
                setKpis(data);
            }
        } catch (e) {
            console.error("Error fetching all KPIs for admin:", e);
            setError(`Error fetching all KPIs: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, [userToken, FUNCTION_APP_BASE_URL, GET_KPIS_KEY]); // Added env vars to dependencies

    useEffect(() => {
        if (userToken) {
            fetchAllKpis();
        }
    }, [fetchAllKpis, userToken]);

    const handleKpiSave = async (kpiData) => {
        try {
            // Basic check for missing environment variables
            if (!FUNCTION_APP_BASE_URL || !UPDATE_KPI_SUBMISSION_KEY) {
                setError("API URL or UpdateKpiSubmission key is not configured in environment variables. Cannot save KPI.");
                throw new Error("Missing environment variable for KPI submission.");
            }

            // Reuse UpdateKpiSubmission for saving/updating master KPI definitions
            const updateKpiUrl = `${FUNCTION_APP_BASE_URL}/UpdateKpiSubmission?code=${UPDATE_KPI_SUBMISSION_KEY}`;

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
                    // When admin updates master KPI metadata, submittedValue and udyamMitraId might not be relevant.
                    // Your UpdateKpiSubmission function should be robust enough to handle these optional fields
                    // or have separate logic for 'master data' updates vs 'user submissions'.
                    // For now, it will update the master KPI document's fields if it exists.
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


    if (!userToken) {
        return <div className="text-center text-lg mt-10 text-gray-500">Waiting for admin token...</div>;
    }

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
                    kpi={selectedKpi}
                    onClose={() => setShowKpiModal(false)}
                    onSave={handleKpiSave}
                    kpiCategories={kpiCategories}
                />
            )}
        </div>
    );
};

export default KpiManagement;
