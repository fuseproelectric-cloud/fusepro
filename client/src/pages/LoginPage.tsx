import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

export function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [emailErr, setEmailErr]   = useState("");
  const [passErr, setPassErr]     = useState("");
  const [emailFilled, setEmailFilled] = useState(false);
  const [passFilled, setPassFilled]   = useState(false);

  const onAutofill = (field: "email" | "pass") => (e: React.AnimationEvent) => {
    if (e.animationName === "lp-autofill-on") {
      if (field === "email") setEmailFilled(true);
      else setPassFilled(true);
    }
    if (e.animationName === "lp-autofill-off") {
      if (field === "email") setEmailFilled(false);
      else setPassFilled(false);
    }
  };

  const validate = () => {
    let ok = true;
    if (!email.trim()) { setEmailErr("Email is required"); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailErr("Enter a valid email address"); ok = false; }
    else setEmailErr("");
    if (!password) { setPassErr("Password is required"); ok = false; }
    else setPassErr("");
    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    try {
      await login({ email: email.trim(), password });
    } catch (err: any) {
      const raw: string = err.message ?? "Invalid email or password";
      const msg = raw.replace(/^\d+:\s*/, "");
      try { setError(JSON.parse(msg).message ?? msg); } catch { setError(msg); }
    }
  };

  return (
    <>
      <style>{`
        .lp-input {
          width: 100%; height: 3.375rem;
          padding: 0 0.875rem;
          font-size: 1.0625rem !important;
          color: hsl(var(--foreground));
          background: transparent;
          border: 1.5px solid hsl(var(--border));
          border-radius: var(--radius);
          outline: none; box-sizing: border-box;
          transition: border-color 150ms;
        }
        .lp-input:focus { border-color: hsl(var(--border)); outline: none; box-shadow: none; }
        .lp-input.err   { border-color: hsl(var(--destructive)); }
        @keyframes lp-autofill-on  { from {} to {} }
        @keyframes lp-autofill-off { from {} to {} }
        .lp-input:-webkit-autofill {
          animation-name: lp-autofill-on;
          -webkit-box-shadow: 0 0 0 1000px hsl(var(--card)) inset !important;
          -webkit-text-fill-color: hsl(var(--foreground)) !important;
          border-color: hsl(var(--border)) !important;
          transition: background-color 9999s ease-in-out 0s;
        }
        .lp-input:not(:-webkit-autofill) {
          animation-name: lp-autofill-off;
        }
        .lp-label {
          position: absolute; left: 0.75rem; top: 50%;
          transform: translateY(-50%);
          font-size: 0.9375rem;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          transition: top 150ms ease, font-size 150ms ease, color 150ms ease;
          line-height: 1;
          background: transparent;
          padding: 0 0.25rem;
        }
        .lp-input:focus ~ .lp-label,
        .lp-input:not(:placeholder-shown) ~ .lp-label,
        .lp-input:-webkit-autofill ~ .lp-label,
        .lp-input:autofill ~ .lp-label,
        .lp-label--up {
          top: 0; transform: translateY(-50%);
          font-size: 0.6875rem; font-weight: 600;
          background: hsl(var(--card));
        }
        .lp-input:focus ~ .lp-label { color: hsl(var(--muted-foreground)); }
        .lp-input.err ~ .lp-label   { color: hsl(var(--destructive)); }
        .lp-btn {
          width: 100%; height: 2.875rem;
          background: hsl(var(--primary)); color: #fff;
          font-weight: 700; font-size: 0.9375rem;
          border: none; border-radius: var(--radius);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          transition: background-color 150ms; margin-top: 0.25rem;
        }
        .lp-btn:hover:not(:disabled) { background: hsl(var(--primary-hover)); }
        .lp-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        minHeight:"100vh", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        backgroundColor:"hsl(var(--background))", padding:"1.5rem",
      }}>
        <div style={{
          width:"100%", maxWidth:"420px",
          backgroundColor:"hsl(var(--card))",
          borderRadius:"var(--radius-lg)",
          border:"1px solid hsl(var(--border))",
          boxShadow:"var(--shadow-high)",
          padding:"2.5rem 2.25rem",
        }}>
          {/* Logo */}
          <div style={{ textAlign:"center", marginBottom:"2rem" }}>
            <img src="/logo.png" alt="Fuse Pro Electric"
              style={{ height:"3rem", width:"auto", margin:"0 auto 1.25rem", display:"block" }} />
            <h1 style={{ fontSize:"1.375rem", fontWeight:700, color:"hsl(var(--foreground))", margin:0 }}>
              Sign in to FusePro
            </h1>
            <p style={{ fontSize:"0.875rem", color:"hsl(var(--muted-foreground))", marginTop:"0.375rem" }}>
              Welcome back — enter your credentials
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              display:"flex", alignItems:"flex-start", gap:"0.625rem",
              background:"hsl(var(--destructive) / 0.08)",
              border:"1px solid hsl(var(--destructive) / 0.25)",
              borderRadius:"var(--radius)", padding:"0.75rem 1rem", marginBottom:"1.25rem",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                style={{ flexShrink:0, marginTop:1, color:"hsl(var(--destructive))" }}>
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p style={{ fontSize:"0.875rem", color:"hsl(var(--destructive))", margin:0 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div style={{ position:"relative", marginBottom: emailErr ? "0.375rem" : "1.25rem" }}>
              <input
                id="lp-email" type="email" autoComplete="email"
                placeholder=" " className={`lp-input${emailErr ? " err" : ""}`}
                style={{ fontSize: "1.0625rem" }}
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(""); }}
                onAnimationStart={onAutofill("email")}
              />
              <label htmlFor="lp-email" className={`lp-label${emailFilled ? " lp-label--up" : ""}`}>Email Address</label>
            </div>
            {emailErr && <p style={{ fontSize:"0.75rem", color:"hsl(var(--destructive))", marginBottom:"1rem", marginTop:"-0.125rem" }}>{emailErr}</p>}

            {/* Password */}
            <div style={{ position:"relative", marginBottom: passErr ? "0.375rem" : "1.5rem" }}>
              <input
                id="lp-password" type={showPw ? "text" : "password"} autoComplete="current-password"
                placeholder=" " className={`lp-input${passErr ? " err" : ""}`}
                style={{ paddingRight:"2.75rem", fontSize: "1.0625rem" }}
                value={password}
                onChange={e => { setPassword(e.target.value); if (passErr) setPassErr(""); }}
                onAnimationStart={onAutofill("pass")}
              />
              <label htmlFor="lp-password" className={`lp-label${passFilled ? " lp-label--up" : ""}`}>Password</label>
              <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                style={{
                  position:"absolute", right:"0.75rem", top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", padding:0, cursor:"pointer",
                  color:"hsl(var(--muted-foreground))", display:"flex", alignItems:"center",
                }}>
                {showPw ? <Icon icon={EyeOff} size={16} /> : <Icon icon={Eye} size={16} />}
              </button>
            </div>
            {passErr && <p style={{ fontSize:"0.75rem", color:"hsl(var(--destructive))", marginBottom:"1.25rem", marginTop:"-0.125rem" }}>{passErr}</p>}

            <button type="submit" className="lp-btn" disabled={isLoggingIn}>
              {isLoggingIn
                ? <><Icon icon={Loader2} size={16} className="animate-spin"/> Signing in…</>
                : "Sign In"
              }
            </button>
          </form>
        </div>

        <p style={{ marginTop:"1.5rem", fontSize:"0.75rem", color:"hsl(var(--muted-foreground))" }}>
          Fuse Pro Electric &copy; {new Date().getFullYear()}
        </p>
      </div>
    </>
  );
}
