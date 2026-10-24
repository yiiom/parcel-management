"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import {
  createPickupVerification,
  toPickupError,
  type PickupApiError,
} from "@/api/pickups";
import { useAccount } from "@/components/app-frame";
import { PageState } from "@/components/ui/common";
import {
  RequestError,
  useClock,
} from "@/components/invitations/shared";
import PickupSession from "./session";

export default function ManagerPickup({
  initialVerificationId,
}: {
  initialVerificationId?: number;
}) {
  const { account, building } = useAccount();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PickupApiError | null>(null);
  const [blockedUntil, setBlockedUntil] = useState(0);

  const lockRef = useRef(false);
  const now = useClock();

  const activeId = initialVerificationId ?? createdId;

  const remaining = blockedUntil
    ? Math.max(0, Math.ceil((blockedUntil - now) / 1000))
    : 0;

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !building ||
      lockRef.current ||
      Date.now() < blockedUntil
    ) {
      return;
    }

    lockRef.current = true;
    setBusy(true);
    setError(null);

    try {
      const result = await createPickupVerification(
        building.id,
        code,
      );

      setCode("");
      setCreatedId(result.id);

      // 網址只保存驗證編號，取件碼不進入網址或瀏覽器儲存。
      router.replace(`/pickup?verification=${result.id}`);
    } catch (cause) {
      const failure = toPickupError(cause);
      setError(failure);

      if (failure.status === 429) {
        setBlockedUntil(
          Date.now() +
            (failure.retryAfterSeconds ?? 300) * 1000,
        );
      }
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }

  if (account.user.role !== "building_admin") {
    return <PageState kind="forbidden" title="只有管理員可驗證取件碼" />;
  }

  if (!building) {
    return <PageState kind="empty" title="尚未分配大樓" />;
  }

  return (
    <main className="form-stack pickup-verification-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{building.name}</p>
          <h1>取件驗證</h1>
          <p className="muted">
            驗碼後交付實物，最後由住戶本人確認收到。
          </p>
        </div>
      </div>

      {activeId !== null && activeId !== undefined ? (
        <PickupSession
          key={activeId}
          verificationId={activeId}
        />
      ) : (
        <section className="panel narrow-panel form-stack">
          {error && <RequestError error={error} />}

          {error &&
            (error.status === 0 || error.status >= 500) && (
              <p className="notice notice-warning">
                驗證可能已建立，請先核對現場及包裹狀態。
                同一管理員重試有效碼會取得原本仍有效的驗證。
              </p>
            )}

          {remaining > 0 && (
            <p role="status" className="notice">
              取件驗證暫停，請於約 {remaining} 秒後再試。
            </p>
          )}

          <form onSubmit={verify}>
            <fieldset
              disabled={busy || remaining > 0}
              className="form-stack"
            >
              <label>
                六位數字取件碼
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError(null);
                  }}
                />
              </label>

              <button
                type="submit"
                className="button button-primary"
              >
                {busy ? "驗證中…" : "驗證取件碼"}
              </button>
            </fieldset>
          </form>

          <Link href="/parcels">返回包裹管理</Link>
          <Link href="/pickups">查詢簽收紀錄</Link>
        </section>
      )}
    </main>
  );
}
