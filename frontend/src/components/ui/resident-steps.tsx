export default function ResidentSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="resident-steps" aria-label="住戶首次使用流程">
      {["建立帳號", "登入", "加入戶別"].map((label, index) => (
        <li key={label} aria-current={current === index + 1 ? "step" : undefined}>
          <span aria-hidden="true">{index + 1}</span>{label}
        </li>
      ))}
    </ol>
  );
}
