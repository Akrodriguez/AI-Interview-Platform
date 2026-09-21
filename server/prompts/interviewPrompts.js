// Generate interview questions
const generateInterviewQuestionsPrompt = (interview) => {
    const techStackString = Array.isArray(interview.techStack)
        ? interview.techStack.join(", ")
        : interview.techStack || "";

    const hasResume = interview.resumeText && interview.resumeText.trim();

    if (hasResume) {
        return `
Generate 10 interview questions.

Role: ${interview.role}

Experience: ${interview.experience} years

Tech Stack:
${techStackString}

Description:
${interview.description || ""}

Candidate Resume:
${interview.resumeText.trim()}

Instructions:
- Tailor questions to the candidate's background, referencing their actual projects, technologies, and experience from their resume where appropriate.
- Balance resume-specific deep dives with relevant technical, conceptual, and problem-solving questions.

Return ONLY a JSON array of strings.

Example:
[
    "Question 1",
    "Question 2"
]
`;
    }

    return `
Generate 10 interview questions.

Role: ${interview.role}

Experience: ${interview.experience} years

Tech Stack:
${techStackString}

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

Evaluate the candidate's answer based on the question asked.

Question:
${question}

Candidate Answer:
${answer}

Evaluation Criteria (rate each from 1 to 10):
1. Technical Accuracy: Correctness of concepts, terminology, syntax, and principles.
2. Completeness: Coverage of essential points, nuances, and depth required by the question.
3. Clarity: Structure, conciseness, and articulation of explanations.
4. Problem Solving: Analytical reasoning, trade-off analysis, and logical approach.
5. Practical Understanding: Real-world applicability, best practices, and hands-on experience.

Return ONLY valid JSON in this exact format:

{
    "technicalAccuracy": 8,
    "completeness": 7,
    "clarity": 8,
    "problemSolving": 7,
    "practicalUnderstanding": 8,
    "score": 8,
    "feedback": "Comprehensive assessment of the response quality...",
    "strengths": [
        "Key strength 1",
        "Key strength 2"
    ],
    "weaknesses": [
        "Area needing work 1",
        "Area needing work 2"
    ],
    "improvement": "Actionable suggestion for improvement..."
}

Do not return markdown fences.
Return ONLY valid JSON.
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