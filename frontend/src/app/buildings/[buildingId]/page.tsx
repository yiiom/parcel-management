"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getBuilding,
  deleteBuilding,
  updateBuilding,
  type Building,
} from "@/api/buildings";

import { useAccount } from "@/components/app-frame";
import { Modal } from "@/components/ui/common";
import styles from "./building-detail.module.css";

export default function BuildingDetailPage() {
  const { buildingId } = useParams<{ buildingId: string }>();

  // ID 改變時重新建立內容，避免顯示上一棟的資料
  return <BuildingDetail key={buildingId} buildingId={buildingId} />;
}

function BuildingDetail({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const { account } = useAccount();
  const systemAdmin = account.user.role === "system_admin";
  const [showDelete, setShowDelete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteLock = useRef(false);
  const [building, setBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let ignore = false;

    async function loadBuilding() {
      try {
        const id = Number(buildingId);

        if (
          !/^[1-9]\d*$/.test(buildingId) ||
          !Number.isSafeInteger(id)
        ) {
          throw new Error("大樓網址不正確。");
        }

        const data = await getBuilding(id);

        if (ignore) return;

        if (data === null) {
          router.replace("/login");
          return;
        }

        setBuilding(data);
        setName(data.name);
        setAddress(data.address);
        setPhone(data.phone ?? "");
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof TypeError
              ? "無法連線，請確認網路後再試。"
              : err instanceof Error
                ? err.message
                : "無法載入大樓資料。",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadBuilding();

    return () => {
      ignore = true;
    };
  }, [buildingId, router]);
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || deleting || !building) return;

    setError("");
    setSuccess("");

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
      const updated = await updateBuilding(building.id, {
        name,
        address,
        phone,
      });

      if (updated === null) {
        setBuilding(null);
        router.replace("/login");
        return;
      }

      // 使用後端回傳的資料同步畫面與表單
      setBuilding(updated);
      setName(updated.name);
      setAddress(updated.address);
      setPhone(updated.phone ?? "");
      setSuccess("大樓資料已更新。");
    } catch (err) {
      // 儲存失敗時保留輸入，方便修正或重試
      setError(
        err instanceof TypeError
          ? "無法連線，請確認網路後再試。"
          : err instanceof Error
            ? err.message
            : "修改大樓資料失敗。",
      );
    } finally {
      setSaving(false);
    }
  }
  async function handleDelete() {
    if (!systemAdmin || !building?.can_delete || !showDelete || saving || deleteLock.current || !confirmDelete) return;
    deleteLock.current = true;
    setDeleting(true);
    setError("");
    setSuccess("");
    try {
      const result = await deleteBuilding(building.id);
      if (result === null) {
        setBuilding(null);
        router.replace("/login");
        return;
      }
      setBuilding(null);
      setSuccess("大樓已刪除。");
      router.replace("/buildings");
    } catch (cause) {
      setError(cause instanceof TypeError
        ? "連線中斷，無法確認是否已刪除。請返回列表重新查詢，系統不會自動重送。"
        : cause instanceof Error ? cause.message : "刪除失敗，請重新查詢。");
      setConfirmDelete(false);
      setShowDelete(false);
      // 刪除前可能新增了關聯資料；重新查詢可刪除狀態，失敗時先隱藏刪除區。
      setBuilding((current) => current ? { ...current, can_delete: false } : null);
      try {
        const latest = await getBuilding(building.id);
        setBuilding(latest);
        if (!latest) router.replace("/login");
      } catch {
        // 保留刪除錯誤訊息，不自動重送。
      }
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  }
  function closeDelete() {
    if (deleteLock.current) return;
    setShowDelete(false);
    setConfirmDelete(false);
  }

  const addressField = (
    <div className={systemAdmin ? "col-span-full" : undefined}>
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
  );

  return (
    <main className={systemAdmin ? "mx-auto! max-w-[760px]!" : "mx-auto max-w-2xl p-8"}>
      {systemAdmin && (
        <Link
          href="/buildings"
          className="mt-4 inline-block text-teal-700 underline"
        >
          返回大樓列表
        </Link>
      )}

      {loading && (
        <p className="mt-4" role="status">
          正在載入大樓資料…
        </p>
      )}

      {error && (
        <p className="mt-4 text-red-600" role="alert">
          {error}
        </p>
      )}
      {building && (
        <form onSubmit={handleSubmit} noValidate className="mt-6">
          {systemAdmin && <h1 className="mb-4">大樓資料</h1>}
          <fieldset disabled={saving || deleting} className={systemAdmin ? "form-grid" : "space-y-4"}>
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

            {!systemAdmin && addressField}

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

            {systemAdmin && addressField}

            <div className={systemAdmin ? "col-span-full flex flex-wrap justify-end gap-2" : undefined}>
              {systemAdmin && building.can_delete && (
                <button
                  type="button"
                  className={`button ${styles.deleteTrigger}`}
                  onClick={() => {
                    setConfirmDelete(false);
                    setShowDelete(true);
                  }}
                >
                  刪除大樓
                </button>
              )}
              <button
                type="submit"
                className={systemAdmin ? "button button-primary" : "w-full rounded bg-teal-700 p-3 text-white disabled:cursor-not-allowed disabled:opacity-50"}
              >
                {saving ? "儲存中…" : "儲存修改"}
              </button>
            </div>
          </fieldset>
          {success && (
            <p
              className="mt-4 flex items-start gap-2 rounded-lg bg-[#DCFCE7] p-4 font-bold text-[#166534]"
              role="status"
            >
              <span aria-hidden="true">✓</span>
              <span>{success}</span>
            </p>
          )}
        </form>
      )}
      {building && systemAdmin && building.can_delete && showDelete && (
        <Modal title="確認刪除大樓" onClose={closeDelete}>
          <div className="form-stack">
            <div>
              <p><strong>{building.name}</strong></p>
              <p className="muted">{building.address}</p>
            </div>
            <p>刪除後無法復原。</p>
            <label className={`checkbox-label ${styles.deleteConfirmation}`}>
              <input
                type="checkbox"
                checked={confirmDelete}
                disabled={saving || deleting}
                onChange={(event) => setConfirmDelete(event.target.checked)}
              />
              <span>我確認要永久刪除「{building.name}」</span>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="button" disabled={deleting} onClick={closeDelete}>
                取消
              </button>
              <button
                type="button"
                className={`button ${styles.deleteButton}`}
                onClick={handleDelete}
                disabled={!confirmDelete || saving || deleting}
              >
                {deleting ? "刪除中…" : "確認刪除"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {building && account.user.role === "system_admin" && building.can_delete === false && (
        <p className="mt-6 text-gray-600">此大樓目前無法刪除；有管理員分配、戶別或業務紀錄時不提供刪除功能。</p>
      )}
    </main>
  );
}
