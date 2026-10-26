"use client";

import Link from "next/link";
import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { Parcel } from "@/api/parcels";
import {
  cancelPickupVerification,
  confirmPickup,
  loadPickupSnapshot,
  toPickupError,
  type PickupApiError,
  type PickupSnapshot,
} from "@/api/pickups";
import { useAccount } from "@/components/app-frame";
import { Badge, PageState } from "@/components/ui/common";
import {
  RequestError,
  formatTime,
  useClock,
} from "@/components/invitations/shared";
import { useLivePickup } from "@/hooks/use-live-pickup";
import ReceiptFields from "./record";

function versionOf(data: PickupSnapshot) {
  return [
    data.parcel.id,
    data.parcel.updated_at,
    data.verification?.id ?? "",
    data.verification?.updated_at ?? "",
  ].join(":");
}

type SessionProps = {
  parcelId?: number;
  verificationId?: number;
  sharedLockRef?: RefObject<boolean>;
  renderParcel?: (parcel: Parcel, busy: boolean) => ReactNode;
};

export default function PickupSession(props: SessionProps) {
  const localLockRef = useRef(false);
  // 在元件邊界選擇鎖，內層直接使用 ref，避免條件別名影響 React 檢查。
  return <SessionContent {...props} actionLockRef={props.sharedLockRef ?? localLockRef} />;
}

function SessionContent({
  parcelId,
  verificationId,
  actionLockRef,
  renderParcel,
}: SessionProps & { actionLockRef: RefObject<boolean> }) {
  const { account } = useAccount();
  const resident = account.user.role === "resident";
  const manager = account.user.role === "building_admin";

  const knownVerificationRef = useRef<number | undefined>(
    verificationId,
  );

  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [acceptedVersion, setAcceptedVersion] = useState<string | null>(
    null,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [writeError, setWriteError] = useState<PickupApiError | null>(
    null,
  );

  const now = useClock();

  const load = useCallback(async (signal: AbortSignal) => {
    const result = await loadPickupSnapshot(
      {
        parcelId,
        verificationId,
        knownVerificationId: knownVerificationRef.current,
        resident,
        includeCode: showCode,
      },
      signal,
    );

    if (result.verification) {
      knownVerificationRef.current = result.verification.id;
    }

    return result;
  }, [parcelId, verificationId, resident, showCode]);

  const live = useLivePickup(load);
  const data = live.data;
  const hideCodeWhileChecking = live.checking && !live.backgroundChecking;
  const verification = data?.verification ?? null;

  const seconds =
    verification && now > 0
      ? Math.max(
          0,
          Math.ceil(
            (Date.parse(verification.expires_at) - now) / 1000,
          ),
        )
      : null;

  const waiting =
    verification?.status === "awaiting_confirmation";

  const clockBlocked =
    waiting && (seconds === null || seconds <= 0);

  const version = data ? versionOf(data) : "";
  const accepted =
    version !== "" && acceptedVersion === version;

  const canConfirm =
    resident &&
    waiting &&
    data?.parcel.status === "pending" &&
    data.parcel.active_verification_id === verification?.id &&
    !clockBlocked &&
    !live.checking &&
    !busy &&
    accepted;

  // 顯示條件與操作鎖分開，背景核對時保留按鈕及確認區的高度。
  const showCancel =
    manager &&
    verificationId !== undefined &&
    waiting &&
    verification?.verified_by === account.user.id;

  const canCancel =
    showCancel &&
    !clockBlocked &&
    !live.checking &&
    !busy;

  async function refresh() {
    if (actionLockRef.current) return;

    setWriteError(null);
    setMessage("");
    setCopyMessage("");

    try {
      await live.refresh();
    } catch {
      // 查詢錯誤由 live.error 顯示。
    }
  }

  function toggleCode() {
    if (actionLockRef.current) return;

    // 先清除前次資料與進行中的查詢，再決定是否重新取碼。
    live.clear();
    setShowCode((value) => !value);
    setCopyMessage("");
    setAcceptedVersion(null);
    setWriteError(null);
  }

  async function copyCode() {
    if (
      !data?.code ||
      live.checking ||
      clockBlocked ||
      busy
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(data.code);
      setCopyMessage("已複製取件碼。");
    } catch {
      setCopyMessage("無法自動複製，請手動選取六位數字。");
    }
  }

  async function perform(kind: "confirm" | "cancel") {
    if (
      actionLockRef.current ||
      !data ||
      live.checking ||
      (kind === "confirm" && !canConfirm) ||
      (kind === "cancel" && !canCancel)
    ) {
      return;
    }

    const before = data;
    actionLockRef.current = true;
    setBusy(true);
    setWriteError(null);
    setMessage("");
    setCancelOpen(false);

    try {
      // 寫入前再讀一次，避免使用更正前或其他分頁留下的畫面。
      const latest = await live.refresh();

      if (versionOf(latest) !== versionOf(before)) {
        setAcceptedVersion(null);
        setMessage("資料已變更，請重新核對包裹與驗證狀態。");
        return;
      }

      const current = latest.verification;

      if (
        !current ||
        current.status !== "awaiting_confirmation" ||
        latest.parcel.status !== "pending" ||
        latest.parcel.active_verification_id !== current.id ||
        Date.now() >= Date.parse(current.expires_at)
      ) {
        setAcceptedVersion(null);
        setMessage("目前不能完成這項操作，請依最新狀態重新核對。");
        return;
      }

      // 避免輪詢與此次寫入交錯更新畫面。
      live.pause();

      if (kind === "confirm") {
        await confirmPickup(current.id);
      } else {
        await cancelPickupVerification(current.id);
      }

      setAcceptedVersion(null);

      // 成功回應後仍重新檢查權限與結果，不直接保留舊成功畫面。
      await live.refresh();
    } catch (cause) {
      const failure = toPickupError(cause);
      setAcceptedVersion(null);
      live.clear();

      if (failure.status === 401 || failure.status === 403) {
        setWriteError(failure);
        return;
      }

      try {
        // 回應遺失時，先查詢實際結果，不自動重送確認或取消。
        const latest = await live.refresh();

        if (kind === "confirm" && latest.receipt) {
          setMessage(
            latest.receipt.picked_up_by === account.user.id
              ? "已重新查得你的簽收結果。"
              : "此包裹已由其他成員簽收。",
          );
        } else if (
          kind === "cancel" &&
          latest.verification?.status === "cancelled"
        ) {
          setMessage("已重新確認本次驗證取消。");
        } else {
          setWriteError(failure);
        }
      } catch (readFailure) {
        setWriteError(toPickupError(readFailure));
      }
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  function restartResidentQuery() {
    if (actionLockRef.current) return;

    live.clear();
    knownVerificationRef.current = undefined;
    setAcceptedVersion(null);
    setWriteError(null);
    setMessage("");

    void live.refresh().catch(() => {});
  }

  if (!resident && !manager) {
    return (
      <PageState kind="forbidden" title="此角色不能使用取件功能" />
    );
  }

  if (
    writeError &&
    (writeError.status === 401 || writeError.status === 403)
  ) {
    return <RequestError error={writeError} />;
  }

  if (live.error) {
    return (
      <div className="form-stack">
        <RequestError
          error={live.error}
          onRetry={() => void refresh()}
        />
        {manager && verificationId !== undefined && (
          <Link href="/pickup">返回取件驗證</Link>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="form-stack">
        {writeError && <RequestError error={writeError} />}
        <PageState
          kind="loading"
          title="正在查詢最新取件狀態…"
        />
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void refresh()}
        >
          重新查詢
        </button>
      </div>
    );
  }

  return (
    <section className="form-stack">
      <div className="actions">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void refresh()}
        >
          重新查詢
        </button>
        <Link href="/pickups">簽收紀錄</Link>
      </div>

      {message && <p className="notice" role="status">{message}</p>}
      {writeError && <RequestError error={writeError} />}

      {renderParcel ? (
        renderParcel(data.parcel, busy || live.checking)
      ) : (
        <section className="panel">
          <h2>{data.parcel.recipient_name}</h2>
          <p>
            {data.parcel.unit_label}・包裹 #{data.parcel.id}
          </p>
          <p>
            {data.parcel.courier || "未填物流公司"}・
            {data.parcel.tracking_number || "未填單號"}
          </p>
        </section>
      )}

      {data.receipt ? (
        hideCodeWhileChecking ? (
          <PageState
            kind="loading"
            title="正在重新核對簽收結果…"
          />
        ) : (
          <section className="panel form-stack">
            <Badge>包裹已簽收</Badge>
            <p>簽收者：{data.receipt.picked_up_by_name}</p>

            {verification &&
              verification.status !== "completed" && (
                <p className="muted">
                  本頁原驗證並未完成，包裹已透過另一筆驗證簽收。
                </p>
              )}

            <ReceiptFields receipt={data.receipt} />
            <p className="muted">
              簽收者是完成電子確認的帳號。
            </p>
          </section>
        )
      ) : (
        <>
          {verification && (
            <section className="panel form-stack">
              <h3>
                {verification.status === "awaiting_confirmation"
                  ? "等待住戶確認收到"
                  : verification.status === "expired"
                    ? "本次驗證已過期"
                    : verification.status === "cancelled"
                      ? "本次驗證已取消"
                      : "正在核對簽收紀錄"}
              </h3>

              <p>驗證時間：{formatTime(verification.verified_at)}</p>
              <p>確認期限：{formatTime(verification.expires_at)}</p>

              {waiting && (
                <p role="status" style={{ fontVariantNumeric: "tabular-nums", minHeight: "1.5em" }}>
                  {seconds === null
                    ? "正在計算剩餘時間…"
                    : seconds > 0
                      ? `剩餘約 ${seconds} 秒`
                      : "已到畫面顯示期限，請重新查詢後端狀態。"}
                </p>
              )}

              <p className="muted">
                10 分鐘是本次住戶確認期限，從驗碼成功開始計算。
              </p>

              {waiting && (
                <p className="notice">
                  驗碼成功後仍是待領取。
                  管理員交付實物，住戶核對後再確認收到。
                </p>
              )}

              {resident && waiting && (
                <>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={accepted}
                      disabled={
                        busy ||
                        live.checking ||
                        clockBlocked ||
                        data.parcel.status !== "pending"
                      }
                      onChange={(event) =>
                        setAcceptedVersion(
                          event.target.checked ? version : null,
                        )
                      }
                    />
                    我已實際收到並核對這件包裹
                  </label>

                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!canConfirm}
                    onClick={() => void perform("confirm")}
                  >
                    {busy ? "正在核對結果…" : "確認實際收到包裹"}
                  </button>
                </>
              )}

              {showCancel && !cancelOpen && (
                // 背景核對只用 aria-disabled 與事件守衛鎖定，避免 disabled 樣式反覆閃動。
                <button
                  type="button"
                  className="button"
                  disabled={busy || clockBlocked}
                  aria-disabled={!canCancel}
                  onClick={() => {
                    if (canCancel) setCancelOpen(true);
                  }}
                >
                  取消本次驗證
                </button>
              )}

              {showCancel && cancelOpen && (
                <div className="notice notice-warning form-stack">
                  <p>取消不代表已領取，之後須重新核對現場情況。</p>
                  <button
                    type="button"
                    className="button"
                    disabled={busy || clockBlocked}
                    aria-disabled={!canCancel}
                    onClick={() => void perform("cancel")}
                  >
                    確認取消驗證
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={busy || clockBlocked}
                    aria-disabled={!canCancel}
                    onClick={() => {
                      if (canCancel) setCancelOpen(false);
                    }}
                  >
                    保留驗證
                  </button>
                </div>
              )}

              {(verification.status === "expired" ||
                verification.status === "cancelled") && (
                <>
                  <p className="notice notice-warning">
                    過期或取消不代表已領取。
                    尚未交付時先留櫃檯；若已交付但未簽收，
                    請聯絡管理員核對並記錄異常。
                  </p>

                  {resident ? (
                    <button
                      type="button"
                      className="button"
                      disabled={busy}
                      onClick={restartResidentQuery}
                    >
                      重新核對並查詢
                    </button>
                  ) : (
                    <Link href="/pickup">返回重新驗碼</Link>
                  )}
                </>
              )}
            </section>
          )}

          {resident &&
            data.parcel.status === "pending" &&
            (!verification || waiting) && (
              <section className="panel form-stack pickup-code-panel">
                <h3>取件碼</h3>
                <p>到櫃檯向管理員提供六位數字取件碼。</p>

                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={toggleCode}
                >
                  {showCode ? "隱藏取件碼" : "查看取件碼"}
                </button>

                {showCode && (
                  <div className="pickup-code-space">
                    <div className="pickup-code-value">
                      {hideCodeWhileChecking || clockBlocked ? (
                        <p role="status">正在核對，暫時隱藏取件碼。</p>
                      ) : data.code ? (
                        <p className="code-display">{data.code}</p>
                      ) : (
                        <p>目前沒有可顯示的取件碼，請重新查詢。</p>
                      )}
                    </div>
                    <div className="pickup-code-copy">
                      {!hideCodeWhileChecking && !clockBlocked && data.code && (
                        <button
                          type="button"
                          className="button"
                          // 背景查詢保留外觀與焦點；copyCode 仍會阻擋查詢中的複製。
                          disabled={busy}
                          aria-disabled={live.checking || busy}
                          onClick={() => void copyCode()}
                        >
                          複製取件碼
                        </button>
                      )}
                    </div>
                    <p className="muted pickup-code-feedback" role="status">
                      {!hideCodeWhileChecking && !clockBlocked && data.code ? copyMessage : ""}
                    </p>
                  </div>
                )}

                {!verification && (
                  <p className="muted">
                    管理員驗碼後，此處會顯示確認收到的操作。
                  </p>
                )}
              </section>
            )}

          {manager &&
            verificationId === undefined &&
            data.parcel.status === "pending" && (
              <section className="panel form-stack">
                {data.parcel.active_verification_id !== null ? (
                  <>
                    <Badge tone="amber">有進行中的取件驗證</Badge>
                    <Link
                      className="button"
                      href={`/pickup?verification=${data.parcel.active_verification_id}`}
                    >
                      查看驗證進度（僅經手管理員）
                    </Link>
                  </>
                ) : (
                  <Link className="button" href="/pickup">
                    前往輸入住戶提供的取件碼
                  </Link>
                )}
              </section>
            )}

          {data.parcel.status !== "pending" && (
            <p className="notice">
              此包裹目前不開放領取。
            </p>
          )}

          {/* 包裹詳情已有異常入口；獨立驗證頁另外提供入口。 */}
          {manager &&
            !renderParcel &&
            (
              data.parcel.status === "pending" ||
              data.parcel.status === "exception"
            ) && (
              <Link
                className="button"
                href={`/exceptions/${data.parcel.id}`}
                aria-disabled={busy}
                tabIndex={busy ? -1 : undefined}
                onClick={(event) => {
                  if (busy) event.preventDefault();
                }}
              >
                登記或處理此包裹異常
              </Link>
            )}

          <p className="muted">
            若已交付但尚未簽收，請聯絡核對並記錄異常。
            恢復待領後會更換取件碼，須重新驗碼，
            最後仍由住戶本人確認收到。
          </p>
        </>
      )}
    </section>
  );
}
