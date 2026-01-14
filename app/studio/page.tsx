'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Color palette
const palette: { [key: number]: string } = {
  0: '#49e7ec',
  1: '#3368dc',
  2: '#2b0f54',
  3: '#ab1f65',
  4: '#ff4f69',
  5: '#ff8142',
  6: '#ffda45',
  7: '#fff7f8',
};

// Available paint colors
const paintColors = [
  { hex: '#FFF7F8', index: 7, name: 'White' },
  { hex: '#49E7EC', index: 0, name: 'Cyan' },
  { hex: '#3368DC', index: 1, name: 'Blue' },
  { hex: '#2B0F54', index: 2, name: 'Purple' },
];

const brushSizes = [1, 2, 3, 5, 7];

export default function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pixelData, setPixelData] = useState<Map<string, number>>(new Map());
  const [selectedColor, setSelectedColor] = useState(0); // Default to cyan
  const [brushSize, setBrushSize] = useState(1);
  const [isPainting, setIsPainting] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  useEffect(() => {
    loadCanvas();
  }, []);

  useEffect(() => {
    renderCanvas();
  }, [pixelData, showGrid]);

  const loadCanvas = async () => {
    try {
      const response = await fetch('/masked-canvas.json');
      const data = await response.json();

      // Parse the pixel string into a map
      const hexString = data.pixels;
      const newPixelData = new Map<string, number>();

      for (let i = 0; i < hexString.length; i += 6) {
        const xHex = hexString.slice(i, i + 2);
        const yHex = hexString.slice(i + 2, i + 4);
        const colorHex = hexString.slice(i + 4, i + 6);

        const x = parseInt(xHex, 16);
        const y = parseInt(yHex, 16);
        const colorIndex = parseInt(colorHex, 16);

        newPixelData.set(`${x},${y}`, colorIndex);
      }

      setPixelData(newPixelData);
    } catch (error) {
      console.error('Failed to load canvas:', error);
    }
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with cyan background
    ctx.fillStyle = '#49e7ec';
    ctx.fillRect(0, 0, 256, 256);

    // Render all pixels
    pixelData.forEach((colorIndex, coordKey) => {
      const [x, y] = coordKey.split(',').map(Number);
      const color = palette[colorIndex] || '#49e7ec';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });

    // Draw grid if enabled
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;

      // Vertical lines
      for (let x = 0; x <= 256; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y <= 256; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
    }
  };

  const getPixelCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = Math.floor((e.clientX - rect.left) * scaleX);
    const clickY = Math.floor((e.clientY - rect.top) * scaleY);

    if (clickX < 0 || clickX >= 256 || clickY < 0 || clickY >= 256) {
      return null;
    }

    return { x: clickX, y: clickY };
  };

  const paintPixels = (centerX: number, centerY: number) => {
    const newPixelData = new Map(pixelData);
    const radius = Math.floor(brushSize / 2);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;

        // Check if within canvas bounds
        if (x >= 0 && x < 256 && y >= 0 && y < 256) {
          // For circular brush (optional)
          if (brushSize > 1) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > radius) continue;
          }

          newPixelData.set(`${x},${y}`, selectedColor);
        }
      }
    }

    setPixelData(newPixelData);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPainting(true);
    const coords = getPixelCoordinates(e);
    if (coords) {
      paintPixels(coords.x, coords.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPainting) return;
    const coords = getPixelCoordinates(e);
    if (coords) {
      paintPixels(coords.x, coords.y);
    }
  };

  const handleMouseUp = () => {
    setIsPainting(false);
  };

  const handleMouseLeave = () => {
    setIsPainting(false);
  };

  const exportCanvas = () => {
    // Convert pixel data back to hex string
    let pixelString = '';
    const sortedCoords = Array.from(pixelData.keys()).sort((a, b) => {
      const [ax, ay] = a.split(',').map(Number);
      const [bx, by] = b.split(',').map(Number);
      if (ay !== by) return ay - by;
      return ax - bx;
    });

    sortedCoords.forEach((coordKey) => {
      const [x, y] = coordKey.split(',').map(Number);
      const colorIndex = pixelData.get(coordKey) || 0;

      const xHex = x.toString(16).padStart(2, '0');
      const yHex = y.toString(16).padStart(2, '0');
      const colorHex = colorIndex.toString(16).padStart(2, '0');

      pixelString += xHex + yHex + colorHex;
    });

    const output = {
      description: 'Modified canvas from studio',
      pixels: pixelString,
      totalPixels: pixelData.size,
      timestamp: new Date().toISOString(),
    };

    // Download as JSON
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white hover:text-blue-400 transition-colors">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-white">Canvas Studio</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
              showGrid
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-white'
            }`}
          >
            {showGrid ? 'Hide Grid' : 'Show Grid'}
          </button>
          <button
            onClick={exportCanvas}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors"
          >
            Export Canvas
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <canvas
            ref={canvasRef}
            width={256}
            height={256}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className="border-2 border-white cursor-crosshair"
            style={{
              imageRendering: 'pixelated',
              width: '800px',
              height: '800px',
            }}
          />
        </div>

        {/* Sidebar - Tools */}
        <div className="w-64 bg-zinc-800 p-4 overflow-auto flex-shrink-0">
          <div className="space-y-6">
            {/* Color Palette */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Color</h3>
              <div className="grid grid-cols-2 gap-2">
                {paintColors.map((color) => (
                  <button
                    key={color.index}
                    onClick={() => setSelectedColor(color.index)}
                    className={`h-12 rounded border-2 transition-all ${
                      selectedColor === color.index
                        ? 'border-blue-500 scale-105'
                        : 'border-zinc-600 hover:border-zinc-500'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
              <div className="mt-2 text-xs text-zinc-400 text-center">
                {paintColors.find(c => c.index === selectedColor)?.name}
              </div>
            </div>

            {/* Brush Size */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Brush Size</h3>
              <div className="space-y-2">
                {brushSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setBrushSize(size)}
                    className={`w-full py-2 px-3 text-sm rounded transition-colors ${
                      brushSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-700 text-white hover:bg-zinc-600'
                    }`}
                  >
                    {size}x{size} pixels
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="pt-4 border-t border-zinc-700">
              <h3 className="text-sm font-semibold text-white mb-2">Info</h3>
              <div className="text-xs text-zinc-400 space-y-1">
                <div>Total pixels: {pixelData.size}</div>
                <div>Canvas: 256x256</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
