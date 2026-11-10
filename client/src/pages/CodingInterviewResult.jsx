import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";

const LANGUAGE_LABELS = {
    python: "Python 3",
    javascript: "JavaScript",
    cpp: "C++",
};

const CodingInterviewResult = () => {
    const { id } = useParams();

    const [codingInterview, setCodingInterview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const response = await api.get(`/coding-interviews/${id}`);
                setCodingInterview(response.data.codingInterview);
            } catch (err) {
                setError(
                    err.response?.data?.message ||
                    "Failed to load coding interview result."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchResult();
    }, [id]);

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-state">Loading results…</div>
            </div>
        );
    }

    if (error || !codingInterview) {
        return (
            <div className="page-container">
                <div className="error-state">{error || "Result not found."}</div>
            </div>
        );
    }

    const { title, language, difficulty, problems, overallScore, summary, recommendation } = codingInterview;
    const problemsAttempted = problems.filter((p) => p.solution?.trim()).length;

    return (
        <div className="page-container result-page">

            {/* Header */}
            <div className="result-header">
                <div>
                    <p className="result-label">CODING INTERVIEW REPORT</p>
                    <h1>Coding Interview Results</h1>
                    <p className="result-subtitle">
                        Review your code solutions and performance.
                    </p>
                </div>

                <Link to="/dashboard" className="secondary-btn">
                    Back to Dashboard
                </Link>
            </div>

            {/* Info card */}
            <div className="result-info-card">
                <div>
                    <span className="info-label">Title</span>
                    <strong>{title || "Coding Interview"}</strong>
                </div>
                <div>
                    <span className="info-label">Language</span>
                    <strong>{LANGUAGE_LABELS[language] || language}</strong>
                </div>
                <div>
                    <span className="info-label">Difficulty</span>
                    <strong style={{ textTransform: "capitalize" }}>{difficulty}</strong>
                </div>
                <div>
                    <span className="info-label">Problems Attempted</span>
                    <strong>
                        {problemsAttempted} / {problems.length}
                    </strong>
                </div>
            </div>

            {/* Overall Score & Summary — shown after AI evaluation (Stage 3) */}
            {(overallScore !== null || summary) && (
                <div className="result-main-grid">
                    <div className="score-card">
                        <p className="card-label">OVERALL SCORE</p>
                        <div className="score-circle">
                            <span>{overallScore ?? "—"}</span>
                            <small>/ 10</small>
                        </div>
                        <h2>
                            {overallScore >= 8
                                ? "Excellent Performance"
                                : overallScore >= 6
                                    ? "Good Performance"
                                    : "Needs Improvement"}
                        </h2>
                    </div>

                    {summary && (
                        <div className="summary-card">
                            <p className="card-label">AI SUMMARY</p>
                            <h2>Overall Assessment</h2>
                            <p className="summary-text">{summary}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Per-problem review */}
            <div className="questions-section">
                <div className="section-heading">
                    <p className="card-label">PROBLEM REVIEW</p>
                    <h2>Solution by Solution</h2>
                </div>

                <div className="result-questions">
                    {problems.map((problem, index) => {
                        const hasScore = problem.score > 0;
                        const hasFeedback = !!problem.feedback;
                        const hasCode = !!problem.solution?.trim();

                        return (
                            <div className="result-question-card" key={index}>
                                <div className="question-result-header">
                                    <div>
                                        <span className="question-number">Problem {index + 1}</span>
                                        <h3>{problem.title || `Problem ${index + 1}`}</h3>
                                    </div>

                                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                                        {problem.submitted && (
                                            <span style={{
                                                background: "#e9f8ef",
                                                color: "#198754",
                                                padding: "4px 10px",
                                                borderRadius: "14px",
                                                fontSize: "12px",
                                                fontWeight: "700"
                                            }}>
                                                Submitted
                                            </span>
                                        )}
                                        {hasScore && (
                                            <div className="question-score">{problem.score}/10</div>
                                        )}
                                    </div>
                                </div>

                                {/* Criteria scores — shown after AI evaluation (Stage 3) */}
                                {(problem.correctness != null || problem.codeQuality != null || problem.efficiency != null) && (
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                                        gap: "12px",
                                        margin: "18px 0",
                                        padding: "14px",
                                        background: "#f8fafc",
                                        borderRadius: "10px",
                                        border: "1px solid #edf0f5"
                                    }}>
                                        {problem.correctness != null && (
                                            <div style={{ textAlign: "center" }}>
                                                <span style={{ fontSize: "11px", fontWeight: "700", color: "#667085", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Correctness</span>
                                                <strong style={{ fontSize: "16px", color: "#172033" }}>{problem.correctness}/10</strong>
                                            </div>
                                        )}
                                        {problem.codeQuality != null && (
                                            <div style={{ textAlign: "center" }}>
                                                <span style={{ fontSize: "11px", fontWeight: "700", color: "#667085", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Code Quality</span>
                                                <strong style={{ fontSize: "16px", color: "#172033" }}>{problem.codeQuality}/10</strong>
                                            </div>
                                        )}
                                        {problem.efficiency != null && (
                                            <div style={{ textAlign: "center" }}>
                                                <span style={{ fontSize: "11px", fontWeight: "700", color: "#667085", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Efficiency</span>
                                                <strong style={{ fontSize: "16px", color: "#172033" }}>{problem.efficiency}/10</strong>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Submitted Code */}
                                <div className="answer-block">
                                    <p className="answer-label">YOUR SOLUTION</p>
                                    {hasCode ? (
                                        <pre style={{
                                            background: "#1e293b",
                                            color: "#e2e8f0",
                                            padding: "14px 16px",
                                            borderRadius: "8px",
                                            fontSize: "13px",
                                            overflowX: "auto",
                                            lineHeight: "1.6",
                                            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                            margin: 0,
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-word"
                                        }}>
                                            {problem.solution}
                                        </pre>
                                    ) : (
                                        <p style={{ color: "#9ca3af", fontStyle: "italic" }}>
                                            No solution submitted for this problem.
                                        </p>
                                    )}
                                </div>

                                {/* Execution Results — populated in Stage 2 */}
                                {problem.execStatus && (
                                    <div className="feedback-block">
                                        <p className="answer-label">EXECUTION RESULT</p>
                                        <div style={{
                                            background: "#f8fafc",
                                            borderRadius: "8px",
                                            padding: "12px 14px",
                                            fontSize: "13px"
                                        }}>
                                            <p><strong>Status:</strong> {problem.execStatus}</p>
                                            {problem.execTime && (
                                                <p><strong>Time:</strong> {problem.execTime}s</p>
                                            )}
                                            {problem.memoryUsed && (
                                                <p><strong>Memory:</strong> {problem.memoryUsed} KB</p>
                                            )}
                                            {problem.stdout && (
                                                <>
                                                    <p style={{ marginTop: "8px" }}><strong>Output:</strong></p>
                                                    <pre style={{
                                                        background: "#1e293b",
                                                        color: "#4ade80",
                                                        padding: "8px 12px",
                                                        borderRadius: "6px",
                                                        fontSize: "12px",
                                                        margin: "4px 0 0 0",
                                                        whiteSpace: "pre-wrap"
                                                    }}>{problem.stdout}</pre>
                                                </>
                                            )}
                                            {problem.compileOutput && (
                                                <>
                                                    <p style={{ marginTop: "8px" }}><strong>Compilation Output:</strong></p>
                                                    <pre style={{
                                                        background: "#1e293b",
                                                        color: "#f87171",
                                                        padding: "8px 12px",
                                                        borderRadius: "6px",
                                                        fontSize: "12px",
                                                        margin: "4px 0 0 0",
                                                        whiteSpace: "pre-wrap"
                                                    }}>{problem.compileOutput}</pre>
                                                </>
                                            )}
                                            {problem.stderr && (
                                                <>
                                                    <p style={{ marginTop: "8px" }}><strong>Errors:</strong></p>
                                                    <pre style={{
                                                        background: "#1e293b",
                                                        color: "#f87171",
                                                        padding: "8px 12px",
                                                        borderRadius: "6px",
                                                        fontSize: "12px",
                                                        margin: "4px 0 0 0",
                                                        whiteSpace: "pre-wrap"
                                                    }}>{problem.stderr}</pre>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* AI Feedback — populated in Stage 3 */}
                                {hasFeedback && (
                                    <div className="feedback-block">
                                        <p className="answer-label">AI FEEDBACK</p>
                                        <p style={{ color: "#475467", lineHeight: "1.7" }}>
                                            {problem.feedback}
                                        </p>
                                    </div>
                                )}

                                {problem.strengths?.length > 0 && (
                                    <div className="feedback-block">
                                        <p className="answer-label">KEY STRENGTHS</p>
                                        <ul style={{ paddingLeft: "20px", margin: "4px 0 0 0", color: "#475467", lineHeight: "1.7" }}>
                                            {problem.strengths.map((s, si) => (
                                                <li key={si}>{s}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {problem.weaknesses?.length > 0 && (
                                    <div className="feedback-block">
                                        <p className="answer-label">AREAS FOR IMPROVEMENT</p>
                                        <ul style={{ paddingLeft: "20px", margin: "4px 0 0 0", color: "#475467", lineHeight: "1.7" }}>
                                            {problem.weaknesses.map((w, wi) => (
                                                <li key={wi}>{w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {problem.improvement && (
                                    <div className="improvement-block">
                                        <p className="answer-label">HOW TO IMPROVE</p>
                                        <p style={{ color: "#475467", lineHeight: "1.7" }}>
                                            {problem.improvement}
                                        </p>
                                    </div>
                                )}

                                {/* No evaluation yet placeholder */}
                                {!hasFeedback && !hasScore && hasCode && (
                                    <div className="improvement-block">
                                        <p style={{
                                            color: "#9ca3af",
                                            fontSize: "13px",
                                            fontStyle: "italic"
                                        }}>
                                            AI evaluation will be shown here after Stage 3 is implemented.
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Recommendation */}
            {recommendation && (
                <div className="recommendation-card" style={{ marginTop: "24px" }}>
                    <p className="card-label">AI RECOMMENDATION</p>
                    <h2>Recommended Next Steps</h2>
                    <p>{recommendation}</p>
                </div>
            )}

            {/* Bottom actions */}
            <div className="result-actions">
                <Link to="/create-coding-interview" className="primary-btn">
                    Take Another Coding Interview
                </Link>
                <Link to="/dashboard" className="secondary-btn">
                    Return to Dashboard
                </Link>
            </div>

        </div>
    );
};

export default CodingInterviewResult;
