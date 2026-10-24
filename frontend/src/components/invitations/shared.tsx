"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  InvitationApiError,
  toInvitationError,
} from "@/api/invitations";
import { PageState } from "@/components/ui/common";

export function formatTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

// 用於到期顯示與暫停倒數；實際有效性仍由後端判定。
export function useClock() {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

export function RequestError({
  error,
  onRetry,
}: {
  error: InvitationApiError;
  onRetry?: () => void;
}) {
  useEffect(() => {
    if (error.status === 401) {
      // 整頁導向，清除目前版型中已過期的登入與關聯資料。
      window.location.replace("/login");
    }
  }, [error.status]);

  if (error.status === 401) {
    return (
      <PageState kind="error" title="登入已到期，正在前往登入頁">
        <Link href="/login">重新登入</Link>
      </PageState>
    );
  }

  return (
    <PageState
      kind={error.status === 403 ? "forbidden" : "error"}
      title={error.message}
      onRetry={onRetry}
    >
      {error.status === 403 && (
        <p>管理範圍可能已變更，請返回首頁確認目前資格。</p>
      )}
      {error.status === 404 && (
        <p>資料不存在或已無法使用，請返回上一層重新選擇。</p>
      )}
    </PageState>
  );
}

type QueryProps<T> = {
  load: () => Promise<T>;
  children: (data: T) => ReactNode;
};

// 外層負責重試；每次重試重新掛載內層，避免繼續顯示舊資料。
export function Query<T>(props: QueryProps<T>) {
  const [attempt, setAttempt] = useState(0);

  return (
    <QueryAttempt
      key={attempt}
      {...props}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function QueryAttempt<T>({
  load,
  children,
  onRetry,
}: QueryProps<T> & { onRetry: () => void }) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<InvitationApiError | null>(null);

  useEffect(() => {
    let ignore = false;

    void load().then(
      (result) => {
        if (!ignore) setData(result);
      },
      (cause: unknown) => {
        if (!ignore) setError(toInvitationError(cause));
      },
    );

    // 切換戶別、入住或分頁後，丟棄上一個請求的結果。
    return () => {
      ignore = true;
    };
  }, [load]);

  if (error) return <RequestError error={error} onRetry={onRetry} />;

  if (data === null) {
    return <PageState kind="loading" title="正在載入資料…" />;
  }

  return <>{children(data)}</>;
}
