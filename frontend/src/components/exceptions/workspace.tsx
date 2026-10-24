"use client";

import Link from "next/link";
import {
  useCallback,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import {
  exceptionVersion,
  getExceptionContext,
  reportParcelException,
  resolveParcelException,
  type ExceptionContext,
} from "@/api/exceptions";
import {
  toParcelError,
  type ParcelApiError,
} from "@/api/parcels";
import { useAccount } from "@/components/app-frame";
import {
  Query,
  RequestError,
  formatTime,
} from "@/components/invitations/shared";
import { PageState } from "@/components/ui/common";
import { ParcelSummary } from "@/components/parcels/view";

type Action = "" | "report" | "pending" | "returned";

type Confirmation = {
  action: Exclude<Action, "">;
  text: string;
  version: string;
};

function canPerform(context: ExceptionContext, action: Action) {
  const { parcel, occupancy } = context;

  if (action === "report") {
    return (
      parcel.status === "pending" ||
      parcel.status === "exception"
    );
  }

  if (action === "returned") {
    return parcel.status === "exception";
  }

  if (action === "pending") {
    return (
      parcel.status === "exception" &&
      occupancy.ended_at === null
    );
  }

  return false;
}

export default function ExceptionWorkspace({
  parcelId,
}: {
  parcelId: number;
}) {
  const { account, building } = useAccount();

  const load = useCallback(
    () => getExceptionContext(parcelId),
    [parcelId],
  );

  if (account.user.role !== "building_admin") {
    return (
      <PageState
        kind="forbidden"
        title="只有所屬大樓管理員可處理異常"
      />
    );
  }

  if (!building) {
    return <PageState kind="empty" title="尚未分配大樓" />;
  }

  return (
    <main className="form-stack parcel-exception-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{building.name}</p>
          <h1>包裹異常處理</h1>
          <p className="muted">
            只保留最近一次異常及處理結果。
          </p>
        </div>
      </div>

      <Query load={load}>
        {(initial) => (
          <ExceptionForm
            key={parcelId}
            initial={initial}
          />
        )}
      </Query>
    </main>
  );
}

function ExceptionForm({
  initial,
}: {
  initial: ExceptionContext;
}) {
  const parcelId = initial.parcel.id;

  const [context, setContext] =
    useState<ExceptionContext | null>(initial);
  const [action, setAction] = useState<Action>("");
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("");
  const [confirmation, setConfirmation] =
    useState<Confirmation | null>(null);

  const [returnedChecked, setReturnedChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ParcelApiError | null>(null);
  const [message, setMessage] = useState("");

  // 寫入結果不明時，必須先核對最新資料，再自行決定是否重新操作。
  const [uncertain, setUncertain] = useState(false);
  const [uncertainReviewed, setUncertainReviewed] = useState(false);

  const lockRef = useRef(false);

  function choose(next: Action) {
    if (lockRef.current) return;

    setAction(next);
    setConfirmation(null);
    setReturnedChecked(false);
    setError(null);
    setMessage("");
  }

  async function refresh() {
    if (lockRef.current) return;

    lockRef.current = true;
    setBusy(true);
    setConfirmation(null);
    setError(null);
    setMessage("");
    setUncertainReviewed(false);

    try {
      const latest = await getExceptionContext(parcelId);
      setContext(latest);
    } catch (cause) {
      // 查詢失敗時隱藏舊資料；表單輸入仍保留在 state。
      setContext(null);
      setError(toParcelError(cause));
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }

  async function prepare(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (lockRef.current || !context) return;

    const text =
      action === "report" ? reason.trim() : resolution.trim();

    if (!action || !text) {
      setMessage(
        !action
          ? "請先選擇本次操作。"
          : action === "report"
            ? "請填寫異常原因，不能只有空白。"
            : "請填寫處理結果，不能只有空白。",
      );
      return;
    }

    if (uncertain && !uncertainReviewed) {
      setMessage("請先核對目前資料，確認是否仍需要重新操作。");
      return;
    }

    const previousVersion = exceptionVersion(context);

    lockRef.current = true;
    setBusy(true);
    setError(null);
    setMessage("");
    setConfirmation(null);

    try {
      const latest = await getExceptionContext(parcelId);
      setContext(latest);

      if (exceptionVersion(latest) !== previousVersion) {
        setReturnedChecked(false);
        setUncertainReviewed(false);
        setMessage(
          "包裹或入住資料已變更，請先核對最新內容，再準備確認。",
        );
        return;
      }

      if (!canPerform(latest, action)) {
        setMessage(
          "目前狀態不允許此操作；入住已結束時只能處理退回。",
        );
        return;
      }

      setConfirmation({
        action,
        text,
        version: exceptionVersion(latest),
      });
    } catch (cause) {
      setContext(null);
      setError(toParcelError(cause));
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }

  async function commit() {
    const reviewed = confirmation;

    if (
      lockRef.current ||
      !reviewed ||
      (reviewed.action === "returned" && !returnedChecked)
    ) {
      return;
    }

    lockRef.current = true;
    setBusy(true);
    setError(null);
    setMessage("");

    let attemptedWrite = false;
    let acceptedByServer = false;

    try {
      // 最後送出前再次核對。
      // 前端檢查改善操作體驗，真正的交易與權限仍由後端保證。
      const latest = await getExceptionContext(parcelId);
      setContext(latest);

      if (
        exceptionVersion(latest) !== reviewed.version ||
        !canPerform(latest, reviewed.action)
      ) {
        setConfirmation(null);
        setReturnedChecked(false);
        setUncertainReviewed(false);
        setMessage(
          "資料已變更，本次未送出。請核對最新狀態後重新確認。",
        );
        return;
      }

      attemptedWrite = true;

      const result =
        reviewed.action === "report"
          ? await reportParcelException(parcelId, reviewed.text)
          : await resolveParcelException(
              parcelId,
              reviewed.action,
              reviewed.text,
            );

      acceptedByServer = true;

      // 寫入回應成功後仍重新讀取，不能把舊回應長期當成最新狀態。
      const current = await getExceptionContext(parcelId);

      setContext(current);
      setConfirmation(null);
      setAction("");
      setReturnedChecked(false);
      setUncertain(false);
      setUncertainReviewed(false);

      if (current.parcel.updated_at !== result.updated_at) {
        setMessage(
          "後端已接受本次操作；資料之後又有變更，以下顯示重新查得的最新內容。",
        );
      } else {
        setMessage(
          reviewed.action === "report"
            ? "異常登記完成，未完成的取件驗證已取消。"
            : reviewed.action === "pending"
              ? "已恢復待領並更換取件碼，請由住戶重新取碼、管理員驗碼，再由住戶確認收到。"
              : "已記錄實際退回物流，此包裹不能再領取。",
        );
      }
    } catch (cause) {
      const failure = toParcelError(cause);

      setError(failure);
      setConfirmation(null);
      setReturnedChecked(false);
      setUncertainReviewed(false);

      if (attemptedWrite) {
        setUncertain(true);
        setMessage(
          acceptedByServer
            ? "後端已接受操作，但最新資料查詢失敗。請先重新查詢，不要直接重送。"
            : "目前無法確認本次操作結果。系統不會自動重送，請先核對最新資料。",
        );
      }

      // 權限失效立即清除資料；401 由既有 RequestError 導回登入。
      if (
        !attemptedWrite ||
        failure.status === 401 ||
        failure.status === 403
      ) {
        setContext(null);
      } else {
        try {
          // 即使讀到目標狀態，也不能推定一定是自己的操作造成。
          // 保留錯誤提示，要求使用者核對後再決定下一步。
          setContext(await getExceptionContext(parcelId));
        } catch (readFailure) {
          setContext(null);
          setError(toParcelError(readFailure));
        }
      }
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }

  if (!context) {
    return (
      <section className="form-stack">
        {message && <p className="notice" role="status">{message}</p>}
        {error && <RequestError error={error} />}

        <p className="muted">
          暫時隱藏舊資料；已填寫的原因與處理結果仍保留。
        </p>

        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? "正在查詢…" : "重新查詢目前資料"}
        </button>

        <Link href="/exceptions">返回異常列表</Link>
      </section>
    );
  }

  const { parcel, occupancy } = context;
  const editable =
    parcel.status === "pending" || parcel.status === "exception";

  return (
    <section className="form-stack" aria-busy={busy}>
      <div className="actions">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? "正在核對…" : "重新查詢目前資料"}
        </button>

        {!busy && (
          <>
            <Link href="/exceptions">返回異常列表</Link>
            <Link href="/parcels">返回包裹管理</Link>
          </>
        )}
      </div>

      {message && <p className="notice" role="status">{message}</p>}
      {error && <RequestError error={error} />}

      <section className="panel form-stack">
        <ParcelSummary parcel={parcel} />

        <dl className="detail-grid">
          <dt>存放位置</dt>
          <dd>{parcel.storage_location || "未填寫"}</dd>
          <dt>包裹備註</dt>
          <dd>{parcel.note || "無"}</dd>
          <dt>入住狀態</dt>
          <dd>
            {occupancy.ended_at
              ? `已結束：${formatTime(occupancy.ended_at)}`
              : "目前有效"}
          </dd>
          <dt>最近異常原因</dt>
          <dd>{parcel.exception_reason || "尚無異常紀錄"}</dd>
          <dt>異常時間</dt>
          <dd>{formatTime(parcel.exception_reported_at)}</dd>
          <dt>異常登記者</dt>
          <dd>
            {parcel.exception_reported_by === null
              ? "—"
              : `帳號 #${parcel.exception_reported_by}`}
          </dd>
          <dt>最近處理結果</dt>
          <dd>{parcel.resolution_note || "尚無處理結果"}</dd>
          <dt>處理時間</dt>
          <dd>{formatTime(parcel.resolved_at)}</dd>
          <dt>處理者</dt>
          <dd>
            {parcel.resolved_by === null
              ? "—"
              : `帳號 #${parcel.resolved_by}`}
          </dd>
          <dt>資料更新時間</dt>
          <dd>{formatTime(parcel.updated_at)}</dd>
        </dl>
      </section>

      {uncertain && (
        <section className="notice notice-warning form-stack">
          <p>
            上次寫入結果曾無法確認。請核對上方最新原因、
            處理結果、狀態及時間，確認是否仍需要重新操作。
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={uncertainReviewed}
              disabled={busy}
              onChange={(event) => {
                setUncertainReviewed(event.target.checked);
                setConfirmation(null);
              }}
            />
            我已核對目前資料，仍需要執行接下來選擇的操作
          </label>
        </section>
      )}

      {!editable ? (
        <PageState
          kind="empty"
          title={
            parcel.status === "picked_up"
              ? "包裹已簽收，不能新增或處理異常"
              : "包裹已退回，不能再次新增或處理異常"
          }
        />
      ) : (
        <section className="panel form-stack">
          <p className="notice">
            尚未交付時先保留櫃檯；若已交付但未電子簽收，
            請記錄異常並聯絡核對。管理員不能代替住戶簽收。
          </p>

          {occupancy.ended_at && (
            <p className="notice notice-warning">
              原入住已結束；異常包裹只能處理退回，不能恢復待領。
            </p>
          )}

          <div className="actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              aria-pressed={action === "report"}
              onClick={() => choose("report")}
            >
              {parcel.status === "exception"
                ? "更新最近一次異常"
                : "登記異常"}
            </button>

            {parcel.status === "exception" && (
              <>
                <button
                  type="button"
                  className="button"
                  disabled={busy || occupancy.ended_at !== null}
                  aria-pressed={action === "pending"}
                  onClick={() => choose("pending")}
                >
                  恢復待領
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  aria-pressed={action === "returned"}
                  onClick={() => choose("returned")}
                >
                  記錄實際退回物流
                </button>
              </>
            )}
          </div>

          {action && canPerform(context, action) && (
            <form onSubmit={prepare} className="form-stack">
              <fieldset disabled={busy} className="form-stack">
                {action === "report" ? (
                  <label>
                    異常原因（必填）
                    <textarea
                      rows={5}
                      required
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        setConfirmation(null);
                      }}
                    />
                  </label>
                ) : (
                  <label>
                    處理結果（必填）
                    <textarea
                      rows={5}
                      required
                      value={resolution}
                      onChange={(event) => {
                        setResolution(event.target.value);
                        setConfirmation(null);
                      }}
                    />
                  </label>
                )}

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={uncertain && !uncertainReviewed}
                >
                  準備確認本次操作
                </button>
              </fieldset>
            </form>
          )}

          {confirmation && (
            <section className="notice notice-warning form-stack">
              <h2>確認本次操作</h2>

              <p>
                {confirmation.action === "report"
                  ? "將此包裹標為異常、取消未完成驗證，並清空前次處理結果；只保留本次異常原因。"
                  : confirmation.action === "pending"
                    ? "將恢復待領並更換取件碼；原驗證不能繼續使用，最後仍須由住戶確認收到。"
                    : "確認包裹已實際退回物流後，才記錄為已退回；之後不能再領取。"}
              </p>

              <p style={{ whiteSpace: "pre-wrap" }}>
                {confirmation.text}
              </p>

              {confirmation.action === "returned" && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={returnedChecked}
                    disabled={busy}
                    onChange={(event) =>
                      setReturnedChecked(event.target.checked)
                    }
                  />
                  我已確認包裹實際退回物流
                </label>
              )}

              <div className="actions">
                <button
                  type="button"
                  className="button button-primary"
                  disabled={
                    busy ||
                    (
                      confirmation.action === "returned" &&
                      !returnedChecked
                    )
                  }
                  onClick={() => void commit()}
                >
                  {busy ? "正在核對及送出…" : "確認送出"}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => setConfirmation(null)}
                >
                  返回修改
                </button>
              </div>
            </section>
          )}
        </section>
      )}
    </section>
  );
}
