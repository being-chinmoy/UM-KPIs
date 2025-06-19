// src/components/UpdateKpiModal.js
import React, { useState } from 'react';

/**
 * UpdateKpiModal Component
 * A modal for users to input new KPI values and submit them.
 * It also collects the Udyam Mitra ID for tracking.
 */
const UpdateKpiModal = ({ kpi, onClose, onSave }) => {
  // kpi object here is an entry from the userKpis collection
  // so kpi.id is the assignedKpiDocId
  const [newValue, setNewValue] = useState(kpi.currentValue);
  // udyamMitraId will be passed from the kpi object directly since it's now in userKpis
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * Handles the form submission when the user clicks 'Save Update'.
   * Performs client-side validation and calls the onSave prop.
   * @param {Event} e - The form submission event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmissionStatus('loading');
    setErrorMessage('');

    let valueToSave;
    if (typeof kpi.monthlyTarget === 'number') {
      valueToSave = parseFloat(newValue);
      if (isNaN(valueToSave)) {
        setSubmissionStatus('error');
        setErrorMessage('Please enter a valid number for the KPI.');
        return;
      }
    } else {
      valueToSave = String(newValue).trim();
      if (valueToSave === '') {
        setSubmissionStatus('error');
        setErrorMessage('Please enter a value for the KPI.');
        return;
      }
    }

    // Udyam Mitra ID is now part of the kpi object (from userKpis document)
    // No need for a separate input field here unless admin wants to change it
    // For now, we assume it's stable and included in the kpi object already.
    const udyamMitraId = kpi.udyamMitraId; // Get from the kpi object (which is the userKpi document)

    if (!udyamMitraId) {
        setSubmissionStatus('error');
        setErrorMessage('Udyam Mitra ID not found for this KPI assignment. Cannot save.');
        return;
    }


    try {
      // Pass the assignedKpiDocId (which is kpi.id) and the new value
      await onSave(kpi.id, valueToSave, udyamMitraId);
      setSubmissionStatus('success');
      setTimeout(onClose, 1500);
    } catch (error) {
      setSubmissionStatus('error');
      setErrorMessage(`Submission failed: ${error.message}`);
      console.error("Error during KPI submission:", error);
    }
  };

  return (
    // Modal backdrop: fixed position, semi-transparent background, centered content.
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      {/* Modal content area. */}
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold text-blue-800 mb-4 border-b pb-2">Update KPI: {kpi.kpiName}</h2>
        <form onSubmit={handleSubmit}>
          {/* Display Udyam Mitra ID (read-only) */}
          <div className="mb-4">
            <label htmlFor="udyamMitraIdDisplay" className="block text-gray-700 text-sm font-bold mb-2">
              Your Udyam Mitra ID:
            </label>
            <input
              type="text"
              id="udyamMitraIdDisplay"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 bg-gray-100 cursor-not-allowed leading-tight focus:outline-none"
              value={kpi.udyamMitraId || 'N/A'} // Display from kpi object
              readOnly
            />
          </div>
          <div className="mb-6">
            <label htmlFor="newValue" className="block text-gray-700 text-sm font-bold mb-2">
              New Achieved Value:
            </label>
            <input
              type={typeof kpi.monthlyTarget === 'number' ? 'number' : 'text'}
              id="newValue"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={typeof kpi.monthlyTarget === 'number' ? 'Enter a number' : 'Enter text'}
              required
            />
          </div>

          {submissionStatus === 'loading' && (
            <p className="text-blue-500 text-sm text-center mb-4">Submitting...</p>
          )}
          {submissionStatus === 'success' && (
            <p className="text-green-500 text-sm text-center mb-4">KPI updated successfully!</p>
          )}
          {submissionStatus === 'error' && (
            <p className="text-red-500 text-sm text-center mb-4">{errorMessage}</p>
          )}

          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300 disabled:opacity-50"
              disabled={submissionStatus === 'loading'}
            >
              Save Update
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300 disabled:opacity-50"
              disabled={submissionStatus === 'loading'}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateKpiModal;
