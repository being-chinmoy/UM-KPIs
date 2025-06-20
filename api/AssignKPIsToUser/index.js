// api/AssignKPIsToUser/index.js
// This function allows an admin to assign master KPIs to a specific Udyam Mitra for a given month.

const { CosmosClient } = require('@azure/cosmos');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const fetch = require('node-fetch'); // Required for fetching JWKS

// Cosmos DB Client Setup (ensure CosmosDbConnection is set in Application Settings)
const connectionString = process.env.CosmosDbConnection;
const client = new CosmosClient(connectionString);
const databaseId = "UdyamMitraDB"; // Your Cosmos DB database ID
const assignedKpiContainerId = "AssignedKPIs"; // Container for assigned KPIs
const masterKpiContainerId = "MasterKPIs"; // Container for master KPI definitions
const assignedKpiContainer = client.database(databaseId).container(assignedKpiContainerId);
const masterKpiContainer = client.database(databaseId).container(masterKpiContainerId);


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
    context.log('HTTP trigger function processed a request for AssignKPIsToUser.');

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

        if (decodedToken.role !== 'admin') {
            context.res = { status: 403, body: "Permission denied: Only admin users can assign KPIs." };
            return;
        }
        context.log(`Admin user ${decodedToken.email} (UID: ${decodedToken.uid}) is assigning KPIs.`);

    } catch (error) {
        context.log.error('Admin token verification failed:', error);
        context.res = { status: 403, body: `Invalid or expired admin token: ${error.message}` };
        return;
    }
    // --- End Authentication and Authorization ---

    const { udyamMitraId, kpiIds, monthYear } = req.body; // Expect an array of kpiIds

    if (!udyamMitraId || !kpiIds || !Array.isArray(kpiIds) || kpiIds.length === 0 || !monthYear) {
        context.res = {
            status: 400,
            body: "Please provide udyamMitraId, an array of kpiIds, and monthYear (YYYY-MM)."
        };
        return;
    }

    try {
        // Fetch the master KPI definitions for the provided kpiIds
        const querySpec = {
            query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@kpiIds, c.id)`,
            parameters: [
                { name: "@kpiIds", value: kpiIds }
            ]
        };
        const { resources: masterKpis } = await masterKpiContainer.items.query(querySpec).fetchAll();

        if (masterKpis.length !== kpiIds.length) {
            context.res = {
                status: 404,
                body: "One or more master KPIs not found."
            };
            return;
        }

        const operations = [];
        for (const kpi of masterKpis) {
            const assignedKpiId = `${udyamMitraId}-${kpi.id}-${monthYear}`; // Unique ID for assigned KPI
            const assignedKpi = {
                id: assignedKpiId,
                udyamMitraId: udyamMitraId,
                kpiId: kpi.id, // Reference to the master KPI ID
                kpiName: kpi.kpiName,
                description: kpi.description,
                monthlyTarget: kpi.monthlyTarget,
                reportingFormat: kpi.reportingFormat,
                category: kpi.category,
                currentValue: 0, // Initialize current value to 0 for new assignments
                submissionMonthYear: monthYear,
                lastUpdated: new Date().toISOString()
            };

            // Use upsert to create or replace the assigned KPI document
            // Assuming partition key is 'udyamMitraId' for AssignedKPIs container
            operations.push(assignedKpiContainer.items.upsert(assignedKpi));
        }

        await Promise.all(operations);

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `KPIs successfully assigned to ${udyamMitraId} for ${monthYear}` })
        };

    } catch (error) {
        context.log.error('Error assigning KPIs:', error);
        context.res = { status: 500, body: `Error assigning KPIs: ${error.message}` };
    }
};
