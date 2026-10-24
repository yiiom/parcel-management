import { notFound } from "next/navigation";
import AccountHome from "@/components/account-home";

export default async function WorkspacePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (role !== "resident" && role !== "building_admin" && role !== "system_admin") notFound();
  return <AccountHome role={role} />;
}
