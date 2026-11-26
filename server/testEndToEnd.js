const http = require("http");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { PDFDocument, StandardFonts } = require("pdf-lib");
require("dotenv").config();

const connectDB = require("./config/db");
const User = require("./models/User");
const Interview = require("./models/Interview");
const interviewRoutes = require("./routes/interviewRoutes");

async function createValidPdfBuffer(text) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText(text, {
        x: 50,
        y: 750,
        size: 14,
        font,
    });
    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(pdfBytes);
}

function buildMultipartPayload(fields, fileField) {
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    const chunks = [];

    for (const [key, value] of Object.entries(fields)) {
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    }

    if (fileField) {
        chunks.push(
            Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType}\r\n\r\n`
            )
        );
        chunks.push(fileField.buffer);
        chunks.push(Buffer.from("\r\n"));
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(chunks);
    return {
        boundary,
        body,
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}

async function testFrontendBackendIntegration() {
    console.log("==================================================");
    console.log("🚀 TESTING MANUAL & RESUME-BASED INTERVIEW FLOWS");
    console.log("==================================================");

    await connectDB();

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use("/api/interviews", interviewRoutes);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(5002, resolve));
    const baseUrl = "http://localhost:5002/api/interviews";

    let testUser = await User.findOne({ email: "frontend_test@example.com" });
    if (!testUser) {
        testUser = await User.create({
            name: "Frontend Test User",
            email: "frontend_test@example.com",
            password: "password123",
        });
    }

    const token = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const authHeaders = {
        Authorization: `Bearer ${token}`,
    };

    try {
        // 1. Test Manual Creation Flow (exact payload sent when no resume is attached)
        console.log("\n[Test 1] Testing Standard Manual Interview Creation...");
        const manualPayload = {
            role: "Backend Engineer",
            experience: 4,
            techStack: ["Node.js", "Express", "PostgreSQL"],
            description: "Distributed systems and caching",
        };

        const resManual = await fetch(baseUrl, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(manualPayload),
        });

        const dataManual = await resManual.json();
        console.log("  Status:", resManual.status, "| ID:", dataManual.interview?._id);
        if (
            resManual.status !== 201 ||
            !dataManual.success ||
            dataManual.interview.interviewType !== "manual" ||
            dataManual.interview.role !== "Backend Engineer" ||
            dataManual.interview.techStack.length !== 3
        ) {
            throw new Error(`Manual creation failed: ${JSON.stringify(dataManual)}`);
        }
        console.log("  ✅ Manual interview creation passed seamlessly!");

        // 2. Test Resume-Based Creation Flow (FormData payload sent when a resume is attached)
        console.log("\n[Test 2] Testing Resume-Based Interview Creation with FormData...");
        const pdfContent = "Alice Smith - Lead AI Engineer with Python, PyTorch, LangChain, and RAG pipelines experience.";
        const resumePdf = await createValidPdfBuffer(pdfContent);

        const resumeMultipart = buildMultipartPayload(
            {
                role: "AI Engineer",
                experience: "3",
                techStack: "Python, PyTorch, LangChain",
                description: "LLM application architecture and RAG",
            },
            {
                name: "resume",
                filename: "Alice_Smith_Resume.pdf",
                contentType: "application/pdf",
                buffer: resumePdf,
            }
        );

        const resResume = await fetch(baseUrl, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": resumeMultipart.contentType,
            },
            body: resumeMultipart.body,
        });

        const dataResume = await resResume.json();
        console.log("  Status:", resResume.status, "| ID:", dataResume.interview?._id);
        console.log("  Interview Type:", dataResume.interview?.interviewType);
        console.log("  Parsed Resume Text:", JSON.stringify(dataResume.interview?.resumeText));

        if (
            resResume.status !== 201 ||
            !dataResume.success ||
            dataResume.interview.interviewType !== "resume" ||
            !dataResume.interview.resumeText.includes("Alice Smith") ||
            dataResume.interview.resumeFileName !== "Alice_Smith_Resume.pdf" ||
            dataResume.interview.techStack.length !== 3
        ) {
            throw new Error(`Resume-based creation failed: ${JSON.stringify(dataResume)}`);
        }
        console.log("  ✅ Resume-based interview creation with FormData passed seamlessly!");

        console.log("\n==================================================");
        console.log("🎉 BOTH MANUAL & RESUME-BASED FLOWS VERIFIED 100%!");
        console.log("==================================================");
    } finally {
        await Interview.deleteMany({ user: testUser._id });
        server.close();
        await mongoose.connection.close();
    }
}

testFrontendBackendIntegration().catch((err) => {
    console.error("❌ Test error:", err);
    process.exit(1);
});
