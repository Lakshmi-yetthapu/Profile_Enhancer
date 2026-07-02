import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { BannedProject, Criterion } from "@/types";

export default function AdminPage() {
  const [tab, setTab] = useState<"criteria" | "banned" | "settings">("criteria");
  const labels = { criteria: "Criteria", banned: "Banned projects", settings: "Thresholds" };
  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <h1 className="text-3xl">Admin · Evaluation rubric</h1>
        <p className="mt-2 text-muted">Edit the rules, the NxtWave internal-project list, and scoring thresholds.</p>
      </header>

      <div className="mb-6 flex gap-1 rounded-xl bg-ink/40 p-1">
        {(["criteria", "banned", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t ? "bg-surface-2 text-body shadow-soft" : "text-muted hover:text-body"
            }`}
          >
            {labels[t]}
          </button>
        ))}
      </div>

      {tab === "criteria" && <CriteriaEditor />}
      {tab === "banned" && <BannedEditor />}
      {tab === "settings" && <SettingsEditor />}
    </div>
  );
}

function SettingsEditor() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Record<string, string>>("/api/admin/settings").then(({ data }) => setSettings(data)).catch((e) => setError(apiError(e)));
  }, []);

  async function save() {
    if (!settings) return;
    setError("");
    try {
      const { data } = await api.put<Record<string, string>>("/api/admin/settings", { settings });
      setSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(apiError(e));
    }
  }

  if (error) return <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-bad">{error}</div>;
  if (!settings) return <Loader2 className="mx-auto animate-spin text-muted" />;

  const autoreject = (settings.autoreject_hidden_text ?? "false").toLowerCase() === "true";

  return (
    <div className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">Select threshold (score ≥)</span>
          <input
            type="number"
            className="input"
            value={settings.select_threshold ?? ""}
            onChange={(e) => setSettings({ ...settings, select_threshold: e.target.value })}
          />
        </label>
        <label>
          <span className="label">Review threshold (score ≥)</span>
          <input
            type="number"
            className="input"
            value={settings.review_threshold ?? ""}
            onChange={(e) => setSettings({ ...settings, review_threshold: e.target.value })}
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        Scores at or above the select threshold → <span className="text-good">select</span>, above review →{" "}
        <span className="text-warn">review</span>, otherwise <span className="text-bad">reject</span>.
      </p>

      <label className="flex items-center gap-3 text-sm text-body">
        <input
          type="checkbox"
          checked={autoreject}
          onChange={(e) => setSettings({ ...settings, autoreject_hidden_text: e.target.checked ? "true" : "false" })}
        />
        Auto-reject resumes with hidden / white-text keyword stuffing
      </label>

      <div className="border-t border-line pt-5">
        <div className="mb-1 text-sm font-medium text-body">Mistral key rotation</div>
        <p className="mb-3 text-xs text-muted">
          {settings.mistral_keys_loaded ?? "0"} Mistral key(s) detected in the environment.
          Add more via <span className="text-body">MISTRAL_API_KEYS</span> in <span className="text-body">.env</span>.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Active keys (0 = use all)</span>
            <input
              type="number"
              min={0}
              className="input"
              value={settings.mistral_active_keys ?? "0"}
              onChange={(e) => setSettings({ ...settings, mistral_active_keys: e.target.value })}
            />
          </label>
          <label>
            <span className="label">Rotation mode</span>
            <select
              className="input"
              value={settings.key_rotation_mode ?? "round_robin"}
              onChange={(e) => setSettings({ ...settings, key_rotation_mode: e.target.value })}
            >
              <option value="round_robin">Round-robin (spread load)</option>
              <option value="failover">Failover only (switch on error)</option>
              <option value="single">Single key</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} className="btn-primary"><Save size={16} /> Save settings</button>
        {saved && <span className="text-sm text-good">Saved</span>}
      </div>
    </div>
  );
}

function CriteriaEditor() {
  const [items, setItems] = useState<Criterion[] | null>(null);
  const [error, setError] = useState("");

  const load = () =>
    api.get<Criterion[]>("/api/admin/criteria").then(({ data }) => setItems(data)).catch((e) => setError(apiError(e)));
  useEffect(() => {
    load();
  }, []);

  async function update(c: Criterion, patch: Partial<Criterion>) {
    const { data } = await api.patch<Criterion>(`/api/admin/criteria/${c.id}`, patch);
    setItems((prev) => prev?.map((x) => (x.id === c.id ? data : x)) ?? null);
  }

  async function remove(id: number) {
    await api.delete(`/api/admin/criteria/${id}`);
    setItems((prev) => prev?.filter((x) => x.id !== id) ?? null);
  }

  if (error) return <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-bad">{error}</div>;
  if (!items) return <Loader2 className="mx-auto animate-spin text-muted" />;

  return (
    <div className="space-y-3">
      {items.map((c) => (
        <div key={c.id} className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <input
                className="input mb-2 font-medium"
                defaultValue={c.title}
                onBlur={(e) => e.target.value !== c.title && update(c, { title: e.target.value })}
              />
              <textarea
                className="input min-h-[70px] resize-y text-sm"
                defaultValue={c.description}
                onBlur={(e) => e.target.value !== c.description && update(c, { description: e.target.value })}
              />
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2 text-muted">
                  Weight
                  <input
                    type="number"
                    step="0.5"
                    className="input w-20 py-1"
                    defaultValue={c.weight}
                    onBlur={(e) => Number(e.target.value) !== c.weight && update(c, { weight: Number(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-2 text-muted">
                  <input
                    type="checkbox"
                    checked={c.is_critical}
                    onChange={(e) => update(c, { is_critical: e.target.checked })}
                  />
                  Critical (forces reject)
                </label>
                <label className="flex items-center gap-2 text-muted">
                  <input
                    type="checkbox"
                    checked={c.is_active}
                    onChange={(e) => update(c, { is_active: e.target.checked })}
                  />
                  Active
                </label>
                <span className="chip">{c.key}</span>
              </div>
            </div>
            <button onClick={() => remove(c.id)} className="text-muted hover:text-bad" title="Delete">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}
      <NewCriterion onCreated={load} />
    </div>
  );
}

function NewCriterion({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: "", title: "", description: "", category: "do", weight: 1, is_critical: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError("");
    try {
      await api.post("/api/admin/criteria", form);
      setForm({ key: "", title: "", description: "", category: "do", weight: 1, is_critical: false });
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost w-full">
        <Plus size={16} /> Add criterion
      </button>
    );

  return (
    <div className="card space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" placeholder="key (e.g. has_summary)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
        <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <textarea className="input min-h-[70px]" placeholder="Rule description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="flex items-center gap-4 text-sm text-muted">
        <select className="input w-auto py-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="do">do</option>
          <option value="dont">dont</option>
        </select>
        <label className="flex items-center gap-2">
          Weight
          <input type="number" step="0.5" className="input w-20 py-1" value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_critical} onChange={(e) => setForm({ ...form, is_critical: e.target.checked })} /> Critical
        </label>
      </div>
      {error && <div className="text-sm text-bad">{error}</div>}
      <div className="flex gap-2">
        <button onClick={create} disabled={busy} className="btn-primary">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
        </button>
        <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

function BannedEditor() {
  const [items, setItems] = useState<BannedProject[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    api.get<BannedProject[]>("/api/admin/banned-projects").then(({ data }) => setItems(data)).catch((e) => setError(apiError(e)));
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name.trim()) return;
    try {
      await api.post("/api/admin/banned-projects", { name: name.trim() });
      setName("");
      load();
    } catch (e) {
      setError(apiError(e));
    }
  }
  async function remove(id: number) {
    await api.delete(`/api/admin/banned-projects/${id}`);
    setItems((prev) => prev?.filter((x) => x.id !== id) ?? null);
  }

  if (error) return <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-bad">{error}</div>;
  if (!items) return <Loader2 className="mx-auto animate-spin text-muted" />;

  return (
    <div className="card p-5">
      <div className="mb-4 flex gap-2">
        <input className="input" placeholder="Add a project name…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} className="btn-primary shrink-0">
          <Plus size={16} /> Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((b) => (
          <span key={b.id} className="chip group">
            {b.name}
            <button onClick={() => remove(b.id)} className="text-muted hover:text-bad">
              <Trash2 size={12} />
            </button>
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">{items.length} projects in the block-list.</p>
    </div>
  );
}
