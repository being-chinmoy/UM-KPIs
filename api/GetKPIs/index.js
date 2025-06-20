// api/GetKPIs/index.js
// This function fetches KPI data from Cosmos DB.
// If requestedUid is provided, it fetches assigned KPIs for that user.
// If requested by an admin without a specific user, it fetches all master KPI definitions.

const { CosmosClient } = require('@azure/cosmos');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const fetch = require('node-fetch'); // Required for fetching JWKS

// Cosmos DB Client Setup (ensure CosmosDbConnection is set in Application Settings)
const connectionString = process.env.CosmosDbConnection;
const client = new CosmosClient(connectionString);
const databaseId = "UdyamMitraDB"; // Your Cosmos DB database ID
const masterKpiContainerId = "MasterKPIs"; // Container for master KPI definitions
const assignedKpiContainerId = "AssignedKPIs"; // Container for user-assigned KPIs
const masterKpiContainer = client.database(databaseId).container(masterKpiContainerId);
const assignedKpiContainer = client.database(databaseId).container(assignedKpiContainerId);


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
    context.log('HTTP trigger function processed a request for GetKPIs.');

    // --- Authentication and Authorization ---
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

        context.log(`User ${decodedToken.email} (UID: ${decodedToken.uid}, Role: ${decodedToken.role || 'udyamMitra'}) is requesting KPIs.`);

    } catch (error) {
        context.log.error('Token verification failed:', error);
        context.res = { status: 403, body: `Invalid or expired token: ${error.message}` };
        return;
    }
    // --- End Authentication and Authorization ---

    const { requestedUid, monthYear } = req.body || {}; // Allow empty body for GET requests or admin requests for master KPIs

    try {
        const currentMonthYear = monthYear || new Date().toISOString().substring(0, 7); // Default to current month

        let kpisToReturn = [];

        // If a specific UID is requested (typically by a Udyam Mitra for their own KPIs
        // or by an admin viewing a specific Udyam Mitra's dashboard)
        if (requestedUid) {
            // Ensure the requesting user is either the requested UID or an admin
            if (decodedToken.uid !== requestedUid && decodedToken.role !== 'admin') {
                context.res = { status: 403, body: "Permission denied: You can only view your own KPIs unless you are an admin." };
                return;
            }

            // Query assigned KPIs for the requested UID for the specific month/year
            const querySpec = {
                query: `SELECT * FROM c WHERE c.udyamMitraId = @udyamMitraId AND c.submissionMonthYear = @monthYear`,
                parameters: [
                    { name: "@udyamMitraId", value: requestedUid },
                    { name: "@monthYear", value: currentMonthYear }
                ]
            };
            const { resources: assignedKpis } = await assignedKpiContainer.items.query(querySpec).fetchAll();
            kpisToReturn = assignedKpis;

            context.log(`Fetched ${assignedKpis.length} assigned KPIs for UID: ${requestedUid} for ${currentMonthYear}`);

        } else if (decodedToken.role === 'admin') {
            // If no specific UID is requested AND the user is an admin, return all master KPI definitions
            const { resources: masterKpis } = await masterKpiContainer.items.readAll().fetchAll();
            kpisToReturn = masterKpis;
            context.log(`Fetched ${masterKpis.length} master KPIs for admin.`);
        } else {
            // If no specific UID is requested AND the user is not an admin, deny access
            context.res = { status: 400, body: "Invalid request: Please specify a user ID or ensure you have admin privileges to fetch all master KPIs." };
            return;
        }

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(kpisToReturn)
        };

    } catch (error) {
        context.log.error('Error fetching KPIs:', error);
        context.res = { status: 500, body: `Error fetching KPIs: ${error.message}` };
    }
};
