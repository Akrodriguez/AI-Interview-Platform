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
const generateSummaryPrompt = (questions) => {
    return `
You are an experienced technical interviewer.

Below is the interview result.

${JSON.stringify(questions, null, 2)}

Analyze the interview.

Return ONLY valid JSON in this format:

{
    "summary":"Overall performance summary",

    "strengths":[
        "Strength 1",
        "Strength 2"
    ],

    "weaknesses":[
        "Weakness 1",
        "Weakness 2"
    ],

    "recommendation":"Final hiring recommendation"
}

Do not return markdown.
Only return JSON.
`;
};

module.exports = {
    generateInterviewQuestionsPrompt,
    generateEvaluationPrompt,
    generateSummaryPrompt
};