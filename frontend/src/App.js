// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext'; // Import useAuth hook
import { auth } from './firebaseConfig'; // Import auth instance for logout
import { signOut } from 'firebase/auth';
import UpdateKpiModal from './components/UpdateKpiModal';
import AdminDashboard from './components/AdminDashboard'; // New Admin Dashboard component


// Import components
import Login from './components/Login';
import Signup from './components/Signup';

// Mock KPI data (will only be used as a fallback if backend fails completely on first fetch,
// otherwise real data from Azure will populate the dashboard.
// This array is intentionally defined outside components so it's a stable reference.
const mockKPIs = [
  { id: 'common1', kpiName: "Enterprise Interactions (Field Visits)", description: "No. of MSMEs, SHGs, informal enterprises met (field grievances)", monthlyTarget: 10, currentValue: 0, reportingFormat: "Field Visit Report with geo-tagged photos", category: "common" },
  { id: 'common2', kpiName: "Beneficiary Grievances Resolved", description: "Grievances addressed for field enterprises", monthlyTarget: 10, currentValue: 0, reportingFormat: "Google Sheet", category: "common" },
  { id: 'common3', kpiName: "Baseline Surveys or Field Assessments", description: "Surveys conducted for ground mapping", monthlyTarget: 4, currentValue: 0, reportingFormat: "Google Sheet", category: "common" },
  { id: 'common4', kpiName: "Scheme Applications Facilitated", description: "Applications in PMFME, PMEGP, UDYAM, E-Shram, etc.", monthlyTarget: 10, currentValue: 0, reportingFormat: "Google Sheet", category: "common" },
  { id: 'common5', kpiName: "Follow-ups on Scheme Applications", description: "Tracking and facilitating pending cases", monthlyTarget: 5, currentValue: 0, reportingFormat: "Tracking Sheet with outcome status", category: "common" },
  { id: 'common6', kpiName: "Workshops / EDP Organized", description: "Mobilization, awareness events", monthlyTarget: 2, currentValue: 0, reportingFormat: "Attendance sheets, photos, videos", category: "common" },
  { id: 'common7', kpiName: "Financial Literacy or Formalization Support", description: "1-to-1 guidance on PAN, GST, Udyam, New Industrial Policy, etc.", monthlyTarget: 10, currentValue: 0, reportingFormat: "Documentation list, Google Sheet", category: "common" },
  { id: 'common8', kpiName: "New Enterprise Cases Identified", description: "New informal businesses identified and profiled", monthlyTarget: 5, currentValue: 0, reportingFormat: "Enterprise profiling Google Sheet", category: "common" },
  { id: 'common9', kpiName: "Credit Linkage Facilitation", description: "Referrals to banks, NBFCs", monthlyTarget: 5, currentValue: 0, reportingFormat: "Bank interaction/follow-up record/ google sheet", category: "common" },
  { id: 'common10', kpiName: "Portal/MIS Updates & Data Entry", description: "Timely data updates in MIS/Google Sheets", monthlyTarget: 100, currentValue: 0, reportingFormat: "MIS Portal/Google Sheet", category: "common" },
  { id: 'common11', kpiName: "Convergence & Departmental Coordination", description: "Meetings with DICs, RD, Agri/Horti, etc.", monthlyTarget: 2, currentValue: 0, reportingFormat: "Meeting MoM or signed attendance list", category: "common" },
  { id: 'common12', kpiName: "Support to EDPs, RAMP, and Field Activities", description: "Participation in Enterprise Development Programs or RAMP", monthlyTarget: 'As per deployment', currentValue: 'Met', reportingFormat: "Program report signed by supervisor", category: "common" },
  { id: 'common13', kpiName: "Case Studies / Beneficiary Success Stories", description: "Documenting success stories from the field", monthlyTarget: 1, currentValue: 0, reportingFormat: "Minimum 500 words + image/video", category: "common" },
  { id: 'common14', kpiName: "Pollution/Pollutant Check", description: "Visit to Industrial Estate, and do proper reading of machine for pollution/pollutant", monthlyTarget: 2, currentValue: 0, reportingFormat: "Google sheet with geo tagged photos", category: "common" },

  { id: 'eco1', kpiName: "Loan Applications Supported", monthlyTarget: 5, currentValue: 0, reportingFormat: "Google Sheet", category: "ecosystem" },
  { id: 'eco2', kpiName: "Business Model/Plan Guidance Provided", monthlyTarget: 5, currentValue: 0, reportingFormat: "Google Sheet", category: "ecosystem" },
  { id: 'eco3', kpiName: "Artisans/Entrepreneurs Linked to Schemes", monthlyTarget: 10, currentValue: 0, reportingFormat: "Google Sheet", category: "ecosystem" },
  { id: 'eco4', kpiName: "Financial Literacy Sessions (Group) Conducted", monthlyTarget: 5, currentValue: 0, reportingFormat: "Photos/Videos/Google Sheet", category: "ecosystem" },
  { id: 'eco5', kpiName: "New Initiatives in Entrepreneurship Promotion", monthlyTarget: 1, currentValue: 0, reportingFormat: "Report/Google Sheet", category: "ecosystem" },
  { id: 'eco6', kpiName: "Enterprise/Business Ideas Scouted", monthlyTarget: 1, currentValue: 0, reportingFormat: "Report/Google Sheet", category: "ecosystem" },

  { id: 'hosp1', kpiName: "Tourism Potential Sites Documented or Supported", monthlyTarget: 2, currentValue: 0, reportingFormat: "Photos/Videos/Google Sheet", category: "hospitality" },
  { id: 'hosp2', kpiName: "Tourism Promotion Events / Community Engagements", monthlyTarget: 4, currentValue: 0, reportingFormat: "Photos/Videos/Google Sheet", category: "hospitality" },
  { id: 'hosp3', kpiName: "Homestays/Tour Operators Onboarded/Assisted", monthlyTarget: 5, currentValue: 0, reportingFormat: "Google Sheet", category: "hospitality" },
  { id: 'hosp4', kpiName: "Local Youth/SHGs Trained in Tourism/Hospitality Services", monthlyTarget: 10, currentValue: 0, reportingFormat: "Google Sheet", category: "hospitality" },

  { id: 'agri1', kpiName: "Agri/Forest-Based Enterprises Supported", monthlyTarget: 5, currentValue: 0, reportingFormat: "Google Sheet", category: "agriForest" },
  { id: 'agri2', kpiName: "SHGs Linked to Agri/Animal Husbandry/Processing Units", monthlyTarget: 3, currentValue: 0, reportingFormat: "Google Sheet", category: "agriForest" },

  { id: 'dbms1', kpiName: "Portal/MIS Data Entry & Monitoring", monthlyTarget: 100, currentValue: 0, reportingFormat: "Google Sheet, MIS Portal", category: "dbmsMIS" },
  { id: 'dbms2', kpiName: "Data Validation, Error Rectification, and Reporting", monthlyTarget: 'Monthly Review', currentValue: 'Completed', reportingFormat: "Issue logs, rectification reports via email", category: "dbmsMIS" },
  { id: 'dbms3', kpiName: "Collaboration with Line Departments and Portal Developers", monthlyTarget: 'Continuous', currentValue: 'Ongoing', reportingFormat: "Meeting Notes, Email Records", category: "dbmsMIS" },
];


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


// Main Dashboard View Component for Udyam Mitras
// Exported so AdminDashboard can re-use it to view specific user's KPIs
export const UdyamMitraDashboardView = ({ targetUidForAdminView }) => { // Added targetUidForAdminView prop
    const { currentUser, userToken } = useAuth(); 
    const [kpis, setKpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedKpi, setSelectedKpi] = useState(null);

    // Determine which UID to use for fetching KPIs
    // If targetUidForAdminView is provided (from AdminDashboard), use that.
    // Otherwise, use the current logged-in user's UID.
    const effectiveUid = targetUidForAdminView || currentUser?.uid;


    // Function to filter KPIs by category
    const getKpisByCategory = (category) => kpis.filter(kpi => kpi.category === category);

    // Use useCallback for fetchKpiData to memoize it and prevent unnecessary re-renders
    const fetchKpiData = useCallback(async () => {
        setLoading(true);
        setError(null);

        // Ensure user and token are available AND an effective UID is determined before attempting to fetch
        if (!currentUser || !userToken || !effectiveUid) {
            console.log('User not authenticated, token not available, or effective UID not determined. Not fetching KPIs.');
            setKpis(mockKPIs.map(kpi => ({ ...kpi, currentValue: 0 }))); // Fallback to mock data with 0s
            setLoading(false);
            return;
        }

        try {
            const getKpiUrl = `https://ambitious-wave-05ff35700.1.azurestaticapps.net/api/GetKPIs`;
            
            const response = await fetch(getKpiUrl, {
                method: 'POST', // Changed to POST to send UID in body for GetKPIs
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}` // Send the Firebase ID token
                },
                body: JSON.stringify({
                    requestedUid: effectiveUid, // Send the UID of the user whose KPIs are being requested
                    // You can also add month/year filters here if needed for GetKPIs
                    // monthYear: new Date().toISOString().substring(0, 7)
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                if (response.status === 401 || response.status === 403) {
                    setError("Authentication failed or token expired. Please try logging in again.");
                    // Optional: force a logout or redirect to login
                    // signOut(auth); 
                }
                throw new Error(`Failed to fetch KPIs: ${errorText}`);
            }
            const data = await response.json();
            
            // If no data is returned from backend, use mock data for initial display
            if (data.length === 0) {
                console.log("No KPIs returned from backend, initializing with mock data structure.");
                setKpis(mockKPIs.map(kpi => ({ ...kpi, currentValue: 0 }))); 
            } else {
                // Backend should ideally return full KPI objects with current values.
                // If it only returns current values, you might need to merge with a local master list.
                // For now, assuming backend returns full KPI objects including current values.
                setKpis(data);
            }

        } catch (e) {
            console.error("Failed to fetch data from backend:", e);
            setKpis(mockKPIs.map(kpi => ({ ...kpi, currentValue: 0 }))); // Fallback to mock data on *any* fetch error
            setError(`Failed to load real-time data from Azure: ${e.message}. Displaying initial KPI structure.`);
        } finally {
            setLoading(false);
        }
    }, [currentUser, userToken, effectiveUid]); // Added effectiveUid to useCallback dependencies

    // Function to handle saving updated KPI data to the backend
    const handleSaveKpi = async (kpiId, newValue) => { 
        // Ensure user and token are available before attempting to save
        if (!currentUser || !userToken) {
            console.error('User not authenticated or token not available, cannot save KPI.');
            setError('Authentication required to save KPI.');
            return false;
        }

        try {
            const updateKpiUrl = 'https://ambitious-wave-05ff35700.1.azurestaticapps.net/api/UpdateKpiSubmission'; 

            const response = await fetch(updateKpiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}` // Send the Firebase ID token
                },
                body: JSON.stringify({
                    kpiId: kpiId, 
                    submittedValue: newValue, 
                    udyamMitraId: currentUser.uid, // Use currentUser.uid directly for submission
                    submissionDate: new Date().toISOString(), 
                    submissionMonthYear: new Date().toISOString().substring(0, 7)
                }),
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: "Unknown error" }));
                console.error(`HTTP error! Status: ${response.status}. Details: ${errorBody.message || response.statusText}`);
                throw new Error(`HTTP error! Status: ${response.status}. Details: ${errorBody.message || response.statusText}`);
            }

            await fetchKpiData(); // This will refresh the dashboard with potentially updated current values
            return true; // Indicate success

        } catch (e) {
            console.error("Error submitting KPI update:", e);
            setError(`Failed to submit KPI update: ${e.message}`);
            throw e; // Re-throw to be caught by the modal
        }
    };

    // useEffect to call fetchKpiData when the component mounts or fetchKpiData changes
    useEffect(() => {
        // Trigger fetchKpiData when component mounts or currentUser/userToken changes
        if (currentUser && userToken) {
            // No need to pass effectiveUid here, it's captured by useCallback's closure
            fetchKpiData(); 
        }
    }, [fetchKpiData, currentUser, userToken]); 

    // Filter KPIs by category for display
    const commonKpis = getKpisByCategory('common');
    const ecosystemKpis = getKpisByCategory('ecosystem');
    const hospitalityKpis = getKpisByCategory('hospitality');
    const agriForestKpis = getKpisByCategory('agriForest');
    const dbmsMisKpis = getKpisByCategory('dbmsMIS');

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <header className="mb-8 text-center">
                <h1 className="text-4xl font-extrabold text-blue-800 tracking-tight">Udyam Mitra KPI Dashboard {targetUidForAdminView ? `for ${targetUidForAdminView}` : ''}</h1>
                <p className="text-xl text-gray-600 mt-2">Tracking Key Performance Indicators for Udyam Mitras</p>
                {error && <p className="text-red-500 mt-2">{error}</p>}
            </header>

            {loading ? (
                <div className="text-center text-lg mt-10 text-blue-600">Loading KPI data...</div>
            ) : (
                <>
                    <KPISection title="Applicable to All Udyam Mitras" kpis={commonKpis} onUpdateClick={(kpi) => { setSelectedKpi(kpi); setShowModal(true); }} />
                    <CollapsibleKPISection title="Udyam Mitra – Ecosystem and Enterprise Development (RM/UM/ArP-A)" kpis={ecosystemKpis} onUpdateClick={(kpi) => { setSelectedKpi(kpi); setShowModal(true); }} />
                    <CollapsibleKPISection title="Udyam Mitra – Hospitality and Tourism Sector (RM/UM/ArP-B)" kpis={hospitalityKpis} onUpdateClick={(kpi) => { setSelectedKpi(kpi); setShowModal(true); }} />
                    <CollapsibleKPISection title="Udyam Mitra – Agri industries, Forest based industries, Animal Husbandry Sector (RM/UM/ArP-C)" kpis={agriForestKpis} onUpdateClick={(kpi) => { setSelectedKpi(kpi); setShowModal(true); }} />
                    <CollapsibleKPISection title="Udyam Mitra – DBMS, MIS, Enterprise Portal Synergies (RM/UM/ArP-D)" kpis={dbmsMisKpis} onUpdateClick={(kpi) => { setSelectedKpi(kpi); setShowModal(true); }} />
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


// Main App Component (Handles Auth and Routes)
function App() {
    const { currentUser, loading, userRole } = useAuth(); // Get auth state and userRole from context
    const [showSignup, setShowSignup] = useState(false); // To toggle between login/signup

    // If still loading auth state, show a loading message
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 text-blue-600 text-xl">
                Loading authentication...
            </div>
        );
    }

    // If no user is logged in, show Login/Signup
    if (!currentUser) {
        return showSignup ? (
            <Signup onSignupSuccess={() => setShowSignup(false)} onSwitchToLogin={() => setShowSignup(false)} />
        ) : (
            <Login onLoginSuccess={() => setShowSignup(false)} onSwitchToSignup={() => setShowSignup(true)} />
        );
    }

    // If user is logged in, show the appropriate dashboard based on role
    return (
        <div className="relative">
            <button
                onClick={() => signOut(auth)}
                className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300 z-10"
            >
                Logout ({currentUser.email} {userRole ? `(${userRole})` : ''})
            </button>

            {userRole === 'admin' ? (
                <AdminDashboard />
            ) : ( // Default to udyamMitra or any non-admin role
                <UdyamMitraDashboardView /> 
            )}
        </div>
    );
}

export default App;
