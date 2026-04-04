import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

export function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState("");
  const [passErr, setPassErr]   = useState("");

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
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 3,
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 420,
          bgcolor: "background.paper",
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: 24,
          p: "2.5rem 2.25rem",
        }}
      >
        {/* Logo */}
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Fuse Pro Electric"
            sx={{ height: "3rem", width: "auto", mx: "auto", mb: 2.5, display: "block" }}
          />
          <Box component="h1" sx={{ fontSize: "1.375rem", fontWeight: 700, color: "text.primary", m: 0 }}>
            Sign in to FusePro
          </Box>
          <Box component="p" sx={{ fontSize: "0.875rem", color: "text.secondary", mt: 0.5 }}>
            Welcome back — enter your credentials
          </Box>
        </Box>

        {/* Error banner */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            id="lp-email"
            label="Email Address"
            type="email"
            autoComplete="email"
            fullWidth
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(""); }}
            error={!!emailErr}
            helperText={emailErr}
            inputProps={{ style: { fontSize: "1.0625rem" } }}
          />

          <TextField
            id="lp-password"
            label="Password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            fullWidth
            value={password}
            onChange={e => { setPassword(e.target.value); if (passErr) setPassErr(""); }}
            error={!!passErr}
            helperText={passErr}
            inputProps={{ style: { fontSize: "1.0625rem" } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    tabIndex={-1}
                    onClick={() => setShowPw(v => !v)}
                    edge="end"
                    size="small"
                  >
                    {showPw ? <Icon icon={EyeOff} size={16} /> : <Icon icon={Eye} size={16} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isLoggingIn}
            sx={{ height: "2.875rem", fontWeight: 700, fontSize: "0.9375rem", mt: 0.5 }}
          >
            {isLoggingIn
              ? <><CircularProgress size={16} sx={{ mr: 1, color: "inherit" }} /> Signing in…</>
              : "Sign In"
            }
          </Button>
        </Box>
      </Box>

      <Box component="p" sx={{ mt: 3, fontSize: "0.75rem", color: "text.secondary" }}>
        Fuse Pro Electric &copy; {new Date().getFullYear()}
      </Box>
    </Box>
  );
}
