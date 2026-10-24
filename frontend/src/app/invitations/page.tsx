import InvitationManager from "@/components/invitations/manager";

// 由既有 AppFrame 確認登入；管理元件與 API 再確認角色及大樓權限。
export default function InvitationsPage() {
  return <InvitationManager />;
}
