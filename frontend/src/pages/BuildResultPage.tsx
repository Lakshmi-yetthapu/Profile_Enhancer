import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ClipboardCopy, Download, Loader2, Pencil } from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { Build, BuildResult, PersonalInfo } from "@/types";

type Template = "classic" | "modern" | "compact";

const ACCENTS = ["#0f766e", "#334155", "#6d28d9", "#9f1239", "#1d4ed8"];

const CONTACT_LINKS: [keyof PersonalInfo, string][] = [
  ["linkedin", "LinkedIn"],
  ["github", "GitHub"],
  ["coding_profile", "Coding"],
  ["portfolio", "Portfolio"],
];

export default function BuildResultPage() {
  const { buildId } = useParams();
  const [build, setBuild] = useState<Build | null>(null);
  const [error, setError] = useState("");
  const [template, setTemplate] = useState<Template>("modern");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get<Build>(`/api/builder/${buildId}`).then(({ data }) => setBuild(data)).catch((e) => setError(apiError(e)));
  }, [buildId]);

  if (error) return <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-bad">{error}</div>;
  if (!build) return <div className="grid place-items-center py-20 text-muted"><Loader2 className="animate-spin" /></div>;

  const r = build.result_json;
  const p = r.personal || build.input_json.personal;
  const ats = r.ats;

  async function copyText() {
    await navigator.clipboard.writeText(toPlainText(r, p));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const serif = template === "classic";
  const compact = template === "compact";
  const centered = template === "classic";
  const headingAccent = template === "modern";

  const gapY = compact ? "mt-3" : "mt-5";
  const baseText = compact ? "text-[12px] leading-snug" : "text-[13px] leading-relaxed";

  const sectionHeading = (label: string) => (
    <h2
      className={`mb-1.5 border-b pb-0.5 font-bold uppercase tracking-wide ${compact ? "text-[12px]" : "text-[13px]"}`}
      style={{ color: headingAccent ? accent : "#111827", borderColor: headingAccent ? accent : "#d1d5db" }}
    >
      {label}
    </h2>
  );

  return (
    <div className="animate-fade-up">
      {/* Toolbar */}
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/builder" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body">
          <ArrowLeft size={15} /> Back to builder
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl bg-ink/40 p-1">
            {(["modern", "classic", "compact"] as Template[]).map((t) => (
              <button key={t} onClick={() => setTemplate(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${template === t ? "bg-surface-2 text-body shadow-soft" : "text-muted hover:text-body"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => setAccent(c)} title="Accent color"
                className={`h-5 w-5 rounded-full ring-2 ring-offset-2 ring-offset-ink transition ${accent === c ? "ring-white/60" : "ring-transparent"}`}
                style={{ background: c }} />
            ))}
          </div>
          <button onClick={copyText} className="btn-ghost">
            {copied ? <Check size={15} /> : <ClipboardCopy size={15} />} {copied ? "Copied" : "Copy text"}
          </button>
          <Link to="/builder" className="btn-ghost"><Pencil size={15} /> New</Link>
          <button onClick={() => window.print()} className="btn-primary"><Download size={16} /> Download PDF</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Resume paper */}
        <div className={`resume-paper mx-auto w-full max-w-[820px] rounded-xl bg-white px-10 py-9 text-gray-800 shadow-soft ${baseText} ${serif ? "font-display" : "font-sans"}`}>
          {/* Header */}
          <header className={centered ? "text-center" : ""} style={template === "modern" ? { borderBottom: `2px solid ${accent}`, paddingBottom: 10 } : { borderBottom: "1px solid #d1d5db", paddingBottom: 10 }}>
            <h1 className={`font-semibold text-gray-900 ${compact ? "text-xl" : "text-[26px]"} ${serif ? "font-display" : "font-sans"}`}
              style={template === "modern" ? { color: accent } : undefined}>
              {p.name}
            </h1>
            {r.headline && <div className={`mt-0.5 font-medium ${compact ? "text-[12px]" : "text-sm"} text-gray-700`}>{r.headline}</div>}
            <div className={`mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] text-gray-600 ${centered ? "justify-center" : ""}`}>
              {[p.email, p.phone, p.location].filter(Boolean).map((x, i) => <span key={i}>{x}</span>)}
            </div>
            <div className={`mt-0.5 flex flex-wrap gap-x-3 text-[12px] ${centered ? "justify-center" : ""}`}>
              {CONTACT_LINKS.filter(([k]) => p[k]).map(([k, label]) => (
                <a key={k} href={p[k] as string} target="_blank" rel="noreferrer" className="underline" style={{ color: headingAccent ? accent : "#374151" }}>{label}</a>
              ))}
            </div>
          </header>

          {r.summary && (
            <section className={`resume-section ${gapY}`}>
              {sectionHeading("Summary")}
              <p>{r.summary}</p>
            </section>
          )}

          {r.skills && Object.keys(r.skills).length > 0 && (
            <section className={`resume-section ${gapY}`}>
              {sectionHeading("Skills")}
              <div className="space-y-0.5">
                {Object.entries(r.skills).map(([cat, list]) => (
                  <div key={cat}><span className="font-semibold text-gray-900">{cat}:</span> {list.join(", ")}</div>
                ))}
              </div>
            </section>
          )}

          {r.experience && r.experience.length > 0 && (
            <section className={`resume-section ${gapY}`}>
              {sectionHeading("Experience")}
              <div className="space-y-2">
                {r.experience.map((e, i) => (
                  <div key={i} className="resume-item">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-gray-900">{e.title}{e.company ? ` · ${e.company}` : ""}</span>
                      <span className="shrink-0 text-[12px] text-gray-500">{[e.start_date, e.end_date].filter(Boolean).join(" – ")}</span>
                    </div>
                    <ul className="ml-4 list-disc marker:text-gray-400">{e.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {r.projects && r.projects.length > 0 && (
            <section className={`resume-section ${gapY}`}>
              {sectionHeading("Projects")}
              <div className="space-y-2">
                {r.projects.map((pr, i) => (
                  <div key={i} className="resume-item">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-gray-900">{pr.title}</span>
                      <span className="shrink-0 text-[12px]">
                        {pr.repo_url && <a href={pr.repo_url} target="_blank" rel="noreferrer" className="ml-2 underline" style={{ color: headingAccent ? accent : "#374151" }}>GitHub</a>}
                        {pr.live_url && <a href={pr.live_url} target="_blank" rel="noreferrer" className="ml-2 underline" style={{ color: headingAccent ? accent : "#374151" }}>Live</a>}
                      </span>
                    </div>
                    {pr.tech_stack.length > 0 && <div className="text-[12px] italic text-gray-600">{pr.tech_stack.join(" · ")}</div>}
                    <ul className="ml-4 list-disc marker:text-gray-400">{pr.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {r.certifications && r.certifications.length > 0 && (
            <section className={`resume-section ${gapY}`}>
              {sectionHeading("Certifications")}
              <ul className="ml-4 list-disc marker:text-gray-400">{r.certifications.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </section>
          )}

          {r.achievements && r.achievements.length > 0 && (
            <section className={`resume-section ${gapY}`}>
              {sectionHeading("Achievements")}
              <ul className="ml-4 list-disc marker:text-gray-400">{r.achievements.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </section>
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
              {build.jd_text && <div className="mt-1 text-[11px] text-muted">tailored to a JD</div>}
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

function toPlainText(r: BuildResult, p: PersonalInfo): string {
  const lines: string[] = [];
  lines.push(p.name);
  if (r.headline) lines.push(r.headline);
  lines.push([p.email, p.phone, p.location].filter(Boolean).join(" | "));
  const links = [p.linkedin, p.github, p.coding_profile, p.portfolio].filter(Boolean);
  if (links.length) lines.push(links.join(" | "));

  const sec = (title: string) => { lines.push("", title.toUpperCase()); };

  if (r.summary) { sec("Summary"); lines.push(r.summary); }
  if (r.skills && Object.keys(r.skills).length) {
    sec("Skills");
    Object.entries(r.skills).forEach(([c, l]) => lines.push(`${c}: ${l.join(", ")}`));
  }
  if (r.experience?.length) {
    sec("Experience");
    r.experience.forEach((e) => {
      lines.push(`${e.title}${e.company ? ` · ${e.company}` : ""}  ${[e.start_date, e.end_date].filter(Boolean).join(" – ")}`.trim());
      e.bullets.forEach((b) => lines.push(`- ${b}`));
    });
  }
  if (r.projects?.length) {
    sec("Projects");
    r.projects.forEach((pr) => {
      lines.push(`${pr.title}${pr.tech_stack.length ? ` (${pr.tech_stack.join(", ")})` : ""}`);
      [pr.repo_url, pr.live_url].filter(Boolean).forEach((u) => lines.push(`  ${u}`));
      pr.bullets.forEach((b) => lines.push(`- ${b}`));
    });
  }
  if (r.certifications?.length) { sec("Certifications"); r.certifications.forEach((c) => lines.push(`- ${c}`)); }
  if (r.achievements?.length) { sec("Achievements"); r.achievements.forEach((a) => lines.push(`- ${a}`)); }
  return lines.join("\n");
}
