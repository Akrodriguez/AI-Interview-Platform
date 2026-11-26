import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CreateInterview from "./pages/CreateInterview";
import Interview from "./pages/Interview";
import InterviewResult from "./pages/InterviewResult";
import CreateCodingInterview from "./pages/CreateCodingInterview";
import CodingInterview from "./pages/CodingInterview";
import CodingInterviewResult from "./pages/CodingInterviewResult";

function App() {
    return (
        <>
            <Navbar />

            <Routes>

                <Route path="/" element={<Landing />} />

                <Route path="/login" element={<Login />} />

                <Route path="/register" element={<Register />} />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/create-interview"
                    element={
                        <ProtectedRoute>
                            <CreateInterview />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/interview/:id"
                    element={
                        <ProtectedRoute>
                            <Interview />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/interview/:id/result"
                    element={
                        <ProtectedRoute>
                            <InterviewResult />
                        </ProtectedRoute>
                    }
                />

                {/* ---- Coding Interview Routes ---- */}

                <Route
                    path="/create-coding-interview"
                    element={
                        <ProtectedRoute>
                            <CreateCodingInterview />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/coding-interview/:id"
                    element={
                        <ProtectedRoute>
                            <CodingInterview />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/coding-interview/:id/result"
                    element={
                        <ProtectedRoute>
                            <CodingInterviewResult />
                        </ProtectedRoute>
                    }
                />

            </Routes>
        </>
    );
}


export default App;
