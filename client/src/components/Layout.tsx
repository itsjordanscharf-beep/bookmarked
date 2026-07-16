import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">🔖</span> Bookmarked
        </Link>
        {user && (
          <nav className="topbar-nav">
            <span>{user.name}</span>
            <button className="btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </nav>
        )}
      </header>
      <main className={`main ${wide ? "main-wide" : ""}`}>{children}</main>
    </div>
  );
}
