const http = require("http");
const assert = require("assert");

// Load the AI service functions
const {
    generateContent,
    generateOllamaContent,
    getOllamaUrl,
    extractOllamaText,
    cleanAndValidateJsonText,
    isFallbackEligibleGeminiError,
} = require("./Services/aiService");
const parseGeminiResponse = require("./utils/parseGeminiResponse");

async function runTests() {
    console.log("==================================================");
    console.log("🤖 RUNNING AI SERVICE & OLLAMA INTEGRATION TESTS");
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

    // 1. URL Normalization
    console.log("\n[1] Testing Ollama URL Normalization...");
    await test("Appends /api/generate to basic host", () => {
        assert.strictEqual(getOllamaUrl("http://localhost:11434"), "http://localhost:11434/api/generate");
    });
    await test("Strips trailing slash and appends /api/generate", () => {
        assert.strictEqual(getOllamaUrl("http://localhost:11434/"), "http://localhost:11434/api/generate");
    });
    await test("Handles base URL ending in /api", () => {
        assert.strictEqual(getOllamaUrl("http://127.0.0.1:11434/api"), "http://127.0.0.1:11434/api/generate");
    });
    await test("Preserves direct /api/generate URL", () => {
        assert.strictEqual(getOllamaUrl("http://localhost:11434/api/generate"), "http://localhost:11434/api/generate");
    });
    await test("Preserves ngrok public tunnel URL", () => {
        assert.strictEqual(
            getOllamaUrl("https://abc-123.ngrok-free.app"),
            "https://abc-123.ngrok-free.app/api/generate"
        );
    });

    // 2. Response Extraction and JSON Cleaning
    console.log("\n[2] Testing Response Extraction & JSON Cleaning...");
    await test("Extracts response text from standard /api/generate payload", () => {
        const text = extractOllamaText({ response: "[\"Question 1\"]" });
        assert.strictEqual(text, "[\"Question 1\"]");
    });
    await test("Extracts response text from /api/chat payload", () => {
        const text = extractOllamaText({ message: { role: "assistant", content: "[\"Question 1\"]" } });
        assert.strictEqual(text, "[\"Question 1\"]");
    });
    await test("Cleans pure JSON array string", () => {
        const cleaned = cleanAndValidateJsonText("[\"Q1\", \"Q2\"]");
        assert.strictEqual(cleaned, "[\"Q1\", \"Q2\"]");
    });
    await test("Strips markdown code fences", () => {
        const raw = "```json\n[\"Q1\", \"Q2\"]\n```";
        const cleaned = cleanAndValidateJsonText(raw);
        assert.deepStrictEqual(JSON.parse(cleaned), ["Q1", "Q2"]);
    });
    await test("Extracts JSON array when wrapped in conversational preamble and postscript", () => {
        const raw = "Here are the questions you requested:\n[\"Q1\", \"Q2\"]\nHope this helps!";
        const cleaned = cleanAndValidateJsonText(raw);
        assert.deepStrictEqual(JSON.parse(cleaned), ["Q1", "Q2"]);
    });
    await test("Extracts JSON object when wrapped in conversational preamble and postscript", () => {
        const raw = "Evaluation result:\n{\n  \"score\": 8,\n  \"feedback\": \"Good\"\n}\nThank you.";
        const cleaned = cleanAndValidateJsonText(raw);
        assert.strictEqual(JSON.parse(cleaned).score, 8);
    });
    await test("Rejects non-JSON invalid response", () => {
        const raw = "I am an AI and I cannot generate interview questions for this role.";
        const cleaned = cleanAndValidateJsonText(raw);
        assert.strictEqual(cleaned, null);
    });

    // 3. parseGeminiResponse Backward Compatibility & Resilience
    console.log("\n[3] Testing parseGeminiResponse Compatibility...");
    await test("parseGeminiResponse parses clean JSON", () => {
        const res = parseGeminiResponse("[\"What is Node.js?\"]");
        assert.deepStrictEqual(res, ["What is Node.js?"]);
    });
    await test("parseGeminiResponse parses markdown-wrapped JSON", () => {
        const res = parseGeminiResponse("```json\n{\"score\": 9}\n```");
        assert.strictEqual(res.score, 9);
    });
    await test("parseGeminiResponse parses JSON with preamble", () => {
        const res = parseGeminiResponse("Sure, here is the JSON:\n{\"score\": 10}");
        assert.strictEqual(res.score, 10);
    });
    await test("parseGeminiResponse throws on completely unparseable text", () => {
        assert.throws(() => {
            parseGeminiResponse("This is not JSON at all");
        }, /Failed to parse Gemini response/);
    });

    // 3b. Gemini Fallback Eligibility
    console.log("\n[3b] Testing isFallbackEligibleGeminiError...");
    await test("Identifies 429 and 503 as fallback eligible", () => {
        assert.strictEqual(isFallbackEligibleGeminiError({ status: 429 }), true);
        assert.strictEqual(isFallbackEligibleGeminiError({ status: 503 }), true);
    });
    await test("Identifies quota and rate limit errors as fallback eligible", () => {
        assert.strictEqual(isFallbackEligibleGeminiError(new Error("Resource exhausted: quota exceeded")), true);
        assert.strictEqual(isFallbackEligibleGeminiError(new Error("Rate limit reached")), true);
    });
    await test("Identifies Gemini request timeouts as fallback eligible", () => {
        assert.strictEqual(isFallbackEligibleGeminiError(new Error("Gemini request timed out after 30000ms")), true);
        assert.strictEqual(isFallbackEligibleGeminiError(new Error("Operation timed out")), true);
    });
    await test("Identifies network failures, connection resets, and ECONNREFUSED as fallback eligible", () => {
        assert.strictEqual(isFallbackEligibleGeminiError(new TypeError("fetch failed")), true);
        assert.strictEqual(isFallbackEligibleGeminiError({ code: "ECONNRESET", message: "read ECONNRESET" }), true);
        assert.strictEqual(isFallbackEligibleGeminiError({ code: "ECONNREFUSED", message: "connect ECONNREFUSED 127.0.0.1:443" }), true);
        assert.strictEqual(isFallbackEligibleGeminiError(new Error("Network error occurred")), true);
    });
    await test("Identifies AbortError as fallback eligible", () => {
        const abortErr = new Error("The operation was aborted");
        abortErr.name = "AbortError";
        assert.strictEqual(isFallbackEligibleGeminiError(abortErr), true);
    });
    await test("Does not treat unrelated application/syntax errors as fallback eligible", () => {
        assert.strictEqual(isFallbackEligibleGeminiError(new TypeError("Cannot read properties of undefined")), false);
        assert.strictEqual(isFallbackEligibleGeminiError(new Error("Invalid interview parameters")), false);
    });

    // 4. Mock HTTP Server Tests for Ollama
    console.log("\n[4] Testing Ollama HTTP Calls, Timeouts, and Errors with Mock Server...");

    let mockHandler = () => {};
    const mockServer = http.createServer((req, res) => {
        mockHandler(req, res);
    });

    await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
    const mockPort = mockServer.address().port;
    const mockBaseUrl = `http://127.0.0.1:${mockPort}`;

    const originalEnv = { ...process.env };

    try {
        // Test: Missing configuration
        await test("generateOllamaContent throws if OLLAMA_BASE_URL is missing", async () => {
            delete process.env.OLLAMA_BASE_URL;
            process.env.OLLAMA_MODEL = "llama3.2:1b";
            await assert.rejects(
                () => generateOllamaContent("test prompt"),
                /Ollama is not configured/
            );
        });

        // Test: Unreachable connection
        await test("generateOllamaContent handles connection failure (unreachable port)", async () => {
            process.env.OLLAMA_BASE_URL = "http://127.0.0.1:19991";
            process.env.OLLAMA_MODEL = "llama3.2:1b";
            process.env.OLLAMA_TIMEOUT_MS = "1000";
            await assert.rejects(
                () => generateOllamaContent("test prompt"),
                /Ollama connection failed/
            );
        });

        // Test: Successful generation
        await test("generateOllamaContent succeeds with valid JSON response", async () => {
            process.env.OLLAMA_BASE_URL = mockBaseUrl;
            process.env.OLLAMA_MODEL = "llama3.2:1b";
            process.env.OLLAMA_TIMEOUT_MS = "3000";

            mockHandler = (req, res) => {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    model: "llama3.2:1b",
                    response: "[\"Explain event loop\", \"Explain closures\"]",
                    done: true
                }));
            };

            const result = await generateOllamaContent("Generate questions");
            const parsed = JSON.parse(result);
            assert.strictEqual(parsed.length, 2);
            assert.strictEqual(parsed[0], "Explain event loop");
        });

        // Test: Native JSON mode (format: "json" included in request body)
        await test("generateOllamaContent includes format: 'json' in request payload", async () => {
            process.env.OLLAMA_BASE_URL = mockBaseUrl;
            process.env.OLLAMA_MODEL = "llama3.2:1b";
            process.env.OLLAMA_TIMEOUT_MS = "3000";

            let receivedBody = null;
            mockHandler = (req, res) => {
                let body = "";
                req.on("data", (chunk) => { body += chunk; });
                req.on("end", () => {
                    receivedBody = JSON.parse(body);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        model: "llama3.2:1b",
                        response: "{\"valid\": true}",
                        done: true
                    }));
                });
            };

            const result = await generateOllamaContent("Test prompt");
            assert.ok(receivedBody, "Server should have received request body");
            assert.strictEqual(receivedBody.format, "json", "Request payload must specify format: 'json'");
            assert.strictEqual(receivedBody.model, "llama3.2:1b");
            assert.strictEqual(receivedBody.stream, false);
            assert.strictEqual(JSON.parse(result).valid, true);
        });

        // Test: OLLAMA_AUTH_TOKEN header handling
        await test("generateOllamaContent sends Authorization header when OLLAMA_AUTH_TOKEN is Basic auth", async () => {
            process.env.OLLAMA_BASE_URL = mockBaseUrl;
            process.env.OLLAMA_MODEL = "llama3.2:1b";
            process.env.OLLAMA_AUTH_TOKEN = "Basic dXNlcjpwYXNz";

            let capturedHeaders = null;
            mockHandler = (req, res) => {
                capturedHeaders = req.headers;
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ response: "{\"auth\": true}", done: true }));
            };

            await generateOllamaContent("Auth test");
            assert.strictEqual(capturedHeaders["authorization"], "Basic dXNlcjpwYXNz");
        });

        await test("generateOllamaContent automatically prefixes bare OLLAMA_AUTH_TOKEN with Bearer", async () => {
            process.env.OLLAMA_BASE_URL = mockBaseUrl;
            process.env.OLLAMA_MODEL = "llama3.2:1b";
            process.env.OLLAMA_AUTH_TOKEN = "my-secret-token";

            let capturedHeaders = null;
            mockHandler = (req, res) => {
                capturedHeaders = req.headers;
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ response: "{\"auth\": true}", done: true }));
            };

            await generateOllamaContent("Bearer test");
            assert.strictEqual(capturedHeaders["authorization"], "Bearer my-secret-token");
        });

        await test("generateOllamaContent sends NO Authorization header when OLLAMA_AUTH_TOKEN is unset", async () => {
            process.env.OLLAMA_BASE_URL = mockBaseUrl;
            process.env.OLLAMA_MODEL = "llama3.2:1b";
            delete process.env.OLLAMA_AUTH_TOKEN;

            let capturedHeaders = null;
            mockHandler = (req, res) => {
                capturedHeaders = req.headers;
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ response: "{\"auth\": false}", done: true }));
            };

            await generateOllamaContent("No auth test");
            assert.strictEqual(capturedHeaders["authorization"], undefined);
        });

        // Test: Non-200 HTTP status
        await test("generateOllamaContent handles non-200 HTTP status (e.g. 500 error)", async () => {
            mockHandler = (req, res) => {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Internal model inference failure");
            };

            await assert.rejects(
                () => generateOllamaContent("test prompt"),
                /Ollama request failed with status 500/
            );
        });

        // Test: Empty response
        await test("generateOllamaContent rejects empty response", async () => {
            mockHandler = (req, res) => {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ response: "   ", done: true }));
            };

            await assert.rejects(
                () => generateOllamaContent("test prompt"),
                /Ollama returned an empty response/
            );
        });

        // Test: Invalid non-JSON content
        await test("generateOllamaContent rejects invalid non-JSON output", async () => {
            mockHandler = (req, res) => {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ response: "Sorry, I cannot answer questions.", done: true }));
            };

            await assert.rejects(
                () => generateOllamaContent("test prompt"),
                /Ollama returned an invalid response \(content is not valid JSON\)/
            );
        });

        // Test: Timeout handling
        await test("generateOllamaContent handles timeout correctly", async () => {
            process.env.OLLAMA_TIMEOUT_MS = "200";

            mockHandler = (_req, _res) => {
                // Intentionally delay longer than 200ms
                setTimeout(() => {}, 500);
            };

            await assert.rejects(
                () => generateOllamaContent("test prompt"),
                /Ollama request timed out after 200ms/
            );
        });

        // 5. Fallback Chain in generateContent
        console.log("\n[5] Testing Fallback Chain Logic in generateContent...");

        await test("generateContent with AI_PROVIDER=ollama returns Ollama response when healthy", async () => {
            process.env.AI_PROVIDER = "ollama";
            process.env.OLLAMA_BASE_URL = mockBaseUrl;
            process.env.OLLAMA_MODEL = "llama3.2:1b";
            process.env.OLLAMA_TIMEOUT_MS = "2000";

            mockHandler = (req, res) => {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    response: "[\"Ollama Question 1\", \"Ollama Question 2\"]",
                    done: true
                }));
            };

            const result = await generateContent("test");
            const parsed = parseGeminiResponse(result);
            assert.deepStrictEqual(parsed, ["Ollama Question 1", "Ollama Question 2"]);
        });

        await test("generateContent falls back to Gemini/OpenRouter when Ollama fails", async () => {
            process.env.AI_PROVIDER = "ollama";
            // Point Ollama to broken port to simulate failure
            process.env.OLLAMA_BASE_URL = "http://127.0.0.1:19992";
            process.env.OLLAMA_MODEL = "llama3.2:1b";
            process.env.OLLAMA_TIMEOUT_MS = "200";

            // Configure mock OpenRouter via environment
            // Since Gemini is not configured, Gemini throws "missing GEMINI_API_KEY", which is fallback-eligible
            delete process.env.GEMINI_API_KEY;
            process.env.OPENROUTER_API_KEY = "test_key";
            process.env.OPENROUTER_MODEL = "test_model";

            // We test that when Ollama fails, it attempts the next providers in chain
            // Since OpenRouter endpoint is external or mock, it attempts OpenRouter
            try {
                await generateContent("test");
            } catch (err) {
                // It should report trying providers in the fallback chain
                assert.ok(
                    err.message.includes("OpenRouter") ||
                    err.message.includes("AI request failed across all providers"),
                    `Expected fallback message, got: ${err.message}`
                );
            }
        });

    } finally {
        // Restore environment and close mock server
        for (const key of Object.keys(process.env)) {
            if (!(key in originalEnv)) {
                delete process.env[key];
            } else {
                process.env[key] = originalEnv[key];
            }
        }
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
