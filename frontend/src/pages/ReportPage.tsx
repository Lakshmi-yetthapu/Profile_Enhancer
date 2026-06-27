import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Award,
  Briefcase,
  Check,
  Code2,
  Download,
  ExternalLink,
  GitFork,
  Github,
  Loader2,
  Mail,
  ShieldAlert,
  Target,
  Wand2,
  X,
} from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Analysis, AppConfig } from "@/types";
import ScoreGauge from "@/components/ScoreGauge";

const VERDICT_STYLES: Record<string, { label: string; cls: string }> = {
  select: { label: "Likely Select", cls: "border-good/40 bg-good/10 text-good" },
  review: { label: "Needs Review", cls: "border-warn/40 bg-warn/10 text-warn" },
  reject: { label: "Likely Reject", cls: "border-bad/40 bg-bad/10 text-bad" },
};

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-bad",
  medium: "bg-warn",
  low: "bg-sand",
  info: "bg-muted",
};

export default function ReportPage() {
  const { analysisId } = useParams();
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState("");
  const [emailing, setEmailing] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [recipient, setRecipient] = useState("");

  useEffect(() => {
    api
      .get<Analysis>(`/api/analyses/${analysisId}`)
      .then(({ data }) => setAnalysis(data))
      .catch((err) => setError(apiError(err)));
    api.get<AppConfig>("/api/config").then(({ data }) => setConfig(data)).catch(() => {});
  }, [analysisId]);

  function openEmailBox() {
    setEmailMsg("");
    setRecipient(analysis?.candidate_email ?? "");
    setShowEmail(true);
  }

  async function sendEmail() {
    if (!recipient.trim()) {
      setEmailMsg("Enter the candidate's email.");
      return;
    }
    setEmailMsg("");
    setEmailing(true);
    try {
      const { data } = await api.post(`/api/analyses/${analysisId}/email`, { recipient });
      setEmailMsg(`Sent to ${data.recipient} · Ref ${data.share_code}`);
      setShowEmail(false);
    } catch (e) {
      setEmailMsg(apiError(e));
    } finally {
      setEmailing(false);
    }
  }

  if (error)
    return <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-bad">{error}</div>;
  if (!analysis)
    return (
      <div className="grid place-items-center py-20 text-muted">
        <Loader2 className="animate-spin" />
      </div>
    );

  const r = analysis.result_json;
  const verdict = VERDICT_STYLES[analysis.verdict] ?? VERDICT_STYLES.review;
  const banned = r.detected_banned_projects ?? [];

  return (
    <div className="animate-fade-up space-y-6 print-text-dark">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Feedback report</h1>
          <p className="mt-1 text-sm text-muted">
            {analysis.mode === "jd" ? "JD-matched analysis" : "Rubric analysis"} ·{" "}
            <span className="capitalize">{analysis.provider}</span> ({analysis.model}) ·{" "}
            {new Date(analysis.created_at).toLocaleString()}
            {analysis.share_code && <> · Ref <span className="text-body">{analysis.share_code}</span></>}
          </p>
        </div>
        <div className="no-print flex flex-col items-end gap-2">
          <div className="flex gap-2">
            {user?.role === "admin" && config?.email_enabled && (
              <button onClick={openEmailBox} className="btn-ghost">
                <Mail size={16} /> Email candidate
              </button>
            )}
            <button onClick={() => window.print()} className="btn-ghost">
              <Download size={16} /> Download PDF
            </button>
          </div>

          {showEmail && (
            <div className="w-full max-w-sm rounded-xl border border-line bg-surface-2/60 p-3">
              <label className="label">Send report to candidate</label>
              <input
                className="input"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="candidate@email.com"
              />
              <p className="mt-1 text-xs text-muted">Auto-detected from the resume — edit if needed.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={sendEmail} disabled={emailing} className="btn-primary">
                  {emailing ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  Send
                </button>
                <button onClick={() => setShowEmail(false)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          )}
          {emailMsg && <span className="text-xs text-muted">{emailMsg}</span>}
        </div>
      </div>

      {/* Score + verdict + summary */}
      <section className="card grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center">
        <ScoreGauge score={analysis.overall_score} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${verdict.cls}`}>
              {verdict.label}
            </span>
            {analysis.percentile != null && (
              <span className="chip">Top {Math.max(1, Math.round(100 - analysis.percentile))}% of cohort</span>
            )}
            {analysis.confidence != null && (
              <span className="chip">AI confidence {Math.round(analysis.confidence)}%</span>
            )}
            {analysis.score_delta != null && (
              <span className={`chip ${analysis.score_delta >= 0 ? "text-good" : "text-bad"}`}>
                {analysis.score_delta >= 0 ? "▲" : "▼"} {Math.abs(analysis.score_delta)} vs last
              </span>
            )}
          </div>
          {r.bias_safe?.enabled && (
            <p className="mt-2 text-xs text-muted">
              Bias-safe mode: redacted {r.bias_safe.redacted.join(", ") || "personal identifiers"} before scoring.
            </p>
          )}
          {r.summary && <p className="mt-3 leading-relaxed text-body">{r.summary}</p>}
          {analysis.mode === "jd" && r.jd_match && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3">
              <Target size={18} className="text-primary-soft" />
              <div className="flex-1">
                <div className="text-sm font-medium">JD alignment</div>
                <div className="text-xs text-muted">{r.jd_match.alignment_summary}</div>
              </div>
              <span className="font-display text-2xl text-primary-soft">{r.jd_match.score}</span>
            </div>
          )}
        </div>
      </section>

      {/* Critical alerts */}
      {(banned.length > 0 || r.experience_includes_nxtwave_training) && (
        <section className="card border-bad/40 bg-bad/5 p-5">
          <div className="mb-2 flex items-center gap-2 font-medium text-bad">
            <AlertTriangle size={18} /> Critical issues — these can cause rejection
          </div>
          <ul className="space-y-1.5 text-sm text-body">
            {banned.length > 0 && (
              <li>
                NxtWave internal project(s) presented as personal work:{" "}
                <span className="font-medium text-bad">{banned.join(", ")}</span>. Replace with
                self-made projects.
              </li>
            )}
            {r.experience_includes_nxtwave_training && (
              <li>NxtWave training appears in the Experience section — remove it (not counted as experience).</li>
            )}
          </ul>
        </section>
      )}

      {/* Screening flags */}
      {(() => {
        const flags: { tone: "bad" | "warn"; text: string }[] = [];
        if (r.ingest?.hidden_text && r.ingest.hidden_text.length > 0)
          flags.push({ tone: "bad", text: "Hidden / white text detected — possible ATS keyword stuffing." });
        if (r.duplicate)
          flags.push({ tone: "bad", text: `Near-duplicate of ${r.duplicate.name} (${r.duplicate.similarity}% similar) — possible plagiarism.` });
        if (r.ai_generated?.likelihood === "high")
          flags.push({ tone: "warn", text: "Resume reads as likely AI-generated / templated." });
        if (r.ingest && r.ingest.images > 0)
          flags.push({ tone: "warn", text: `${r.ingest.images} image(s) embedded — check for a photo (many orgs reject photos).` });
        const deadLinks = Object.values(r.link_checks ?? {}).filter((c) => !c.live).length;
        if (deadLinks > 0)
          flags.push({ tone: "warn", text: `${deadLinks} link(s) are dead or unreachable.` });
        const forks = (r.project_authenticity ?? []).filter((x) => x.is_fork).length;
        if (forks > 0)
          flags.push({ tone: "bad", text: `${forks} project repo(s) are forks, not original work.` });
        if (flags.length === 0) return null;
        return (
          <section className="card border-warn/40 bg-warn/5 p-5">
            <div className="mb-2 flex items-center gap-2 font-medium text-warn">
              <ShieldAlert size={18} /> Screening flags
            </div>
            <ul className="space-y-1.5 text-sm">
              {flags.map((f, i) => (
                <li key={i} className={f.tone === "bad" ? "text-bad" : "text-body"}>• {f.text}</li>
              ))}
            </ul>
          </section>
        );
      })()}

      {/* Criterion breakdown */}
      <section className="card p-6">
        <h2 className="mb-4 text-lg">Rubric breakdown</h2>
        <div className="space-y-3">
          {analysis.criterion_results.map((c) => (
            <div key={c.criterion_key} className="rounded-xl border border-line bg-surface-2/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                      c.passed ? "bg-good/20 text-good" : "bg-bad/20 text-bad"
                    }`}
                  >
                    {c.passed ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-body">{c.title}</span>
                      <span className={`h-2 w-2 rounded-full ${SEVERITY_DOT[c.severity] ?? "bg-muted"}`} />
                    </div>
                    <p className="mt-1 text-sm text-muted">{c.comment}</p>
                    {c.evidence && (
                      <p className="mt-2 border-l-2 border-line pl-3 text-xs italic text-muted">
                        “{c.evidence}”
                      </p>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-display text-lg text-muted">{Math.round(c.score)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Projects */}
      {r.projects && r.projects.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-4 text-lg">Projects</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3">Project</th>
                  <th className="pb-2 px-3">Self-made</th>
                  <th className="pb-2 px-3">GitHub</th>
                  <th className="pb-2 pl-3">Live demo</th>
                </tr>
              </thead>
              <tbody>
                {r.projects.map((p, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td className="py-2.5 pr-3 font-medium text-body">
                      {p.name}
                      {p.repo_is_fork && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-bad">
                          <GitFork size={12} /> fork
                        </span>
                      )}
                    </td>
                    <td className="px-3"><YesNo ok={p.is_self_made && !p.repo_is_fork} /></td>
                    <td className="px-3">
                      {extHref(p.github_url) ? (
                        <a href={extHref(p.github_url)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                          <Github size={14} />
                          <LinkDot live={p.github_live} />
                        </a>
                      ) : (
                        <YesNo ok={false} />
                      )}
                    </td>
                    <td className="pl-3">
                      {extHref(p.deployed_url) ? (
                        <a href={extHref(p.deployed_url)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                          <ExternalLink size={14} />
                          <LinkDot live={p.deployed_live} />
                        </a>
                      ) : (
                        <YesNo ok={false} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.projects.length < 2 && (
            <p className="mt-3 rounded-xl border border-warn/30 bg-warn/5 px-3 py-2 text-sm text-warn">
              Only {r.projects.length} project listed — include at least 2 self-made projects (each with GitHub + deployed links).
            </p>
          )}
        </section>
      )}

      {/* Skills */}
      <section className="card p-6">
        <h2 className="mb-1 text-lg">Skills</h2>
        {r.skills_grouped === false ? (
          <p className="mb-3 text-sm text-warn">
            Skills aren't grouped into sections. Organize them into Frontend, Backend, Databases, AI/ML, Tools, etc.
          </p>
        ) : (
          <p className="mb-3 text-sm text-muted">Grouped into clear sections — good.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {r.skill_sections &&
            Object.entries(r.skill_sections).map(([section, skills]) => (
              <div key={section} className="rounded-xl border border-line bg-surface-2/40 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-soft">
                  {section}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="chip">{s}</span>
                  ))}
                </div>
              </div>
            ))}
        </div>
        {r.ungrouped_skills && r.ungrouped_skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.ungrouped_skills.map((s) => (
              <span key={s} className="chip">{s}</span>
            ))}
          </div>
        )}
      </section>

      {/* Coding profile / LeetCode */}
      <section className="card p-6">
        <div className="mb-3 flex items-center gap-2">
          <Code2 size={18} className="text-primary-soft" />
          <h2 className="text-lg">Coding profile</h2>
        </div>
        {r.leetcode?.fetch_failed ? (
          <p className="text-sm text-warn">
            A LeetCode profile was detected{" "}
            {extHref(r.leetcode.profile_url) && (
              <a href={extHref(r.leetcode.profile_url)!} target="_blank" rel="noreferrer" className="text-primary-soft hover:underline">
                ({r.leetcode.profile_url})
              </a>
            )}{" "}
            but its public stats couldn't be fetched (profile may be private, renamed, or temporarily
            rate-limited). Verify the profile is public.
          </p>
        ) : r.leetcode ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-medium text-body">@{r.leetcode.username}</span>
              {r.leetcode.meets_problem_bar != null && (
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  r.leetcode.meets_problem_bar ? "border-good/40 bg-good/10 text-good" : "border-bad/40 bg-bad/10 text-bad"
                }`}>
                  {r.leetcode.meets_problem_bar
                    ? `Meets ${r.leetcode.min_problems ?? 100}+ bar`
                    : `Below ${r.leetcode.min_problems ?? 100} bar`}
                </span>
              )}
              {r.leetcode.consistent != null && (
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  r.leetcode.consistent ? "border-good/40 bg-good/10 text-good" : "border-warn/40 bg-warn/10 text-warn"
                }`}>
                  {r.leetcode.consistent ? "Consistent" : "Inconsistent practice"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total solved" value={r.leetcode.total_solved} />
              <Stat label="Easy" value={r.leetcode.easy} />
              <Stat label="Medium" value={r.leetcode.medium} />
              <Stat label="Hard" value={r.leetcode.hard} />
            </div>
            <p className="mt-3 text-sm text-muted">
              {r.leetcode.active_days} active days · current streak {r.leetcode.current_streak}
            </p>
            {r.leetcode.improvement_points && r.leetcode.improvement_points.length > 0 ? (
              <div className="mt-3 rounded-xl border border-warn/30 bg-warn/5 p-3">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-warn">
                  Coding — improvement points
                </div>
                <ul className="space-y-1 text-sm text-body">
                  {r.leetcode.improvement_points.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" /> {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-line bg-surface-2/40 p-3 text-sm text-body">
                {r.leetcode.guidance}
              </p>
            )}
          </div>
        ) : r.coding_profiles && r.coding_profiles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {r.coding_profiles.map((p, i) => {
              const href = extHref(p.url);
              return href ? (
                <a key={i} href={href} target="_blank" rel="noreferrer" className="chip hover:border-primary/60">
                  {p.platform} <ExternalLink size={12} />
                </a>
              ) : (
                <span key={i} className="chip">{p.platform}</span>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-warn">
            No coding profile link found. Add a LeetCode (or similar) profile so your problem-solving
            can be evaluated.
          </p>
        )}
      </section>

      {/* Certifications */}
      {r.certifications && r.certifications.length > 0 && (
        <section className="card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Award size={18} className="text-primary-soft" />
            <h2 className="text-lg">Certifications</h2>
          </div>
          <ul className="space-y-2 text-sm">
            {r.certifications.map((c, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-line bg-surface-2/40 px-3 py-2">
                <span className="text-body">
                  {c.name}
                  {c.issuer ? <span className="text-muted"> · {c.issuer}</span> : null}
                </span>
                {c.is_nxtwave_course && <span className="chip text-warn">Not counted (NxtWave)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* GitHub activity */}
      {r.github && (
        <section className="card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Github size={18} className="text-primary-soft" />
            <h2 className="text-lg">GitHub activity</h2>
            <a href={`https://github.com/${r.github.username}`} target="_blank" className="no-print text-sm text-primary-soft hover:underline">
              @{r.github.username}
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Original repos" value={r.github.original_repos} />
            <Stat label="Forked" value={r.github.forked_repos} />
            <Stat label="Total stars" value={r.github.total_stars} />
            <Stat label="Followers" value={r.github.followers} />
          </div>
          {r.github.top_languages.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.github.top_languages.map((l) => <span key={l} className="chip">{l}</span>)}
            </div>
          )}
        </section>
      )}

      {/* Content quality */}
      {(r.quantified_impact || r.writing_quality || r.claimed_vs_evidenced_skills || r.contact_info || r.format) && (
        <section className="card p-6">
          <h2 className="mb-4 text-lg">Content quality</h2>
          <div className="space-y-4">
            {r.quantified_impact && (
              <QualityRow
                label="Quantified impact"
                score={r.quantified_impact.score}
                comment={`${r.quantified_impact.bullets_with_metrics}/${r.quantified_impact.total_bullets} bullets have metrics. ${r.quantified_impact.comment}`}
              />
            )}
            {r.writing_quality && (
              <QualityRow label="Writing quality" score={r.writing_quality.score} comment={r.writing_quality.comment} />
            )}
          </div>

          {r.writing_quality && (r.writing_quality.weak_phrases?.length || r.writing_quality.spelling_grammar_issues?.length) ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TagList title="Weak phrases" tone="bad" items={r.writing_quality.weak_phrases ?? []} />
              <TagList title="Spelling / grammar" tone="bad" items={r.writing_quality.spelling_grammar_issues ?? []} />
            </div>
          ) : null}

          {r.claimed_vs_evidenced_skills && r.claimed_vs_evidenced_skills.unsubstantiated && r.claimed_vs_evidenced_skills.unsubstantiated.length > 0 && (
            <div className="mt-4 rounded-xl border border-warn/30 bg-warn/5 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-warn">
                Skills claimed but not evidenced
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.claimed_vs_evidenced_skills.unsubstantiated.map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
              <p className="mt-2 text-xs text-muted">{r.claimed_vs_evidenced_skills.comment}</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {r.contact_info && (["email", "phone", "linkedin", "location"] as const).map((f) => (
              <span key={f} className={`chip ${r.contact_info![f] ? "text-good" : "text-bad"}`}>
                {r.contact_info![f] ? <Check size={12} /> : <X size={12} />} {f}
              </span>
            ))}
            {r.ingest?.pages != null && <span className="chip">{r.ingest.pages} page{r.ingest.pages === 1 ? "" : "s"}</span>}
            {r.format && (
              <span className={`chip ${r.format.ats_friendly ? "text-good" : "text-warn"}`}>
                {r.format.ats_friendly ? "ATS-friendly" : "ATS concerns"}
              </span>
            )}
          </div>
        </section>
      )}

      {/* JD match details */}
      {analysis.mode === "jd" && r.jd_match && (
        <>
          {/* Dimension breakdown */}
          {r.jd_match.dimensions && r.jd_match.dimensions.length > 0 && (
            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg">Fit breakdown</h2>
                {analysis.job_description_id && (
                  <Link
                    to={`/jobs/${analysis.job_description_id}`}
                    className="no-print inline-flex items-center gap-1 text-sm text-primary-soft hover:underline"
                  >
                    <Briefcase size={14} /> View JD & ranking
                  </Link>
                )}
              </div>
              <div className="space-y-3">
                {r.jd_match.dimensions.map((d, i) => (
                  <DimensionBar key={i} name={d.name} score={d.score} comment={d.comment} />
                ))}
              </div>
            </section>
          )}

          {/* Semantic skill matrix */}
          {r.jd_match.semantic_skill_matrix && r.jd_match.semantic_skill_matrix.length > 0 && (
            <section className="card p-6">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-lg">Skill match</h2>
                {r.jd_match.semantic_coverage != null && (
                  <span className="text-sm text-muted">
                    Coverage <span className="font-display text-lg text-primary-soft">{r.jd_match.semantic_coverage}%</span>
                  </span>
                )}
              </div>
              <p className="mb-4 text-xs text-muted">Matched by meaning (embeddings), so synonyms count.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {r.jd_match.semantic_skill_matrix.map((m, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-line bg-surface-2/40 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-body">{m.jd_skill}</div>
                      {m.best_match && m.status !== "have" && (
                        <div className="text-xs text-muted">closest: {m.best_match}</div>
                      )}
                    </div>
                    <SkillStatus status={m.status} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Skills & keywords lists */}
          <section className="card p-6">
            <h2 className="mb-4 text-lg">Skills & keywords</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TagList title="Matched skills" tone="good" items={r.jd_match.matched_skills} />
              <TagList title="Missing skills" tone="bad" items={r.jd_match.missing_skills} />
              <TagList title="Matched keywords" tone="good" items={r.jd_match.matched_keywords} />
              <TagList title="Missing keywords" tone="bad" items={r.jd_match.missing_keywords} />
            </div>
            {r.jd_match.ats_keywords_to_add && r.jd_match.ats_keywords_to_add.length > 0 && (
              <div className="mt-4 rounded-xl border border-sand/30 bg-sand/5 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sand">
                  ATS keywords to add
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.jd_match.ats_keywords_to_add.map((k) => <span key={k} className="chip">{k}</span>)}
                </div>
              </div>
            )}
            {r.jd_match.experience_gap && (
              <p className="mt-4 text-sm text-muted">
                <span className="font-medium text-body">Experience gap: </span>
                {r.jd_match.experience_gap}
              </p>
            )}
          </section>

          {/* Bullet rewrites */}
          {r.jd_match.bullet_rewrites && r.jd_match.bullet_rewrites.length > 0 && (
            <section className="card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Wand2 size={18} className="text-primary-soft" />
                <h2 className="text-lg">Suggested bullet rewrites</h2>
              </div>
              <div className="space-y-4">
                {r.jd_match.bullet_rewrites.map((b, i) => (
                  <div key={i} className="rounded-xl border border-line bg-surface-2/40 p-4">
                    <div className="text-sm text-muted line-through decoration-bad/50">{b.original}</div>
                    <div className="mt-2 flex items-start gap-2 text-sm text-body">
                      <Check size={15} className="mt-0.5 shrink-0 text-good" />
                      <span>{b.improved}</span>
                    </div>
                    {b.reason && <div className="mt-2 text-xs italic text-muted">{b.reason}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tailoring actions */}
          {r.jd_match.tailoring_actions && r.jd_match.tailoring_actions.length > 0 && (
            <section className="card p-6">
              <h2 className="mb-3 text-lg">Tailor this resume for the role</h2>
              <ul className="space-y-3">
                {[...r.jd_match.tailoring_actions]
                  .sort((a, b) => rank(a.priority) - rank(b.priority))
                  .map((t, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority] ?? "bg-muted"}`} />
                      <span className="text-body">{t.text}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Strengths + improvements */}
      <div className="grid gap-6 md:grid-cols-2">
        {r.strengths && r.strengths.length > 0 && (
          <section className="card p-6">
            <h2 className="mb-3 text-lg">Strengths</h2>
            <ul className="space-y-2">
              {r.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-body">
                  <Check size={16} className="mt-0.5 shrink-0 text-good" /> {s}
                </li>
              ))}
            </ul>
          </section>
        )}
        {r.improvements && r.improvements.length > 0 && (
          <section className="card p-6">
            <h2 className="mb-3 text-lg">How to improve</h2>
            <ul className="space-y-3">
              {[...r.improvements]
                .sort((a, b) => rank(a.priority) - rank(b.priority))
                .map((imp, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[imp.priority] ?? "bg-muted"}`} />
                    <span className="text-body">{imp.text}</span>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

const PRIORITY_DOT: Record<string, string> = { high: "bg-bad", medium: "bg-warn", low: "bg-good" };
function rank(p: string) {
  return p === "high" ? 0 : p === "medium" ? 1 : 2;
}

/** Normalize an LLM-extracted value into a safe absolute external URL, or null.
 * Prevents bare words (e.g. "Leetcode") from becoming broken relative links. */
function extHref(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^www\./i.test(u) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u)) return `https://${u}`;
  return null;
}

function LinkDot({ live }: { live?: boolean | null }) {
  if (live == null) return <span className="text-xs text-muted">link</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${live ? "text-good" : "text-bad"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-good" : "bg-bad"}`} />
      {live ? "live" : "dead"}
    </span>
  );
}

function YesNo({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-good"><Check size={14} /> Yes</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-bad"><X size={14} /> No</span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-3 text-center">
      <div className="font-display text-2xl text-body">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function DimensionBar({ name, score, comment }: { name: string; score: number; comment: string }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 75 ? "#6fae8f" : pct >= 50 ? "#c9a25f" : "#bd7373";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-body">{name}</span>
        <span className="font-display text-muted">{Math.round(pct)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      {comment && <p className="mt-1 text-xs text-muted">{comment}</p>}
    </div>
  );
}

function QualityRow({ label, score, comment }: { label: string; score: number; comment: string }) {
  return <DimensionBar name={label} score={score} comment={comment} />;
}

function SkillStatus({ status }: { status: "have" | "partial" | "missing" }) {
  const map = {
    have: { label: "Have", cls: "border-good/40 bg-good/10 text-good" },
    partial: { label: "Partial", cls: "border-warn/40 bg-warn/10 text-warn" },
    missing: { label: "Missing", cls: "border-bad/40 bg-bad/10 text-bad" },
  } as const;
  const s = map[status] ?? map.missing;
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function TagList({ title, tone, items }: { title: string; tone: "good" | "bad"; items: string[] }) {
  return (
    <div>
      <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${tone === "good" ? "text-good" : "text-bad"}`}>
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? items.map((t) => <span key={t} className="chip">{t}</span>) : <span className="text-sm text-muted">—</span>}
      </div>
    </div>
  );
}
