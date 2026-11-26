import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const getInterviewScore = (interview) => {
    if (Number.isFinite(Number(interview?.overallScore))) {
        return Number(interview.overallScore);
    }

    const scores = (interview?.questions || [])
        .map((question) => Number(question?.score || 0))
        .filter((score) => Number.isFinite(score));

    if (!scores.length) {
        return null;
    }

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Number(average.toFixed(1));
};

const formatDate = (dateValue) => {
    if (!dateValue) {
        return "Not available";
    }

    return new Date(dateValue).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

const normalizeInsightText = (text) => {
    if (!text || typeof text !== "string") {
        return "";
    }

    return text
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const isMeaningfulSkill = (value) => {
    const text = normalizeInsightText(value);

    if (!text || text.length < 2 || text.length > 120) {
        return false;
    }

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 12) {
        return false;
    }

    return !/^none\b/i.test(text) && !/^no\s+clear\s+skill\b/i.test(text) && !/^not\s+identified\b/i.test(text);
};

const isActionableRecommendation = (value) => {
    const text = normalizeInsightText(value);

    if (!text || text.length < 6 || text.length > 180) {
        return false;
    }

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 3 || words.length > 18) {
        return false;
    }

    return /\b(practice|revise|improve|review|focus|strengthen|study|learn|work|optimize|debug|prepare|reflect|read|build|revisit|understand|master|clarify|explore|compare|apply|handle)\b/i.test(text)
        || /\b(reject|hire|select|pass|fail|strong|clear|no)\b/i.test(text);
};

const getInsightSources = (interview) => {
    const strongest = Array.isArray(interview?.strongestSkills)
        ? interview.strongestSkills
        : Array.isArray(interview?.strengths)
            ? interview.strengths
            : [];

    const weakest = Array.isArray(interview?.weakestSkills)
        ? interview.weakestSkills
        : Array.isArray(interview?.weaknesses)
            ? interview.weaknesses
            : [];

    const improve = Array.isArray(interview?.areasToImprove)
        ? interview.areasToImprove
        : Array.isArray(interview?.recommendations)
            ? interview.recommendations
            : interview?.recommendation
                ? [interview.recommendation]
                : [];

    return { strongest, weakest, improve };
};

const extractValidSkills = (items) => {
    const values = Array.isArray(items) ? items : typeof items === "string" ? [items] : [];

    return [...new Set(values
        .flatMap((value) => {
            const text = normalizeInsightText(value);
            if (!text) {
                return [];
            }

            const parts = text.split(/(?<=[.!?])\s+|;\s*|\n+/).map((part) => part.trim()).filter(Boolean);
            return parts.length ? parts : [text];
        })
        .map((value) => normalizeInsightText(value))
        .filter((value) => isMeaningfulSkill(value))
        .slice(0, 3))];
};

const extractValidRecommendations = (items) => {
    const values = Array.isArray(items) ? items : typeof items === "string" ? [items] : [];

    return [...new Set(values
        .flatMap((value) => {
            const text = normalizeInsightText(value);
            if (!text) {
                return [];
            }

            const parts = text.split(/(?<=[.!?])\s+|;\s*|\n+/).map((part) => part.trim()).filter(Boolean);
            return parts.length ? parts : [text];
        })
        .map((value) => normalizeInsightText(value))
        .filter((value) => isActionableRecommendation(value))
        .slice(0, 3))];
};

const buildSkillDistribution = (items) => {
    return items.reduce((acc, item) => {
        if (!item || !isMeaningfulSkill(item)) {
            return acc;
        }

        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});
};

const buildRecommendationDistribution = (items) => {
    return items.reduce((acc, item) => {
        if (!item || !isActionableRecommendation(item)) {
            return acc;
        }

        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});
};

const Dashboard = () => {
    const [interviews, setInterviews] = useState([]);
    const [codingInterviews, setCodingInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [plan, setPlan] = useState(null);
    const [planBusy, setPlanBusy] = useState(false);
    const [planError, setPlanError] = useState("");
    const [activeTab, setActiveTab] = useState("text");

    const fetchInterviews = async () => {
        try {
            const [textRes, codingRes] = await Promise.all([
                api.get("/interviews"),
                api.get("/coding-interviews"),
            ]);

            setInterviews(textRes.data.interviews || []);
            setCodingInterviews(codingRes.data.codingInterviews || []);
        } catch (err) {
            setError(
                err.response?.data?.message || "Failed to load interviews."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInterviews();
}, []);

    const completedInterviews = (interviews || [])
        .filter((interview) => {
            if (interview?.completed) {
                return true;
            }

            if (Number.isFinite(Number(interview?.overallScore))) {
                return true;
            }

            return Boolean(interview?.questions?.some((question) => Number(question?.score || 0) > 0));
        })
        .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));

    const scoreableInterviews = completedInterviews
        .map((interview) => ({
            ...interview,
            derivedScore: getInterviewScore(interview),
        }))
        .filter((interview) => Number.isFinite(Number(interview.derivedScore)));

    const totalCompleted = completedInterviews.length;
    const averageScore = scoreableInterviews.length
        ? scoreableInterviews.reduce((sum, interview) => sum + Number(interview.derivedScore), 0) / scoreableInterviews.length
        : 0;
    const highestScore = scoreableInterviews.length
        ? Math.max(...scoreableInterviews.map((interview) => Number(interview.derivedScore)))
        : 0;
    const mostRecentInterview = scoreableInterviews[0] || null;

    const chartData = [...scoreableInterviews]
        .reverse()
        .map((interview) => ({
            label: formatDate(interview.createdAt),
            score: Number(interview.derivedScore),
        }));

    const chartWidth = 520;
    const chartHeight = 180;
    const padding = 24;

    const chartPoints = chartData.length
        ? chartData.map((entry, index) => {
            const x = padding + (index * (chartWidth - padding * 2)) / Math.max(chartData.length - 1, 1);
            const y = chartHeight - padding - ((entry.score / 10) * (chartHeight - padding * 2));
            return `${x},${y}`;
        }).join(" ")
        : "";

    const insightSources = completedInterviews.map((interview) => getInsightSources(interview));

    const strongestAreas = buildSkillDistribution(
        insightSources.flatMap(({ strongest }) => extractValidSkills(strongest))
    );

    const weakestAreas = buildSkillDistribution(
        insightSources.flatMap(({ weakest }) => extractValidSkills(weakest))
    );

    const improvementAreas = buildRecommendationDistribution(
        insightSources.flatMap(({ improve }) => {
            const items = Array.isArray(improve) ? improve : [improve];
            const flattened = items.flatMap((entry) => {
                const text = normalizeInsightText(entry);
                if (!text) {
                    return [];
                }

                return text.split(/(?<=[.!?])\s+|;\s*|\n+/).map((part) => part.trim()).filter(Boolean);
            });

            return extractValidRecommendations(flattened.length ? flattened : items);
        })
    );

    const strongestAreaList = Object.entries(strongestAreas)
        .sort((current, next) => next[1] - current[1] || current[0].localeCompare(next[0]))
        .slice(0, 3)
        .map(([label, score]) => ({ label, score }));

    const weakestAreaList = Object.entries(weakestAreas)
        .sort((current, next) => next[1] - current[1] || current[0].localeCompare(next[0]))
        .slice(0, 3)
        .map(([label, score]) => ({ label, score }));

    const improvementAreaList = Object.entries(improvementAreas)
        .sort((current, next) => next[1] - current[1] || current[0].localeCompare(next[0]))
        .slice(0, 3)
        .map(([label, score]) => ({ label, score }));

    useEffect(() => {
    const fetchPlan = async () => {
        if (!completedInterviews.length) {
            setPlan(null);
            setPlanError("");
            return;
        }

        try {
            const response = await api.get("/interviews/improvement-plan");
            setPlan(response.data.plan || null);
            setPlanError("");
        } catch (error) {
            if (error.response?.status === 404) {
                setPlan(null);
                return;
            }

            setPlanError(
                error.response?.data?.message ||
                "Unable to load your improvement plan."
            );
        }
    };

    fetchPlan();
}, [completedInterviews.length]);

    useEffect(() => {
    const fetchPlan = async () => {
        if (!completedInterviews.length) {
            return;
        }

        try {
            const response = await api.get("/interviews/improvement-plan");
            setPlan(response.data.plan || null);
            setPlanError("");
        } catch (error) {
            if (error.response?.status === 404) {
                setPlan(null);
                return;
            }

            setPlanError(
                error.response?.data?.message ||
                "Unable to load your improvement plan."
            );
        }
    };

    fetchPlan();
}, [completedInterviews.length]);

    const generateImprovementPlan = async () => {
        if (!completedInterviews.length) {
            return;
        }

        setPlanBusy(true);
        setPlanError("");

        try {
            const response = await api.post("/interviews/improvement-plan/generate");
            setPlan(response.data.plan || null);
        } catch (error) {
            setPlanError(
                error.response?.data?.message ||
                "Unable to generate your personalized improvement plan."
            );
        } finally {
            setPlanBusy(false);
        }
    };

    const togglePlanDay = async (dayIndex) => {
        if (!plan || !plan.days?.[dayIndex]) {
            return;
        }

        setPlanBusy(true);
        setPlanError("");

        try {
            const response = await api.patch(`/interviews/improvement-plan/${dayIndex}`, {
                completed: !plan.days[dayIndex].completed,
            });
            setPlan(response.data.plan || null);
        } catch (error) {
            setPlanError(
                error.response?.data?.message ||
                "Unable to update the plan."
            );
        } finally {
            setPlanBusy(false);
        }
    };

    const planProgress = plan?.days?.length
        ? Math.round((plan.days.filter((day) => day.completed).length / plan.days.length) * 100)
        : 0;

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading">
                    Loading your interviews...
                </div>
            </div>
        );
    }

    const LANG_LABELS = {
        python: "Python 3",
        javascript: "JavaScript",
        cpp: "C++",
    };

    return (
        <div className="page-container">

            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p>Practice, evaluate and improve your interview skills.</p>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <Link to="/create-interview" className="btn btn-secondary">
                        + Text Interview
                    </Link>
                    <Link to="/create-coding-interview" className="btn btn-primary">
                        {"</>"} Coding Interview
                    </Link>
                </div>
            </div>

            {error && (
                <div className="error-message">{error}</div>
            )}

            {/* ---- Tab Switcher ---- */}
            <div style={{
                display: "flex",
                gap: "0",
                marginBottom: "24px",
                borderBottom: "2px solid #e5e7eb",
            }}>
                {[
                    { key: "text", label: "Text Interviews" },
                    { key: "coding", label: "Coding Interviews" },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: "10px 20px",
                            border: "none",
                            borderBottom: activeTab === tab.key ? "2px solid #4f46e5" : "2px solid transparent",
                            background: "transparent",
                            color: activeTab === tab.key ? "#4f46e5" : "#667085",
                            fontWeight: activeTab === tab.key ? "700" : "500",
                            fontSize: "15px",
                            cursor: "pointer",
                            marginBottom: "-2px",
                            transition: "0.15s",
                        }}
                    >
                        {tab.label}
                        <span style={{
                            marginLeft: "8px",
                            background: activeTab === tab.key ? "#eef2ff" : "#f2f4f7",
                            color: activeTab === tab.key ? "#4f46e5" : "#475467",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "700"
                        }}>
                            {tab.key === "text" ? interviews.length : codingInterviews.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* ---- Text Interviews Tab ---- */}
            {activeTab === "text" && (
                <>
                    {interviews.length === 0 ? (
                        <div className="empty-state">
                            <h3>No text interviews yet</h3>
                            <p>Create your first AI-powered interview and start practicing.</p>
                            <Link to="/create-interview" className="btn btn-primary">
                                Create Your First Interview
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="analytics-grid">
                                <div className="analytics-card">
                                    <span className="analytics-label">Completed interviews</span>
                                    <strong>{totalCompleted}</strong>
                                </div>
                        <div className="analytics-card">
                            <span className="analytics-label">Average score</span>
                            <strong>{scoreableInterviews.length ? averageScore.toFixed(1) : "N/A"}</strong>
                        </div>

                        <div className="analytics-card">
                            <span className="analytics-label">Highest score</span>
                            <strong>{scoreableInterviews.length ? `${highestScore.toFixed(1)}/10` : "N/A"}</strong>
                        </div>

                        <div className="analytics-card">
                            <span className="analytics-label">Most recent score</span>
                            <strong>{mostRecentInterview ? `${Number(mostRecentInterview.derivedScore).toFixed(1)}/10` : "N/A"}</strong>
                        </div>
                    </div>

                    {chartData.length > 0 ? (
                        <div className="analytics-panel">
                            <div className="panel-header">
                                <h2>Score trend</h2>
                            </div>

                            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="score-chart" preserveAspectRatio="none">
                                <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} className="chart-axis" />
                                <line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} className="chart-axis" />

                                <polyline
                                    points={chartPoints}
                                    fill="none"
                                    stroke="#4f46e5"
                                    strokeWidth="3"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />

                                {chartData.map((entry, index) => {
                                    const x = padding + (index * (chartWidth - padding * 2)) / Math.max(chartData.length - 1, 1);
                                    const y = chartHeight - padding - ((entry.score / 10) * (chartHeight - padding * 2));

                                    return (
                                        <g key={`${entry.label}-${index}`}>
                                            <circle cx={x} cy={y} r="4" fill="#4f46e5" />
                                            <text x={x} y={chartHeight - 8} textAnchor="middle" className="chart-label">{entry.label}</text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    ) : (
                        <div className="analytics-panel empty-analytics">
                            <h2>Score trend</h2>
                            <p>No scored interviews yet. Complete an interview to unlock your chart.</p>
                        </div>
                    )}

                    <div className="dashboard-grid">
                        <div className="analytics-panel">
                            <div className="panel-header">
                                <h2>Recent interview history</h2>
                            </div>

                            <div className="history-list">
                                {completedInterviews.map((interview) => (
                                    <div className="history-row" key={interview._id}>
                                        <div>
                                            <strong>{interview.role}</strong>
                                            <span>{formatDate(interview.createdAt)}</span>
                                        </div>

                                        <div>
                                            <span className="history-label">Score</span>
                                            <strong>{Number.isFinite(Number(getInterviewScore(interview))) ? `${Number(getInterviewScore(interview)).toFixed(1)}/10` : "N/A"}</strong>
                                        </div>

                                        <div>
                                            <span className="history-label">Status</span>
                                            <strong>{interview.completed ? "Completed" : "In progress"}</strong>
                                        </div>

                                        <Link to={`/interview/${interview._id}/result`} className="history-link">
                                            View report
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="analytics-panel">
                            <div className="panel-header">
                                <h2>Performance insights</h2>
                            </div>

                            <div className="insight-group">
                                <h3>Strongest skills</h3>
                                {strongestAreaList.length ? (
                                    <div className="insight-card-list">
                                        {strongestAreaList.map((item) => (
                                            <div className="insight-skill-card positive" key={item.label}>
                                                <span>{item.label}</span>
                                                <strong>{item.score}</strong>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="insight-empty">Complete more interviews to unlock performance insights.</p>
                                )}
                            </div>

                            <div className="insight-group">
                                <h3>Weakest skills</h3>
                                {weakestAreaList.length ? (
                                    <div className="insight-card-list">
                                        {weakestAreaList.map((item) => (
                                            <div className="insight-skill-card negative" key={item.label}>
                                                <span>{item.label}</span>
                                                <strong>{item.score}</strong>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="insight-empty">Complete more interviews to unlock performance insights.</p>
                                )}
                            </div>

                            <div className="insight-group">
                                <h3>Areas to improve</h3>
                                {improvementAreaList.length ? (
                                    <ul className="insight-recommendations">
                                        {improvementAreaList.map((item) => (
                                            <li key={item.label}>{item.label}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="insight-empty">Complete more interviews to unlock performance insights.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="analytics-panel plan-panel">
                        <div className="panel-header plan-header">
                            <div>
                                <h2>Personalized improvement plan</h2>
                                <p>Built from your recent interview performance and feedback.</p>
                            </div>

                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={generateImprovementPlan}
                                disabled={planBusy || !completedInterviews.length}
                            >
                                {planBusy ? "Working..." : plan ? "Regenerate plan" : "Generate plan"}
                            </button>
                        </div>

                        {planError && (
                            <div className="error-message plan-error">{planError}</div>
                        )}

                        {!plan ? (
                            <div className="empty-state plan-empty">
                                <h3>No improvement plan yet</h3>
                                <p>
                                    Finish a completed interview and generate a 5-day plan tailored to your weakest areas and strongest strengths.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="plan-summary-row">
                                    <div className="plan-summary-box">
                                        <span>Plan focus</span>
                                        <strong>{plan.summary}</strong>
                                    </div>

                                    <div className="plan-summary-box">
                                        <span>Progress</span>
                                        <strong>{planProgress}%</strong>
                                    </div>
                                </div>

                                <div className="plan-focus-list">
                                    {(plan.focusAreas || []).map((area) => (
                                        <span className="focus-pill" key={area}>{area}</span>
                                    ))}
                                </div>

                                <div className="progress-bar">
                                    <span style={{ width: `${planProgress}%` }} />
                                </div>

                                <div className="plan-day-list">
                                    {(plan.days || []).map((day, index) => (
                                        <div key={`${day.topic}-${index}`} className={`plan-day ${day.completed ? "completed" : ""}`}>
                                            <div className="plan-day-top">
                                                <div>
                                                    <span className="plan-day-label">Day {day.day || index + 1}</span>
                                                    <h3>{day.topic}</h3>
                                                </div>

                                                <button
                                                    type="button"
                                                    className={`check-btn ${day.completed ? "checked" : ""}`}
                                                    onClick={() => togglePlanDay(index)}
                                                    disabled={planBusy}
                                                >
                                                    {day.completed ? "Completed" : "Mark done"}
                                                </button>
                                            </div>

                                            <div className="plan-detail-grid">
                                                <div>
                                                    <span>Learning objective</span>
                                                    <p>{day.objective}</p>
                                                </div>
                                                <div>
                                                    <span>Practice activity</span>
                                                    <p>{day.activity}</p>
                                                </div>
                                                <div>
                                                    <span>Estimated time</span>
                                                    <p>{day.estimatedTime}</p>
                                                </div>
                                                <div>
                                                    <span>Expected outcome</span>
                                                    <p>{day.expectedOutcome}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="interview-grid">
                        {interviews.map((interview) => (
                            <div
                                className="interview-card"
                                key={interview._id}
                            >
                                <h3>
                                    {interview.role}
                                </h3>

                                <p>
                                    {interview.experience} years
                                    experience
                                </p>

                                <div className="tech-stack">
                                    {Array.isArray(interview.techStack) && interview.techStack.map(
                                        (tech, index) => (
                                            <span
                                                className="tech-tag"
                                                key={index}
                                            >
                                                {tech}
                                            </span>
                                        )
                                    )}
                                </div>

                                <Link
                                    to={`/interview/${interview._id}`}
                                    className="card-link"
                                >
                                    Open Interview →
                                </Link>
                            </div>
                        ))}
                    </div>
                            <div className="interview-grid">
                                {interviews.map((interview) => (
                                    <div className="interview-card" key={interview._id}>
                                    <h3>{interview.role}</h3>

                                    <p>{interview.experience} years experience</p>

                                    <div className="tech-stack">
                                        {interview.techStack.map((tech, index) => (
                                            <span className="tech-tag" key={index}>{tech}</span>
                                        ))}
                                    </div>

                                    <Link
                                        to={
                                            interview.completed
                                                ? `/interview/${interview._id}/result`
                                                : `/interview/${interview._id}`
                                        }
                                        className="card-link"
                                    >
                                        {interview.completed ? "View Result →" : "Open Interview →"}
                                    </Link>
                                </div>
                            ))}
                        </div>
                        </>
                    )}
                </>
            )}
            {/* ---- Coding Interviews Tab ---- */}
            {activeTab === "coding" && (
                <>
                    {codingInterviews.length === 0 ? (
                        <div className="empty-state">
                            <h3>No coding interviews yet</h3>
                            <p>
                                Start a coding session with a live editor for Python, JavaScript, or C++.
                            </p>
                            <Link to="/create-coding-interview" className="btn btn-primary">
                                Start Your First Coding Interview
                            </Link>
                        </div>
                    ) : (
                        <div className="interview-grid">
                            {codingInterviews.map((ci) => (
                                <div className="interview-card" key={ci._id}>

                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                                        <span style={{
                                            background: "#eef2ff",
                                            color: "#4f46e5",
                                            padding: "3px 8px",
                                            borderRadius: "12px",
                                            fontSize: "11px",
                                            fontWeight: "700",
                                        }}>
                                            {LANG_LABELS[ci.language] || ci.language}
                                        </span>
                                        <span style={{
                                            background: ci.difficulty === "hard" ? "#fef2f2" : ci.difficulty === "medium" ? "#fffbeb" : "#f0fdf4",
                                            color: ci.difficulty === "hard" ? "#b91c1c" : ci.difficulty === "medium" ? "#b45309" : "#15803d",
                                            padding: "3px 8px",
                                            borderRadius: "12px",
                                            fontSize: "11px",
                                            fontWeight: "700",
                                            textTransform: "capitalize"
                                        }}>
                                            {ci.difficulty}
                                        </span>
                                    </div>

                                    <h3 style={{ fontSize: "17px", marginBottom: "8px" }}>
                                        {ci.title || "Coding Interview"}
                                    </h3>

                                    <p style={{ marginBottom: "12px" }}>
                                        {ci.problems?.length
                                            ? `${ci.problems.length} problem${ci.problems.length !== 1 ? "s" : ""}`
                                            : "Not started"}
                                        {ci.role && ` · ${ci.role}`}
                                    </p>

                                    <Link
                                        to={
                                            ci.completed
                                                ? `/coding-interview/${ci._id}/result`
                                                : `/coding-interview/${ci._id}`
                                        }
                                        className="card-link"
                                    >
                                        {ci.completed ? "View Result →" : "Open Session →"}
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

        </div>
    );
};

export default Dashboard;
