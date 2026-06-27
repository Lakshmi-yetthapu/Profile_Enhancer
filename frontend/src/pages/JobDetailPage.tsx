import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Briefcase, Loader2, Trophy } from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { JobDescription, RankedResume } from "@/types";

const VERDICT_CLS: Record<string, string> = {
  strong: "text-good",
  moderate: "text-warn",
  weak: "text-bad",
};

export default function JobDetailPage() {
  const { jobId } = useParams();
  const [jd, setJd] = useState<JobDescription | null>(null);
  const [ranking, setRanking] = useState<RankedResume[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<JobDescription>(`/api/jds/${jobId}`),
      api.get<RankedResume[]>(`/api/jds/${jobId}/ranking`),
    ])
      .then(([j, r]) => {
        setJd(j.data);
        setRanking(r.data);
      })
      .catch((e) => setError(apiError(e)));
  }, [jobId]);

  if (error) return <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-bad">{error}</div>;
  if (!jd) return <div className="grid place-items-center py-20 text-muted"><Loader2 className="animate-spin" /></div>;

  const s = jd.structured_json;

  return (
    <div className="animate-fade-up space-y-6">
      <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body">
        <ArrowLeft size={15} /> All job descriptions
      </Link>

      <header>
        <div className="flex items-center gap-2 text-primary-soft">
          <Briefcase size={18} />
          <span className="text-xs uppercase tracking-wide">{jd.provider}</span>
        </div>
        <h1 className="mt-1 text-3xl">{jd.title}</h1>
        {jd.company && <p className="text-muted">{jd.company}</p>}
      </header>

      {/* Parsed requirements */}
      <section className="card p-6">
        <h2 className="mb-4 text-lg">Parsed requirements</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Meta label="Seniority" value={s.seniority} />
          <Meta label="Required experience" value={s.required_years != null ? `${s.required_years} yrs` : "—"} />
          <Meta label="Education" value={s.education} />
          <Meta label="Domain" value={s.domain} />
        </div>
        <SkillBlock title="Must-have skills" tone="primary" items={s.must_have_skills} />
        <SkillBlock title="Nice-to-have skills" tone="muted" items={s.nice_to_have_skills} />
        <SkillBlock title="ATS keywords" tone="muted" items={s.ats_keywords} />
        {s.responsibilities && s.responsibilities.length > 0 && (
          <div className="mt-4">
            <div className="label">Key responsibilities</div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-body">
              {s.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* Ranking */}
      <section className="card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Trophy size={18} className="text-sand" />
          <h2 className="text-lg">Resume ranking</h2>
        </div>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted">
            No resumes analyzed against this JD yet. Run a JD analysis and select this role to see it ranked here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3">#</th>
                  <th className="pb-2 px-3">Resume</th>
                  <th className="pb-2 px-3">Fit score</th>
                  <th className="pb-2 px-3">Semantic</th>
                  <th className="pb-2 px-3">Verdict</th>
                  <th className="pb-2 pl-3"></th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.analysis_id} className="border-b border-line/50">
                    <td className="py-2.5 pr-3 font-display text-lg text-muted">{i + 1}</td>
                    <td className="px-3 font-medium text-body">{r.resume_name}</td>
                    <td className="px-3 font-display text-lg text-primary-soft">
                      {r.jd_fit_score != null ? Math.round(r.jd_fit_score) : "—"}
                    </td>
                    <td className="px-3 text-muted">{r.semantic_similarity != null ? `${r.semantic_similarity}%` : "—"}</td>
                    <td className={`px-3 capitalize ${VERDICT_CLS[r.verdict ?? ""] ?? "text-muted"}`}>
                      {r.verdict ?? "—"}
                    </td>
                    <td className="pl-3">
                      <Link to={`/report/${r.analysis_id}`} className="inline-flex items-center gap-1 text-primary-soft hover:underline">
                        Report <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm capitalize text-body">{value || "—"}</div>
    </div>
  );
}

function SkillBlock({ title, tone, items }: { title: string; tone: "primary" | "muted"; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="label">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span key={s} className={`chip ${tone === "primary" ? "border-primary/50 text-primary-soft" : ""}`}>{s}</span>
        ))}
      </div>
    </div>
  );
}
