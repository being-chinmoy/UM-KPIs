// api/SetUserRole/index.js
// This function sets a custom Firebase authentication claim (role) for a user.
// Only accessible by admin users.

const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const fetch = require('node-fetch'); // Required for fetching JWKS

// Firebase Admin SDK initialization - ensures it runs only once per cold start
let firebaseAdminInitialized = false;

function initializeFirebaseAdmin(context) {
    if (!firebaseAdminInitialized) {
        const serviceAccountConfigBase64 = process.env.FIREBASE_ADMIN_SDK_CONFIG;
        const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;

        if (!serviceAccountConfigBase64 || !firebaseProjectId) {
            context.log.error("FIREBASE_ADMIN_SDK_CONFIG or FIREBASE_PROJECT_ID environment variables not set.");
            throw new Error("Firebase Admin SDK config is missing. Please set environment variables in Azure.");
        }

        try {
            // Decode the Base64 service account JSON
            const serviceAccountConfigJson = Buffer.from(serviceAccountConfigBase64, 'base64').toString('utf8');
            const serviceAccount = JSON.parse(serviceAccountConfigJson);

            // Optional: Validate project ID in service account config matches environment variable
            if (serviceAccount.project_id && serviceAccount.project_id !== firebaseProjectId) {
                context.log.error(`Service account project ID mismatch. Expected ${firebaseProjectId}, got ${serviceAccount.project_id}.`);
                throw new Error("Firebase Admin SDK project ID in config does not match FIREBASE_PROJECT_ID env variable.");
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            firebaseAdminInitialized = true;
            context.log("Firebase Admin SDK initialized successfully.");
        } catch (error) {
            context.log.error("Error initializing Firebase Admin SDK:", error);
            throw new Error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
        }
    }
}

// Cache for Firebase public keys (JWKS) to avoid fetching on every request
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
    context.log('HTTP trigger function processed a request for SetUserRole.');

    // Initialize Firebase Admin SDK (will only run once per cold start)
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
                if (!jwk) {
                    return callback(new Error('Firebase public key not found for token KID.'));
                }
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
            context.res = { status: 403, body: "Permission denied: Only admin users can set user roles." };
            return;
        }
        context.log(`Admin user ${decodedToken.email} (UID: ${decodedToken.uid}) is setting a user role.`);

    } catch (error) {
        context.log.error('Admin token verification failed:', error);
        context.res = { status: 403, body: `Invalid or expired admin token: ${error.message}` };
        return;
    }
    // --- End Authentication and Authorization ---

    const { uid, role } = req.body;

    if (!uid || !role) {
        context.res = {
            status: 400,
            body: "Please provide a user UID and a role (e.g., 'udyamMitra' or 'admin')."
        };
        return;
    }

    if (!['udyamMitra', 'admin'].includes(role)) {
        context.res = {
            status: 400,
            body: "Invalid role specified. Role must be 'udyamMitra' or 'admin'."
        };
        return;
    }

    try {
        // Set custom user claims for the specified UID
        await admin.auth().setCustomUserClaims(uid, { role: role });

        // Revoke the user's refresh tokens to force them to re-authenticate
        // This ensures their ID token is immediately updated with the new custom claims.
        await admin.auth().revokeRefreshTokens(uid);

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Role '${role}' set for user ${uid}. User's tokens revoked.` })
        };
        context.log(`Role '${role}' set for user UID: ${uid}`);

    } catch (error) {
        context.log.error('Error setting user role or revoking tokens:', error);
        context.res = { status: 500, body: `Error setting user role: ${error.message}` };
    }
};
