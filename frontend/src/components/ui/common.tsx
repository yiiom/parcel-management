"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SubmitEvent,
} from "react";

export function PageState({
  kind,
  title,
  children,
  onRetry,
}: {
  kind: "loading" | "empty" | "error" | "forbidden";
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <section
      className={`page-state state-${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-busy={kind === "loading"}
    >
      <span className="state-symbol" aria-hidden="true">
        {kind === "loading" ? "…" : kind === "error" ? "!" : "○"}
      </span>

      <h2>{title}</h2>
      {children && <div className="muted">{children}</div>}

      {onRetry && (
        <button className="button" type="button" onClick={onRetry}>
          重新載入
        </button>
      )}
    </section>
  );
}

export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "gray" | "red";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// 原生 dialog 支援背景不可操作及鍵盤焦點限制。
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;

    dialog?.showModal();

    return () => {
      dialog?.close();

      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="button button-quiet"
          aria-label="關閉視窗"
          onClick={onClose}
        >
          關閉
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav className="pagination" aria-label="列表分頁">
      <span className="muted">
        共 {total} 筆・第 {page} / {pages} 頁
      </span>
      <div className="actions">
        <button
          type="button"
          className="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          上一頁
        </button>
        <button
          type="button"
          className="button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          下一頁
        </button>
      </div>
    </nav>
  );
}

// 這個表單只用於未串接畫面，不呼叫正式業務 API。
export function DemoForm({
  children,
  label,
  onSubmit,
}: {
  children: ReactNode;
  label: string;
  onSubmit: (data: FormData) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (locked.current) return;

    // 在等待之前保存輸入，避免事件物件或表單已卸載。
    const data = new FormData(event.currentTarget);
    locked.current = true;
    setBusy(true);
    setError("");

    try {
      // 示範送出中的按鈕狀態，不代表正在寫入資料庫。
      await new Promise<void>((resolve) => window.setTimeout(resolve, 350));

      if (mounted.current) onSubmit(data);
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "示範操作失敗。");
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="form-stack">
        {children}
        {error && <p role="alert" className="error-text">{error}</p>}
        <button className="button button-primary" type="submit">
          {busy ? "示範送出中…" : label}
        </button>
      </fieldset>
    </form>
  );
}
