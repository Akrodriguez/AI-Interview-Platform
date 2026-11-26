import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

const DIFFICULTY_OPTIONS = [
    { value: "easy", label: "Easy", description: "Basic algorithms and data structures" },
    { value: "medium", label: "Medium", description: "Intermediate problem solving" },
    { value: "hard", label: "Hard", description: "Advanced algorithms and optimization" },
];

const LANGUAGE_OPTIONS = [
    { value: "python", label: "Python 3", icon: "🐍" },
    { value: "javascript", label: "JavaScript", icon: "🟨" },
    { value: "cpp", label: "C++", icon: "⚙️" },
];

const PROBLEM_COUNT_OPTIONS = [1, 2, 3, 5];

const CreateCodingInterview = () => {
    const [role, setRole] = useState("");
    const [topic, setTopic] = useState("");
    const [difficulty, setDifficulty] = useState("medium");
    const [language, setLanguage] = useState("python");
    const [problemCount, setProblemCount] = useState(3);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            setLoading(true);
            const response = await api.post("/coding-interviews", {
                role,
                topic,
                difficulty,
                language,
                problemCount: Number(problemCount),
            });

            const interviewId = response.data.codingInterview._id;
            navigate(`/coding-interview/${interviewId}`);
        } catch (err) {
            setError(
                err.response?.data?.message || "Failed to create coding interview."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container">

            <div className="page-header">
                <div>
                    <h1>Create Coding Interview</h1>
                    <p>Set up a hands-on coding session with a live code editor.</p>
                </div>

                <Link to="/dashboard" className="btn btn-secondary">
                    ← Dashboard
                </Link>
            </div>

            <div className="form-container">
                <div className="form-card">

                    {error && (
                        <div className="error-message">{error}</div>
                    )}

                    <form onSubmit={handleSubmit}>

                        {/* Language selector */}
                        <div className="form-group">
                            <label>Programming Language</label>

                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, 1fr)",
                                gap: "10px",
                                marginTop: "4px"
                            }}>
                                {LANGUAGE_OPTIONS.map((lang) => (
                                    <button
                                        key={lang.value}
                                        type="button"
                                        onClick={() => setLanguage(lang.value)}
                                        style={{
                                            padding: "14px 10px",
                                            borderRadius: "10px",
                                            border: "2px solid",
                                            borderColor: language === lang.value ? "#4f46e5" : "#e5e7eb",
                                            background: language === lang.value ? "#eef2ff" : "#ffffff",
                                            cursor: "pointer",
                                            textAlign: "center",
                                            transition: "0.15s",
                                        }}
                                    >
                                        <div style={{ fontSize: "24px", marginBottom: "6px" }}>
                                            {lang.icon}
                                        </div>
                                        <div style={{
                                            fontWeight: "700",
                                            fontSize: "14px",
                                            color: language === lang.value ? "#4f46e5" : "#344054"
                                        }}>
                                            {lang.label}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Difficulty */}
                        <div className="form-group">
                            <label>Difficulty</label>

                            <div style={{ display: "flex", gap: "10px", marginTop: "4px", flexWrap: "wrap" }}>
                                {DIFFICULTY_OPTIONS.map((d) => (
                                    <button
                                        key={d.value}
                                        type="button"
                                        onClick={() => setDifficulty(d.value)}
                                        style={{
                                            flex: "1",
                                            minWidth: "100px",
                                            padding: "12px 10px",
                                            borderRadius: "10px",
                                            border: "2px solid",
                                            borderColor: difficulty === d.value ? "#4f46e5" : "#e5e7eb",
                                            background: difficulty === d.value ? "#eef2ff" : "#ffffff",
                                            cursor: "pointer",
                                            textAlign: "center",
                                            transition: "0.15s",
                                        }}
                                    >
                                        <div style={{
                                            fontWeight: "700",
                                            fontSize: "14px",
                                            marginBottom: "3px",
                                            color: difficulty === d.value ? "#4f46e5" : "#344054"
                                        }}>
                                            {d.label}
                                        </div>
                                        <div style={{ fontSize: "11px", color: "#667085" }}>
                                            {d.description}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Number of problems */}
                        <div className="form-group">
                            <label>Number of Problems</label>

                            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                {PROBLEM_COUNT_OPTIONS.map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setProblemCount(n)}
                                        style={{
                                            width: "52px",
                                            height: "44px",
                                            borderRadius: "8px",
                                            border: "2px solid",
                                            borderColor: problemCount === n ? "#4f46e5" : "#e5e7eb",
                                            background: problemCount === n ? "#eef2ff" : "#ffffff",
                                            color: problemCount === n ? "#4f46e5" : "#344054",
                                            fontWeight: "700",
                                            fontSize: "16px",
                                            cursor: "pointer",
                                            transition: "0.15s",
                                        }}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Optional role */}
                        <div className="form-group">
                            <label htmlFor="role">
                                Job Role <span style={{ fontWeight: "400", color: "#667085" }}>(optional)</span>
                            </label>
                            <input
                                id="role"
                                type="text"
                                placeholder="e.g. Backend Engineer, Data Scientist"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            />
                            <span className="form-hint">
                                Tailor problem context to a specific role.
                            </span>
                        </div>

                        {/* Optional topic */}
                        <div className="form-group">
                            <label htmlFor="topic">
                                Topic Focus <span style={{ fontWeight: "400", color: "#667085" }}>(optional)</span>
                            </label>
                            <input
                                id="topic"
                                type="text"
                                placeholder="e.g. Arrays, Graphs, Dynamic Programming"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                            />
                            <span className="form-hint">
                                Focus problems on a specific algorithmic topic.
                            </span>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? "Creating…" : "Create Coding Interview"}
                            </button>

                            <Link to="/dashboard" className="btn btn-secondary">
                                Cancel
                            </Link>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateCodingInterview;
