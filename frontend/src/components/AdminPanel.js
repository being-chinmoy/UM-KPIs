// src/components/AdminPanel.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext'; // To access user role and db instance
import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';

const AdminPanel = () => {
    const { userRole, currentUser, db } = useAuth(); // Get db instance from context

    const [kpis, setKpis] = useState([]); // Master KPI definitions
    const [users, setUsers] = useState([]); // List of users for assignment
    const [assignedKpis, setAssignedKpis] = useState([]); // User-specific KPI assignments

    const [newKpiName, setNewKpiName] = useState('');
    const [newKpiDescription, setNewKpiDescription] = useState('');
    const [newKpiMonthlyTargetTemplate, setNewKpiMonthlyTargetTemplate] = useState('');
    const [newKpiReportingFormat, setNewKpiReportingFormat] = useState('');
    const [newKpiVerificationMethod, setNewKpiVerificationMethod] = useState('');
    const [newKpiCategory, setNewKpiCategory] = useState('');
    const [newKpiIsNumericTarget, setNewKpiIsNumericTarget] = useState(true);
    const [createKpiLoading, setCreateKpiLoading] = useState(false);
    const [createKpiError, setCreateKpiError] = useState(null);
    const [createKpiSuccess, setCreateKpiSuccess] = useState(false);

    const [selectedKpiToAssign, setSelectedKpiToAssign] = useState('');
    const [selectedUserToAssign, setSelectedUserToAssign] = useState(''); // Stores userId
    const [assignedMonthlyTarget, setAssignedMonthlyTarget] = useState(''); // Override target for assignment
    const [assignKpiLoading, setAssignKpiLoading] = useState(false);
    const [assignKpiError, setAssignKpiError] = useState(null);
    const [assignKpiSuccess, setAssignKpiSuccess] = useState(false);

    // Fetch all master KPIs, users, and user-assigned KPIs
    useEffect(() => {
        if (db && userRole === 'admin') {
            const fetchAdminData = async () => {
                // Fetch Master KPIs
                const kpisCol = collection(db, 'kpis');
                const kpisSnapshot = await getDocs(kpisCol);
                const kpisList = kpisSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setKpis(kpisList);

                // Fetch Users (only those with 'udyamMitra' role or similar)
                const usersCol = collection(db, 'users');
                const usersSnapshot = await getDocs(usersCol);
                const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUsers(usersList.filter(user => user.role === 'udyamMitra')); // Filter for udyamMitra roles

                // Fetch User-specific KPI assignments
                const userKpisCol = collection(db, 'userKpis');
                const userKpisSnapshot = await getDocs(userKpisCol);
                const assignedKpisList = userKpisSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAssignedKpis(assignedKpisList);
            };
            fetchAdminData();
        }
    }, [db, userRole]);


    const handleCreateKpi = async (e) => {
        e.preventDefault();
        setCreateKpiLoading(true);
        setCreateKpiError(null);
        setCreateKpiSuccess(false);

        if (!db || userRole !== 'admin') {
            setCreateKpiError("Not authorized to create KPIs.");
            setCreateKpiLoading(false);
            return;
        }

        try {
            const docRef = await addDoc(collection(db, 'kpis'), {
                kpiName: newKpiName,
                description: newKpiDescription,
                monthlyTargetTemplate: newKpiMonthlyTargetTemplate,
                reportingFormat: newKpiReportingFormat,
                verificationMethod: newKpiVerificationMethod,
                category: newKpiCategory,
                isNumericTarget: newKpiIsNumericTarget,
                createdAt: new Date(),
            });
            console.log("New KPI created with ID: ", docRef.id);
            setCreateKpiSuccess(true);
            setKpis(prev => [...prev, { id: docRef.id, kpiName: newKpiName, description: newKpiDescription, monthlyTargetTemplate: newKpiMonthlyTargetTemplate, reportingFormat: newKpiReportingFormat, verificationMethod: newKpiVerificationMethod, category: newKpiCategory, isNumericTarget: newKpiIsNumericTarget }]);
            // Clear form
            setNewKpiName('');
            setNewKpiDescription('');
            setNewKpiMonthlyTargetTemplate('');
            setNewKpiReportingFormat('');
            setNewKpiVerificationMethod('');
            setNewKpiCategory('');
            setNewKpiIsNumericTarget(true);
            setTimeout(() => setCreateKpiSuccess(false), 3000);
        } catch (e) {
            console.error("Error adding KPI: ", e);
            setCreateKpiError("Failed to create KPI: " + e.message);
        } finally {
            setCreateKpiLoading(false);
        }
    };

    const handleAssignKpi = async (e) => {
        e.preventDefault();
        setAssignKpiLoading(true);
        setAssignKpiError(null);
        setAssignKpiSuccess(false);

        if (!db || userRole !== 'admin' || !selectedKpiToAssign || !selectedUserToAssign) {
            setAssignKpiError("Invalid input or not authorized to assign KPIs.");
            setAssignKpiLoading(false);
            return;
        }

        const kpiDetails = kpis.find(k => k.id === selectedKpiToAssign);
        const userDetails = users.find(u => u.id === selectedUserToAssign);

        if (!kpiDetails || !userDetails) {
            setAssignKpiError("Selected KPI or User not found.");
            setAssignKpiLoading(false);
            return;
        }

        const currentMonthYear = new Date().toISOString().substring(0, 7); // YYYY-MM format

        try {
            // Check if this KPI is already assigned to this user for this month
            // Note: Firestore doesn't support complex queries for unique composite keys
            // For simplicity, we'll assume a new document per assignment or iterate.
            // A more robust solution might involve a composite document ID or a server-side check.

            // Find existing assignment (if any)
            const q = query(collection(db, 'userKpis'),
                            //orderBy('lastUpdatedAt', 'desc') // Can't order by multiple fields without index, and equality is better
                           );
            const existingAssignmentsSnapshot = await getDocs(q);
            let existingDocRef = null;

            existingAssignmentsSnapshot.forEach(doc => {
              if (doc.data().userId === selectedUserToAssign &&
                  doc.data().kpiId === selectedKpiToAssign &&
                  doc.data().submissionMonthYear === currentMonthYear) {
                existingDocRef = doc.ref;
              }
            });


            const assignmentData = {
                userId: selectedUserToAssign,
                udyamMitraId: userDetails.udyamMitraId,
                kpiId: selectedKpiToAssign,
                kpiName: kpiDetails.kpiName,
                monthlyTarget: assignedMonthlyTarget || kpiDetails.monthlyTargetTemplate, // Use override or default
                currentValue: kpiDetails.isNumericTarget ? 0 : '', // Reset current value on new assignment
                reportingFormat: kpiDetails.reportingFormat,
                submissionMonthYear: currentMonthYear,
                lastUpdatedAt: new Date(),
                assignedBy: currentUser.uid,
                assignedAt: new Date(),
            };

            if (existingDocRef) {
                await updateDoc(existingDocRef, assignmentData);
                console.log("KPI assignment updated for user: ", userDetails.email);
            } else {
                const docRef = await addDoc(collection(db, 'userKpis'), assignmentData);
                console.log("KPI assigned to user with ID: ", docRef.id);
            }

            setAssignKpiSuccess(true);
            // Refresh assigned KPIs list (or update state more precisely)
            // For simplicity, re-fetch all assigned KPIs. In production, consider more granular updates.
            const userKpisCol = collection(db, 'userKpis');
            const userKpisSnapshot = await getDocs(userKpisCol);
            setAssignedKpis(userKpisSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            setSelectedKpiToAssign('');
            setSelectedUserToAssign('');
            setAssignedMonthlyTarget('');
            setTimeout(() => setAssignKpiSuccess(false), 3000);
        } catch (e) {
            console.error("Error assigning KPI: ", e);
            setAssignKpiError("Failed to assign KPI: " + e.message);
        } finally {
            setAssignKpiLoading(false);
        }
    };


    // Only render if user is admin
    if (userRole !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 text-red-600 text-xl">
                Access Denied: You do not have administrator privileges.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <h1 className="text-4xl font-extrabold text-blue-800 tracking-tight mb-8 text-center">Admin Panel</h1>

            {/* Section: Create New KPI */}
            <section className="mb-10 p-6 bg-white rounded-lg shadow-xl max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-blue-700 mb-4 border-b-2 border-blue-200 pb-2">Create New Master KPI</h2>
                <form onSubmit={handleCreateKpi}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="kpiName" className="block text-gray-700 text-sm font-bold mb-1">KPI Name:</label>
                            <input type="text" id="kpiName" className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={newKpiName} onChange={(e) => setNewKpiName(e.target.value)} required />
                        </div>
                        <div>
                            <label htmlFor="kpiDescription" className="block text-gray-700 text-sm font-bold mb-1">Description:</label>
                            <textarea id="kpiDescription" rows="2" className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={newKpiDescription} onChange={(e) => setNewKpiDescription(e.target.value)}></textarea>
                        </div>
                        <div>
                            <label htmlFor="kpiMonthlyTargetTemplate" className="block text-gray-700 text-sm font-bold mb-1">Monthly Target Template:</label>
                            <input type="text" id="kpiMonthlyTargetTemplate" className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={newKpiMonthlyTargetTemplate} onChange={(e) => setNewKpiMonthlyTargetTemplate(e.target.value)} required />
                        </div>
                        <div>
                            <label htmlFor="kpiReportingFormat" className="block text-gray-700 text-sm font-bold mb-1">Reporting Format:</label>
                            <input type="text" id="kpiReportingFormat" className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={newKpiReportingFormat} onChange={(e) => setNewKpiReportingFormat(e.target.value)} required />
                        </div>
                        <div>
                            <label htmlFor="kpiVerificationMethod" className="block text-gray-700 text-sm font-bold mb-1">Verification Method:</label>
                            <input type="text" id="kpiVerificationMethod" className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={newKpiVerificationMethod} onChange={(e) => setNewKpiVerificationMethod(e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="kpiCategory" className="block text-gray-700 text-sm font-bold mb-1">Category:</label>
                            <input type="text" id="kpiCategory" className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={newKpiCategory} onChange={(e) => setNewKpiCategory(e.target.value)} required />
                        </div>
                        <div className="col-span-1 md:col-span-2 flex items-center">
                            <input type="checkbox" id="kpiIsNumericTarget" className="mr-2" checked={newKpiIsNumericTarget} onChange={(e) => setNewKpiIsNumericTarget(e.target.checked)} />
                            <label htmlFor="kpiIsNumericTarget" className="text-gray-700 text-sm font-bold">Is Numeric Target?</label>
                        </div>
                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300 disabled:opacity-50" disabled={createKpiLoading}>
                        {createKpiLoading ? 'Creating...' : 'Create KPI'}
                    </button>
                    {createKpiSuccess && <p className="text-green-500 text-sm mt-2">KPI created successfully!</p>}
                    {createKpiError && <p className="text-red-500 text-sm mt-2">{createKpiError}</p>}
                </form>
            </section>

            {/* Section: Assign KPI to User */}
            <section className="mb-10 p-6 bg-white rounded-lg shadow-xl max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-blue-700 mb-4 border-b-2 border-blue-200 pb-2">Assign KPI to User</h2>
                <form onSubmit={handleAssignKpi}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="selectKpi" className="block text-gray-700 text-sm font-bold mb-1">Select KPI:</label>
                            <select id="selectKpi" className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={selectedKpiToAssign} onChange={(e) => setSelectedKpiToAssign(e.target.value)} required>
                                <option value="">-- Select a KPI --</option>
                                {kpis.map(kpi => (
                                    <option key={kpi.id} value={kpi.id}>{kpi.kpiName} ({kpi.category})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="selectUser" className="block text-gray-700 text-sm font-bold mb-1">Select User (Udyam Mitra ID):</label>
                            <select id="selectUser" className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={selectedUserToAssign} onChange={(e) => setSelectedUserToAssign(e.target.value)} required>
                                <option value="">-- Select a User --</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.udyamMitraId} ({user.email})</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label htmlFor="assignedMonthlyTarget" className="block text-gray-700 text-sm font-bold mb-1">Assigned Monthly Target (Optional override):</label>
                            <input type="text" id="assignedMonthlyTarget" className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={assignedMonthlyTarget} onChange={(e) => setAssignedMonthlyTarget(e.target.value)} placeholder="Leave blank to use KPI template target" />
                        </div>
                    </div>
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300 disabled:opacity-50" disabled={assignKpiLoading}>
                        {assignKpiLoading ? 'Assigning...' : 'Assign KPI'}
                    </button>
                    {assignKpiSuccess && <p className="text-green-500 text-sm mt-2">KPI assigned successfully!</p>}
                    {assignKpiError && <p className="text-red-500 text-sm mt-2">{assignKpiError}</p>}
                </form>
            </section>

            {/* Section: Current KPI Assignments (Read-only) */}
            <section className="mb-10 p-6 bg-white rounded-lg shadow-xl max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-blue-700 mb-4 border-b-2 border-blue-200 pb-2">Current KPI Assignments (User-Specific)</h2>
                {assignedKpis.length === 0 ? (
                    <p className="text-gray-600">No KPIs assigned yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                            <thead>
                                <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                                    <th className="py-3 px-6 text-left">Udyam Mitra ID</th>
                                    <th className="py-3 px-6 text-left">KPI Name</th>
                                    <th className="py-3 px-6 text-left">Target</th>
                                    <th className="py-3 px-6 text-left">Current Value</th>
                                    <th className="py-3 px-6 text-left">Month/Year</th>
                                    <th className="py-3 px-6 text-left">Last Updated</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-600 text-sm font-light">
                                {assignedKpis.map(assignment => (
                                    <tr key={assignment.id} className="border-b border-gray-200 hover:bg-gray-50">
                                        <td className="py-3 px-6 text-left whitespace-nowrap">{assignment.udyamMitraId}</td>
                                        <td className="py-3 px-6 text-left">{assignment.kpiName}</td>
                                        <td className="py-3 px-6 text-left">{assignment.monthlyTarget}</td>
                                        <td className="py-3 px-6 text-left">{assignment.currentValue}</td>
                                        <td className="py-3 px-6 text-left">{assignment.submissionMonthYear}</td>
                                        <td className="py-3 px-6 text-left">
                                            {assignment.lastUpdatedAt ? new Date(assignment.lastUpdatedAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

             {/* Section: All Master KPIs (Read-only) */}
             <section className="mb-10 p-6 bg-white rounded-lg shadow-xl max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-blue-700 mb-4 border-b-2 border-blue-200 pb-2">All Master KPIs</h2>
                {kpis.length === 0 ? (
                    <p className="text-gray-600">No master KPIs defined yet. Use the "Create New Master KPI" section above.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                            <thead>
                                <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                                    <th className="py-3 px-6 text-left">Name</th>
                                    <th className="py-3 px-6 text-left">Category</th>
                                    <th className="py-3 px-6 text-left">Target Template</th>
                                    <th className="py-3 px-6 text-left">Numeric?</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-600 text-sm font-light">
                                {kpis.map(kpi => (
                                    <tr key={kpi.id} className="border-b border-gray-200 hover:bg-gray-50">
                                        <td className="py-3 px-6 text-left whitespace-nowrap">{kpi.kpiName}</td>
                                        <td className="py-3 px-6 text-left">{kpi.category}</td>
                                        <td className="py-3 px-6 text-left">{kpi.monthlyTargetTemplate}</td>
                                        <td className="py-3 px-6 text-left">{kpi.isNumericTarget ? 'Yes' : 'No'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
};

export default AdminPanel;
