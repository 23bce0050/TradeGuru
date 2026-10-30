import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { ticker } from "../format";

export default function StockSearch({ autoFocus = false, placeholder = "Search stocks, e.g. Infosys" }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef(null);

  // 300ms ruk ke search (har letter par API call nahi)
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/stocks/search", { params: { q } });
        setResults(data.results);
        setActive(0);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (r) => {
    setQ("");
    setOpen(false);
    navigate(`/stock/${r.symbol}`);
  };

  const onKey = (e) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") setOpen(false);
  };

  const showEmpty = open && !searching && q.trim().length >= 2 && results.length === 0;

  return (
    <div className="search" ref={boxRef}>
      <input
        type="search"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        aria-label="Search stocks"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
      />
      {open && results.length > 0 && (
        <ul className="search-results" id="search-results" role="listbox">
          {results.map((r, i) => (
            <li
              key={r.symbol}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              onMouseDown={() => go(r)}
            >
              <strong>{ticker(r.symbol)}</strong>
              <span>{r.name}</span>
              <em>{r.exchange}</em>
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <div className="search-results search-empty">No NSE or BSE stock matches “{q}”.</div>
      )}
    </div>
  );
}
