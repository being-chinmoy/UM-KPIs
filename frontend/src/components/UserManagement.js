// src/components/UserManagement.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext'; // To get admin's token
import RoleAssignmentModal from './RoleAssignmentModal'; // New component for role assignment

const UserManagement = ({ onSelectUdyamMitra }) => {
    const { userToken, currentUser } = useAuth(); // Destructure currentUser as well for context
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedUserForRole, setSelectedUserForRole] = useState(null);

    const API_BASE_URL = 'https://ambitious-wave-05ff35700.1.azurestaticapps.net/api';

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        // Ensure userToken is available before proceeding with the fetch
        if (!userToken) {
            // This case should be mostly handled by the useEffect dependency,
            // but keeping a check here for robustness in case of timing issues.
            console.log("User token not available yet for fetching users. Waiting...");
            setUsers([]); // Clear previous users if token becomes unavailable
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/GetUsers`, {
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                // Check for unauthorized/forbidden to provide a more specific error
                if (response.status === 401 || response.status === 403) {
                    setError("Authorization error. You might not have admin permissions or your token expired. Please re-login.");
                } else {
                    throw new Error(`Failed to fetch users: ${response.status} - ${errorText}`);
                }
            } else {
                const data = await response.json();
                setUsers(data);
            }
        } catch (e) {
            console.error("Error fetching users:", e);
            setError(`Error fetching users: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, [userToken]); // useEffect will trigger this when userToken changes/becomes available

    useEffect(() => {
        // Only attempt to fetch users if a userToken is present
        // This ensures the API call is made only when authentication is ready.
        if (userToken) {
            fetchUsers();
        }
    }, [fetchUsers, userToken]); // Depend on fetchUsers and userToken

    const handleRoleUpdateSuccess = () => {
        setShowRoleModal(false);
        setSelectedUserForRole(null);
        fetchUsers(); // Refresh user list after role update
    };

    // Only show loading/error if there's no userToken, otherwise the table will be empty
    if (!userToken) {
        return <div className="text-center text-lg mt-10 text-gray-500">Waiting for admin token...</div>;
    }
    
    if (loading) return <div className="text-center text-lg mt-10">Loading users...</div>;
    if (error) return <div className="text-center text-lg mt-10 text-red-500">{error}</div>;


    return (
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-blue-800 mb-6 border-b-2 border-blue-200 pb-3">Registered Users</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-blue-100">
                        <tr>
                            <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-700">Email</th>
                            <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-700">Firebase UID</th>
                            <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-700">Udyam Mitra ID</th>
                            <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-700">Role</th>
                            <th className="py-3 px-4 border-b text-left text-sm font-semibold text-gray-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="py-4 px-4 text-center text-gray-500">No users found or available for display.</td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.uid} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 border-b text-gray-700">{user.email}</td>
                                    <td className="py-3 px-4 border-b text-gray-700 break-all">{user.uid}</td>
                                    <td className="py-3 px-4 border-b text-gray-700">{user.udyamMitraId}</td>
                                    <td className="py-3 px-4 border-b text-gray-700 capitalize">{user.role}</td>
                                    <td className="py-3 px-4 border-b">
                                        <button
                                            onClick={() => onSelectUdyamMitra(user)}
                                            className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-1 px-3 rounded mr-2 transition duration-300"
                                        >
                                            View KPIs
                                        </button>
                                        <button
                                            onClick={() => { setSelectedUserForRole(user); setShowRoleModal(true); }}
                                            className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold py-1 px-3 rounded transition duration-300"
                                        >
                                            Set Role
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showRoleModal && selectedUserForRole && (
                <RoleAssignmentModal
                    user={selectedUserForRole}
                    onClose={() => setShowRoleModal(false)}
                    onSuccess={handleRoleUpdateSuccess}
                />
            )}
        </div>
    );
};

export default UserManagement;
