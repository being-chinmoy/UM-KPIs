// GetKPIs/index.js
// This function fetches KPI data from Cosmos DB.
// It uses Firebase ID token verification for authentication and authorization.
// Admin users can fetch all KPIs, while 'udyamMitra' users fetch only
// KPIs assigned to them for the current month/period.

const admin = require('firebase-admin'); // Firebase Admin SDK for custom claims
const { CosmosClient } = require('@azure/cosmos');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');

// Firebase Admin SDK initialization (same as in other functions)
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

// Initial KPI data (copied directly from your frontend's mockKPIs)
// This serves as the master list of KPIs to be used if backend is empty or for metadata merging.
const masterKPIsData = [
  { id: 'common1', kpiName: "Enterprise Interactions (Field Visits)", description: "No. of MSMEs, SHGs, informal enterprises met (field grievances)", monthlyTarget: 10, reportingFormat: "Field Visit Report with geo-tagged photos", category: "common" },
  { id: 'common2', kpiName: "Beneficiary Grievances Resolved", description: "Grievances addressed for field enterprises", monthlyTarget: 10, reportingFormat: "Google Sheet", category: "common" },
  { id: 'common3', kpiName: "Baseline Surveys or Field Assessments", description: "Surveys conducted for ground mapping", monthlyTarget: 4, reportingFormat: "Google Sheet", category: "common" },
  { id: 'common4', kpiName: "Scheme Applications Facilitated", description: "Applications in PMFME, PMEGP, UDYAM, E-Shram, etc.", monthlyTarget: 10, reportingFormat: "Application copies/Screenshot of status", category: "common" },
  { id: 'common5', kpiName: "Follow-ups on Scheme Applications", description: "Tracking and facilitating pending cases", monthlyTarget: 5, reportingFormat: "Tracking Sheet with outcome status", category: "common" },
  { id: 'common6', kpiName: "Workshops / EDP Organized", description: "Mobilization, awareness events", monthlyTarget: 2, reportingFormat: "Attendance sheets, photos, videos", category: "common" },
  { id: 'common7', kpiName: "Financial Literacy or Formalization Support", description: "1-to-1 guidance on PAN, GST, Udyam, New Industrial Policy, etc.", monthlyTarget: 10, reportingFormat: "Documentation list, Google Sheet", category: "common" },
  { id: 'common8', kpiName: "New Enterprise Cases Identified", description: "New informal businesses identified and profiled", monthlyTarget: 5, reportingFormat: "Enterprise profiling Google Sheet", category: "common" },
  { id: 'common9', kpiName: "Credit Linkage Facilitation", description: "Referrals to banks, NBFCs", monthlyTarget: 5, reportingFormat: "Bank interaction/follow-up record/ google sheet", category: "common" },
  { id: 'common10', kpiName: "Portal/MIS Updates & Data Entry", description: "Timely data updates in MIS/Google Sheets", monthlyTarget: 100, reportingFormat: "MIS Portal/Google Sheet", category: "common" },
  { id: 'common11', kpiName: "Convergence & Departmental Coordination", description: "Meetings with DICs, RD, Agri/Horti, etc.", monthlyTarget: 2, reportingFormat: "Meeting MoM or signed attendance list", category: "common" },
  { id: 'common12', kpiName: "Support to EDPs, RAMP, and Field Activities", description: "Participation in Enterprise Development Programs or RAMP", monthlyTarget: 'As per deployment', reportingFormat: "Program report signed by supervisor", category: "common" },
  { id: 'common13', kpiName: "Case Studies / Beneficiary Success Stories", description: "Documenting success stories from the field", monthlyTarget: 1, reportingFormat: "Minimum 500 words + image/video", category: "common" },
  { id: 'common14', kpiName: "Pollution/Pollutant Check", description: "Visit to Industrial Estate, and do proper reading of machine for pollution/pollutant", monthlyTarget: 2, reportingFormat: "Google sheet with geo tagged photos", category: "common" },

  { id: 'eco1', kpiName: "Loan Applications Supported", monthlyTarget: 5, reportingFormat: "Google Sheet", category: "ecosystem" },
  { id: 'eco2', kpiName: "Business Model/Plan Guidance Provided", monthlyTarget: 5, reportingFormat: "Google Sheet", category: "ecosystem" },
  { id: 'eco3', kpiName: "Artisans/Entrepreneurs Linked to Schemes", monthlyTarget: 10, reportingFormat: "Google Sheet", category: "ecosystem" },
  { id: 'eco4', kpiName: "Financial Literacy Sessions (Group) Conducted", monthlyTarget: 5, reportingFormat: "Photos/Videos/Google Sheet", category: "ecosystem" },
  { id: 'eco5', kpiName: "New Initiatives in Entrepreneurship Promotion", monthlyTarget: 1, reportingFormat: "Report/Google Sheet", category: "ecosystem" },
  { id: 'eco6', kpiName: "Enterprise/Business Ideas Scouted", monthlyTarget: 1, reportingFormat: "Report/Google Sheet", category: "ecosystem" },

  { id: 'hosp1', kpiName: "Tourism Potential Sites Documented or Supported", monthlyTarget: 2, reportingFormat: "Photos/Videos/Google Sheet", category: "hospitality" },
  { id: 'hosp2', kpiName: "Tourism Promotion Events / Community Engagements", monthlyTarget: 4, reportingFormat: "Photos/Videos/Google Sheet", category: "hospitality" },
  { id: 'hosp3', kpiName: "Homestays/Tour Operators Onboarded/Assisted", monthlyTarget: 5, reportingFormat: "Google Sheet", category: "hospitality" },
  { id: 'hosp4', kpiName: "Local Youth/SHGs Trained in Tourism/Hospitality Services", monthlyTarget: 10, reportingFormat: "Google Sheet", category: "hospitality" },

  { id: 'agri1', kpiName: "Agri/Forest-Based Enterprises Supported", monthlyTarget: 5, reportingFormat: "Google Sheet", category: "agriForest" },
  { id: 'agri2', kpiName: "SHGs Linked to Agri/Animal Husbandry/Processing Units", monthlyTarget: 3, reportingFormat: "Google Sheet", category: "agriForest" },

  { id: 'dbms1', kpiName: "Portal/MIS Data Entry & Monitoring", monthlyTarget: 100, reportingFormat: "Google Sheet, MIS Portal", category: "dbmsMIS" },
  { id: 'dbms2', kpiName: "Data Validation, Error Rectification, and Reporting", monthlyTarget: 'Monthly Review', reportingFormat: "Issue logs, rectification reports via email", category: "dbmsMIS" },
  { id: 'dbms3', kpiName: "Collaboration with Line Departments and Portal Developers", monthlyTarget: 'Continuous', reportingFormat: "Meeting Notes, Email Records", category: "dbmsMIS" },
];


module.exports = async function (context, req) {
    context.log('HTTP trigger function processed a request for GetKPIs.');

    // Initialize Firebase Admin SDK for role checking
    try {
        initializeFirebaseAdmin(context);
    } catch (error) {
        context.res = {
            status: 500,
            body: `Server configuration error: ${error.message}`
        };
        return;
    }

    // --- Authentication and Authorization ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        context.res = { status: 401, body: "Authorization token required. Please log in." };
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
                if (!jwk) return callback(new Error('Firebase public key not found for token.'));
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

        context.log(`Token verified for user: ${decodedToken.email} (UID: ${decodedToken.uid}) with role: ${decodedToken.role || 'udyamMitra'}`);

    } catch (error) {
        context.log.error('Firebase token verification failed:', error);
        context.res = { status: 403, body: `Invalid or expired authentication token: ${error.message}` };
        return;
    }
    // --- End Authentication and Authorization ---

    const cosmosDbConnection = process.env.CosmosDbConnection;
    const databaseId = 'KpiDb'; // Your actual database ID
    const submissionsContainerId = 'KPISubmissions'; // Container for KPI actual values and history
    const assignmentsContainerId = 'UserKpiAssignments'; // New container for user-KPI assignments

    if (!cosmosDbConnection) {
        context.log.error("CosmosDbConnection environment variable not set.");
        context.res = { status: 500, body: "Cosmos DB connection string is missing." };
        return;
    }

    const client = new CosmosClient(cosmosDbConnection);
    const database = client.database(databaseId);
    const submissionsContainer = database.container(submissionsContainerId);
    const assignmentsContainer = database.container(assignmentsContainerId);

    const userRole = decodedToken.role || 'udyamMitra'; // Get role from custom claims
    const requestedUid = req.body.requestedUid; // Frontend sends UID of user whose KPIs are being requested
    const currentMonthYear = new Date().toISOString().substring(0, 7); // e.g., "2025-06"

    let kpisToReturn = [];

    try {
        if (userRole === 'admin') {
            context.log('Admin user detected. Fetching all KPIs and merging with master data.');
            // Admins get all master KPIs and their latest values
            const { resources: allSubmittedKpis } = await submissionsContainer.items.query('SELECT * FROM c').fetchAll();
            
            // Merge actual values from DB with master definitions
            kpisToReturn = masterKPIsData.map(masterKpi => {
                const submittedKpi = allSubmittedKpis.find(s => s.id === masterKpi.id);
                // Return full master KPI data, but override currentValue if a submission exists
                return { ...masterKpi, currentValue: submittedKpi ? submittedKpi.currentValue : 0 };
            });

        } else if (userRole === 'udyamMitra' && requestedUid === decodedToken.uid) {
            context.log(`Udyam Mitra user ${decodedToken.email} detected. Fetching assigned KPIs.`);
            // Udyam Mitras fetch only KPIs assigned to them for the current month
            const assignmentDocId = `${decodedToken.uid}-${currentMonthYear}`;
            let assignedKpiIds = [];

            try {
                const { resource: assignment } = await assignmentsContainer.item(assignmentDocId, decodedToken.uid).read();
                assignedKpiIds = assignment.assignedKpiIds;
                context.log(`KPIs assigned for ${decodedToken.uid} for ${currentMonthYear}: ${JSON.stringify(assignedKpiIds)}`);
            } catch (err) {
                if (err.code === 404) {
                    context.log(`No KPI assignments found for Udyam Mitra ${decodedToken.uid} for ${currentMonthYear}.`);
                    // If no assignments, default to common KPIs for initial setup/demo
                    assignedKpiIds = masterKPIsData.filter(kpi => kpi.category === 'common').map(kpi => kpi.id);
                } else {
                    throw err; // Re-throw other errors
                }
            }

            if (assignedKpiIds.length > 0) {
                // Fetch actual submitted values for assigned KPIs
                const queryAssignedKpis = {
                    query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@kpiIds, c.id, true)`,
                    parameters: [{ name: "@kpiIds", value: assignedKpiIds }]
                };
                const { resources: submittedAssignedKpis } = await submissionsContainer.items.query(queryAssignedKpis).fetchAll();

                // Merge with master definitions to ensure all metadata is present
                kpisToReturn = assignedKpiIds.map(kpiId => {
                    const masterKpi = masterKPIsData.find(m => m.id === kpiId);
                    const submittedKpi = submittedAssignedKpis.find(s => s.id === kpiId);
                    return masterKpi ? { ...masterKpi, currentValue: submittedKpi ? submittedKpi.currentValue : 0 } : null;
                }).filter(kpi => kpi !== null); // Remove any nulls if an assigned KPI_ID doesn't exist in master
            } else {
                 context.log(`No KPIs assigned to Udyam Mitra ${decodedToken.uid} for ${currentMonthYear}. Returning empty list.`);
                 // If explicitly no assignments (and not falling back to common), return empty
                 kpisToReturn = [];
            }
        } else {
             // Handle case where udyamMitra tries to request someone else's data (not allowed)
             // or other unauthorized access attempts for non-admin roles
            context.res = { status: 403, body: "Forbidden: You are not authorized to view these KPIs." };
            return;
        }

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(kpisToReturn)
        };

    } catch (error) {
        context.log.error('Error fetching KPIs from Cosmos DB:', error);
        context.res = {
            status: 500,
            body: `Error processing KPI request: ${error.message}`
        };
    }
};
