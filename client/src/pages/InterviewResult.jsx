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
        return <h2>Loading interview report...</h2>;
    }

    if (error) {
        return (
            <div>
                <h2>Error</h2>
                <p>{error}</p>

                <Link to="/dashboard">
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    if (!interview) {
        return <p>Interview not found.</p>;
    }

    return (
        <div>
            <h1>Interview Report</h1>

            <h2>{interview.role}</h2>

            <p>
                Experience: {interview.experience} years
            </p>

            <p>
                Tech Stack: {interview.techStack.join(", ")}
            </p>

            <hr />

            <h2>Overall Score</h2>

            <h1>
                {interview.overallScore}/10
            </h1>

            <hr />

            <h2>Summary</h2>

            <p>
                {interview.summary}
            </p>

            <h2>Strengths</h2>

            {Array.isArray(interview.strengths) ? (
                <ul>
                    {interview.strengths.map((strength, index) => (
                        <li key={index}>
                            {strength}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>{interview.strengths}</p>
            )}

            <h2>Weaknesses</h2>

            {Array.isArray(interview.weaknesses) ? (
                <ul>
                    {interview.weaknesses.map((weakness, index) => (
                        <li key={index}>
                            {weakness}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>{interview.weaknesses}</p>
            )}

            <h2>Recommendation</h2>

            <p>
                {interview.recommendation}
            </p>

            <hr />

            <h2>Question Performance</h2>

            {interview.questions.map((question, index) => (
                <div key={question._id || index}>
                    <h3>
                        Question {index + 1}
                    </h3>

                    <p>
                        <strong>Question:</strong>{" "}
                        {question.question}
                    </p>

                    <p>
                        <strong>Your Answer:</strong>{" "}
                        {question.answer}
                    </p>

                    <p>
                        <strong>Score:</strong>{" "}
                        {question.score}/10
                    </p>

                    <p>
                        <strong>Feedback:</strong>{" "}
                        {question.feedback}
                    </p>

                    {question.improvement && (
                        <p>
                            <strong>Improvement:</strong>{" "}
                            {question.improvement}
                        </p>
                    )}

                    <hr />
                </div>
            ))}

            <Link to="/dashboard">
                <button>
                    Back to Dashboard
                </button>
            </Link>
        </div>
    );
};

export default InterviewResult;