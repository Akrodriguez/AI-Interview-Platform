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

    const {
        title,
        language,
        difficulty,
        problems,
        overallScore,
        summary,
        recommendation,
        tabSwitchCount = 0,
        noFaceDetectedCount = 0,
        multipleFaceDetectedCount = 0,
        copyAttemptCount = 0,
        pasteAttemptCount = 0,
        cutAttemptCount = 0,
        dragDropAttemptCount = 0,
        fullscreenExitCount = 0,
        proctoringEvents = [],
    } = codingInterview;

    const problemsAttempted = problems.filter((p) => p.solution?.trim()).length;

    const totalObservations =
        (tabSwitchCount || 0) +
        (pasteAttemptCount || 0) +
        (copyAttemptCount || 0) +
        (cutAttemptCount || 0) +
        (dragDropAttemptCount || 0) +
        (noFaceDetectedCount || 0) +
        (multipleFaceDetectedCount || 0) +
        (fullscreenExitCount || 0);

    return (
        <div className="page-container result-page">

            {/* Header */}
            <div className="result-header">
                <div>
                    <p className="result-label">CODING INTERVIEW REPORT</p>
                    <h1>Coding Interview Results</h1>
                    <p className="result-subtitle">
                        Review your code solutions and session integrity report.
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

            {/* Proctoring & Integrity Observations Summary Card */}
            <div className="recommendation-card" style={{ marginBottom: "28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
                    <p className="card-label">PROCTORING & INTEGRITY SUMMARY</p>
                    <span style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        padding: "3px 10px",
                        borderRadius: "12px",
                        background: totalObservations === 0 ? "#dcfce7" : "#fee2e2",
                        color: totalObservations === 0 ? "#15803d" : "#b91c1c",
                        border: `1px solid ${totalObservations === 0 ? "#bbf7d0" : "#fecaca"}`,
                    }}>
                        {totalObservations === 0 ? "✓ Clear Session" : `⚠ ${totalObservations} Recorded Observation${totalObservations === 1 ? "" : "s"}`}
                    </span>
                </div>

                <h2>Automated Session Observations</h2>
                <p style={{ color: "#667085", fontSize: "14px", lineHeight: "1.6", marginBottom: "18px" }}>
                    These metrics reflect automated browser, clipboard, and camera-monitoring observations recorded during the coding session. They are recorded for review and do not automatically indicate dishonesty or disqualify a candidate.
                </p>

                {/* Metric Grid (8 observation counts) */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "12px",
                    marginBottom: "20px"
                }}>
                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #edf0f5", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", textTransform: "uppercase" }}>Tab Switches</span>
                        <strong style={{ fontSize: "18px", color: tabSwitchCount > 0 ? "#dc2626" : "#1e293b" }}>{tabSwitchCount}</strong>
                    </div>

                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #edf0f5", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", textTransform: "uppercase" }}>Paste Attempts</span>
                        <strong style={{ fontSize: "18px", color: pasteAttemptCount > 0 ? "#dc2626" : "#1e293b" }}>{pasteAttemptCount}</strong>
                    </div>

                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #edf0f5", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", textTransform: "uppercase" }}>Copy Attempts</span>
                        <strong style={{ fontSize: "18px", color: copyAttemptCount > 0 ? "#d97706" : "#1e293b" }}>{copyAttemptCount}</strong>
                    </div>

                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #edf0f5", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", textTransform: "uppercase" }}>Cut Attempts</span>
                        <strong style={{ fontSize: "18px", color: cutAttemptCount > 0 ? "#d97706" : "#1e293b" }}>{cutAttemptCount}</strong>
                    </div>

                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #edf0f5", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", textTransform: "uppercase" }}>Drag & Drops</span>
                        <strong style={{ fontSize: "18px", color: dragDropAttemptCount > 0 ? "#dc2626" : "#1e293b" }}>{dragDropAttemptCount}</strong>
                    </div>

                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #edf0f5", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", textTransform: "uppercase" }}>No Face Alerts</span>
                        <strong style={{ fontSize: "18px", color: noFaceDetectedCount > 0 ? "#dc2626" : "#1e293b" }}>{noFaceDetectedCount}</strong>
                    </div>

                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #edf0f5", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", textTransform: "uppercase" }}>Multiple Faces</span>
                        <strong style={{ fontSize: "18px", color: multipleFaceDetectedCount > 0 ? "#d97706" : "#1e293b" }}>{multipleFaceDetectedCount}</strong>
                    </div>

                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #edf0f5", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", textTransform: "uppercase" }}>Fullscreen Exits</span>
                        <strong style={{ fontSize: "18px", color: fullscreenExitCount > 0 ? "#dc2626" : "#1e293b" }}>{fullscreenExitCount}</strong>
                    </div>
                </div>

                {/* Recorded Proctoring Events Log */}
                {proctoringEvents.length > 0 ? (
                    <div>
                        <p style={{ fontSize: "12px", fontWeight: "700", color: "#475467", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                            Timeline Observations ({proctoringEvents.length})
                        </p>
                        <div style={{
                            maxHeight: "220px",
                            overflowY: "auto",
                            border: "1px solid #edf0f5",
                            borderRadius: "8px",
                            padding: "8px 14px",
                            background: "#fcfcfd"
                        }}>
                            {proctoringEvents.map((evt, idx) => (
                                <div key={idx} style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "8px 0",
                                    borderBottom: idx < proctoringEvents.length - 1 ? "1px solid #f1f5f9" : "none",
                                    fontSize: "12px"
                                }}>
                                    <div>
                                        <strong style={{ color: "#1e293b", textTransform: "capitalize" }}>
                                            {evt.eventType ? evt.eventType.replace(/_/g, " ") : "Observation"}
                                        </strong>
                                        <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "11px" }}>
                                            {evt.message || evt.details || "Activity recorded"}
                                        </p>
                                    </div>
                                    <span style={{ color: "#94a3b8", fontSize: "11px", flexShrink: 0 }}>
                                        {new Date(evt.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p style={{ color: "#15803d", fontSize: "13px", fontWeight: "500", margin: 0 }}>
                        ✓ No proctoring events or violations were recorded during this session.
                    </p>
                )}
            </div>

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
