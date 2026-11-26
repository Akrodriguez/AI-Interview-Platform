const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("./config/db");
const User = require("./models/User");
const Interview = require("./models/Interview");

async function runEvaluationTests() {
    console.log("==================================================");
    console.log("🚀 TESTING STRUCTURED EVALUATION SCHEMA & STORAGE");
    console.log("==================================================");

    await connectDB();

    let testUser = await User.findOne({ email: "eval_test@example.com" });
    if (!testUser) {
        testUser = await User.create({
            name: "Eval Test User",
            email: "eval_test@example.com",
            password: "password123",
        });
    }

    try {
        // 1. Create a test interview with questions
        console.log("\n[1] Creating interview with sample questions...");
        const interview = await Interview.create({
            user: testUser._id,
            role: "Backend Engineer",
            experience: 3,
            techStack: ["Node.js", "MongoDB"],
            description: "System design and backend APIs",
            questions: [
                {
                    question: "Explain how MongoDB indexing works and how compound indexes differ from single-field indexes.",
                    answer: "",
                    feedback: "",
                    improvement: "",
                    score: 0,
                },
                {
                    // Existing backward-compatible question with legacy structure
                    question: "What is the event loop in Node.js?",
                    answer: "It processes asynchronous operations using libuv.",
                    feedback: "Good concise answer.",
                    improvement: "Mention microtask queue.",
                    score: 7,
                }
            ],
        });

        console.log("  Interview ID:", interview._id);

        // 2. Simulate AI structured evaluation result on Question 0
        console.log("\n[2] Applying simulated AI evaluation with 5 structured criteria...");
        const aiEvaluation = {
            technicalAccuracy: 9,
            completeness: 8,
            clarity: 9,
            problemSolving: 8,
            practicalUnderstanding: 9,
            score: 8.6,
            feedback: "Excellent understanding of B-tree data structures and prefix rule in compound indexes.",
            strengths: [
                "Accurately explained B-tree indexing in MongoDB",
                "Correctly identified the index prefix rule for compound keys"
            ],
            weaknesses: [
                "Could mention index intersection as an alternative"
            ],
            improvement: "Discuss TTL or partial indexes for specialized querying scenarios."
        };

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

        const targetQ = interview.questions[0];
        targetQ.answer = "MongoDB uses B-tree data structures for indexes. Single-field indexes index one field, while compound indexes index multiple fields following the prefix rule.";
        targetQ.score = parseScore(aiEvaluation.score) ?? 0;
        targetQ.feedback = String(aiEvaluation.feedback || "").trim();
        targetQ.improvement = String(aiEvaluation.improvement || "").trim();
        targetQ.technicalAccuracy = parseScore(aiEvaluation.technicalAccuracy);
        targetQ.completeness = parseScore(aiEvaluation.completeness);
        targetQ.clarity = parseScore(aiEvaluation.clarity);
        targetQ.problemSolving = parseScore(aiEvaluation.problemSolving);
        targetQ.practicalUnderstanding = parseScore(aiEvaluation.practicalUnderstanding);
        targetQ.strengths = parseStringArray(aiEvaluation.strengths);
        targetQ.weaknesses = parseStringArray(aiEvaluation.weaknesses);

        await interview.save();
        console.log("  ✅ Saved interview with structured evaluation.");

        // 3. Re-fetch from MongoDB to verify persistence
        console.log("\n[3] Re-fetching interview from database to verify persistence...");
        const savedInterview = await Interview.findById(interview._id);
        const q0 = savedInterview.questions[0];
        const q1 = savedInterview.questions[1];

        console.log("  Question 0 Structured Scores:");
        console.log("    - Technical Accuracy:", q0.technicalAccuracy);
        console.log("    - Completeness:", q0.completeness);
        console.log("    - Clarity:", q0.clarity);
        console.log("    - Problem Solving:", q0.problemSolving);
        console.log("    - Practical Understanding:", q0.practicalUnderstanding);
        console.log("    - Score:", q0.score);
        console.log("    - Strengths Count:", q0.strengths?.length);
        console.log("    - Weaknesses Count:", q0.weaknesses?.length);

        if (
            q0.technicalAccuracy !== 9 ||
            q0.completeness !== 8 ||
            q0.clarity !== 9 ||
            q0.problemSolving !== 8 ||
            q0.practicalUnderstanding !== 9 ||
            q0.score !== 8.6 ||
            q0.strengths.length !== 2 ||
            q0.weaknesses.length !== 1
        ) {
            throw new Error("Question 0 structured evaluation values did not match saved data");
        }
        console.log("  ✅ Question 0 structured evaluation persistence verified!");

        // 4. Verify Question 1 legacy structure remains valid (backward compatibility)
        console.log("\n[4] Verifying backward compatibility on Question 1 (legacy schema)...");
        console.log("    - Score:", q1.score);
        console.log("    - Feedback:", q1.feedback);
        console.log("    - Technical Accuracy (default):", q1.technicalAccuracy);
        console.log("    - Strengths (default):", q1.strengths);

        if (q1.score !== 7 || q1.technicalAccuracy !== null || !Array.isArray(q1.strengths)) {
            throw new Error("Question 1 backward compatibility check failed");
        }
        console.log("  ✅ Legacy questions remain 100% compatible!");

        console.log("\n==================================================");
        console.log("🎉 ALL STRUCTURED EVALUATION TESTS PASSED!");
        console.log("==================================================");
    } finally {
        await Interview.deleteMany({ user: testUser._id });
        await mongoose.connection.close();
    }
}

runEvaluationTests().catch((err) => {
    console.error("❌ Test error:", err);
    process.exit(1);
});
