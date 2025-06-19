const { app } = require('@azure/functions');
const admin = require('firebase-admin');
const { CosmosClient } = require('@azure/cosmos');

// Initialize Firebase Admin SDK (ensure this is done once)
// Use the FIREBASE_ADMIN_SDK_CONFIG environment variable
// which should contain your Firebase service account key JSON.
// Example: process.env.FIREBASE_ADMIN_SDK_CONFIG = '{ "type": "service_account", ... }'
try {
    if (!admin.apps.length) {
        const serviceAccountConfig = JSON.parse(process.env.FIREBASE_ADMIN_SDK_CONFIG);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountConfig),
            // You might need to add a databaseURL or storageBucket if using other Firebase services
            // databaseURL: "https://<YOUR_PROJECT_ID>.firebaseio.com"
        });
    }
} catch (error) {
    console.error("Firebase Admin SDK initialization failed:", error);
    // Depending on your deployment, you might want to throw an error or handle it differently
    // For local development, ensure FIREBASE_ADMIN_SDK_CONFIG is correctly set
}

// Cosmos DB Client setup
const cosmosDbConnection = process.env.CosmosDbConnection;
const databaseId = "KpiDb"; // Your database ID
const containerId = "KPISubmissions"; // Your container ID for KPIs

// Ensure CosmosDbConnection is set
if (!cosmosDbConnection) {
    console.error("CosmosDbConnection environment variable is not set.");
    // In a production environment, you might want to return an error immediately
}

const client = new CosmosClient(cosmosDbConnection);
const database = client.database(databaseId);
const container = database.container(containerId);


app.http('GetKPIs', {
    methods: ['GET'],
    authLevel: 'anonymous', // Authentication handled in code
    handler: async (request, context) => {
        context.log('HTTP trigger function processed a request: GetKPIs.');

        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            context.log('No authorization header or invalid format.');
            return {
                status: 401,
                body: 'Unauthorized: No token provided or invalid format.'
            };
        }

        const idToken = authHeader.split('Bearer ')[1];

        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            context.log('Firebase ID token successfully verified.');

            const uid = decodedToken.uid;
            // You can optionally check for custom claims here if you have them, e.g., for roles
            // const userRole = decodedToken.role;

            // Fetch KPIs from Cosmos DB
            const querySpec = {
                query: "SELECT * FROM c WHERE c.userId = @userId", // Assuming KPIs are tied to a userId
                parameters: [
                    { name: "@userId", value: uid }
                ]
            };

            const { resources: kpis } = await container.items
                .query(querySpec)
                .fetchAll();

            context.log(`Found ${kpis.length} KPIs for user ${uid}.`);

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(kpis)
            };

        } catch (error) {
            context.error('Error verifying Firebase ID token or fetching KPIs:', error);
            if (error.code === 'auth/id-token-expired') {
                return { status: 401, body: 'Unauthorized: Token expired.' };
            }
            return {
                status: 403, // Forbidden for invalid token or other issues
                body: `Forbidden: Invalid token or backend error. Details: ${error.message}`
            };
        }
    }
});