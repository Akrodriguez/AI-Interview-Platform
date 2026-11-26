
const express = require("express");

const router = express.Router();

const {
    createInterview,
    uploadResume,
    createResumeInterview,
    getInterviews,
    getInterviewById,
    updateInterview,
    deleteInterview,
    generateInterviewQuestions,
    submitAnswer,
    submitFollowUpAnswer,
    updateProctoringEvents,
    completeInterview,
    getImprovementPlan,
    generateImprovementPlan,
    updateImprovementPlanDay,
} = require("../controllers/interviewController");

const { protect } = require("../middleware/authMiddleware");
const { handleResumeUpload } = require("../middleware/uploadMiddleware");
const { upload } = require("../middleware/upload");

router.post("/", protect, handleResumeUpload, createInterview);

router.post("/upload-resume", protect, handleResumeUpload, uploadResume);

router.post("/resume", protect, upload.single("resume"), createResumeInterview);

router.get("/", protect, getInterviews);
router.get("/improvement-plan", protect, getImprovementPlan);
router.post("/improvement-plan/generate", protect, generateImprovementPlan);
router.patch("/improvement-plan/:dayIndex", protect, updateImprovementPlanDay);

router.post("/:id/generate", protect, generateInterviewQuestions);

router.post("/:id/answer", protect, submitAnswer);
router.post("/:id/follow-up-answer", protect, submitFollowUpAnswer);

router.post("/:id/proctoring", protect, updateProctoringEvents);

router.post("/:id/complete", protect, completeInterview);

router.get("/:id", protect, getInterviewById);

router.put("/:id", protect, updateInterview);

router.delete("/:id", protect, deleteInterview);

module.exports = router;
