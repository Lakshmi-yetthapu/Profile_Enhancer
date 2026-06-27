import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, FileText, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { AppConfig, BuildListItem, PersonalInfo } from "@/types";

interface SkillRow { category: string; skillsText: string }
interface ProjectRow { title: string; techText: string; description: string; live_url: string; repo_url: string }
interface ExpRow { title: string; company: string; start_date: string; end_date: string; responsibilities: string }

const splitComma = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const splitLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function BuilderPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saved, setSaved] = useState<BuildListItem[]>([]);

  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [provider, setProvider] = useState<"mistral" | "openai">("mistral");
  const [personal, setPersonal] = useState<PersonalInfo>({ name: "", email: "" });
  const [skills, setSkills] = useState<SkillRow[]>([{ category: "", skillsText: "" }]);
  const [projects, setProjects] = useState<ProjectRow[]>([
    { title: "", techText: "", description: "", live_url: "", repo_url: "" },
  ]);
  const [experience, setExperience] = useState<ExpRow[]>([]);
  const [certsText, setCertsText] = useState("");
  const [achText, setAchText] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<AppConfig>("/api/config").then(({ data }) => {
      setConfig(data);
      setProvider((data.default_provider as "mistral" | "openai") || "mistral");
    });
    api.get<BuildListItem[]>("/api/builder").then(({ data }) => setSaved(data));
  }, []);

  const setP = (k: keyof PersonalInfo, v: string) => setPersonal((prev) => ({ ...prev, [k]: v }));

  async function submit() {
    setError("");
    if (!personal.name.trim() || !personal.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    const projectsClean = projects
      .filter((p) => p.title.trim())
      .map((p) => ({
        title: p.title,
        tech_stack: splitComma(p.techText),
        description: p.description,
        live_url: p.live_url || null,
        repo_url: p.repo_url || null,
      }));
    const expClean = experience
      .filter((e) => e.title.trim() || e.company.trim())
      .map((e) => ({
        title: e.title,
        company: e.company,
        start_date: e.start_date || null,
        end_date: e.end_date || null,
        responsibilities: e.responsibilities,
      }));
    if (projectsClean.length === 0 && expClean.length === 0) {
      setError("Add at least one project or work experience.");
      return;
    }

    const input = {
      personal,
      skills: skills
        .filter((s) => s.category.trim() || s.skillsText.trim())
        .map((s) => ({ category: s.category, skills: splitComma(s.skillsText) })),
      projects: projectsClean,
      experience: expClean,
      certifications: splitLines(certsText),
      achievements: splitLines(achText),
    };

    setBusy(true);
    try {
      const { data } = await api.post("/api/builder", {
        title: title || null,
        jd_text: jd || null,
        provider,
        input,
      });
      navigate(`/builder/result/${data.id}`);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-3xl">Resume builder</h1>
        <p className="mt-2 text-muted">
          Enter your details and let AI craft an ATS-friendly resume, tailored to a job description.
          Nothing is invented — your facts, sharpened.
        </p>
      </header>

      {saved.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Your resumes</div>
          <div className="flex flex-wrap gap-2">
            {saved.map((b) => (
              <button key={b.id} onClick={() => navigate(`/builder/result/${b.id}`)} className="chip hover:border-primary/60">
                <FileText size={12} /> {b.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* JD */}
      <Section icon={Briefcase} title="Target job description" subtitle="Optional — paste it and every section is tailored to match.">
        <textarea className="input min-h-[120px] resize-y" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description to tailor your resume…" />
      </Section>

      {/* Personal */}
      <Section icon={FileText} title="Personal info" subtitle="Name and email are required.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name *"><input className="input" value={personal.name} onChange={(e) => setP("name", e.target.value)} /></Field>
          <Field label="Email *"><input className="input" type="email" value={personal.email} onChange={(e) => setP("email", e.target.value)} /></Field>
          <Field label="Phone"><input className="input" value={personal.phone ?? ""} onChange={(e) => setP("phone", e.target.value)} /></Field>
          <Field label="Location"><input className="input" value={personal.location ?? ""} onChange={(e) => setP("location", e.target.value)} /></Field>
          <Field label="LinkedIn"><input className="input" value={personal.linkedin ?? ""} onChange={(e) => setP("linkedin", e.target.value)} placeholder="https://linkedin.com/in/…" /></Field>
          <Field label="GitHub"><input className="input" value={personal.github ?? ""} onChange={(e) => setP("github", e.target.value)} placeholder="https://github.com/…" /></Field>
          <Field label="Coding profile"><input className="input" value={personal.coding_profile ?? ""} onChange={(e) => setP("coding_profile", e.target.value)} placeholder="https://leetcode.com/u/…" /></Field>
          <Field label="Portfolio"><input className="input" value={personal.portfolio ?? ""} onChange={(e) => setP("portfolio", e.target.value)} /></Field>
        </div>
      </Section>

      {/* Skills */}
      <Section icon={Sparkles} title="Skills" subtitle="Group by category (e.g. Frontend, Backend). Comma-separate skills.">
        <div className="space-y-3">
          {skills.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input className="input sm:max-w-[200px]" placeholder="Category" value={s.category}
                onChange={(e) => setSkills((p) => p.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} />
              <input className="input flex-1" placeholder="React, TypeScript, Node.js" value={s.skillsText}
                onChange={(e) => setSkills((p) => p.map((x, j) => (j === i ? { ...x, skillsText: e.target.value } : x)))} />
              <RemoveBtn onClick={() => setSkills((p) => p.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <AddBtn label="Add skill group" onClick={() => setSkills((p) => [...p, { category: "", skillsText: "" }])} />
      </Section>

      {/* Projects */}
      <Section icon={FileText} title="Projects" subtitle="Describe in plain words — AI turns it into ATS bullet points.">
        <div className="space-y-4">
          {projects.map((p, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface-2/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted">Project {i + 1}</span>
                <RemoveBtn onClick={() => setProjects((arr) => arr.filter((_, j) => j !== i))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title"><input className="input" value={p.title} onChange={(e) => setProjects((arr) => arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /></Field>
                <Field label="Tech stack (comma-separated)"><input className="input" value={p.techText} onChange={(e) => setProjects((arr) => arr.map((x, j) => (j === i ? { ...x, techText: e.target.value } : x)))} /></Field>
                <Field label="Live URL"><input className="input" value={p.live_url} onChange={(e) => setProjects((arr) => arr.map((x, j) => (j === i ? { ...x, live_url: e.target.value } : x)))} /></Field>
                <Field label="Repo URL"><input className="input" value={p.repo_url} onChange={(e) => setProjects((arr) => arr.map((x, j) => (j === i ? { ...x, repo_url: e.target.value } : x)))} /></Field>
              </div>
              <div className="mt-3">
                <Field label="Description"><textarea className="input min-h-[80px] resize-y" value={p.description} onChange={(e) => setProjects((arr) => arr.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="What you built, your role, impact…" /></Field>
              </div>
            </div>
          ))}
        </div>
        <AddBtn label="Add project" onClick={() => setProjects((p) => [...p, { title: "", techText: "", description: "", live_url: "", repo_url: "" }])} />
      </Section>

      {/* Experience */}
      <Section icon={Briefcase} title="Experience" subtitle="Optional. NxtWave training should not be listed as experience.">
        <div className="space-y-4">
          {experience.map((e, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface-2/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted">Experience {i + 1}</span>
                <RemoveBtn onClick={() => setExperience((arr) => arr.filter((_, j) => j !== i))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Role title"><input className="input" value={e.title} onChange={(ev) => setExperience((arr) => arr.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))} /></Field>
                <Field label="Company"><input className="input" value={e.company} onChange={(ev) => setExperience((arr) => arr.map((x, j) => (j === i ? { ...x, company: ev.target.value } : x)))} /></Field>
                <Field label="Start date"><input className="input" value={e.start_date} onChange={(ev) => setExperience((arr) => arr.map((x, j) => (j === i ? { ...x, start_date: ev.target.value } : x)))} placeholder="Jan 2024" /></Field>
                <Field label="End date"><input className="input" value={e.end_date} onChange={(ev) => setExperience((arr) => arr.map((x, j) => (j === i ? { ...x, end_date: ev.target.value } : x)))} placeholder="Present" /></Field>
              </div>
              <div className="mt-3">
                <Field label="Responsibilities"><textarea className="input min-h-[80px] resize-y" value={e.responsibilities} onChange={(ev) => setExperience((arr) => arr.map((x, j) => (j === i ? { ...x, responsibilities: ev.target.value } : x)))} placeholder="What you did and achieved…" /></Field>
              </div>
            </div>
          ))}
        </div>
        <AddBtn label="Add experience" onClick={() => setExperience((p) => [...p, { title: "", company: "", start_date: "", end_date: "", responsibilities: "" }])} />
      </Section>

      {/* Certs + achievements */}
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Certifications" subtitle="One per line. NxtWave course certs aren't counted.">
          <textarea className="input min-h-[100px] resize-y" value={certsText} onChange={(e) => setCertsText(e.target.value)} placeholder="AWS Certified Cloud Practitioner&#10;Meta Front-End Developer" />
        </Section>
        <Section title="Achievements" subtitle="One per line.">
          <textarea className="input min-h-[100px] resize-y" value={achText} onChange={(e) => setAchText(e.target.value)} placeholder="Winner, XYZ Hackathon 2025&#10;Top 5% on LeetCode" />
        </Section>
      </div>

      {/* Engine + submit */}
      <Section title="Generate" subtitle="Pick the AI engine and build your ATS resume.">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input className="input sm:max-w-[280px]" placeholder="Resume title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <span className="text-sm text-muted">Engine:</span>
          {(["mistral", "openai"] as const).map((p) => (
            <button key={p} disabled={!config?.providers[p]} onClick={() => setProvider(p)}
              className={`chip ${provider === p ? "border-primary/70 text-primary-soft" : ""} ${!config?.providers[p] ? "opacity-40" : ""}`}>
              {p}
            </button>
          ))}
        </div>
        {error && <div className="mb-3 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>}
        <button onClick={submit} disabled={busy} className="btn-primary">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {busy ? "Building your resume…" : "Generate ATS resume"}
        </button>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon?: typeof FileText; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex items-start gap-2">
        {Icon && <Icon size={18} className="mt-0.5 text-primary-soft" />}
        <div>
          <h2 className="text-lg leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-ghost mt-3">
      <Plus size={15} /> {label}
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="shrink-0 text-muted hover:text-bad" title="Remove">
      <Trash2 size={16} />
    </button>
  );
}
