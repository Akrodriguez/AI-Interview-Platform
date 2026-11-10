/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import api from "../services/api";

const FACE_NO_FACE_ALERT_MS = 5000;

const getCurrentTime = () => Date.now();
const getPerformanceTime = () => performance.now();


const Interview = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const detectorRef = useRef(null);
    const faceLossStartRef = useRef(null);
    const multipleFacesStartRef = useRef(null);
    const activeIssueRef = useRef(null);
    const proctoringBufferRef = useRef([]);
    const monitorLoopRef = useRef(null);
    const monitorFaceRef = useRef(null);

    const [interview, setInterview] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answer, setAnswer] = useState("");
    const [followUpMode, setFollowUpMode] = useState(false);
    const [followUpQuestion, setFollowUpQuestion] = useState("");
    const [followUpAnswer, setFollowUpAnswer] = useState("");
    const [followUpQuestionIndex, setFollowUpQuestionIndex] = useState(null);

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
    const [completing, setCompleting] = useState(false);

    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [cameraStatus, setCameraStatus] = useState("Camera Disabled");
    const [cameraError, setCameraError] = useState("");
    const [faceStatus, setFaceStatus] = useState("Waiting for camera");
    const [faceCount, setFaceCount] = useState(null);
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [showTabWarning, setShowTabWarning] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [proctoringEvents, setProctoringEvents] = useState([]);
    const noFaceAlertedRef = useRef(false);
    const multipleFacesAlertedRef = useRef(false);

    const [error, setError] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState("Voice input ready");
    const [voiceError, setVoiceError] = useState("");
    const recognitionRef = useRef(null);

    const applyVoiceText = (text) => {
        const sanitizedText = text || "";

        if (isFollowUpQuestion) {
            setFollowUpAnswer(sanitizedText);
            return;
        }

        setAnswer(sanitizedText);
    };

    const stopVoiceRecognition = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        setIsListening(false);
        setVoiceStatus("Voice input ready");
    };

    const startVoiceRecognition = async () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setVoiceError("Speech recognition is not supported in this browser. Please use the text answer box instead.");
            setVoiceStatus("Voice input unavailable");
            return;
        }

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            }
        } catch {
            setVoiceError("Microphone permission was denied. Please allow microphone access and try again.");
            setVoiceStatus("Permission denied");
            return;
        }

        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = true;
        recognition.continuous = true;
        recognitionRef.current = recognition;

        recognition.onstart = () => {
            setIsListening(true);
            setVoiceError("");
            setVoiceStatus("Listening... speak now");
        };

        recognition.onresult = (event) => {
            let transcript = "";

            for (let i = 0; i < event.results.length; i += 1) {
                transcript += event.results[i][0].transcript;
            }

            const finalTranscript = transcript.trim();

            if (!finalTranscript) {
                setVoiceError("No speech detected. Please try again.");
                return;
            }

            applyVoiceText(finalTranscript);
            setVoiceStatus("Transcript captured. Review and edit before submitting.");
        };

        recognition.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        console.error("Speech Recognition Event:", event);

        const errorMessages = {
            "not-allowed": "Microphone access denied. Check browser permissions.",
            "service-not-allowed": "Speech recognition service is blocked.",
            "no-speech": "No speech detected. Please try again.",
            "audio-capture": "No microphone detected or microphone unavailable.",
            "network": "Network error in speech recognition service.",
            "aborted": "Speech recognition was interrupted.",
            "language-not-supported": "Selected language is not supported."
        };

        setVoiceError(
            errorMessages[event.error] ||
            `Speech recognition error: ${event.error}`
        );

        setVoiceStatus("Voice input unavailable");
        setIsListening(false);
    };

        recognition.onend = () => {
            setIsListening(false);
            setVoiceStatus((current) => (
                current === "Listening... speak now" ? "Voice input ready" : current
            ));
        };

        recognition.start();
    };

    const addProctoringEvent = useCallback((eventType, details = "", duration = 0) => {
        const event = {
            eventType,
            details,
            duration,
            timestamp: new Date().toISOString(),
        };

        setProctoringEvents((prev) => [...prev, event]);
        proctoringBufferRef.current.push(event);

        if (proctoringBufferRef.current.length >= 1) {
            api.post(`/interviews/${id}/proctoring`, {
                events: proctoringBufferRef.current,
            }).catch(() => {
                // Intentionally ignore storage errors so the interview can continue.
            });
            proctoringBufferRef.current = [];
        }
    }, [id]);

    const stopCamera = useCallback(() => {
        const wasEnabled = Boolean(streamRef.current);

        if (monitorLoopRef.current) {
            cancelAnimationFrame(monitorLoopRef.current);
            monitorLoopRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setCameraEnabled(false);
        setFaceCount(null);
        setCameraStatus("Camera Disabled");
        setFaceStatus("Camera disabled");
        setAlertMessage("Camera is disabled. Please enable your camera to continue proctoring.");

        if (wasEnabled) {
            addProctoringEvent("camera_disabled", "Camera turned off during interview.");
        }
    }, [addProctoringEvent]);

    const setupFaceDetector = useCallback(async () => {
        if (detectorRef.current) {
            return;
        }

        const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        detectorRef.current = await FaceDetector.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            minDetectionConfidence: 0.5,
            minSuppressionThreshold: 0.3,
        });
    }, []);

    const startCamera = useCallback(async () => {
        try {
            setCameraError("");
            setCameraStatus("Starting camera...");

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("This browser does not support camera access.");
            }

            await setupFaceDetector();

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: false,
            });

            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setCameraEnabled(true);
            setCameraStatus("Camera Active");
            setFaceStatus("Monitoring face visibility");
            setAlertMessage("");
        } catch (error) {
            setCameraEnabled(false);
            setCameraStatus("Camera Disabled");
            setFaceStatus("Camera unavailable");

            if (error.name === "NotAllowedError") {
                setCameraError("Camera permission was denied. Please allow camera access to enable proctoring.");
                addProctoringEvent("camera_permission_denied", "Camera access was denied by the browser.");
            } else if (error.name === "NotFoundError") {
                setCameraError("No camera was found on this device.");
                addProctoringEvent("camera_unavailable", "No camera was detected by the browser.");
            } else {
                setCameraError(error.message || "Unable to access the camera.");
            }
        }
    }, [setupFaceDetector, addProctoringEvent]);

    const monitorFace = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || !cameraEnabled) {
        return;
    }

    const video = videoRef.current;

    if (video.readyState >= 2) {
        const detectionResult = detectorRef.current.detectForVideo(
            video,
            getPerformanceTime()
        );

        const detectionCount = detectionResult?.detections?.length || 0;
        setFaceCount(detectionCount);

        if (detectionCount > 1) {
            faceLossStartRef.current = null;
            noFaceAlertedRef.current = false;

            if (!multipleFacesAlertedRef.current) {
                multipleFacesStartRef.current = getCurrentTime();
                activeIssueRef.current = "multiple_faces";
                multipleFacesAlertedRef.current = true;
                setFaceStatus("Multiple faces detected");
                setAlertMessage("Multiple faces detected. Please ensure you are interviewing alone.");
                addProctoringEvent("multiple_faces", "More than one face detected in the camera frame.");
            }
        } else if (detectionCount === 0) {
            if (!faceLossStartRef.current) {
                faceLossStartRef.current = getCurrentTime();
                activeIssueRef.current = "face_not_detected";
                setFaceStatus("No face detected");
                setAlertMessage("Face not detected. Please stay in front of the camera.");
            }

            const elapsed = getCurrentTime() - faceLossStartRef.current;

            if (elapsed >= FACE_NO_FACE_ALERT_MS && !noFaceAlertedRef.current) {
                noFaceAlertedRef.current = true;
                addProctoringEvent("face_not_detected", `No face detected for ${elapsed} ms.`, elapsed);
            }
        } else {
            if (activeIssueRef.current === "face_not_detected") {
                const duration = getCurrentTime() - (faceLossStartRef.current || getCurrentTime());

                if (noFaceAlertedRef.current && duration >= FACE_NO_FACE_ALERT_MS) {
                    addProctoringEvent("face_not_detected", "Face returned after a no-face event.", duration);
                }

                noFaceAlertedRef.current = false;
                faceLossStartRef.current = null;
            }

            if (activeIssueRef.current === "multiple_faces") {
                const duration = getCurrentTime() - (multipleFacesStartRef.current || getCurrentTime());

                if (multipleFacesAlertedRef.current) {
                    addProctoringEvent("multiple_faces", "Multiple-face condition ended.", duration);
                }

                multipleFacesAlertedRef.current = false;
                multipleFacesStartRef.current = null;
            }

            activeIssueRef.current = null;
            setFaceStatus("Face detected");
            setAlertMessage("");
        }
    }

    monitorLoopRef.current = requestAnimationFrame(() => {
        monitorFaceRef.current?.();
    });
}, [cameraEnabled, addProctoringEvent]);

useEffect(() => {
    monitorFaceRef.current = monitorFace;
}, [monitorFace]);

    const fetchInterview = useCallback(async () => {
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
    }, [id]);

    useEffect(() => {
        fetchInterview();
    }, [fetchInterview]);


    // Request camera stream when the interview loads and cleanup on page leave
    useEffect(() => {
        if (interview?.questions?.length > 0) {
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

            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    console.error("Error stopping speech recognition:", e);
                }

                recognitionRef.current = null;
            }
        };
    }, [interview?._id, interview?.questions?.length, startCamera, stopCamera]);

    // Keep the video element connected to the current camera stream.
    useEffect(() => {
        if (cameraEnabled && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [cameraEnabled]);

    // Run the single proctoring face-detection loop while the camera is enabled.
    useEffect(() => {
        if (!cameraEnabled) {
            setFaceCount(null);
            return undefined;
        }

        monitorLoopRef.current = requestAnimationFrame(monitorFace);

        return () => {
            if (monitorLoopRef.current) {
                cancelAnimationFrame(monitorLoopRef.current);
                monitorLoopRef.current = null;
            }
        };
    }, [cameraEnabled, monitorFace]);

    // Reset tab-switch warnings when a new interview loads
    useEffect(() => {
        setTabSwitchCount(0);
        setShowTabWarning(false);
    }, [interview?._id]);

    // Detect when the active interview tab becomes hidden
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
    }, [interview?._id, interview?.questions]);

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

    const submitCurrentAnswer = async (isFinalQuestion = false) => {
        if (!answer.trim()) {
            setError("Please enter an answer before continuing.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const response = await api.post(
                `/interviews/${id}/answer`,
                {
                    questionIndex: currentIndex,
                    answer,
                }
            );

            const nextFollowUpQuestion = response.data?.followUpQuestion;

            if (nextFollowUpQuestion) {
                setFollowUpQuestion(nextFollowUpQuestion);
                setFollowUpQuestionIndex(currentIndex);
                setFollowUpAnswer("");
                setFollowUpMode(true);
                setAnswer("");
                return;
            }

            if (isFinalQuestion) {
                await completeInterview();
                return;
            }

            if (currentIndex < interview.questions.length - 1) {
                const nextIndex = currentIndex + 1;

                setCurrentIndex(nextIndex);
                setAnswer(interview.questions[nextIndex].answer || "");
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

    const submitFollowUpAnswer = async () => {
        if (!followUpAnswer.trim()) {
            setError("Please answer the follow-up question before continuing.");
            return;
        }

        try {
            setFollowUpSubmitting(true);
            setError("");

            await api.post(
                `/interviews/${id}/follow-up-answer`,
                {
                    questionIndex: followUpQuestionIndex ?? currentIndex,
                    answer: followUpAnswer,
                    followUpQuestion,
                }
            );

            if (currentIndex === interview.questions.length - 1) {
                await completeInterview();
                return;
            }

            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            setAnswer(interview.questions[nextIndex].answer || "");
            setFollowUpMode(false);
            setFollowUpQuestion("");
            setFollowUpAnswer("");
            setFollowUpQuestionIndex(null);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to submit follow-up answer"
            );
        } finally {
            setFollowUpSubmitting(false);
        }
    };

    const completeInterview = async () => {
        try {
            setCompleting(true);
            setError("");

            if (streamRef.current) {
                stopCamera();
            }

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
    const isFollowUpQuestion = followUpMode && !!followUpQuestion;
    const activeQuestionText = isFollowUpQuestion ? followUpQuestion : question.question;
    const activeAnswerValue = isFollowUpQuestion ? followUpAnswer : answer;
    const activeAnswerSetter = isFollowUpQuestion ? setFollowUpAnswer : setAnswer;
    const activeQuestionLabel = isFollowUpQuestion ? "Follow-up Question" : `Question ${currentIndex + 1}`;

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
                gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 320px)",
                gap: "24px",
                alignItems: "start"
            }}>
                <div className="interview-main-col">
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
                            <span><strong>Tab Switch Warning:</strong> You switched tabs or minimized the browser. Please stay on this tab.</span>
                            <strong>Count: {tabSwitchCount}</strong>
                        </div>
                    )}

                    <div className="question-card">
                        <span className={`question-label ${isFollowUpQuestion ? "follow-up-label" : ""}`}>
                            {activeQuestionLabel}
                        </span>
                        {isFollowUpQuestion && (
                            <div className="follow-up-banner">Follow-up based on your previous answer</div>
                        )}
                        <h2>{activeQuestionText}</h2>
                    </div>

                    <div className="answer-section">
                        <div className="answer-header-row">
                            <label>{isFollowUpQuestion ? "Your Follow-up Answer" : "Your Answer"}</label>
                            <div className="voice-controls">
                                <button
                                    type="button"
                                    className={`voice-toggle-btn ${isListening ? "recording" : ""}`}
                                    onClick={() => isListening ? stopVoiceRecognition() : startVoiceRecognition()}
                                    disabled={submitting || completing || followUpSubmitting}
                                >
                                    {isListening ? "Stop" : "🎙️ Mic"}
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={activeAnswerValue}
                            onChange={(e) => activeAnswerSetter(e.target.value)}
                            placeholder={isFollowUpQuestion ? "Type your follow-up answer here..." : "Type your answer here..."}
                            rows="10"
                            disabled={submitting || completing || followUpSubmitting}
                        />
                        <div className="voice-status-row">
                            <span className={`voice-status ${isListening ? "active" : ""}`}>{voiceStatus}</span>
                            {voiceError && <span className="voice-error">{voiceError}</span>}
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    {proctoringEvents.length > 0 && (
                        <div className="proctoring-mini-summary">
                            <strong>Latest observation:</strong> {proctoringEvents[proctoringEvents.length - 1].eventType}
                        </div>
                    )}

                    {isFollowUpQuestion ? (
                        <button className="btn btn-primary" onClick={submitFollowUpAnswer} disabled={followUpSubmitting || completing}>
                            {followUpSubmitting ? "Submitting Follow-up..." : "Submit Follow-up Answer"}
                        </button>
                    ) : !isLastQuestion ? (
                        <button className="btn btn-primary" onClick={() => submitCurrentAnswer(false)} disabled={submitting || completing}>
                            {submitting ? "Saving Answer..." : "Submit & Next"}
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={() => submitCurrentAnswer(true)} disabled={submitting || completing}>
                            {completing ? "Generating Report..." : "Finish Interview"}
                        </button>
                    )}
                </div>

                <aside className="interview-camera-col">
                    <div className="camera-card" style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "16px",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <strong>Live Webcam</strong>
                            <span className={cameraEnabled ? "camera-status active" : "camera-status disabled"}>{cameraStatus}</span>
                        </div>

                        <div style={{ width: "100%", height: "200px", background: "#0f172a", borderRadius: "8px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: cameraEnabled ? "block" : "none", transform: "scaleX(-1)" }}
                            />
                            {cameraEnabled && (
                                <div style={{ position: "absolute", bottom: "8px", left: "8px", background: faceCount === 1 ? "rgba(22, 163, 74, 0.85)" : faceCount === 0 ? "rgba(220, 38, 38, 0.85)" : faceCount > 1 ? "rgba(217, 119, 6, 0.9)" : "rgba(15, 23, 42, 0.75)", color: "#fff", padding: "4px 10px", borderRadius: "14px", fontSize: "11px", fontWeight: "600" }}>
                                    {faceCount === 1 ? "Face detected" : faceCount === 0 ? "No face detected" : faceCount > 1 ? "⚠ Multiple faces detected" : "Detecting..."}
                                </div>
                            )}
                            {!cameraEnabled && (
                                <div style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", padding: "14px" }}>
                                    {cameraError || "Camera is turned off"}
                                </div>
                            )}
                        </div>

                        <div className="camera-meta"><strong>Face Detection:</strong> {faceStatus}</div>
                        {cameraError && <div className="proctoring-alert error">{cameraError}</div>}
                        {alertMessage && <div className="proctoring-alert warning">{alertMessage}</div>}
                        {faceCount > 1 && (
                            <div className="proctoring-alert warning">⚠ Warning: Multiple faces detected in camera feed.</div>
                        )}

                        <div style={{ marginTop: "10px", padding: "8px 12px", borderRadius: "8px", background: tabSwitchCount > 0 ? "#fef2f2" : "#f8fafc", border: `1px solid ${tabSwitchCount > 0 ? "#fecaca" : "#e2e8f0"}`, display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                            <span>Tab Switches:</span>
                            <strong>{tabSwitchCount}</strong>
                        </div>

                        <button
                            type="button"
                            onClick={() => cameraEnabled ? stopCamera() : startCamera()}
                            className={`btn ${cameraEnabled ? "btn-secondary" : "btn-primary"}`}
                            style={{ width: "100%", marginTop: "12px" }}
                        >
                            {cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default Interview;