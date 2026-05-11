"use client";

import {
  ArrowDownTrayIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ClipboardDocumentIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  MouseEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Palette = Record<number, string>;
type PointerMode = "paint" | "erase";

interface Pixel {
  x: number;
  y: number;
  colorIndex: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

const basePalette: Palette = {
  0: "#49e7ec",
  1: "#3368dc",
  2: "#2b0f54",
  3: "#ab1f65",
  4: "#ff4f69",
  5: "#ff8142",
  6: "#ffda45",
  7: "#fff7f8",
};

const day1006Palette: Palette = {
  0: "#1f070b",
  1: "#39203f",
  2: "#3d3e50",
  3: "#4a7f7c",
  4: "#24965f",
  5: "#b7ba99",
  6: "#91f8a7",
  7: "#f7f6a6",
  8: "#1d3c91",
  9: "#674d9c",
  10: "#7182bb",
  11: "#19bdc4",
  12: "#7f123f",
  13: "#b9153d",
  14: "#a94443",
  15: "#bd8053",
};

const palettesByDay: Record<string, Palette> = {
  "1006": day1006Palette,
};

const historyLimit = 100;

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

function pixelBounds(pixels: Pixel[]): Bounds {
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

function pixelKey(x: number, y: number) {
  return `${x},${y}`;
}

function pixelMapFromPixels(pixels: Pixel[]) {
  const map = new Map<string, number>();

  for (const pixel of pixels) {
    map.set(pixelKey(pixel.x, pixel.y), pixel.colorIndex);
  }

  return map;
}

function clonePixelMap(pixelMap: Map<string, number>) {
  return new Map(pixelMap);
}

function pixelMapsEqual(
  firstMap: Map<string, number>,
  secondMap: Map<string, number>,
) {
  if (firstMap.size !== secondMap.size) return false;

  for (const [coord, colorIndex] of firstMap) {
    if (secondMap.get(coord) !== colorIndex) return false;
  }

  return true;
}

function encodePixels(pixelMap: Map<string, number>) {
  return Array.from(pixelMap.entries())
    .sort(([coordA], [coordB]) => {
      const [ax, ay] = coordA.split(",").map(Number);
      const [bx, by] = coordB.split(",").map(Number);
      return ay === by ? ax - bx : ay - by;
    })
    .map(([coord, colorIndex]) => {
      const [x, y] = coord.split(",").map(Number);
      return (
        x.toString(16).padStart(2, "0") +
        y.toString(16).padStart(2, "0") +
        colorIndex.toString(16).padStart(2, "0")
      );
    })
    .join("");
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, "image/png");
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

export default function PaintStudioClient({
  initialBytes,
  initialDay,
}: {
  initialBytes: string;
  initialDay: string;
}) {
  const [bytes] = useState(initialBytes);
  const [day] = useState(initialDay);
  const [selectedColor, setSelectedColor] = useState(0);
  const [cellSize, setCellSize] = useState(14);
  const [pointerMode, setPointerMode] = useState<PointerMode | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [removeColorIndex, setRemoveColorIndex] = useState(selectedColor);
  const [pixelMap, setPixelMapState] = useState<Map<string, number>>(() =>
    pixelMapFromPixels(decodePixels(initialBytes)),
  );
  const [undoStack, setUndoStack] = useState<Map<string, number>[]>([]);
  const [redoStack, setRedoStack] = useState<Map<string, number>[]>([]);
  const pixelMapRef = useRef(pixelMap);
  const undoStackRef = useRef(undoStack);
  const redoStackRef = useRef(redoStack);
  const pointerStartMapRef = useRef<Map<string, number> | null>(null);

  const pixels = useMemo(() => decodePixels(bytes), [bytes]);
  const bounds = useMemo(() => pixelBounds(pixels), [pixels]);
  const palette = palettesByDay[day] ?? basePalette;
  const encodedBytes = useMemo(() => encodePixels(pixelMap), [pixelMap]);
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const colorCounts = useMemo(() => {
    const counts = new Map<number, number>();

    pixelMap.forEach((colorIndex) => {
      counts.set(colorIndex, (counts.get(colorIndex) ?? 0) + 1);
    });

    return counts;
  }, [pixelMap]);
  const removalCount = colorCounts.get(removeColorIndex) ?? 0;
  const removalCellLabel = removalCount === 1 ? "cell" : "cells";
  const cells = useMemo(() => {
    const nextCells: Array<{ x: number; y: number; colorIndex: number | null }> =
      [];

    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        nextCells.push({
          x,
          y,
          colorIndex: pixelMap.get(pixelKey(x, y)) ?? null,
        });
      }
    }

    return nextCells;
  }, [bounds, pixelMap]);

  const replacePixelMap = useCallback((nextMap: Map<string, number>) => {
    pixelMapRef.current = nextMap;
    setPixelMapState(nextMap);
  }, []);

  const setUndoHistory = useCallback((nextStack: Map<string, number>[]) => {
    undoStackRef.current = nextStack;
    setUndoStack(nextStack);
  }, []);

  const setRedoHistory = useCallback((nextStack: Map<string, number>[]) => {
    redoStackRef.current = nextStack;
    setRedoStack(nextStack);
  }, []);

  const commitHistoryEntry = useCallback(
    (beforeMap: Map<string, number>, afterMap: Map<string, number>) => {
      if (pixelMapsEqual(beforeMap, afterMap)) return false;

      setUndoHistory([
        ...undoStackRef.current.slice(-(historyLimit - 1)),
        clonePixelMap(beforeMap),
      ]);
      setRedoHistory([]);
      return true;
    },
    [setRedoHistory, setUndoHistory],
  );

  const updatePixelMapDraft = useCallback(
    (mutate: (draftMap: Map<string, number>) => void) => {
      const nextMap = clonePixelMap(pixelMapRef.current);

      mutate(nextMap);

      if (pixelMapsEqual(pixelMapRef.current, nextMap)) return false;

      replacePixelMap(nextMap);
      return true;
    },
    [replacePixelMap],
  );

  const applyCommittedPixelMapChange = useCallback(
    (mutate: (draftMap: Map<string, number>) => void) => {
      const beforeMap = pixelMapRef.current;
      const nextMap = clonePixelMap(beforeMap);

      mutate(nextMap);

      if (!commitHistoryEntry(beforeMap, nextMap)) return false;

      replacePixelMap(nextMap);
      return true;
    },
    [commitHistoryEntry, replacePixelMap],
  );

  const undo = useCallback(() => {
    const previousMap =
      undoStackRef.current[undoStackRef.current.length - 1] ?? null;
    if (!previousMap) return;

    setUndoHistory(undoStackRef.current.slice(0, -1));
    setRedoHistory([
      ...redoStackRef.current.slice(-(historyLimit - 1)),
      clonePixelMap(pixelMapRef.current),
    ]);
    replacePixelMap(clonePixelMap(previousMap));
  }, [replacePixelMap, setRedoHistory, setUndoHistory]);

  const redo = useCallback(() => {
    const nextMap = redoStackRef.current[redoStackRef.current.length - 1] ?? null;
    if (!nextMap) return;

    setRedoHistory(redoStackRef.current.slice(0, -1));
    setUndoHistory([
      ...undoStackRef.current.slice(-(historyLimit - 1)),
      clonePixelMap(pixelMapRef.current),
    ]);
    replacePixelMap(clonePixelMap(nextMap));
  }, [replacePixelMap, setRedoHistory, setUndoHistory]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isRemoveDialogOpen && event.key === "Escape") {
        setIsRemoveDialogOpen(false);
        return;
      }

      if (
        event.key.toLowerCase() === "z" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();

        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRemoveDialogOpen, redo, undo]);

  const paintCell = useCallback(
    (x: number, y: number) => {
      updatePixelMapDraft((draftMap) => {
        draftMap.set(pixelKey(x, y), selectedColor);
      });
    },
    [selectedColor, updatePixelMapDraft],
  );

  const eraseCell = useCallback(
    (x: number, y: number) => {
      updatePixelMapDraft((draftMap) => {
        draftMap.delete(pixelKey(x, y));
      });
    },
    [updatePixelMapDraft],
  );

  const paintFromPointer = useCallback(
    (event: PointerEvent<HTMLElement>, mode: PointerMode) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const cell = target?.closest<HTMLElement>("[data-cell]");
      if (!cell) return;

      const x = Number(cell.dataset.x);
      const y = Number(cell.dataset.y);
      if (Number.isNaN(x) || Number.isNaN(y)) return;

      if (mode === "erase") {
        eraseCell(x, y);
        return;
      }

      paintCell(x, y);
    },
    [eraseCell, paintCell],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextMode: PointerMode = event.button === 2 ? "erase" : "paint";

    pointerStartMapRef.current = clonePixelMap(pixelMapRef.current);
    setPointerMode(nextMode);
    paintFromPointer(event, nextMode);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointerMode) return;
    paintFromPointer(event, pointerMode);
  };

  const handlePointerUp = () => {
    if (pointerStartMapRef.current) {
      commitHistoryEntry(pointerStartMapRef.current, pixelMapRef.current);
      pointerStartMapRef.current = null;
    }

    setPointerMode(null);
  };

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const cell = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-cell]",
    );
    if (!cell) return;

    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    if (Number.isNaN(x) || Number.isNaN(y)) return;

    applyCommittedPixelMapChange((draftMap) => {
      draftMap.delete(pixelKey(x, y));
    });
  };

  const openRemoveDialog = () => {
    setRemoveColorIndex(selectedColor);
    setIsRemoveDialogOpen(true);
  };

  const removeColor = () => {
    applyCommittedPixelMapChange((draftMap) => {
      Array.from(draftMap.entries()).forEach(([coord, colorIndex]) => {
        if (colorIndex === removeColorIndex) {
          draftMap.delete(coord);
        }
      });
    });
    setIsRemoveDialogOpen(false);
  };

  const copyBytes = async () => {
    await navigator.clipboard.writeText(encodedBytes);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const downloadPng = () => {
    const scale = 8;
    const canvas = document.createElement("canvas");
    canvas.width = bounds.width * scale;
    canvas.height = bounds.height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, bounds.width, bounds.height);

    pixelMap.forEach((colorIndex, coord) => {
      const [x, y] = coord.split(",").map(Number);
      ctx.fillStyle = palette[colorIndex] ?? "#49e7ec";
      ctx.fillRect(x - bounds.minX, y - bounds.minY, 1, 1);
    });

    downloadCanvas(canvas, `basepaint-edit-${day || "event"}@${scale}x.png`);
  };

  const downloadSvg = () => {
    const rects = Array.from(pixelMap.entries())
      .map(([coord, colorIndex]) => {
        const [x, y] = coord.split(",").map(Number);
        return `<rect x="${x - bounds.minX}" y="${
          y - bounds.minY
        }" width="1" height="1" fill="${
          palette[colorIndex] ?? "#49e7ec"
        }" />`;
      })
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}" shape-rendering="crispEdges">${rects}</svg>`;

    downloadTextFile(
      svg,
      `basepaint-edit-${day || "event"}.svg`,
      "image/svg+xml;charset=utf-8",
    );
  };

  return (
    <main className="h-[100dvh] overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="flex h-full flex-col">
        <header className="border-b border-zinc-800 bg-zinc-900 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-end">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                  Color
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(palette).map(([index, color]) => {
                    const colorIndex = Number(index);

                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedColor(colorIndex)}
                        className={`h-8 w-8 rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                          selectedColor === colorIndex
                            ? "border-white"
                            : "border-zinc-600"
                        }`}
                        style={{ backgroundColor: color }}
                        title={`${index}: ${color}`}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                  Zoom
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCellSize((size) => Math.max(4, size - 2))}
                    className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 text-zinc-200 transition-colors hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    title="Smaller cells"
                  >
                    <MinusIcon className="h-5 w-5" />
                  </button>
                  <div className="h-10 w-16 rounded border border-zinc-700 px-3 py-2 text-center font-mono text-sm text-white">
                    {cellSize}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCellSize((size) => Math.min(40, size + 2))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 text-zinc-200 transition-colors hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    title="Larger cells"
                  >
                    <PlusIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="flex h-10 items-center justify-center gap-2 rounded border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:border-cyan-400 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
                title="Undo (Command-Z)"
              >
                <ArrowUturnLeftIcon className="h-5 w-5" />
                Undo
              </button>

              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="flex h-10 items-center justify-center gap-2 rounded border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:border-cyan-400 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
                title="Redo (Command-Shift-Z)"
              >
                <ArrowUturnRightIcon className="h-5 w-5" />
                Redo
              </button>

              <button
                type="button"
                onClick={openRemoveDialog}
                className="flex h-10 items-center justify-center gap-2 rounded border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:border-red-400 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <TrashIcon className="h-5 w-5" />
                Remove color
              </button>
            </div>
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          <div className="flex min-h-full min-w-full items-center justify-center">
            <div
              className="inline-grid border-l border-t border-zinc-700 bg-zinc-900"
              style={{
                gridTemplateColumns: `repeat(${bounds.width}, ${cellSize}px)`,
                gridAutoRows: `${cellSize}px`,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={handleContextMenu}
            >
              {cells.map(({ x, y, colorIndex }) => (
                <div
                  key={`${x},${y}`}
                  data-cell
                  data-x={x}
                  data-y={y}
                  className="select-none border-b border-r border-zinc-700"
                  style={{
                    backgroundColor:
                      colorIndex === null
                        ? "rgba(9, 9, 11, 0.7)"
                        : palette[colorIndex] ?? "#49e7ec",
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-800 bg-zinc-900 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={copyBytes}
              className="flex h-10 items-center justify-center gap-2 rounded border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:border-cyan-400 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <ClipboardDocumentIcon className="h-5 w-5" />
              {copied ? "Copied" : "Copy bytes"}
            </button>

            <button
              type="button"
              onClick={downloadPng}
              className="flex h-10 items-center justify-center gap-2 rounded bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              PNG
            </button>

            <button
              type="button"
              onClick={downloadSvg}
              className="flex h-10 items-center justify-center gap-2 rounded bg-cyan-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              SVG
            </button>
          </div>
        </footer>
      </div>

      {isRemoveDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-color-title"
          onMouseDown={() => setIsRemoveDialogOpen(false)}
        >
          <div
            className="w-full max-w-md rounded border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="remove-color-title"
                  className="text-lg font-semibold text-white"
                >
                  Remove a color
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Select a palette color and confirm to remove it from the
                  bytes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRemoveDialogOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-700 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                title="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-8 gap-2">
              {Object.entries(palette).map(([index, color]) => {
                const colorIndex = Number(index);
                const count = colorCounts.get(colorIndex) ?? 0;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setRemoveColorIndex(colorIndex)}
                    className={`rounded border p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                      removeColorIndex === colorIndex
                        ? "border-white bg-zinc-800"
                        : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
                    }`}
                    title={`Color ${index}: ${count} ${count === 1 ? "cell" : "cells"}`}
                  >
                    <span
                      className="block h-7 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="mt-1 block text-center font-mono text-[10px] leading-none text-zinc-400">
                      {index}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded border border-zinc-800 bg-zinc-950 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-5 w-5 shrink-0 rounded border border-zinc-700"
                    style={{
                      backgroundColor:
                        palette[removeColorIndex] ?? "transparent",
                    }}
                  />
                  <span className="truncate font-mono text-sm text-zinc-200">
                    {removeColorIndex}:{" "}
                    {palette[removeColorIndex] ?? "unknown"}
                  </span>
                </div>
                <span className="shrink-0 text-sm text-zinc-400">
                  {removalCount} {removalCellLabel}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRemoveDialogOpen(false)}
                className="h-10 rounded border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={removeColor}
                disabled={removalCount === 0}
                className="h-10 rounded bg-red-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-400 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                Remove {removalCount} {removalCellLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
