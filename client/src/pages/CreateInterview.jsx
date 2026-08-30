import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const CreateInterview = () => {
    const [role, setRole] = useState("");
    const [experience, setExperience] = useState("");
    const [techStack, setTechStack] = useState("");
    const [description, setDescription] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);

        try {
            const response = await api.post("/interviews", {
                role,
                experience: Number(experience),
                techStack: techStack
                    .split(",")
                    .map((item) => item.trim())
                    .filter((item) => item !== ""),
                description
            });

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
        <div>
            <h1>Create Interview</h1>

            {error && <p>{error}</p>}

            <form onSubmit={handleSubmit}>

                <div>
                    <label>Role</label>

                    <input
                        type="text"
                        placeholder="e.g. Backend Developer"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label>Experience</label>

                    <input
                        type="number"
                        min="0"
                        placeholder="e.g. 2"
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label>Tech Stack</label>

                    <input
                        type="text"
                        placeholder="Node.js, Express, MongoDB, JWT"
                        value={techStack}
                        onChange={(e) => setTechStack(e.target.value)}
                        required
                    />

                    <small>
                        Separate technologies using commas
                    </small>
                </div>

                <div>
                    <label>Description</label>

                    <textarea
                        placeholder="Describe the interview..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create Interview"}
                </button>

            </form>
        </div>
    );
};

export default CreateInterview;