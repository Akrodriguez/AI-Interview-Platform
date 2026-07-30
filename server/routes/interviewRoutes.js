const express = require("express");

const router = express.Router();

const {
    createInterview,
    getInterviews,
    getInterviewById,
    updateInterview,
    deleteInterview,
    generateInterviewQuestions
} = require("../controllers/interviewController");

const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, createInterview);
router.get("/", protect, getInterviews);
router.get("/:id", protect, getInterviewById);
router.put("/:id", protect, updateInterview);
router.delete("/:id", protect, deleteInterview);
router.post("/:id/generate", protect, generateInterviewQuestions);

module.exports = router;