// src/components/RoleAssignmentModal.js
import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

const RoleAssignmentModal = ({ user, onClose, onSuccess }) => {
    const { userToken } = useAuth();
    const [selectedRole, setSelectedRole] = useState(user.role || 'udyamMitra');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('');

    const FUNCTION_APP_BASE_URL = 'https://kpifirestoredb-chinmoy-unique.azurewebsites.net/api';
    const SET_USER_ROLE_KEY = 'RYbyy5wbosL04Pf4DEavAqDGdG7q3qqWXpjgOtVKR69XAzFui2dBSw=='; 

    const handleSaveRole = async () => {
        setLoading(true);
        setError(null);
        setMessage('');
        try {
            // Using the external Function App URL with key
            const response = await fetch(`${FUNCTION_APP_BASE_URL}/SetUserRole?code=${SET_USER_ROLE_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    uid: user.uid,
                    role: selectedRole
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: "Unknown error" }));
                throw new Error(`Failed to set role: ${response.status} - ${errorBody.message || response.statusText}`);
            }

            const result = await response.json();
            setMessage(result.message || 'User role updated successfully!');
            onSuccess();
        } catch (e) {
            console.error("Error setting user role:", e);
            setError(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
                <h2 className="text-2xl font-bold text-blue-700 mb-6">Set Role for {user.email}</h2>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                {message && <p className="text-green-600 mb-4">{message}</p>}

                <div className="mb-4">
                    <label htmlFor="role-select" className="block text-gray-700 text-sm font-bold mb-2">
                        Select Role:
                    </label>
                    <select
                        id="role-select"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-white"
                        disabled={loading}
                    >
                        <option value="udyamMitra">Udyam Mitra</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                <div className="flex justify-end space-x-4">
                    <button
                        onClick={onClose}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveRole}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save Role'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RoleAssignmentModal;
