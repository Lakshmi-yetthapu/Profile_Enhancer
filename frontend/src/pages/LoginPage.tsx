import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileCheck2, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, fullName);
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary-soft">
            <FileCheck2 size={22} />
          </div>
          <span className="font-display text-xl">ResumeEnhancer</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-4xl leading-tight text-body">
            Get your resume <span className="text-primary-soft">interview-ready</span>.
          </h1>
          <p className="mt-4 text-muted">
            Deep AI analysis against NxtWave's evaluation rubric — with or without a job
            description. Clear scores, honest feedback, and a path to improvement.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Rubric scoring", "JD matching", "LeetCode insights", "PDF report"].map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">© NxtWave · ResumeEnhancer</p>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2 font-display text-2xl">
              <FileCheck2 className="text-primary-soft" /> ResumeEnhancer
            </div>
          </div>
          <h2 className="font-display text-2xl">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {mode === "login" ? "Sign in to analyze your resume." : "Start improving your resume today."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === "register" && (
              <div>
                <label className="label">Full name</label>
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ada Lovelace"
                  required
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
                {error}
              </div>
            )}

            <button className="btn-primary w-full" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              className="font-medium text-primary-soft hover:underline"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
