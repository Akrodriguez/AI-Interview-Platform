import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const Landing = () => {
    const { isAuthenticated } = useAuth();

    return (
        <div className="landing-page">

            {/* Hero */}

            <section className="hero-section">

                <div className="hero-content">

                    <div className="hero-badge">
                        AI-Powered Interview Preparation
                    </div>

                    <h1>
                        Prepare Smarter.
                        <br />
                        <span>Interview Better.</span>
                    </h1>

                    <p>
                        Practice realistic technical interviews with AI,
                        receive detailed feedback, and understand exactly
                        where you can improve.
                    </p>

                    <div className="hero-buttons">

                        <Link
                            to={
                                isAuthenticated
                                    ? "/create-interview"
                                    : "/register"
                            }
                            className="primary-btn hero-btn"
                        >
                            Start Interview
                        </Link>

                        <a
                            href="#features"
                            className="secondary-btn hero-btn"
                        >
                            Explore Features
                        </a>

                    </div>

                </div>


                {/* Hero visual */}

                <div className="hero-visual">

                    <div className="ai-card">

                        <div className="ai-card-header">
                            <span>AI Interview</span>

                            <span className="live-indicator">
                                ● Live
                            </span>
                        </div>

                        <div className="mock-question">
                            <span>Question 3 of 10</span>

                            <h3>
                                Explain the difference between
                                SQL and NoSQL databases.
                            </h3>
                        </div>

                        <div className="mock-progress">
                            <div className="mock-progress-fill"></div>
                        </div>

                        <div className="mock-answer">
                            Your answer is being evaluated...
                        </div>

                    </div>

                </div>

            </section>


            {/* Features */}

            <section
                className="features-section"
                id="features"
            >

                <div className="section-title">

                    <p className="card-label">
                        WHY USE PREPPILOT
                    </p>

                    <h2>
                        Everything you need to prepare
                    </h2>

                    <p>
                        Practice, analyze, and improve your interview
                        performance in one place.
                    </p>

                </div>


                <div className="features-grid">

                    <div className="feature-card">

                        <div className="feature-icon">
                            AI
                        </div>

                        <h3>
                            AI Generated Interviews
                        </h3>

                        <p>
                            Get personalized interview questions based
                            on your role, experience, and technology stack.
                        </p>

                    </div>


                    <div className="feature-card">

                        <div className="feature-icon">
                            ✓
                        </div>

                        <h3>
                            Instant Evaluation
                        </h3>

                        <p>
                            Every answer is evaluated by AI based on
                            relevance, technical accuracy, and clarity.
                        </p>

                    </div>


                    <div className="feature-card">

                        <div className="feature-icon">
                            ↗
                        </div>

                        <h3>
                            Detailed Feedback
                        </h3>

                        <p>
                            Understand your strengths, weaknesses,
                            and what you should improve.
                        </p>

                    </div>


                    <div className="feature-card">

                        <div className="feature-icon">
                            10
                        </div>

                        <h3>
                            Performance Reports
                        </h3>

                        <p>
                            Review your overall score and detailed
                            question-by-question performance.
                        </p>

                    </div>

                </div>

            </section>


            {/* How it works */}

            <section className="how-section">

                <div className="section-title">

                    <p className="card-label">
                        HOW IT WORKS
                    </p>

                    <h2>
                        Your interview preparation in 3 steps
                    </h2>

                </div>


                <div className="steps-grid">

                    <div className="step-card">

                        <div className="step-number">
                            01
                        </div>

                        <h3>
                            Create an Interview
                        </h3>

                        <p>
                            Select your target role, experience level,
                            and technology stack.
                        </p>

                    </div>


                    <div className="step-card">

                        <div className="step-number">
                            02
                        </div>

                        <h3>
                            Take the Interview
                        </h3>

                        <p>
                            Answer AI-generated questions in a realistic
                            interview environment.
                        </p>

                    </div>


                    <div className="step-card">

                        <div className="step-number">
                            03
                        </div>

                        <h3>
                            Analyze Your Performance
                        </h3>

                        <p>
                            Receive your score, feedback, strengths,
                            weaknesses, and improvement suggestions.
                        </p>

                    </div>

                </div>

            </section>


            {/* CTA */}

            <section className="cta-section">

                <div>

                    <p className="card-label">
                        READY TO START?
                    </p>

                    <h2>
                        Turn interview anxiety into confidence.
                    </h2>

                    <p>
                        Practice with AI and prepare for your next
                        technical interview.
                    </p>

                </div>

                <Link
                    to={
                        isAuthenticated
                            ? "/create-interview"
                            : "/register"
                    }
                    className="primary-btn cta-btn"
                >
                    Start Practicing
                </Link>

            </section>


            {/* Footer */}

            <footer className="landing-footer">

                <div>
                    <strong>
                        PrepPilot
                    </strong>

                    <p>
                        AI-powered interview preparation platform.
                    </p>
                </div>

                <p>
                    © 2026 PrepPilot
                </p>

            </footer>

        </div>
    );
};

export default Landing;