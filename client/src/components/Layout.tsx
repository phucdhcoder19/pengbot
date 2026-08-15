import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { cn } from "../lib/cn";
import {
  ChatIcon,
  CloseIcon,
  DocumentIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  MoonIcon,
  OverviewIcon,
  SettingsIcon,
  SunIcon,
} from "./ui/icons";

const NAV = [
  { to: "/app", label: "Overview", Icon: OverviewIcon, end: true },
  { to: "/app/documents", label: "Documents", Icon: DocumentIcon, end: false },
  { to: "/app/conversations", label: "Conversations", Icon: ChatIcon, end: false },
  { to: "/app/settings", label: "Settings", Icon: SettingsIcon, end: false },
];

export function Layout() {
  const { tenant, user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Công ty */}
      <div className="px-6 pt-7 pb-8">
        <div className="eyebrow">Dashboard</div>
        <div className="mt-1.5 truncate font-display text-[19px] leading-tight font-medium">
          {tenant?.name ?? "—"}
        </div>
      </div>

      {/* Điều hướng */}
      <nav className="flex-1 px-3" aria-label="Main navigation">
        <ul className="space-y-0.5">
          {NAV.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                // Trên màn hình hẹp, chọn xong một mục là đóng ngăn kéo.
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    "transition-colors duration-150 ease-out",
                    isActive
                      ? "bg-hover font-medium text-text"
                      : "text-soft hover:bg-hover hover:text-text",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute top-1/2 -left-3 h-5 w-0.5 -translate-y-1/2 rounded-full transition-opacity duration-150",
                        isActive ? "bg-accent opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon
                      className={cn(
                        "size-[18px] shrink-0 transition-colors duration-150",
                        isActive ? "text-accent" : "text-faint group-hover:text-soft",
                      )}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Tài khoản */}
      <div className="border-t border-line px-3 py-4">
        <div className="flex items-center gap-2 px-3 pb-3">
          <p className="min-w-0 flex-1 truncate text-[13px] text-faint" title={user?.email}>
            {user?.email}
          </p>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-md p-1.5 text-faint transition-colors duration-150 hover:bg-hover hover:text-text"
          >
            {theme === "dark" ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
          </button>
        </div>
        <Link
          to="/"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-soft transition-colors duration-150 hover:bg-hover hover:text-text"
        >
          <HomeIcon className="size-[18px] shrink-0 text-faint" />
          Back to homepage
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-soft transition-colors duration-150 hover:bg-hover hover:text-text"
        >
          <LogoutIcon className="size-[18px] shrink-0 text-faint" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* Sidebar cố định — từ lg trở lên */}
      <aside className="fixed inset-y-0 left-0 hidden w-[264px] border-r border-line bg-surface lg:block">
        {sidebar}
      </aside>

      {/* Ngăn kéo — màn hình hẹp */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="animate-fade absolute inset-0 bg-scrim"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="animate-fade absolute inset-y-0 left-0 w-[264px] border-r border-line bg-surface"
            aria-label="Navigation"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute top-6 right-4 rounded-md p-1.5 text-faint transition-colors duration-150 hover:bg-hover hover:text-text"
            >
              <CloseIcon className="size-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[264px]">
        {/* Thanh trên cùng chỉ xuất hiện khi chưa đủ chỗ cho sidebar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-soft transition-colors duration-150 hover:bg-hover"
          >
            <MenuIcon className="size-5" />
          </button>
          <span className="truncate font-display text-[17px] font-medium">
            {tenant?.name ?? "—"}
          </span>
        </header>

        <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Đầu trang: nhãn lề nhỏ, tiêu đề lớn, mô tả, và chỗ cho hành động chính. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-2 text-[34px] leading-none sm:text-[40px]">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-faint">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
