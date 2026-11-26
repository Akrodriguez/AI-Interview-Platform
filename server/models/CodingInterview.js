const mongoose = require("mongoose");

// Sub-schema for each coding problem within an interview session
const codingProblemSchema = new mongoose.Schema(
    {
        // The problem statement generated or provided
        problem: {
            type: String,
            required: true,
        },

        // Brief title / name for the problem
        title: {
            type: String,
            default: "",
        },

        // Starter code template provided to the candidate (language-specific)
        starterCode: {
            type: String,
            default: "",
        },

        // Example test cases displayed alongside the problem
        exampleInput: {
            type: String,
            default: "",
        },

        exampleOutput: {
            type: String,
            default: "",
        },

        // Candidate's current / last-submitted solution code
        solution: {
            type: String,
            default: "",
        },

        // Optional custom stdin the candidate can supply for test runs
        customInput: {
            type: String,
            default: "",
        },

        // ----- Execution Results (Stage 2 fields — null until Judge0 is added) -----
        stdout: {
            type: String,
            default: null,
        },

        stderr: {
            type: String,
            default: null,
        },

        compileOutput: {
            type: String,
            default: null,
        },

        execTime: {
            type: String,
            default: null,
        },

        memoryUsed: {
            type: Number,
            default: null,
        },

        execStatus: {
            type: String,
            default: null,
        },

        // ----- AI Evaluation Fields (Stage 3 — null until AI eval is added) -----
        score: {
            type: Number,
            default: 0,
        },

        feedback: {
            type: String,
            default: "",
        },

        codeQuality: {
            type: Number,
            default: null,
        },

        correctness: {
            type: Number,
            default: null,
        },

        efficiency: {
            type: Number,
            default: null,
        },

        strengths: [{ type: String }],

        weaknesses: [{ type: String }],

        improvement: {
            type: String,
            default: "",
        },

        // Whether the candidate has submitted this problem
        submitted: {
            type: Boolean,
            default: false,
        },
    },
    {
        _id: false,
    }
);

// Top-level schema for a Coding Interview session
const codingInterviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Human-readable title (e.g. "Python Coding Interview – 3 Problems")
        title: {
            type: String,
            default: "",
        },

        // Difficulty level selected at creation time
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            default: "medium",
        },

        // Primary language for this session
        language: {
            type: String,
            enum: ["python", "javascript", "cpp"],
            default: "python",
        },

        // Role / context (e.g. "Backend Engineer") used to tailor problems
        role: {
            type: String,
            default: "",
        },

        // Topic focus (e.g. "arrays", "graphs", "system design")
        topic: {
            type: String,
            default: "",
        },

        // Number of problems requested at creation time
        problemCount: {
            type: Number,
            default: 3,
            min: 1,
            max: 10,
        },

        // Ordered list of coding problems
        problems: [codingProblemSchema],

        // ----- Proctoring & Anti-Cheating Fields -----
        proctoringEnabled: {
            type: Boolean,
            default: true,
        },

        tabSwitchCount: {
            type: Number,
            default: 0,
        },

        noFaceDetectedCount: {
            type: Number,
            default: 0,
        },

        multipleFaceDetectedCount: {
            type: Number,
            default: 0,
        },

        copyAttemptCount: {
            type: Number,
            default: 0,
        },

        pasteAttemptCount: {
            type: Number,
            default: 0,
        },

        cutAttemptCount: {
            type: Number,
            default: 0,
        },

        dragDropAttemptCount: {
            type: Number,
            default: 0,
        },

        fullscreenExitCount: {
            type: Number,
            default: 0,
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
                count: {
                    type: Number,
                    default: 1,
                },
                message: {
                    type: String,
                    default: "",
                },
                details: {
                    type: String,
                    default: "",
                },
            },
        ],

        // ----- Final Report (populated when interview is completed) -----
        overallScore: {
            type: Number,
            default: null,
        },

        summary: {
            type: String,
            default: "",
        },

        recommendation: {
            type: String,
            default: "",
        },

        // Whether the session has been finished and a report generated
        completed: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("CodingInterview", codingInterviewSchema);
