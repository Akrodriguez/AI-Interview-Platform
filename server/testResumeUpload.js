const http = require("http");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { PDFDocument, StandardFonts } = require("pdf-lib");
require("dotenv").config();

const { extractTextFromResume } = require("./utils/resumeParser");
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

async function runTests() {
    console.log("==================================================");
    console.log("🚀 STARTING BACKEND RESUME UPLOAD INTEGRATION TESTS");
    console.log("==================================================");

    // 1. Extractor Unit Test
    console.log("\n[1] Testing Resume Text Extractor Unit...");
    const sampleResumePdf = await createValidPdfBuffer("Jane Doe - Senior Cloud Engineer with Kubernetes and Go experience");
    const extractedText = await extractTextFromResume(sampleResumePdf, "application/pdf", "resume.pdf");
    console.log("  Extracted output:", JSON.stringify(extractedText));
    if (!extractedText.includes("Jane Doe - Senior Cloud Engineer")) {
        throw new Error("Unit test failed: Extracted text does not match expected PDF content");
    }
    console.log("  ✅ PDF text extraction unit test passed!");

    // 2. Test Server & DB
    console.log("\n[2] Connecting to MongoDB and starting test server...");
    await connectDB();

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use("/api/interviews", interviewRoutes);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(5001, resolve));
    const baseUrl = "http://localhost:5001/api/interviews";
    console.log("  ✅ Test server running on port 5001");

    // 3. User & Auth
    let testUser = await User.findOne({ email: "resume_test@example.com" });
    if (!testUser) {
        testUser = await User.create({
            name: "Resume Test User",
            email: "resume_test@example.com",
            password: "password123",
        });
    }

    const token = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const authHeaders = {
        Authorization: `Bearer ${token}`,
    };

    try {
        // 4. Standalone Resume Upload
        console.log("\n[3] Testing POST /api/interviews/upload-resume with valid PDF...");
        const multipart1 = buildMultipartPayload({}, {
            name: "resume",
            filename: "Jane_Doe_Resume.pdf",
            contentType: "application/pdf",
            buffer: sampleResumePdf,
        });

        const res1 = await fetch(`${baseUrl}/upload-resume`, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": multipart1.contentType,
            },
            body: multipart1.body,
        });
        const data1 = await res1.json();
        console.log("  Status:", res1.status, "| Response:", data1);
        if (res1.status !== 200 || !data1.success || !data1.resumeText.includes("Jane Doe")) {
            throw new Error(`Upload-resume endpoint failed: ${JSON.stringify(data1)}`);
        }
        console.log("  ✅ POST /api/interviews/upload-resume succeeded!");

        // 5. Direct Resume Interview Creation
        console.log("\n[4] Testing POST /api/interviews with multipart resume upload...");
        const multipart2 = buildMultipartPayload(
            {
                role: "Cloud Architect",
                experience: "5",
                techStack: "AWS, Kubernetes, Terraform",
                description: "Focus on cloud infrastructure",
            },
            {
                name: "resume",
                filename: "Cloud_Architect_Resume.pdf",
                contentType: "application/pdf",
                buffer: sampleResumePdf,
            }
        );

        const res2 = await fetch(`${baseUrl}`, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": multipart2.contentType,
            },
            body: multipart2.body,
        });
        const data2 = await res2.json();
        console.log("  Status:", res2.status, "| Created Interview ID:", data2.interview?._id);
        if (
            res2.status !== 201 ||
            !data2.success ||
            data2.interview.interviewType !== "resume" ||
            !data2.interview.resumeText.includes("Jane Doe") ||
            data2.interview.resumeFileName !== "Cloud_Architect_Resume.pdf"
        ) {
            throw new Error(`Multipart create interview failed: ${JSON.stringify(data2)}`);
        }
        console.log("  ✅ Multipart create interview succeeded with resume metadata!");

        // 6. Invalid file extension rejection
        console.log("\n[5] Testing Security Validation: Invalid file extension/MIME rejection (.txt)...");
        const multipartInvalid = buildMultipartPayload(
            { role: "Tester" },
            {
                name: "resume",
                filename: "malicious.txt",
                contentType: "text/plain",
                buffer: Buffer.from("Hello world text file"),
            }
        );

        const res3 = await fetch(`${baseUrl}/upload-resume`, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": multipartInvalid.contentType,
            },
            body: multipartInvalid.body,
        });
        const data3 = await res3.json();
        console.log("  Status:", res3.status, "| Response:", data3);
        if (res3.status !== 400 || data3.success !== false) {
            throw new Error(`Security validation failed: Expected 400 rejection, got ${res3.status}`);
        }
        console.log("  ✅ Invalid file type correctly rejected with 400 Bad Request!");

        // 7. File size limit validation (>5MB)
        console.log("\n[6] Testing Security Validation: File size limit (>5MB)...");
        const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
        const multipartLarge = buildMultipartPayload(
            {},
            {
                name: "resume",
                filename: "huge_resume.pdf",
                contentType: "application/pdf",
                buffer: largeBuffer,
            }
        );

        const res4 = await fetch(`${baseUrl}/upload-resume`, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": multipartLarge.contentType,
            },
            body: multipartLarge.body,
        });
        const data4 = await res4.json();
        console.log("  Status:", res4.status, "| Response:", data4);
        if (res4.status !== 400 || data4.success !== false || !data4.message.includes("5MB")) {
            throw new Error(`Size limit validation failed: Expected 400 rejection, got ${res4.status}`);
        }
        console.log("  ✅ Oversized file correctly rejected with 400 Bad Request!");

        // 8. Backward Compatibility for JSON manual creation
        console.log("\n[7] Testing Backward Compatibility: Standard JSON manual interview creation...");
        const res5 = await fetch(`${baseUrl}`, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                role: "Frontend Developer",
                experience: 3,
                techStack: ["React", "CSS", "TypeScript"],
                description: "Standard manual creation test",
            }),
        });
        const data5 = await res5.json();
        console.log("  Status:", res5.status, "| Interview ID:", data5.interview?._id);
        if (
            res5.status !== 201 ||
            !data5.success ||
            data5.interview.interviewType !== "manual"
        ) {
            throw new Error(`Manual JSON creation failed: ${JSON.stringify(data5)}`);
        }
        console.log("  ✅ Standard manual JSON creation continues to work smoothly!");

        console.log("\n==================================================");
        console.log("🎉 ALL RESUME UPLOAD INTEGRATION TESTS PASSED!");
        console.log("==================================================");
    } finally {
        await Interview.deleteMany({ user: testUser._id });
        server.close();
        await mongoose.connection.close();
    }
}

runTests().catch((err) => {
    console.error("\n❌ Test suite failed with error:", err);
    process.exit(1);
});
