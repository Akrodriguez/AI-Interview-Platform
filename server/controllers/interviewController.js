const { generateContent } = require("../services/aiService");
const {
    generateInterviewQuestionsPrompt,
    generateEvaluationPrompt,
    generateSummaryPrompt
} = require("../prompts/interviewPrompts");
const Interview = require("../models/Interview");
const parseGeminiResponse = require("../utils/parseGeminiResponse");
const { extractTextFromResume } = require("../utils/resumeParser");


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
        if (questionIndex === undefined || !answer) {
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

        // Save User Answer (Not Saved to DB Yet)
        interview.questions[questionIndex].answer = answer;
        const prompt = generateEvaluationPrompt(
            interview.questions[questionIndex].question,
            answer
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
            return !isNaN(num) && num >= 0 && num <= 10 ? num : null;
        };

        const parseStringArray = (val) => {
            if (Array.isArray(val)) {
                return val.map((item) => String(item).trim()).filter(Boolean);
            }
            return [];
        };

        const currentQuestion = interview.questions[questionIndex];

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

        await interview.save();

        return res.status(200).json({
            success: true,
            message: "Answer evaluated successfully",
            question: currentQuestion
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Complete Interview
// @route   POST /api/interviews/:id/complete
// @access  Private

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
            (question) => !question.answer.trim()
        );

        if (unanswered) {
            return res.status(400).json({
                success: false,
                message: "Please answer all interview questions before completing the interview."
            });
        }

        // Calculate Average Score
        const totalScore = interview.questions.reduce(
            (sum, question) => sum + question.score,
            0
        );

        const averageScore = totalScore / interview.questions.length;

        // Generate AI Summary Prompt
        const prompt = generateSummaryPrompt(interview.questions);

        // Ask Gemini
        const response = await generateContent(prompt);

        // Parse Gemini Response
        const summary = parseGeminiResponse(response);

        // Validate AI Response
        if (
            !summary.summary ||
            !Array.isArray(summary.strengths) ||
            !Array.isArray(summary.weaknesses) ||
            !summary.recommendation
        ) {
            return res.status(500).json({
                success: false,
                message: "Invalid AI summary received"
            });
        }

        // Save Final Report
        interview.overallScore = Number(averageScore.toFixed(1));
        interview.summary = summary.summary;
        interview.strengths = summary.strengths;
        interview.weaknesses = summary.weaknesses;
        interview.recommendation = summary.recommendation;
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

module.exports = {
    createInterview,
    uploadResume,
    getInterviews,
    getInterviewById,
    updateInterview,
    deleteInterview,
    generateInterviewQuestions,
    submitAnswer,
    completeInterview
};
