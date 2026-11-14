const assert = require("assert");
const CodingInterview = require("./models/CodingInterview");
const {
    updateProctoringEvents,
    completeCodingInterview,
} = require("./controllers/codingInterviewController");

async function runTests() {
    console.log("==================================================");
    console.log("🛡️ RUNNING CODING INTERVIEW PROCTORING & ANTI-CHEATING TESTS");
    console.log("==================================================");

    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Error: ${err.message}`);
            failed++;
        }
    };

    // 1. Schema definition verification
    console.log("\n[1] Testing CodingInterview Model Schema...");

    await test("CodingInterview schema includes all proctoring fields with correct defaults", () => {
        const schema = CodingInterview.schema.paths;

        assert.ok(schema.tabSwitchCount, "tabSwitchCount field missing");
        assert.strictEqual(schema.tabSwitchCount.defaultValue, 0);

        assert.ok(schema.noFaceDetectedCount, "noFaceDetectedCount field missing");
        assert.strictEqual(schema.noFaceDetectedCount.defaultValue, 0);

        assert.ok(schema.multipleFaceDetectedCount, "multipleFaceDetectedCount field missing");
        assert.strictEqual(schema.multipleFaceDetectedCount.defaultValue, 0);

        assert.ok(schema.copyAttemptCount, "copyAttemptCount field missing");
        assert.strictEqual(schema.copyAttemptCount.defaultValue, 0);

        assert.ok(schema.pasteAttemptCount, "pasteAttemptCount field missing");
        assert.strictEqual(schema.pasteAttemptCount.defaultValue, 0);

        assert.ok(schema.cutAttemptCount, "cutAttemptCount field missing");
        assert.strictEqual(schema.cutAttemptCount.defaultValue, 0);

        assert.ok(schema.dragDropAttemptCount, "dragDropAttemptCount field missing");
        assert.strictEqual(schema.dragDropAttemptCount.defaultValue, 0);

        assert.ok(schema.fullscreenExitCount, "fullscreenExitCount field missing");
        assert.strictEqual(schema.fullscreenExitCount.defaultValue, 0);

        assert.ok(schema.proctoringEnabled, "proctoringEnabled field missing");
        assert.strictEqual(schema.proctoringEnabled.defaultValue, true);

        assert.ok(schema.proctoringEvents, "proctoringEvents field missing");
    });

    // 2. Controller testing with mocked Mongoose findOne
    console.log("\n[2] Testing updateProctoringEvents Controller Logic...");

    const originalFindOne = CodingInterview.findOne;

    try {
        await test("Returns 404 if coding interview is not found or user is not owner", async () => {
            CodingInterview.findOne = async () => null;

            let responseStatus = null;
            let responseBody = null;

            const req = {
                params: { id: "test-id" },
                user: { _id: "user-123" },
                body: { tabSwitchCount: 1 },
            };
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return {
                        json: (data) => {
                            responseBody = data;
                        },
                    };
                },
            };

            await updateProctoringEvents(req, res);
            assert.strictEqual(responseStatus, 404);
            assert.strictEqual(responseBody.success, false);
        });

        await test("Updates counters monotonically and appends sanitized events", async () => {
            const mockDoc = {
                tabSwitchCount: 2,
                pasteAttemptCount: 0,
                copyAttemptCount: 1,
                cutAttemptCount: 0,
                dragDropAttemptCount: 0,
                noFaceDetectedCount: 1,
                multipleFaceDetectedCount: 0,
                fullscreenExitCount: 0,
                proctoringEvents: [],
                save: async function () {
                    return this;
                },
            };

            CodingInterview.findOne = async () => mockDoc;

            let responseStatus = null;
            let responseBody = null;

            const req = {
                params: { id: "test-id" },
                user: { _id: "user-123" },
                body: {
                    tabSwitchCount: 5, // Should update to 5
                    pasteAttemptCount: 3, // Should update to 3
                    copyAttemptCount: 0, // Should NOT decrease from 1
                    events: [
                        {
                            eventType: "paste_attempt",
                            message: "Copy-pasting is not allowed during this coding interview.",
                            details: "Attempted to paste 45 characters",
                        },
                        {
                            eventType: "tab_switch",
                            message: "Candidate switched tab",
                        },
                    ],
                },
            };
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return {
                        json: (data) => {
                            responseBody = data;
                        },
                    };
                },
            };

            await updateProctoringEvents(req, res);
            assert.strictEqual(responseStatus, 200);
            assert.strictEqual(responseBody.success, true);
            assert.strictEqual(mockDoc.tabSwitchCount, 5);
            assert.strictEqual(mockDoc.pasteAttemptCount, 3);
            assert.strictEqual(mockDoc.copyAttemptCount, 1); // Preserved monotonic invariant
            assert.strictEqual(mockDoc.proctoringEvents.length, 2);
            assert.strictEqual(mockDoc.proctoringEvents[0].eventType, "paste_attempt");
        });

        await test("completeCodingInterview marks document completed", async () => {
            const mockDoc = {
                completed: false,
                save: async function () {
                    return this;
                },
            };

            CodingInterview.findOne = async () => mockDoc;

            let responseStatus = null;
            let responseBody = null;

            const req = {
                params: { id: "test-id" },
                user: { _id: "user-123" },
            };
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return {
                        json: (data) => {
                            responseBody = data;
                        },
                    };
                },
            };

            await completeCodingInterview(req, res);
            assert.strictEqual(responseStatus, 200);
            assert.strictEqual(responseBody.success, true);
            assert.strictEqual(mockDoc.completed, true);
        });

    } finally {
        CodingInterview.findOne = originalFindOne;
    }

    console.log("\n==================================================");
    console.log(`📊 PROCTORING TEST RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log("==================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error("Unhandled test suite error:", err);
    process.exit(1);
});
