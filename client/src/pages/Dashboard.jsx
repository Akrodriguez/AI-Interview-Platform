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
        return <h2>Loading interviews...</h2>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <div>
            <h1>Dashboard</h1>

            <Link to="/create-interview">
                <button>Create Interview</button>
            </Link>

            <h2>Your Interviews</h2>

            {interviews.length === 0 ? (
                <p>No interviews created yet.</p>
            ) : (
                interviews.map((interview) => (
                    <div key={interview._id}>
                        <h3>{interview.role}</h3>

                        <p>
                            Experience: {interview.experience} years
                        </p>

                        <p>
                            Tech Stack:{" "}
                            {interview.techStack.join(", ")}
                        </p>

                        <Link
                            to={`/interview/${interview._id}`}
                        >
                            View Interview
                        </Link>
                    </div>
                ))
            )}
        </div>
    );
};

export default Dashboard;