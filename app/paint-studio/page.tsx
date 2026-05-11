import PaintStudioClient from "./paint-studio-client";

export default async function PaintStudioPage({
  searchParams,
}: {
  searchParams: Promise<{
    bytes?: string;
    day?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <PaintStudioClient
      initialBytes={params.bytes ?? ""}
      initialDay={params.day ?? ""}
    />
  );
}
