const { GoogleGenAI } = require("@google/genai");

let aiClient = null;
const getGeminiClient = () => {
    if (!aiClient) {
        aiClient = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
        });
    }
    return aiClient;
};

const GEMINI_MODEL = "gemini-3.5-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const getRequestTimeoutMs = () => Number(process.env.AI_REQUEST_TIMEOUT_MS || 60000);
const getOllamaTimeoutMs = () => Number(
    process.env.OLLAMA_TIMEOUT_MS || process.env.AI_REQUEST_TIMEOUT_MS || 90000
);

const getOllamaUrl = (baseUrl) => {
    if (!baseUrl) return "";
    const trimmed = baseUrl.trim().replace(/\/+$/, "");
    if (trimmed.endsWith("/api/generate") || trimmed.endsWith("/api/chat")) {
        return trimmed;
    }
    if (trimmed.endsWith("/api")) {
        return `${trimmed}/generate`;
    }
    return `${trimmed}/api/generate`;
};

const extractOllamaText = (data) => {
    if (!data) return "";
    if (typeof data.response === "string") {
        return data.response;
    }
    if (typeof data.message?.content === "string") {
        return data.message.content;
    }
    if (typeof data.choices?.[0]?.message?.content === "string") {
        return data.choices[0].message.content;
    }
    return "";
};

const cleanAndValidateJsonText = (raw) => {
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim();

    // 1. Direct or markdown-stripped check
    const stripped = trimmed
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```\s*$/, "")
        .trim();

    try {
        JSON.parse(stripped);
        return stripped;
    } catch (_) {
        // 2. Search for outermost JSON array [ ... ] or object { ... }
        const firstBracket = stripped.indexOf("[");
        const lastBracket = stripped.lastIndexOf("]");
        const firstBrace = stripped.indexOf("{");
        const lastBrace = stripped.lastIndexOf("}");

        // Array outer candidate
        if (
            firstBracket !== -1 &&
            lastBracket > firstBracket &&
            (firstBrace === -1 || firstBracket < firstBrace)
        ) {
            const candidate = stripped.substring(firstBracket, lastBracket + 1);
            try {
                JSON.parse(candidate);
                return candidate;
            } catch (_) {}
        }

        // Object outer candidate
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            const candidate = stripped.substring(firstBrace, lastBrace + 1);
            try {
                JSON.parse(candidate);
                return candidate;
            } catch (_) {}
        }
    }

    return null;
};

const isFallbackEliginiError = (error) => {
    const status = Number(error?.status ?? error?.response?.status);
    const code = String(error?.code ?? error?.error?.status ?? "").toUpperCase();
    const message = String(error?.message ?? error?.details ?? "").toLowerCase();
    const name = String(error?.name ?? "");

    return (
        status === 429 ||
        status === 503 ||
        code === "RESOURCE_EXHAUSTED" ||
        code === "ECONNRESET" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        name === "AbortError" ||
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("resource exhausted") ||
        message.includes("too many requests") ||
        message.includes("not configured") ||
        message.includes("api key") ||
        message.includes("timed out") ||
        message.includes("timeout") ||
        message.includes("fetch failed") ||
        message.includes("econnreset") ||
        message.includes("econnrefused") ||
        message.includes("network error") ||
        message.includes("networkerror") ||
        message.includes("aborterror")
    );
};

const withTimeout = (promise, timeoutMs, label) => {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
};

const generateOllamaContent = async (prompt) => {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    const model = process.env.OLLAMA_MODEL;

    if (!baseUrl || !model) {
        throw new Error("Ollama is not configured: missing OLLAMA_BASE_URL or OLLAMA_MODEL");
    }

    const url = getOllamaUrl(baseUrl);
    const timeoutMs = getOllamaTimeoutMs();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
        "Content-Type": "application/json",
        // Skip ngrok warning screen when using free ngrok tunnels
        "ngrok-skip-browser-warning": "true",
    };

    const authToken = (process.env.OLLAMA_AUTH_TOKEN || "").trim();
    if (authToken) {
        headers["Authorization"] =
            authToken.startsWith("Basic ") || authToken.startsWith("Bearer ")
                ? authToken
                : `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model,
                prompt,
                stream: false,
                format: "json",
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            const suffix = errorText ? `: ${errorText.slice(0, 200)}` : "";
            throw new Error(`Ollama request failed with status ${response.status}${suffix}`);
        }

        let data;
        try {
            data = await response.json();
        } catch (jsonErr) {
            throw new Error(`Ollama returned non-JSON HTTP response: ${jsonErr.message}`);
        }

        const rawText = extractOllamaText(data);
        if (!rawText || !rawText.trim()) {
            throw new Error("Ollama returned an empty response");
        }

        const validJson = cleanAndValidateJsonText(rawText);
        if (!validJson) {
            throw new Error("Ollama returned an invalid response (content is not valid JSON)");
        }

        return validJson;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
        }

        if (
            error.code === "ECONNREFUSED" ||
            error.code === "ENOTFOUND" ||
            error.code === "ECONNRESET" ||
            (error.name === "TypeError" && String(error.message).includes("fetch failed"))
        ) {
            throw new Error(`Ollama connection failed (${error.code || error.message}) at ${url}`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

const generateGeminiContent = async (prompt) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("Gemini is not configured (missing GEMINI_API_KEY)");
    }

    const client = getGeminiClient();
    const timeoutMs = getRequestTimeoutMs();
    const result = await withTimeout(
        client.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
        }),
        timeoutMs,
        "Gemini request"
    );

    return result.text;
};

const extractOpenRouterText = (content) => {
    if (typeof content === "string") {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === "string") {
                    return part;
                }

                return String(part?.text ?? part?.content ?? "");
            })
            .join("");
    }

    if (content && typeof content === "object") {
        return String(content.text ?? content.content ?? "");
    }

    return "";
};

const generateOpenRouterContent = async (prompt) => {
    if (!process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_MODEL) {
        throw new Error("OpenRouter fallback is not configured");
    }

    const timeoutMs = getRequestTimeoutMs();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "X-Title": "AI-Interview-Platform",
            },
            body: JSON.stringify({
                model: process.env.OPENROUTER_MODEL,
                messages: [{ role: "user", content: prompt }],
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            const suffix = errorText ? `: ${errorText.slice(0, 200)}` : "";
            throw new Error(`OpenRouter request failed with status ${response.status}${suffix}`);
        }

        const data = await response.json();
        const text = extractOpenRouterText(data?.choices?.[0]?.message?.content);

        if (!text) {
            throw new Error("OpenRouter returned an empty response");
        }

        return text;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

const generateContent = async (prompt) => {
    const provider = String(process.env.AI_PROVIDER || "gemini").toLowerCase().trim();

    // 1. Ollama selected: Fallback order Ollama -> Gemini -> OpenRouter
    if (provider === "ollama") {
        try {
            return await generateOllamaContent(prompt);
        } catch (ollamaError) {
            console.warn(`[AI Service] Ollama failed (${ollamaError.message}). Falling back to Gemini...`);
        }

        try {
            return await generateGeminiContent(prompt);
        } catch (geminiError) {
            if (!isFallbackEliginiError(geminiError)) {
                throw geminiError;
            }
            console.warn(`[AI Service] Gemini fallback failed (${geminiError.message}). Falling back to OpenRouter...`);
        }

        try {
            return await generateOpenRouterContent(prompt);
        } catch (openRouterError) {
            throw new Error(
                `AI request failed across all providers (Ollama -> Gemini -> OpenRouter): ${openRouterError.message}`
            );
        }
    }

    // 2. OpenRouter explicitly selected
    if (provider === "openrouter") {
        try {
            return await generateOpenRouterContent(prompt);
        } catch (openRouterError) {
            throw new Error(`AI request failed (OpenRouter): ${openRouterError.message}`);
        }
    }

    // 3. Default: Gemini with fallback to OpenRouter
    try {
        return await generateGeminiContent(prompt);
    } catch (geminiError) {
        if (!isFallbackEliginiError(geminiError)) {
            throw geminiError;
        }
        console.warn(`[AI Service] Gemini failed (${geminiError.message}). Falling back to OpenRouter...`);
    }

    try {
        return await generateOpenRouterContent(prompt);
    } catch (openRouterError) {
        throw new Error(`AI request failed: ${openRouterError.message}`);
    }
};

module.exports = {
    generateContent,
    generateOllamaContent,
    generateGeminiContent,
    generateOpenRouterContent,
    getOllamaUrl,
    extractOllamaText,
    cleanAndValidateJsonText,
    isFallbackEliginiError,
    isFallbackEligibleGeminiError: isFallbackEliginiError,
};
