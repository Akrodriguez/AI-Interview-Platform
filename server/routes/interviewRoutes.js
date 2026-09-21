const express = require("express");

const router = express.Router();

const {
    createInterview,
    uploadResume,
    getInterviews,
    getInterviewById,
    updateInterview,
    deleteInterview,
    generateInterviewQuestions,
    submitAnswer,
    completeInterview
} = require("../controllers/interviewController");

const { protect } = require("../middleware/authMiddleware");
const { handleResumeUpload } = require("../middleware/uploadMiddleware");

router.post("/", protect, handleResumeUpload, createInterview);

router.post("/upload-resume", protect, handleResumeUpload, uploadResume);

router.get("/", protect, getInterviews);

router.post("/:id/generate", protect, generateInterviewQuestions);

router.post("/:id/answer", protect, submitAnswer);

router.post("/:id/complete", protect, completeInterview);

router.get("/:id", protect, getInterviewById);

router.put("/:id", protect, updateInterview);

router.delete("/:id", protect, deleteInterview);

module.exports = router;