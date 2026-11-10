const CodingInterview = require("../models/CodingInterview");
const {
    executeCode,
    resolveLanguageId,
} = require("../utils/judge0Client");

const MAX_CODE_LENGTH = 65536; // 64 KB
const MAX_STDIN_LENGTH = 16384; // 16 KB

// Default starter code templates per language
const STARTER_CODE = {
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

// @desc    Create a new Coding Interview session
// @route   POST /api/coding-interviews
// @access  Private
const createCodingInterview = async (req, res) => {
    try {
        const {
            role,
            topic,
            difficulty,
            language,
            problemCount,
        } = req.body;

        if (!language) {
            return res.status(400).json({
                success: false,
                message: "Please select a programming language.",
            });
        }

        const validLanguages = ["python", "javascript", "cpp"];
        if (!validLanguages.includes(language)) {
            return res.status(400).json({
                success: false,
                message: `Invalid language. Choose from: ${validLanguages.join(", ")}`,
            });
        }

        const validDifficulties = ["easy", "medium", "hard"];
        const resolvedDifficulty = validDifficulties.includes(difficulty)
            ? difficulty
            : "medium";

        const resolvedCount = Math.min(
            Math.max(Number(problemCount) || 3, 1),
            10
        );

        const langLabel =
            language === "cpp"
                ? "C++"
                : language.charAt(0).toUpperCase() + language.slice(1);

        const title = `${langLabel} Coding Interview${role ? ` – ${role}` : ""}`;

        const codingInterview = await CodingInterview.create({
            user: req.user._id,
            title,
            difficulty: resolvedDifficulty,
            language,
            role: role || "",
            topic: topic || "",
            problemCount: resolvedCount,
            problems: [],
        });

        return res.status(201).json({
            success: true,
            codingInterview,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get all Coding Interview sessions for the logged-in user
// @route   GET /api/coding-interviews
// @access  Private
const getCodingInterviews = async (req, res) => {
    try {
        const codingInterviews = await CodingInterview.find({
            user: req.user._id,
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: codingInterviews.length,
            codingInterviews,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get a single Coding Interview session by ID
// @route   GET /api/coding-interviews/:id
// @access  Private
const getCodingInterviewById = async (req, res) => {
    try {
        const codingInterview = await CodingInterview.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!codingInterview) {
            return res.status(404).json({
                success: false,
                message: "Coding interview not found.",
            });
        }

        return res.status(200).json({
            success: true,
            codingInterview,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Generate coding problems for an interview session using placeholder problems
// @route   POST /api/coding-interviews/:id/generate
// @access  Private
// NOTE: Stage 1 — returns static placeholder problems until AI integration (Stage 3)
const generateProblems = async (req, res) => {
    try {
        const codingInterview = await CodingInterview.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!codingInterview) {
            return res.status(404).json({
                success: false,
                message: "Coding interview not found.",
            });
        }

        const { language, difficulty, topic, role, problemCount } = codingInterview;
        const starter = STARTER_CODE[language] || STARTER_CODE.python;

        // Stage 1 placeholder: generate static sample problems
        // These will be replaced by AI-generated problems in Stage 3
        const placeholderProblems = generatePlaceholderProblems(
            problemCount,
            difficulty,
            language,
            topic,
            role
        );

        const formattedProblems = placeholderProblems.map((p) => ({
            ...p,
            starterCode: starter,
            solution: "",
            submitted: false,
        }));

        codingInterview.problems = formattedProblems;
        await codingInterview.save();

        return res.status(200).json({
            success: true,
            message: "Problems generated successfully.",
            codingInterview,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save candidate's code for a specific problem (auto-save)
// @route   POST /api/coding-interviews/:id/save-code
// @access  Private
const saveCode = async (req, res) => {
    try {
        const { problemIndex, code } = req.body;

        if (problemIndex === undefined || code === undefined) {
            return res.status(400).json({
                success: false,
                message: "problemIndex and code are required.",
            });
        }

        const codingInterview = await CodingInterview.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!codingInterview) {
            return res.status(404).json({
                success: false,
                message: "Coding interview not found.",
            });
        }

        if (
            problemIndex < 0 ||
            problemIndex >= codingInterview.problems.length
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid problem index.",
            });
        }

        codingInterview.problems[problemIndex].solution = String(code);
        await codingInterview.save();

        return res.status(200).json({
            success: true,
            message: "Code saved.",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete a Coding Interview session
// @route   DELETE /api/coding-interviews/:id
// @access  Private
const runCode = async (req, res) => {
    try {
        const { problemIndex, code, language, stdin = "" } = req.body;

        if (code === undefined || typeof code !== "string") {
            return res.status(400).json({
                success: false,
                message: "Source code must be provided as a string.",
            });
        }

        if (!code.trim()) {
            return res.status(400).json({
                success: false,
                message: "Source code cannot be empty.",
            });
        }

        if (code.length > MAX_CODE_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Source code exceeds maximum allowed size of ${MAX_CODE_LENGTH / 1024}KB.`,
            });
        }

        if (stdin !== undefined && typeof stdin === "string" && stdin.length > MAX_STDIN_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Standard input exceeds maximum allowed size of ${MAX_STDIN_LENGTH / 1024}KB.`,
            });
        }

        const codingInterview = await CodingInterview.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!codingInterview) {
            return res.status(404).json({
                success: false,
                message: "Coding interview not found.",
            });
        }

        const resolvedLang = language || codingInterview.language;
        const langId = resolveLanguageId(resolvedLang);
        if (!langId) {
            return res.status(400).json({
                success: false,
                message: `Unsupported language "${resolvedLang}". Supported languages: python, javascript, cpp`,
            });
        }

        const result = await executeCode({
            language: resolvedLang,
            sourceCode: code,
            stdin: typeof stdin === "string" ? stdin : "",
        });

        // If a valid problemIndex was provided, update recent run output and code in DB
        if (
            problemIndex !== undefined &&
            typeof problemIndex === "number" &&
            problemIndex >= 0 &&
            problemIndex < codingInterview.problems.length
        ) {
            const problem = codingInterview.problems[problemIndex];
            problem.solution = code;
            if (typeof stdin === "string") {
                problem.customInput = stdin;
            }
            problem.stdout = result.stdout;
            problem.stderr = result.stderr;
            problem.compileOutput = result.compileOutput;
            problem.execStatus = result.execStatus;
            problem.execTime = result.execTime;
            problem.memoryUsed = result.memoryUsed;

            await codingInterview.save();
        }

        return res.status(200).json({
            success: true,
            result,
        });
    } catch (error) {
        const isTimeout = error.message && error.message.includes("timed out");
        const isConfig = error.message && error.message.includes("not configured");
        const isRateLimit = error.message && error.message.includes("rate limit");
        const isAuth = error.message && error.message.includes("API key");
        const status = isConfig ? 503 : isAuth ? 401 : isRateLimit ? 429 : isTimeout ? 504 : 500;

        return res.status(status).json({
            success: false,
            message: error.message || "Failed to execute code.",
        });
    }
};

const submitSolution = async (req, res) => {
    try {
        const { problemIndex, code, language, stdin = "" } = req.body;

        if (problemIndex === undefined || typeof problemIndex !== "number") {
            return res.status(400).json({
                success: false,
                message: "problemIndex is required as a number.",
            });
        }

        if (code === undefined || typeof code !== "string") {
            return res.status(400).json({
                success: false,
                message: "Source code must be provided as a string.",
            });
        }

        if (!code.trim()) {
            return res.status(400).json({
                success: false,
                message: "Source code cannot be empty.",
            });
        }

        if (code.length > MAX_CODE_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Source code exceeds maximum allowed size of ${MAX_CODE_LENGTH / 1024}KB.`,
            });
        }

        if (stdin !== undefined && typeof stdin === "string" && stdin.length > MAX_STDIN_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Standard input exceeds maximum allowed size of ${MAX_STDIN_LENGTH / 1024}KB.`,
            });
        }

        const codingInterview = await CodingInterview.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!codingInterview) {
            return res.status(404).json({
                success: false,
                message: "Coding interview not found.",
            });
        }

        if (
            problemIndex < 0 ||
            problemIndex >= codingInterview.problems.length
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid problem index.",
            });
        }

        const resolvedLang = language || codingInterview.language;
        const langId = resolveLanguageId(resolvedLang);
        if (!langId) {
            return res.status(400).json({
                success: false,
                message: `Unsupported language "${resolvedLang}". Supported languages: python, javascript, cpp`,
            });
        }

        // Execute code in sandbox
        const result = await executeCode({
            language: resolvedLang,
            sourceCode: code,
            stdin: typeof stdin === "string" ? stdin : "",
        });

        const problem = codingInterview.problems[problemIndex];
        problem.solution = code;
        if (typeof stdin === "string") {
            problem.customInput = stdin;
        }
        problem.stdout = result.stdout;
        problem.stderr = result.stderr;
        problem.compileOutput = result.compileOutput;
        problem.execStatus = result.execStatus;
        problem.execTime = result.execTime;
        problem.memoryUsed = result.memoryUsed;
        problem.submitted = true;

        await codingInterview.save();

        return res.status(200).json({
            success: true,
            message: "Solution submitted successfully.",
            problem,
            result,
        });
    } catch (error) {
        const isTimeout = error.message && error.message.includes("timed out");
        const isConfig = error.message && error.message.includes("not configured");
        const isRateLimit = error.message && error.message.includes("rate limit");
        const isAuth = error.message && error.message.includes("API key");
        const status = isConfig ? 503 : isAuth ? 401 : isRateLimit ? 429 : isTimeout ? 504 : 500;

        return res.status(status).json({
            success: false,
            message: error.message || "Failed to submit code.",
        });
    }
};

const deleteCodingInterview = async (req, res) => {
    try {
        const codingInterview = await CodingInterview.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!codingInterview) {
            return res.status(404).json({
                success: false,
                message: "Coding interview not found.",
            });
        }

        await codingInterview.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Coding interview deleted.",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate placeholder coding problems for Stage 1 (no AI yet).
 * Replaced by AI-generated problems in Stage 3.
 */
function generatePlaceholderProblems(count, difficulty, language, topic, role) {
    const pool = [
        {
            title: "Two Sum",
            problem: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

**Constraints:**
- 2 ≤ nums.length ≤ 10⁴
- -10⁹ ≤ nums[i] ≤ 10⁹
- Only one valid answer exists.`,
            exampleInput: "nums = [2,7,11,15], target = 9",
            exampleOutput: "[0,1]  (because nums[0] + nums[1] = 2 + 7 = 9)",
        },
        {
            title: "Reverse a String",
            problem: `Write a function that reverses a string. The input is given as an array of characters \`s\`.

You must do it in-place with O(1) extra memory.

**Constraints:**
- 1 ≤ s.length ≤ 10⁵
- s[i] is a printable ASCII character.`,
            exampleInput: `s = ["h","e","l","l","o"]`,
            exampleOutput: `["o","l","l","e","h"]`,
        },
        {
            title: "Valid Parentheses",
            problem: `Given a string \`s\` containing just the characters \`(\`, \`)\`, \`{\`, \`}\`, \`[\` and \`]\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

**Constraints:**
- 1 ≤ s.length ≤ 10⁴
- s consists of parentheses only.`,
            exampleInput: `s = "()[]{}"`,
            exampleOutput: `true`,
        },
        {
            title: "FizzBuzz",
            problem: `Given an integer \`n\`, return a string array \`answer\` (1-indexed) where:
- \`answer[i] == "FizzBuzz"\` if \`i\` is divisible by 3 and 5.
- \`answer[i] == "Fizz"\` if \`i\` is divisible by 3.
- \`answer[i] == "Buzz"\` if \`i\` is divisible by 5.
- \`answer[i] == i\` (as a string) if none of the above conditions are true.

**Constraints:**
- 1 ≤ n ≤ 10⁴`,
            exampleInput: `n = 15`,
            exampleOutput: `["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]`,
        },
        {
            title: "Maximum Subarray",
            problem: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.

**Constraints:**
- 1 ≤ nums.length ≤ 10⁵
- -10⁴ ≤ nums[i] ≤ 10⁴

**Follow up:** If you have figured out the O(n) solution, try coding another solution using the divide and conquer approach.`,
            exampleInput: `nums = [-2,1,-3,4,-1,2,1,-5,4]`,
            exampleOutput: `6  (subarray [4,-1,2,1])`,
        },
        {
            title: "Fibonacci Number",
            problem: `The Fibonacci numbers form the sequence: F(0) = 0, F(1) = 1, F(n) = F(n - 1) + F(n - 2) for n > 1.

Given \`n\`, calculate \`F(n)\`.

**Constraints:**
- 0 ≤ n ≤ 30`,
            exampleInput: `n = 10`,
            exampleOutput: `55`,
        },
        {
            title: "Palindrome Check",
            problem: `Given a string \`s\`, return \`true\` if it is a palindrome, or \`false\` otherwise.

A string is a palindrome when it reads the same backward as forward. Only alphanumeric characters should be considered and case should be ignored.

**Constraints:**
- 1 ≤ s.length ≤ 2 × 10⁵
- s consists only of printable ASCII characters.`,
            exampleInput: `s = "A man, a plan, a canal: Panama"`,
            exampleOutput: `true`,
        },
        {
            title: "Binary Search",
            problem: `Given an array of integers \`nums\` sorted in ascending order, and an integer \`target\`, write a function to search for \`target\` in \`nums\`. If target exists, return its index. Otherwise, return -1.

**You must write an algorithm with O(log n) runtime complexity.**

**Constraints:**
- 1 ≤ nums.length ≤ 10⁴
- All integers in \`nums\` are unique.
- \`nums\` is sorted in ascending order.`,
            exampleInput: `nums = [-1,0,3,5,9,12], target = 9`,
            exampleOutput: `4`,
        },
        {
            title: "Count Vowels",
            problem: `Given a string \`s\`, return the number of vowels (a, e, i, o, u — both upper and lower case) in the string.

**Constraints:**
- 0 ≤ s.length ≤ 10⁵
- s consists of printable ASCII characters.`,
            exampleInput: `s = "Hello World"`,
            exampleOutput: `3`,
        },
        {
            title: "Find the Missing Number",
            problem: `Given an array \`nums\` containing n distinct numbers in the range [0, n], return the only number in the range that is missing from the array.

**Constraints:**
- n == nums.length
- 1 ≤ n ≤ 10⁴
- 0 ≤ nums[i] ≤ n
- All numbers are unique.`,
            exampleInput: `nums = [3,0,1]`,
            exampleOutput: `2`,
        },
    ];

    // Pick a spread of problems from the pool, cycling if count > pool length
    const selected = [];
    for (let i = 0; i < Math.min(count, pool.length); i++) {
        selected.push(pool[i]);
    }

    return selected;
}

module.exports = {
    createCodingInterview,
    getCodingInterviews,
    getCodingInterviewById,
    generateProblems,
    saveCode,
    runCode,
    submitSolution,
    deleteCodingInterview,
};
