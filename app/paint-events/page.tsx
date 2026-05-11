"use client";

import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  basePalette,
  fetchBasepaintTheme,
  type BasepaintTheme,
  type Palette,
} from "@/lib/basepaintTheme";
import Link from "next/link";
import {
  type CSSProperties,
  FormEvent,
  KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type FrameMode = "tight" | "full";

interface PaintedEventSnapshot {
  day: string;
  tokenId: string;
  author: string;
  pixels: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: number;
}

interface Pixel {
  x: number;
  y: number;
  colorIndex: number;
}

interface PixelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

function decodePixels(pixelHex: string) {
  const cleanHex = pixelHex.startsWith("0x") ? pixelHex.slice(2) : pixelHex;
  const pixels: Pixel[] = [];

  for (let i = 0; i + 5 < cleanHex.length; i += 6) {
    pixels.push({
      x: parseInt(cleanHex.slice(i, i + 2), 16),
      y: parseInt(cleanHex.slice(i + 2, i + 4), 16),
      colorIndex: parseInt(cleanHex.slice(i + 4, i + 6), 16),
    });
  }

  return pixels;
}

function pixelBounds(pixels: Pixel[]): PixelBounds {
  if (pixels.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 1,
      height: 1,
    };
  }

  let minX = 255;
  let minY = 255;
  let maxX = 0;
  let maxY = 0;

  for (const pixel of pixels) {
    minX = Math.min(minX, pixel.x);
    minY = Math.min(minY, pixel.y);
    maxX = Math.max(maxX, pixel.x);
    maxY = Math.max(maxY, pixel.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function frameDimensions(pixels: Pixel[], frameMode: FrameMode) {
  const bounds = pixelBounds(pixels);

  return {
    bounds,
    minX: frameMode === "full" ? 0 : bounds.minX,
    minY: frameMode === "full" ? 0 : bounds.minY,
    width: frameMode === "full" ? 256 : bounds.width,
    height: frameMode === "full" ? 256 : bounds.height,
  };
}

function paintEventSvgMarkup(
  pixels: Pixel[],
  palette: Palette,
  frameMode: FrameMode,
) {
  const frame = frameDimensions(pixels, frameMode);
  const rects = pixels
    .map(
      (pixel) =>
        `<rect x="${pixel.x}" y="${pixel.y}" width="1" height="1" fill="${
          palette[pixel.colorIndex] ?? "#49e7ec"
        }" />`,
    )
    .join("");

  return {
    width: frame.width,
    height: frame.height,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="${frame.minX} ${frame.minY} ${frame.width} ${frame.height}" shape-rendering="crispEdges">${rects}</svg>`,
  };
}

function PaintEventImage({
  pixels,
  palette,
  frameMode,
  className = "",
  style,
}: {
  pixels: Pixel[];
  palette: Palette;
  frameMode: FrameMode;
  className?: string;
  style?: CSSProperties;
}) {
  const svgUrl = useMemo(() => {
    const { markup } = paintEventSvgMarkup(pixels, palette, frameMode);

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  }, [frameMode, palette, pixels]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={svgUrl}
      alt=""
      draggable={false}
      className={className}
      style={{
        imageRendering: "pixelated",
        ...style,
      }}
    />
  );
}

async function downloadSvgAsPng({
  pixels,
  palette,
  frameMode,
  scale,
  filename,
}: {
  pixels: Pixel[];
  palette: Palette;
  frameMode: FrameMode;
  scale: number;
  filename: string;
}) {
  const { width, height, markup } = paintEventSvgMarkup(
    pixels,
    palette,
    frameMode,
  );
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to render SVG"));
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!pngBlob) return;

    const pngUrl = URL.createObjectURL(pngBlob);
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(pngUrl);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function basescanTxUrl(transactionHash: string) {
  return `https://basescan.org/tx/${transactionHash}`;
}

function downloadTextFile(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function basepaintProfileUrl(authorAddress: string) {
  return `https://basepaint.xyz/profile/${encodeURIComponent(authorAddress)}`;
}

const PaintEventCard = memo(function PaintEventCard({
  event,
  frameMode,
  palette,
  index,
  onOpenEvent,
}: {
  event: PaintedEventSnapshot;
  frameMode: FrameMode;
  palette: Palette;
  index: number;
  onOpenEvent: (index: number) => void;
}) {
  const pixels = useMemo(() => decodePixels(event.pixels), [event.pixels]);
  const bounds = useMemo(() => pixelBounds(pixels), [pixels]);

  const savePng = async () => {
    const scale = frameMode === "full" ? 4 : 8;
    await downloadSvgAsPng({
      pixels,
      palette,
      frameMode,
      scale,
      filename: `basepaint-day-${event.day}-event-${index + 1}-${frameMode}@${scale}x.png`,
    });
  };

  const handleKeyDown = (keyboardEvent: KeyboardEvent<HTMLElement>) => {
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault();
      onOpenEvent(index);
    }
  };

  return (
    <article
      className="group cursor-pointer rounded border border-zinc-700/80 bg-zinc-800/80 p-3 transition-colors hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
      role="button"
      tabIndex={0}
      onClick={() => onOpenEvent(index)}
      onKeyDown={handleKeyDown}
      aria-label={`Open BasePaint event ${index + 1}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={basescanTxUrl(event.transactionHash)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
            onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
            className="text-sm font-semibold text-white transition-colors hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            aria-label={`Open BaseScan transaction for event ${index + 1}`}
          >
            Event {index + 1}
          </a>
          <div className="mt-1 truncate font-mono text-[11px] text-zinc-400">
            Day {event.day}
          </div>
        </div>
        <button
          type="button"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            savePng();
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-600 text-zinc-200 transition-colors hover:border-emerald-400 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          title="Save paint event as PNG"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex h-44 items-center justify-center overflow-hidden rounded border border-zinc-700 bg-[linear-gradient(45deg,#1f2937_25%,transparent_25%),linear-gradient(-45deg,#1f2937_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f2937_75%),linear-gradient(-45deg,transparent_75%,#1f2937_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] p-3">
        <PaintEventImage
          pixels={pixels}
          palette={palette}
          frameMode={frameMode}
          className="max-h-full max-w-full"
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
        <div>
          <dt className="text-zinc-500">Pixels</dt>
          <dd className="font-mono text-zinc-200">{pixels.length}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Bounds</dt>
          <dd className="font-mono text-zinc-200">
            {bounds.width}x{bounds.height}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Origin</dt>
          <dd className="font-mono text-zinc-200">
            {bounds.minX},{bounds.minY}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Block</dt>
          <dd className="font-mono text-zinc-200">{event.blockNumber}</dd>
        </div>
      </dl>

      <div className="mt-3 space-y-1 border-t border-zinc-700 pt-3 font-mono text-[11px] text-zinc-500">
        <a
          href={basepaintProfileUrl(event.author)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
          className="block truncate transition-colors hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          Go to Author
        </a>
      </div>
    </article>
  );
});

function PaintEventModal({
  event,
  frameMode,
  palette,
  index,
  onClose,
}: {
  event: PaintedEventSnapshot;
  frameMode: FrameMode;
  palette: Palette;
  index: number;
  onClose: () => void;
}) {
  const pixels = useMemo(() => decodePixels(event.pixels), [event.pixels]);
  const bounds = useMemo(() => pixelBounds(pixels), [pixels]);
  const frame = useMemo(
    () => frameDimensions(pixels, frameMode),
    [frameMode, pixels],
  );
  const [outputScale, setOutputScale] = useState(frameMode === "full" ? 4 : 12);

  useEffect(() => {
    const handleKeyDown = (keyboardEvent: globalThis.KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const outputWidth = frame.width * outputScale;
  const outputHeight = frame.height * outputScale;
  const previewAspectRatio = frame.width / frame.height;

  const savePng = async () => {
    await downloadSvgAsPng({
      pixels,
      palette,
      frameMode,
      scale: outputScale,
      filename: `basepaint-day-${event.day}-event-${index + 1}-${frameMode}@${outputScale}x.png`,
    });
  };

  const saveSvg = () => {
    const { markup } = paintEventSvgMarkup(pixels, palette, frameMode);

    downloadTextFile(
      markup,
      `basepaint-day-${event.day}-event-${index + 1}-${frameMode}.svg`,
      "image/svg+xml;charset=utf-8",
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="paint-event-modal-title"
        className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded border border-zinc-700 bg-zinc-900 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-4 py-4">
          <div className="min-w-0">
            <h2
              id="paint-event-modal-title"
              className="text-lg font-bold text-white"
            >
              <a
                href={basescanTxUrl(event.transactionHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                aria-label={`Open BaseScan transaction for event ${index + 1}`}
              >
                Event {index + 1}
              </a>
            </h2>
            <div className="mt-1 truncate font-mono text-xs text-zinc-400">
              Day {event.day}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-zinc-700 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            title="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-h-0 bg-zinc-950 p-5">
            <div className="flex h-full min-h-[240px] items-center justify-center">
              <div className="flex h-full max-h-[calc(92dvh-150px)] w-full items-center justify-center rounded border border-zinc-700 bg-[linear-gradient(45deg,#1f2937_25%,transparent_25%),linear-gradient(-45deg,#1f2937_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f2937_75%),linear-gradient(-45deg,transparent_75%,#1f2937_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] p-4">
                <PaintEventImage
                  pixels={pixels}
                  palette={palette}
                  frameMode={frameMode}
                  className="block max-h-full max-w-full"
                  style={{
                    aspectRatio: `${previewAspectRatio}`,
                    width: "100%",
                    height: "100%",
                  }}
                />
              </div>
            </div>
          </div>

          <aside className="border-t border-zinc-800 p-4 lg:border-l lg:border-t-0">
            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase text-zinc-500">
                  Size
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOutputScale((scale) => Math.max(1, scale - 1))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 text-zinc-200 transition-colors hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    title="Smaller"
                  >
                    <MinusIcon className="h-5 w-5" />
                  </button>
                  <div className="h-10 flex-1 rounded border border-zinc-700 px-3 py-2 text-center font-mono text-sm text-white">
                    {outputScale}x
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setOutputScale((scale) => Math.min(64, scale + 1))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 text-zinc-200 transition-colors hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    title="Larger"
                  >
                    <PlusIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 font-mono text-xs text-zinc-500">
                  PNG {outputWidth}x{outputHeight}
                </div>
              </div>

              <button
                type="button"
                onClick={savePng}
                className="flex h-11 w-full items-center justify-center gap-2 rounded bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Download PNG
              </button>

              <button
                type="button"
                onClick={saveSvg}
                className="flex h-11 w-full items-center justify-center gap-2 rounded bg-cyan-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Download SVG
              </button>

              <Link
                href={`/paint-studio?bytes=${encodeURIComponent(event.pixels)}&day=${encodeURIComponent(event.day)}`}
                className="flex h-11 w-full items-center justify-center rounded border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:border-cyan-400 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                Edit in studio
              </Link>

              <dl className="grid grid-cols-2 gap-3 text-xs text-zinc-400">
                <div>
                  <dt className="text-zinc-500">Pixels</dt>
                  <dd className="font-mono text-zinc-100">{pixels.length}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Bounds</dt>
                  <dd className="font-mono text-zinc-100">
                    {bounds.width}x{bounds.height}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Origin</dt>
                  <dd className="font-mono text-zinc-100">
                    {bounds.minX},{bounds.minY}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Block</dt>
                  <dd className="font-mono text-zinc-100">
                    {event.blockNumber}
                  </dd>
                </div>
              </dl>

              <div className="space-y-2 border-t border-zinc-800 pt-4 font-mono text-xs text-zinc-500">
                <a
                  href={basepaintProfileUrl(event.author)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-all transition-colors hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  Go to Author
                </a>
                <a
                  href={basescanTxUrl(event.transactionHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block transition-colors hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  Go to Transaction
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function DaySearchForm({
  defaultDay,
  isLoading,
  onFetch,
}: {
  defaultDay: string;
  isLoading: boolean;
  onFetch: (day: string) => void;
}) {
  const [draftDay, setDraftDay] = useState(defaultDay);

  useEffect(() => {
    setDraftDay(defaultDay);
  }, [defaultDay]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onFetch(draftDay.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <label className="text-sm font-medium text-zinc-300" htmlFor="day">
        Day
      </label>
      <input
        id="day"
        value={draftDay}
        onChange={(event) => setDraftDay(event.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        className="h-10 w-full rounded border border-zinc-700 bg-zinc-950 px-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 sm:w-28"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="flex h-10 items-center justify-center gap-2 rounded bg-cyan-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {isLoading ? (
          <ArrowPathIcon className="h-4 w-4 animate-spin" />
        ) : (
          <MagnifyingGlassIcon className="h-4 w-4" />
        )}
        Fetch
      </button>
    </form>
  );
}

export default function PaintEventsPage() {
  const [activeDay, setActiveDay] = useState("");
  const [loadingDay, setLoadingDay] = useState("current");
  const [events, setEvents] = useState<PaintedEventSnapshot[]>([]);
  const [frameMode, setFrameMode] = useState<FrameMode>("tight");
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(
    null,
  );
  const [theme, setTheme] = useState<BasepaintTheme | null>(null);
  const [palette, setPalette] = useState<Palette>(basePalette);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paletteName = theme
    ? `${theme.theme}${theme.proposer ? ` by ${theme.proposer}` : ""}`
    : activeDay
      ? `BasePaint day ${activeDay}`
      : "BasePaint current day";
  const selectedEvent =
    selectedEventIndex === null ? null : events[selectedEventIndex] ?? null;
  const openEvent = useCallback((index: number) => {
    setSelectedEventIndex(index);
  }, []);
  const closeModal = useCallback(() => {
    setSelectedEventIndex(null);
  }, []);

  const stats = useMemo(() => {
    const totalPixels = events.reduce(
      (sum, event) => sum + Math.floor(event.pixels.length / 6),
      0,
    );
    const authors = new Set(events.map((event) => event.author));

    return {
      totalPixels,
      authorCount: authors.size,
    };
  }, [events]);

  const fetchEvents = useCallback(async (day?: string) => {
    const requestedDay = day?.trim();

    setLoadingDay(requestedDay || "current");
    setIsLoading(true);
    setError(null);

    try {
      const paintedEventsResponse = await fetch(
        requestedDay
          ? `/api/painted-events?day=${encodeURIComponent(requestedDay)}`
          : "/api/painted-events",
      );
      const data = await paintedEventsResponse.json();

      if (!paintedEventsResponse.ok) {
        throw new Error(data.error ?? "Failed to fetch Painted events");
      }

      const themeData = await fetchBasepaintTheme(data.day);

      setSelectedEventIndex(null);
      setActiveDay(data.day);
      setTheme(themeData);
      setPalette(themeData.palette);
      setEvents(data.events);
    } catch (fetchError) {
      setSelectedEventIndex(null);
      setEvents([]);
      setTheme(null);
      setPalette(basePalette);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to fetch Painted events",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <main className="h-[100dvh] overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="flex h-full flex-col">
        <header className="border-b border-zinc-800 bg-zinc-900/95 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-normal text-white">
                Painted Event Snapshots
              </h1>
            </div>

            <DaySearchForm
              defaultDay={activeDay}
              isLoading={isLoading}
              onFetch={fetchEvents}
            />
          </div>

          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-xs text-zinc-500">Events</div>
                <div className="font-mono text-lg text-white">{events.length}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Painted pixels</div>
                <div className="font-mono text-lg text-white">
                  {stats.totalPixels.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Authors</div>
                <div className="font-mono text-lg text-white">
                  {stats.authorCount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Frame</div>
                <div className="inline-flex rounded border border-zinc-700 p-0.5">
                  {(["tight", "full"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFrameMode(mode)}
                      className={`h-7 px-3 text-xs font-semibold capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                        frameMode === mode
                          ? "bg-zinc-100 text-zinc-950"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs text-zinc-500">{paletteName}</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(palette).map(([index, color]) => (
                  <div
                    key={index}
                    className="h-7 w-7 rounded border border-zinc-600"
                    style={{ backgroundColor: color }}
                    title={`${index}: ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          {error ? (
            <div className="rounded border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
              <ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" />
              Fetching Painted events for day {loadingDay || activeDay}
            </div>
          ) : null}

          {!isLoading && !error && events.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
              No Painted events loaded.
            </div>
          ) : null}

          {!isLoading && events.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {events.map((event, index) => (
                <PaintEventCard
                  key={`${event.transactionHash}-${event.logIndex}`}
                  event={event}
                  frameMode={frameMode}
                  palette={palette}
                  index={index}
                  onOpenEvent={openEvent}
                />
              ))}
            </div>
          ) : null}
        </section>

        {selectedEvent && selectedEventIndex !== null ? (
          <PaintEventModal
            key={`${selectedEvent.transactionHash}-${selectedEvent.logIndex}-${frameMode}`}
            event={selectedEvent}
            frameMode={frameMode}
            palette={palette}
            index={selectedEventIndex}
            onClose={closeModal}
          />
        ) : null}
      </div>
    </main>
  );
}
