import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

const CreateInterview = () => {
    const [mode, setMode] = useState("manual");
    const [role, setRole] = useState("");
    const [experience, setExperience] = useState("");
    const [difficulty, setDifficulty] = useState("Intermediate");
    const [questionCount, setQuestionCount] = useState("10");
    const [techStack, setTechStack] = useState("");
    const [description, setDescription] = useState("");
    const [resumeFile, setResumeFile] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const handleManualSubmit = async () => {
        const technologies = techStack
            .split(",")
            .map((tech) => tech.trim())
            .filter((tech) => tech !== "");

        if (technologies.length === 0) {
            throw new Error("Please enter at least one technology.");
        }

        const response = await api.post("/interviews", {
            role,
            experience: Number(experience),
            techStack: technologies,
            description,
        });

        return response.data.interview._id;
    };

    const handleResumeSubmit = async () => {
        if (!resumeFile) {
            throw new Error("Please upload a PDF resume before creating the interview.");
        }

        const formData = new FormData();
        formData.append("resume", resumeFile);
        formData.append("role", role);
        formData.append("experience", Number(experience));
        formData.append("difficulty", difficulty);
        formData.append("questionCount", Number(questionCount));

        const response = await api.post("/interviews/resume", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        return response.data.interview._id;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");

        if (!role.trim()) {
            setError("Please enter a target job role.");
            return;
        }

        if (experience === "" || Number(experience) < 0) {
            setError("Please enter a valid experience value.");
            return;
        }

        if (mode === "manual" && !techStack.trim()) {
            setError("Please enter at least one technology.");
            return;
        }

        if (mode === "resume" && !resumeFile) {
            setError("Please upload a resume PDF.");
            return;
        }

        try {
            setLoading(true);

            const interviewId = mode === "manual"
                ? await handleManualSubmit()
                : await handleResumeSubmit();

            navigate(`/interview/${interviewId}`);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                error.message ||
                "Failed to create interview"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container">

            <div className="page-header">
                <div>
                    <h1>Create Interview</h1>

                    <p>
                        Configure an AI-powered interview based on your target role and background.
                    </p>
                </div>

                <Link
                    to="/dashboard"
                    className="btn btn-secondary"
                >
                    ← Dashboard
                </Link>
            </div>

            <div className="form-container">

                <div className="form-card">

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <div className="mode-toggle">
                        <button
                            type="button"
                            className={mode === "manual" ? "mode-option active" : "mode-option"}
                            onClick={() => setMode("manual")}
                        >
                            Manual Interview
                        </button>

                        <button
                            type="button"
                            className={mode === "resume" ? "mode-option active" : "mode-option"}
                            onClick={() => setMode("resume")}
                        >
                            Resume-Based Interview
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>

                        <div className="form-group">
                            <label htmlFor="role">
                                Target Job Role
                            </label>

                            <input
                                id="role"
                                type="text"
                                placeholder="e.g. Frontend Developer"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="experience">
                                Experience Level (Years)
                            </label>

                            <input
                                id="experience"
                                type="number"
                                min="0"
                                max="50"
                                placeholder="e.g. 2"
                                value={experience}
                                onChange={(e) => setExperience(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="difficulty">
                                Interview Difficulty
                            </label>

                            <select
                                id="difficulty"
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="select-input"
                            >
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
                            </select>
                        </div>
                        {mode === "resume" && (
                            <div className="form-group">
                                <label htmlFor="resume">
                                    Resume (PDF, DOC, or DOCX)
                                </label>

                                <input
                                    id="resume"
                                    type="file"
                                    accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];

                                        if (file && file.size > 5 * 1024 * 1024) {
                                            setError("Resume file size must not exceed 5MB.");
                                            e.target.value = "";
                                            setResumeFile(null);
                                            return;
                                        }

                                        setError("");
                                        setResumeFile(file || null);
                                    }}
                                />

                                <span className="form-hint">
                                    Upload your resume to generate personalized interview questions.
                                </span>

                                {resumeFile && (
                                    <div className="resume-file-name">
                                        Selected file: {resumeFile.name}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="questionCount">
                                Number of Questions
                            </label>

                            <select
                                id="questionCount"
                                value={questionCount}
                                onChange={(e) => setQuestionCount(e.target.value)}
                                className="select-input"
                            >
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="15">15</option>
                            </select>
                        </div>

                        {mode === "manual" && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="techStack">
                                        Tech Stack
                                    </label>

                                    <input
                                        id="techStack"
                                        type="text"
                                        placeholder="React, Node.js, MongoDB, JavaScript"
                                        value={techStack}
                                        onChange={(e) => setTechStack(e.target.value)}
                                    />

                                    <span className="form-hint">
                                        Separate technologies using commas.
                                    </span>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="description">
                                        Interview Description
                                    </label>

                                    <textarea
                                        id="description"
                                        placeholder="Describe what you want to focus on..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>
                            </>
                        )}


                        <div className="form-actions">

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading
                                    ? "Creating..."
                                    : mode === "manual"
                                        ? "Create Interview"
                                        : "Create Resume Interview"}
                            </button>

                            <Link
                                to="/dashboard"
                                className="btn btn-secondary"
                            >
                                Cancel
                            </Link>

                        </div>

                    </form>

                </div>

            </div>

        </div>
    );
};

export default CreateInterview;
