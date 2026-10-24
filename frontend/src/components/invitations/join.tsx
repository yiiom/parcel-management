"use client";

import { useRef, useState, type SubmitEvent } from "react";
import { getAccount } from "@/api/account";
import {
  joinUnit,
  verifyInvitation,
  toInvitationError,
  type InvitationApiError,
  type InvitationVerified,
} from "@/api/invitations";
import { useAccount } from "@/components/app-frame";
import { PageState } from "@/components/ui/common";
import ResidentSteps from "@/components/ui/resident-steps";
import { RequestError, formatTime, useClock } from "./shared";

export default function JoinInvitation() {
  const { account } = useAccount();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitationVerified | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<InvitationApiError | null>(null);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const locked = useRef(false);
  const now = useClock();

  const remaining = blockedUntil
    ? Math.max(0, Math.ceil((blockedUntil - now) / 1000))
    : 0;

  const expired = preview
    ? now >= Date.parse(preview.expires_at)
    : false;

  const membership = account.memberships.find(
    (item) => item.status === "active" || item.status === "exit_requested",
  );

  function showError(cause: unknown) {
    const failure = toInvitationError(cause);
    setError(failure);

    if (failure.status === 429) {
      // 驗碼與確認加入共用後端限流，不在前端自行計算錯誤次數。
      // 若中介服務未傳遞標頭，保守等待 5 分鐘；後端仍是最終依據。
      setBlockedUntil(
        Date.now() + (failure.retryAfterSeconds ?? 300) * 1000,
      );
    }

    if ([400, 403, 404, 409, 422, 429].includes(failure.status)) {
      setPreview(null);
    }
  }

  function goHome() {
    // 完整重新載入 /me，讓側欄與首頁立即顯示真實入住資格。
    window.location.replace("/workspace/resident");
  }

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (locked.current || Date.now() < blockedUntil) return;

    locked.current = true;
    setBusy(true);
    setError(null);
    setPreview(null);

    try {
      const result = await verifyInvitation(code);
      setPreview(result);
      setBlockedUntil(0);
    } catch (cause) {
      showError(cause);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function confirmJoin() {
    if (!preview || locked.current || Date.now() < blockedUntil) return;

    if (Date.now() >= Date.parse(preview.expires_at)) {
      setPreview(null);
      setError(null);
      return;
    }

    locked.current = true;
    setBusy(true);
    setError(null);

    try {
      await joinUnit(code);
      setCode("");
      setPreview(null);
      goHome();
    } catch (cause) {
      const failure = toInvitationError(cause);

      if (failure.status === 0 || failure.status >= 500) {
        // 回應遺失時，加入可能已成功。只查自己的最新資格確認結果。
        try {
          const latest = await getAccount();

          if (!latest) {
            window.location.replace("/login");
            return;
          }

          const joined = latest.memberships.some(
            (item) =>
              item.occupancy_id === preview.occupancy_id &&
              (item.status === "active" || item.status === "exit_requested"),
          );

          if (joined) {
            setCode("");
            setPreview(null);
            goHome();
            return;
          }
        } catch {
          // 查詢也失敗時保留原錯誤；不假設加入成功或失敗。
        }
      }

      showError(failure);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  if (account.user.role !== "resident") {
    return <PageState kind="forbidden" title="只有住戶可以使用邀請碼加入" />;
  }

  if (error && (error.status === 401 || error.status === 403)) {
    return <RequestError error={error} />;
  }

  return (
    <main>
      {!membership && <ResidentSteps current={3} />}
      <div className="page-heading">
        <div>
          <p className="eyebrow">住戶</p>
          <h1>加入戶別</h1>
          <p className="muted">請向大樓管理員或入住代表取得邀請碼。</p>
        </div>
      </div>

      <section className="panel narrow-panel form-stack">
        {membership && (
          <p className="notice">
            你目前屬於 {membership.building_name}・{membership.unit_label}。
            {membership.status === "exit_requested"
              ? "等待退出期間仍占用資格。"
              : ""}
            重複加入同一入住不會新增資格；加入其他戶別會被拒絕。
          </p>
        )}

        {error && <RequestError error={error} />}

        {remaining > 0 && (
          <p className="notice" role="status">
            邀請驗證暫停，請於約 {remaining} 秒後再試。
          </p>
        )}

        {!preview ? (
          <form onSubmit={verify}>
            <fieldset disabled={busy || remaining > 0} className="form-stack">
              <label>
                四位數字邀請碼
                <input
                  name="invite_code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{4}"
                  minLength={4}
                  maxLength={4}
                  required
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError(null);
                  }}
                  aria-describedby="invite-code-help"
                />
              </label>

              <p id="invite-code-help" className="muted">
                保留開頭的 0。驗證成功後，還需要確認加入。
              </p>

              <button type="submit" className="button button-primary">
                {busy ? "驗證中…" : "驗證邀請碼"}
              </button>
            </fieldset>
          </form>
        ) : (
          <div className="form-stack">
            <h2>確認要加入的戶別</h2>

            <dl className="detail-grid">
              <dt>大樓</dt>
              <dd>{preview.building_name}</dd>
              <dt>戶別</dt>
              <dd>{preview.unit_label}</dd>
              <dt>邀請碼到期</dt>
              <dd>{formatTime(preview.expires_at)}</dd>
            </dl>

            <p>此預覽不會變更你的資格。按下確認後，系統會重新檢查邀請碼與資格。</p>

            {expired && (
              <p className="notice notice-error" role="alert">
                預覽中的邀請碼已到期，請重新取得並驗證。
              </p>
            )}

            <div className="actions">
              <button
                type="button"
                className="button button-primary"
                disabled={busy || remaining > 0 || expired}
                onClick={confirmJoin}
              >
                {busy ? "正在確認加入結果…" : "確認加入此戶別"}
              </button>

              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setError(null);
                }}
              >
                重新輸入邀請碼
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
