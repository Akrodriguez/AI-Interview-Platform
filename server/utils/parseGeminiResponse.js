const parseGeminiResponse = (response) => {
    try {
        const cleanedResponse = response
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        return JSON.parse(cleanedResponse);
    } catch (error) {
        throw new Error("Failed to parse Gemini response");
    }
};

module.exports = parseGeminiResponse;