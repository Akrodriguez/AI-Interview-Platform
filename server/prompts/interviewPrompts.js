// Generate interview questions
const generateInterviewQuestionsPrompt = (interview) => {
    return `
Generate 10 interview questions.

Role: ${interview.role}

Experience: ${interview.experience} years

Tech Stack:
${interview.techStack.join(", ")}

Description:
${interview.description}

Return ONLY a JSON array of strings.

Example:
[
    "Question 1",
    "Question 2"
]
`;
};

// Evaluate one answer
const generateEvaluationPrompt = (question, answer) => {
    return `
You are an experienced technical interviewer.

Question:
${question}

Candidate Answer:
${answer}

Evaluate the answer and return ONLY JSON in this format:

{
    "score": 8,
    "feedback": "Good understanding...",
    "improvement": "Mention JWT expiry..."
}
`;
};

// Overall interview summary
const generateSummaryPrompt = (results) => {
    return `
Based on these interview results:

${JSON.stringify(results)}

Give an overall summary.

Return ONLY JSON.
`;
};

module.exports = {
    generateInterviewQuestionsPrompt,
    generateEvaluationPrompt,
    generateSummaryPrompt
};