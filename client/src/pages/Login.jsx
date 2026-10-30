import { useState } from "react";
import { errorText } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(form.email, form.password);
      else await signup(form.name, form.email, form.password);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const isSignup = mode === "signup";

  return (
    <div className="auth">
      <section className="auth-pitch">
        <div className="brand">
          <img src="/logo.svg" alt="" width="44" height="44" />
          <span>TradeGuru</span>
        </div>
        <h1>
          Practise on the real market.
          <br />
          Lose nothing.
        </h1>
        <p>
          Start with <strong>₹10,00,000</strong> of virtual money and trade NSE stocks at live prices. Learn what
          moves a portfolio before your own savings are on the line.
        </p>
        <div className="auth-ledger" aria-hidden="true">
          <div><span>Starting cash</span><b>₹10,00,000</b></div>
          <div><span>Real money at risk</span><b>₹0</b></div>
        </div>
      </section>

      <section className="auth-card">
        <div className="segmented wide" role="tablist" aria-label="Account">
          <button role="tab" aria-selected={!isSignup} onClick={() => (setMode("login"), setError(""))}>Log in</button>
          <button role="tab" aria-selected={isSignup} onClick={() => (setMode("signup"), setError(""))}>Create account</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {isSignup && (
            <label className="field">
              <span>Name</span>
              <input value={form.name} onChange={set("name")} required autoComplete="name" />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={set("password")}
              required
              minLength={6}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
            {isSignup && <small>At least 6 characters.</small>}
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn-primary" disabled={busy}>
            {busy ? "Please wait…" : isSignup ? "Create account and get ₹10 lakh" : "Log in"}
          </button>
        </form>
      </section>
    </div>
  );
}
