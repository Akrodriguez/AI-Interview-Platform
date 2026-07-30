const { generateContent } = require("../services/aiService");
const {
    generateInterviewQuestionsPrompt
} = require("../prompts/interviewPrompts");
const Interview = require("../models/Interview");
const ai = require("../services/aiService");

// @desc    Create Interview
// @route   POST /api/interviews
// @access  Private
const createInterview = async (req, res) => {
    try {
        const { role, experience, techStack, description } = req.body;

        // Validation
        if (!role || experience === undefined || !techStack) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields",
            });
        }

        const interview = await Interview.create({
            user: req.user._id,
            role,
            experience,
            techStack,
            description,
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
        const cleanedResponse = response
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const questions = JSON.parse(cleanedResponse);

        console.log(questions);
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

module.exports = {
    createInterview,
    getInterviews,
    getInterviewById,
    updateInterview,
    deleteInterview,
    generateInterviewQuestions
};
