"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  toInvitationError,
  type InvitationApiError,
} from "@/api/invitations";
import { RequestError } from "@/components/invitations/shared";
import { PageState } from "@/components/ui/common";

type Props<T> = {
  initial: T;
  load: () => Promise<T>;
  version: (data: T) => string;
  done: (data: T) => boolean;
  write: (data: T) => Promise<unknown>;
  lockRef: RefObject<boolean>;
  title: string;
  acknowledgement: string;
  children: (data: T) => ReactNode;
  preview: (data: T) => ReactNode;
  onData?: (data: T) => void;
  pollMs?: number;
  pollWhile?: (data: T) => boolean;
};

export default function ReviewedOperation<T>({
  initial,
  load,
  version,
  done,
  write,
  lockRef,
  title,
  acknowledgement,
  children,
  preview,
  onData,
  pollMs = 0,
  pollWhile,
}: Props<T>) {
  const [data, setData] = useState<T | null>(initial);
  const [reviewVersion, setReviewVersion] =
    useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backgroundChecking, setBackgroundChecking] = useState(false);
  const visibleBusy = busy && !backgroundChecking;
  const [error, setError] =
    useState<InvitationApiError | null>(null);
  const [message, setMessage] = useState("");

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // 讓住戶頁在資格範圍改變後同步重新載入共用導覽。
  useEffect(() => {
    if (data !== null) onData?.(data);
  }, [data, onData]);

  const apply = useCallback((next: T) => {
    if (!aliveRef.current) return;

    setData(next);
    setReviewVersion((previous) =>
      previous === version(next) ? previous : null,
    );
  }, [version]);

  const refresh = useCallback(async (manual = true) => {
    if (lockRef.current) return;

    lockRef.current = true;
    setBusy(true);
    setBackgroundChecking(!manual);
    setError(null);
    if (manual) setMessage("");

    try {
      const latest = await load();
      apply(latest);
    } catch (cause) {
      if (aliveRef.current) {
        // 查詢失敗立即隱藏舊資料及舊確認。
        setData(null);
        setReviewVersion(null);
        setChecked(false);
        setError(toInvitationError(cause));
      }
    } finally {
      lockRef.current = false;
      if (aliveRef.current) {
        setBusy(false);
        setBackgroundChecking(false);
      }
    }
  }, [load, apply, lockRef]);

  const reviewed =
    data !== null &&
    reviewVersion !== null &&
    reviewVersion === version(data);

  useEffect(() => {
    if (
      pollMs <= 0 ||
      data === null ||
      error ||
      reviewed ||
      (pollWhile && !pollWhile(data))
    ) {
      return;
    }

    // 住戶資格輪詢只讀資料，不會自動送出退出申請。
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh(false);
    }, pollMs);

    return () => window.clearInterval(timer);
  }, [pollMs, pollWhile, data, error, reviewed, refresh]);

  async function prepare() {
    if (lockRef.current || data === null || done(data)) return;

    const before = version(data);

    lockRef.current = true;
    setBusy(true);
    setError(null);
    setMessage("");
    setReviewVersion(null);
    setChecked(false);

    try {
      const latest = await load();
      if (!aliveRef.current) return;

      apply(latest);

      if (done(latest)) {
        setMessage("目前狀態已變更，請核對下方最新結果。");
      } else if (version(latest) !== before) {
        setMessage(
          "資料已變更，本次尚未進入確認。請閱讀最新內容後再預覽。",
        );
      } else {
        setReviewVersion(version(latest));
      }
    } catch (cause) {
      if (aliveRef.current) {
        setData(null);
        setError(toInvitationError(cause));
      }
    } finally {
      lockRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }

  async function commit() {
    if (
      lockRef.current ||
      data === null ||
      !reviewed ||
      !checked ||
      done(data)
    ) {
      return;
    }

    const expected = reviewVersion;
    let attemptedWrite = false;
    let acceptedByServer = false;

    lockRef.current = true;
    setBusy(true);
    setError(null);
    setMessage("");

    try {
      // 預覽後、真正寫入前，再讀一次全部相關資料。
      const latest = await load();
      if (!aliveRef.current) return;

      apply(latest);
      setReviewVersion(null);
      setChecked(false);

      if (done(latest) || version(latest) !== expected) {
        setMessage(
          "資料已變更，本次未送出。請先核對最新結果。",
        );
        return;
      }

      attemptedWrite = true;
      await write(latest);
      acceptedByServer = true;

      if (!aliveRef.current) return;

      const current = await load();
      if (!aliveRef.current) return;

      apply(current);
      setMessage(
        "後端已接受本次操作，以下為重新查詢的最新狀態。",
      );
    } catch (cause) {
      if (!aliveRef.current) return;

      const failure = toInvitationError(cause);

      setError(failure);
      setData(null);
      setReviewVersion(null);
      setChecked(false);

      if (
        attemptedWrite &&
        failure.status !== 401 &&
        failure.status !== 403
      ) {
        setMessage(
          acceptedByServer
            ? "後端已接受操作，但結果查詢曾失敗。請核對重新查得的狀態，不要直接重送。"
            : "本次操作結果尚無法確認；系統不會自動重送，請先核對最新狀態。",
        );

        try {
          const current = await load();
          apply(current);
        } catch (readFailure) {
          if (aliveRef.current) {
            setError(toInvitationError(readFailure));
          }
        }
      }
    } finally {
      lockRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }

  return (
    <section className="form-stack" aria-busy={busy}>
      <button
        type="button"
        className="button"
        // 背景核對保留外觀與焦點；refresh 的鎖仍阻止重複操作。
        disabled={visibleBusy}
        aria-disabled={busy}
        onClick={() => void refresh()}
      >
        {visibleBusy ? "正在核對…" : "重新查詢目前狀態"}
      </button>

      {!visibleBusy && message && (
        <p className="notice" role="status">{message}</p>
      )}

      {error && <RequestError error={error} />}

      {data === null ? (
        busy ? (
          <PageState kind="loading" title="正在查詢最新資料…" />
        ) : (
          <p className="muted">
            暫時隱藏舊資料，請重新查詢後再操作。
          </p>
        )
      ) : (
        <>
          {children(data)}

          {!done(data) && !reviewed && (
            <button
              type="button"
              className="button button-primary"
              disabled={visibleBusy}
              aria-disabled={busy}
              onClick={() => void prepare()}
            >
              檢查並預覽：{title}
            </button>
          )}

          {!done(data) && reviewed && (
            <section className="panel form-stack">
              <h2>確認：{title}</h2>

              {preview(data)}

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={(event) =>
                    setChecked(event.target.checked)
                  }
                />
                {acknowledgement}
              </label>

              <div className="actions">
                <button
                  type="button"
                  className="button button-primary"
                  disabled={busy || !checked}
                  onClick={() => void commit()}
                >
                  {busy ? "正在核對及送出…" : "確認送出"}
                </button>

                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    setReviewVersion(null);
                    setChecked(false);
                  }}
                >
                  取消本次確認
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
