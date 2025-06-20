// api/UpdateKpiSubmission/index.js
// This function handles both submitting KPI values for Udyam Mitras
// and updating master KPI definitions by admins.

const { CosmosClient } = require('@azure/cosmos');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const fetch = require('node-fetch'); // Required for fetching JWKS

// Cosmos DB Client Setup (ensure CosmosDbConnection is set in Application Settings)
const connectionString = process.env.CosmosDbConnection;
const client = new CosmosClient(connectionString);
const databaseId = "UdyamMitraDB"; // Your Cosmos DB database ID
const assignedKpiContainerId = "AssignedKPIs"; // Container for user-submitted KPIs
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
    context.log('HTTP trigger function processed a request for UpdateKpiSubmission.');

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

        context.log(`User ${decodedToken.email} (UID: ${decodedToken.uid}, Role: ${decodedToken.role || 'udyamMitra'}) is submitting/updating KPI.`);

    } catch (error) {
        context.log.error('Token verification failed:', error);
        context.res = { status: 403, body: `Invalid or expired token: ${error.message}` };
        return;
    }
    // --- End Authentication and Authorization ---

    const { 
        kpiId, 
        submittedValue, 
        udyamMitraId, 
        submissionDate, 
        submissionMonthYear,
        // Optional fields for master KPI updates (from Admin Dashboard)
        kpiName, 
        description, 
        monthlyTarget, 
        reportingFormat, 
        category 
    } = req.body;

    // Determine if this is a user submission (udyamMitraId present) or a master KPI update (no udyamMitraId)
    const isUserSubmission = !!udyamMitraId;
    const isAdminMasterUpdate = !udyamMitraId && decodedToken.role === 'admin';

    if (!kpiId) {
        context.res = { status: 400, body: "KPI ID is required." };
        return;
    }

    try {
        if (isUserSubmission) {
            // Logic for Udyam Mitra submitting their KPI value
            if (decodedToken.uid !== udyamMitraId) {
                context.res = { status: 403, body: "Permission denied: You can only submit KPIs for yourself." };
                return;
            }
            if (submittedValue === undefined || !submissionDate || !submissionMonthYear) {
                context.res = { status: 400, body: "For user submission, submittedValue, submissionDate, and submissionMonthYear are required." };
                return;
            }

            // Construct the unique ID for the assigned KPI document
            const assignedKpiDocId = `${udyamMitraId}-${kpiId}-${submissionMonthYear}`;
            
            // Get the existing assigned KPI document
            const { resource: existingAssignedKpi } = await assignedKpiContainer.item(assignedKpiDocId, udyamMitraId).read();

            if (existingAssignedKpi) {
                // Update existing assigned KPI
                existingAssignedKpi.currentValue = submittedValue;
                existingAssignedKpi.lastUpdated = new Date().toISOString();
                // Ensure other fields from master KPI are preserved if not provided in submission
                await assignedKpiContainer.items.upsert(existingAssignedKpi);
                context.log(`Updated KPI ${kpiId} for user ${udyamMitraId} for ${submissionMonthYear} to value: ${submittedValue}`);
            } else {
                // This means an Udyam Mitra is submitting a KPI that hasn't been assigned yet.
                // In a stricter system, you might want to prevent this.
                // For now, let's create a new assigned KPI document, but warn.
                context.log.warn(`User ${udyamMitraId} submitted KPI ${kpiId} which was not pre-assigned for ${submissionMonthYear}. Creating new assigned KPI document.`);
                
                // Fetch master KPI details to create a complete assigned KPI document
                const { resource: masterKpi } = await masterKpiContainer.item(kpiId, kpiId).read();
                if (!masterKpi) {
                    context.res = { status: 404, body: `Master KPI with ID ${kpiId} not found. Cannot assign.` };
                    return;
                }

                const newAssignedKpi = {
                    id: assignedKpiDocId,
                    udyamMitraId: udyamMitraId,
                    kpiId: kpiId,
                    kpiName: masterKpi.kpiName,
                    description: masterKpi.description,
                    monthlyTarget: masterKpi.monthlyTarget,
                    reportingFormat: masterKpi.reportingFormat,
                    category: masterKpi.category,
                    currentValue: submittedValue,
                    submissionDate: submissionDate,
                    submissionMonthYear: submissionMonthYear,
                    lastUpdated: new Date().toISOString()
                };
                await assignedKpiContainer.items.upsert(newAssignedKpi);
            }

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "KPI submission recorded successfully." })
            };

        } else if (isAdminMasterUpdate) {
            // Logic for Admin updating master KPI definitions
            if (!kpiName || !monthlyTarget || !category) {
                context.res = { status: 400, body: "For master KPI update, kpiName, monthlyTarget, and category are required." };
                return;
            }

            const masterKpiDoc = {
                id: kpiId, // ID is the kpiId itself for master KPIs
                kpiName,
                description: description || '',
                monthlyTarget,
                reportingFormat: reportingFormat || '',
                category,
                lastUpdated: new Date().toISOString()
            };
            
            // Use upsert to create or replace the master KPI document
            // Assuming partition key is 'id' for MasterKPIs container
            await masterKpiContainer.items.upsert(masterKpiDoc);
            context.log(`Updated/Created master KPI: ${kpiId}`);

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "Master KPI updated successfully." })
            };

        } else {
            // Invalid request type or insufficient permissions
            context.res = { status: 403, body: "Invalid request or insufficient permissions to perform this action." };
            return;
        }

    } catch (error) {
        context.log.error('Error in UpdateKpiSubmission:', error);
        context.res = { status: 500, body: `Error processing KPI update: ${error.message}` };
    }
};
