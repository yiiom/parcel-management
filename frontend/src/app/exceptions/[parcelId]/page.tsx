import { notFound } from "next/navigation";
import ExceptionWorkspace from "@/components/exceptions/workspace";

export default async function ExceptionPage({
  params,
}: {
  params: Promise<{ parcelId: string }>;
}) {
  const { parcelId } = await params;
  const id = Number(parcelId);

  // 只接受正整數，避免錯誤網址直接送進 API。
  if (
    !/^[1-9][0-9]*$/.test(parcelId) ||
    !Number.isSafeInteger(id)
  ) {
    notFound();
  }

  return <ExceptionWorkspace key={id} parcelId={id} />;
}
