"use client";

import {
  useCallback,
  useRef,
  useState,
} from "react";
import type { Unit } from "@/api/units";
import type { Occupancy } from "@/api/occupancies";
import {
  createInviteCode,
  deactivateInviteCode,
  getInviteCodes,
  toInvitationError,
  type InvitationApiError,
  type InviteCode,
  type InviteCodeCreated,
} from "@/api/invitations";
import { useAccount } from "@/components/app-frame";
import { Badge, Modal, PageState, Pagination } from "@/components/ui/common";
import { OccupancyPicker, UnitPicker } from "./selectors";
import { Query, RequestError, formatTime, useClock } from "./shared";

export default function InvitationManager() {
  const { account, building } = useAccount();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [occupancy, setOccupancy] = useState<Occupancy | null>(null);

  if (account.user.role !== "building_admin") {
    return <PageState kind="forbidden" title="只有大樓管理員可管理邀請碼" />;
  }

  if (!building) {
    return <PageState kind="empty" title="尚未分配大樓" />;
  }

  return (
    <main className="form-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{building.name}</p>
          <h1>邀請碼管理</h1>
          <p className="muted">
            請先選擇戶別與入住。邀請碼固定 24 小時到期。
          </p>
        </div>
      </div>

      {!unit ? (
        <UnitPicker
          buildingId={building.id}
          onSelect={(selected) => {
            setUnit(selected);
            setOccupancy(null);
          }}
        />
      ) : !occupancy ? (
        <OccupancyPicker
          key={unit.id}
          unit={unit}
          onSelect={setOccupancy}
          onBack={() => setUnit(null)}
        />
      ) : (
        <InviteWorkspace
          key={occupancy.id}
          unit={unit}
          occupancy={occupancy}
          onBack={() => setOccupancy(null)}
        />
      )}
    </main>
  );
}

type Action =
  | { kind: "create" }
  | { kind: "deactivate"; invite: InviteCode };

function InviteWorkspace({
  unit,
  occupancy,
  onBack,
}: {
  unit: Unit;
  occupancy: Occupancy;
  onBack: () => void;
}) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<Action | null>(null);
  const [created, setCreated] = useState<InviteCodeCreated | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<InvitationApiError | null>(null);
  const [notice, setNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const locked = useRef(false);
  const now = useClock();

  const load = useCallback(
    () => getInviteCodes(occupancy.id, page),
    [occupancy.id, page],
  );

  function refresh() {
    setRevision((value) => value + 1);
  }

  function begin(next: Action) {
    if (locked.current) return;
    setError(null);
    setNotice("");
    setAction(next);
  }

  async function confirm() {
    if (!action || locked.current) return;

    locked.current = true;
    setBusy(true);
    setError(null);

    try {
      if (action.kind === "create") {
        const result = await createInviteCode(occupancy.id);
        setCreated(result);
        setCopyNotice("");
        setPage(1);
      } else {
        await deactivateInviteCode(action.invite.id);
        setNotice("邀請碼已停用。");
      }

      setAction(null);
      refresh();
    } catch (cause) {
      // 失敗不顯示成功，也不自動重送寫入。
      setError(toInvitationError(cause));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!created) return;

    try {
      await navigator.clipboard.writeText(created.code);
      setCopyNotice("已複製邀請碼。");
    } catch {
      setCopyNotice("無法自動複製，請手動選取上方四位數字。");
    }
  }

  // 權限失效後不繼續顯示原先的列表或明碼。
  if (error && (error.status === 401 || error.status === 403)) {
    return <RequestError error={error} />;
  }

  return (
    <section className="form-stack">
      <div className="panel">
        <div className="row-between">
          <h2>{unit.label}</h2>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onBack}
          >
            重選入住
          </button>
        </div>

        <p>入住編號：{occupancy.id}</p>
        <p>開始：{formatTime(occupancy.started_at)}</p>

        {occupancy.ended_at ? (
          <p className="notice">
            此入住已結束，只能查看歷史，不能產生新邀請碼。
          </p>
        ) : (
          <div className="actions">
            <button
              type="button"
              className="button button-primary"
              disabled={busy}
              onClick={() => begin({ kind: "create" })}
            >
              產生／重發邀請碼
            </button>
          </div>
        )}

        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={refresh}
        >
          更新列表
        </button>
      </div>

      {notice && <p className="notice" role="status">{notice}</p>}

      <Query key={`${page}:${revision}`} load={load}>
        {(result) => (
          <section className="panel form-stack">
            <h2>邀請碼紀錄</h2>
            <p className="muted">列表只顯示狀態與期限，不會再次顯示原碼。</p>

            {result.items.length === 0 && (
              <PageState kind="empty" title="這一頁沒有邀請碼紀錄" />
            )}

            {result.items.map((invite) => {
              // 頁面停留期間也更新到期顯示；最終仍由 API 檢查。
              const status =
                invite.status === "active" &&
                now >= Date.parse(invite.expires_at)
                  ? "expired"
                  : invite.status;

              return (
                <article key={invite.id} className="panel">
                  <div className="row-between">
                    <h3>紀錄 #{invite.id}</h3>
                    <Badge tone={status === "active" ? "green" : "gray"}>
                      {status === "active"
                        ? "有效"
                        : status === "expired"
                          ? "已到期"
                          : "已停用"}
                    </Badge>
                  </div>

                  <p>建立：{formatTime(invite.created_at)}</p>
                  <p>到期：{formatTime(invite.expires_at)}</p>
                  {invite.disabled_at && (
                    <p>停用：{formatTime(invite.disabled_at)}</p>
                  )}

                  {status === "active" && !occupancy.ended_at && (
                    <button
                      type="button"
                      className="button"
                      disabled={busy}
                      onClick={() => begin({ kind: "deactivate", invite })}
                    >
                      停用此碼
                    </button>
                  )}
                </article>
              );
            })}

            <Pagination
              page={page}
              total={result.total}
              pageSize={result.page_size}
              onChange={setPage}
            />
          </section>
        )}
      </Query>

      {action && (
        <Modal
          title={action.kind === "create" ? "確認產生新邀請碼" : "確認停用邀請碼"}
          onClose={() => {
            if (!locked.current) {
              setAction(null);
              setError(null);
            }
          }}
        >
          <div className="form-stack">
            <p>
              {action.kind === "create"
                ? "新碼固定 24 小時到期，會使此入住的舊碼失效；已加入成員不受影響。"
                : "停用後不能再使用此碼加入；已加入成員不受影響。"}
            </p>

            {error && (
              <>
                <RequestError error={error} />
                {error.status === 0 && (
                  <p>
                    操作可能已完成。請先關閉視窗並更新列表；
                    若產生成功但未收到明碼，需再次明確重發。
                  </p>
                )}
              </>
            )}

            <button
              type="button"
              className="button button-primary"
              disabled={busy}
              onClick={confirm}
            >
              {busy ? "處理中…" : "確認執行"}
            </button>
          </div>
        </Modal>
      )}

      {created && (
        <Modal
          title="邀請碼已產生"
          onClose={() => {
            // 關閉即清除明碼；不提供重新開啟明碼的入口。
            setCreated(null);
            setCopyNotice("");
          }}
        >
          <p>請交付經確認的屋主或入住代表。</p>
          <p className="notice">原碼只顯示這一次，關閉後無法查回。</p>
          <p className="code-display" aria-label={`邀請碼 ${created.code}`}>
            {created.code}
          </p>
          <p>到期：{formatTime(created.expires_at)}</p>

          <button type="button" className="button" onClick={copyCode}>
            複製邀請碼
          </button>
          {copyNotice && <p role="status">{copyNotice}</p>}
        </Modal>
      )}
    </section>
  );
}
