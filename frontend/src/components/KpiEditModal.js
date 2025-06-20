// src/components/KpiEditModal.js
import React, { useState, useEffect } from 'react';

const KpiEditModal = ({ kpi, onClose, onSave, kpiCategories }) => {
    const [id, setId] = useState(kpi ? kpi.id : '');
    const [kpiName, setKpiName] = useState(kpi ? kpi.kpiName : '');
    const [description, setDescription] = useState(kpi ? kpi.description : '');
    const [monthlyTarget, setMonthlyTarget] = useState(kpi && typeof kpi.monthlyTarget === 'number' ? kpi.monthlyTarget : '');
    const [reportingFormat, setReportingFormat] = useState(kpi ? kpi.reportingFormat : '');
    const [category, setCategory] = useState(kpi ? kpi.category : (kpiCategories[0] ? kpiCategories[0].value : 'common'));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('');

    const isNewKpi = !kpi;

    useEffect(() => {
        // Reset state when kpi prop changes (e.g., when modal opens for a different KPI)
        setId(kpi ? kpi.id : '');
        setKpiName(kpi ? kpi.kpiName : '');
        setDescription(kpi ? kpi.description : '');
        setMonthlyTarget(kpi && typeof kpi.monthlyTarget === 'number' ? kpi.monthlyTarget : '');
        setReportingFormat(kpi ? kpi.reportingFormat : '');
        setCategory(kpi ? kpi.category : (kpiCategories[0] ? kpiCategories[0].value : 'common'));
        setError(null);
        setMessage('');
    }, [kpi, kpiCategories]);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        setMessage('');

        // Basic validation
        if (!id || !kpiName || monthlyTarget === '' || !reportingFormat || !category) {
            setError("All fields (ID, Name, Target, Reporting, Category) are required.");
            setLoading(false);
            return;
        }
        if (isNaN(Number(monthlyTarget)) || Number(monthlyTarget) < 0) {
            setError("Monthly Target must be a non-negative number.");
            setLoading(false);
            return;
        }

        try {
            await onSave({
                id,
                kpiName,
                description,
                monthlyTarget: Number(monthlyTarget), // Ensure it's a number
                reportingFormat,
                category
            });
            setMessage('KPI saved successfully!');
            setTimeout(() => {
                onClose(); // Close modal after a short delay
            }, 1000);
        } catch (e) {
            setError(`Failed to save KPI: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl overflow-y-auto max-h-[90vh]">
                <h2 className="text-2xl font-bold text-blue-700 mb-6">{isNewKpi ? 'Add New KPI' : `Edit KPI: ${kpi.kpiName}`}</h2>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                {message && <p className="text-green-600 mb-4">{message}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label htmlFor="kpi-id" className="block text-gray-700 text-sm font-bold mb-2">
                            KPI ID:
                        </label>
                        <input
                            type="text"
                            id="kpi-id"
                            value={id}
                            onChange={(e) => setId(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="Unique KPI Identifier (e.g., common15)"
                            disabled={!isNewKpi || loading} // Disable ID field when editing existing KPI
                        />
                        {isNewKpi && <p className="text-xs text-gray-500 mt-1">Cannot be changed after creation.</p>}
                    </div>
                    <div>
                        <label htmlFor="kpi-name" className="block text-gray-700 text-sm font-bold mb-2">
                            KPI Name:
                        </label>
                        <input
                            type="text"
                            id="kpi-name"
                            value={kpiName}
                            onChange={(e) => setKpiName(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="e.g., New Enterprise Registrations"
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <label htmlFor="monthly-target" className="block text-gray-700 text-sm font-bold mb-2">
                            Monthly Target:
                        </label>
                        <input
                            type="number"
                            id="monthly-target"
                            value={monthlyTarget}
                            onChange={(e) => setMonthlyTarget(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="e.g., 50"
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">
                            Category:
                        </label>
                        <select
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-white"
                            disabled={loading}
                        >
                            {kpiCategories.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mb-4">
                    <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">
                        Description:
                    </label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="Detailed description of the KPI"
                        rows="3"
                        disabled={loading}
                    ></textarea>
                </div>

                <div className="mb-6">
                    <label htmlFor="reporting-format" className="block text-gray-700 text-sm font-bold mb-2">
                        Reporting Format:
                    </label>
                    <input
                        type="text"
                        id="reporting-format"
                        value={reportingFormat}
                        onChange={(e) => setReportingFormat(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="e.g., Google Sheet, Field Report"
                        disabled={loading}
                    />
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
                        {loading ? 'Saving...' : 'Save KPI'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KpiEditModal;
