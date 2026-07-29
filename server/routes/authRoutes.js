const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const {
    registerUser,
    loginUser,
    getProfile
} = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);

module.exports = router;