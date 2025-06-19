// UpdateKpiSubmission/index.js
// This function handles the submission of KPI updates from the frontend.
// It verifies the Firebase ID token for authentication and then updates
// or inserts KPI data into Azure Cosmos DB.

const { CosmosClient } = require('@azure/cosmos');
const jwt = require('jsonwebtoken'); // Used for verifying Firebase ID tokens (JWTs)
const jwkToPem = require('jwk-to-pem'); // Converts JSON Web Keys (JWK) to PEM format for JWT verification

// Cache for Firebase public keys (JWKS - JSON Web Key Set).
// In a production environment, these should be refreshed periodically.
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

/**
 * Main entry point for the UpdateKpiSubmission HTTP trigger.
 * @param {object} context - The Azure Functions context object.
 * @param {object} req - The HTTP request object.
 */
module.exports = async function (context, req) {
    context.log('HTTP trigger function processed a request for UpdateKpiSubmission.');

    // Retrieve environment variables required for Cosmos DB and Firebase integration.
    // These must be set as Application Settings in your Azure Function App.
    const cosmosDbConnection = process.env.CosmosDbConnection;
    const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
    const databaseId = 'KpiDb'; // Ensure this matches your Cosmos DB database ID
    const containerId = 'KPISubmissions'; // Ensure this matches your Cosmos DB container ID

    // Validate essential environment variables are present.
    if (!cosmosDbConnection || !firebaseProjectId) {
        context.log.error("CosmosDbConnection or FIREBASE_PROJECT_ID environment variables not set.");
        context.res = {
            status: 500,
            body: "Backend configuration missing. Cosmos DB or Firebase Project ID not set."
        };
        return;
    }

    // Parse Cosmos DB connection string components.
    const endpoint = cosmosDbConnection.split('AccountEndpoint=')[1].split(';')[0];
    const key = cosmosDbConnection.split('AccountKey=')[1].split(';')[0];

    // Initialize Cosmos DB client.
    const client = new CosmosClient({ endpoint, key });
    const database = client.database(databaseId);
    const container = database.container(containerId);

    // --- Firebase ID Token Verification ---
    // Check for Authorization header with Bearer token.
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        context.res = {
            status: 401,
            body: "Authorization token required. Please log in."
        };
        return;
    }

    // Extract the ID token.
    const idToken = authHeader.split(' ')[1];
    let decodedToken;
    try {
        // Fetch Firebase public keys and verify the ID token.
        const jwks = await getFirebasePublicKeys(context);
        decodedToken = await new Promise((resolve, reject) => {
            jwt.verify(idToken, (header, callback) => {
                // Find the correct public key using the 'kid' (key ID) from the token header.
                const kid = header.kid;
                const jwk = Object.values(jwks).find(k => k.kid === kid);
                if (!jwk) {
                    context.log.error('JWK not found for kid:', kid);
                    return callback(new Error('Firebase public key not found for token.'));
                }
                const pem = jwkToPem(jwk); // Convert JWK to PEM format for verification.
                callback(null, pem);
            }, { algorithms: ['RS256'] }, (err, decoded) => {
                if (err) {
                    reject(err); // If verification fails, reject the promise.
                } else {
                    resolve(decoded); // If successful, resolve with the decoded token.
                }
            });
        });

        // Additional checks for token audience and issuer to ensure it's for your Firebase project.
        if (decodedToken.aud !== firebaseProjectId) {
            throw new Error(`Firebase token audience mismatch. Expected ${firebaseProjectId}, got ${decodedToken.aud}`);
        }
        if (decodedToken.iss !== `https://securetoken.google.com/${firebaseProjectId}`) {
            throw new Error(`Firebase token issuer mismatch. Expected https://securetoken.google.com/${firebaseProjectId}, got ${decodedToken.iss}`);
        }

        const uid = decodedToken.uid;
        const email = decodedToken.email;
        context.log(`Token verified for user: ${email} (UID: ${uid})`);

    } catch (error) {
        context.log.error('Firebase token verification failed:', error);
        context.res = {
            status: 403, // Forbidden status for invalid token.
            body: `Invalid or expired authentication token: ${error.message}`
        };
        return;
    }
    // --- End Firebase ID Token Verification ---

    // Extract data from the request body.
    const { kpiId, submittedValue, udyamMitraId, submissionDate, submissionMonthYear } = req.body;

    // Validate required fields in the request body.
    if (!kpiId || submittedValue === undefined || !udyamMitraId || !submissionDate || !submissionMonthYear) {
        context.res = {
            status: 400, // Bad Request status.
            body: "Please pass kpiId, submittedValue, udyamMitraId, submissionDate, and submissionMonthYear in the request body."
        };
        return;
    }

    try {
        let existingKpi;
        try {
            // Attempt to read the existing KPI document from Cosmos DB.
            // We assume 'kpiId' is both the document ID and the partition key.
            const { resource } = await container.item(kpiId, kpiId).read();
            existingKpi = resource;
        } catch (error) {
            // If the item is not found (status 404), it's not an error for this logic; we'll create a new one.
            if (error.code === 404) {
                context.log(`KPI with ID ${kpiId} not found, preparing to create new document.`);
            } else {
                throw error; // Re-throw other types of errors during read.
            }
        }

        let kpiToSave;
        if (existingKpi) {
            // If the KPI document exists, update its current value and add to submission history.
            existingKpi.currentValue = submittedValue;
            if (!existingKpi.submissionHistory) {
                existingKpi.submissionHistory = [];
            }
            existingKpi.submissionHistory.push({
                udyamMitraId: udyamMitraId,
                value: submittedValue,
                date: submissionDate,
                monthYear: submissionMonthYear,
                submittedByUid: decodedToken.uid,
                submittedByEmail: decodedToken.email,
                submissionType: "update" // Mark as an update submission.
            });
            kpiToSave = existingKpi;
        } else {
            // If the KPI document does not exist, create a new one.
            // Note: In a production system, you might want a more sophisticated way
            // to get KPI metadata (name, target, description, category) for new KPIs,
            // perhaps from a master data source. For this demo, placeholders are used.
            kpiToSave = {
                id: kpiId,
                kpiName: `KPI for ${kpiId}`, // Placeholder, should be specific
                monthlyTarget: null, // Placeholder, should be specific
                description: `Description for ${kpiId}`, // Placeholder
                reportingFormat: 'Digital Submission', // Placeholder
                category: 'common', // Default category, might need to be dynamic
                currentValue: submittedValue,
                submissionHistory: [{
                    udyamMitraId: udyamMitraId,
                    value: submittedValue,
                    date: submissionDate,
                    monthYear: submissionMonthYear,
                    submittedByUid: decodedToken.uid,
                    submittedByEmail: decodedToken.email,
                    submissionType: "initial" // Mark as an initial submission.
                }]
            };
        }

        // Use upsert to either replace an existing document or create a new one.
        const { resource: upsertedItem } = await container.items.upsert(kpiToSave);

        context.res = {
            status: 200, // OK status for successful upsert.
            body: { message: "KPI upserted successfully", updatedKpi: upsertedItem }
        };

    } catch (error) {
        context.log.error('Error in UpdateKpiSubmission function:', error);
        context.res = {
            status: 500, // Internal Server Error status.
            body: `Error processing KPI update: ${error.message}`
        };
    }
};
