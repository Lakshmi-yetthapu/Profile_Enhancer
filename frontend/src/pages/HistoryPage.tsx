import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileSearch, Loader2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { Analysis } from "@/types";

const VERDICT_CLS: Record<string, string> = {
  select: "text-good",
  review: "text-warn",
  reject: "text-bad",
};

export default function HistoryPage() {
  const [items, setItems] = useState<Analysis[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Analysis[]>("/api/analyses")
      .then(({ data }) => setItems(data))
      .catch((err) => setError(apiError(err)));
  }, []);

  if (error) return <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-bad">{error}</div>;
  if (!items)
    return (
      <div className="grid place-items-center py-20 text-muted">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="animate-fade-up">
      <header className="mb-8">
        <h1 className="text-3xl">History</h1>
        <p className="mt-2 text-muted">Your past resume analyses.</p>
      </header>

      {items.length === 0 ? (
        <div className="card grid place-items-center gap-3 p-12 text-center">
          <FileSearch className="text-muted" size={32} />
          <p className="text-muted">No analyses yet.</p>
          <Link to="/" className="btn-primary">Analyze a resume</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Link
              key={a.id}
              to={`/report/${a.id}`}
              className="card flex items-center justify-between p-4 transition hover:border-primary/50"
            >
              <div className="flex items-center gap-4">
                <div className="font-display text-2xl text-body" style={{ minWidth: 44 }}>
                  {Math.round(a.overall_score)}
                </div>
                <div>
                  <div className="font-medium text-body">
                    <span className={`capitalize ${VERDICT_CLS[a.verdict] ?? ""}`}>{a.verdict}</span>
                    {" · "}
                    {a.mode === "jd" ? "JD match" : "Rubric check"}
                  </div>
                  <div className="text-xs text-muted">
                    {a.provider} · {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <ArrowRight size={18} className="text-muted" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
