import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bot, Briefcase, Loader2, Sparkles, Target } from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { Analysis, AppConfig, JDListItem } from "@/types";

type Mode = "no_jd" | "jd";
type Provider = "mistral" | "openai";
type JdSource = "existing" | "new";

export default function AnalyzePage() {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [provider, setProvider] = useState<Provider>("mistral");
  const [mode, setMode] = useState<Mode>("no_jd");
  const [jd, setJd] = useState("");
  const [savedJds, setSavedJds] = useState<JDListItem[]>([]);
  const [jdSource, setJdSource] = useState<JdSource>("new");
  const [selectedJdId, setSelectedJdId] = useState<number | null>(null);
  const [biasSafe, setBiasSafe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<AppConfig>("/api/config").then(({ data }) => {
      setConfig(data);
      setProvider((data.default_provider as Provider) || "mistral");
    });
    api.get<JDListItem[]>("/api/jds").then(({ data }) => {
      setSavedJds(data);
      // Default to pasting the JD inline here; a saved JD stays available via the toggle.
      if (data.length > 0) setSelectedJdId(data[0].id);
    });
  }, []);

  async function run() {
    setError("");
    if (mode === "jd") {
      if (jdSource === "new" && !jd.trim()) {
        setError("Paste the job description for JD-based analysis.");
        return;
      }
      if (jdSource === "existing" && !selectedJdId) {
        setError("Select a saved job description.");
        return;
      }
    }
    setBusy(true);
    try {
      const { data } = await api.post<Analysis>("/api/analyses", {
        resume_id: Number(resumeId),
        mode,
        jd_text: mode === "jd" && jdSource === "new" ? jd : null,
        job_description_id: mode === "jd" && jdSource === "existing" ? selectedJdId : null,
        provider,
        bias_safe: biasSafe,
      });
      navigate(`/report/${data.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  const providers: { key: Provider; label: string; model: string }[] = [
    { key: "mistral", label: "Mistral", model: "mistral-large-latest" },
    { key: "openai", label: "OpenAI", model: "gpt-5-mini" },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-3xl">Configure analysis</h1>
        <p className="mt-2 text-muted">Choose how deep the AI should look, and which engine to use.</p>
      </header>

      {/* Mode */}
      <section className="card p-6">
        <h2 className="mb-4 text-lg">Analysis mode</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={mode === "no_jd"}
            onClick={() => setMode("no_jd")}
            icon={Sparkles}
            title="Rubric check (no JD)"
            desc="Score against NxtWave's do's & don'ts — projects, links, coding profile, skills, certs."
          />
          <ModeCard
            active={mode === "jd"}
            onClick={() => setMode("jd")}
            icon={Target}
            title="Match a job description"
            desc="Everything in the rubric check, plus skill/keyword alignment against a target JD."
          />
        </div>

        {mode === "jd" && (
          <div className="mt-4">
            {savedJds.length > 0 && (
              <div className="mb-3 flex gap-1 rounded-xl bg-ink/40 p-1">
                <button
                  onClick={() => setJdSource("existing")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    jdSource === "existing" ? "bg-surface-2 text-body shadow-soft" : "text-muted hover:text-body"
                  }`}
                >
                  <Briefcase size={15} /> Use saved JD
                </button>
                <button
                  onClick={() => setJdSource("new")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    jdSource === "new" ? "bg-surface-2 text-body shadow-soft" : "text-muted hover:text-body"
                  }`}
                >
                  <Sparkles size={15} /> Paste new
                </button>
              </div>
            )}

            {jdSource === "existing" && savedJds.length > 0 ? (
              <select
                className="input"
                value={selectedJdId ?? ""}
                onChange={(e) => setSelectedJdId(Number(e.target.value))}
              >
                {savedJds.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}{j.company ? ` · ${j.company}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <label className="label">Job description</label>
                <textarea
                  className="input min-h-[160px] resize-y"
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the full job description here…"
                />
                <p className="mt-1.5 text-xs text-muted">This JD is saved automatically so you can reuse and rank against it later.</p>
              </>
            )}
          </div>
        )}
      </section>

      {/* Provider */}
      <section className="card p-6">
        <h2 className="mb-1 text-lg">AI engine</h2>
        <p className="mb-4 text-sm text-muted">Pick the model that performs the analysis.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((p) => {
            const available = config?.providers[p.key];
            return (
              <button
                key={p.key}
                disabled={!available}
                onClick={() => setProvider(p.key)}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                  provider === p.key
                    ? "border-primary/70 bg-primary/10"
                    : "border-line bg-surface-2/40 hover:border-primary/40"
                } ${!available ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink/50 text-primary-soft">
                  <Bot size={20} />
                </div>
                <div>
                  <div className="font-medium text-body">{p.label}</div>
                  <div className="text-xs text-muted">{p.model}</div>
                  {!available && <div className="text-xs text-warn">API key not configured</div>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Bias-safe */}
      <section className="card flex items-center justify-between gap-4 p-5">
        <div>
          <div className="font-medium text-body">Bias-safe screening</div>
          <div className="text-sm text-muted">
            Redact name, contact details, and gendered terms before scoring for a fairer evaluation.
          </div>
        </div>
        <button
          onClick={() => setBiasSafe((b) => !b)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${biasSafe ? "bg-primary" : "bg-surface-2"}`}
          aria-pressed={biasSafe}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${biasSafe ? "left-6" : "left-1"}`} />
        </button>
      </section>

      {error && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={run} disabled={busy} className="btn-primary">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy ? "Analyzing…" : "Run analysis"}
        </button>
        <button onClick={() => navigate("/")} className="btn-ghost">
          Back
        </button>
      </div>
      {busy && (
        <p className="text-sm text-muted">
          The AI is reading the resume and scoring each rule — this can take 10–30 seconds.
        </p>
      )}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sparkles;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition ${
        active ? "border-primary/70 bg-primary/10" : "border-line bg-surface-2/40 hover:border-primary/40"
      }`}
    >
      <Icon size={20} className="mb-2 text-primary-soft" />
      <div className="font-medium text-body">{title}</div>
      <div className="mt-1 text-sm text-muted">{desc}</div>
    </button>
  );
}
