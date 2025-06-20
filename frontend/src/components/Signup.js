// frontend/src/components/Signup.js
import React, { useState } from 'react';
import { auth } from '../firebaseConfig'; // Import auth from firebaseConfig
import { createUserWithEmailAndPassword } from 'firebase/auth'; // Import createUserWithEmailAndPassword

const Signup = ({ onSignupSuccess, onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            console.log("Signed up successfully!");
            onSignupSuccess(); // Notify parent of successful signup
        } catch (err) {
            console.error("Signup error:", err);
            let errorMessage = "Failed to sign up. Please try again.";
            if (err.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already in use. Please log in or use a different email.";
            } else if (err.code === 'auth/weak-password') {
                errorMessage = "Password is too weak (min 6 characters).";
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address format.";
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-blue-200 p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 hover:scale-105">
                <h2 className="text-3xl font-bold text-center text-purple-700 mb-6">Create Account</h2>
                <form onSubmit={handleSignup} className="space-y-5">
                    <div>
                        <label htmlFor="email" className="block text-gray-700 text-sm font-semibold mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            className="shadow-inner appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition duration-200"
                            placeholder="your.email@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-gray-700 text-sm font-semibold mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="shadow-inner appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition duration-200"
                            placeholder="Minimum 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button
                        type="submit"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transform transition-all duration-300 hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? 'Signing Up...' : 'Sign Up'}
                    </button>
                </form>
                <p className="text-center text-gray-600 text-sm mt-6">
                    Already have an account?{' '}
                    <button
                        onClick={onSwitchToLogin}
                        className="text-purple-600 hover:text-purple-800 font-semibold focus:outline-none transition duration-200"
                        disabled={loading}
                    >
                        Login
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Signup;
