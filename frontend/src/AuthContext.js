// frontend/src/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import firebase from 'firebase/compat/app'; // For getting token manually if needed


const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userToken, setUserToken] = useState(null); // Firebase ID Token
  const [userRole, setUserRole] = useState(null); // Custom claim 'role'
  const [loading, setLoading] = useState(true); // Tracks initial auth state loading

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setUserToken(token);

          // Decode token to get custom claims (role)
          const decodedToken = await user.getIdTokenResult();
          setUserRole(decodedToken.claims.role || 'udyamMitra'); // Default to 'udyamMitra' if no role claim
        } catch (error) {
          console.error("Error getting ID token or decoding claims:", error);
          setUserToken(null);
          setUserRole(null);
        }
      } else {
        setUserToken(null);
        setUserRole(null);
      }
      setLoading(false); // Auth state determined
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userToken,
    userRole,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} {/* Render children only after auth state is determined */}
    </AuthContext.Provider>
  );
};
