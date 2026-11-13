import Link from "next/link";
import FeatureScroll from "./feature-scroll";
import { Icon, icons } from "./icons";
import PhoneFrame from "./phone-frame";

const steps = [
  { title: "管理員登記", text: "包裹到達後登記收件人與存放位置，系統產生取件碼。" },
  { title: "住戶查看取件碼", text: "登入後查看自己這一戶的包裹與取件碼。" },
  { title: "核對並本人簽收", text: "櫃檯核對取件碼，住戶以自己的帳號確認收到。" },
];

const extras = [
  {
    icon: icons.alert,
    title: "異常包裹處理",
    text: "登記原因與處理結果，可恢復領取或確認退回。",
  },
  {
    icon: icons.exit,
    title: "搬離與換住戶",
    text: "取消資格或結束整戶入住，舊紀錄完整保留。",
  },
  {
    icon: icons.lock,
    title: "資料範圍分明",
    text: "住戶只看自己這一戶，管理員只管自己的大樓。",
  },
];

const places = ["住宅大樓", "社區大廈", "公寓管理室"];

const faqs = [
  {
    q: "住戶要怎麼開始使用？",
    a: "先註冊帳號並登入，再輸入管理員提供的邀請碼加入戶別，就能查看自己這一戶的包裹。",
  },
  {
    q: "家人可以幫我領包裹嗎？",
    a: "同一戶已加入的成員可以代領，由簽收的成員用自己的帳號確認收到。",
  },
  {
    q: "管理員可以代住戶簽收嗎？",
    a: "不行。管理員只負責核對取件碼與交付，簽收須由住戶本人確認。",
  },
  {
    q: "搬走之後還看得到包裹嗎？",
    a: "資格被取消後就看不到該戶的包裹與紀錄，歷史資料仍會保留在系統中。",
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <main>
        <section className="landing-hero">
          <div>
            <h1>管理員好登記，住戶好領取</h1>
            <p className="landing-hero-lead">
              大樓包裹從登記、核對到簽收，整個流程都在同一個系統完成，每一筆都留有紀錄。
            </p>
            <div className="landing-actions">
              <Link className="button button-primary landing-button-primary" href="/login">
                <Icon>{icons.home}</Icon>住戶登入
              </Link>
              <Link className="button" href="/login">
                <Icon>{icons.building}</Icon>管理員登入
              </Link>
            </div>
            <p className="landing-register-hint">
              還沒有帳號？<Link href="/register">註冊住戶帳號</Link>
            </p>
          </div>
          <figure className="landing-visual">
            <PhoneFrame size="sm">
              <div className="landing-body-sm">
                <div className="landing-s-title">我的包裹</div>
                <div className="landing-s-card">
                  <div className="landing-s-row">
                    <strong>新竹物流</strong>
                    <span className="landing-badge landing-badge-waiting">待領取</span>
                  </div>
                  <div className="landing-s-meta">存放位置：櫃檯 A 櫃</div>
                  <div className="landing-s-link">查看取件碼 ›</div>
                </div>
                <div className="landing-s-card">
                  <div className="landing-s-row">
                    <strong>黑貓宅急便</strong>
                    <span className="landing-badge landing-badge-done">已簽收</span>
                  </div>
                  <div className="landing-s-meta">昨天 18:20</div>
                </div>
              </div>
            </PhoneFrame>
            <figcaption className="landing-cap">示意畫面</figcaption>
          </figure>
        </section>

        <section className="landing-section" aria-labelledby="flow-title">
          <h2 id="flow-title">把包裹交到住戶手上</h2>
          <ol className="landing-steps">
            {steps.map((step, index) => (
              <li key={step.title} className="landing-step">
                <span className="landing-step-number">{index + 1}</span>
                <h3>{step.title}</h3>
                <p className="muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <FeatureScroll />

        <section className="landing-section" aria-labelledby="extras-title">
          <h2 id="extras-title">更多貼心功能</h2>
          <div className="landing-extras">
            {extras.map((extra) => (
              <div key={extra.title} className="landing-extra">
                <span className="landing-extra-icon">
                  <Icon>{extra.icon}</Icon>
                </span>
                <h3>{extra.title}</h3>
                <p className="muted">{extra.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section" aria-labelledby="places-title">
          <h2 id="places-title">適合這些場所</h2>
          <ul className="landing-chips">
            {places.map((place) => (
              <li key={place} className="landing-chip">
                {place}
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="faq-title">
          <h2 id="faq-title">常見問題</h2>
          <div className="landing-faq">
            {faqs.map((faq, index) => (
              <details key={faq.q} open={index === 0}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-contact" aria-labelledby="contact-title">
          <h2 id="contact-title">聯絡我</h2>
          <div className="landing-actions">
            <a className="button landing-contact-solid" href="mailto:a0970518217@gmail.com">
              <Icon>{icons.mail}</Icon>a0970518217@gmail.com
            </a>
            <a
              className="button landing-contact-line"
              href="https://github.com/yiiom"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon>{icons.github}</Icon>github.com/yiiom
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
