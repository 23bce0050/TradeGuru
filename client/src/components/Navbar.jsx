import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import { rupee0 } from "../format";
import StockSearch from "./StockSearch";

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link to="/" className="brand" aria-label="TradeGuru home">
          <img src="/logo.svg" alt="" width="36" height="36" />
          <span>TradeGuru</span>
        </Link>

        <nav className="nav-links" aria-label="Main">
          <NavLink to="/" end>Portfolio</NavLink>
          <NavLink to="/coach">Coach</NavLink>
          <NavLink to="/news">News</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          <NavLink to="/history">Trades</NavLink>
        </nav>

        <StockSearch />

        <div className="topbar-right">
          <span className="cash-chip" title="Virtual cash you can trade with">
            <span className="cash-label">Cash</span> {rupee0(user?.balance)}
          </span>
          <button className="btn-quiet" onClick={logout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
