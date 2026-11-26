const fs = require("fs");
const path = require("path");
const { generateContent } = require("../services/aiService");
const {
    generateInterviewQuestionsPrompt,
    generateResumeQuestionsPrompt,
    generateEvaluationPrompt,
    generateFollowUpQuestionPrompt,
    generateSummaryPrompt,
    generateImprovementPlanPrompt,
} = require("../prompts/interviewPrompts");
const Interview = require("../models/Interview");
const ImprovementPlan = require("../models/ImprovementPlan");
const parseGeminiResponse = require("../utils/parseGeminiResponse");
const { extractTextFromResume } = require("../utils/resumeParser");
const { extractResumeText } = require("../utils/extractResumeText");

const normalizeInsightText = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .replace(/[`*_]/g, "")
        .replace(/\s+/g, " ")
        .trim();
};

const toTextArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        return [value];
    }

    return [];
};

const sanitizeSkillList = (items, evidenceText = "") => {
    const evidenceLower = evidenceText.toLowerCase();
    const seen = new Set();

    return toTextArray(items)
        .map((item) => normalizeInsightText(item))
        .filter((item) => {
            if (!item || item.length < 2 || item.length > 120) {
                return false;
            }

            const words = item.split(/\s+/).filter(Boolean);
            if (words.length === 0 || words.length > 12) {
                return false;
            }

            if (/^none\b/i.test(item) || /^no\s+clear\s+skill\b/i.test(item) || /^not\s+identified\b/i.test(item)) {
                return false;
            }

            const lowerItem = item.toLowerCase();
            if (seen.has(lowerItem)) {
                return false;
            }

            seen.add(lowerItem);

            if (!evidenceText) {
                return true;
            }

            return evidenceLower.includes(lowerItem) || words.some((word) => evidenceLower.includes(word.toLowerCase()));
        })
        .slice(0, 3);
};

const sanitizeRecommendationList = (items) => {
    const seen = new Set();

    return toTextArray(items)
        .map((item) => normalizeInsightText(item))
        .filter((item) => {
            if (!item || item.length < 6 || item.length > 180) {
                return false;
            }

            const words = item.split(/\s+/).filter(Boolean);
            if (words.length < 3 || words.length > 18) {
                return false;
            }

            const actionablePattern = /\b(practice|revise|improve|review|focus|strengthen|study|learn|work|optimize|debug|prepare|reflect|read|build|revisit|understand|master|clarify|explore|compare|apply|handle)\b/i;
            const verdictPattern = /\b(reject|hire|select|pass|fail|strong|clear|no)\b/i;

            if (!actionablePattern.test(item) && !verdictPattern.test(item)) {
                return false;
            }

            const lowerItem = item.toLowerCase();
            if (seen.has(lowerItem)) {
                return false;
            }

            seen.add(lowerItem);
            return true;
        })
        .slice(0, 3);
};

const buildInterviewEvidence = (interview) => {
    const textParts = [
        interview?.role || "",
        ...(interview?.techStack || []),
        ...(interview?.questions || []).flatMap((question) => [
            question?.question || "",
            question?.feedback || "",
            question?.improvement || "",
        ]),
        interview?.summary || "",
        ...(interview?.strengths || []),
        ...(interview?.weaknesses || []),
    ];

    return textParts.join(" ").toLowerCase();
};

const normalizePlanText = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .replace(/[`*_]/g, "")
        .replace(/\s+/g, " ")
        .replace(/\b(?:none identified|no clear skill|not identified|not enough evidence|i do not know|dont know|did not attempt|could not answer)\b.*$/i, "")
        .trim();
};

const inferFocusTopic = (text) => {
    const normalized = normalizePlanText(text);
    const lower = normalized.toLowerCase();

    if (/(python|memory management|oop|syntax|data structures)/i.test(lower)) {
        return "Python fundamentals";
    }

    if (/(sql|mysql|mongodb|database|query|join|window function)/i.test(lower)) {
        return "SQL and database reasoning";
    }

    if (/(machine learning|ml|classification|regression|metric|roc|auc|feature engineering|model)/i.test(lower)) {
        return "Machine learning fundamentals";
    }

    if (/(nlp|genai|rag|llm|prompt|transformer|bert|embedding|vector)/i.test(lower)) {
        return "GenAI and NLP fundamentals";
    }

    if (/(api|backend|node|express|rest|system design|architecture)/i.test(lower)) {
        return "Backend API and system design";
    }

    if (/(react|frontend|javascript|ui|state|component)/i.test(lower)) {
        return "Frontend and JavaScript fundamentals";
    }

    if (/(dsa|algorithm|complexity|tree|graph|sorting|stack|queue)/i.test(lower)) {
        return "Data structures and algorithms";
    }

    if (/(communication|storytelling|clear explanation|presentation)/i.test(lower)) {
        return "Communication and structured answers";
    }

    if (normalized.length > 80) {
        return normalized.slice(0, 80).trim();
    }

    return normalized || "Core interview fundamentals";
};

const buildFallbackImprovementPlan = (interviews) => {
    if (!Array.isArray(interviews) || !interviews.length) {
        return null;
    }

    const candidates = [];
    const seen = new Set();

    for (const interview of interviews) {
        const weaknessEntries = Array.isArray(interview?.weaknesses) ? interview.weaknesses : [];
        for (const weakness of weaknessEntries) {
            const text = normalizePlanText(weakness);
            if (!text || text.length < 10 || text.length > 180) {
                continue;
            }

            const topic = inferFocusTopic(text);
            if (!seen.has(topic)) {
                seen.add(topic);
                candidates.push({ topic, detail: text });
            }
        }

        for (const question of interview?.questions || []) {
            if (!question) {
                continue;
            }

            const score = Number(question.score || 0);
            const followUpScore = Number(question.followUpScore || 0);
            const lowScore = score < 4 || followUpScore < 4;

            if (!lowScore) {
                continue;
            }

            const improvementText = normalizePlanText(question.improvement || question.feedback || "");
            if (!improvementText || improvementText.length < 10 || improvementText.length > 180) {
                continue;
            }

            const topic = inferFocusTopic(improvementText);
            if (!seen.has(topic)) {
                seen.add(topic);
                candidates.push({ topic, detail: improvementText });
            }
        }
    }

    if (!candidates.length) {
        return null;
    }

    const prioritizedTopics = candidates.slice(0, 3).map((item) => item.topic);
    const days = [];

    for (let index = 0; index < 5; index += 1) {
        const topic = prioritizedTopics[index % prioritizedTopics.length] || "Core interview fundamentals";

        if (index === 4) {
            days.push({
                day: 5,
                topic: "Final mock interview and revision",
                objective: "Consolidate your weakest areas and simulate a timed interview round with feedback-driven revisions.",
                activity: "Run one timed mock interview covering the most important skills from your recent interviews, then revise each answer using the improvement notes and weak areas you identified.",
                estimatedTime: "60 minutes",
                expectedOutcome: "You can answer high-impact questions more clearly, structure your reasoning, and reduce hesitation under time pressure.",
                completed: false,
            });
            continue;
        }

        days.push({
            day: index + 1,
            topic,
            objective: `Strengthen ${topic.toLowerCase()} using the specific feedback from your recent completed interviews.`,
            activity: `Review the weakest points from your last interview feedback, answer 3 timed questions on ${topic.toLowerCase()}, and rewrite your answers to match the improvement notes.`,
            estimatedTime: index === 0 ? "45 minutes" : "50 minutes",
            expectedOutcome: `You can explain ${topic.toLowerCase()} clearly, answer with better structure, and improve consistency in follow-up discussion.`,
            completed: false,
        });
    }

    return {
        summary: `Plan built from ${interviews.length} completed interview${interviews.length > 1 ? "s" : ""} and the strongest recurring weak areas in your feedback.`,
        focusAreas: prioritizedTopics,
        days,
    };
};



// @desc    Create Interview (Manual or Resume-based)
// @route   POST /api/interviews
// @access  Private
const createInterview = async (req, res) => {
    try {
        let { role, experience, techStack, description, interviewType } = req.body;
        let resumeText = "";
        let resumeFileName = "";

        // If a resume file is uploaded
        if (req.file) {
            interviewType = "resume";
            resumeFileName = req.file.originalname;
            resumeText = await extractTextFromResume(
                req.file.buffer,
                req.file.mimetype,
                req.file.originalname
            );

            // Default role if not provided in form
            if (!role) {
                role = "Software Engineer";
            }
            // Parse experience if provided
            experience = experience !== undefined && experience !== "" ? Number(experience) : 0;

            // Format techStack if passed as comma-separated string or array
            if (typeof techStack === "string") {
                techStack = techStack.split(",").map((t) => t.trim()).filter(Boolean);
            } else if (!Array.isArray(techStack)) {
                techStack = [];
            }
        } else {
            // Manual interview validation
            interviewType = "manual";
            if (!role || experience === undefined || !techStack) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide all required fields",
                });
            }

            if (typeof techStack === "string") {
                techStack = techStack.split(",").map((t) => t.trim()).filter(Boolean);
            }
        }

        const interview = await Interview.create({
            user: req.user._id,
            role,
            experience,
            techStack: Array.isArray(techStack) ? techStack : [],
            description: description || "",
            interviewType,
            resumeText,
            resumeFileName,
        });

        res.status(201).json({
            success: true,
            interview,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Upload & parse resume text
// @route   POST /api/interviews/upload-resume
// @access  Private
const uploadResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload a resume file",
            });
        }

        const resumeText = await extractTextFromResume(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname
        );

        res.status(200).json({
            success: true,
            fileName: req.file.originalname,
            textLength: resumeText.length,
            resumeText,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get All Interviews
// @route   GET /api/interviews
// @access  Private
const getInterviews = async (req, res) => {
    try {
        const interviews = await Interview.find({
            user: req.user._id,
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: interviews.length,
            interviews,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get Single Interview
// @route   GET /api/interviews/:id
// @access  Private

const getInterviewById = async (req, res) => {
    try {
        const interview = await Interview.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found",
            });
        }

        res.status(200).json({
            success: true,
            interview,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// @desc    Update Interview
// @route   PUT /api/interviews/:id
// @access  Private

const updateInterview = async (req, res) => {
    try {
        const interview = await Interview.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found",
            });
        }

        interview.role = req.body.role || interview.role;
        interview.experience = req.body.experience ?? interview.experience;
        interview.techStack = req.body.techStack || interview.techStack;
        interview.description =
            req.body.description || interview.description;

        const updatedInterview = await interview.save();

        res.status(200).json({
            success: true,
            interview: updatedInterview,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


const deleteInterview = async (req, res) => {
    try {

        const interview = await Interview.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found"
            });
        }

        await interview.deleteOne();

        res.status(200).json({
            success: true,
            message: "Interview deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const createResumeInterview = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload a resume PDF before creating an interview.",
            });
        }

        const { role, experience, difficulty, questionCount } = req.body;

        if (!role || experience === undefined || !difficulty || !questionCount) {
            return res.status(400).json({
                success: false,
                message: "Please provide role, experience, difficulty and question count.",
            });
        }

        const fileBuffer = req.file.buffer;

        let resumeText;
        try {
            resumeText = await extractResumeText(fileBuffer);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        const prompt = generateResumeQuestionsPrompt({
            role,
            experience: Number(experience),
            difficulty,
            questionCount: Number(questionCount),
            resumeText,
        });

        let response;
        try {
            response = await generateContent(prompt);
        } catch (error) {
            return res.status(502).json({
                success: false,
                message: "AI question generation failed. Please try again.",
            });
        }

        let questions;
        try {
            questions = parseGeminiResponse(response);
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "The AI returned an invalid interview format.",
            });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(500).json({
                success: false,
                message: "No interview questions were generated from the resume.",
            });
        }

        const formattedQuestions = questions.slice(0, Number(questionCount)).map((question) => ({
            question,
            answer: "",
            feedback: "",
            improvement: "",
            score: 0,
        }));

        const interview = await Interview.create({
            user: req.user._id,
            role,
            experience: Number(experience),
            techStack: [],
            description: `Resume-based interview generated from uploaded PDF. Difficulty: ${difficulty}.`,
            questions: formattedQuestions,
        });

        return res.status(201).json({
            success: true,
            message: "Resume-based interview created successfully",
            interview,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const generateInterviewQuestions = async (req, res) => {
    try {

        const interview = await Interview.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found"
            });
        }

        const prompt = generateInterviewQuestionsPrompt(interview);

        const response = await generateContent(prompt);

        const questions = parseGeminiResponse(response);

        if (!Array.isArray(questions)) {
            return res.status(500).json({
                success: false,
                message: "Invalid AI response"
           });
        }

        
        const formattedQuestions = questions.map((question) => ({
            question,
            answer: "",
            feedback: "",
            improvement: "",
            score: 0
        }));

        interview.questions = formattedQuestions;
        await interview.save();
        return res.status(200).json({
            success: true,
            message: "Interview questions generated successfully",
            interview
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// @desc    Submit Answer
// @route   POST /api/interviews/:id/answer
// @access  Private

const submitAnswer = async (req, res) => {
    try {

        const { questionIndex, answer } = req.body;

        // Validation
        if (questionIndex === undefined || !answer || !answer.trim()) {
            return res.status(400).json({
                success: false,
                message: "Question index and answer are required"
            });
        }

        // Find Interview
        const interview = await Interview.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found"
            });
        }

        // Validate Question Index
        if (
            questionIndex < 0 ||
            questionIndex >= interview.questions.length
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid question index"
            });
        }

        const currentQuestion = interview.questions[questionIndex];
        currentQuestion.answer = answer.trim();

        const prompt = generateEvaluationPrompt(
            currentQuestion.question,
            currentQuestion.answer
        );
        const response = await generateContent(prompt);
        const evaluation = parseGeminiResponse(response);

        // Validate minimum required AI evaluation fields
        if (
            !evaluation ||
            evaluation.score === undefined ||
            !evaluation.feedback
        ) {
            return res.status(500).json({
                success: false,
                message: "Invalid AI evaluation received"
            });
        }

        const parseScore = (val) => {
            const num = Number(val);
            return val !== null && val !== undefined && val !== "" &&
                !isNaN(num) && num >= 0 && num <= 10 ? num : null;
        };

        const parseStringArray = (val) => {
            if (Array.isArray(val)) {
                return val.map((item) => String(item).trim()).filter(Boolean);
            }
            return [];
        };

        currentQuestion.score = parseScore(evaluation.score) ?? 0;
        currentQuestion.feedback = String(evaluation.feedback || "").trim();
        currentQuestion.improvement = String(evaluation.improvement || "").trim();

        currentQuestion.technicalAccuracy = parseScore(evaluation.technicalAccuracy);
        currentQuestion.completeness = parseScore(evaluation.completeness);
        currentQuestion.clarity = parseScore(evaluation.clarity);
        currentQuestion.problemSolving = parseScore(evaluation.problemSolving);
        currentQuestion.practicalUnderstanding = parseScore(evaluation.practicalUnderstanding);

        currentQuestion.strengths = parseStringArray(evaluation.strengths);
        currentQuestion.weaknesses = parseStringArray(evaluation.weaknesses);

        let followUpQuestion = currentQuestion.followUpQuestion || null;

        if (!followUpQuestion && currentQuestion.answer.trim()) {
            const followUpPrompt = generateFollowUpQuestionPrompt({
                role: interview.role,
                experience: interview.experience,
                difficulty: interview.difficulty || "Intermediate",
                question: currentQuestion.question,
                answer: currentQuestion.answer,
            });

            const followUpResponse = await generateContent(followUpPrompt);
            const followUpData = parseGeminiResponse(followUpResponse);

            if (followUpData && followUpData.followUpQuestion) {
                followUpQuestion = String(followUpData.followUpQuestion).trim();
                currentQuestion.followUpQuestion = followUpQuestion;
            }
        }

        await interview.save();

        return res.status(200).json({
            success: true,
            message: "Answer evaluated successfully",
            question: currentQuestion,
            followUpQuestion,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const submitFollowUpAnswer = async (req, res) => {
    try {
        const { questionIndex, answer, followUpQuestion } = req.body;

        if (questionIndex === undefined || !answer || !answer.trim()) {
            return res.status(400).json({
                success: false,
                message: "Follow-up question index and answer are required",
            });
        }

        const interview = await Interview.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found",
            });
        }

        const question = interview.questions[questionIndex];
        if (!question) {
            return res.status(400).json({
                success: false,
                message: "Invalid question index",
            });
        }

        const followUpQuestionText = (followUpQuestion || question.followUpQuestion || "").trim();
        if (!followUpQuestionText) {
            return res.status(400).json({
                success: false,
                message: "No follow-up question is available for this answer.",
            });
        }

        question.followUpAnswer = answer.trim();

        const followUpPrompt = generateEvaluationPrompt(
            followUpQuestionText,
            question.followUpAnswer
        );

        const followUpResponse = await generateContent(followUpPrompt);
        const followUpEvaluation = parseGeminiResponse(followUpResponse);

        if (
            followUpEvaluation.score === undefined ||
            !followUpEvaluation.feedback
        ) {
            return res.status(500).json({
                success: false,
                message: "Invalid AI follow-up evaluation received",
            });
        }

        question.followUpScore = Number(followUpEvaluation.score);
        question.followUpFeedback = followUpEvaluation.feedback;
        question.followUpImprovement = followUpEvaluation.improvement || "";

        await interview.save();

        return res.status(200).json({
            success: true,
            message: "Follow-up answer evaluated successfully",
            question,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Complete Interview
// @route   POST /api/interviews/:id/complete
// @access  Private

const updateProctoringEvents = async (req, res) => {
    try {
        const interview = await Interview.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found",
            });
        }

        const events = Array.isArray(req.body?.events)
            ? req.body.events
            : req.body?.event
                ? [req.body.event]
                : [];

        if (!events.length) {
            return res.status(400).json({
                success: false,
                message: "No proctoring events provided",
            });
        }

        interview.proctoringEvents = [
            ...(interview.proctoringEvents || []),
            ...events.map((event) => ({
                eventType: event.eventType || "unknown",
                timestamp: event.timestamp || new Date(),
                duration: Number(event.duration || 0),
                details: event.details || "",
            })),
        ];

        await interview.save();

        return res.status(200).json({
            success: true,
            message: "Proctoring events saved successfully",
            interview,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const completeInterview = async (req, res) => {
    try {

        // Find Interview
        const interview = await Interview.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: "Interview not found"
            });
        }

        // Prevent completing twice
        if (interview.completed) {
            return res.status(400).json({
                success: false,
                message: "Interview already completed"
            });
        }

        // Check if questions exist
        if (interview.questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No interview questions found"
            });
        }

        // Make sure every question has been answered
        const unanswered = interview.questions.some(
            (question) => {
                if (!question.answer || !String(question.answer).trim()) {
                    return true;
                }

                if (question.followUpQuestion && (!question.followUpAnswer || !String(question.followUpAnswer).trim())) {
                    return true;
                }

                return false;
            }
        );

        if (unanswered) {
            return res.status(400).json({
                success: false,
                message: "Please answer all interview questions and any generated follow-up questions before completing the interview."
            });
        }

        const questionsWithFollowUps = interview.questions.filter(
            (question) => question.followUpQuestion && question.followUpAnswer
        );

        const totalScore = interview.questions.reduce(
            (sum, question) => sum + Number(question.score || 0) + Number(question.followUpScore || 0),
            0
        );

        const totalScoredQuestions = interview.questions.length + questionsWithFollowUps.length;
        const averageScore = totalScore / totalScoredQuestions;

        // Generate AI Summary Prompt
        const prompt = generateSummaryPrompt(interview.questions);

        // Ask Gemini
        const response = await generateContent(prompt);

        // Parse Gemini Response
        const summary = parseGeminiResponse(response);

        if (!summary || !summary.summary) {
            return res.status(500).json({
                success: false,
                message: "Invalid AI summary received",
            });
        }

        const evidenceText = buildInterviewEvidence(interview);
        const strongestSkills = sanitizeSkillList(summary.strongestSkills || summary.strengths || [], evidenceText);
        const weakestSkills = sanitizeSkillList(summary.weakestSkills || summary.weaknesses || [], evidenceText);
        const areasToImprove = sanitizeRecommendationList(
            summary.areasToImprove || [summary.recommendation || ""]
        );

        // Save Final Report
        interview.overallScore = Number(averageScore.toFixed(1));
        interview.summary = normalizeInsightText(summary.summary) || "Interview completed successfully.";
        interview.strengths = strongestSkills;
        interview.weaknesses = weakestSkills;
        interview.recommendation = areasToImprove[0] || "";
        interview.completed = true;

        await interview.save();

        return res.status(200).json({
            success: true,
            message: "Interview completed successfully",
            interview
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getImprovementPlan = async (req, res) => {
    try {
        const plan = await ImprovementPlan.findOne({ user: req.user._id }).sort({ createdAt: -1 });

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "No improvement plan found yet.",
            });
        }

        const completedDays = plan.days.filter((day) => day.completed).length;

        return res.status(200).json({
            success: true,
            plan,
            progress: plan.days.length ? Math.round((completedDays / plan.days.length) * 100) : 0,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const generateImprovementPlan = async (req, res) => {
    try {
        const interviews = await Interview.find({
            user: req.user._id,
            completed: true,
        }).sort({ createdAt: -1 }).limit(8);

        if (!interviews.length) {
            return res.status(400).json({
                success: false,
                message: "Complete at least one interview to generate a personalized improvement plan.",
            });
        }

        const savePlan = async (planData) => {
            if (!planData || !Array.isArray(planData.days) || planData.days.length !== 5) {
                return null;
            }

            return ImprovementPlan.findOneAndUpdate(
                { user: req.user._id },
                {
                    user: req.user._id,
                    summary: String(planData.summary || "Improvement plan based on your recent interview performance.").trim(),
                    focusAreas: (planData.focusAreas || []).slice(0, 5).map((item) => String(item).trim()).filter(Boolean),
                    days: planData.days.slice(0, 5).map((day, index) => ({
                        day: Number(day.day || index + 1),
                        topic: String(day.topic || `Day ${index + 1}`).trim(),
                        objective: String(day.objective || "Review the skill area and improve consistency.").trim(),
                        activity: String(day.activity || "Practice with focused responses and review your notes.").trim(),
                        estimatedTime: String(day.estimatedTime || "45 minutes").trim(),
                        expectedOutcome: String(day.expectedOutcome || "Improve confidence and accuracy in the targeted area.").trim(),
                        completed: Boolean(day.completed),
                    })),
                    generatedFromInterviewIds: interviews.map((interview) => interview._id),
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                    runValidators: true,
                }
            );
        };

        const questionInsights = interviews.flatMap((interview) =>
            (interview.questions || []).map((question) => ({
                question: question.question,
                score: Number(question.score || 0),
                feedback: question.feedback || "",
                improvement: question.improvement || "",
                followUpScore: Number(question.followUpScore || 0),
            }))
        );

        const overallScores = interviews
            .map((interview) => Number(interview.overallScore || 0))
            .filter((score) => Number.isFinite(score) && score > 0);

        const strengths = interviews
            .flatMap((interview) => interview.strengths || [])
            .filter(Boolean);

        const weaknesses = interviews
            .flatMap((interview) => interview.weaknesses || [])
            .filter(Boolean);

        let plan = null;

        try {
            const prompt = generateImprovementPlanPrompt({
                totalCompletedInterviews: interviews.length,
                overallScores,
                strengths,
                weaknesses,
                questionInsights,
                recommendationSummary: interviews.map((interview) => ({
                    role: interview.role,
                    overallScore: interview.overallScore,
                    recommendation: interview.recommendation || "",
                })),
            });

            const response = await generateContent(prompt);
            const payload = parseGeminiResponse(response);
            const planDays = Array.isArray(payload?.days) ? payload.days : [];

            if (payload?.summary && Array.isArray(payload?.focusAreas) && planDays.length === 5) {
                plan = await savePlan({
                    summary: payload.summary,
                    focusAreas: payload.focusAreas,
                    days: planDays,
                });
            }
        } catch (error) {
            plan = null;
        }

        if (!plan) {
            const fallbackPlan = buildFallbackImprovementPlan(interviews);

            if (!fallbackPlan) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient interview data to generate a personalized improvement plan. Complete an interview first.",
                });
            }

            plan = await savePlan(fallbackPlan);
        }

        if (!plan) {
            return res.status(500).json({
                success: false,
                message: "Unable to generate a personalized improvement plan right now.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Improvement plan generated successfully.",
            plan,
            progress: 0,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Unable to generate a personalized improvement plan right now.",
        });
    }
};

const updateImprovementPlanDay = async (req, res) => {
    try {
        const dayIndex = Number(req.params.dayIndex);
        const { completed } = req.body;

        if (!Number.isInteger(dayIndex) || dayIndex < 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid day index.",
            });
        }

        const plan = await ImprovementPlan.findOne({ user: req.user._id });

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "No improvement plan found.",
            });
        }

        if (!plan.days[dayIndex]) {
            return res.status(404).json({
                success: false,
                message: "Day not found in the improvement plan.",
            });
        }

        plan.days[dayIndex].completed = Boolean(completed);
        await plan.save();

        const completedDays = plan.days.filter((day) => day.completed).length;

        return res.status(200).json({
            success: true,
            plan,
            progress: plan.days.length ? Math.round((completedDays / plan.days.length) * 100) : 0,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    createInterview,
    uploadResume,
    createResumeInterview,
    getInterviews,
    getInterviewById,
    updateInterview,
    deleteInterview,
    generateInterviewQuestions,
    submitAnswer,
    updateProctoringEvents,
    completeInterview,
    submitFollowUpAnswer,
    getImprovementPlan,
    generateImprovementPlan,
    updateImprovementPlanDay,
};
