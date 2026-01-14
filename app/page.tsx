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
        className="max-h-28 border-2 border-zinc-700 rounded hover:border-blue-500 transition-colors"
        style={{
          imageRendering: 'pixelated',
          width: 'auto',
          height: 'auto',
          maxWidth: '100%',
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
  scale: number;
}

interface CanvasTargetProps {
  borderColor: string;
  pixelData: Map<string, number>;
  placedMagnets: PlacedMagnet[];
  isShiftHeld: boolean;
  hoveredMagnetIndex: number | null;
  onHoverMagnet: (index: number) => void;
  onHoverEndMagnet: () => void;
  onResizeMagnet: (index: number, newScale: number) => void;
  onRepositionMagnet: (index: number, newX: number, newY: number) => void;
  onDeleteMagnet: (index: number) => void;
}

function CanvasTarget({ borderColor, pixelData, placedMagnets, isShiftHeld, hoveredMagnetIndex, onHoverMagnet, onHoverEndMagnet, onResizeMagnet, onRepositionMagnet, onDeleteMagnet }: CanvasTargetProps) {
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
        <PlacedMagnetBox
          key={idx}
          index={idx}
          placed={placed}
          isShiftHeld={isShiftHeld}
          isHovered={hoveredMagnetIndex === idx}
          onHover={onHoverMagnet}
          onHoverEnd={onHoverEndMagnet}
          onResize={(newScale) => onResizeMagnet(idx, newScale)}
          onReposition={(newX, newY) => onRepositionMagnet(idx, newX, newY)}
          onDelete={() => onDeleteMagnet(idx)}
          canvasRef={canvasRef}
        />
      ))}
    </div>
  );
}

interface PlacedMagnetBoxProps {
  index: number;
  placed: PlacedMagnet;
  isShiftHeld: boolean;
  isHovered: boolean;
  onHover: (index: number) => void;
  onHoverEnd: () => void;
  onResize: (newScale: number) => void;
  onReposition: (newX: number, newY: number) => void;
  onDelete: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

function PlacedMagnetBox({ index, placed, isShiftHeld, isHovered, onHover, onHoverEnd, onResize, onReposition, onDelete, canvasRef: parentCanvasRef }: PlacedMagnetBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const resizeDataRef = useRef<{
    initialScale: number;
    initialDistance: number;
    centerX: number;
    centerY: number;
  } | null>(null);
  const dragDataRef = useRef<{
    initialX: number;
    initialY: number;
    startMouseX: number;
    startMouseY: number;
  } | null>(null);

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

  const handleResizeStart = (e: React.MouseEvent, corner: string) => {
    e.stopPropagation();
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const initialDistance = Math.sqrt(
      Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
    );

    resizeDataRef.current = {
      initialScale: placed.scale,
      initialDistance,
      centerX,
      centerY,
    };

    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeDataRef.current) return;

      const { initialScale, initialDistance, centerX, centerY } = resizeDataRef.current;

      const currentDistance = Math.sqrt(
        Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
      );

      const scaleRatio = currentDistance / initialDistance;
      const newScale = initialScale * scaleRatio;

      onResize(newScale);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeDataRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize]);

  // Handle dragging for repositioning
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragDataRef.current || !parentCanvasRef.current) return;

      const { initialX, initialY, startMouseX, startMouseY } = dragDataRef.current;
      const canvas = parentCanvasRef.current;
      const rect = canvas.getBoundingClientRect();

      // Calculate mouse delta
      const deltaX = e.clientX - startMouseX;
      const deltaY = e.clientY - startMouseY;

      // Convert delta to pixel coordinates (canvas is 256x256)
      const pixelDeltaX = (deltaX / rect.width) * 256;
      const pixelDeltaY = (deltaY / rect.height) * 256;

      const newX = Math.max(0, Math.min(256, initialX + pixelDeltaX));
      const newY = Math.max(0, Math.min(256, initialY + pixelDeltaY));

      onReposition(newX, newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragDataRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onReposition, parentCanvasRef]);

  // Close context menu on click outside
  useEffect(() => {
    if (!showContextMenu) return;

    const handleClick = () => setShowContextMenu(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [showContextMenu]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (isShiftHeld) return; // Don't drag when resizing

    e.preventDefault();
    e.stopPropagation();

    dragDataRef.current = {
      initialX: placed.x,
      initialY: placed.y,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    };

    setIsDragging(true);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleDeleteClick = () => {
    setShowContextMenu(false);
    onDelete();
  };

  const showHandles = isShiftHeld && isHovered;
  const baseHeight = 60;
  const scaledHeight = baseHeight * placed.scale;

  return (
    <>
      <div
        ref={containerRef}
        className="absolute"
        style={{
          left: `${(placed.x / 256) * 100}%`,
          top: `${(placed.y / 256) * 100}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          pointerEvents: 'auto',
          cursor: isDragging ? 'grabbing' : isShiftHeld ? 'default' : 'grab',
        }}
        onMouseEnter={() => onHover(index)}
        onMouseLeave={onHoverEnd}
        onMouseDown={handleDragStart}
        onContextMenu={handleContextMenu}
      >
        <canvas
          ref={canvasRef}
          style={{
            height: `${scaledHeight}px`,
            imageRendering: 'pixelated',
            display: 'block',
          }}
          title={`Token #${placed.magnet.tokenId}`}
        />

        {/* Corner handles */}
        {showHandles && (
          <>
            {/* Top-left */}
            <div
              className="absolute w-2 h-2 bg-white rounded-full cursor-nwse-resize"
              style={{ left: '-4px', top: '-4px' }}
              onMouseDown={(e) => handleResizeStart(e, 'tl')}
            />
            {/* Top-right */}
            <div
              className="absolute w-2 h-2 bg-white rounded-full cursor-nesw-resize"
              style={{ right: '-4px', top: '-4px' }}
              onMouseDown={(e) => handleResizeStart(e, 'tr')}
            />
            {/* Bottom-left */}
            <div
              className="absolute w-2 h-2 bg-white rounded-full cursor-nesw-resize"
              style={{ left: '-4px', bottom: '-4px' }}
              onMouseDown={(e) => handleResizeStart(e, 'bl')}
            />
            {/* Bottom-right */}
            <div
              className="absolute w-2 h-2 bg-white rounded-full cursor-nwse-resize"
              style={{ right: '-4px', bottom: '-4px' }}
              onMouseDown={(e) => handleResizeStart(e, 'br')}
            />
          </>
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed bg-zinc-800 border border-zinc-700 rounded shadow-lg py-1 z-50"
          style={{
            left: `${contextMenuPos.x}px`,
            top: `${contextMenuPos.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-white hover:bg-zinc-700 transition-colors"
            onClick={handleDeleteClick}
          >
            Delete
          </button>
        </div>
      )}
    </>
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
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const [hoveredMagnetIndex, setHoveredMagnetIndex] = useState<number | null>(null);
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

  // Track shift key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleResizeMagnet = (index: number, newScale: number) => {
    setPlacedMagnets(prev => prev.map((m, i) =>
      i === index ? { ...m, scale: Math.max(0.1, newScale) } : m
    ));
  };

  const handleRepositionMagnet = (index: number, newX: number, newY: number) => {
    setPlacedMagnets(prev => prev.map((m, i) =>
      i === index ? { ...m, x: newX, y: newY } : m
    ));
  };

  const handleDeleteMagnet = (index: number) => {
    setPlacedMagnets(prev => prev.filter((_, i) => i !== index));
  };

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
            scale: 1,
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
      <div className="flex flex-col h-screen bg-zinc-900">
        {/* Canvas Area - Centered */}
        <div className="flex-1 flex items-center justify-center p-8">
          <CanvasTarget
            borderColor={borderColor}
            pixelData={pixelData}
            placedMagnets={placedMagnets}
            isShiftHeld={isShiftHeld}
            hoveredMagnetIndex={hoveredMagnetIndex}
            onHoverMagnet={setHoveredMagnetIndex}
            onHoverEndMagnet={() => setHoveredMagnetIndex(null)}
            onResizeMagnet={handleResizeMagnet}
            onRepositionMagnet={handleRepositionMagnet}
            onDeleteMagnet={handleDeleteMagnet}
          />
        </div>

        {/* Bottom Drawer - Magnets Grid (2 rows x N columns, horizontally scrollable) */}
        <div className="h-64 bg-zinc-800 border-t border-zinc-700 overflow-x-auto overflow-y-hidden p-4">
          <div className="grid grid-flow-col gap-4 h-full" style={{ gridTemplateRows: '1fr 1fr', gridAutoColumns: '140px' }}>
            {magnets.map((magnet, idx) => (
              <div key={idx} className="flex items-center justify-center">
                <MagnetPreview event={magnet} />
              </div>
            ))}
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
