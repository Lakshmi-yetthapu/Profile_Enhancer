import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Briefcase, FileCheck2, History, LayoutGrid, ListChecks, LogOut, Shield, Table2, Wand2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function NavItem({ to, icon: Icon, label }: { to: string; icon: typeof LayoutGrid; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
          isActive
            ? "bg-primary/15 text-primary-soft"
            : "text-muted hover:bg-surface-2/70 hover:text-body"
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isReport = location.pathname.startsWith("/report/");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="no-print hidden border-r border-line bg-surface/40 lg:flex lg:flex-col">
        <Link to="/" className="flex items-center gap-2.5 px-6 py-6">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary-soft">
            <FileCheck2 size={20} />
          </div>
          <div>
            <div className="font-display text-lg leading-none text-body">ResumeEnhancer</div>
            <div className="text-[11px] uppercase tracking-widest text-muted">NxtWave</div>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          <NavItem to="/" icon={LayoutGrid} label="Analyze" />
          <NavItem to="/builder" icon={Wand2} label="Resume Builder" />
          <NavItem to="/jobs" icon={Briefcase} label="Job Descriptions" />
          <NavItem to="/history" icon={History} label="History" />
          {user?.role === "admin" && <NavItem to="/bulk" icon={Table2} label="Bulk Analysis" />}
          {user?.role === "admin" && <NavItem to="/screening" icon={ListChecks} label="Screening" />}
          {user?.role === "admin" && <NavItem to="/admin" icon={Shield} label="Admin Rubric" />}
        </nav>

        <div className="border-t border-line p-3">
          <div className="mb-2 px-2">
            <div className="truncate text-sm font-medium text-body">{user?.full_name || user?.email}</div>
            <div className="text-xs capitalize text-muted">{user?.role}</div>
          </div>
          <button onClick={logout} className="btn-ghost w-full">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print flex items-center justify-between border-b border-line px-5 py-4 lg:hidden">
        <Link to="/" className="flex items-center gap-2 font-display text-lg">
          <FileCheck2 size={20} className="text-primary-soft" /> ResumeEnhancer
        </Link>
        <button onClick={logout} className="text-muted">
          <LogOut size={18} />
        </button>
      </header>

      <main className={`mx-auto w-full ${isReport ? "max-w-5xl" : "max-w-4xl"} px-5 py-8 lg:px-10 lg:py-12`}>
        <Outlet />
      </main>
    </div>
  );
}
