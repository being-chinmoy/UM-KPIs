// GetUsers/index.js
// This function allows an authenticated admin user to fetch a list of all Firebase users
// and their associated Udyam Mitra IDs from Firestore.

const admin = require('firebase-admin'); // Firebase Admin SDK for Auth and Firestore
const { Firestore } = require('@google-cloud/firestore'); // Explicitly import Firestore
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');

// Firebase Admin SDK initialization (same as in SetUserRole)
let firebaseAdminInitialized = false;
let dbFirestore; // Firestore instance
function initializeFirebaseAdmin(context) {
    if (!firebaseAdminInitialized) {
        const serviceAccountConfigBase64 = process.env.FIREBASE_ADMIN_SDK_CONFIG;
        const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;

        if (!serviceAccountConfigBase64 || !firebaseProjectId) {
            context.log.error("FIREBASE_ADMIN_SDK_CONFIG or FIREBASE_PROJECT_ID environment variables not set.");
            throw new Error("Firebase Admin SDK config is missing.");
        }

        try {
            const serviceAccountConfigJson = Buffer.from(serviceAccountConfigBase64, 'base64').toString('utf8');
            const serviceAccount = JSON.parse(serviceAccountConfigJson);

            if (serviceAccount.project_id && serviceAccount.project_id !== firebaseProjectId) {
                context.log.error(`Service account project ID mismatch. Expected ${firebaseProjectId}, got ${serviceAccount.project_id}.`);
                throw new Error("Firebase Admin SDK project ID in config does not match FIREBASE_PROJECT_ID env variable.");
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            dbFirestore = new Firestore({
                projectId: firebaseProjectId,
                credentials: { // Use credentials from the service account
                    client_email: serviceAccount.client_email,
                    private_key: serviceAccount.private_key
                }
            });
            firebaseAdminInitialized = true;
            context.log("Firebase Admin SDK and Firestore initialized successfully.");
        } catch (error) {
            context.log.error("Error initializing Firebase Admin SDK or Firestore:", error);
            throw new Error(`Failed to initialize Firebase Admin SDK or Firestore: ${error.message}`);
        }
    }
}

// Cache for Firebase public keys (JWKS)
let firebasePublicKeys = null;
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

async function getFirebasePublicKeys(context) {
    if (firebasePublicKeys) {
        return firebasePublicKeys;
    }
    try {
        const response = await fetch(FIREBASE_JWKS_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch Firebase public keys: ${response.statusText}`);
        }
        const keys = await response.json();
        firebasePublicKeys = keys;
        return firebasePublicKeys;
    } catch (error) {
        context.log.error('Error fetching Firebase public keys:', error);
        throw error;
    }
}


module.exports = async function (context, req) {
    context.log('HTTP trigger function processed a request for GetUsers.');

    // Initialize Firebase Admin SDK
    try {
        initializeFirebaseAdmin(context);
    } catch (error) {
        context.res = {
            status: 500,
            body: `Server configuration error: ${error.message}`
        };
        return;
    }

    // --- Authentication and Authorization (Admin Only) ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        context.res = { status: 401, body: "Authorization token required." };
        return;
    }

    const idToken = authHeader.split(' ')[1];
    let decodedToken;
    try {
        const jwks = await getFirebasePublicKeys(context);
        decodedToken = await new Promise((resolve, reject) => {
            jwt.verify(idToken, (header, callback) => {
                const kid = header.kid;
                const jwk = Object.values(jwks).find(k => k.kid === kid);
                if (!jwk) return callback(new Error('Firebase public key not found.'));
                callback(null, jwkToPem(jwk));
            }, { algorithms: ['RS256'] }, (err, decoded) => {
                if (err) reject(err);
                else resolve(decoded);
            });
        });

        const FIREBASE_PROJECT_ID_ENV = process.env.FIREBASE_PROJECT_ID;
        if (decodedToken.aud !== FIREBASE_PROJECT_ID_ENV || decodedToken.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID_ENV}`) {
            throw new Error('Firebase token audience or issuer mismatch.');
        }

        // Check if the requesting user has 'admin' role
        if (decodedToken.role !== 'admin') {
            context.res = { status: 403, body: "Permission denied: Only admin users can view users." };
            return;
        }
        context.log(`Admin user ${decodedToken.email} is fetching users.`);

    } catch (error) {
        context.log.error('Admin token verification failed:', error);
        context.res = { status: 403, body: `Invalid or expired admin token: ${error.message}` };
        return;
    }
    // --- End Authentication and Authorization ---

    try {
        // Fetch users from Firebase Authentication
        const listUsersResult = await admin.auth().listUsers(1000); // Fetch up to 1000 users
        let users = listUsersResult.users.map(userRecord => {
            const customClaims = (userRecord.customClaims || {});
            return {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                role: customClaims.role || 'udyamMitra', // Default role if not set
                // You can add other relevant fields from customClaims or userRecord
            };
        });

        // Optionally, enrich with udyamMitraId from Firestore 'users' collection
        // This assumes your Firestore 'users' collection also has a 'udyamMitraId' field
        const usersCollectionRef = dbFirestore.collection('users');
        const firestoreUsersSnapshot = await usersCollectionRef.get();
        const firestoreUsersMap = new Map();
        firestoreUsersSnapshot.forEach(doc => {
            const data = doc.data();
            firestoreUsersMap.set(doc.id, data); // doc.id is the UID
        });

        users = users.map(user => {
            const firestoreData = firestoreUsersMap.get(user.uid);
            return {
                ...user,
                udyamMitraId: firestoreData ? firestoreData.udyamMitraId : 'N/A', // Or generate if not found
                // Add any other fields from Firestore if needed
            };
        });


        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(users)
        };

    } catch (error) {
        context.log.error('Error fetching users:', error);
        context.res = { status: 500, body: `Error fetching users: ${error.message}` };
    }
};
