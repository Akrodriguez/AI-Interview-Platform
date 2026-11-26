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
Generate ${interview.questionCount || 10} interview questions.

Role: ${interview.role}

Experience: ${interview.experience} years

Difficulty: ${interview.difficulty || "Intermediate"}

Tech Stack:
${techStackString}

Description:
${interview.description || "No extra description provided."}

Return ONLY a JSON array of strings.

Example:
[
    "Question 1",
    "Question 2"
]
`;
};

const generateResumeQuestionsPrompt = ({ role, experience, difficulty, questionCount, resumeText }) => {
    return `
You are generating a personalized interview for a candidate based only on the information present in their resume.

Requirements:
- Target role: ${role}
- Candidate experience: ${experience} years
- Difficulty: ${difficulty}
- Number of questions: ${questionCount}
- Use only details that actually appear in the resume.
- Do not invent skills, projects, employers, certifications, years, or responsibilities.
- Questions should be tailored to the actual resume content and the target role.
- Include technical questions, project-based questions, and experience/education-related questions where relevant.
- Focus on the candidate's real strengths and gaps shown by the resume.

Resume text:
${resumeText}

Return ONLY valid JSON in this format:
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

const generateFollowUpQuestionPrompt = ({ role, experience, difficulty, question, answer }) => {
    return `
You are an experienced technical interviewer. Decide whether a single targeted follow-up question would meaningfully improve assessment of the candidate's understanding.

Requirements:
- Only generate a follow-up if the answer is substantial, relevant, and demonstrates enough content to justify a deeper probe.
- The follow-up must be based on the candidate's actual answer, not a generic question.
- It should probe technical depth, reasoning, clarification, or trade-offs.
- It must avoid repeating the original question.
- Keep it at most one question.
- It must match the candidate's role, experience, and difficulty.
- If the answer is empty, vague, off-topic, or clearly irrelevant, return {"followUpQuestion": null}.

Role: ${role}
Experience: ${experience} years
Difficulty: ${difficulty || "Intermediate"}

Original Question:
${question}

Candidate Answer:
${answer}

Return ONLY valid JSON in this format:
{
  "followUpQuestion": "A single concise follow-up question or null"
}
`;
};

// Overall interview summary
const generateSummaryPrompt = (questions) => {
    return `
You are an experienced technical interviewer.

Below is the interview result.

${JSON.stringify(questions, null, 2)}

Analyze the interview using only evidence from the actual answers, feedback, and improvement notes.

Return ONLY valid JSON in this format:

{
    "summary": "One concise overall summary paragraph.",
    "strongestSkills": [
        "Python",
        "SQL"
    ],
    "weakestSkills": [
        "Machine Learning",
        "DSA"
    ],
    "areasToImprove": [
        "Practice SQL joins and window functions.",
        "Revise DSA time complexity."
    ]
}

Rules:
- strongestSkills and weakestSkills must be exact skill or topic names only, not full sentences.
- strongestSkills and weakestSkills should each contain 1 to 3 short names.
- areasToImprove must be short actionable recommendations, each 5 to 12 words, as complete phrases.
- Use real topics from the candidate's interview data.
- Do not use incomplete fragments, filler words, or generic feedback like 'clear grasp of the' or 'good conceptual understanding'.
- If a skill cannot be supported by the evidence, omit it instead of inventing it.
- Do not return markdown.
- Only return JSON.
`;
};

const generateImprovementPlanPrompt = (data) => {
    return `
You are a technical interview coach. Create a personalized 5-day improvement plan using only the candidate's actual interview results.

Requirements:
- Base the plan on the candidate's real interview performance, not generic advice.
- Prioritize the candidate's weakest areas while reinforcing strengths.
- Use the data below exactly as evidence.
- Return only valid JSON with this exact structure:

{
  "summary": "Brief overview of the candidate's overall improvement focus",
  "focusAreas": ["Weakness or skill area 1", "Weakness or skill area 2", "Strength to reinforce"],
  "days": [
    {
      "day": 1,
      "topic": "Specific practice topic",
      "objective": "What the candidate should learn",
      "activity": "Recommended practice activity",
      "estimatedTime": "45 minutes",
      "expectedOutcome": "What success looks like"
    }
  ]
}

Candidate interview data:
${JSON.stringify(data, null, 2)}

Important:
- The plan must contain exactly 5 days.
- Each day must include a different topic and practical activity.
- Weeks should not be generic; each day should connect to the candidate's actual weak areas and strengths from the interview data.
- Keep the tips actionable and realistic for a working professional.
- Do not include markdown or commentary outside of JSON.
`;
};

module.exports = {
    generateInterviewQuestionsPrompt,
    generateResumeQuestionsPrompt,
    generateEvaluationPrompt,
    generateFollowUpQuestionPrompt,
    generateSummaryPrompt,
    generateImprovementPlanPrompt,
};