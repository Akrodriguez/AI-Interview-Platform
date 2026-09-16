import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

const Interview = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [interview, setInterview] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answer, setAnswer] = useState("");

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [completing, setCompleting] = useState(false);

    const [error, setError] = useState("");

    const fetchInterview = async () => {
        try {
            const response = await api.get(`/interviews/${id}`);

            setInterview(response.data.interview);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to load interview"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInterview();
    }, [id]);

    const generateQuestions = async () => {
        try {
            setGenerating(true);
            setError("");

            const response = await api.post(
                `/interviews/${id}/generate`
            );

            setInterview(response.data.interview);
            setCurrentIndex(0);
            setAnswer("");

        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to generate questions"
            );
        } finally {
            setGenerating(false);
        }
    };

    const submitAnswer = async () => {
        if (!answer.trim()) {
            setError("Please enter an answer before continuing.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            await api.post(
                `/interviews/${id}/answer`,
                {
                    questionIndex: currentIndex,
                    answer
                }
            );

            // Move to next question
            if (
                currentIndex <
                interview.questions.length - 1
            ) {
                const nextIndex = currentIndex + 1;

                setCurrentIndex(nextIndex);

                setAnswer(
                    interview.questions[nextIndex].answer || ""
                );
            }

        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to submit answer"
            );
        } finally {
            setSubmitting(false);
        }
    };

    const completeInterview = async () => {
        try {
            setCompleting(true);
            setError("");

            const response = await api.post(
                `/interviews/${id}/complete`
            );

            navigate(`/interview/${id}/result`, {
                state: {
                    report: response.data.report
                }
            });

        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to complete interview"
            );
        } finally {
            setCompleting(false);
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading">
                    Loading interview...
                </div>
            </div>
        );
    }

    if (error && !interview) {
        return (
            <div className="page-container">
                <div className="error-message">
                    {error}
                </div>
            </div>
        );
    }

    if (!interview) {
        return (
            <div className="page-container">
                <p>Interview not found.</p>
            </div>
        );
    }

    /*
     * No questions yet
     */
    if (
        !interview.questions ||
        interview.questions.length === 0
    ) {
        return (
            <div className="page-container">

                <div className="interview-intro">

                    <h1>{interview.role} Interview</h1>

                    <p>
                        {interview.experience} years experience
                    </p>

                    <div className="tech-stack">
                        {interview.techStack.map(
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

                    {interview.description && (
                        <p>
                            {interview.description}
                        </p>
                    )}

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        onClick={generateQuestions}
                        disabled={generating}
                    >
                        {generating
                            ? "Generating Questions..."
                            : "Start AI Interview"}
                    </button>

                </div>

            </div>
        );
    }

    const question = interview.questions[currentIndex];

    const isLastQuestion =
        currentIndex === interview.questions.length - 1;

    const progress =
        ((currentIndex + 1) /
            interview.questions.length) *
        100;

    return (
        <div className="page-container">

            <div className="interview-header">

                <div>
                    <h1>{interview.role} Interview</h1>

                    <p>
                        {interview.techStack.join(" • ")}
                    </p>
                </div>

                <div className="question-counter">
                    Question {currentIndex + 1} of{" "}
                    {interview.questions.length}
                </div>

            </div>

            {/* Progress Bar */}

            <div className="progress-container">

                <div
                    className="progress-bar"
                    style={{
                        width: `${progress}%`
                    }}
                />

            </div>

            {/* Question */}

            <div className="question-card">

                <span className="question-label">
                    Question {currentIndex + 1}
                </span>

                <h2>
                    {question.question}
                </h2>

            </div>

            {/* Answer */}

            <div className="answer-section">

                <label>
                    Your Answer
                </label>

                <textarea
                    value={answer}
                    onChange={(e) =>
                        setAnswer(e.target.value)
                    }
                    placeholder="Type your answer here..."
                    rows="10"
                    disabled={submitting || completing}
                />

            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {/* Action */}

            {!isLastQuestion ? (

                <button
                    className="btn btn-primary"
                    onClick={submitAnswer}
                    disabled={submitting}
                >
                    {submitting
                        ? "Saving Answer..."
                        : "Submit & Next"}
                </button>

            ) : (

                <button
                    className="btn btn-primary"
                    onClick={async () => {

                        if (!answer.trim()) {
                            setError(
                                "Please answer the final question."
                            );
                            return;
                        }

                        try {
                            setSubmitting(true);

                            await api.post(
                                `/interviews/${id}/answer`,
                                {
                                    questionIndex:
                                        currentIndex,
                                    answer
                                }
                            );

                            await completeInterview();

                        } catch (error) {
                            setError(
                                error.response?.data?.message ||
                                "Failed to complete interview"
                            );
                        } finally {
                            setSubmitting(false);
                        }

                    }}
                    disabled={
                        submitting ||
                        completing
                    }
                >
                    {completing
                        ? "Generating Report..."
                        : "Finish Interview"}
                </button>

            )}

        </div>
    );
};

export default Interview;