import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <section className="page-state">
        <h1>找不到這個頁面</h1>
        <p className="muted">網址可能有誤，或此頁面尚不存在。</p>
        <Link className="button" href="/">返回入口</Link>
      </section>
    </main>
  );
}
