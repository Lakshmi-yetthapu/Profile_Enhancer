import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FileUp, Link2, Loader2, UploadCloud, HardDrive } from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { Resume } from "@/types";

type Tab = "upload" | "drive" | "link";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("upload");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      let resume: Resume;
      if (tab === "upload") {
        if (!file) throw new Error("Choose a PDF or DOCX file first");
        const form = new FormData();
        form.append("file", file);
        const { data } = await api.post<Resume>("/api/resumes/upload", form);
        resume = data;
      } else {
        if (!url.trim()) throw new Error("Paste a link first");
        const { data } = await api.post<Resume>("/api/resumes/link", {
          source_type: tab,
          source_ref: url.trim(),
        });
        resume = data;
      }
      navigate(`/analyze/${resume.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof FileUp }[] = [
    { key: "upload", label: "Upload file", icon: FileUp },
    { key: "drive", label: "Google Drive", icon: HardDrive },
    { key: "link", label: "External link", icon: Link2 },
  ];

  return (
    <div className="animate-fade-up">
      <header className="mb-8">
        <h1 className="text-3xl">Analyze a resume</h1>
        <p className="mt-2 text-muted">
          Upload a file, paste a Google Drive share link, or drop a public resume URL. We extract
          the text and run it through the NxtWave evaluation engine.
        </p>
      </header>

      <div className="card p-2">
        <div className="flex gap-1 rounded-xl bg-ink/40 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setError("");
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                tab === t.key ? "bg-surface-2 text-body shadow-soft" : "text-muted hover:text-body"
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "upload" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => fileInput.current?.click()}
              className="grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line bg-surface-2/40 px-6 py-12 text-center transition hover:border-primary/50"
            >
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary-soft">
                <UploadCloud size={24} />
              </div>
              {file ? (
                <p className="font-medium text-body">{file.name}</p>
              ) : (
                <>
                  <p className="font-medium text-body">Click to choose a file</p>
                  <p className="mt-1 text-sm text-muted">PDF or DOCX, up to 10 MB</p>
                </>
              )}
            </motion.div>
          ) : (
            <div>
              <label className="label">{tab === "drive" ? "Google Drive share link" : "Resume URL"}</label>
              <input
                className="input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  tab === "drive"
                    ? "https://drive.google.com/file/d/…/view"
                    : "https://yoursite.com/resume.pdf"
                }
              />
              <p className="mt-2 text-xs text-muted">
                {tab === "drive"
                  ? "Make sure sharing is set to “Anyone with the link”."
                  : "Direct PDF links or portfolio pages both work."}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              {error}
            </div>
          )}

          <button onClick={submit} disabled={busy} className="btn-primary mt-5 w-full sm:w-auto">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            {busy ? "Extracting…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
