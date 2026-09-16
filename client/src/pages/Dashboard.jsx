import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const Dashboard = () => {
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchInterviews = async () => {
        try {
            const response = await api.get("/interviews");

            setInterviews(response.data.interviews);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to load interviews"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInterviews();
    }, []);

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading">
                    Loading your interviews...
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">

            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>

                    <p>
                        Practice, evaluate and improve your
                        interview skills.
                    </p>
                </div>

                <Link
                    to="/create-interview"
                    className="btn btn-primary"
                >
                    + Create Interview
                </Link>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {interviews.length === 0 ? (

                <div className="empty-state">

                    <h3>No interviews yet</h3>

                    <p>
                        Create your first AI-powered interview
                        and start practicing.
                    </p>

                    <Link
                        to="/create-interview"
                        className="btn btn-primary"
                    >
                        Create Your First Interview
                    </Link>

                </div>

            ) : (

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

                            <Link
                                to={`/interview/${interview._id}`}
                                className="card-link"
                            >
                                Open Interview →
                            </Link>

                        </div>

                    ))}

                </div>

            )}

        </div>
    );
};

export default Dashboard;