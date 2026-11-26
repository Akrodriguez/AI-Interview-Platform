const mongoose = require("mongoose");

// Question Sub Schema
const questionSchema = new mongoose.Schema(
    {
        question: {
            type: String,
            required: true,
        },

        answer: {
            type: String,
            default: "",
        },

        feedback: {
            type: String,
            default: "",
        },

        improvement: {
            type: String,
            default: "",
        },

        score: {
            type: Number,
            default: 0,
        },


        technicalAccuracy: {
            type: Number,
            default: null,
        },

        completeness: {
            type: Number,
            default: null,
        },

        clarity: {
            type: Number,
            default: null,
        },

        problemSolving: {
            type: Number,
            default: null,
        },

        practicalUnderstanding: {
            type: Number,
            default: null,
        },

        strengths: [
            {
                type: String,
            },
        ],

        weaknesses: [
            {
                type: String,
            },
        ],

        followUpQuestion: {
            type: String,
            default: "",
        },

        followUpAnswer: {
            type: String,
            default: "",
        },

        followUpScore: {
            type: Number,
            default: 0,
        },

        followUpFeedback: {
            type: String,
            default: "",
        },

        followUpImprovement: {
            type: String,
            default: "",
        },

    },
    {
        _id: false,
    }
);

// Interview Schema
const interviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        interviewType: {
            type: String,
            enum: ["manual", "resume"],
            default: "manual",
        },

        resumeText: {
            type: String,
            default: "",
        },

        resumeFileName: {
            type: String,
            default: "",
        },

        role: {
            type: String,
            required: true,
            default: "Software Engineer",
        },

        experience: {
            type: Number,
            default: 0,
        },

        techStack: [
            {
                type: String,
            },
        ],

        description: {
            type: String,
            default: "",
        },

        // AI Generated Questions
        questions: [questionSchema],

        // Final Interview Report
        overallScore: {
            type: Number,
            default: null,
        },

        summary: {
            type: String,
            default: "",
        },

        strengths: [
            {
                type: String,
            },
        ],

        weaknesses: [
            {
                type: String,
            },
        ],

        recommendation: {
            type: String,
            default: "",
        },

        proctoringEvents: [
            {
                eventType: {
                    type: String,
                    required: true,
                },
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
                duration: {
                    type: Number,
                    default: 0,
                },
                details: {
                    type: String,
                    default: "",
                },
            },
        ],

        completed: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Interview", interviewSchema);