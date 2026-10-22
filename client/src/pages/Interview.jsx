import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
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

    // Face detection state and refs
    const detectorRef = useRef(null);
    const animFrameRef = useRef(null);
    const lastDetectTimeRef = useRef(0);
    const [faceCount, setFaceCount] = useState(null);

    // Tab switch detection state
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [showTabWarning, setShowTabWarning] = useState(false);

    const initDetector = async () => {
        if (detectorRef.current) return detectorRef.current;
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm"
            );
            const detector = await FaceDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
                },
                runningMode: "VIDEO"
            });
            detectorRef.current = detector;
            return detector;
        } catch (err) {
            console.error("Face detector initialization error:", err);
            return null;
        }
    };

    const startDetectionLoop = (detector) => {
        if (!detector) return;
        let active = true;

        const detectFrame = () => {
            if (!active) return;

            const video = videoRef.current;
            const now = performance.now();

            if (
                video &&
                video.readyState >= 2 &&
                !video.paused &&
                now - lastDetectTimeRef.current >= 250
            ) {
                lastDetectTimeRef.current = now;
                try {
                    const result = detector.detectForVideo(video, now);
                    const count = result?.detections ? result.detections.length : 0;
                    setFaceCount(count);
                } catch (e) {
                    console.error("Detection frame error:", e);
                }
            }

            animFrameRef.current = requestAnimationFrame(detectFrame);
        };

        animFrameRef.current = requestAnimationFrame(detectFrame);

        return () => {
            active = false;
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        };
    };

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
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        setFaceCount(null);

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
            if (detectorRef.current) {
                try {
                    detectorRef.current.close();
                } catch (e) {
                    console.error("Error closing detector:", e);
                }
                detectorRef.current = null;
            }
        };
    }, [interview?._id]);

    // Ensure video element srcObject is attached when camera turns on
    useEffect(() => {
        if (isCameraOn && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraOn]);

    // Manage face detection lifecycle when camera toggles
    useEffect(() => {
        let cleanupDetection = null;

        if (isCameraOn) {
            let isMounted = true;
            initDetector().then((detector) => {
                if (isMounted && detector && isCameraOn) {
                    cleanupDetection = startDetectionLoop(detector);
                }
            });

            return () => {
                isMounted = false;
                if (cleanupDetection) cleanupDetection();
                if (animFrameRef.current) {
                    cancelAnimationFrame(animFrameRef.current);
                    animFrameRef.current = null;
                }
                setFaceCount(null);
            };
        } else {
            setFaceCount(null);
        }
    }, [isCameraOn]);

    // Reset tab switch state when a new interview session loads or changes
    useEffect(() => {
        setTabSwitchCount(0);
        setShowTabWarning(false);
    }, [interview?._id]);

    // Detect when the interview tab becomes hidden using the visibilitychange event
    useEffect(() => {
        if (!interview?.questions || interview.questions.length === 0) {
            return;
        }

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setTabSwitchCount((prev) => prev + 1);
                setShowTabWarning(true);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [interview?._id, interview?.questions?.length]);

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
            setTabSwitchCount(0);
            setShowTabWarning(false);

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

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {tabSwitchCount > 0 && (
                        <span style={{
                            background: "#fef2f2",
                            color: "#b91c1c",
                            border: "1px solid #fecaca",
                            padding: "4px 10px",
                            borderRadius: "16px",
                            fontSize: "12px",
                            fontWeight: "600"
                        }}>
                            ⚠ Tab Switches: {tabSwitchCount}
                        </span>
                    )}

                    <div className="question-counter">
                        Question {currentIndex + 1} of{" "}
                        {interview.questions.length}
                    </div>
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

                    {/* Tab Switch Warning Banner */}
                    {showTabWarning && tabSwitchCount > 0 && (
                        <div style={{
                            marginBottom: "16px",
                            padding: "12px 16px",
                            background: "#fef2f2",
                            border: "1px solid #f87171",
                            borderRadius: "8px",
                            color: "#991b1b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            fontSize: "13px"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "16px" }}>⚠️</span>
                                <span>
                                    <strong>Tab Switch Warning:</strong> You switched tabs or minimized the browser during the interview. Please stay on this tab.
                                </span>
                            </div>
                            <span style={{
                                background: "#fee2e2",
                                color: "#991b1b",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontWeight: "700",
                                fontSize: "12px",
                                border: "1px solid #fca5a5",
                                whiteSpace: "nowrap"
                            }}>
                                Count: {tabSwitchCount}
                            </span>
                        </div>
                    )}

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

                            {isCameraOn && (
                                <div style={{
                                    position: "absolute",
                                    bottom: "8px",
                                    left: "8px",
                                    background: faceCount === 1
                                        ? "rgba(22, 163, 74, 0.85)"
                                        : faceCount === 0
                                            ? "rgba(220, 38, 38, 0.85)"
                                            : faceCount > 1
                                                ? "rgba(217, 119, 6, 0.9)"
                                                : "rgba(15, 23, 42, 0.75)",
                                    color: "#ffffff",
                                    padding: "4px 10px",
                                    borderRadius: "14px",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    backdropFilter: "blur(4px)"
                                }}>
                                    <span style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        background: faceCount === 1
                                            ? "#4ade80"
                                            : faceCount === 0
                                                ? "#f87171"
                                                : faceCount > 1
                                                    ? "#fde047"
                                                    : "#94a3b8",
                                        display: "inline-block"
                                    }} />
                                    {faceCount === 1
                                        ? "Face detected"
                                        : faceCount === 0
                                            ? "No face detected"
                                            : faceCount > 1
                                                ? "⚠ Multiple faces detected"
                                                : "Detecting..."}
                                </div>
                            )}

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

                        {isCameraOn && (
                            <>
                                <div style={{
                                    marginTop: "10px",
                                    padding: "8px 12px",
                                    borderRadius: "8px",
                                    background: faceCount === 1
                                        ? "#f0fdf4"
                                        : faceCount === 0
                                            ? "#fef2f2"
                                            : faceCount > 1
                                                ? "#fffbeb"
                                                : "#f8fafc",
                                    border: `1px solid ${
                                        faceCount === 1
                                            ? "#bbf7d0"
                                            : faceCount === 0
                                                ? "#fecaca"
                                                : faceCount > 1
                                                    ? "#fde68a"
                                                    : "#e2e8f0"
                                    }`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    fontSize: "12px",
                                    transition: "all 0.2s ease"
                                }}>
                                    <span style={{ color: "#475467", fontWeight: "500" }}>Face Status:</span>
                                    <span style={{
                                        fontWeight: "700",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        color: faceCount === 1
                                            ? "#15803d"
                                            : faceCount === 0
                                                ? "#b91c1c"
                                                : faceCount > 1
                                                    ? "#b45309"
                                                    : "#64748b"
                                    }}>
                                        <span style={{
                                            width: "7px",
                                            height: "7px",
                                            borderRadius: "50%",
                                            background: faceCount === 1
                                                ? "#16a34a"
                                                : faceCount === 0
                                                    ? "#dc2626"
                                                    : faceCount > 1
                                                        ? "#d97706"
                                                        : "#94a3b8",
                                            display: "inline-block"
                                        }} />
                                        {faceCount === 1
                                            ? "Face detected"
                                            : faceCount === 0
                                                ? "No face detected"
                                                : faceCount > 1
                                                    ? "Multiple faces detected"
                                                    : "Detecting..."}
                                    </span>
                                </div>

                                {faceCount > 1 && (
                                    <div style={{
                                        marginTop: "8px",
                                        padding: "8px 10px",
                                        background: "#fffbeb",
                                        border: "1px solid #f59e0b",
                                        borderRadius: "6px",
                                        color: "#92400e",
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px"
                                    }}>
                                        <span>⚠ Warning: Multiple faces detected in camera feed.</span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Tab Switch Status */}
                        <div style={{
                            marginTop: "10px",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: tabSwitchCount > 0 ? "#fef2f2" : "#f8fafc",
                            border: `1px solid ${tabSwitchCount > 0 ? "#fecaca" : "#e2e8f0"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "12px",
                            transition: "all 0.2s ease"
                        }}>
                            <span style={{ color: "#475467", fontWeight: "500" }}>Tab Switches:</span>
                            <span style={{
                                fontWeight: "700",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                color: tabSwitchCount > 0 ? "#b91c1c" : "#15803d"
                            }}>
                                {tabSwitchCount > 0 && "⚠ "}
                                {tabSwitchCount} {tabSwitchCount === 1 ? "switch" : "switches"}
                            </span>
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