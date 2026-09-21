import { useEffect, useRef, useState } from "react";
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

    // Camera state and refs
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [cameraError, setCameraError] = useState("");

    const startCamera = async () => {
        try {
            setCameraError("");
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setIsCameraOn(true);
            } else {
                setCameraError("Webcam is not supported in this browser.");
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setCameraError("Camera permission denied or device unavailable.");
            setIsCameraOn(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraOn(false);
    };

    const toggleCamera = () => {
        if (isCameraOn) {
            stopCamera();
        } else {
            startCamera();
        }
    };

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

    // Request camera stream when the interview loads and cleanup on page leave
    useEffect(() => {
        if (interview) {
            startCamera();
        }

        return () => {
            stopCamera();
        };
    }, [interview?._id]);

    // Ensure video element srcObject is attached when camera turns on
    useEffect(() => {
        if (isCameraOn && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraOn]);

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

            // Stop camera before navigation
            stopCamera();

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

            <div className="interview-content-grid" style={{
                display: "grid",
                gridTemplateColumns: "1fr minmax(260px, 320px)",
                gap: "24px",
                alignItems: "start"
            }}>

                {/* Main Question & Answer Column */}
                <div className="interview-main-col">

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

                {/* Live Video / Webcam Panel */}
                <div className="interview-camera-col">

                    <div className="camera-card" style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "16px",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
                    }}>

                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "12px"
                        }}>
                            <span style={{
                                fontSize: "13px",
                                fontWeight: "700",
                                color: "#475467",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px"
                            }}>
                                Live Webcam
                            </span>

                            <span style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "12px",
                                fontWeight: "600",
                                color: isCameraOn ? "#16a34a" : "#dc2626"
                            }}>
                                <span style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background: isCameraOn ? "#16a34a" : "#dc2626",
                                    display: "inline-block"
                                }} />
                                {isCameraOn ? "Active" : "Off"}
                            </span>
                        </div>

                        <div style={{
                            width: "100%",
                            height: "200px",
                            background: "#0f172a",
                            borderRadius: "8px",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative"
                        }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: isCameraOn ? "block" : "none",
                                    transform: "scaleX(-1)"
                                }}
                            />

                            {!isCameraOn && (
                                <div style={{
                                    color: "#94a3b8",
                                    fontSize: "13px",
                                    textAlign: "center",
                                    padding: "14px"
                                }}>
                                    {cameraError ? cameraError : "Camera is turned off"}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={toggleCamera}
                            className={`btn ${isCameraOn ? "btn-secondary" : "btn-primary"}`}
                            style={{
                                width: "100%",
                                marginTop: "12px",
                                fontSize: "13px",
                                padding: "9px 14px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                            }}
                        >
                            {isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
                        </button>

                    </div>

                </div>

            </div>

        </div>
    );
};

export default Interview;