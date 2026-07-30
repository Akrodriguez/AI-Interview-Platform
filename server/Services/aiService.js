const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const MODEL_NAME = "gemini-3.5-flash";

const generateContent = async (prompt) => {

    const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
    });

    return result.text;
};

module.exports = {
    generateContent
};