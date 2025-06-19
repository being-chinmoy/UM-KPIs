// SetUserRole/index.js
// This function allows an authenticated admin user to set custom roles
// for other Firebase users via their custom claims.
// It requires the Firebase Admin SDK to be initialized.

const admin = require('firebase-admin'); // Firebase Admin SDK for user management
const jwt = require('jsonwebtoken'); // For verifying Firebase ID tokens
const jwkToPem = require('jwk-to-pem'); // Converts JWK to PEM format

// Cache for Firebase public keys (JWKS).
// These keys are used to verify the authenticity of Firebase ID tokens.
let firebasePublicKeys = null;
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/**
 * Fetches Firebase's public keys for JWT verification.
 * Caches them to avoid repeated API calls.
 * @param {object} context - The Azure Functions context object for logging.
 * @returns {Promise<object>} A promise that resolves to the Firebase public keys.
 */
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


// Flag to ensure Firebase Admin SDK is initialized only once per function app instance.
let firebaseAdminInitialized = false;

/**
 * Initializes the Firebase Admin SDK using credentials from environment variables.
 * This should be called once when the function app starts.
 * @param {object} context - The Azure Functions context object for logging.
 * @throws {Error} If required environment variables are missing or initialization fails.
 */
function initializeFirebaseAdmin(context) {
    if (!firebaseAdminInitialized) {
        const serviceAccountConfigBase64 = process.env.FIREBASE_ADMIN_SDK_CONFIG;
        const firebaseProjectId = process.env.FIREBASE_PROJECT_ID; // Used for validation

        if (!serviceAccountConfigBase64) {
            context.log.error("FIREBASE_ADMIN_SDK_CONFIG environment variable not set.");
            throw new Error("Firebase Admin SDK config is missing. Please set this Application Setting.");
        }
        if (!firebaseProjectId) {
            context.log.error("FIREBASE_PROJECT_ID environment variable not set.");
            throw new Error("Firebase Project ID is missing. Please set this Application Setting.");
        }

        try {
            // Decode the Base64 string to a UTF-8 JSON string, then parse it into an object.
            const serviceAccountConfigJson = Buffer.from(serviceAccountConfigBase64, 'base64').toString('utf8');
            const serviceAccount = JSON.parse(serviceAccountConfigJson);

            // Optional: Validate that the project_id in the service account JSON matches the env var.
            if (serviceAccount.project_id && serviceAccount.project_id !== firebaseProjectId) {
                context.log.error(`Service account project ID mismatch. Expected ${firebaseProjectId}, got ${serviceAccount.project_id}.`);
                throw new Error("Firebase Admin SDK project ID in config does not match FIREBASE_PROJECT_ID env variable.");
            }

            // Initialize the Firebase Admin SDK.
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

/**
 * Main entry point for the SetUserRole HTTP trigger.
 * @param {object} context - The Azure Functions context object.
 * @param {object} req - The HTTP request object.
 */
module.exports = async function (context, req) {
    context.log('HTTP trigger function processed a request for SetUserRole.');

    // Attempt to initialize Firebase Admin SDK.
    try {
        initializeFirebaseAdmin(context);
    } catch (error) {
        context.res = {
            status: 500,
            body: `Server configuration error: ${error.message}`
        };
        return;
    }

    // --- Firebase ID Token Verification (Admin User Only) ---
    // This section verifies the token of the user making the request
    // and ensures they have an 'admin' role.
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        context.res = {
            status: 401,
            body: "Authorization token required. Only authenticated users can call this API."
        };
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
                    context.log.error('JWK not found for kid:', kid);
                    return callback(new Error('Firebase public key not found for token.'));
                }
                const pem = jwkToPem(jwk);
                callback(null, pem);
            }, { algorithms: ['RS256'] }, (err, decoded) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(decoded);
                }
            });
        });

        const FIREBASE_PROJECT_ID_ENV = process.env.FIREBASE_PROJECT_ID;
        // Validate token audience and issuer.
        if (decodedToken.aud !== FIREBASE_PROJECT_ID_ENV) {
            throw new Error(`Firebase token audience mismatch. Expected ${FIREBASE_PROJECT_ID_ENV}, got ${decodedToken.aud}`);
        }
        if (decodedToken.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID_ENV}`) {
            throw new Error(`Firebase token issuer mismatch. Expected https://securetoken.google.com/${FIREBASE_PROJECT_ID_ENV}, got ${decodedToken.iss}`);
        }

        // Crucial check: Ensure the authenticated user has the 'admin' role.
        if (decodedToken.role !== 'admin') {
            context.res = {
                status: 403, // Forbidden status for unauthorized access.
                body: "Permission denied: Only users with 'admin' role can set other user roles."
            };
            return;
        }
        context.log(`Admin user ${decodedToken.email} (UID: ${decodedToken.uid}) is attempting to set a user role.`);

    } catch (error) {
        context.log.error('Admin token verification failed:', error);
        context.res = {
            status: 403,
            body: `Invalid or expired admin token: ${error.message}`
        };
        return;
    }
    // --- End Firebase ID Token Verification ---


    // Extract UID and desired role from the request body.
    const { uid, role } = req.body;

    // Validate request body parameters.
    if (!uid || !role) {
        context.res = {
            status: 400, // Bad Request status.
            body: "Please provide 'uid' (User ID) and 'role' in the request body."
        };
        return;
    }

    // Basic role validation: ensure only allowed roles can be set.
    const allowedRoles = ['udyamMitra', 'admin'];
    if (!allowedRoles.includes(role)) {
        context.res = {
            status: 400,
            body: `Invalid role specified. Allowed roles are: ${allowedRoles.join(', ')}.`
        };
        return;
    }

    try {
        // Set custom user claims for the specified UID using Firebase Admin SDK.
        await admin.auth().setCustomUserClaims(uid, { role: role });

        // Revoke the user's refresh tokens. This forces the user to re-authenticate
        // so that their ID token (which contains custom claims) is refreshed.
        // Without this, the role change wouldn't be reflected until their token naturally expires.
        await admin.auth().revokeRefreshTokens(uid);
        context.log(`Custom claim 'role:${role}' set for user ${uid}. Tokens revoked.`);

        context.res = {
            status: 200, // OK status for successful operation.
            body: { message: `Custom claim 'role:${role}' set for user ${uid}. User will need to re-authenticate to apply the new role.` }
        };
    } catch (error) {
        context.log.error('Error setting custom user claim:', error);
        context.res = {
            status: 500, // Internal Server Error status.
            body: `Error setting user role: ${error.message}`
        };
    }
};
