// frontend/src/components/Login.js
import React, { useState } from 'react';
import { auth } from '../firebaseConfig'; // Import auth from firebaseConfig
import { signInWithEmailAndPassword } from 'firebase/auth'; // Import signInWithEmailAndPassword

const Login = ({ onLoginSuccess, onSwitchToSignup }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Logged in successfully!");
            onLoginSuccess(); // Notify parent of successful login
        } catch (err) {
            console.error("Login error:", err);
            let errorMessage = "Failed to log in. Please check your credentials.";
            if (err.code === 'auth/user-not-found') {
                errorMessage = "User not found. Please sign up or check your email.";
            } else if (err.code === 'auth/wrong-password') {
                errorMessage = "Incorrect password. Please try again.";
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address format.";
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 hover:scale-105">
                <h2 className="text-3xl font-bold text-center text-blue-700 mb-6">Welcome Back!</h2>
                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label htmlFor="email" className="block text-gray-700 text-sm font-semibold mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            className="shadow-inner appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200"
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
                            className="shadow-inner appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200"
                            placeholder="********"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transform transition-all duration-300 hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? 'Logging In...' : 'Login'}
                    </button>
                </form>
                <p className="text-center text-gray-600 text-sm mt-6">
                    Don't have an account?{' '}
                    <button
                        onClick={onSwitchToSignup}
                        className="text-blue-600 hover:text-blue-800 font-semibold focus:outline-none transition duration-200"
                        disabled={loading}
                    >
                        Sign Up
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Login;
