import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../services/api";

// Lazy-load Monaco so it doesn't inflate the initial bundle
const Editor = lazy(() => import("@monaco-editor/react"));

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

    const [codingInterview, setCodingInterview] = useState(null);
    const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
    const [selectedLanguage, setSelectedLanguage] = useState("python");
    const [code, setCode] = useState("");
    const [customInput, setCustomInput] = useState("");

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
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

    // Fetch interview on mount
    useEffect(() => {
        const fetchCodingInterview = async () => {
            try {
                const response = await api.get(`/coding-interviews/${id}`);
                const data = response.data.codingInterview;
                setCodingInterview(data);

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

    // Cleanup auto-save timer on unmount
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, []);

    // Sync code when switching problems
    const switchProblem = (index) => {
        if (!codingInterview?.problems) return;

        // Cache current code before switching
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

        // Load custom stdin or problem's example
        setCustomInput(nextProblem.customInput || nextProblem.exampleInput || "");

        // Load existing execution output for this problem if available
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

    // Handle language change with code preservation per language
    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        if (newLang === selectedLanguage) return;

        // Cache current code for previous language
        codeCacheRef.current[`${currentProblemIndex}_${selectedLanguage}`] = code;

        // Check if there is cached code for the new language
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
        }, 1500);
    };

    const handleCodeChange = (newCode) => {
        setCode(newCode ?? "");
        isDirtyRef.current = true;
        triggerAutoSave(currentProblemIndex, newCode ?? "");
    };

    const handleGenerateProblems = async () => {
        try {
            setGenerating(true);
            setError("");
            const response = await api.post(`/coding-interviews/${id}/generate`);
            const data = response.data.codingInterview;
            setCodingInterview(data);
            setCurrentProblemIndex(0);

            const initialLang = data.language || selectedLanguage || "python";
            setSelectedLanguage(initialLang);

            const initialCode =
                data.problems[0]?.solution ||
                data.problems[0]?.starterCode ||
                STARTER_CODES[initialLang] ||
                "";
            setCode(initialCode);
            codeCacheRef.current[`0_${initialLang}`] = initialCode;
            setCustomInput(data.problems[0]?.customInput || data.problems[0]?.exampleInput || "");
        } catch (err) {
            setError(
                err.response?.data?.message || "Failed to generate problems."
            );
        } finally {
            setGenerating(false);
        }
    };

    const handleManualSave = async () => {
        if (saving) return;
        try {
            setSaving(true);
            setSaveStatus("saving");
            await api.post(`/coding-interviews/${id}/save-code`, {
                problemIndex: currentProblemIndex,
                code,
            });
            setCodingInterview((prev) => {
                if (!prev) return prev;
                const updated = { ...prev };
                updated.problems = [...prev.problems];
                updated.problems[currentProblemIndex] = {
                    ...updated.problems[currentProblemIndex],
                    solution: code,
                };
                return updated;
            });
            isDirtyRef.current = false;
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus(""), 2000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save code.");
            setSaveStatus("");
        } finally {
            setSaving(false);
        }
    };

    // Run Code in Judge0 sandbox
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

            // Update local problem solution & execution fields
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

    // Submit Solution for this problem
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

            // Update local state to show submitted badge
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

        // Auto-save code before leaving
        try {
            await api.post(`/coding-interviews/${id}/save-code`, {
                problemIndex: currentProblemIndex,
                code,
            });
        } catch (_) {}

        try {
            setCompleting(true);
            navigate(`/coding-interview/${id}/result`);
        } finally {
            setCompleting(false);
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

    // Determine status badge color and text
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

    // -------------------------------------------------------------------------
    // Main coding interview layout
    // -------------------------------------------------------------------------

    return (
        <div className="page-container" style={{ maxWidth: "1400px", padding: "28px 24px" }}>

            {/* ---- Header ---- */}
            <div className="interview-header">
                <div>
                    <h1 style={{ fontSize: "22px", marginBottom: "4px" }}>
                        {codingInterview.title}
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

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <div className="progress-container">
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
                            fontWeight: "600",
                            fontSize: "13px",
                            cursor: "pointer",
                            transition: "0.15s",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px"
                        }}
                    >
                        <span>{idx + 1}. {p.title || `Problem ${idx + 1}`}</span>
                        {p.submitted && (
                            <span style={{
                                background: idx === currentProblemIndex ? "#ffffff" : "#16a34a",
                                color: idx === currentProblemIndex ? "#4f46e5" : "#ffffff",
                                width: "16px",
                                height: "16px",
                                borderRadius: "50%",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10px",
                                fontWeight: "800",
                            }}>
                                ✓
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {submitSuccess && (
                <div style={{
                    marginBottom: "16px",
                    padding: "12px 16px",
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    borderRadius: "8px",
                    color: "#166534",
                    fontSize: "13px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                }}>
                    <span>✓ Solution submitted successfully for Problem {currentProblemIndex + 1}!</span>
                </div>
            )}

            {error && (
                <div className="error-message" style={{ marginBottom: "16px" }}>{error}</div>
            )}

            {/* ---- Main two-column grid ---- */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "minmax(300px, 420px) 1fr",
                gap: "20px",
                alignItems: "start",
            }}>

                {/* ==== Left: Problem Panel ==== */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Problem statement */}
                    <div style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "24px",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <span className="question-label" style={{ margin: 0 }}>
                                Problem {currentProblemIndex + 1}
                            </span>
                            {problem.submitted && (
                                <span style={{
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    color: "#16a34a",
                                    background: "#f0fdf4",
                                    border: "1px solid #bbf7d0",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                }}>
                                    Submitted
                                </span>
                            )}
                        </div>

                        <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>
                            {problem.title || `Problem ${currentProblemIndex + 1}`}
                        </h2>

                        <div style={{
                            fontSize: "14px",
                            lineHeight: "1.75",
                            color: "#344054",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                        }}>
                            {problem.problem}
                        </div>
                    </div>

                    {/* Example I/O */}
                    {(problem.exampleInput || problem.exampleOutput) && (
                        <div style={{
                            background: "#f8fafc",
                            border: "1px solid #e5e7eb",
                            borderRadius: "10px",
                            padding: "18px",
                        }}>
                            <p style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                letterSpacing: "0.8px",
                                color: "#667085",
                                marginBottom: "12px",
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
                                        padding: "10px 12px",
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
                                        padding: "10px 12px",
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

                    {/* Custom Test Input (stdin) */}
                    <div style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "10px",
                        padding: "18px",
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
                                padding: "10px 12px",
                                border: "1px solid #d0d5dd",
                                borderRadius: "8px",
                                resize: "vertical",
                                fontSize: "13px",
                                fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                background: "#f8fafc",
                                color: "#1e293b",
                                outline: "none",
                            }}
                        />
                        <p style={{ fontSize: "11px", color: "#667085", marginTop: "6px" }}>
                            Provided stdin is passed directly to the sandboxed execution.
                        </p>
                    </div>

                </div>

                {/* ==== Right: Editor + Actions + Output Terminal ==== */}
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
                            {/* Interactive Language Selector */}
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

                        {/* Save indicator */}
                        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                            {saveStatus === "saving" ? "● Saving…" : saveStatus === "saved" ? "✓ Saved" : ""}
                        </div>
                    </div>

                    {/* Monaco Editor */}
                    <div style={{
                        borderRadius: "0 0 10px 10px",
                        overflow: "hidden",
                        border: "1px solid #1e293b",
                        borderTop: "none",
                        minHeight: "400px",
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
                        {/* Run Code Button */}
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
                                    <span style={{
                                        width: "12px",
                                        height: "12px",
                                        border: "2px solid #ffffff",
                                        borderTopColor: "transparent",
                                        borderRadius: "50%",
                                        display: "inline-block",
                                        animation: "spin 1s linear infinite"
                                    }} />
                                    <span>Running in Sandbox…</span>
                                </>
                            ) : (
                                <>
                                    <span>▷</span>
                                    <span>Run Code</span>
                                </>
                            )}
                        </button>

                        {/* Submit Solution Button */}
                        <button
                            className="btn"
                            onClick={handleSubmitSolution}
                            disabled={running || submittingSolution}
                            style={{
                                fontSize: "13px",
                                background: "#16a34a",
                                color: "#ffffff",
                                border: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            {submittingSolution ? "Submitting…" : "✓ Submit Solution"}
                        </button>

                        {/* Manual Save */}
                        <button
                            className="btn btn-secondary"
                            onClick={handleManualSave}
                            disabled={saving}
                            style={{ fontSize: "13px" }}
                        >
                            {saving ? "Saving…" : "Save Code"}
                        </button>

                        <div style={{ flex: 1 }} />

                        {/* Next Problem / Finish */}
                        {!isLastProblem ? (
                            <button
                                className="btn btn-secondary"
                                onClick={() => switchProblem(currentProblemIndex + 1)}
                                style={{ fontSize: "13px" }}
                            >
                                Next Problem →
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary"
                                onClick={handleFinishInterview}
                                disabled={completing}
                                style={{ fontSize: "13px" }}
                            >
                                {completing ? "Finishing…" : "Finish Interview"}
                            </button>
                        )}
                    </div>

                    {/* Output Terminal Panel */}
                    <div style={{
                        background: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: "10px",
                        padding: "16px",
                        minHeight: "140px",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    }}>
                        {/* Terminal Header */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid #1e293b",
                            paddingBottom: "10px",
                            marginBottom: "12px",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{
                                    fontSize: "12px",
                                    fontWeight: "700",
                                    color: "#94a3b8",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.8px"
                                }}>
                                    Terminal Output
                                </span>

                                {running && (
                                    <span style={{
                                        background: "#312e81",
                                        color: "#c7d2fe",
                                        fontSize: "11px",
                                        padding: "2px 8px",
                                        borderRadius: "10px",
                                        fontWeight: "600"
                                    }}>
                                        Executing…
                                    </span>
                                )}

                                {!running && statusBadge && (
                                    <span style={{
                                        background: statusBadge.bg,
                                        color: statusBadge.text,
                                        fontSize: "11px",
                                        padding: "2px 8px",
                                        borderRadius: "10px",
                                        fontWeight: "700"
                                    }}>
                                        {statusBadge.label}
                                    </span>
                                )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                {runResult?.execTime && (
                                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                                        Time: <strong>{runResult.execTime}s</strong>
                                    </span>
                                )}
                                {runResult?.memoryUsed && (
                                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                                        Memory: <strong>{runResult.memoryUsed} KB</strong>
                                    </span>
                                )}
                                {runResult && (
                                    <button
                                        type="button"
                                        onClick={() => setRunResult(null)}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            color: "#64748b",
                                            fontSize: "12px",
                                            cursor: "pointer",
                                            padding: 0
                                        }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Terminal Body */}
                        {running && (
                            <div style={{
                                color: "#94a3b8",
                                fontSize: "13px",
                                fontStyle: "italic",
                                padding: "12px 0",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px"
                            }}>
                                <span>Running code in Judge0 isolated container…</span>
                            </div>
                        )}

                        {executionError && (
                            <div style={{
                                background: "#450a0a",
                                border: "1px solid #7f1d1d",
                                borderRadius: "6px",
                                padding: "10px 12px",
                                color: "#fca5a5",
                                fontSize: "13px",
                                fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                whiteSpace: "pre-wrap",
                            }}>
                                <strong>Execution Error:</strong> {executionError}
                            </div>
                        )}

                        {!running && !executionError && runResult && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {/* Compilation Error Output */}
                                {runResult.compileOutput && (
                                    <div>
                                        <p style={{ fontSize: "11px", color: "#f87171", fontWeight: "700", marginBottom: "4px" }}>
                                            COMPILATION ERROR:
                                        </p>
                                        <pre style={{
                                            background: "#1e1e2e",
                                            color: "#f87171",
                                            padding: "10px 12px",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                            margin: 0,
                                            whiteSpace: "pre-wrap",
                                            overflowX: "auto"
                                        }}>
                                            {runResult.compileOutput}
                                        </pre>
                                    </div>
                                )}

                                {/* Runtime Standard Error Output */}
                                {runResult.stderr && (
                                    <div>
                                        <p style={{ fontSize: "11px", color: "#fb923c", fontWeight: "700", marginBottom: "4px" }}>
                                            STDERR:
                                        </p>
                                        <pre style={{
                                            background: "#1e1e2e",
                                            color: "#fb923c",
                                            padding: "10px 12px",
                                            borderRadius: "6px",
                                            fontSize: "12px",
                                            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                            margin: 0,
                                            whiteSpace: "pre-wrap",
                                            overflowX: "auto"
                                        }}>
                                            {runResult.stderr}
                                        </pre>
                                    </div>
                                )}

                                {/* Standard Output */}
                                {runResult.stdout ? (
                                    <div>
                                        <p style={{ fontSize: "11px", color: "#4ade80", fontWeight: "700", marginBottom: "4px" }}>
                                            STDOUT:
                                        </p>
                                        <pre style={{
                                            background: "#111827",
                                            color: "#4ade80",
                                            padding: "10px 12px",
                                            borderRadius: "6px",
                                            fontSize: "13px",
                                            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                            margin: 0,
                                            whiteSpace: "pre-wrap",
                                            overflowX: "auto"
                                        }}>
                                            {runResult.stdout}
                                        </pre>
                                    </div>
                                ) : !runResult.compileOutput && !runResult.stderr ? (
                                    <p style={{ color: "#64748b", fontSize: "13px", fontStyle: "italic", margin: "6px 0" }}>
                                        (Program finished with no standard output)
                                    </p>
                                ) : null}
                            </div>
                        )}

                        {!running && !executionError && !runResult && (
                            <p style={{ color: "#64748b", fontSize: "13px", fontStyle: "italic", margin: "8px 0" }}>
                                Click <strong>Run Code</strong> to execute your code against custom stdin or <strong>Submit Solution</strong> to record your answer.
                            </p>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
};

export default CodingInterview;
