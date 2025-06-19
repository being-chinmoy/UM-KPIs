// src/components/DashboardView.js
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig'; // Import auth and db
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore'; // Import Firestore functions
import UpdateKpiModal from './UpdateKpiModal';
import AdminPanel from './AdminPanel'; // Import the new AdminPanel

// Reusable component for displaying a single KPI card
const KPICard = ({ kpi, onUpdateClick }) => {
    // Calculate progress percentage, handling non-numeric targets/values
    const progressPercentage = typeof kpi.monthlyTarget === 'number' && typeof kpi.currentValue === 'number'
        ? Math.min(100, (kpi.currentValue / kpi.monthlyTarget) * 100).toFixed(0)
        : null;

    // Determine progress bar color based on percentage
    let progressBarColor = 'bg-gray-300';
    if (progressPercentage !== null) {
        if (progressPercentage >= 100) {
            progressBarColor = 'bg-green-500';
        } else if (progressPercentage >= 75) {
            progressBarColor = 'bg-yellow-500';
        } else {
            progressBarColor = 'bg-red-500';
        }
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6 border-b-4 border-blue-500 hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
            <div>
                <h3 className="text-xl font-semibold text-blue-700 mb-2">{kpi.kpiName}</h3>
                {kpi.description && (
                    <p className="text-gray-600 text-sm mb-3">{kpi.description}</p>
                )}
                <div className="flex justify-between items-center mb-2">
                    <p className="text-gray-700 font-medium">Target: <span className="font-bold">{kpi.monthlyTarget}</span></p>
                    <p className="text-gray-700 font-medium">Achieved: <span className="font-bold">{kpi.currentValue}</span></p>
                </div>

                {progressPercentage !== null && (
                    <>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div
                                className={`h-2.5 rounded-full ${progressBarColor}`}
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                        </div>
                        <p className="text-right text-sm text-gray-500 mt-1">{progressPercentage}% Achieved</p>
                    </>
                )}

                <p className="text-gray-500 text-xs mt-3">Reporting: {kpi.reportingFormat}</p>
            </div>
            <button
                onClick={() => onUpdateClick(kpi)}
                className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300"
            >
                Update KPI
            </button>
        </div>
    );
};

// Component to display a section of KPIs (non-collapsible for the main section)
const KPISection = ({ title, kpis, onUpdateClick }) => {
    return (
        <section className="mb-10 p-6 bg-white rounded-lg shadow-xl max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-blue-800 mb-6 border-b-2 border-blue-200 pb-3">{title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {kpis.map(kpi => (
                    <KPICard key={kpi.id} kpi={kpi} onUpdateClick={onUpdateClick} />
                ))}
            </div>
        </section>
    );
};

// Component for collapsible KPI sections
const CollapsibleKPISection = ({ title, kpis, onUpdateClick }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <section className="mb-10 p-6 bg-white rounded-lg shadow-xl max-w-7xl mx-auto">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full text-left text-2xl font-bold text-blue-800 mb-4 pb-3 border-b-2 border-blue-200 focus:outline-none"
            >
                <span>{title}</span>
                {/* Icon for collapse/expand */}
                <span className="text-blue-500 transition-transform duration-300 transform">
                    {isOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </span>
            </button>
            {isOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 transition-all duration-500 ease-in-out">
                    {kpis.map(kpi => (
                        <KPICard key={kpi.id} kpi={kpi} onUpdateClick={onUpdateClick} />
                    ))}
                </div>
            )}
        </section>
    );
};


// Main Dashboard View Component
const DashboardView = ({ userRole }) => {
    const [kpis, setKpis] = useState([]); // This will now hold user-specific assigned KPIs
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedKpi, setSelectedKpi] = useState(null);

    // Function to filter KPIs by category (now applied to user's assigned KPIs)
    const getKpisByCategory = (category) => kpis.filter(kpi => kpi.category === category);

    useEffect(() => {
        if (!auth.currentUser || !db) {
            setLoading(false);
            setError("Authentication or Database not ready.");
            return;
        }

        const userId = auth.currentUser.uid;
        const currentMonthYear = new Date().toISOString().substring(0, 7); // e.g., "2025-06"

        // Create a query to get KPIs assigned to the current user for the current month
        const q = query(
            collection(db, 'userKpis'),
            where('userId', '==', userId),
            where('submissionMonthYear', '==', currentMonthYear)
        );

        // Set up a real-time listener for user-specific KPIs
        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const userKpiList = snapshot.docs.map(doc => ({
                    id: doc.id, // The ID of the userKpi document itself
                    ...doc.data()
                }));

                // Group by category, just like before, using the kpiName from userKpis
                // For demonstration, we'll just set them directly.
                // In a real app, you might want more sophisticated grouping.
                setKpis(userKpiList);
                setLoading(false);
                setError(null);
            } catch (e) {
                console.error("Error fetching user KPIs from Firestore:", e);
                setError("Failed to load your assigned KPIs. Please try again later.");
                setLoading(false);
                // Fallback to mock data if Firestore fetch fails or if no KPIs are assigned
                // This mock data is temporary and should be removed once real data flow is stable.
                const mockKPIs = [
                    { id: 'mock1', kpiName: "Mock KPI 1 (No real data)", description: "This is a placeholder KPI.", monthlyTarget: 10, currentValue: 5, reportingFormat: "Mock Report", category: "common" },
                    { id: 'mock2', kpiName: "Mock KPI 2 (No real data)", description: "Another placeholder.", monthlyTarget: 'N/A', currentValue: 'Done', reportingFormat: "Mock Report", category: "ecosystem" }
                ];
                setKpis(mockKPIs);
            }
        }, (error) => {
            console.error("Error with Firestore snapshot listener:", error);
            setError("Failed to listen for KPI updates. Please check your connection.");
            setLoading(false);
            // Fallback to mock data on listener error
            const mockKPIs = [
                { id: 'mock1', kpiName: "Mock KPI 1 (No real data)", description: "This is a placeholder KPI.", monthlyTarget: 10, currentValue: 5, reportingFormat: "Mock Report", category: "common" },
                { id: 'mock2', kpiName: "Mock KPI 2 (No real data)", description: "Another placeholder.", monthlyTarget: 'N/A', currentValue: 'Done', reportingFormat: "Mock Report", category: "ecosystem" }
            ];
            setKpis(mockKPIs);
        });

        // Cleanup the listener when the component unmounts
        return () => unsubscribe();
    }, [auth.currentUser, db]); // Rerun effect if auth.currentUser or db changes

    // Function to handle saving updated KPI data to Firestore
    const handleSaveKpi = async (assignedKpiDocId, newValue, udyamMitraId) => {
        if (!db || !auth.currentUser) {
            setError("Database or authentication not ready for saving.");
            throw new Error("Database or authentication not ready.");
        }

        try {
            // Update the specific userKpi document in Firestore
            const userKpiRef = doc(db, 'userKpis', assignedKpiDocId);
            await updateDoc(userKpiRef, {
                currentValue: typeof newValue === 'number' ? newValue : String(newValue),
                lastUpdatedAt: new Date(),
                // udyamMitraId is already part of the document, no need to update it here
            });
            console.log('KPI submission recorded successfully in Firestore for doc ID:', assignedKpiDocId);
            return true; // Indicate success

        } catch (e) {
            console.error("Error submitting KPI update to Firestore:", e);
            setError(`Failed to submit KPI update: ${e.message}`);
            throw e; // Re-throw to be caught by the modal
        }
    };


    // Conditional rendering: Show AdminPanel if userRole is 'admin'
    if (userRole === 'admin') {
      return <AdminPanel />;
    }

    // Default rendering for 'udyamMitra' or 'guest' roles
    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <header className="mb-8 text-center">
                <h1 className="text-4xl font-extrabold text-blue-800 tracking-tight">Udyam Mitra KPI Dashboard</h1>
                <p className="text-xl text-gray-600 mt-2">Tracking Key Performance Indicators for Udyam Mitras</p>
                {error && <p className="text-red-500 mt-2">{error}</p>}
            </header>

            {loading ? (
                <div className="text-center text-lg mt-10 text-blue-600">Loading KPI data...</div>
            ) : (
                <>
                    {/* Render sections based on fetched categories or a default structure */}
                    {kpis.length > 0 ? (
                        <>
                            {/* Dynamically create KPI sections based on unique categories in fetched data */}
                            {Array.from(new Set(kpis.map(k => k.category))).map(category => (
                                <CollapsibleKPISection
                                    key={category}
                                    title={category}
                                    kpis={getKpisByCategory(category)}
                                    onUpdateClick={(kpi) => { setSelectedKpi(kpi); setShowModal(true); }}
                                />
                            ))}
                        </>
                    ) : (
                        <div className="text-center text-lg mt-10 text-gray-500">
                            No KPIs assigned for this month. Please contact your administrator.
                            {/* Optionally, display mock data if no assigned KPIs and not an error */}
                        </div>
                    )}
                </>
            )}

            {/* Render the modal if showModal is true and a KPI is selected */}
            {showModal && selectedKpi && (
                <UpdateKpiModal
                    kpi={selectedKpi}
                    onClose={() => setShowModal(false)}
                    onSave={handleSaveKpi}
                />
            )}
        </div>
    );
};

export default DashboardView; // Export DashboardView as default from this file
