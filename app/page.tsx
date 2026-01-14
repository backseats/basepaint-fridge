'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Base Paint color palette
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

interface PaintedEvent {
  day: string;
  tokenId: string;
  author: string;
  pixels: string;
  blockNumber: string;
  transactionHash: string;
}

interface MagnetPreviewProps {
  event: PaintedEvent;
  isDragging?: boolean;
}

function MagnetPreview({ event, isDragging = false }: MagnetPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `magnet-${event.transactionHash}`,
    data: event,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Parse all pixels to find bounding box
    const hexString = event.pixels;
    const pixels: { x: number; y: number; color: string }[] = [];
    let minX = 256, minY = 256, maxX = 0, maxY = 0;

    for (let i = 0; i < hexString.length; i += 6) {
      const xHex = hexString.slice(i, i + 2);
      const yHex = hexString.slice(i + 2, i + 4);
      const colorHex = hexString.slice(i + 4, i + 6);

      const x = parseInt(xHex, 16);
      const y = parseInt(yHex, 16);
      const colorIndex = parseInt(colorHex, 16);
      const color = palette[colorIndex] || '#49e7ec';

      pixels.push({ x, y, color });

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    // Add padding
    const padding = 2;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(255, maxX + padding);
    maxY = Math.min(255, maxY + padding);

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    // Set canvas size to bounding box
    canvas.width = width;
    canvas.height = height;

    // Clear with cyan background
    ctx.fillStyle = '#49e7ec';
    ctx.fillRect(0, 0, width, height);

    // Render pixels relative to bounding box
    pixels.forEach(({ x, y, color }) => {
      ctx.fillStyle = color;
      ctx.fillRect(x - minX, y - minY, 1, 1);
    });
  }, [event]);

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex-shrink-0 group relative cursor-grab active:cursor-grabbing"
    >
      <canvas
        ref={canvasRef}
        className="h-24 border-2 border-zinc-700 rounded hover:border-blue-500 transition-colors"
        style={{
          imageRendering: 'pixelated',
        }}
        title={`Token #${event.tokenId} - Drag to canvas`}
      />
    </div>
  );
}

interface PlacedMagnet {
  x: number;
  y: number;
  magnet: PaintedEvent;
}

interface CanvasTargetProps {
  borderColor: string;
  pixelData: Map<string, number>;
  placedMagnets: PlacedMagnet[];
}

function CanvasTarget({ borderColor, pixelData, placedMagnets }: CanvasTargetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isOver, setNodeRef } = useDroppable({
    id: 'target',
  });

  useEffect(() => {
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
  }, [pixelData]);

  return (
    <div ref={setNodeRef} className="relative" style={{ width: '500px', height: '500px' }}>
      <canvas
        ref={canvasRef}
        width={256}
        height={256}
        className={`transition-all border-4 ${
          isOver ? 'scale-105 shadow-2xl' : ''
        }`}
        style={{
          imageRendering: 'pixelated',
          width: '500px',
          height: '500px',
          borderColor: borderColor,
        }}
      />
      {/* Render placed magnets on top */}
      {placedMagnets.map((placed, idx) => (
        <PlacedMagnetBox key={idx} placed={placed} />
      ))}
    </div>
  );
}

interface PlacedMagnetBoxProps {
  placed: PlacedMagnet;
}

function PlacedMagnetBox({ placed }: PlacedMagnetBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const hexString = placed.magnet.pixels;
    const pixels: { x: number; y: number; color: string }[] = [];
    let minX = 256, minY = 256, maxX = 0, maxY = 0;

    for (let i = 0; i < hexString.length; i += 6) {
      const xHex = hexString.slice(i, i + 2);
      const yHex = hexString.slice(i + 2, i + 4);
      const colorHex = hexString.slice(i + 4, i + 6);

      const x = parseInt(xHex, 16);
      const y = parseInt(yHex, 16);
      const colorIndex = parseInt(colorHex, 16);
      const color = palette[colorIndex] || '#49e7ec';

      pixels.push({ x, y, color });

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    canvas.width = width;
    canvas.height = height;

    // Clear canvas to transparent
    ctx.clearRect(0, 0, width, height);

    // Only render the actual pixel art, no background
    pixels.forEach(({ x, y, color }) => {
      ctx.fillStyle = color;
      ctx.fillRect(x - minX, y - minY, 1, 1);
    });
  }, [placed.magnet]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute pointer-events-none"
      style={{
        left: `${(placed.x / 256) * 100}%`,
        top: `${(placed.y / 256) * 100}%`,
        height: '60px',
        imageRendering: 'pixelated',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
      }}
      title={`Token #${placed.magnet.tokenId}`}
    />
  );
}

export default function Home() {
  const [borderColor, setBorderColor] = useState('#ffffff');
  const [lastDroppedName, setLastDroppedName] = useState<string | null>(null);
  const [pixelData, setPixelData] = useState<Map<string, number>>(new Map());
  const [magnets, setMagnets] = useState<PaintedEvent[]>([]);
  const [placedMagnets, setPlacedMagnets] = useState<PlacedMagnet[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedMagnet, setDraggedMagnet] = useState<PaintedEvent | null>(null);
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
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

    loadCanvas();
  }, []);

  useEffect(() => {
    const loadMagnets = async () => {
      try {
        const response = await fetch('/api/magnets');
        const data = await response.json();
        setMagnets(data);
      } catch (error) {
        console.error('Failed to load magnets:', error);
      }
    };

    loadMagnets();
  }, []);

  // Track mouse position during drag
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        mousePositionRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
    }
  }, [isDragging]);

  const handleDragStart = (event: DragStartEvent) => {
    setIsDragging(true);
    const magnetData = event.active.data.current as PaintedEvent;
    setDraggedMagnet(magnetData);
    const activator = event.activatorEvent as PointerEvent;
    if (activator) {
      mousePositionRef.current = { x: activator.clientX, y: activator.clientY };
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;

    if (over && over.id === 'target' && mousePositionRef.current) {
      const magnetData = active.data.current as PaintedEvent;

      console.log('Dropped magnet transaction hash:', magnetData.transactionHash);

      // Use first color from magnet for border (or use cyan as default)
      setBorderColor('#3b82f6');
      setLastDroppedName(`Token #${magnetData.tokenId}`);

      // Get canvas element from the DOM
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();

        // Calculate position relative to canvas
        const canvasX = mousePositionRef.current.x - rect.left;
        const canvasY = mousePositionRef.current.y - rect.top;

        // Check if within bounds
        if (canvasX >= 0 && canvasX <= rect.width && canvasY >= 0 && canvasY <= rect.height) {
          // Convert to pixel coordinates (canvas is 256x256)
          const pixelX = Math.floor((canvasX / rect.width) * 256);
          const pixelY = Math.floor((canvasY / rect.height) * 256);

          console.log('Dropped at position:', { pixelX, pixelY });

          // Add the magnet
          setPlacedMagnets(prev => [...prev, {
            x: pixelX,
            y: pixelY,
            magnet: magnetData,
          }]);
        }
      }
    }

    setIsDragging(false);
    setDraggedMagnet(null);
    mousePositionRef.current = null;
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col min-h-screen bg-zinc-900 p-8">
        <div className="max-w-6xl mx-auto w-full">
          <div className="flex gap-12 items-center justify-center">
            {/* Canvas Target */}
            <div className="flex flex-col items-center gap-4">
              <CanvasTarget borderColor={borderColor} pixelData={pixelData} placedMagnets={placedMagnets} />
            </div>

            {/* Magnets Grid */}
            <div className="w-96 h-[600px] overflow-y-auto bg-zinc-800 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-3">
                {magnets.map((magnet, idx) => (
                  <MagnetPreview key={idx} event={magnet} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null} style={{ zIndex: 1000 }}>
        {isDragging && draggedMagnet ? (
          <div className="opacity-90">
            <MagnetPreview event={draggedMagnet} isDragging={true} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
