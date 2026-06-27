import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Pencil } from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { Build } from "@/types";

export default function BuildResultPage() {
  const { buildId } = useParams();
  const [build, setBuild] = useState<Build | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Build>(`/api/builder/${buildId}`).then(({ data }) => setBuild(data)).catch((e) => setError(apiError(e)));
  }, [buildId]);

  if (error) return <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-bad">{error}</div>;
  if (!build) return <div className="grid place-items-center py-20 text-muted"><Loader2 className="animate-spin" /></div>;

  const r = build.result_json;
  const p = r.personal || build.input_json.personal;
  const ats = r.ats;

  return (
    <div className="animate-fade-up">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/builder" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body">
          <ArrowLeft size={15} /> Back to builder
        </Link>
        <div className="flex gap-2">
          <Link to="/builder" className="btn-ghost"><Pencil size={15} /> New resume</Link>
          <button onClick={() => window.print()} className="btn-primary"><Download size={16} /> Download PDF</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* The ATS resume "paper" */}
        <div className="mx-auto w-full max-w-[800px] rounded-xl bg-white p-10 text-[13px] leading-relaxed text-gray-800 shadow-soft print:rounded-none print:p-0 print:shadow-none">
          <header className="border-b border-gray-300 pb-3 text-center">
            <h1 className="font-display text-2xl font-semibold text-gray-900">{p.name}</h1>
            <div className="mt-1 flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-[12px] text-gray-600">
              {[p.email, p.phone, p.location].filter(Boolean).map((x, i) => <span key={i}>{x}</span>)}
            </div>
            <div className="mt-0.5 flex flex-wrap justify-center gap-x-2 text-[12px] text-gray-600">
              {[
                ["LinkedIn", p.linkedin],
                ["GitHub", p.github],
                ["Coding", p.coding_profile],
                ["Portfolio", p.portfolio],
              ].filter(([, v]) => v).map(([label, v], i) => (
                <a key={i} href={v as string} target="_blank" rel="noreferrer" className="text-gray-700 underline">{label}</a>
              ))}
            </div>
          </header>

          {r.summary && (
            <ResumeSection title="Summary">
              <p>{r.summary}</p>
            </ResumeSection>
          )}

          {r.skills && Object.keys(r.skills).length > 0 && (
            <ResumeSection title="Skills">
              <div className="space-y-0.5">
                {Object.entries(r.skills).map(([cat, list]) => (
                  <div key={cat}><span className="font-semibold text-gray-900">{cat}:</span> {list.join(", ")}</div>
                ))}
              </div>
            </ResumeSection>
          )}

          {r.experience && r.experience.length > 0 && (
            <ResumeSection title="Experience">
              {r.experience.map((e, i) => (
                <div key={i} className="mb-2">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold text-gray-900">{e.title}{e.company ? `, ${e.company}` : ""}</span>
                    <span className="text-[12px] text-gray-600">{[e.start_date, e.end_date].filter(Boolean).join(" – ")}</span>
                  </div>
                  <ul className="ml-4 list-disc">{e.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                </div>
              ))}
            </ResumeSection>
          )}

          {r.projects && r.projects.length > 0 && (
            <ResumeSection title="Projects">
              {r.projects.map((pr, i) => (
                <div key={i} className="mb-2">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold text-gray-900">{pr.title}</span>
                    <span className="text-[12px] text-gray-600">
                      {[pr.repo_url ? "GitHub" : null, pr.live_url ? "Live" : null].filter(Boolean).map((label, j) => (
                        <a key={j} href={(label === "GitHub" ? pr.repo_url : pr.live_url) as string} target="_blank" rel="noreferrer" className="ml-2 underline">{label}</a>
                      ))}
                    </span>
                  </div>
                  {pr.tech_stack.length > 0 && <div className="text-[12px] italic text-gray-600">{pr.tech_stack.join(", ")}</div>}
                  <ul className="ml-4 list-disc">{pr.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                </div>
              ))}
            </ResumeSection>
          )}

          {r.certifications && r.certifications.length > 0 && (
            <ResumeSection title="Certifications">
              <ul className="ml-4 list-disc">{r.certifications.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </ResumeSection>
          )}

          {r.achievements && r.achievements.length > 0 && (
            <ResumeSection title="Achievements">
              <ul className="ml-4 list-disc">{r.achievements.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </ResumeSection>
          )}
        </div>

        {/* ATS feedback */}
        {ats && (
          <aside className="no-print space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="card p-5 text-center">
              <div className="font-display text-4xl" style={{ color: ats.score >= 75 ? "#6fae8f" : ats.score >= 55 ? "#c9a25f" : "#bd7373" }}>
                {Math.round(ats.score)}
              </div>
              <div className="text-xs text-muted">ATS score</div>
            </div>
            {ats.matched_keywords?.length > 0 && (
              <div className="card p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-good">Matched keywords</div>
                <div className="flex flex-wrap gap-1.5">{ats.matched_keywords.map((k) => <span key={k} className="chip">{k}</span>)}</div>
              </div>
            )}
            {ats.missing_keywords?.length > 0 && (
              <div className="card p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-warn">Consider adding (if true)</div>
                <div className="flex flex-wrap gap-1.5">{ats.missing_keywords.map((k) => <span key={k} className="chip">{k}</span>)}</div>
              </div>
            )}
            {ats.tips?.length > 0 && (
              <div className="card p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Tips</div>
                <ul className="space-y-1.5 text-sm text-body">{ats.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="mb-1 border-b border-gray-300 pb-0.5 text-[13px] font-bold uppercase tracking-wide text-gray-900">{title}</h2>
      {children}
    </section>
  );
}
