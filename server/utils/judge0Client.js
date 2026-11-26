/**
 * Language ID mappings for Standard Judge0 CE
 * Official Judge0 CE IDs:
 * - C++ (GCC): 54
 * - Python: 71
 * - JavaScript (Node.js): 63
 */
const STANDARD_LANGUAGE_IDS = Object.freeze({
    cpp: 54,
    "c++": 54,
    python: 71,
    py: 71,
    javascript: 63,
    js: 63,
    node: 63,
});

/**
 * Language ID mappings for OnlineCompiler.io (Judge0-compatible API)
 * - C++ (GCC 15): 105
 * - Python (3.14): 113
 * - JavaScript (Node.js 24): 102
 */
const ONLINECOMPILER_LANGUAGE_IDS = Object.freeze({
    cpp: 105,
    "c++": 105,
    python: 113,
    py: 113,
    javascript: 102,
    js: 102,
    node: 102,
});

// For backward compatibility
const LANGUAGE_IDS = STANDARD_LANGUAGE_IDS;

/**
 * Check if a URL targets OnlineCompiler.io
 * @param {string} url
 * @returns {boolean}
 */
const isOnlineCompilerUrl = (url) => {
    if (!url) return false;
    return String(url).toLowerCase().includes("onlinecompiler.io");
};

/**
 * Normalize Judge0 / code execution base URL (removes trailing slashes).
 * Supports JUDGE0_API_URL and legacy JUDGE0_BASE_URL.
 * @param {string} [rawUrl]
 * @returns {string}
 */
const getJudge0ApiUrl = (rawUrl) => {
    const url = rawUrl || process.env.JUDGE0_API_URL || process.env.JUDGE0_BASE_URL || "";
    if (!url) return "";
    return url.trim().replace(/\/+$/, "");
};

/**
 * Resolve language string or number to a valid language ID for the target execution engine.
 * @param {string|number} lang - Language name or ID
 * @param {string} [url] - Target API URL to choose correct language map
 * @returns {number|null}
 */
const resolveLanguageId = (lang, url) => {
    const targetUrl = url || getJudge0ApiUrl();
    const isOnlineCompiler = isOnlineCompilerUrl(targetUrl);
    const activeMap = isOnlineCompiler ? ONLINECOMPILER_LANGUAGE_IDS : STANDARD_LANGUAGE_IDS;

    if (typeof lang === "number") {
        if (
            Object.values(activeMap).includes(lang) ||
            Object.values(STANDARD_LANGUAGE_IDS).includes(lang) ||
            Object.values(ONLINECOMPILER_LANGUAGE_IDS).includes(lang)
        ) {
            return lang;
        }
    }

    if (!lang) return null;
    const normalized = String(lang).toLowerCase().trim();
    return activeMap[normalized] || STANDARD_LANGUAGE_IDS[normalized] || null;
};

/**
 * Build request headers for Judge0 / OnlineCompiler.io.
 * OnlineCompiler.io requires the API key directly in X-Auth-Token or Authorization (WITHOUT "Bearer ").
 * Supplying "Bearer <key>" causes OnlineCompiler to treat "Bearer <key>" as the key literal and return 404 "Invalid or inactive API key".
 * @param {string} baseUrl
 * @param {string} [apiKey]
 * @returns {Record<string, string>}
 */
const buildHeaders = (baseUrl, apiKey) => {
    const rawKey = apiKey !== undefined ? apiKey : process.env.JUDGE0_API_KEY;
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
    };

    if (rawKey && String(rawKey).trim()) {
        const trimmedKey = String(rawKey).trim().replace(/^["']|["']$/g, "");
        headers["X-Auth-Token"] = trimmedKey;
        // OnlineCompiler.io expects raw API key string in Authorization without "Bearer "
        headers["Authorization"] = trimmedKey;
        headers["X-RapidAPI-Key"] = trimmedKey;

        try {
            const parsed = new URL(baseUrl);
            if (parsed.host.includes("rapidapi.com")) {
                headers["X-RapidAPI-Host"] = parsed.host;
            }
        } catch (_) {}
    }

    return headers;
};

/**
 * Safely parse execution output from Judge0 / OnlineCompiler.io response data.
 * @param {object} data
 * @returns {object}
 */
const normalizeExecutionResult = (data) => {
    if (!data || typeof data !== "object") {
        return {
            stdout: "",
            stderr: "",
            compileOutput: "",
            execStatus: "Unknown",
            statusId: null,
            execTime: null,
            memoryUsed: null,
            token: null,
        };
    }

    const stdout = data.stdout != null ? String(data.stdout) : "";
    let stderr = data.stderr != null ? String(data.stderr) : "";
    const compileOutput = data.compile_output != null ? String(data.compile_output) : "";
    const statusDesc = data.status?.description || (data.status?.id ? `Status ${data.status.id}` : "Unknown");
    const statusId = data.status?.id ?? null;
    const execTime = data.time != null ? String(data.time) : null;
    const memoryUsed = data.memory != null ? Number(data.memory) : null;
    const token = data.token || null;

    // If message is present without stderr/compileOutput (e.g., sandbox internal error or timeout notice)
    if (data.message && !stderr && !compileOutput && statusId !== 3) {
        stderr = String(data.message);
    }

    return {
        stdout,
        stderr,
        compileOutput,
        execStatus: statusDesc,
        statusId,
        execTime,
        memoryUsed,
        token,
    };
};

/**
 * Execute code via Judge0 / OnlineCompiler.io REST API with asynchronous polling and timeout handling.
 *
 * @param {object} options
 * @param {string|number} options.language - "cpp", "python", "javascript", or language_id
 * @param {string} options.sourceCode - The source code to execute
 * @param {string} [options.stdin=""] - Optional standard input
 * @param {string} [options.apiUrl] - Optional override for API URL
 * @param {string} [options.apiKey] - Optional override for API Key
 * @param {number} [options.timeoutMs] - Execution timeout in ms (default from JUDGE0_TIMEOUT or 25000)
 * @param {number} [options.pollIntervalMs=500] - Polling interval in ms
 * @returns {Promise<object>} normalized execution result
 */
const executeCode = async ({
    language,
    sourceCode,
    stdin = "",
    apiUrl,
    apiKey,
    timeoutMs,
    pollIntervalMs = 500,
}) => {
    const baseUrl = getJudge0ApiUrl(apiUrl);
    if (!baseUrl) {
        throw new Error(
            "Code execution service is not configured. Please set JUDGE0_API_URL in your environment."
        );
    }

    const languageId = resolveLanguageId(language, baseUrl);
    if (!languageId) {
        throw new Error(
            `Unsupported language "${language}". Supported languages: python, javascript, cpp`
        );
    }

    if (typeof sourceCode !== "string" || !sourceCode.trim()) {
        throw new Error("Source code cannot be empty.");
    }

    // Default timeout from env or 25000ms
    const maxTimeout = Number(timeoutMs || process.env.JUDGE0_TIMEOUT || 25000);
    const headers = buildHeaders(baseUrl, apiKey);

    const activeKey = (apiKey !== undefined ? apiKey : process.env.JUDGE0_API_KEY || "")
        .trim()
        .replace(/^["']|["']$/g, "");
    console.log(
        `[Judge0 Client] Executing ${language} via ${baseUrl} (API key configured: ${Boolean(activeKey)}, length: ${activeKey.length})`
    );

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), maxTimeout);

    try {
        // Step 1: Submit code.
        // We request wait=true to complete immediately if the engine processes it fast,
        // and fall back to polling if the request is queued or returns a token.
        const submitUrl = `${baseUrl}/submissions?base64_encoded=false&wait=true`;
        const submitBody = JSON.stringify({
            language_id: languageId,
            source_code: sourceCode,
            stdin: stdin || "",
        });

        let submitRes;
        try {
            submitRes = await fetch(submitUrl, {
                method: "POST",
                headers,
                body: submitBody,
                signal: controller.signal,
            });
        } catch (fetchErr) {
            if (fetchErr.name === "AbortError") {
                throw new Error(`Code execution timed out after ${maxTimeout}ms`);
            }
            throw new Error(
                `Failed to connect to execution provider at ${baseUrl}: ${fetchErr.message || "Network error"}`
            );
        }

        if (!submitRes.ok) {
            const errorBody = await submitRes.text().catch(() => "");
            let parsedError = "";
            try {
                const parsed = JSON.parse(errorBody);
                parsedError = parsed.error || parsed.message || "";
            } catch (_) {
                parsedError = errorBody.slice(0, 200);
            }

            if (submitRes.status === 429) {
                throw new Error(
                    `Execution rate limit reached: ${parsedError || "Too many requests. Please wait a few seconds and try again."}`
                );
            }

            if (
                submitRes.status === 401 ||
                submitRes.status === 403 ||
                (submitRes.status === 404 && parsedError.toLowerCase().includes("api key"))
            ) {
                throw new Error(
                    `Invalid or missing API key: ${parsedError || "Check JUDGE0_API_KEY in server/.env."}`
                );
            }

            const suffix = parsedError ? `: ${parsedError}` : "";
            throw new Error(`Code execution submission failed with status ${submitRes.status}${suffix}`);
        }

        let initialData;
        try {
            initialData = await submitRes.json();
        } catch (jsonErr) {
            throw new Error(`Execution provider returned non-JSON response: ${jsonErr.message}`);
        }

        // If execution finished immediately (status.id >= 3), return result
        if (initialData.status && initialData.status.id >= 3) {
            return normalizeExecutionResult(initialData);
        }

        const token = initialData.token;
        if (!token) {
            // Returned result directly
            return normalizeExecutionResult(initialData);
        }

        // Step 2: Poll for completion if queued or processing (status.id 1 = In Queue, 2 = Processing)
        const pollUrl = `${baseUrl}/submissions/${token}?base64_encoded=false`;
        const startTime = Date.now();

        while (Date.now() - startTime < maxTimeout) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

            let pollRes;
            try {
                pollRes = await fetch(pollUrl, {
                    method: "GET",
                    headers,
                    signal: controller.signal,
                });
            } catch (pollErr) {
                if (pollErr.name === "AbortError") {
                    throw new Error(`Code execution timed out after ${maxTimeout}ms`);
                }
                throw new Error(`Execution polling error: ${pollErr.message}`);
            }

            if (!pollRes.ok) {
                const errorBody = await pollRes.text().catch(() => "");
                let parsedError = "";
                try {
                    const parsed = JSON.parse(errorBody);
                    parsedError = parsed.error || parsed.message || "";
                } catch (_) {
                    parsedError = errorBody.slice(0, 150);
                }

                if (pollRes.status === 429) {
                    throw new Error(
                        `Execution rate limit reached during polling: ${parsedError || "Please try again later."}`
                    );
                }

                throw new Error(
                    `Poll request failed with status ${pollRes.status}${parsedError ? `: ${parsedError}` : ""}`
                );
            }

            const pollData = await pollRes.json();
            // Status ID >= 3 means execution completed (Accepted, Wrong Answer, TLE, Compile Error, Runtime Error, etc.)
            if (pollData.status && pollData.status.id >= 3) {
                return normalizeExecutionResult(pollData);
            }
        }

        throw new Error(`Code execution timed out after ${maxTimeout}ms`);
    } catch (err) {
        if (err.name === "AbortError") {
            throw new Error(`Code execution timed out after ${maxTimeout}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timeoutTimer);
    }
};

/**
 * Minimal health and authentication test for the configured execution API.
 * Safely verifies connectivity and credentials with zero secret leakage.
 * @param {string} [apiUrl]
 * @param {string} [apiKey]
 * @returns {Promise<{ ok: boolean, status: number, message: string, stdout?: string }>}
 */
const checkApiHealth = async (apiUrl, apiKey) => {
    const baseUrl = getJudge0ApiUrl(apiUrl);
    if (!baseUrl) {
        return { ok: false, status: 503, message: "JUDGE0_API_URL is not configured." };
    }

    const key = (apiKey !== undefined ? apiKey : process.env.JUDGE0_API_KEY || "")
        .trim()
        .replace(/^["']|["']$/g, "");

    console.log(
        `[Judge0 Health Check] Endpoint: ${baseUrl} (API key configured: ${Boolean(key)}, length: ${key.length})`
    );

    const headers = buildHeaders(baseUrl, key);
    const languageId = resolveLanguageId("python", baseUrl) || 71;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(`${baseUrl}/submissions?wait=true`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                language_id: languageId,
                source_code: "print('health_check_ok')",
            }),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            return {
                ok: true,
                status: res.status,
                message: "Authentication successful and execution engine is operational.",
                stdout: data.stdout || null,
            };
        }

        const errText = await res.text().catch(() => "");
        let parsed = "";
        try {
            const json = JSON.parse(errText);
            parsed = json.error || json.message || errText;
        } catch (_) {
            parsed = errText.slice(0, 150);
        }

        return {
            ok: false,
            status: res.status,
            message: `API returned HTTP ${res.status}: ${parsed}`,
        };
    } catch (err) {
        return {
            ok: false,
            status: 500,
            message: `Connection failed: ${err.message}`,
        };
    }
};

module.exports = {
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
};
