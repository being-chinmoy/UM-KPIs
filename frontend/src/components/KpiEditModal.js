// frontend/src/components/KpiEditModal.js
import React, { useState, useEffect } from 'react';

const KpiEditModal = ({ kpi, onClose, onSave, kpiCategories }) => {
    const [formData, setFormData] = useState({
        // Replaced kpi?.id with (kpi ? kpi.id : '') for broader compatibility
        id: (kpi ? kpi.id : '') || '', 
        kpiName: (kpi ? kpi.kpiName : '') || '', // Replaced kpi?.kpiName
        description: (kpi ? kpi.description : '') || '', // Replaced kpi?.description
        monthlyTarget: (kpi ? kpi.monthlyTarget : '') || '', // Replaced kpi?.monthlyTarget
        reportingFormat: (kpi ? kpi.reportingFormat : '') || '', // Replaced kpi?.reportingFormat
        category: (kpi ? kpi.category : '') || (kpiCategories.length > 0 ? kpiCategories[0].value : ''), // Replaced kpi?.category
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Reset form data when a different KPI is selected for editing, or when creating new
        setFormData({
            id: (kpi ? kpi.id : '') || '',
            kpiName: (kpi ? kpi.kpiName : '') || '',
            description: (kpi ? kpi.description : '') || '',
            monthlyTarget: (kpi ? kpi.monthlyTarget : '') || '',
            reportingFormat: (kpi ? kpi.reportingFormat : '') || '',
            category: (kpi ? kpi.category : '') || (kpiCategories.length > 0 ? kpiCategories[0].value : ''),
        });
        setError(null);
        setMessage('');
    }, [kpi, kpiCategories]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage('');
        setLoading(true);

        if (!formData.id) {
            setError("KPI ID is required.");
            setLoading(false);
            return;
        }
        if (!formData.kpiName) {
            setError("KPI Name is required.");
            setLoading(false);
            return;
        }
        if (!formData.category) {
            setError("Category is required.");
            setLoading(false);
            return;
        }

        // Convert monthlyTarget to number if it's a number string
        const finalMonthlyTarget = isNaN(Number(formData.monthlyTarget)) ? formData.monthlyTarget : Number(formData.monthlyTarget);

        try {
            await onSave({ ...formData, monthlyTarget: finalMonthlyTarget });
            setMessage('KPI saved successfully!');
            setTimeout(() => {
                onClose(); // Close modal on success
            }, 1000);
        } catch (err) {
            console.error("Error saving KPI:", err);
            setError(`Failed to save KPI: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-lg">
                <h2 className="text-2xl font-bold text-blue-700 mb-6">
                    {kpi ? 'Edit Master KPI' : 'Add New Master KPI'}
                </h2>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                {message && <p className="text-green-600 mb-4">{message}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="id" className="block text-gray-700 text-sm font-bold mb-2">
                            KPI ID (Unique)
                        </label>
                        <input
                            type="text"
                            id="id"
                            value={formData.id}
                            onChange={handleChange}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="e.g., common15"
                            required
                            // Replaced !!kpi?.id with !!(kpi && kpi.id) for broader compatibility
                            disabled={loading || !!(kpi && kpi.id)} 
                        />
                        {kpi && <p className="text-xs text-gray-500 mt-1">ID cannot be changed for existing KPIs.</p>}
                    </div>

                    <div>
                        <label htmlFor="kpiName" className="block text-gray-700 text-sm font-bold mb-2">
                            KPI Name
                        </label>
                        <input
                            type="text"
                            id="kpiName"
                            value={formData.kpiName}
                            onChange={handleChange}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="e.g., New Field Assessment"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24 resize-none"
                            placeholder="Detailed description of the KPI..."
                            disabled={loading}
                        ></textarea>
                    </div>

                    <div>
                        <label htmlFor="monthlyTarget" className="block text-gray-700 text-sm font-bold mb-2">
                            Monthly Target
                        </label>
                        <input
                            type="text" {/* Can be number or text (e.g., 'As per deployment') */}
                            id="monthlyTarget"
                            value={formData.monthlyTarget}
                            onChange={handleChange}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="e.g., 10 or 'As per deployment'"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label htmlFor="reportingFormat" className="block text-gray-700 text-sm font-bold mb-2">
                            Reporting Format
                        </label>
                        <input
                            type="text"
                            id="reportingFormat"
                            value={formData.reportingFormat}
                            onChange={handleChange}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="e.g., Google Sheet with photos"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">
                            Category
                        </label>
                        <select
                            id="category"
                            value={formData.category}
                            onChange={handleChange}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-white"
                            required
                            disabled={loading}
                        >
                            {kpiCategories.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end space-x-4 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save KPI'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default KpiEditModal;
