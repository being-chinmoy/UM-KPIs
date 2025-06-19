// src/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebaseConfig'; // Import auth and db from firebaseConfig.js
import { doc, getDoc, setDoc } from 'firebase/firestore'; // Import Firestore functions

// Create an AuthContext to provide authentication state throughout the app
const AuthContext = createContext();

/**
 * Custom hook to easily access authentication state.
 * @returns {object} An object containing currentUser, loading, and userRole.
 */
export const useAuth = () => {
  return useContext(AuthContext);
};

/**
 * AuthProvider Component
 * Manages Firebase authentication state and provides it to its children.
 * It also handles fetching and setting custom user roles from Firebase,
 * and ensuring user metadata exists in Firestore for admin features.
 */
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('guest');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          const role = idTokenResult.claims.role || 'udyamMitra';
          setUserRole(role);
          console.log("User role detected:", role);

          // Ensure user metadata exists in Firestore's 'users' collection for admin panel
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
            // Create user document if it doesn't exist (e.g., for new sign-ups)
            await setDoc(userRef, {
              email: user.email,
              role: role,
              udyamMitraId: `UM-${user.uid.substring(0, 5).toUpperCase()}`, // A simple mock Udyam Mitra ID
              createdAt: new Date(),
            }, { merge: true }); // Use merge to avoid overwriting if partial data exists
            console.log("Created/updated user document in Firestore:", user.uid);
          } else {
             // Update existing user document with latest role or other info if needed
            await setDoc(userRef, {
              email: user.email,
              role: role,
            }, { merge: true });
          }

        } catch (error) {
          console.error("Error fetching or setting user role/metadata:", error);
          setUserRole('udyamMitra'); // Default to udyamMitra on error
        }
      } else {
        setUserRole('guest');
        console.log("No user logged in, role is guest.");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    userRole,
    db // Provide db instance through context for easier access
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
