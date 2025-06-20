// AssignKPIsToUser/index.js
// This function allows an authenticated admin user to assign specific KPIs
// to a given Udyam Mitra (identified by their Firebase UID) for a period.

const admin = require('firebase-admin'); // Firebase Admin SDK for user management
const { CosmosClient } = require('@azure/cosmos');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');

// Firebase Admin SDK initialization (same as in SetUserRole)
let firebaseAdminInitialized = false;
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
            firebaseAdminInitialized = true;
            context.log("Firebase Admin SDK initialized successfully.");
        } catch (error) {
            context.log.error("Error initializing Firebase Admin SDK:", error);
            throw new Error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
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
    context.log('HTTP trigger function processed a request for AssignKPIsToUser.');

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
            context.res = { status: 403, body: "Permission denied: Only admin users can assign KPIs." };
            return;
        }
        context.log(`Admin user ${decodedToken.email} is assigning KPIs.`);

    } catch (error) {
        context.log.error('Admin token verification failed:', error);
        context.res = { status: 403, body: `Invalid or expired admin token: ${error.message}` };
        return;
    }
    // --- End Authentication and Authorization ---

    // Extract data from request body
    const { udyamMitraUid, assignedKpiIds, monthYear } = req.body;

    if (!udyamMitraUid || !Array.isArray(assignedKpiIds) || assignedKpiIds.length === 0 || !monthYear) {
        context.res = {
            status: 400,
            body: "Please provide 'udyamMitraUid', 'assignedKpiIds' (non-empty array), and 'monthYear' in the request body."
        };
        return;
    }

    const cosmosDbConnection = process.env.CosmosDbConnection;
    const databaseId = 'KpiDb'; // Your actual database ID
    const containerId = 'UserKpiAssignments'; // New container ID for assignments

    if (!cosmosDbConnection) {
        context.log.error("CosmosDbConnection environment variable not set.");
        context.res = { status: 500, body: "Cosmos DB connection string is missing." };
        return;
    }

    const client = new CosmosClient(cosmosDbConnection);
    const database = client.database(databaseId);
    const container = database.container(containerId);

    // Document ID for assignment can be a combination of UID and monthYear
    // This allows for different assignments per month for the same user
    const assignmentDocId = `${udyamMitraUid}-${monthYear}`; 

    try {
        const assignmentDoc = {
            id: assignmentDocId,
            udyamMitraUid: udyamMitraUid,
            monthYear: monthYear,
            assignedKpiIds: assignedKpiIds,
            lastUpdated: new Date().toISOString()
        };

        // Use upsert to create or update the assignment for the user for that month
        const { resource: upsertedItem } = await container.items.upsert(assignmentDoc);

        context.res = {
            status: 200,
            body: { message: `KPIs assigned to ${udyamMitraUid} for ${monthYear} successfully.`, assignment: upsertedItem }
        };

    } catch (error) {
        context.log.error('Error assigning KPIs:', error);
        context.res = { status: 500, body: `Error assigning KPIs: ${error.message}` };
    }
};
