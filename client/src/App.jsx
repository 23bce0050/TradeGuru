import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Stock from "./pages/Stock";
import History from "./pages/History";
import Coach from "./pages/Coach";
import Leaderboard from "./pages/Leaderboard";
import News from "./pages/News";

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="page-status">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <Navbar />
      <main className="container">{children}</main>
    </>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/stock/:symbol" element={<Private><Stock /></Private>} />
      <Route path="/history" element={<Private><History /></Private>} />
      <Route path="/coach" element={<Private><Coach /></Private>} />
      <Route path="/leaderboard" element={<Private><Leaderboard /></Private>} />
      <Route path="/news" element={<Private><News /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
