import {
  basePalette,
  fetchBasepaintTheme,
  type BasepaintTheme,
} from "@/lib/basepaintTheme";
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
  let theme: BasepaintTheme | null = null;
  let paletteError: string | null = null;

  if (params.day) {
    try {
      theme = await fetchBasepaintTheme(params.day);
    } catch (error) {
      paletteError =
        error instanceof Error
          ? error.message
          : "Failed to fetch BasePaint theme";
    }
  }

  return (
    <PaintStudioClient
      initialBytes={params.bytes ?? ""}
      initialDay={params.day ?? ""}
      initialPalette={theme?.palette ?? basePalette}
      initialThemeName={theme?.theme ?? null}
      initialPaletteError={paletteError}
    />
  );
}
