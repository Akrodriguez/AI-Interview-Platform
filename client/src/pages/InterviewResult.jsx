import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";

const InterviewResult = () => {
    const { id } = useParams();

    const [interview, setInterview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchInterview = async () => {
            try {
                setLoading(true);

                const response = await api.get(`/interviews/${id}`);

                setInterview(response.data.interview);
            } catch (error) {
                setError(
                    error.response?.data?.message ||
                    "Failed to load interview report"
                );
            } finally {
                setLoading(false);
            }
        };

        fetchInterview();
    }, [id]);

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-state">
                    Loading interview report...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-container">
                <div className="error-state">
                    {error}
                </div>
            </div>
        );
    }

    if (!interview) {
        return (
            <div className="page-container">
                <div className="error-state">
                    Interview report not found.
                </div>
            </div>
        );
    }

    return (
        <div className="page-container result-page">

            {/* Header */}

            <div className="result-header">
                <div>
                    <p className="result-label">
                        AI INTERVIEW REPORT
                    </p>

                    <h1>
                        Interview Results
                    </h1>

                    <p className="result-subtitle">
                        Here's a detailed analysis of your interview performance.
                    </p>
                </div>

                <Link
                    to="/dashboard"
                    className="secondary-btn"
                >
                    Back to Dashboard
                </Link>
            </div>


            {/* Interview Information */}

            <div className="result-info-card">

                <div>
                    <span className="info-label">
                        Role
                    </span>

                    <strong>
                        {interview.role}
                    </strong>
                </div>

                <div>
                    <span className="info-label">
                        Experience
                    </span>

                    <strong>
                        {interview.experience} years
                    </strong>
                </div>

                <div>
                    <span className="info-label">
                        Questions
                    </span>

                    <strong>
                        {interview.questions?.length || 0}
                    </strong>
                </div>

                <div>
                    <span className="info-label">
                        Status
                    </span>

                    <strong className="completed-badge">
                        Completed
                    </strong>
                </div>

            </div>


            {/* Score + Summary */}

            <div className="result-main-grid">

                {/* Score */}

                <div className="score-card">

                    <p className="card-label">
                        OVERALL SCORE
                    </p>

                    <div className="score-circle">
                        <span>
                            {interview.overallScore ?? 0}
                        </span>

                        <small>
                            / 10
                        </small>
                    </div>

                    <h2>
                        {interview.overallScore >= 8
                            ? "Excellent Performance"
                            : interview.overallScore >= 6
                                ? "Good Performance"
                                : "Needs Improvement"}
                    </h2>

                    <p>
                        Based on your answers across the entire interview.
                    </p>

                </div>


                {/* Summary */}

                <div className="summary-card">

                    <p className="card-label">
                        AI SUMMARY
                    </p>

                    <h2>
                        Overall Assessment
                    </h2>

                    <p className="summary-text">
                        {interview.summary ||
                            "No summary available."}
                    </p>

                </div>

            </div>


            {/* Strengths & Weaknesses */}

            <div className="analysis-grid">

                <div className="analysis-card">

                    <p className="card-label">
                        STRENGTHS
                    </p>

                    <h2>
                        What you did well
                    </h2>

                    {interview.strengths?.length ? (
                        <ul>
                            {interview.strengths.map(
                                (strength, index) => (
                                    <li key={index}>
                                        {strength}
                                    </li>
                                )
                            )}
                        </ul>
                    ) : (
                        <p>
                            No strengths recorded.
                        </p>
                    )}

                </div>


                <div className="analysis-card">

                    <p className="card-label">
                        AREAS TO IMPROVE
                    </p>

                    <h2>
                        What you can improve
                    </h2>

                    {interview.weaknesses?.length ? (
                        <ul>
                            {interview.weaknesses.map(
                                (weakness, index) => (
                                    <li key={index}>
                                        {weakness}
                                    </li>
                                )
                            )}
                        </ul>
                    ) : (
                        <p>
                            No weaknesses recorded.
                        </p>
                    )}

                </div>

            </div>


            {/* Recommendation */}

            <div className="recommendation-card">

                <p className="card-label">
                    AI RECOMMENDATION
                </p>

                <h2>
                    Recommended Next Steps
                </h2>

                <p>
                    {interview.recommendation ||
                        "No recommendation available."}
                </p>

            </div>


            {/* Question Analysis */}

            <div className="questions-section">

                <div className="section-heading">

                    <div>
                        <p className="card-label">
                            DETAILED ANALYSIS
                        </p>

                        <h2>
                            Question-by-Question Review
                        </h2>
                    </div>

                </div>


                <div className="result-questions">

                    {interview.questions?.map(
                        (question, index) => {
                            const hasCriteriaScores =
                                question.technicalAccuracy != null ||
                                question.completeness != null ||
                                question.clarity != null ||
                                question.problemSolving != null ||
                                question.practicalUnderstanding != null;

                            const hasStrengths =
                                Array.isArray(question.strengths) &&
                                question.strengths.length > 0;

                            const hasWeaknesses =
                                Array.isArray(question.weaknesses) &&
                                question.weaknesses.length > 0;

                            return (
                                <div
                                    className="result-question-card"
                                    key={index}
                                >

                                    <div className="question-result-header">

                                        <div>
                                            <span className="question-number">
                                                Question {index + 1}
                                            </span>

                                            <h3>
                                                {question.question}
                                            </h3>
                                        </div>

                                        <div className="question-score">
                                            {question.score ?? 0}/10
                                        </div>

                                    </div>

                                    {/* Structured Evaluation Criteria Scores */}
                                    {hasCriteriaScores && (
                                        <div
                                            className="criteria-scores-container"
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                                                gap: "12px",
                                                margin: "18px 0",
                                                padding: "14px",
                                                background: "#f8fafc",
                                                borderRadius: "10px",
                                                border: "1px solid #edf0f5"
                                            }}
                                        >
                                            {question.technicalAccuracy != null && (
                                                <div style={{ textAlign: "center" }}>
                                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#667085", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Technical</span>
                                                    <strong style={{ fontSize: "16px", color: "#172033" }}>{question.technicalAccuracy}/10</strong>
                                                </div>
                                            )}

                                            {question.completeness != null && (
                                                <div style={{ textAlign: "center" }}>
                                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#667085", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Completeness</span>
                                                    <strong style={{ fontSize: "16px", color: "#172033" }}>{question.completeness}/10</strong>
                                                </div>
                                            )}

                                            {question.clarity != null && (
                                                <div style={{ textAlign: "center" }}>
                                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#667085", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Clarity</span>
                                                    <strong style={{ fontSize: "16px", color: "#172033" }}>{question.clarity}/10</strong>
                                                </div>
                                            )}

                                            {question.problemSolving != null && (
                                                <div style={{ textAlign: "center" }}>
                                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#667085", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Problem Solving</span>
                                                    <strong style={{ fontSize: "16px", color: "#172033" }}>{question.problemSolving}/10</strong>
                                                </div>
                                            )}

                                            {question.practicalUnderstanding != null && (
                                                <div style={{ textAlign: "center" }}>
                                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#667085", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Practical</span>
                                                    <strong style={{ fontSize: "16px", color: "#172033" }}>{question.practicalUnderstanding}/10</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="answer-block">

                                        <p className="answer-label">
                                            YOUR ANSWER
                                        </p>

                                        <p>
                                            {question.answer ||
                                                "No answer provided."}
                                        </p>

                                    </div>

                                    <div className="feedback-block">

                                        <p className="answer-label">
                                            AI FEEDBACK
                                        </p>

                                        <p>
                                            {question.feedback ||
                                                "No feedback available."}
                                        </p>

                                    </div>

                                    {/* Question Specific Strengths */}
                                    {hasStrengths && (
                                        <div className="feedback-block">

                                            <p className="answer-label">
                                                KEY STRENGTHS
                                            </p>

                                            <ul style={{ paddingLeft: "20px", margin: "4px 0 0 0", color: "#475467", lineHeight: "1.7" }}>
                                                {question.strengths.map((item, sIndex) => (
                                                    <li key={sIndex}>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>

                                        </div>
                                    )}

                                    {/* Question Specific Weaknesses */}
                                    {hasWeaknesses && (
                                        <div className="feedback-block">

                                            <p className="answer-label">
                                                AREAS FOR IMPROVEMENT
                                            </p>

                                            <ul style={{ paddingLeft: "20px", margin: "4px 0 0 0", color: "#475467", lineHeight: "1.7" }}>
                                                {question.weaknesses.map((item, wIndex) => (
                                                    <li key={wIndex}>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>

                                        </div>
                                    )}

                                    <div className="improvement-block">

                                        <p className="answer-label">
                                            HOW TO IMPROVE
                                        </p>

                                        <p>
                                            {question.improvement ||
                                                "No improvement suggestion available."}
                                        </p>

                                    </div>

                                </div>
                            );
                        }
                    )}

                </div>

            </div>


            {/* Bottom action */}

            <div className="result-actions">

                <Link
                    to="/create-interview"
                    className="primary-btn"
                >
                    Take Another Interview
                </Link>

                <Link
                    to="/dashboard"
                    className="secondary-btn"
                >
                    Return to Dashboard
                </Link>

            </div>

        </div>
    );
};

export default InterviewResult;