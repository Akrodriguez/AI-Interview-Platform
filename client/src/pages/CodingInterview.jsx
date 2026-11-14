/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import api from "../services/api";

// Lazy-load Monaco so it doesn't inflate the initial bundle
const Editor = lazy(() => import("@monaco-editor/react"));

const FACE_NO_FACE_ALERT_MS = 5000;
const getCurrentTime = () => Date.now();
const getPerformanceTime = () => performance.now();

// Language display labels
const LANGUAGE_LABELS = {
    python: "Python 3",
    javascript: "JavaScript",
    cpp: "C++",
};

// Map our language keys to Monaco language identifiers
const MONACO_LANGUAGE = {
    python: "python",
    javascript: "javascript",
    cpp: "cpp",
};

// Default starter codes if not provided by problem
const STARTER_CODES = {
    python: `def solution():
    # Write your solution here
    pass

solution()
`,
    javascript: `function solution() {
    // Write your solution here
}

solution();
`,
    cpp: `#include <iostream>
using namespace std;

int main() {
    // Write your solution here
    return 0;
}
`,
};

const CodingInterview = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // Problem & editor state
    const [codingInterview, setCodingInterview] = useState(null);
    const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
    const [selectedLanguage, setSelectedLanguage] = useState("python");
    const [code, setCode] = useState("");
    const [customInput, setCustomInput] = useState("");

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [running, setRunning] = useState(false);
    const [submittingSolution, setSubmittingSolution] = useState(false);
    const [completing, setCompleting] = useState(false);

    const [error, setError] = useState("");
    const [saveStatus, setSaveStatus] = useState(""); // "saved" | "saving" | ""
    const [submitSuccess, setSubmitSuccess] = useState(false);

    // Terminal execution result
    const [runResult, setRunResult] = useState(null);
    const [executionError, setExecutionError] = useState("");

    // Auto-save timer ref
    const autoSaveTimerRef = useRef(null);
    const isDirtyRef = useRef(false);

    // Code cache across problems and languages: key `${probIndex}_${lang}`
    const codeCacheRef = useRef({});

    // -------------------------------------------------------------------------
    // Proctoring & Anti-Cheating State & Refs
    // -------------------------------------------------------------------------
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const detectorRef = useRef(null);
    const monitorLoopRef = useRef(null);
    const monitorFaceRef = useRef(null);
    const faceLossStartRef = useRef(null);
    const multipleFacesStartRef = useRef(null);
    const noFaceAlertedRef = useRef(false);
    const multipleFacesAlertedRef = useRef(false);
    const proctoringBufferRef = useRef([]);
    const editorListenersCleanupRef = useRef(null);
    const violationTimeoutRef = useRef(null);

    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [cameraStatus, setCameraStatus] = useState("Camera Disabled");
    const [cameraError, setCameraError] = useState("");
    const [faceStatus, setFaceStatus] = useState("Waiting for camera");
    const [faceCount, setFaceCount] = useState(null);

    // Anti-cheating counters
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [noFaceDetectedCount, setNoFaceDetectedCount] = useState(0);
    const [multipleFaceDetectedCount, setMultipleFaceDetectedCount] = useState(0);
    const [copyAttemptCount, setCopyAttemptCount] = useState(0);
    const [pasteAttemptCount, setPasteAttemptCount] = useState(0);
    const [cutAttemptCount, setCutAttemptCount] = useState(0);
    const [dragDropAttemptCount, setDragDropAttemptCount] = useState(0);
    const [fullscreenExitCount, setFullscreenExitCount] = useState(0);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [violationWarning, setViolationWarning] = useState(null);
    const [proctoringEvents, setProctoringEvents] = useState([]);

    // Keep latest counters in a ref to avoid stale closures in event listeners
    const proctoringCountsRef = useRef({
        tabSwitchCount: 0,
        noFaceDetectedCount: 0,
        multipleFaceDetectedCount: 0,
        copyAttemptCount: 0,
        pasteAttemptCount: 0,
        cutAttemptCount: 0,
        dragDropAttemptCount: 0,
        fullscreenExitCount: 0,
    });

    // -------------------------------------------------------------------------
    // Backend Proctoring Event Synchronization
    // -------------------------------------------------------------------------
    const recordProctoringEvent = useCallback((eventType, details = "", duration = 0) => {
        const event = {
            eventType,
            details,
            message: details,
            duration,
            count: 1,
            timestamp: new Date().toISOString(),
        };

        setProctoringEvents((prev) => [...prev, event]);
        proctoringBufferRef.current.push(event);

        if (proctoringBufferRef.current.length >= 1) {
            api.post(`/coding-interviews/${id}/proctoring`, {
                events: proctoringBufferRef.current,
                ...proctoringCountsRef.current,
            }).catch(() => {
                // Intentionally ignore network errors so the candidate's interview is uninterrupted
            });
            proctoringBufferRef.current = [];
        }
    }, [id]);

    const triggerViolationWarning = useCallback((type, message) => {
        let eventType = "";

        if (type === "paste") {
            eventType = "paste_attempt";
            setPasteAttemptCount((prev) => {
                const next = prev + 1;
                proctoringCountsRef.current.pasteAttemptCount = next;
                return next;
            });
        } else if (type === "copy") {
            eventType = "copy_attempt";
            setCopyAttemptCount((prev) => {
                const next = prev + 1;
                proctoringCountsRef.current.copyAttemptCount = next;
                return next;
            });
        } else if (type === "cut") {
            eventType = "cut_attempt";
            setCutAttemptCount((prev) => {
                const next = prev + 1;
                proctoringCountsRef.current.cutAttemptCount = next;
                return next;
            });
        } else if (type === "drag_drop") {
            eventType = "drag_drop_attempt";
            setDragDropAttemptCount((prev) => {
                const next = prev + 1;
                proctoringCountsRef.current.dragDropAttemptCount = next;
                return next;
            });
        } else if (type === "tab_switch") {
            eventType = "tab_switch";
            setTabSwitchCount((prev) => {
                const next = prev + 1;
                proctoringCountsRef.current.tabSwitchCount = next;
                return next;
            });
        } else if (type === "fullscreen_exit") {
            eventType = "fullscreen_exit";
            setFullscreenExitCount((prev) => {
                const next = prev + 1;
                proctoringCountsRef.current.fullscreenExitCount = next;
                return next;
            });
        } else if (type === "no_face") {
            eventType = "face_not_detected";
            setNoFaceDetectedCount((prev) => {
                const next = prev + 1;
                proctoringCountsRef.current.noFaceDetectedCount = next;
                return next;
            });
        } else if (type === "multiple_faces") {
            eventType = "multiple_faces";
            setMultipleFaceDetectedCount((prev) => {
                const next = prev + 1;
                proctoringCountsRef.current.multipleFaceDetectedCount = next;
                return next;
            });
        }

        setViolationWarning({
            type,
            message,
            timestamp: Date.now(),
        });

        recordProctoringEvent(eventType || type, message);

        if (violationTimeoutRef.current) {
            clearTimeout(violationTimeoutRef.current);
        }
        violationTimeoutRef.current = setTimeout(() => {
            setViolationWarning(null);
        }, 6500);
    }, [recordProctoringEvent]);

    // -------------------------------------------------------------------------
    // MediaPipe Camera & Face Detection
    // -------------------------------------------------------------------------
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

        if (wasEnabled) {
            recordProctoringEvent("camera_disabled", "Camera turned off during coding interview.");
        }
    }, [recordProctoringEvent]);

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
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => {});
            }
            setCameraEnabled(true);
            setCameraStatus("Camera Active");
            setFaceStatus("Monitoring face visibility");
        } catch (error) {
            setCameraEnabled(false);
            setCameraStatus("Camera Disabled");
            setFaceStatus("Camera unavailable");

            if (error.name === "NotAllowedError") {
                setCameraError("Camera permission was denied. Please allow camera access to enable proctoring.");
                recordProctoringEvent("camera_permission_denied", "Camera access was denied by candidate/browser.");
            } else if (error.name === "NotFoundError") {
                setCameraError("No camera was found on this device.");
                recordProctoringEvent("camera_unavailable", "No camera was detected by the browser.");
            } else {
                setCameraError(error.message || "Unable to access the camera.");
            }
        }
    }, [setupFaceDetector, recordProctoringEvent]);

    const monitorFace = useCallback(async () => {
        if (!videoRef.current || !detectorRef.current || !cameraEnabled) {
            return;
        }

        const video = videoRef.current;

        if (video.readyState >= 2) {
            try {
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
                        multipleFacesAlertedRef.current = true;
                        setFaceStatus("Multiple faces detected");
                        triggerViolationWarning(
                            "multiple_faces",
                            "Multiple faces detected. Only the candidate should be present."
                        );
                    }
                } else if (detectionCount === 0) {
                    if (!faceLossStartRef.current) {
                        faceLossStartRef.current = getCurrentTime();
                        setFaceStatus("No face detected");
                    }

                    const elapsed = getCurrentTime() - faceLossStartRef.current;
                    if (elapsed >= FACE_NO_FACE_ALERT_MS && !noFaceAlertedRef.current) {
                        noFaceAlertedRef.current = true;
                        triggerViolationWarning(
                            "no_face",
                            "No face detected. Please remain visible in front of the camera."
                        );
                    }
                } else {
                    // Exactly 1 face detected
                    if (noFaceAlertedRef.current) {
                        const duration = getCurrentTime() - (faceLossStartRef.current || getCurrentTime());
                        recordProctoringEvent("face_not_detected", "Face returned after a no-face event.", duration);
                    }
                    if (multipleFacesAlertedRef.current) {
                        const duration = getCurrentTime() - (multipleFacesStartRef.current || getCurrentTime());
                        recordProctoringEvent("multiple_faces", "Multiple-face condition resolved.", duration);
                    }

                    noFaceAlertedRef.current = false;
                    multipleFacesAlertedRef.current = false;
                    faceLossStartRef.current = null;
                    multipleFacesStartRef.current = null;
                    setFaceStatus("Face detected");
                }
            } catch (_) {
                // Ignore transient frame detection error
            }
        }

        monitorLoopRef.current = requestAnimationFrame(() => {
            monitorFaceRef.current?.();
        });
    }, [cameraEnabled, triggerViolationWarning, recordProctoringEvent]);

    useEffect(() => {
        monitorFaceRef.current = monitorFace;
    }, [monitorFace]);

    // Keep video element connected to camera stream
    useEffect(() => {
        if (cameraEnabled && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [cameraEnabled]);

    // Run single face detection loop while camera is active
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

    // -------------------------------------------------------------------------
    // Tab-Switch & Fullscreen Detection
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!codingInterview?.problems?.length) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                triggerViolationWarning(
                    "tab_switch",
                    "Warning: Switching tabs or leaving the interview window is not allowed. This activity is being recorded."
                );
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [codingInterview?.problems?.length, triggerViolationWarning]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFull = Boolean(document.fullscreenElement);
            setIsFullscreen(isFull);
            if (!isFull && codingInterview?.problems?.length > 0) {
                triggerViolationWarning(
                    "fullscreen_exit",
                    "Warning: Fullscreen exited. Please remain in fullscreen mode during the interview."
                );
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, [codingInterview?.problems?.length, triggerViolationWarning]);

    // -------------------------------------------------------------------------
    // Monaco Editor Copy-Paste & Drag-Drop Prevention
    // -------------------------------------------------------------------------
    const handleEditorMount = (editor, monaco) => {
        // Clean up previous listeners if any
        if (editorListenersCleanupRef.current) {
            editorListenersCleanupRef.current();
            editorListenersCleanupRef.current = null;
        }

        // 1. Intercept keyboard shortcuts inside Monaco Editor
        editor.onKeyDown((e) => {
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            // Paste shortcuts: Ctrl+V, Cmd+V, Ctrl+Shift+V, Cmd+Shift+V
            if (isCtrlOrCmd && (e.code === "KeyV" || e.keyCode === monaco.KeyCode.KeyV)) {
                e.preventDefault();
                e.stopPropagation();
                triggerViolationWarning(
                    "paste",
                    "Copy-pasting is not allowed during this coding interview. Please write your code manually."
                );
                return;
            }

            // Shift+Insert (paste shortcut on Windows/Linux)
            if (e.shiftKey && (e.code === "Insert" || e.keyCode === monaco.KeyCode.Insert)) {
                e.preventDefault();
                e.stopPropagation();
                triggerViolationWarning(
                    "paste",
                    "Copy-pasting is not allowed during this coding interview. Please write your code manually."
                );
                return;
            }

            // Copy shortcuts: Ctrl+C, Cmd+C
            if (isCtrlOrCmd && (e.code === "KeyC" || e.keyCode === monaco.KeyCode.KeyC)) {
                e.preventDefault();
                e.stopPropagation();
                triggerViolationWarning("copy", "Copying code is restricted during this interview.");
                return;
            }

            // Ctrl+Insert (copy shortcut on Windows)
            if (isCtrlOrCmd && (e.code === "Insert" || e.keyCode === monaco.KeyCode.Insert)) {
                e.preventDefault();
                e.stopPropagation();
                triggerViolationWarning("copy", "Copying code is restricted during this interview.");
                return;
            }

            // Cut shortcuts: Ctrl+X, Cmd+X
            if (isCtrlOrCmd && (e.code === "KeyX" || e.keyCode === monaco.KeyCode.KeyX)) {
                e.preventDefault();
                e.stopPropagation();
                triggerViolationWarning("cut", "Cutting code is restricted during this interview.");
                return;
            }
        });

        // 2. Intercept DOM events on editor DOM container (capture phase)
        const domNode = editor.getDomNode();
        if (domNode) {
            const onPasteCapture = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerViolationWarning(
                    "paste",
                    "Copy-pasting is not allowed during this coding interview. Please write your code manually."
                );
            };

            const onCopyCapture = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerViolationWarning("copy", "Copying code is restricted during this interview.");
            };

            const onCutCapture = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerViolationWarning("cut", "Cutting code is restricted during this interview.");
            };

            const onContextMenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };

            const onDragOver = (e) => {
                e.preventDefault();
            };

            const onDropCapture = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerViolationWarning(
                    "drag_drop",
                    "Drag-and-drop code insertion is not allowed. Please write your code manually."
                );
            };

            domNode.addEventListener("paste", onPasteCapture, true);
            domNode.addEventListener("copy", onCopyCapture, true);
            domNode.addEventListener("cut", onCutCapture, true);
            domNode.addEventListener("contextmenu", onContextMenu, true);
            domNode.addEventListener("dragover", onDragOver, true);
            domNode.addEventListener("drop", onDropCapture, true);

            editorListenersCleanupRef.current = () => {
                domNode.removeEventListener("paste", onPasteCapture, true);
                domNode.removeEventListener("copy", onCopyCapture, true);
                domNode.removeEventListener("cut", onCutCapture, true);
                domNode.removeEventListener("contextmenu", onContextMenu, true);
                domNode.removeEventListener("dragover", onDragOver, true);
                domNode.removeEventListener("drop", onDropCapture, true);
            };
        }
    };

    // -------------------------------------------------------------------------
    // Interview Lifecycle & Initialization
    // -------------------------------------------------------------------------
    useEffect(() => {
        const fetchCodingInterview = async () => {
            try {
                const response = await api.get(`/coding-interviews/${id}`);
                const data = response.data.codingInterview;
                setCodingInterview(data);

                // Restore persisted proctoring counters from database
                const initialCounts = {
                    tabSwitchCount: data.tabSwitchCount || 0,
                    noFaceDetectedCount: data.noFaceDetectedCount || 0,
                    multipleFaceDetectedCount: data.multipleFaceDetectedCount || 0,
                    copyAttemptCount: data.copyAttemptCount || 0,
                    pasteAttemptCount: data.pasteAttemptCount || 0,
                    cutAttemptCount: data.cutAttemptCount || 0,
                    dragDropAttemptCount: data.dragDropAttemptCount || 0,
                    fullscreenExitCount: data.fullscreenExitCount || 0,
                };
                proctoringCountsRef.current = { ...initialCounts };
                setTabSwitchCount(initialCounts.tabSwitchCount);
                setNoFaceDetectedCount(initialCounts.noFaceDetectedCount);
                setMultipleFaceDetectedCount(initialCounts.multipleFaceDetectedCount);
                setCopyAttemptCount(initialCounts.copyAttemptCount);
                setPasteAttemptCount(initialCounts.pasteAttemptCount);
                setCutAttemptCount(initialCounts.cutAttemptCount);
                setDragDropAttemptCount(initialCounts.dragDropAttemptCount);
                setFullscreenExitCount(initialCounts.fullscreenExitCount);

                const initialLang = data.language || "python";
                setSelectedLanguage(initialLang);

                if (data.problems?.length > 0) {
                    const firstProb = data.problems[0];
                    const initialCode =
                        firstProb.solution ||
                        firstProb.starterCode ||
                        STARTER_CODES[initialLang] ||
                        "";
                    setCode(initialCode);
                    codeCacheRef.current[`0_${initialLang}`] = initialCode;

                    setCustomInput(firstProb.customInput || firstProb.exampleInput || "");

                    if (firstProb.execStatus) {
                        setRunResult({
                            stdout: firstProb.stdout,
                            stderr: firstProb.stderr,
                            compileOutput: firstProb.compileOutput,
                            execStatus: firstProb.execStatus,
                            execTime: firstProb.execTime,
                            memoryUsed: firstProb.memoryUsed,
                        });
                    }
                }
            } catch (err) {
                setError(
                    err.response?.data?.message || "Failed to load coding interview."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchCodingInterview();
    }, [id]);

    // Request camera when problems are available and cleanup on unmount
    useEffect(() => {
        if (codingInterview?.problems?.length > 0) {
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

            if (editorListenersCleanupRef.current) {
                try {
                    editorListenersCleanupRef.current();
                } catch (_) {}
                editorListenersCleanupRef.current = null;
            }

            if (violationTimeoutRef.current) {
                clearTimeout(violationTimeoutRef.current);
            }

            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [codingInterview?._id, codingInterview?.problems?.length, startCamera, stopCamera]);

    // -------------------------------------------------------------------------
    // Code Synchronization & Switching
    // -------------------------------------------------------------------------
    const switchProblem = (index) => {
        if (!codingInterview?.problems) return;

        codeCacheRef.current[`${currentProblemIndex}_${selectedLanguage}`] = code;

        if (isDirtyRef.current) {
            triggerAutoSave(currentProblemIndex, code);
        }

        const nextProblem = codingInterview.problems[index];
        const cacheKey = `${index}_${selectedLanguage}`;
        const nextCode =
            codeCacheRef.current[cacheKey] ||
            nextProblem.solution ||
            nextProblem.starterCode ||
            STARTER_CODES[selectedLanguage] ||
            "";

        setCode(nextCode);
        setCurrentProblemIndex(index);
        setError("");
        setExecutionError("");
        setSubmitSuccess(false);

        setCustomInput(nextProblem.customInput || nextProblem.exampleInput || "");

        if (nextProblem.execStatus) {
            setRunResult({
                stdout: nextProblem.stdout,
                stderr: nextProblem.stderr,
                compileOutput: nextProblem.compileOutput,
                execStatus: nextProblem.execStatus,
                execTime: nextProblem.execTime,
                memoryUsed: nextProblem.memoryUsed,
            });
        } else {
            setRunResult(null);
        }
    };

    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        if (newLang === selectedLanguage) return;

        codeCacheRef.current[`${currentProblemIndex}_${selectedLanguage}`] = code;

        const targetCacheKey = `${currentProblemIndex}_${newLang}`;
        const targetCode =
            codeCacheRef.current[targetCacheKey] ||
            STARTER_CODES[newLang] ||
            "";

        setSelectedLanguage(newLang);
        setCode(targetCode);
        isDirtyRef.current = true;
        triggerAutoSave(currentProblemIndex, targetCode);
    };

    const triggerAutoSave = (problemIndex, codeValue) => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        setSaveStatus("saving");

        autoSaveTimerRef.current = setTimeout(async () => {
            try {
                await api.post(`/coding-interviews/${id}/save-code`, {
                    problemIndex,
                    code: codeValue,
                });
                setCodingInterview((prev) => {
                    if (!prev) return prev;
                    const updated = { ...prev };
                    updated.problems = [...prev.problems];
                    updated.problems[problemIndex] = {
                        ...updated.problems[problemIndex],
                        solution: codeValue,
                    };
                    return updated;
                });
                setSaveStatus("saved");
                isDirtyRef.current = false;
                setTimeout(() => setSaveStatus(""), 2000);
            } catch (_) {
                setSaveStatus("");
            }
        }, 1200);
    };

    const handleCodeChange = (newCode) => {
        const val = newCode || "";
        setCode(val);
        isDirtyRef.current = true;
        triggerAutoSave(currentProblemIndex, val);
    };

    const handleGenerateProblems = async () => {
        try {
            setGenerating(true);
            setError("");

            const response = await api.post(`/coding-interviews/${id}/generate`);
            const updated = response.data.codingInterview;
            setCodingInterview(updated);

            if (updated.problems?.length > 0) {
                const firstProb = updated.problems[0];
                const initialLang = updated.language || "python";
                setSelectedLanguage(initialLang);
                const initialCode =
                    firstProb.solution ||
                    firstProb.starterCode ||
                    STARTER_CODES[initialLang] ||
                    "";
                setCode(initialCode);
                codeCacheRef.current[`0_${initialLang}`] = initialCode;
                setCustomInput(firstProb.customInput || firstProb.exampleInput || "");
            }
        } catch (err) {
            setError(
                err.response?.data?.message || "Failed to generate problems."
            );
        } finally {
            setGenerating(false);
        }
    };

    // -------------------------------------------------------------------------
    // Run & Submit Code Handlers
    // -------------------------------------------------------------------------
    const handleRunCode = async () => {
        if (running || submittingSolution) return;

        if (!code.trim()) {
            setError("Please write some code before running.");
            return;
        }

        try {
            setRunning(true);
            setError("");
            setExecutionError("");
            setRunResult(null);

            const response = await api.post(`/coding-interviews/${id}/run`, {
                problemIndex: currentProblemIndex,
                code,
                language: selectedLanguage,
                stdin: customInput,
            });

            const result = response.data.result;
            setRunResult(result);

            setCodingInterview((prev) => {
                if (!prev) return prev;
                const updated = { ...prev };
                updated.problems = [...prev.problems];
                updated.problems[currentProblemIndex] = {
                    ...updated.problems[currentProblemIndex],
                    solution: code,
                    customInput,
                    stdout: result.stdout,
                    stderr: result.stderr,
                    compileOutput: result.compileOutput,
                    execStatus: result.execStatus,
                    execTime: result.execTime,
                    memoryUsed: result.memoryUsed,
                };
                return updated;
            });
        } catch (err) {
            const msg =
                err.response?.data?.message ||
                err.message ||
                "Failed to execute code in sandbox.";
            setExecutionError(msg);
        } finally {
            setRunning(false);
        }
    };

    const handleSubmitSolution = async () => {
        if (running || submittingSolution) return;

        if (!code.trim()) {
            setError("Please write some code before submitting.");
            return;
        }

        try {
            setSubmittingSolution(true);
            setError("");
            setExecutionError("");
            setSubmitSuccess(false);

            const response = await api.post(`/coding-interviews/${id}/submit`, {
                problemIndex: currentProblemIndex,
                code,
                language: selectedLanguage,
                stdin: customInput,
            });

            const result = response.data.result;
            const updatedProblem = response.data.problem;
            setRunResult(result);
            setSubmitSuccess(true);

            setCodingInterview((prev) => {
                if (!prev) return prev;
                const updated = { ...prev };
                updated.problems = [...prev.problems];
                updated.problems[currentProblemIndex] = {
                    ...updated.problems[currentProblemIndex],
                    ...updatedProblem,
                };
                return updated;
            });

            setTimeout(() => setSubmitSuccess(false), 4000);
        } catch (err) {
            const msg =
                err.response?.data?.message ||
                err.message ||
                "Failed to submit solution.";
            setExecutionError(msg);
        } finally {
            setSubmittingSolution(false);
        }
    };

    const handleFinishInterview = async () => {
        if (completing) return;

        try {
            setCompleting(true);
            // Save code and sync final proctoring logs
            await api.post(`/coding-interviews/${id}/save-code`, {
                problemIndex: currentProblemIndex,
                code,
            }).catch(() => {});

            await api.post(`/coding-interviews/${id}/proctoring`, {
                events: proctoringBufferRef.current,
                ...proctoringCountsRef.current,
            }).catch(() => {});

            await api.post(`/coding-interviews/${id}/complete`).catch(() => {});
        } finally {
            stopCamera();
            setCompleting(false);
            navigate(`/coding-interview/${id}/result`);
        }
    };

    // -------------------------------------------------------------------------
    // Loading / error states
    // -------------------------------------------------------------------------
    if (loading) {
        return (
            <div className="page-container">
                <div className="loading">Loading coding interview...</div>
            </div>
        );
    }

    if (error && !codingInterview) {
        return (
            <div className="page-container">
                <div className="error-message">{error}</div>
                <Link to="/dashboard" className="btn btn-secondary" style={{ marginTop: "16px" }}>
                    ← Dashboard
                </Link>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // Intro screen: interview has no problems generated yet
    // -------------------------------------------------------------------------
    if (!codingInterview?.problems?.length) {
        return (
            <div className="page-container">
                <div className="interview-intro">
                    <span style={{
                        display: "inline-block",
                        background: "#eef2ff",
                        color: "#4f46e5",
                        padding: "5px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "700",
                        letterSpacing: "0.5px",
                        marginBottom: "18px"
                    }}>
                        CODING INTERVIEW
                    </span>

                    <h1>{codingInterview?.title || "Coding Interview"}</h1>

                    <p style={{ marginTop: "8px" }}>
                        <strong>Language:</strong>{" "}
                        {LANGUAGE_LABELS[codingInterview?.language] || codingInterview?.language}
                        {" "}·{" "}
                        <strong>Difficulty:</strong>{" "}
                        <span style={{ textTransform: "capitalize" }}>
                            {codingInterview?.difficulty}
                        </span>
                        {codingInterview?.topic && (
                            <>
                                {" "}·{" "}
                                <strong>Topic:</strong> {codingInterview.topic}
                            </>
                        )}
                    </p>

                    <p style={{ marginTop: "6px" }}>
                        <strong>Problems:</strong> {codingInterview?.problemCount || 3}
                    </p>

                    <div style={{
                        marginTop: "20px",
                        padding: "16px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        textAlign: "left",
                        fontSize: "13px",
                        color: "#475467",
                        maxWidth: "540px",
                        margin: "20px auto 0 auto"
                    }}>
                        <strong style={{ color: "#1e293b", display: "block", marginBottom: "6px" }}>
                            🔒 Proctoring & Integrity Notice
                        </strong>
                        <ul style={{ paddingLeft: "18px", margin: 0, lineHeight: "1.6" }}>
                            <li>Webcam face detection verifies candidate presence throughout the session.</li>
                            <li>Browser tab switching and window minimization are monitored and logged.</li>
                            <li>Copying or pasting external code into the editor is strictly prevented.</li>
                        </ul>
                    </div>

                    {error && (
                        <div className="error-message" style={{ marginTop: "16px" }}>
                            {error}
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        style={{ marginTop: "24px" }}
                        onClick={handleGenerateProblems}
                        disabled={generating}
                    >
                        {generating ? "Generating Problems…" : "Start Coding Interview"}
                    </button>
                </div>
            </div>
        );
    }

    const problem = codingInterview.problems[currentProblemIndex];
    const totalProblems = codingInterview.problems.length;
    const progress = ((currentProblemIndex + 1) / totalProblems) * 100;
    const isLastProblem = currentProblemIndex === totalProblems - 1;

    // Execution status badge
    const getStatusBadge = () => {
        if (!runResult) return null;
        const id = runResult.statusId;
        const desc = runResult.execStatus || "Completed";

        if (id === 3) {
            return { bg: "#16a34a", text: "#ffffff", label: `✓ ${desc}` };
        }
        if (id === 6) {
            return { bg: "#dc2626", text: "#ffffff", label: `✕ Compilation Error` };
        }
        if (id === 5) {
            return { bg: "#d97706", text: "#ffffff", label: `⏱ Time Limit Exceeded` };
        }
        if (id >= 7 && id <= 12) {
            return { bg: "#b91c1c", text: "#ffffff", label: `⚠ Runtime Error (${desc})` };
        }
        return { bg: "#475467", text: "#ffffff", label: desc };
    };

    const statusBadge = getStatusBadge();

    return (
        <div className="page-container" style={{ maxWidth: "1440px", padding: "24px 20px" }}>

            {/* ---- Sticky Proctoring Violation Alert Banner ---- */}
            {violationWarning && (
                <div style={{
                    marginBottom: "16px",
                    padding: "12px 18px",
                    background: violationWarning.type === "multiple_faces" || violationWarning.type === "copy" ? "#fffbeb" : "#fef2f2",
                    border: `1px solid ${violationWarning.type === "multiple_faces" || violationWarning.type === "copy" ? "#fcd34d" : "#f87171"}`,
                    borderRadius: "10px",
                    color: violationWarning.type === "multiple_faces" || violationWarning.type === "copy" ? "#92400e" : "#991b1b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "14px",
                    fontSize: "13px",
                    fontWeight: "500",
                    boxShadow: "0 4px 12px rgba(220, 38, 38, 0.08)",
                    animation: "fadeIn 0.2s ease-in-out",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "18px" }}>
                            {violationWarning.type === "paste" ? "🚫" : violationWarning.type === "copy" || violationWarning.type === "cut" ? "📋" : violationWarning.type === "tab_switch" ? "⚠" : violationWarning.type === "fullscreen_exit" ? "🖥️" : "👤"}
                        </span>
                        <span>
                            <strong>{violationWarning.message}</strong>
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setViolationWarning(null)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "inherit",
                            cursor: "pointer",
                            fontSize: "16px",
                            fontWeight: "700",
                            padding: "2px 6px"
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* ---- Header & Proctoring Status Toolbar ---- */}
            <div className="interview-header" style={{ marginBottom: "16px" }}>
                <div>
                    <h1 style={{ fontSize: "22px", marginBottom: "4px" }}>
                        {codingInterview.title || "Coding Interview"}
                    </h1>
                    <p style={{ fontSize: "13px" }}>
                        {LANGUAGE_LABELS[selectedLanguage] || selectedLanguage} · {codingInterview.difficulty} difficulty
                        {problem.submitted && (
                            <span style={{
                                marginLeft: "10px",
                                background: "#dcfce7",
                                color: "#15803d",
                                padding: "2px 8px",
                                borderRadius: "10px",
                                fontWeight: "700",
                                fontSize: "11px",
                            }}>
                                ✓ Submitted
                            </span>
                        )}
                    </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    {/* Face status badge */}
                    <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "5px 12px",
                        borderRadius: "16px",
                        fontSize: "12px",
                        fontWeight: "600",
                        background: faceCount === 1 ? "#dcfce7" : faceCount === 0 ? "#fee2e2" : faceCount > 1 ? "#fef3c7" : "#f1f5f9",
                        color: faceCount === 1 ? "#15803d" : faceCount === 0 ? "#b91c1c" : faceCount > 1 ? "#b45309" : "#475467",
                        border: `1px solid ${faceCount === 1 ? "#bbf7d0" : faceCount === 0 ? "#fecaca" : faceCount > 1 ? "#fde68a" : "#e2e8f0"}`,
                    }}>
                        <span style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: faceCount === 1 ? "#16a34a" : faceCount === 0 ? "#dc2626" : faceCount > 1 ? "#d97706" : "#94a3b8"
                        }} />
                        {faceCount === 1 ? "Face Detected" : faceCount === 0 ? "No Face Detected" : faceCount > 1 ? "Multiple Faces" : "Camera Initializing"}
                    </span>

                    {/* Tab switches pill */}
                    {tabSwitchCount > 0 && (
                        <span style={{
                            background: "#fee2e2",
                            color: "#b91c1c",
                            border: "1px solid #fecaca",
                            padding: "5px 10px",
                            borderRadius: "16px",
                            fontSize: "12px",
                            fontWeight: "600"
                        }}>
                            ⚠ Tabs: {tabSwitchCount}
                        </span>
                    )}

                    {/* Paste attempts pill */}
                    {pasteAttemptCount > 0 && (
                        <span style={{
                            background: "#fee2e2",
                            color: "#991b1b",
                            border: "1px solid #fecaca",
                            padding: "5px 10px",
                            borderRadius: "16px",
                            fontSize: "12px",
                            fontWeight: "600"
                        }}>
                            🚫 Pastes: {pasteAttemptCount}
                        </span>
                    )}

                    {/* Fullscreen toggle button */}
                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        style={{
                            background: isFullscreen ? "#312e81" : "#f1f5f9",
                            color: isFullscreen ? "#e0e7ff" : "#475467",
                            border: "1px solid #cbd5e1",
                            padding: "5px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer"
                        }}
                    >
                        {isFullscreen ? "Exit Fullscreen" : "⛶ Fullscreen"}
                    </button>

                    {/* Auto-save indicator */}
                    {saveStatus === "saving" && (
                        <span style={{ fontSize: "12px", color: "#667085" }}>Saving…</span>
                    )}
                    {saveStatus === "saved" && (
                        <span style={{ fontSize: "12px", color: "#16a34a" }}>✓ Saved</span>
                    )}

                    <div className="question-counter">
                        Problem {currentProblemIndex + 1} / {totalProblems}
                    </div>
                </div>
            </div>

            {/* ---- Progress bar ---- */}
            <div className="progress-container" style={{ marginBottom: "16px" }}>
                <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>

            {/* ---- Problem navigation tabs ---- */}
            <div style={{
                display: "flex",
                gap: "8px",
                marginBottom: "20px",
                flexWrap: "wrap",
                alignItems: "center"
            }}>
                {codingInterview.problems.map((p, idx) => (
                    <button
                        key={idx}
                        onClick={() => switchProblem(idx)}
                        style={{
                            padding: "6px 14px",
                            borderRadius: "20px",
                            border: "1px solid",
                            borderColor: idx === currentProblemIndex ? "#4f46e5" : "#d0d5dd",
                            background: idx === currentProblemIndex ? "#4f46e5" : "#ffffff",
                            color: idx === currentProblemIndex ? "#ffffff" : "#475467",
                            fontSize: "13px",
                            fontWeight: idx === currentProblemIndex ? "700" : "500",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                        }}
                    >
                        {p.submitted && (
                            <span style={{ fontSize: "11px", color: idx === currentProblemIndex ? "#bbf7d0" : "#16a34a" }}>
                                ✓
                            </span>
                        )}
                        Problem {idx + 1}
                    </button>
                ))}
            </div>

            {/* ---- Workspace Grid: Left Column (Webcam + Problem) & Right Column (Monaco + Terminal) ---- */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)",
                gap: "24px",
                alignItems: "start",
            }}>

                {/* ==== Left Column ==== */}
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

                    {/* 1. Live Webcam Proctoring Card */}
                    <div style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "16px",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "14px" }}>📹</span>
                                <strong style={{ fontSize: "13px", color: "#1e293b" }}>Webcam Proctoring</strong>
                            </div>
                            <span style={{
                                fontSize: "11px",
                                fontWeight: "600",
                                padding: "2px 8px",
                                borderRadius: "10px",
                                background: cameraEnabled ? "#dcfce7" : "#f1f5f9",
                                color: cameraEnabled ? "#15803d" : "#64748b"
                            }}>
                                {cameraStatus}
                            </span>
                        </div>

                        {/* Video Feed Window */}
                        <div style={{
                            width: "100%",
                            height: "160px",
                            background: "#0f172a",
                            borderRadius: "8px",
                            overflow: "hidden",
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
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
                                    display: cameraEnabled ? "block" : "none",
                                    transform: "scaleX(-1)"
                                }}
                            />

                            {/* Status Pill Overlay */}
                            {cameraEnabled && (
                                <div style={{
                                    position: "absolute",
                                    bottom: "8px",
                                    left: "8px",
                                    background: faceCount === 1
                                        ? "rgba(22, 163, 74, 0.9)"
                                        : faceCount === 0
                                            ? "rgba(220, 38, 38, 0.9)"
                                            : faceCount > 1
                                                ? "rgba(217, 119, 6, 0.95)"
                                                : "rgba(15, 23, 42, 0.8)",
                                    color: "#ffffff",
                                    padding: "3px 9px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    backdropFilter: "blur(4px)"
                                }}>
                                    {faceCount === 1
                                        ? "✓ Face detected"
                                        : faceCount === 0
                                            ? "⚠ No face detected"
                                            : faceCount > 1
                                                ? "⚠ Multiple faces detected"
                                                : "Analyzing..."}
                                </div>
                            )}

                            {!cameraEnabled && (
                                <div style={{ color: "#94a3b8", fontSize: "12px", textAlign: "center", padding: "14px" }}>
                                    {cameraError || "Camera is turned off."}
                                </div>
                            )}
                        </div>

                        {/* Status Message */}
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
                            <strong>Detection Status:</strong> {faceStatus}
                        </div>

                        {cameraError && (
                            <div style={{
                                marginTop: "8px",
                                padding: "8px 10px",
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                borderRadius: "6px",
                                color: "#b91c1c",
                                fontSize: "12px"
                            }}>
                                {cameraError}
                            </div>
                        )}

                        {/* Anti-Cheating Monitoring Summary Table */}
                        <div style={{
                            marginTop: "12px",
                            padding: "10px",
                            background: "#f8fafc",
                            border: "1px solid #edf0f5",
                            borderRadius: "8px",
                            fontSize: "11px"
                        }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", color: "#475467" }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span>Tab Switches:</span>
                                    <strong style={{ color: tabSwitchCount > 0 ? "#dc2626" : "#1e293b" }}>{tabSwitchCount}</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span>Paste Attempts:</span>
                                    <strong style={{ color: pasteAttemptCount > 0 ? "#dc2626" : "#1e293b" }}>{pasteAttemptCount}</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span>Copy Attempts:</span>
                                    <strong style={{ color: copyAttemptCount > 0 ? "#d97706" : "#1e293b" }}>{copyAttemptCount}</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span>Cut Attempts:</span>
                                    <strong style={{ color: cutAttemptCount > 0 ? "#d97706" : "#1e293b" }}>{cutAttemptCount}</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span>Drag & Drops:</span>
                                    <strong style={{ color: dragDropAttemptCount > 0 ? "#dc2626" : "#1e293b" }}>{dragDropAttemptCount}</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span>Fullscreen Exits:</span>
                                    <strong style={{ color: fullscreenExitCount > 0 ? "#dc2626" : "#1e293b" }}>{fullscreenExitCount}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Camera Toggle Button */}
                        <button
                            type="button"
                            onClick={() => (cameraEnabled ? stopCamera() : startCamera())}
                            className={`btn ${cameraEnabled ? "btn-secondary" : "btn-primary"}`}
                            style={{
                                width: "100%",
                                marginTop: "12px",
                                fontSize: "12px",
                                padding: "6px 12px"
                            }}
                        >
                            {cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
                        </button>
                    </div>

                    {/* 2. Problem Statement Card */}
                    <div style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "20px",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <span style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                letterSpacing: "0.8px",
                                color: "#667085",
                                textTransform: "uppercase"
                            }}>
                                Problem {currentProblemIndex + 1} of {totalProblems}
                            </span>
                            <span style={{
                                fontSize: "11px",
                                fontWeight: "600",
                                padding: "2px 8px",
                                borderRadius: "10px",
                                background: "#f1f5f9",
                                color: "#475467",
                                textTransform: "capitalize"
                            }}>
                                {codingInterview.difficulty}
                            </span>
                        </div>

                        <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "12px" }}>
                            {problem.title || `Problem ${currentProblemIndex + 1}`}
                        </h2>

                        <div style={{
                            fontSize: "13px",
                            lineHeight: "1.7",
                            color: "#334155",
                            whiteSpace: "pre-wrap"
                        }}>
                            {problem.problem}
                        </div>
                    </div>

                    {/* 3. Example I/O */}
                    {(problem.exampleInput || problem.exampleOutput) && (
                        <div style={{
                            background: "#f8fafc",
                            border: "1px solid #e5e7eb",
                            borderRadius: "10px",
                            padding: "16px",
                        }}>
                            <p style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                letterSpacing: "0.8px",
                                color: "#667085",
                                marginBottom: "10px",
                                textTransform: "uppercase"
                            }}>
                                Example
                            </p>

                            {problem.exampleInput && (
                                <div style={{ marginBottom: "10px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                        <p style={{ fontSize: "12px", fontWeight: "600", color: "#475467" }}>
                                            Input:
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setCustomInput(problem.exampleInput)}
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                color: "#4f46e5",
                                                fontSize: "11px",
                                                fontWeight: "600",
                                                cursor: "pointer",
                                                textDecoration: "underline",
                                                padding: 0
                                            }}
                                        >
                                            Use as Test Input
                                        </button>
                                    </div>
                                    <code style={{
                                        display: "block",
                                        background: "#1e293b",
                                        color: "#e2e8f0",
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        whiteSpace: "pre-wrap",
                                        fontFamily: "'Fira Code', 'Cascadia Code', monospace"
                                    }}>
                                        {problem.exampleInput}
                                    </code>
                                </div>
                            )}

                            {problem.exampleOutput && (
                                <div>
                                    <p style={{ fontSize: "12px", fontWeight: "600", color: "#475467", marginBottom: "4px" }}>
                                        Expected Output:
                                    </p>
                                    <code style={{
                                        display: "block",
                                        background: "#1e293b",
                                        color: "#4ade80",
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        whiteSpace: "pre-wrap",
                                        fontFamily: "'Fira Code', 'Cascadia Code', monospace"
                                    }}>
                                        {problem.exampleOutput}
                                    </code>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. Custom Test Input (stdin) */}
                    <div style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "10px",
                        padding: "16px",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <p style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                letterSpacing: "0.8px",
                                color: "#667085",
                                textTransform: "uppercase"
                            }}>
                                Custom Test Input (stdin)
                            </p>
                            {customInput && (
                                <button
                                    type="button"
                                    onClick={() => setCustomInput("")}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "#dc2626",
                                        fontSize: "11px",
                                        cursor: "pointer",
                                        padding: 0
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <textarea
                            placeholder="Enter test input passed to your program's stdin..."
                            rows={3}
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "8px 10px",
                                border: "1px solid #d0d5dd",
                                borderRadius: "8px",
                                resize: "vertical",
                                fontSize: "12px",
                                fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                background: "#f8fafc",
                                color: "#1e293b",
                                outline: "none",
                            }}
                        />
                    </div>
                </div>

                {/* ==== Right Column: Editor + Actions + Terminal ==== */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                    {/* Language selector & Editor Toolbar */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "#1e293b",
                        padding: "8px 16px",
                        borderRadius: "10px 10px 0 0",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <select
                                value={selectedLanguage}
                                onChange={handleLanguageChange}
                                style={{
                                    background: "#334155",
                                    color: "#ffffff",
                                    border: "1px solid #475467",
                                    borderRadius: "8px",
                                    padding: "4px 10px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    outline: "none",
                                }}
                            >
                                <option value="python">Python 3</option>
                                <option value="javascript">JavaScript (Node.js)</option>
                                <option value="cpp">C++ (GCC)</option>
                            </select>

                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                                {problem.title || `Problem ${currentProblemIndex + 1}`}
                            </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ color: "#e2e8f0", fontSize: "11px", background: "rgba(239, 68, 68, 0.2)", padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
                                🔒 Paste Blocked
                            </span>
                            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                                {saveStatus === "saving" ? "● Saving…" : saveStatus === "saved" ? "✓ Saved" : ""}
                            </div>
                        </div>
                    </div>

                    {/* Monaco Code Editor with Copy-Paste Prevention */}
                    <div style={{
                        borderRadius: "0 0 10px 10px",
                        overflow: "hidden",
                        border: "1px solid #1e293b",
                        borderTop: "none",
                        minHeight: "420px",
                    }}>
                        <Suspense fallback={
                            <div style={{
                                height: "420px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#1e293b",
                                color: "#94a3b8",
                                fontSize: "14px"
                            }}>
                                Loading editor…
                            </div>
                        }>
                            <Editor
                                height="430px"
                                language={MONACO_LANGUAGE[selectedLanguage] || "plaintext"}
                                value={code}
                                onChange={handleCodeChange}
                                onMount={handleEditorMount}
                                theme="vs-dark"
                                options={{
                                    fontSize: 14,
                                    minimap: { enabled: false },
                                    scrollBeyondLastLine: false,
                                    wordWrap: "on",
                                    lineNumbers: "on",
                                    tabSize: selectedLanguage === "python" ? 4 : 2,
                                    insertSpaces: true,
                                    automaticLayout: true,
                                    padding: { top: 14, bottom: 14 },
                                    contextmenu: false, // Disables right-click context menu inside Monaco
                                }}
                            />
                        </Suspense>
                    </div>

                    {/* Action Row */}
                    <div style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        alignItems: "center"
                    }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleRunCode}
                            disabled={running || submittingSolution}
                            style={{
                                fontSize: "13px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: running ? "#6366f1" : "#4f46e5",
                            }}
                        >
                            {running ? (
                                <>
                                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
                                    Running Code…
                                </>
                            ) : (
                                <>▶ Run Code</>
                            )}
                        </button>

                        <button
                            className="btn"
                            onClick={handleSubmitSolution}
                            disabled={running || submittingSolution}
                            style={{
                                fontSize: "13px",
                                background: "#059669",
                                color: "#ffffff",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            {submittingSolution ? "Submitting Solution…" : "✓ Submit Solution"}
                        </button>

                        {!isLastProblem ? (
                            <button
                                className="btn btn-secondary"
                                onClick={() => switchProblem(currentProblemIndex + 1)}
                                disabled={running || submittingSolution}
                                style={{ fontSize: "13px" }}
                            >
                                Next Problem →
                            </button>
                        ) : (
                            <button
                                className="btn"
                                onClick={handleFinishInterview}
                                disabled={completing || running || submittingSolution}
                                style={{
                                    fontSize: "13px",
                                    background: "#1e293b",
                                    color: "#ffffff",
                                }}
                            >
                                {completing ? "Finalizing Report…" : "Finish Coding Interview"}
                            </button>
                        )}
                    </div>

                    {/* Messages & Notifications */}
                    {submitSuccess && (
                        <div style={{
                            padding: "10px 14px",
                            background: "#eefbf3",
                            border: "1px solid #86efac",
                            borderRadius: "8px",
                            color: "#166534",
                            fontSize: "13px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}>
                            <span>✓</span>
                            <span>Solution submitted and recorded.</span>
                        </div>
                    )}

                    {error && (
                        <div className="error-message" style={{ margin: 0 }}>
                            {error}
                        </div>
                    )}

                    {executionError && (
                        <div style={{
                            padding: "12px 14px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: "8px",
                            color: "#b91c1c",
                            fontSize: "13px"
                        }}>
                            <strong>Execution Provider Error:</strong> {executionError}
                        </div>
                    )}

                    {/* Output Terminal / Execution Results */}
                    {runResult && (
                        <div style={{
                            background: "#0f172a",
                            borderRadius: "10px",
                            border: "1px solid #1e293b",
                            overflow: "hidden"
                        }}>
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 16px",
                                background: "#1e293b",
                                borderBottom: "1px solid #334155"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>
                                        EXECUTION TERMINAL
                                    </span>
                                    {statusBadge && (
                                        <span style={{
                                            background: statusBadge.bg,
                                            color: statusBadge.text,
                                            padding: "2px 8px",
                                            borderRadius: "12px",
                                            fontSize: "11px",
                                            fontWeight: "700",
                                        }}>
                                            {statusBadge.label}
                                        </span>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "#94a3b8" }}>
                                    {runResult.execTime && (
                                        <span>Time: <strong>{runResult.execTime}s</strong></span>
                                    )}
                                    {runResult.memoryUsed && (
                                        <span>Memory: <strong>{runResult.memoryUsed} KB</strong></span>
                                    )}
                                </div>
                            </div>

                            <div style={{ padding: "14px 16px", maxHeight: "260px", overflowY: "auto" }}>
                                {runResult.stdout && (
                                    <div style={{ marginBottom: "10px" }}>
                                        <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>
                                            Standard Output:
                                        </p>
                                        <pre style={{
                                            background: "#1e293b",
                                            color: "#4ade80",
                                            padding: "10px 12px",
                                            borderRadius: "6px",
                                            fontSize: "13px",
                                            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                            margin: 0,
                                            whiteSpace: "pre-wrap"
                                        }}>
                                            {runResult.stdout}
                                        </pre>
                                    </div>
                                )}

                                {runResult.compileOutput && (
                                    <div style={{ marginBottom: "10px" }}>
                                        <p style={{ fontSize: "11px", fontWeight: "700", color: "#f87171", textTransform: "uppercase", marginBottom: "4px" }}>
                                            Compilation Output:
                                        </p>
                                        <pre style={{
                                            background: "#1e293b",
                                            color: "#f87171",
                                            padding: "10px 12px",
                                            borderRadius: "6px",
                                            fontSize: "13px",
                                            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                            margin: 0,
                                            whiteSpace: "pre-wrap"
                                        }}>
                                            {runResult.compileOutput}
                                        </pre>
                                    </div>
                                )}

                                {runResult.stderr && (
                                    <div style={{ marginBottom: "10px" }}>
                                        <p style={{ fontSize: "11px", fontWeight: "700", color: "#f87171", textTransform: "uppercase", marginBottom: "4px" }}>
                                            Standard Error / Runtime Traceback:
                                        </p>
                                        <pre style={{
                                            background: "#1e293b",
                                            color: "#f87171",
                                            padding: "10px 12px",
                                            borderRadius: "6px",
                                            fontSize: "13px",
                                            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                            margin: 0,
                                            whiteSpace: "pre-wrap"
                                        }}>
                                            {runResult.stderr}
                                        </pre>
                                    </div>
                                )}

                                {!runResult.stdout && !runResult.compileOutput && !runResult.stderr && (
                                    <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "13px", margin: 0 }}>
                                        (Execution completed with empty output)
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CodingInterview;
