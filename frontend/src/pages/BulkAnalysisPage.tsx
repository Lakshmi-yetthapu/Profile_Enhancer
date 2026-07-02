import { useEffect, useState } from "react";
import { ArrowRight, Download, History, Loader2, Mail, Table2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { AppConfig, BatchListItem, BatchOut, BulkEmailResultItem, BulkResultItem } from "@/types";

interface Row { external_id: string; resume_link: string }

const VERDICT_LABEL: Record<string, string> = { select: "Selected", reject: "Rejected", review: "Review" };
const VERDICT_CLS: Record<string, string> = { select: "text-good", reject: "text-bad", review: "text-warn" };

function parseRows(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes("\t") ? line.split("\t") : line.split(",");
      if (parts.length >= 2) {
        return { external_id: parts[0].trim(), resume_link: parts.slice(1).join(",").trim() };
      }
      return { external_id: "", resume_link: parts[0].trim() };
    })
    .filter((r) => /^https?:\/\//i.test(r.resume_link) || r.resume_link.toLowerCase().includes("drive.google.com"));
}

function csvEscape(v: string): string {
  return `"${(v ?? "").replace(/"/g, '""')}"`;
}

export default function BulkAnalysisPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [raw, setRaw] = useState("");
  const [jd, setJd] = useState("");
  const [provider, setProvider] = useState<"mistral" | "openai">("mistral");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<BulkResultItem[] | null>(null);
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [emailing, setEmailing] = useState(false);
  const [emailStatus, setEmailStatus] = useState<Record<number, BulkEmailResultItem>>({});
  const [emailSummary, setEmailSummary] = useState("");

  const loadBatches = () =>
    api.get<BatchListItem[]>("/api/analyses/batches").then(({ data }) => setBatches(data)).catch(() => {});

  useEffect(() => {
    api.get<AppConfig>("/api/config").then(({ data }) => {
      setConfig(data);
      setProvider((data.default_provider as "mistral" | "openai") || "mistral");
    });
    loadBatches();
  }, []);

  async function openBatch(id: number) {
    setError("");
    try {
      const { data } = await api.get<BatchOut>(`/api/analyses/batches/${id}`);
      setResults(data.results_json);
      setEmailStatus({});
      setEmailSummary("");
      setJd(data.jd_text ?? "");
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (e) {
      setError(apiError(e));
    }
  }

  const parsed = parseRows(raw);

  async function run() {
    setError("");
    if (parsed.length === 0) {
      setError("Paste rows with a resume link (Student ID in column 1, link in column 2).");
      return;
    }
    setBusy(true);
    setResults(null);
    try {
      const { data } = await api.post<{ results: BulkResultItem[] }>("/api/analyses/bulk", {
        jd_text: jd || null,
        provider,
        items: parsed,
      });
      setResults(data.results);
      setEmailStatus({});
      setEmailSummary("");
      loadBatches();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function emailAll() {
    if (!results) return;
    const ids = results.filter((r) => !r.error && r.analysis_id).map((r) => r.analysis_id as number);
    if (ids.length === 0) return;
    if (!window.confirm(`Send ${ids.length} report email(s) to each candidate's own email?`)) return;
    setEmailing(true);
    setEmailSummary("");
    try {
      const { data } = await api.post<{ results: BulkEmailResultItem[]; sent_count: number; failed_count: number }>(
        "/api/analyses/bulk-email",
        { analysis_ids: ids },
      );
      const map: Record<number, BulkEmailResultItem> = {};
      data.results.forEach((r) => (map[r.analysis_id] = r));
      setEmailStatus(map);
      setEmailSummary(`Sent ${data.sent_count}, failed ${data.failed_count}.`);
    } catch (e) {
      setEmailSummary(apiError(e));
    } finally {
      setEmailing(false);
    }
  }

  function downloadCsv() {
    if (!results) return;
    const origin = window.location.origin;
    const header = ["UserID", "Resume link", "Candidate score", "Selected/Rejected", "Report link"];
    const lines = results.map((r) => {
      const score = r.error ? "" : String(Math.round((r.jd_fit_score ?? r.overall_score ?? 0)));
      const verdict = r.error ? "ERROR" : (VERDICT_LABEL[r.verdict ?? ""] ?? r.verdict ?? "");
      const reportLink = r.error ? `ERROR: ${r.error}` : `${origin}${r.report_path}`;
      return [r.external_id, r.resume_link, score, verdict, reportLink].map(csvEscape).join(",");
    });
    const csv = [header.map(csvEscape).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-3xl">Bulk analysis</h1>
        <p className="mt-2 text-muted">
          Copy two columns from your sheet — <strong>Student ID</strong> and <strong>resume link</strong> —
          paste below, and get an individual report per student plus a downloadable results sheet.
        </p>
      </header>

      {batches.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <History size={13} /> Recent batches (last 5)
          </div>
          <div className="flex flex-wrap gap-2">
            {batches.map((b) => (
              <button key={b.id} onClick={() => openBatch(b.id)} className="chip hover:border-primary/60">
                {b.item_count} resumes · {new Date(b.created_at).toLocaleDateString()}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="card p-6">
        <label className="label">Paste rows (Student ID &nbsp;·&nbsp; resume link)</label>
        <textarea
          className="input min-h-[180px] resize-y font-mono text-[13px]"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"NXT001\thttps://drive.google.com/file/d/…/view\nNXT002\thttps://example.com/resume.pdf"}
        />
        <p className="mt-1.5 text-xs text-muted">
          {parsed.length} valid row{parsed.length === 1 ? "" : "s"} detected. Tab or comma separated; a header row is ignored automatically.
        </p>
      </section>

      <section className="card p-6">
        <label className="label">Job description (optional — applied to the whole batch)</label>
        <textarea className="input min-h-[100px] resize-y" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste a JD to score every resume against this role…" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">Engine:</span>
          {(["mistral", "openai"] as const).map((p) => (
            <button key={p} disabled={!config?.providers[p]} onClick={() => setProvider(p)}
              className={`chip ${provider === p ? "border-primary/70 text-primary-soft" : ""} ${!config?.providers[p] ? "opacity-40" : ""}`}>
              {p}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>}

      <div className="flex items-center gap-3">
        <button onClick={run} disabled={busy} className="btn-primary">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Table2 size={16} />}
          {busy ? "Analyzing batch…" : `Analyze ${parsed.length || ""} resume${parsed.length === 1 ? "" : "s"}`}
        </button>
        {results && (
          <button onClick={downloadCsv} className="btn-ghost"><Download size={16} /> Download CSV</button>
        )}
        {results && config?.email_enabled && (
          <button onClick={emailAll} disabled={emailing} className="btn-ghost">
            {emailing ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            Email all candidates
          </button>
        )}
      </div>
      {busy && <p className="text-sm text-muted">Each resume is fetched, parsed, and analyzed — a large batch can take several minutes. Keep this tab open.</p>}
      {emailSummary && <p className="text-sm text-muted">{emailSummary}</p>}

      {results && (
        <section className="card p-6">
          <h2 className="mb-4 text-lg">Results ({results.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3">User ID</th>
                  <th className="pb-2 px-3">Score</th>
                  <th className="pb-2 px-3">Outcome</th>
                  <th className="pb-2 px-3">Resume</th>
                  <th className="pb-2 px-3">Report</th>
                  {Object.keys(emailStatus).length > 0 && <th className="pb-2 pl-3">Email</th>}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td className="py-2.5 pr-3 font-medium text-body">{r.external_id || "—"}</td>
                    <td className="px-3">
                      {r.error ? <span className="text-bad">—</span> : (
                        <span className="font-display text-base text-body">
                          {Math.round((r.jd_fit_score ?? r.overall_score ?? 0))}
                        </span>
                      )}
                    </td>
                    <td className={`px-3 font-medium ${VERDICT_CLS[r.verdict ?? ""] ?? "text-muted"}`}>
                      {r.error ? <span className="text-bad">Failed</span> : (VERDICT_LABEL[r.verdict ?? ""] ?? r.verdict ?? "—")}
                    </td>
                    <td className="px-3">
                      <a href={r.resume_link} target="_blank" rel="noreferrer" className="text-primary-soft hover:underline">link</a>
                    </td>
                    <td className="px-3">
                      {r.error ? (
                        <span className="text-xs text-bad" title={r.error}>{r.error.slice(0, 40)}</span>
                      ) : (
                        <a href={r.report_path!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-soft hover:underline">
                          Report <ArrowRight size={13} />
                        </a>
                      )}
                    </td>
                    {Object.keys(emailStatus).length > 0 && (
                      <td className="pl-3 text-xs">
                        {r.analysis_id && emailStatus[r.analysis_id] ? (
                          emailStatus[r.analysis_id].sent ? (
                            <span className="text-good" title={emailStatus[r.analysis_id].recipient ?? ""}>
                              ✓ {emailStatus[r.analysis_id].recipient}
                            </span>
                          ) : (
                            <span className="text-bad" title={emailStatus[r.analysis_id].error ?? ""}>✗ failed</span>
                          )
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
