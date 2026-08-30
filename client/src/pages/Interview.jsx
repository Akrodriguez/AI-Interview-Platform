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
    const [feedback, setFeedback] = useState(null);

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
            setFeedback(null);

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
            setError("Please enter an answer");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const response = await api.post(
                `/interviews/${id}/answer`,
                {
                    questionIndex: currentIndex,
                    answer
                }
            );

            const updatedQuestion = response.data.question;

            setFeedback(updatedQuestion);

            setInterview((prev) => {
                const updatedQuestions = [...prev.questions];

                updatedQuestions[currentIndex] = updatedQuestion;

                return {
                    ...prev,
                    questions: updatedQuestions
                };
            });

        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to evaluate answer"
            );
        } finally {
            setSubmitting(false);
        }
    };

    const nextQuestion = () => {
        if (currentIndex < interview.questions.length - 1) {
            const nextIndex = currentIndex + 1;

            setCurrentIndex(nextIndex);
            setAnswer(
                interview.questions[nextIndex].answer || ""
            );
            setFeedback(null);
            setError("");
        }
    };

    const previousQuestion = () => {
        if (currentIndex > 0) {
            const previousIndex = currentIndex - 1;

            setCurrentIndex(previousIndex);
            setAnswer(
                interview.questions[previousIndex].answer || ""
            );
            setFeedback(null);
            setError("");
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
        return <h2>Loading interview...</h2>;
    }

    if (error && !interview) {
        return <p>{error}</p>;
    }

    if (!interview) {
        return <p>Interview not found</p>;
    }

    if (!interview.questions || interview.questions.length === 0) {
        return (
            <div>
                <h1>{interview.role} Interview</h1>

                <p>
                    Experience: {interview.experience} years
                </p>

                <p>
                    Tech Stack:{" "}
                    {interview.techStack.join(", ")}
                </p>

                {error && <p>{error}</p>}

                <button
                    onClick={generateQuestions}
                    disabled={generating}
                >
                    {generating
                        ? "Generating Questions..."
                        : "Generate AI Questions"}
                </button>
            </div>
        );
    }

    const question = interview.questions[currentIndex];

    return (
        <div>
            <h1>{interview.role} Interview</h1>

            <p>
                Question {currentIndex + 1} of{" "}
                {interview.questions.length}
            </p>

            <h2>{question.question}</h2>

            <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows="8"
                disabled={!!feedback}
            />

            {error && <p>{error}</p>}

            {!feedback ? (
                <button
                    onClick={submitAnswer}
                    disabled={submitting}
                >
                    {submitting
                        ? "Evaluating..."
                        : "Submit Answer"}
                </button>
            ) : (
                <div>
                    <h3>AI Evaluation</h3>

                    <p>
                        <strong>Score:</strong>{" "}
                        {feedback.score}/10
                    </p>

                    <p>
                        <strong>Feedback:</strong>{" "}
                        {feedback.feedback}
                    </p>

                    {feedback.improvement && (
                        <p>
                            <strong>Improvement:</strong>{" "}
                            {feedback.improvement}
                        </p>
                    )}

                    <div>
                        <button
                            onClick={previousQuestion}
                            disabled={currentIndex === 0}
                        >
                            Previous
                        </button>

                        {currentIndex <
                        interview.questions.length - 1 ? (
                            <button onClick={nextQuestion}>
                                Next Question
                            </button>
                        ) : (
                            <button
                                onClick={completeInterview}
                                disabled={completing}
                            >
                                {completing
                                    ? "Generating Report..."
                                    : "Complete Interview"}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Interview;