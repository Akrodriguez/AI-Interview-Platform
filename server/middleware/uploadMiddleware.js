const multer = require("multer");
const path = require("path");

// Memory storage to process files directly from buffer
const storage = multer.memoryStorage();

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
];

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc"];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const isExtValid = ALLOWED_EXTENSIONS.includes(ext);

    if (isMimeValid && isExtValid) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Invalid file type. Only PDF and Word documents (.pdf, .docx, .doc) are allowed."
            ),
            false
        );
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB max
    },
    fileFilter,
});

// Middleware wrapper to catch Multer errors and format clean JSON responses
const handleResumeUpload = (req, res, next) => {
    const uploadSingle = upload.single("resume");

    uploadSingle(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    success: false,
                    message: "File size exceeds the 5MB limit.",
                });
            }
            return res.status(400).json({
                success: false,
                message: `Upload error: ${err.message}`,
            });
        } else if (err) {
            return res.status(400).json({
                success: false,
                message: err.message,
            });
        }
        next();
    });
};

module.exports = {
    handleResumeUpload,
};
