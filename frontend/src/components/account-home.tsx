"use client";

import Link from "next/link";
import type { CurrentUser } from "@/api/auth";
import { useAccount } from "@/components/app-frame";
import { Badge, PageState } from "@/components/ui/common";
import { getMenu, roleNames } from "@/components/ui/navigation";
import ParcelWorkspace from "@/components/parcels/workspace";
import ResidentSteps from "@/components/ui/resident-steps";
import BuildingsWorkspace from "@/components/buildings-workspace";

export default function AccountHome({
  role,
}: {
  role: CurrentUser["role"];
}) {
  const { account, building } = useAccount();

  if (account.user.role !== role) {
    return (
      <main>
        <PageState kind="forbidden" title="請使用自己的角色首頁">
          <Link href={`/workspace/${account.user.role}`}>返回首頁</Link>
        </PageState>
      </main>
    );
  }

  const membership = account.memberships.find(
    (item) => item.status === "active" || item.status === "exit_requested",
  );

  // 管理員登入後直接看到實際包裹工作區，功能入口由共用導覽保留。
  if (role === "building_admin" && building) return <ParcelWorkspace />;
  if (role === "system_admin") return <BuildingsWorkspace />;
  if (role === "resident" && membership) return <ParcelWorkspace />;
  if (role === "resident" && !membership) return (
    <main className="form-stack resident-join-welcome">
      <ResidentSteps current={3} />
      <div className="page-heading"><div><h1>{account.user.name}，歡迎加入大樓包裹管理系統</h1><p className="muted">你已登入，接下來加入自己的戶別。</p></div></div>
      <section className="panel form-stack">
        <h2>準備好四位數字邀請碼了嗎？</h2>
        <p>請向大樓管理員或入住代表取得邀請碼。先核對大樓與戶別，再確認加入。</p>
        <Link className="button button-primary" href="/join">下一步：使用邀請碼加入戶別</Link>
        <p className="muted">還沒有邀請碼也沒關係，帳號已建立，可以稍後再回來加入。</p>
        <Link href="/profile">查看個人資料</Link>
      </section>
    </main>
  );

  const menu = getMenu(role, building?.id).filter(
    (item) => item.href !== `/workspace/${role}`,
  );

  return (
    <main>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{roleNames[role]}</p>
          <h1>{account.user.name}，你好</h1>
        </div>
      </div>

      <section className="hero">
        {role === "building_admin" && (
          building ? (
            <>
              <Badge>已分配大樓</Badge>
              <h2>{building.name}</h2>
              <p>{building.address}</p>
            </>
          ) : (
            <>
              <h2>等待大樓分配</h2>
              <p>系統管理員完成分配後，即可管理所屬大樓。</p>
            </>
          )
        )}

        {role === "resident" && (
          membership ? (
            <>
              <Badge tone={membership.status === "exit_requested" ? "amber" : "green"}>
                {membership.status === "exit_requested" ? "等待退出確認" : "有效入住"}
              </Badge>
              <h2>{membership.building_name}</h2>
              <p>{membership.unit_label}</p>
              {membership.status === "exit_requested" && (
                <p>退出申請處理期間，仍保有目前入住的使用權限。</p>
              )}
            </>
          ) : (
            <>
              <h2>目前尚未加入戶別</h2>
              <p>請向大樓管理員或入住代表取得邀請碼。</p>
              <Link className="button" href="/join">
                使用邀請碼加入
              </Link>
            </>
          )
        )}
      </section>

      <section className="card-grid" aria-label="功能入口">
        {menu.map((item) => (
          <Link className="feature-card" key={item.href} href={item.href}>
            <div className="row-between">
              <h2>{item.label}</h2>
              {item.demo && <Badge tone="amber">介面示範</Badge>}
            </div>
            <p className="muted">
              {item.demo ? "示範資料・尚未串接" : "使用目前系統資料"}
            </p>
            <span className="text-link">進入 →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
