import MemberDirectory from "@/components/invitations/members";

// 共用現有住戶名單，預設顯示等待退出者。
// 仍可切換有效成員，直接處理已確認搬離者。
export default function MoveOutsPage() {
  return <MemberDirectory exitMode />;
}
