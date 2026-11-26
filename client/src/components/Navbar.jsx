import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const Navbar = () => {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <nav className="navbar">

            <Link to="/" className="navbar-brand">
                AI Interview Platform
            </Link>

            {isAuthenticated && (
                <div className="navbar-links">

                    <Link to="/dashboard">
                        Dashboard
                    </Link>

                    <Link to="/create-interview">
                        New Interview
                    </Link>

                    <button
                        className="logout-btn"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>

                </div>
            )}

            {!isAuthenticated && (
                <div className="navbar-links">
                    <Link to="/login">
                        Login
                    </Link>

                    <Link to="/register">
                        Register
                    </Link>
                </div>
            )}

        </nav>
    );
};

export default Navbar;