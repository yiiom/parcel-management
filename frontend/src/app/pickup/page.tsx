import ManagerPickup from "@/components/pickups/manager";
import { PageState } from "@/components/ui/common";

export default async function PickupPage({
  searchParams,
}: {
  searchParams: Promise<{
    verification?: string | string[];
  }>;
}) {
  const { verification } = await searchParams;

  const id =
    typeof verification === "string" &&
    /^[1-9][0-9]*$/.test(verification)
      ? Number(verification)
      : undefined;

  if (
    verification !== undefined &&
    (id === undefined || !Number.isSafeInteger(id))
  ) {
    return (
      <PageState kind="error" title="驗證網址格式不正確" />
    );
  }

  // 查詢參數變更時重建元件，避免保留上一筆驗證狀態。
  return (
    <ManagerPickup
      key={id ?? "new"}
      initialVerificationId={id}
    />
  );
}
