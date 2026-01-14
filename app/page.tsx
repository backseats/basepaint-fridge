'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  closestCenter,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface PaintedEvent {
  day: string;
  tokenId: string;
  author: string;
  pixels: string;
  blockNumber: string;
  transactionHash: string;
}

// Color palette for Base Paint (indices 0-7)
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
  };

  const handleClick = () => {
    console.log('Magnet clicked:', event.transactionHash);
  };

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? {} : style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
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

interface PlacedMagnet extends PaintedEvent {
  x: number;
  y: number;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const [events, setEvents] = useState<PaintedEvent[]>([]);
  const [magnets, setMagnets] = useState<PaintedEvent[]>([]);
  const [placedMagnets, setPlacedMagnets] = useState<PlacedMagnet[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedMagnet, setDraggedMagnet] = useState<PaintedEvent | null>(null);

  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: 'canvas-drop-zone',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const loadMagnets = async () => {
    try {
      const response = await fetch('/api/magnets');
      const data = await response.json();
      setMagnets(data);
    } catch (error) {
      console.error('Failed to load magnets:', error);
    }
  };

  useEffect(() => {
    loadMagnets();
  }, []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with cyan background
    ctx.fillStyle = '#49e7ec';
    ctx.fillRect(0, 0, 256, 256);

    // Render masked canvas (base layer with magnet pixels as cyan)
    if (events.length > 0) {
      const hexString = events[0].pixels;

      for (let i = 0; i < hexString.length; i += 6) {
        const xHex = hexString.slice(i, i + 2);
        const yHex = hexString.slice(i + 2, i + 4);
        const colorHex = hexString.slice(i + 4, i + 6);

        const x = parseInt(xHex, 16);
        const y = parseInt(yHex, 16);
        const colorIndex = parseInt(colorHex, 16);

        const color = palette[colorIndex] || '#49e7ec';
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Render placed magnets on top
    placedMagnets.forEach((magnet) => {
      const hexString = magnet.pixels;
      const pixels: { x: number; y: number; colorIndex: number }[] = [];

      // Parse all pixels and find bounding box
      let minX = 256, minY = 256, maxX = 0, maxY = 0;

      for (let i = 0; i < hexString.length; i += 6) {
        const xHex = hexString.slice(i, i + 2);
        const yHex = hexString.slice(i + 2, i + 4);
        const colorHex = hexString.slice(i + 4, i + 6);

        const pixelX = parseInt(xHex, 16);
        const pixelY = parseInt(yHex, 16);
        const colorIndex = parseInt(colorHex, 16);

        pixels.push({ x: pixelX, y: pixelY, colorIndex });

        minX = Math.min(minX, pixelX);
        minY = Math.min(minY, pixelY);
        maxX = Math.max(maxX, pixelX);
        maxY = Math.max(maxY, pixelY);
      }

      // Render pixels relative to the bounding box and drop position
      pixels.forEach(({ x: pixelX, y: pixelY, colorIndex }) => {
        // Offset by the bounding box min to normalize, then add drop position
        const finalX = magnet.x + (pixelX - minX);
        const finalY = magnet.y + (pixelY - minY);

        // Only draw if within canvas bounds
        if (finalX >= 0 && finalX < 256 && finalY >= 0 && finalY < 256) {
          const color = palette[colorIndex] || '#49e7ec';
          ctx.fillStyle = color;
          ctx.fillRect(finalX, finalY, 1, 1);
        }
      });
    });
  }, [events, placedMagnets]);

  useEffect(() => {
    const loadAndRenderPixels = async () => {
      const response = await fetch('/masked-canvas.json');
      const data = await response.json();
      // Store as single event with the masked pixel string
      setEvents([{ pixels: data.pixels } as PaintedEvent]);
    };

    loadAndRenderPixels();
  }, []);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Track mouse position globally during drag
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

    // Initialize mouse position from activator event
    const activator = event.activatorEvent as PointerEvent;
    if (activator) {
      mousePositionRef.current = { x: activator.clientX, y: activator.clientY };
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;

    console.log('Drag ended:', { over: over?.id, hasMagnet: !!draggedMagnet, hasMousePos: !!mousePositionRef.current });

    if (over && over.id === 'canvas-drop-zone' && draggedMagnet && mousePositionRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.log('No canvas ref');
        setIsDragging(false);
        setDraggedMagnet(null);
        mousePositionRef.current = null;
        return;
      }

      const rect = canvas.getBoundingClientRect();

      // Calculate the actual rendered size with objectFit: contain
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      const aspectRatio = 1; // Square canvas

      let renderedWidth, renderedHeight, offsetX, offsetY;

      if (containerWidth / containerHeight > aspectRatio) {
        renderedHeight = containerHeight;
        renderedWidth = containerHeight * aspectRatio;
        offsetX = (containerWidth - renderedWidth) / 2;
        offsetY = 0;
      } else {
        renderedWidth = containerWidth;
        renderedHeight = containerWidth / aspectRatio;
        offsetX = 0;
        offsetY = (containerHeight - renderedHeight) / 2;
      }

      // Get drop position relative to the rendered canvas
      const canvasX = mousePositionRef.current.x - rect.left - offsetX;
      const canvasY = mousePositionRef.current.y - rect.top - offsetY;

      console.log('Drop position:', { canvasX, canvasY, renderedWidth, renderedHeight, rect });

      // Check if drop is within the rendered canvas
      if (canvasX >= 0 && canvasX <= renderedWidth && canvasY >= 0 && canvasY <= renderedHeight) {
        // Convert to pixel coordinates
        const pixelX = Math.floor((canvasX / renderedWidth) * canvas.width);
        const pixelY = Math.floor((canvasY / renderedHeight) * canvas.height);

        console.log('Placing magnet at pixel coords:', pixelX, pixelY);

        // Add the magnet to placed magnets
        const placedMagnet: PlacedMagnet = {
          ...draggedMagnet,
          x: pixelX,
          y: pixelY,
        };

        setPlacedMagnets((prev) => {
          const newMagnets = [...prev, placedMagnet];
          console.log('Total placed magnets:', newMagnets.length);
          return newMagnets;
        });
      } else {
        console.log('Drop was outside canvas bounds');
      }
    }

    setIsDragging(false);
    setDraggedMagnet(null);
    mousePositionRef.current = null;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-screen w-screen bg-zinc-900">
        <div className="flex flex-1 min-h-0">
          {/* Canvas side */}
          <div
            ref={setDroppableRef}
            className={`flex-1 flex items-center justify-center p-4 transition-all ${
              isOver ? 'bg-zinc-800' : ''
            }`}
          >
            <canvas
              ref={canvasRef}
              width={256}
              height={256}
              className={`transition-all ${
                isOver ? 'border-4 border-blue-500' : ''
              }`}
              style={{
                imageRendering: 'pixelated',
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          </div>

          {/* Sidebar - Saved Magnets */}
          <div className="w-80 bg-zinc-800 p-4 overflow-auto flex-shrink-0">
            {magnets.length === 0 ? (
              <p className="text-zinc-400 text-sm">No magnets saved yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {magnets.slice().reverse().map((magnet, idx) => (
                  <MagnetPreview key={idx} event={magnet} isDragging={isDragging && draggedMagnet?.transactionHash === magnet.transactionHash} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {isDragging && draggedMagnet ? (
          <div className="opacity-90 shadow-xl transform scale-105">
            <MagnetPreview event={draggedMagnet} isDragging={true} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
