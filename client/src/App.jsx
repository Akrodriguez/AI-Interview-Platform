import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import Register from "./pages/Register";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import CreateInterview from "./pages/CreateInterview";
import Interview from "./pages/Interview";
import InterviewResult from "./pages/InterviewResult";

function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route
                    path="/"
                    element={<h1>AI Interview Platform</h1>}
                />

                <Route
                    path="/login"
                    element={<Login />}
                />

                <Route
                    path="/register"
                    element={<Register />}
                />

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
    
            </Routes>
        </BrowserRouter>
    );
}

export default App;