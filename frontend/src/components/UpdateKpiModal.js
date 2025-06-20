// frontend/src/components/UpdateKpiModal.js
import React, { useState, useEffect } from 'react';

const UpdateKpiModal = ({ kpi, onClose, onSave }) => {
    const [newValue, setNewValue] = useState(kpi.currentValue);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('');

    // Reset newValue if kpi changes (e.g., when modal opens for a different KPI)
    useEffect(() => {
        setNewValue(kpi.currentValue);
        setError(null);
        setMessage('');
    }, [kpi]);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        setMessage('');

        // Basic validation for numeric targets
        if (typeof kpi.monthlyTarget === 'number') {
            if (isNaN(Number(newValue)) || Number(newValue) < 0) {
                setError("Value must be a non-negative number.");
                setLoading(false);
                return;
            }
        }
        
        try {
            // Pass kpi.id (the actual KPI identifier) and the new value.
            // onSave will handle sending it to the backend.
            await onSave(kpi.id, Number(newValue)); // Ensure newValue is a number if target is numeric
            setMessage('KPI updated successfully!');
            setTimeout(() => {
                onClose(); // Close modal after a short delay
            }, 1000); // Give user time to see success message
        } catch (e) {
            setError(`Failed to update KPI: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
                <h2 className="text-2xl font-bold text-blue-700 mb-6">Update KPI: {kpi.kpiName}</h2>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                {message && <p className="text-green-600 mb-4">{message}</p>}

                <div className="mb-4">
                    <label htmlFor="newValue" className="block text-gray-700 text-sm font-bold mb-2">
                        New Value:
                    </label>
                    <input
                        type={typeof kpi.monthlyTarget === 'number' ? 'number' : 'text'}
                        id="newValue"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder={typeof kpi.monthlyTarget === 'number' ? "Enter number" : "Enter text or number"}
                        disabled={loading}
                    />
                </div>

                <div className="mb-6 text-gray-600 text-sm">
                    <p>Current Target: <span className="font-semibold">{kpi.monthlyTarget}</span></p>
                    <p>Current Achieved: <span className="font-semibold">{kpi.currentValue}</span></p>
                    <p>Reporting Format: <span className="font-semibold">{kpi.reportingFormat}</span></p>
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
                        onClick={handleSubmit}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save Update'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdateKpiModal;
