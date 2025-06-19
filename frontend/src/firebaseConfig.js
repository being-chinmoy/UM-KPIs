// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; 
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBwA5lkW_RUeNorfqoJalyZRRf7lmHnvjc",
  authDomain: "udyam-mitra-kpi-auth.firebaseapp.com",
  projectId: "udyam-mitra-kpi-auth",
  storageBucket: "udyam-mitra-kpi-auth.firebasestorage.app",
  messagingSenderId: "751365110472",
  appId: "1:751365110472:web:1b68cc5d56cc3e0ed283fd",
  measurementId: "G-917HWVBCS9"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Get the Firebase Auth instance
const db = getFirestore(app); // NEW: Get the Firestore instance

export { auth, db }; // Export both auth and db
