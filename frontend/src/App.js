// frontend/src/App.js
import React, { useState } from 'react';
import { useAuth } from './AuthContext'; // Import useAuth hook
import { auth } from './firebaseConfig'; // Import auth instance for logout
import { signOut } from 'firebase/auth';
import AdminDashboard from './components/AdminDashboard'; // Admin Dashboard component
import DashboardView from './components/DashboardView'; // Import the DashboardView


// Import components
import Login from './components/Login';
import Signup from './components/Signup';


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
                <DashboardView /> 
            )}
        </div>
    );
}

export default App;
