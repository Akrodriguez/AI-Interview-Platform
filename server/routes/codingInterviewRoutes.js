const express = require("express");

const router = express.Router();

const {
    createCodingInterview,
    getCodingInterviews,
    getCodingInterviewById,
    generateProblems,
    saveCode,
    runCode,
    submitSolution,
    deleteCodingInterview,
} = require("../controllers/codingInterviewController");

const { protect } = require("../middleware/authMiddleware");

// All routes are protected — user must be authenticated
router.post("/", protect, createCodingInterview);

router.get("/", protect, getCodingInterviews);

router.get("/:id", protect, getCodingInterviewById);

router.post("/:id/generate", protect, generateProblems);

router.post("/:id/save-code", protect, saveCode);

router.post("/:id/run", protect, runCode);

router.post("/:id/submit", protect, submitSolution);

router.delete("/:id", protect, deleteCodingInterview);

module.exports = router;
