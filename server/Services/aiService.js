const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const GEMINI_MODEL = "gemini-3.5-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 60000);

const isFallbackEligibleGeminiError = (error) => {
    const status = Number(error?.status ?? error?.response?.status);
    const code = String(error?.code ?? error?.error?.status ?? "").toUpperCase();
    const message = String(error?.message ?? error?.details ?? "").toLowerCase();

    return (
        status === 429 ||
        status === 503 ||
        code === "RESOURCE_EXHAUSTED" ||
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("resource exhausted") ||
        message.includes("too many requests")
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

const generateGeminiContent = async (prompt) => {
    const result = await withTimeout(
        ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
        }),
        REQUEST_TIMEOUT_MS,
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
            throw new Error(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS}ms`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

const generateContent = async (prompt) => {
    try {
        return await generateGeminiContent(prompt);
    } catch (error) {
        if (!isFallbackEligibleGeminiError(error)) {
            throw error;
        }
    }

    try {
        return await generateOpenRouterContent(prompt);
    } catch (error) {
        throw new Error(`AI request failed: ${error.message}`);
    }
};

module.exports = {
    generateContent
};