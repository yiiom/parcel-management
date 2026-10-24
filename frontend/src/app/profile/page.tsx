"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useAccount } from "@/components/app-frame";
import { roleHome } from "@/api/navigation";
import {
  updateMyProfile,
  type CurrentUser,
} from "@/api/auth";

export default function ProfilePage() {
  const { account, refreshAccount } = useAccount();
  const [user, setUser] = useState<CurrentUser | null>(account.user);
  const [name, setName] = useState(account.user.name);
  const [phone, setPhone] = useState(account.user.phone);
  const [isSaving, setIsSaving] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving || !user) return;

    setErrorMessage("");
    setSuccessMessage("");

    // 與後端一致，先去除頭尾空白再驗證長度
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    // Array.from 以 Unicode 字元計數，避免部分中文字被算成兩個
    const nameLength = Array.from(cleanName).length;
    const phoneLength = Array.from(cleanPhone).length;

    if (nameLength < 1 || nameLength > 100) {
      setErrorMessage("姓名須為 1～100 個字元，不能只有空白。");
      return;
    }

    if (phoneLength < 8 || phoneLength > 20) {
      setErrorMessage("聯絡電話須為 8～20 個字元。");
      return;
    }

    setIsSaving(true);

    try {
      const updatedUser = await updateMyProfile({
        name: cleanName,
        phone: cleanPhone,
      });

      if (!updatedUser) {
        // 登入失效時收起表單，顯示重新登入連結
        setUser(null);
        setName("");
        setPhone("");
        setNeedsLogin(true);
        setErrorMessage("登入已失效，請重新登入。");
        return;
      }

      // 使用後端實際儲存的資料更新表單
      setUser(updatedUser);
      refreshAccount();
      setName(updatedUser.name);
      setPhone(updatedUser.phone);
      setSuccessMessage("個人資料已更新。");
    } catch (error) {
      // 修改失敗時保留輸入，方便修正或重試
      setErrorMessage(
        error instanceof TypeError
          ? "無法連線，請確認網路後再試。"
          : error instanceof Error
            ? error.message
            : "修改失敗，請稍後再試。",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass = "mt-1 w-full rounded border px-3 py-2";

  return (
    <main className="mx-auto w-full max-w-md p-8">
      <h1 className="text-2xl font-bold">個人資料</h1>
      {user && <p className="mt-4"><Link href={roleHome(user.role)} className="text-teal-700 underline">返回首頁</Link></p>}

      {errorMessage && (
        <p role="alert" className="mt-4 text-red-600">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p role="status" className="mt-4 text-teal-700">
          {successMessage}
        </p>
      )}

      {needsLogin && (
        <div className="mt-4 space-y-3">
          <p>請先登入後再查看個人資料。</p>
          <Link href="/login" className="text-teal-700 underline">
            前往登入
          </Link>
        </div>
      )}

      {user && (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {/* Email 僅供顯示，不送入修改 API */}
          <div>
            <p className="font-medium">Email（不可修改）</p>
            <p className="break-words">{user.email}</p>
          </div>

          {/* 儲存期間停用欄位，避免回應覆蓋送出後的新輸入 */}
          <fieldset disabled={isSaving} className="space-y-4">
            <label className="block">
              姓名（1～100 個字元）
              <input
                className={inputClass}
                name="name"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSuccessMessage("");
                  setErrorMessage("");
                }}
              />
            </label>

            <label className="block">
              聯絡電話（8～20 個字元）
              <input
                className={inputClass}
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setSuccessMessage("");
                  setErrorMessage("");
                }}
              />
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-50"
            >
              {isSaving ? "儲存中…" : "儲存修改"}
            </button>
          </fieldset>
        </form>
      )}
    </main>
  );
}
