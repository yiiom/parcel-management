"use client"; // 這個頁面需要處理表單事件
import { useEffect, useState, type SubmitEvent } from "react";
import Link from "next/link";
import ResidentSteps from "@/components/ui/resident-steps";
import { useRouter } from "next/navigation";
import { roleHome } from "@/api/navigation";
import { loginUser, logoutUser, getCurrentUser, type CurrentUser } from "@/api/auth";
export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false); // 是否正在登入
  const [errorMessage, setErrorMessage] = useState(""); // 錯誤提示
  const [successMessage, setSuccessMessage] = useState(""); // 成功提示
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isChecking, setIsChecking] = useState(true); // 是否正在確認登入狀態
  const [isLoggingOut, setIsLoggingOut] = useState(false); // 是否正在登出

  // 頁面載入時，透過 Cookie 向後端查詢目前帳號
  useEffect(() => {
    let ignore = false; // 頁面離開後，忽略尚未完成的查詢結果

    getCurrentUser()
      .then((user) => {
        if (!ignore) {
          setCurrentUser(user);
          if (user) router.replace(roleHome(user.role));
        }
      })
      .catch(() => {
        if (!ignore) {
          setErrorMessage("無法確認登入狀態，請確認連線後重新整理。");
        }
      })
      .finally(() => {
        if (!ignore) setIsChecking(false); // 查詢結束
      });

    return () => {
      ignore = true; // 清理：避免舊查詢更新已離開的頁面
    };
  }, [router]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); // 避免表單送出時重新載入頁面

    if (isSubmitting || isChecking || isLoggingOut) return; // 處理中先不送出登入

    const form = event.currentTarget; // 保存目前表單
    const formData = new FormData(form); // 取得欄位內容

    setIsSubmitting(true);
    setErrorMessage(""); // 清除上次提示
    setSuccessMessage("");

    try {
      const password = String(formData.get("password") ?? "");
      if (Array.from(password).length < 8 || Array.from(password).length > 128) {
        throw new Error("密碼須為 8～128 個字元。");
      }
      await loginUser({
        email: String(formData.get("email") ?? "").trim(),
        password, // 密碼不去除空白
      });
      
            // 登入 API 成功後，再確認瀏覽器的 Cookie 確實可以使用
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("無法確認登入，請確認瀏覽器允許 Cookie 後再試。");
      }

      setCurrentUser(user); // 更新畫面上的登入帳號

      form.reset(); // 成功後清空帳密欄位
      setSuccessMessage("登入成功。");
      router.replace(roleHome(user.role));
    } catch (error) {
      setErrorMessage(
        error instanceof TypeError
          ? "無法連線，請確認網路後再試。"
          : error instanceof Error
            ? error.message
            : "登入失敗，請稍後再試。",
      );
    } finally {
      setIsSubmitting(false); // 成功或失敗都恢復按鈕
    }
  }
  async function handleLogout() {
  // 避免登入、登出請求同時進行
  if (isLoggingOut || isSubmitting || isChecking) return;

  setIsLoggingOut(true);
  setErrorMessage("");
  setSuccessMessage("");

  try {
    await logoutUser(); // 等待後端撤銷登入並清除 Cookie
    setCurrentUser(null); // 成功後才清除畫面上的帳號
    setSuccessMessage("已登出。");
  } catch (error) {
    setErrorMessage(
      error instanceof TypeError
        ? "無法連線，請確認網路後再試。"
        : error instanceof Error
          ? error.message
          : "登出失敗，請稍後再試。",
    );
  } finally {
    setIsLoggingOut(false); // 成功或失敗都恢復按鈕
  }
}
  // 兩個輸入框共用的樣式
  const inputClass = "mt-1 w-full rounded border px-3 py-2";

  return (
    <main className="mx-auto w-full max-w-md p-8">
      <h1 className="text-2xl font-bold">登入</h1>
      <details className="onboarding-login-help" open>
        <summary>第一次使用？查看住戶加入流程</summary>
        <ResidentSteps current={2} />
        <p className="muted">使用剛建立的帳號登入，接著使用邀請碼加入戶別。</p>
      </details>
            {/* 查詢期間不直接顯示為未登入 */}
      {isChecking && (
        <p role="status" className="mt-4">
          正在確認登入狀態…
        </p>
      )}

      {/* 顯示後端確認有效的登入帳號 */}
      {!isChecking && currentUser && (
        <p role="status" className="mt-4 text-teal-700">
          目前已登入：{currentUser.name}（{currentUser.email}）
        </p>
      )}
            {/* 已登入時才顯示登出按鈕 */}
      {!isChecking && currentUser && (
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut || isSubmitting}
          className="mt-4 rounded border px-4 py-2 disabled:opacity-50"
        >
          {isLoggingOut ? "登出中…" : "登出"}
        </button>
      )}
      {/* 送出時呼叫登入 API */}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          Email
          <input
            className={inputClass}
            name="email"
            type="email"
            autoComplete="username"
            maxLength={255}
            required
          />
        </label>

        <label className="block">
          密碼
          <input
            className={inputClass}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        {/* 顯示登入失敗的原因 */}
        {errorMessage && (
          <p role="alert" className="text-red-600">
            {errorMessage}
          </p>
        )}

        {/* 顯示本次登入成功 */}
        {successMessage && (
          <p role="status" className="text-teal-700">
            {successMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || isChecking || isLoggingOut}
          className="w-full rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "登入中…" : "登入"}
        </button>
      </form>
      <p className="mt-4"><Link href="/register" className="text-teal-700 underline">還沒有帳號？註冊住戶</Link></p>
    </main>
  );
}
