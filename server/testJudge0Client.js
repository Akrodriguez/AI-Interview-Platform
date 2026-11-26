const http = require("http");
const assert = require("assert");

const {
    STANDARD_LANGUAGE_IDS,
    ONLINECOMPILER_LANGUAGE_IDS,
    LANGUAGE_IDS,
    isOnlineCompilerUrl,
    resolveLanguageId,
    getJudge0ApiUrl,
    buildHeaders,
    normalizeExecutionResult,
    executeCode,
    checkApiHealth,
} = require("./utils/judge0Client");

async function runTests() {
    console.log("==================================================");
    console.log("🧪 RUNNING CODE EXECUTION API (JUDGE0 / ONLINECOMPILER.IO) TESTS");
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

    // -------------------------------------------------------------------------
    // 1. Language ID Mapping (Standard Judge0 vs OnlineCompiler.io)
    // -------------------------------------------------------------------------
    console.log("\n[1] Testing Language ID Resolution...");

    await test("Resolves Standard Judge0 CE language IDs (Default/Self-hosted)", () => {
        assert.strictEqual(resolveLanguageId("python", "http://localhost:3308"), 71);
        assert.strictEqual(resolveLanguageId("javascript", "http://localhost:3308"), 63);
        assert.strictEqual(resolveLanguageId("cpp", "http://localhost:3308"), 54);
        assert.strictEqual(resolveLanguageId("c++", "http://localhost:3308"), 54);
    });

    await test("Resolves OnlineCompiler.io hosted language IDs", () => {
        const ocUrl = "https://api.onlinecompiler.io/api/judge0";
        assert.strictEqual(resolveLanguageId("python", ocUrl), 113);
        assert.strictEqual(resolveLanguageId("javascript", ocUrl), 102);
        assert.strictEqual(resolveLanguageId("cpp", ocUrl), 105);
        assert.strictEqual(resolveLanguageId("c++", ocUrl), 105);
    });

    await test("Returns null for unsupported languages or invalid input", () => {
        assert.strictEqual(resolveLanguageId("ruby"), null);
        assert.strictEqual(resolveLanguageId("rust"), null);
        assert.strictEqual(resolveLanguageId(""), null);
        assert.strictEqual(resolveLanguageId(null), null);
        assert.strictEqual(resolveLanguageId(undefined), null);
    });

    // -------------------------------------------------------------------------
    // 2. URL Normalization
    // -------------------------------------------------------------------------
    console.log("\n[2] Testing URL Normalization...");

    await test("Strips trailing slashes from API URL", () => {
        assert.strictEqual(getJudge0ApiUrl("https://api.onlinecompiler.io/api/judge0/"), "https://api.onlinecompiler.io/api/judge0");
        assert.strictEqual(getJudge0ApiUrl("http://localhost:3308///"), "http://localhost:3308");
    });

    await test("Falls back to JUDGE0_API_URL or JUDGE0_BASE_URL env var", () => {
        const oldApi = process.env.JUDGE0_API_URL;
        const oldBase = process.env.JUDGE0_BASE_URL;

        process.env.JUDGE0_API_URL = "https://api.onlinecompiler.io/api/judge0/";
        delete process.env.JUDGE0_BASE_URL;
        assert.strictEqual(getJudge0ApiUrl(), "https://api.onlinecompiler.io/api/judge0");

        delete process.env.JUDGE0_API_URL;
        process.env.JUDGE0_BASE_URL = "http://127.0.0.1:3308/";
        assert.strictEqual(getJudge0ApiUrl(), "http://127.0.0.1:3308");

        process.env.JUDGE0_API_URL = oldApi;
        process.env.JUDGE0_BASE_URL = oldBase;
    });

    // -------------------------------------------------------------------------
    // 3. Header Construction
    // -------------------------------------------------------------------------
    console.log("\n[3] Testing Header Construction...");

    await test("Builds standard headers without API key", () => {
        const headers = buildHeaders("https://api.onlinecompiler.io/api/judge0", "");
        assert.strictEqual(headers["Content-Type"], "application/json");
        assert.strictEqual(headers["Accept"], "application/json");
        assert.strictEqual(headers["X-Auth-Token"], undefined);
    });

    await test("Attaches Authorization and X-Auth-Token headers without Bearer prefix when API key is provided", () => {
        const headers = buildHeaders("https://api.onlinecompiler.io/api/judge0", "oc-key-123");
        assert.strictEqual(headers["X-Auth-Token"], "oc-key-123");
        assert.strictEqual(headers["Authorization"], "oc-key-123");
    });

    await test("Automatically populates X-RapidAPI-Host for RapidAPI domains", () => {
        const headers = buildHeaders("https://judge0-ce.p.rapidapi.com", "rapid-key-456");
        assert.strictEqual(headers["X-RapidAPI-Host"], "judge0-ce.p.rapidapi.com");
        assert.strictEqual(headers["X-RapidAPI-Key"], "rapid-key-456");
    });

    // -------------------------------------------------------------------------
    // 4. Result Normalization
    // -------------------------------------------------------------------------
    console.log("\n[4] Testing Result Normalization...");

    await test("Normalizes standard Accepted output", () => {
        const raw = {
            stdout: "Hello World\n",
            stderr: null,
            compile_output: null,
            time: "0.045",
            memory: 3128,
            token: "tok-1",
            status: { id: 3, description: "Accepted" },
        };
        const res = normalizeExecutionResult(raw);
        assert.strictEqual(res.stdout, "Hello World\n");
        assert.strictEqual(res.stderr, "");
        assert.strictEqual(res.compileOutput, "");
        assert.strictEqual(res.execStatus, "Accepted");
        assert.strictEqual(res.statusId, 3);
        assert.strictEqual(res.execTime, "0.045");
        assert.strictEqual(res.memoryUsed, 3128);
    });

    await test("Normalizes Compilation Error output", () => {
        const raw = {
            stdout: null,
            stderr: null,
            compile_output: "error: expected ';' before '}' token",
            time: null,
            memory: null,
            status: { id: 6, description: "Compilation Error" },
        };
        const res = normalizeExecutionResult(raw);
        assert.strictEqual(res.stdout, "");
        assert.strictEqual(res.compileOutput, "error: expected ';' before '}' token");
        assert.strictEqual(res.execStatus, "Compilation Error");
        assert.strictEqual(res.statusId, 6);
    });

    await test("Handles empty or null output safely", () => {
        const res = normalizeExecutionResult(null);
        assert.strictEqual(res.stdout, "");
        assert.strictEqual(res.execStatus, "Unknown");
        assert.strictEqual(res.statusId, null);
    });

    // -------------------------------------------------------------------------
    // 5. Mock HTTP Server Tests for Specific Required Scenarios
    // -------------------------------------------------------------------------
    console.log("\n[5] Testing Execution Scenarios with Mock Code Execution Server...");

    let mockHandler = () => {};
    const mockServer = http.createServer((req, res) => {
        mockHandler(req, res);
    });

    await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
    const mockPort = mockServer.address().port;
    const mockBaseUrl = `http://127.0.0.1:${mockPort}`;

    try {
        // 1. Python Hello World
        await test("1. Executes Python Hello World successfully", async () => {
            mockHandler = (req, res) => {
                if (req.method === "POST" && req.url.includes("/submissions")) {
                    let body = "";
                    req.on("data", (c) => (body += c));
                    req.on("end", () => {
                        const parsed = JSON.parse(body);
                        assert.strictEqual(parsed.source_code, "print('Hello, Python!')");
                        assert.strictEqual(parsed.language_id, 71);
                        res.writeHead(201, { "Content-Type": "application/json" });
                        res.end(
                            JSON.stringify({
                                stdout: "Hello, Python!\n",
                                stderr: null,
                                compile_output: null,
                                status: { id: 3, description: "Accepted" },
                                time: "0.02",
                                memory: 3100,
                            })
                        );
                    });
                }
            };

            const result = await executeCode({
                language: "python",
                sourceCode: "print('Hello, Python!')",
                apiUrl: mockBaseUrl,
            });

            assert.strictEqual(result.stdout, "Hello, Python!\n");
            assert.strictEqual(result.statusId, 3);
            assert.strictEqual(result.execStatus, "Accepted");
        });

        // 2. JavaScript Hello World
        await test("2. Executes JavaScript Hello World successfully", async () => {
            mockHandler = (req, res) => {
                if (req.method === "POST" && req.url.includes("/submissions")) {
                    let body = "";
                    req.on("data", (c) => (body += c));
                    req.on("end", () => {
                        const parsed = JSON.parse(body);
                        assert.strictEqual(parsed.source_code, "console.log('Hello, JavaScript!');");
                        assert.strictEqual(parsed.language_id, 63);
                        res.writeHead(201, { "Content-Type": "application/json" });
                        res.end(
                            JSON.stringify({
                                stdout: "Hello, JavaScript!\n",
                                stderr: null,
                                compile_output: null,
                                status: { id: 3, description: "Accepted" },
                                time: "0.04",
                                memory: 3400,
                            })
                        );
                    });
                }
            };

            const result = await executeCode({
                language: "javascript",
                sourceCode: "console.log('Hello, JavaScript!');",
                apiUrl: mockBaseUrl,
            });

            assert.strictEqual(result.stdout, "Hello, JavaScript!\n");
            assert.strictEqual(result.statusId, 3);
        });

        // 3. C++ Hello World
        await test("3. Executes C++ Hello World successfully", async () => {
            mockHandler = (req, res) => {
                if (req.method === "POST" && req.url.includes("/submissions")) {
                    let body = "";
                    req.on("data", (c) => (body += c));
                    req.on("end", () => {
                        const parsed = JSON.parse(body);
                        assert.strictEqual(parsed.language_id, 54);
                        res.writeHead(201, { "Content-Type": "application/json" });
                        res.end(
                            JSON.stringify({
                                stdout: "Hello, C++!\n",
                                stderr: null,
                                compile_output: null,
                                status: { id: 3, description: "Accepted" },
                                time: "0.01",
                                memory: 2800,
                            })
                        );
                    });
                }
            };

            const result = await executeCode({
                language: "cpp",
                sourceCode: '#include <iostream>\nint main(){ std::cout << "Hello, C++!\\n"; }',
                apiUrl: mockBaseUrl,
            });

            assert.strictEqual(result.stdout, "Hello, C++!\n");
            assert.strictEqual(result.statusId, 3);
        });

        // 4. Standard Input Handling (stdin)
        await test("4. Handles standard input (stdin) correctly", async () => {
            mockHandler = (req, res) => {
                let body = "";
                req.on("data", (c) => (body += c));
                req.on("end", () => {
                    const parsed = JSON.parse(body);
                    assert.strictEqual(parsed.stdin, "Alice\nBob");
                    res.writeHead(201, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            stdout: "Welcome Alice\nWelcome Bob\n",
                            status: { id: 3, description: "Accepted" },
                        })
                    );
                });
            };

            const result = await executeCode({
                language: "python",
                sourceCode: "import sys\nfor line in sys.stdin: print(f'Welcome {line.strip()}')",
                stdin: "Alice\nBob",
                apiUrl: mockBaseUrl,
            });

            assert.strictEqual(result.stdout, "Welcome Alice\nWelcome Bob\n");
            assert.strictEqual(result.statusId, 3);
        });

        // 5. Compilation Errors
        await test("5. Captures and returns compilation errors clearly", async () => {
            mockHandler = (req, res) => {
                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        stdout: null,
                        stderr: null,
                        compile_output: "main.cpp:2:5: error: 'cout' was not declared in this scope",
                        status: { id: 6, description: "Compilation Error" },
                    })
                );
            };

            const result = await executeCode({
                language: "cpp",
                sourceCode: "int main() { cout << 1; }",
                apiUrl: mockBaseUrl,
            });

            assert.strictEqual(result.statusId, 6);
            assert.strictEqual(result.execStatus, "Compilation Error");
            assert.ok(result.compileOutput.includes("error: 'cout' was not declared"));
        });

        // 6. Runtime Errors (NZEC / Exception)
        await test("6. Captures and returns runtime errors (stderr) clearly", async () => {
            mockHandler = (req, res) => {
                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        stdout: null,
                        stderr: "ZeroDivisionError: division by zero",
                        status: { id: 11, description: "Runtime Error (NZEC)" },
                    })
                );
            };

            const result = await executeCode({
                language: "python",
                sourceCode: "x = 1 / 0",
                apiUrl: mockBaseUrl,
            });

            assert.strictEqual(result.statusId, 11);
            assert.ok(result.stderr.includes("ZeroDivisionError"));
        });

        // 7. Infinite-loop / Timeout handling
        await test("7. Handles execution timeout (Time Limit Exceeded / client abort)", async () => {
            mockHandler = (req, res) => {
                // Returns status 5 (TLE from sandbox)
                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        status: { id: 5, description: "Time Limit Exceeded" },
                        time: "5.00",
                    })
                );
            };

            const result = await executeCode({
                language: "python",
                sourceCode: "while True: pass",
                apiUrl: mockBaseUrl,
            });

            assert.strictEqual(result.statusId, 5);
            assert.strictEqual(result.execStatus, "Time Limit Exceeded");
        });

        await test("7b. Handles client timeout when provider polling exceeds timeout limit", async () => {
            mockHandler = (req, res) => {
                if (req.method === "POST") {
                    res.writeHead(201, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ token: "infinite-loop-tok", status: { id: 2 } }));
                } else {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ status: { id: 2, description: "Processing" } }));
                }
            };

            await assert.rejects(
                () =>
                    executeCode({
                        language: "python",
                        sourceCode: "while True: pass",
                        apiUrl: mockBaseUrl,
                        timeoutMs: 150,
                        pollIntervalMs: 50,
                    }),
                /timed out after 150ms/
            );
        });

        // 8. Invalid API Credentials
        await test("8. Handles invalid or missing API credentials cleanly", async () => {
            mockHandler = (req, res) => {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Missing or invalid Authorization header" }));
            };

            await assert.rejects(
                () => executeCode({ language: "python", sourceCode: "print(1)", apiUrl: mockBaseUrl, apiKey: "bad-key" }),
                /Invalid or missing API key/
            );
        });

        // 9. Provider Rate-Limit Handling (HTTP 429)
        await test("9. Handles provider rate limits (HTTP 429) cleanly", async () => {
            mockHandler = (req, res) => {
                res.writeHead(429, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Rate limit exceeded (30 reqs/min). Please wait." }));
            };

            await assert.rejects(
                () => executeCode({ language: "python", sourceCode: "print(1)", apiUrl: mockBaseUrl }),
                /Execution rate limit reached/
            );
        });

        // 10. Asynchronous queued execution with polling
        await test("10. Supports asynchronous submission and polling until finished", async () => {
            let polls = 0;
            mockHandler = (req, res) => {
                if (req.method === "POST") {
                    res.writeHead(201, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ token: "queue-tok", status: { id: 1 } }));
                } else if (req.method === "GET") {
                    polls++;
                    res.writeHead(200, { "Content-Type": "application/json" });
                    if (polls === 1) {
                        res.end(JSON.stringify({ status: { id: 2, description: "Processing" } }));
                    } else {
                        res.end(JSON.stringify({ stdout: "Done\n", status: { id: 3, description: "Accepted" } }));
                    }
                }
            };

            const result = await executeCode({
                language: "python",
                sourceCode: "print('Done')",
                apiUrl: mockBaseUrl,
                pollIntervalMs: 40,
            });

            assert.strictEqual(result.stdout, "Done\n");
            assert.strictEqual(result.statusId, 3);
            assert.strictEqual(polls, 2);
        });

        // 11. checkApiHealth helper
        await test("11. checkApiHealth returns ok=true when endpoint responds with 200/201", async () => {
            mockHandler = (req, res) => {
                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ stdout: "health_check_ok\n", status: { id: 3 } }));
            };

            const health = await checkApiHealth(mockBaseUrl, "dummy-key");
            assert.strictEqual(health.ok, true);
            assert.strictEqual(health.status, 201);
            assert.strictEqual(health.stdout, "health_check_ok\n");
        });

        await test("11b. checkApiHealth reports failure when endpoint responds with error", async () => {
            mockHandler = (req, res) => {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid or inactive API key" }));
            };

            const health = await checkApiHealth(mockBaseUrl, "dummy-key");
            assert.strictEqual(health.ok, false);
            assert.strictEqual(health.status, 403);
            assert.ok(health.message.includes("Invalid or inactive API key"));
        });

    } finally {
        await new Promise((resolve) => mockServer.close(resolve));
    }

    console.log("\n==================================================");
    console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log("==================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error("Unhandled test suite error:", err);
    process.exit(1);
});
