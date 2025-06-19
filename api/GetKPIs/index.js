// GetKPIs/index.js
const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
    context.log('HTTP trigger function processed a request for GetKPIs.');

    // Ensure these environment variables are set in local.settings.json and Azure Function App settings
    const cosmosDbConnection = process.env.CosmosDbConnection;
    const databaseId = 'KpiDb'; // Ensure this matches your Cosmos DB database ID
    const containerId = 'KPISubmissions'; // Ensure this matches your Cosmos DB container ID

    if (!cosmosDbConnection) {
        context.log.error("CosmosDbConnection environment variable not set.");
        context.res = {
            status: 500,
            body: "Cosmos DB connection string is missing from environment variables."
        };
        return;
    }

    const endpoint = cosmosDbConnection.split('AccountEndpoint=')[1].split(';')[0];
    const key = cosmosDbConnection.split('AccountKey=')[1].split(';')[0];

    const client = new CosmosClient({ endpoint, key });
    const database = client.database(databaseId);
    const container = database.container(containerId);

    // Mock KPI data (same as in your React frontend for consistency)
    // This will be returned if no data is found in Cosmos DB or if there's an error.
    const mockKPIs = [
        { id: 'common1', kpiName: "Enterprise Interactions (Field Visits)", description: "No. of MSMEs, SHGs, informal enterprises met (field grievances)", monthlyTarget: 10, currentValue: 0, reportingFormat: "Field Visit Report with geo-tagged photos", category: "common" },
        { id: 'common2', kpiName: "Beneficiary Grievances Resolved", description: "Grievances addressed for field enterprises", monthlyTarget: 10, currentValue: 0, reportingFormat: "Google Sheet", category: "common" },
        { id: 'common3', kpiName: "Baseline Surveys or Field Assessments", description: "Surveys conducted for ground mapping", monthlyTarget: 4, currentValue: 0, reportingFormat: "Google Sheet", category: "common" },
        { id: 'common4', kpiName: "Scheme Applications Facilitated", description: "Applications in PMFME, PMEGP, UDYAM, E-Shram, etc.", monthlyTarget: 10, currentValue: 0, reportingFormat: "Application copies/Screenshot of status", category: "common" },
        { id: 'common5', kpiName: "Follow-ups on Scheme Applications", description: "Tracking and facilitating pending cases", monthlyTarget: 5, currentValue: 0, reportingFormat: "Tracking Sheet with outcome status", category: "common" },
        { id: 'common6', kpiName: "Workshops / EDP Organized", description: "Mobilization, awareness events", monthlyTarget: 2, currentValue: 0, reportingFormat: "Attendance sheets, photos, videos", category: "common" },
        { id: 'common7', kpiName: "Financial Literacy or Formalization Support", description: "1-to-1 guidance on PAN, GST, Udyam, New Industrial Policy, etc.", monthlyTarget: 10, currentValue: 0, reportingFormat: "Documentation list, Google Sheet", category: "common" },
        { id: 'common8', kpiName: "New Enterprise Cases Identified", description: "New informal businesses identified and profiled", monthlyTarget: 5, currentValue: 0, reportingFormat: "Enterprise profiling Google Sheet", category: "common" },
        { id: 'common9', kpiName: "Credit Linkage Facilitation", description: "Referrals to banks, NBFCs", monthlyTarget: 5, currentValue: 0, reportingFormat: "Bank interaction/follow-up record/ google sheet", category: "common" },
        { id: 'common10', kpiName: "Portal/MIS Updates & Data Entry", description: "Timely data updates in MIS/Google Sheets", monthlyTarget: 100, currentValue: 0, reportingFormat: "MIS Portal/Google Sheet", category: "common" },
        { id: 'common11', kpiName: "Convergence & Departmental Coordination", description: "Meetings with DICs, RD, Agri/Horti, etc.", monthlyTarget: 2, currentValue: 0, reportingFormat: "Meeting MoM or signed attendance list", category: "common" },
        { id: 'common12', kpiName: "Support to EDPs, RAMP, and Field Activities", description: "Participation in Enterprise Development Programs or RAMP", monthlyTarget: 'As per deployment', currentValue: 'Met', reportingFormat: "Program report signed by supervisor", category: "common" },
        { id: 'common13', kpiName: "Case Studies / Beneficiary Success Stories", description: "Documenting success stories from the field", monthlyTarget: 1, currentValue: 0, reportingFormat: "Minimum 500 words + image/video", category: "common" },
        { id: 'common14', kpiName: "Pollution/Pollutant Check", description: "Visit to Industrial Estate, and do proper reading of machine for pollution/pollutant", monthlyTarget: 2, currentValue: 0, reportingFormat: "Google sheet with geo tagged photos", category: "common" },
        { id: 'eco1', kpiName: "Loan Applications Supported", monthlyTarget: 5, currentValue: 0, reportingFormat: "Google Sheet", category: "ecosystem" },
        { id: 'eco2', kpiName: "Business Model/Plan Guidance Provided", monthlyTarget: 5, currentValue: 0, reportingFormat: "Google Sheet", category: "ecosystem" },
        { id: 'eco3', kpiName: "Artisans/Entrepreneurs Linked to Schemes", monthlyTarget: 10, currentValue: 0, reportingFormat: "Google Sheet", category: "ecosystem" },
        { id: 'eco4', kpiName: "Financial Literacy Sessions (Group) Conducted", monthlyTarget: 5, currentValue: 0, reportingFormat: "Photos/Videos/Google Sheet", category: "ecosystem" },
        { id: 'eco5', kpiName: "New Initiatives in Entrepreneurship Promotion", monthlyTarget: 1, currentValue: 0, reportingFormat: "Report/Google Sheet", category: "ecosystem" },
        { id: 'eco6', kpiName: "Enterprise/Business Ideas Scouted", monthlyTarget: 1, currentValue: 0, reportingFormat: "Report/Google Sheet", category: "ecosystem" },
        { id: 'hosp1', kpiName: "Tourism Potential Sites Documented or Supported", monthlyTarget: 2, currentValue: 0, reportingFormat: "Photos/Videos/Google Sheet", category: "hospitality" },
        { id: 'hosp2', kpiName: "Tourism Promotion Events / Community Engagements", monthlyTarget: 4, currentValue: 0, reportingFormat: "Photos/Videos/Google Sheet", category: "hospitality" },
        { id: 'hosp3', kpiName: "Homestays/Tour Operators Onboarded/Assisted", monthlyTarget: 5, currentValue: 0, reportingFormat: "Google Sheet", category: "hospitality" },
        { id: 'hosp4', kpiName: "Local Youth/SHGs Trained in Tourism/Hospitality Services", monthlyTarget: 10, currentValue: 0, reportingFormat: "Google Sheet", category: "hospitality" },
        { id: 'agri1', kpiName: "Agri/Forest-Based Enterprises Supported", monthlyTarget: 5, currentValue: 0, reportingFormat: "Google Sheet", category: "agriForest" },
        { id: 'agri2', kpiName: "SHGs Linked to Agri/Animal Husbandry/Processing Units", monthlyTarget: 3, currentValue: 0, reportingFormat: "Google Sheet", category: "agriForest" },
        { id: 'dbms1', kpiName: "Portal/MIS Data Entry & Monitoring", monthlyTarget: 100, currentValue: 0, reportingFormat: "Google Sheet, MIS Portal", category: "dbmsMIS" },
        { id: 'dbms2', kpiName: "Data Validation, Error Rectification, and Reporting", monthlyTarget: 'Monthly Review', currentValue: 'Completed', reportingFormat: "Issue logs, rectification reports via email", category: "dbmsMIS" },
        { id: 'dbms3', kpiName: "Collaboration with Line Departments and Portal Developers", monthlyTarget: 'Continuous', currentValue: 'Ongoing', reportingFormat: "Meeting Notes, Email Records", category: "dbmsMIS" },
    ];


    try {
        const { resources: items } = await container.items.query('SELECT * FROM c').fetchAll();

        if (items.length === 0) {
            context.log("No existing KPI data found in Cosmos DB. Returning mock data as initial set.");
            context.res = {
                status: 200,
                body: mockKPIs
            };
        } else {
            context.res = {
                status: 200,
                body: items
            };
        }

    } catch (error) {
        context.log.error('Error fetching KPIs from Cosmos DB:', error);
        context.res = {
            status: 500,
            body: mockKPIs
        };
    }
};
