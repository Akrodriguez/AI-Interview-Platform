const { extractText } = require("unpdf");
const mammoth = require("mammoth");
const path = require("path");

/**
 * Extracts plain text from a resume file buffer (PDF or DOCX/DOC).
 * @param {Buffer} buffer - File buffer from multer memory storage
 * @param {string} mimetype - MIME type of the uploaded file
 * @param {string} originalname - Original file name
 * @returns {Promise<string>} Extracted and cleaned text
 */
const extractTextFromResume = async (buffer, mimetype, originalname = "") => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new Error("Invalid or empty file buffer provided");
    }

    const ext = path.extname(originalname).toLowerCase();

    try {
        let extractedText = "";

        if (mimetype === "application/pdf" || ext === ".pdf") {
            const { text } = await extractText(new Uint8Array(buffer));
            extractedText = Array.isArray(text) ? text.join("\n") : (text || "");
        } else if (
            mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            ext === ".docx"
        ) {
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value || "";
        } else if (
            mimetype === "application/msword" ||
            ext === ".doc"
        ) {
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value || "";
        } else {
            throw new Error(`Unsupported file type: ${mimetype || ext}`);
        }

        // Clean up excessive whitespace and blank lines
        const cleanedText = extractedText
            .replace(/\r\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        if (!cleanedText) {
            throw new Error("Could not extract any readable text from the uploaded document.");
        }

        return cleanedText;
    } catch (error) {
        throw new Error(`Resume parsing failed: ${error.message}`);
    }
};

module.exports = {
    extractTextFromResume,
};
