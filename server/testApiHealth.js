const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const { checkApiHealth, getJudge0ApiUrl } = require("./utils/judge0Client");

async function main() {
    console.log("==================================================");
    console.log("🔍 TESTING CODE EXECUTION API HEALTH & AUTHENTICATION");
    console.log("==================================================");

    const apiUrl = getJudge0ApiUrl();
    const key = (process.env.JUDGE0_API_KEY || "").trim().replace(/^["']|["']$/g, "");

    console.log(`Endpoint: ${apiUrl || "(none configured)"}`);
    console.log(`API Key Configured: ${Boolean(key)} (length: ${key.length})`);

    if (!apiUrl) {
        console.error("❌ Error: JUDGE0_API_URL is missing in server/.env");
        process.exit(1);
    }

    if (!key) {
        console.error("❌ Error: JUDGE0_API_KEY is missing or empty in server/.env");
        process.exit(1);
    }

    console.log("Sending minimal execution request...");
    const result = await checkApiHealth();

    console.log(`Status Code: ${result.status}`);
    console.log(`Result Message: ${result.message}`);
    if (result.stdout) {
        console.log(`Execution Output: ${JSON.stringify(result.stdout)}`);
    }

    if (result.ok) {
        console.log("✅ Success: Code execution API is authenticated and operational!");
        process.exit(0);
    } else {
        console.error("❌ Health check failed.");
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Unexpected error:", err.message);
    process.exit(1);
});
