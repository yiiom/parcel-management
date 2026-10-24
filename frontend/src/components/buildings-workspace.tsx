"use client";

import Link from "next/link";
import { useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import {
  getBuildings,
  createBuilding,
  type BuildingPage,
} from "@/api/buildings";
import { useAccount } from "@/components/app-frame";
import { Modal } from "@/components/ui/common";
export default function BuildingsPage() {
  const router = useRouter();
  const { account } = useAccount();
  const [result, setResult] = useState<BuildingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 新增大樓表單的三個欄位
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  // 控制送出按鈕及成功提示
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const canCreate = account.user.role === "system_admin";
  const [page, setPage] = useState(1);
  useEffect(() => {
    let ignore = false;

    async function loadBuildings() {
      try {
        const data = await getBuildings(page);

        // 頁面已離開時，不再更新畫面
        if (ignore) return;

        if (data === null) {
          router.replace("/login");
          return;
        }

        setResult(data);
      } catch (err) {
        if (!ignore) {
          // 連線失敗顯示中文，其他錯誤保留後端提供的訊息
          setError(
            err instanceof TypeError
              ? "無法連線，請確認網路後重新整理。"
              : err instanceof Error
                ? err.message
                : "無法載入大樓列表。",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadBuildings();

    return () => {
      ignore = true;
    };
  }, [page, router]);

  function changePage(nextPage: number) {
    if (loading || saving || !result) return;
    const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;

    // 清除上一頁內容，避免載入期間顯示錯誤頁碼的資料。
    setLoading(true);
    setResult(null);
    setError("");
    setSuccess("");
    setPage(nextPage);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); // 避免表單送出時重新整理頁面
    if (saving || loading) return;

    setError("");
    setSuccess("");

    // Array.from 依 Unicode 字元計算長度，與後端一致
    const nameLength = Array.from(name.trim()).length;
    const addressLength = Array.from(address.trim()).length;
    const phoneLength = Array.from(phone.trim()).length;

    if (nameLength < 1 || nameLength > 100) {
      setError("大樓名稱須為 1～100 個字元，不能只有空白。");
      return;
    }

    if (addressLength < 1 || addressLength > 255) {
      setError("地址須為 1～255 個字元，不能只有空白。");
      return;
    }

    if (phoneLength !== 0 && (phoneLength < 8 || phoneLength > 20)) {
      setError("聯絡電話可留空；填寫時須為 8～20 個字元。");
      return;
    }

    setSaving(true);

    try {
      const created = await createBuilding({ name, address, phone });

      if (created === null) {
        router.replace("/login");
        return;
      }

      // 確定新增成功後，才清空表單
      setName("");
      setAddress("");
      setPhone("");
      setSuccess("大樓已新增。");
      setCreating(false);

      // 新資料排在第一頁；變更頁碼後由 useEffect 重新讀取。
      if (page !== 1) {
        setLoading(true);
        setResult(null);
        setPage(1);
        return;
      }

      // 新增與重新讀取列表分開處理，避免誤報新增失敗
      try {
        const latest = await getBuildings(1);

        if (latest === null) {
          router.replace("/login");
          return;
        }

        setResult(latest);
      } catch {
        setResult(null);
        setError("大樓已新增，但列表更新失敗，請重新整理查看，勿重複新增。");
      }
    } catch (err) {
      // 新增失敗時保留輸入內容，連線錯誤使用中文提示，方便重試
      setError(
        err instanceof TypeError
          ? "無法連線，請確認網路後再試。"
          : err instanceof Error
            ? err.message
            : "新增大樓失敗。",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="form-stack system-buildings">
      <div className="page-heading">
        <div><p className="eyebrow">管理平台 / 大樓管理</p><h1>大樓管理</h1>
          <p className="muted">建立社區，並安排負責的大樓管理員。</p></div>
        {canCreate && <button type="button" className="button button-primary" disabled={loading || saving}
          onClick={() => { setError(""); setSuccess(""); setCreating(true); }}>＋ 建立大樓</button>}
      </div>

      {loading && <p className="mt-4" role="status">正在載入大樓…</p>}
      {error && !creating && <p className="notice notice-error" role="alert">{error}</p>}
      {success && (
        <p className="mt-4 text-teal-700" role="status">
          {success}
        </p>
      )}

      {creating && canCreate && (
        <Modal title="建立大樓" onClose={() => { if (!saving) setCreating(false); }}>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="form-stack"
        >
          {error && <p className="notice notice-error" role="alert">{error}</p>}

          <fieldset disabled={saving} className="mt-4 space-y-4">
            <div>
              <label htmlFor="building-name" className="block">
                大樓名稱（必填，1～100 個字元）
              </label>
              <input
                id="building-name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded border p-3"
              />
            </div>

            <div>
              <label htmlFor="building-address" className="block">
                地址（必填，1～255 個字元）
              </label>
              <input
                id="building-address"
                name="address"
                type="text"
                required
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="mt-2 w-full rounded border p-3"
              />
            </div>

            <div>
              <label htmlFor="building-phone" className="block">
                聯絡電話（選填，8～20 個字元）
              </label>
              <input
                id="building-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-2 w-full rounded border p-3"
              />
            </div>

            <button
              type="submit"
              className="button button-primary"
            >
              {saving ? "新增中…" : "新增大樓"}
            </button>
          </fieldset>
        </form>
        </Modal>
      )}
      {result && (
        <div className="mt-6">
          <p>共 {result.total} 棟大樓</p>

          {result.items.length === 0 ? (
            <p className="mt-4">目前尚無大樓。</p>
          ) : (
            <ul className="building-card-grid">
              {result.items.map((building) => (
                <li key={building.id} className="panel building-summary-card">
                  <h2 className="font-bold">
                    <Link
                      href={`/buildings/${building.id}`}
                      className="building-name"
                    >
                      {building.name}
                    </Link>
                  </h2>
                  <p className="mt-2">{building.address}</p>
                  <p className="mt-2">
                    聯絡電話：{building.phone ?? "未提供"}
                  </p>
                  <Link className="button" href={`/buildings/${building.id}`}>查看大樓</Link>
                  {canCreate && <Link href="/building-admins">前往管理員管理與指派 →</Link>}
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="大樓列表分頁" className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => changePage(page - 1)}
              disabled={loading || saving || page <= 1}
              className="rounded border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              上一頁
            </button>
            <p>
              第 {result.page} 頁／共 {Math.max(1, Math.ceil(result.total / result.page_size))} 頁
            </p>
            <button
              type="button"
              onClick={() => changePage(page + 1)}
              disabled={loading || saving || page * result.page_size >= result.total}
              className="rounded border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              下一頁
            </button>
          </nav>
        </div>
      )}
    </main>
  );
}
