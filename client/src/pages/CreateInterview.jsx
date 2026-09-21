import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

const CreateInterview = () => {
    const [role, setRole] = useState("");
    const [experience, setExperience] = useState("");
    const [techStack, setTechStack] = useState("");
    const [description, setDescription] = useState("");
    const [resumeFile, setResumeFile] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");

        const technologies = techStack
            .split(",")
            .map((tech) => tech.trim())
            .filter((tech) => tech !== "");

        if (technologies.length === 0) {
            setError("Please enter at least one technology.");
            return;
        }

        try {
            setLoading(true);

            let response;
            if (resumeFile) {
                const formData = new FormData();
                formData.append("role", role);
                formData.append("experience", experience);
                formData.append("techStack", technologies.join(", "));
                formData.append("description", description);
                formData.append("resume", resumeFile);

                response = await api.post("/interviews", formData, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                });
            } else {
                response = await api.post("/interviews", {
                    role,
                    experience: Number(experience),
                    techStack: technologies,
                    description,
                });
            }

            const interviewId = response.data.interview._id;

            navigate(`/interview/${interviewId}`);

        } catch (error) {
            setError(
                error.response?.data?.message ||
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
                        Configure an AI-powered interview based
                        on your experience and tech stack.
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

                    <form onSubmit={handleSubmit}>

                        <div className="form-group">
                            <label htmlFor="role">
                                Job Role
                            </label>

                            <input
                                id="role"
                                type="text"
                                placeholder="e.g. Software Engineer"
                                value={role}
                                onChange={(e) =>
                                    setRole(e.target.value)
                                }
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="experience">
                                Years of Experience
                            </label>

                            <input
                                id="experience"
                                type="number"
                                min="0"
                                max="50"
                                placeholder="e.g. 2"
                                value={experience}
                                onChange={(e) =>
                                    setExperience(e.target.value)
                                }
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="techStack">
                                Tech Stack
                            </label>

                            <input
                                id="techStack"
                                type="text"
                                placeholder="React, Node.js, MongoDB, JavaScript"
                                value={techStack}
                                onChange={(e) =>
                                    setTechStack(e.target.value)
                                }
                                required
                            />

                            <span className="form-hint">
                                Separate technologies using commas.
                            </span>
                        </div>

                        <div className="form-group">
                            <label htmlFor="resume">
                                Resume (Optional - PDF, DOC, DOCX)
                            </label>

                            <input
                                id="resume"
                                type="file"
                                accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        if (file.size > 5 * 1024 * 1024) {
                                            setError("Resume file size must not exceed 5MB.");
                                            e.target.value = "";
                                            setResumeFile(null);
                                            return;
                                        }
                                        setError("");
                                        setResumeFile(file);
                                    } else {
                                        setResumeFile(null);
                                    }
                                }}
                            />

                            <span className="form-hint">
                                Attach your resume to generate customized questions targeting your projects and experience.
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
                                onChange={(e) =>
                                    setDescription(e.target.value)
                                }
                            />
                        </div>

                        <div className="form-actions">

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading
                                    ? "Creating..."
                                    : "Create Interview"}
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