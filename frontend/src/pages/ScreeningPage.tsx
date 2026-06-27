import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Loader2 } from "lucide-react";
import api, { apiError, tokenStore } from "@/lib/api";
import type { ScreeningItem } from "@/types";

const STATUSES = ["all", "pending", "shortlisted", "rejected", "review"] as const;
type StatusFilter = (typeof STATUSES)[number];

const STATUS_CLS: Record<string, string> = {
  shortlisted: "border-good/40 bg-good/10 text-good",
  rejected: "border-bad/40 bg-bad/10 text-bad",
  review: "border-warn/40 bg-warn/10 text-warn",
  pending: "border-line bg-surface-2/60 text-muted",
};

const VERDICT_CLS: Record<string, string> = {
  select: "text-good",
  review: "text-warn",
  reject: "text-bad",
};

export default function ScreeningPage() {
  const [items, setItems] = useState<ScreeningItem[] | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState("");

  const load = (status: StatusFilter) => {
    setItems(null);
    const q = status === "all" ? "" : `?status=${status}`;
    api
      .get<ScreeningItem[]>(`/api/analyses/screening${q}`)
      .then(({ data }) => setItems(data))
      .catch((e) => setError(apiError(e)));
  };

  useEffect(() => {
    load(filter);
  }, [filter]);

  async function setStatus(id: number, status: string) {
    await api.patch(`/api/analyses/${id}/review`, { status });
    setItems((prev) => prev?.map((x) => (x.id === id ? { ...x, status } : x)) ?? null);
  }

  function exportCsv() {
    // include auth token via query-less fetch using the stored token
    fetch("/api/analyses/export.csv", {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "screening.csv";
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Screening queue</h1>
          <p className="mt-2 text-muted">Review every analysis, shortlist or reject, and export.</p>
        </div>
        <button onClick={exportCsv} className="btn-ghost shrink-0">
          <Download size={16} /> Export CSV
        </button>
      </header>

      <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-ink/40 p-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${
              filter === s ? "bg-surface-2 text-body shadow-soft" : "text-muted hover:text-body"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-bad">{error}</div>}

      {!items ? (
        <div className="grid place-items-center py-20 text-muted"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="card grid place-items-center p-12 text-muted">No analyses in this bucket.</div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center gap-4 p-4">
              <div className="font-display text-2xl text-body" style={{ minWidth: 40 }}>
                {Math.round(a.mode === "jd" && a.jd_fit_score != null ? a.jd_fit_score : a.overall_score)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-body">{a.candidate || a.resume_name}</div>
                <div className="text-xs text-muted">
                  <span className={`capitalize ${VERDICT_CLS[a.verdict] ?? ""}`}>{a.verdict}</span>
                  {" · "}{a.mode === "jd" ? "JD match" : "Rubric"}
                  {a.confidence != null ? ` · ${Math.round(a.confidence)}% conf` : ""}
                  {" · "}{new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_CLS[a.status] ?? STATUS_CLS.pending}`}>
                {a.status}
              </span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setStatus(a.id, "shortlisted")} className="rounded-lg border border-good/40 px-2.5 py-1 text-xs text-good hover:bg-good/10">
                  Shortlist
                </button>
                <button onClick={() => setStatus(a.id, "rejected")} className="rounded-lg border border-bad/40 px-2.5 py-1 text-xs text-bad hover:bg-bad/10">
                  Reject
                </button>
                <Link to={`/report/${a.id}`} className="rounded-lg border border-line px-2.5 py-1 text-xs text-primary-soft hover:border-primary/50">
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
