import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <nav>
            <Link to="/">AI Interview Platform</Link>

            {isAuthenticated ? (
                <div>
                    <Link to="/dashboard">Dashboard</Link>

                    <button onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            ) : (
                <div>
                    <Link to="/login">Login</Link>
                    <Link to="/register">Register</Link>
                </div>
            )}
        </nav>
    );
};

export default Navbar;