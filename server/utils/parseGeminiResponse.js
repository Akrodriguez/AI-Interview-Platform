const parseGeminiResponse = (response) => {
    try {
        const cleanedResponse = response
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        try {
            return JSON.parse(cleanedResponse);
        } catch (initialError) {
            // Check for outermost array [ ... ]
            const firstBracket = cleanedResponse.indexOf("[");
            const lastBracket = cleanedResponse.lastIndexOf("]");
            const firstBrace = cleanedResponse.indexOf("{");
            const lastBrace = cleanedResponse.lastIndexOf("}");

            if (
                firstBracket !== -1 &&
                lastBracket > firstBracket &&
                (firstBrace === -1 || firstBracket < firstBrace)
            ) {
                try {
                    return JSON.parse(cleanedResponse.substring(firstBracket, lastBracket + 1));
                } catch (_) {}
            }

            // Check for outermost object { ... }
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                try {
                    return JSON.parse(cleanedResponse.substring(firstBrace, lastBrace + 1));
                } catch (_) {}
            }

            throw initialError;
        }
    } catch (error) {
        throw new Error("Failed to parse Gemini response");
    }
};

module.exports = parseGeminiResponse;
