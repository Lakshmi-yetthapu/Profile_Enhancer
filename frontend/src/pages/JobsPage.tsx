import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Loader2, Plus, Sparkles } from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { AppConfig, JDListItem } from "@/types";

export default function JobsPage() {
  const [items, setItems] = useState<JDListItem[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = () =>
    api.get<JDListItem[]>("/api/jds").then(({ data }) => setItems(data)).catch((e) => setError(apiError(e)));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="animate-fade-up">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Job descriptions</h1>
          <p className="mt-2 text-muted">
            Save a JD once, then match and rank any number of resumes against it.
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary shrink-0">
          <Plus size={16} /> New JD
        </button>
      </header>

      {showForm && <CreateJD onCreated={() => { setShowForm(false); load(); }} />}

      {error && <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-bad">{error}</div>}

      {!items ? (
        <div className="grid place-items-center py-20 text-muted"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="card grid place-items-center gap-3 p-12 text-center">
          <Briefcase className="text-muted" size={32} />
          <p className="text-muted">No job descriptions yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((jd) => (
            <Link key={jd.id} to={`/jobs/${jd.id}`} className="card p-5 transition hover:border-primary/50">
              <div className="flex items-center gap-2 text-primary-soft">
                <Briefcase size={16} />
                <span className="text-xs uppercase tracking-wide">{jd.provider}</span>
              </div>
              <div className="mt-2 font-medium text-body">{jd.title}</div>
              {jd.company && <div className="text-sm text-muted">{jd.company}</div>}
              <div className="mt-3 text-xs text-muted">{new Date(jd.created_at).toLocaleDateString()}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateJD({ onCreated }: { onCreated: () => void }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [rawText, setRawText] = useState("");
  const [provider, setProvider] = useState<"mistral" | "openai">("mistral");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<AppConfig>("/api/config").then(({ data }) => {
      setConfig(data);
      setProvider((data.default_provider as "mistral" | "openai") || "mistral");
    });
  }, []);

  async function submit() {
    if (rawText.trim().length < 20) {
      setError("Paste the full job description (at least a few lines).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/api/jds", {
        raw_text: rawText,
        title: title || null,
        company: company || null,
        provider,
      });
      onCreated();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mb-6 space-y-3 p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" placeholder="Role title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input" placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <textarea
        className="input min-h-[180px] resize-y"
        placeholder="Paste the full job description here…"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Parse with:</span>
        {(["mistral", "openai"] as const).map((p) => (
          <button
            key={p}
            disabled={!config?.providers[p]}
            onClick={() => setProvider(p)}
            className={`chip ${provider === p ? "border-primary/70 text-primary-soft" : ""} ${!config?.providers[p] ? "opacity-40" : ""}`}
          >
            {p}
          </button>
        ))}
      </div>
      {error && <div className="text-sm text-bad">{error}</div>}
      <button onClick={submit} disabled={busy} className="btn-primary">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {busy ? "Parsing JD…" : "Save & parse"}
      </button>
    </div>
  );
}
