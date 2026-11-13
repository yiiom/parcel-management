import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./landing.module.css";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const icons = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M9 21v-8h6v8" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h2m4 0h2M8 11h2m4 0h2M10 21v-6h4v6" />
    </>
  ),
  check: <path d="m5 12 5 5L20 7" />,
  alert: (
    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  ),
  exit: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
};

/* ---------- 示意畫面（純畫面，不呼叫 API，也沒有真實資料） ---------- */

function HeroPhone() {
  return (
    <div className={styles.phone}>
      <div className={styles.phoneTitle}>我的包裹</div>
      <div className={styles.phoneCard}>
        <div className={styles.phoneRow}>
          <strong>新竹物流</strong>
          <span className={`${styles.badge} ${styles.badgeWaiting}`}>待領取</span>
        </div>
        <div className={styles.phoneMeta}>存放位置：櫃檯 A 櫃</div>
        <div className={styles.phoneLink}>查看取件碼 ›</div>
      </div>
      <div className={styles.phoneCard}>
        <div className={styles.phoneRow}>
          <strong>黑貓宅急便</strong>
          <span className={`${styles.badge} ${styles.badgeDone}`}>已簽收</span>
        </div>
        <div className={styles.phoneMeta}>昨天 18:20</div>
      </div>
    </div>
  );
}

function RegisterMock() {
  return (
    <div className={styles.mock}>
      <div className={styles.mockTitle}>登記包裹</div>
      <div className={styles.field}>
        <span>入住戶別</span>
        <div>5F-3</div>
      </div>
      <div className={styles.field}>
        <span>收件人</span>
        <div>王小明</div>
      </div>
      <div className={styles.fieldPair}>
        <div className={styles.field}>
          <span>物流公司</span>
          <div>新竹物流</div>
        </div>
        <div className={styles.field}>
          <span>存放位置</span>
          <div>櫃檯 A 櫃</div>
        </div>
      </div>
      <div className={styles.mockButton}>登記包裹</div>
    </div>
  );
}

function PickupMock() {
  return (
    <div className={`${styles.mock} ${styles.center}`}>
      <div className={styles.codeLabel}>你的取件碼</div>
      <div className={styles.code}>482917</div>
      <div className={styles.mockDivider}>
        <div className={styles.mockNote}>管理員已核對，請確認收到包裹</div>
        <div className={`${styles.mockButton} ${styles.mockButtonInline}`}>確認收到</div>
      </div>
    </div>
  );
}

function RecordsMock() {
  const rows = [
    ["王小明", "11/12 18:20", "陳管理員"],
    ["林小華", "11/12 09:05", "陳管理員"],
    ["王小明", "11/11 20:41", "李管理員"],
  ];

  return (
    <div className={styles.mock}>
      <div className={styles.mockTitle}>簽收紀錄</div>
      <div className={`${styles.recordRow} ${styles.recordHead}`}>
        <span>簽收者</span>
        <span>時間</span>
        <span>經手管理員</span>
      </div>
      {rows.map(([name, time, admin]) => (
        <div key={`${name}-${time}`} className={styles.recordRow}>
          <span>{name}</span>
          <span>{time}</span>
          <span>{admin}</span>
        </div>
      ))}
    </div>
  );
}

function InviteMock() {
  return (
    <div className={`${styles.mock} ${styles.center}`}>
      <div className={styles.codeLabel}>戶別邀請碼</div>
      <div className={styles.code}>0725</div>
      <div className={styles.mockNote}>有效至 11/14 14:30</div>
      <div className={styles.mockButtons}>
        <div className={`${styles.mockButton} ${styles.mockButtonLight}`}>重新產生</div>
        <div className={`${styles.mockButton} ${styles.mockButtonLight}`}>停用</div>
      </div>
    </div>
  );
}

/* ---------- 頁面文字 ---------- */

const steps = [
  { title: "管理員登記", text: "包裹到達後登記收件人與存放位置，系統產生取件碼。" },
  { title: "住戶查看取件碼", text: "登入後查看自己這一戶的包裹與取件碼。" },
  { title: "核對並本人簽收", text: "櫃檯核對取件碼，住戶以自己的帳號確認收到。" },
];

const features = [
  {
    id: "register",
    tag: "大樓管理員",
    title: "包裹登記",
    lead: "包裹一到就登記，收件人與存放位置清楚可查。",
    points: [
      "選擇住戶戶別，填寫收件人",
      "可補充物流公司、單號、存放位置與備註",
      "相同物流單號先提醒，避免重複登記",
      "登記後自動產生取件碼，登記錯誤也能更正",
    ],
    visual: <RegisterMock />,
  },
  {
    id: "pickup",
    tag: "住戶・大樓管理員",
    title: "取件碼與本人確認",
    lead: "憑碼領取，由住戶本人完成簽收。",
    points: [
      "住戶登入後查看自己這一戶的包裹與取件碼",
      "管理員核對取件碼，建立 10 分鐘的取件驗證",
      "交付包裹後，住戶以自己的帳號確認收到",
      "管理員不能代簽",
    ],
    visual: <PickupMock />,
  },
  {
    id: "records",
    tag: "住戶・大樓管理員",
    title: "簽收紀錄",
    lead: "誰簽收、何時簽收、誰經手，一查就知道。",
    points: [
      "記錄簽收者、簽收時間與經手管理員",
      "可依日期篩選，快速找到某一次簽收",
      "紀錄不能修改或刪除",
      "日後改名，不影響當時的簽收姓名",
    ],
    visual: <RecordsMock />,
  },
  {
    id: "invite",
    tag: "大樓管理員・住戶",
    title: "戶別與邀請碼",
    lead: "住戶自己加入戶別，管理員不用逐一建檔。",
    points: [
      "管理員建立戶別與入住",
      "產生 4 位數邀請碼，24 小時內有效",
      "住戶註冊後輸入邀請碼，確認戶別即可加入",
      "同戶家人與室友共用包裹與簽收紀錄",
    ],
    visual: <InviteMock />,
  },
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
    <div className={styles.landing}>
      <main>
        <section className={styles.hero}>
          <div>
            <h1>管理員好登記，住戶好領取</h1>
            <p className={styles.heroLead}>
              大樓包裹從登記、核對到簽收，整個流程都在同一個系統完成，每一筆都留有紀錄。
            </p>
            <div className={styles.actions}>
              <Link className={`button button-primary ${styles.buttonPrimary}`} href="/login">
                <Icon>{icons.home}</Icon>住戶登入
              </Link>
              <Link className="button" href="/login">
                <Icon>{icons.building}</Icon>管理員登入
              </Link>
            </div>
            <p className={styles.registerHint}>
              還沒有帳號？<Link href="/register">註冊住戶帳號</Link>
            </p>
          </div>
          <figure className={styles.visual}>
            <div aria-hidden="true">
              <HeroPhone />
            </div>
            <figcaption>示意畫面</figcaption>
          </figure>
        </section>

        <section className={styles.section} aria-labelledby="flow-title">
          <h2 id="flow-title">三步驟，把包裹交到住戶手上</h2>
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <h3>{step.title}</h3>
                <p className="muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="features-title">
          <h2 id="features-title">用一個系統，管好包裹的每一步</h2>
          <ul className={styles.chips}>
            {features.map((feature) => (
              <li key={feature.id}>
                <a className={styles.chip} href={`#${feature.id}`}>
                  {feature.title}
                </a>
              </li>
            ))}
          </ul>
          <div className={styles.features}>
            {features.map((feature) => (
              <article key={feature.id} id={feature.id} className={styles.feature}>
                <div>
                  <span className={styles.tag}>{feature.tag}</span>
                  <h3>{feature.title}</h3>
                  <p className="muted">{feature.lead}</p>
                  <ul className={styles.points}>
                    {feature.points.map((point) => (
                      <li key={point}>
                        <Icon>{icons.check}</Icon>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <figure className={styles.visual}>
                  <div aria-hidden="true">{feature.visual}</div>
                  <figcaption>示意畫面</figcaption>
                </figure>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="extras-title">
          <h2 id="extras-title">更多貼心功能</h2>
          <div className={styles.extras}>
            {extras.map((extra) => (
              <div key={extra.title} className={styles.extra}>
                <span className={styles.extraIcon}>
                  <Icon>{extra.icon}</Icon>
                </span>
                <h3>{extra.title}</h3>
                <p className="muted">{extra.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="places-title">
          <h2 id="places-title">適合這些場所</h2>
          <ul className={styles.chips}>
            {places.map((place) => (
              <li key={place} className={styles.chip}>
                {place}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="faq-title">
          <h2 id="faq-title">常見問題</h2>
          <div className={styles.faq}>
            {faqs.map((faq, index) => (
              <details key={faq.q} open={index === 0}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.cta} aria-labelledby="cta-title">
          <h2 id="cta-title">開始使用大樓包裹管理系統</h2>
          <p>請選擇你的身分登入。</p>
          <div className={styles.actions}>
            <Link className={`button ${styles.ctaLight}`} href="/login">
              <Icon>{icons.home}</Icon>住戶登入
            </Link>
            <Link className={`button ${styles.ctaOutline}`} href="/login">
              <Icon>{icons.building}</Icon>管理員登入
            </Link>
          </div>
          <p className={styles.ctaNote}>
            還沒有帳號？<Link href="/register">註冊住戶帳號</Link>。管理員帳號由系統管理員建立。
          </p>
        </section>
      </main>
    </div>
  );
}
