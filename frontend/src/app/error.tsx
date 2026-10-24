"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <section className="page-state" role="alert">
        <h1>畫面暫時無法顯示</h1>
        <p className="muted">請重試；若問題持續，請重新整理頁面。</p>
        <button className="button" type="button" onClick={reset}>
          重試
        </button>
      </section>
    </main>
  );
}
