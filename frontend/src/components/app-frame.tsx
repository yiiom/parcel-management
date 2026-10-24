"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getAccount, type Account } from "@/api/account";
import { logoutUser } from "@/api/auth";
import { getBuildings, type Building } from "@/api/buildings";
import {
  canOpenPath,
  getMenu,
  getManagerGroups,
  getResidentGroups,
  managerGroupForPath,
  roleNames,
} from "@/components/ui/navigation";
import { PageState } from "@/components/ui/common";

type AccountContextValue = {
  account: Account;
  building: Building | null;
  refreshAccount: () => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount() {
  const value = useContext(AccountContext);

  if (!value) {
    throw new Error("此元件必須放在登入後的共用版型中。");
  }

  return value;
}

function NavigationIcon({ href, label }: { href: string; label: string }) {
  const paths: Record<string, ReactNode> = {
    "/workspace/system_admin": <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-8h6v8" /></>,
    "/buildings": <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h2m4 0h2M8 11h2m4 0h2M10 21v-6h4v6" /></>,
    "/building-admins": <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a7 7 0 0 1 10-6M18 12l4 2v3c0 3-4 5-4 5s-4-2-4-5v-3Z" /></>,
    "/profile": <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    "/join": <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M20 8v6m-3-3h6" /></>,
    "/parcels": <><path d="m12 3 9 5v8l-9 5-9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" /></>,
    "/pickups": <><path d="M3 3v5h5M3.5 8a9 9 0 1 1-.5 7" /><path d="M12 7v5l3 2" /></>,
    "/household": <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    "取件作業": <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M8 12h8" />,
    "戶別與邀請碼": <><rect x="8" y="3" width="10" height="18" rx="2" /><path d="M8 9H5a2 2 0 0 0-2 2v10h18V11a2 2 0 0 0-2-2h-1M11 7h4m-4 4h4m-4 4h4m-3 6v-3M5 13v4" /></>,
    "住戶管理": <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 3a4 4 0 0 1 0 8m1 4a5 5 0 0 1 4 5v1" /></>,
    "大樓設定": <><path d="m10 3-.6 2.5-2 .9-2.3-.7-2 3.4L5 11v2l-1.9 1.9 2 3.4 2.3-.7 2 .9L10 21h4l.6-2.5 2-.9 2.3.7 2-3.4L19 13v-2l1.9-1.9-2-3.4-2.3.7-2-.9L14 3Z" /><circle cx="12" cy="12" r="3" /></>,
  };

  return (
    <svg className="navigation-icon" width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[label] ?? paths[href]}
    </svg>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          <path d="M13 3.5 20 7Q21 7.5 21 8.7v6.6Q21 16.5 20 17l-7 3.5q-1 .5-2 0L4 17q-1-.5-1-1.7V8.7Q3 7.5 4 7l7-3.5q1-.5 2 0Z" />
          <path d="m3.3 8 7.7 3.85q1 .5 2 0L20.7 8M12 12.2v8.6M7.5 5.25l8.2 4.1q.8.4.8 1.3v3.1" />
        </svg>
      </span>
      <div>
        <strong>大樓包裹管理系統</strong>
      </div>
    </div>
  );
}

export default function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register";

  if (isPublic) {
    return (
      <div className="public-frame">
        <header><Brand /></header>
        <div className="public-content">{children}</div>
        <footer>大樓包裹管理系統</footer>
      </div>
    );
  }

  // 保留共用版型；換頁在背景重新確認權限，不重建整個登入區塊。
  return (
    <ProtectedFrame pathname={pathname}>
      {children}
    </ProtectedFrame>
  );
}

function ProtectedFrame({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [value, setValue] = useState<Omit<AccountContextValue, "refreshAccount"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const refreshAccount = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const account = await getAccount();

        if (ignore) return;

        if (!account || !account.user.is_active) {
          setValue(null);
          router.replace("/login");
          return;
        }

        let building: Building | null = null;

        if (
          account.user.role === "building_admin" &&
          account.managed_building_ids.length > 0
        ) {
          const result = await getBuildings();
          if (ignore) return;

          if (!result) {
            setValue(null);
            router.replace("/login");
            return;
          }

          building = result.items[0] ?? null;
        }

        if (!ignore) {
          setError("");
          setValue((previous) =>
            JSON.stringify(previous) === JSON.stringify({ account, building })
              ? previous
              : { account, building },
          );
        }
      } catch {
        if (!ignore) {
          setValue(null);
          setError("無法載入帳號或大樓資料，請確認連線後重試。");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void load();
    return () => { ignore = true; };
  }, [attempt, router, pathname]);

  useEffect(() => {
    window.addEventListener("focus", refreshAccount);
    return () => window.removeEventListener("focus", refreshAccount);
  }, [refreshAccount]);

  function retry() {
    setError("");
    setLoading(true);
    setValue(null);
    setAttempt((previous) => previous + 1);
  }

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      await logoutUser();
      setValue(null);
      router.replace("/login");
    } catch {
      setError("登出失敗，請確認連線後再試。");
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="standalone-state">
        <PageState kind="loading" title="正在確認登入狀態…" />
      </main>
    );
  }

  if (!value) {
    return (
      <main className="standalone-state">
        <PageState
          kind="error"
          title={error || "請重新登入"}
          onRetry={error ? retry : undefined}
        >
          <Link href="/login">前往登入</Link>
        </PageState>
      </main>
    );
  }

  const { account, building } = value;
  const role = account.user.role;
  const menu = getMenu(role, building?.id);
  const managerGroups = role === "building_admin" ? getManagerGroups(building?.id) : role === "resident" ? getResidentGroups() : null;
  const activeGroup = role === "building_admin" ? managerGroupForPath(pathname, building?.id)
    : managerGroups?.find((group) => group.items.some((item) => item.href === pathname));
  const allowed = canOpenPath(pathname, role);

  // 選擇最長的符合路徑，避免詳情頁同時亮起多個選單。
  const activeHref = menu
    .filter((item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const membership = account.memberships.find(
    (item) => item.status === "active" || item.status === "exit_requested",
  );

  const scope =
    role === "system_admin"
      ? "系統管理空間"
      : role === "building_admin"
        ? building?.name ?? "尚未分配大樓"
        : membership
          ? `${membership.building_name}・${membership.unit_label}`
          : "尚未加入戶別";

  return (
    <AccountContext.Provider value={{ ...value, refreshAccount }}>
      <div className="app-shell">
        <a className="skip-link" href="#page-content">跳至主要內容</a>

        <aside className="sidebar">
          <div className="sidebar-top">
            <Brand />
            <button
              className="button mobile-menu-button"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="main-navigation"
              onClick={() => setMenuOpen((previous) => !previous)}
            >
              {menuOpen ? "收合選單" : "功能選單"}
            </button>
          </div>

          <div className="scope-box">
            <strong>{scope}</strong>
            <small>{roleNames[role]}</small>
          </div>

          <nav
            id="main-navigation"
            aria-label="主要功能"
            className={`main-navigation ${menuOpen ? "is-open" : ""}`}
          >
            {(managerGroups ? managerGroups.map((group) => ({ label: group.label, href: group.items[0].href, demo: false })) : menu.filter((item) => item.href !== "/workspace/system_admin" && item.href !== "/profile")).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={(managerGroups ? activeGroup?.label === item.label : activeHref === item.href || (pathname === "/workspace/system_admin" && item.href === "/buildings")) ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <span className="navigation-label">
                  <NavigationIcon href={item.href} label={item.label} />
                  {item.label}
                </span>
                {item.demo && <small>示範</small>}
              </Link>
            ))}
          </nav>

          <div className="account-box">
            <span className="avatar" aria-hidden="true">
              {Array.from(account.user.name)[0]}
            </span>
            <div>
              <strong>{account.user.name}</strong>
              <small>{roleNames[role]}</small>
              {role === "system_admin" && <Link href="/profile" aria-current={pathname === "/profile" ? "page" : undefined}>個人資料</Link>}
            </div>
            <button
              className="button button-quiet"
              type="button"
              disabled={loggingOut}
              onClick={logout}
            >
              {loggingOut ? "登出中…" : "登出"}
            </button>
          </div>
        </aside>

        <div className="workspace">
          <header className="workspace-header">
            <span>{scope}</span>
            <span>{roleNames[role]}</span>
          </header>

          {error && <p className="notice notice-error" role="alert">{error}</p>}

          <div
            key={JSON.stringify([account.user.id, account.user.role, account.managed_building_ids, account.memberships.map(({ id, occupancy_id, status }) => [id, occupancy_id, status])])}
            id="page-content" className="page-content" tabIndex={-1}
          >
            {allowed && activeGroup && (role === "building_admin" || activeGroup.label === "我的戶別") && (
              <nav className="manager-subnav" aria-label={`${activeGroup.label}子功能`}>
                {activeGroup.items.map((item) => (
                  <Link key={item.href} href={item.href} aria-current={
                    activeHref === item.href ||
                    (pathname === "/workspace/building_admin" && item.href === "/parcels") ||
                    (pathname.startsWith("/units/") && item.href.endsWith("/units"))
                      ? "page" : undefined
                  }>
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
            {allowed ? children : (
              <main>
                <PageState kind="forbidden" title="你沒有此頁面的使用權限">
                  <Link href={`/workspace/${role}`}>返回自己的首頁</Link>
                </PageState>
              </main>
            )}
          </div>
        </div>
      </div>
    </AccountContext.Provider>
  );
}
