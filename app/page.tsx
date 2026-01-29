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
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { XCircleIcon, CameraIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

// BasePaint color palette
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
      className="flex-shrink-0 group relative cursor-grab active:cursor-grabbing touch-none"
    >
      <canvas
        ref={canvasRef}
        className="border-2 border-zinc-700 rounded hover:border-blue-500 transition-colors h-20 md:h-[100px]"
        style={{
          imageRendering: 'pixelated',
          width: 'auto',
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
  resizeButtonsIndex: number | null;
  draggingPlacedMagnetIndex: number | null;
  isOverTrash: boolean;
  onHoverMagnet: (index: number) => void;
  onHoverEndMagnet: () => void;
  onResizeMagnet: (index: number, newScale: number) => void;
  onRepositionMagnet: (index: number, newX: number, newY: number) => void;
  onDeleteMagnet: (index: number) => void;
  onToggleResizeButtons: (index: number) => void;
  onDraggingPlacedMagnet: (index: number | null, touchX?: number, touchY?: number) => void;
  onCheckTrashHover: (touchX: number, touchY: number) => void;
  onClearResizeButtons: () => void;
  canvasRefCallback?: (ref: HTMLCanvasElement | null) => void;
}

function CanvasTarget({ borderColor, pixelData, placedMagnets, isShiftHeld, hoveredMagnetIndex, resizeButtonsIndex, draggingPlacedMagnetIndex, isOverTrash, onHoverMagnet, onHoverEndMagnet, onResizeMagnet, onRepositionMagnet, onDeleteMagnet, onToggleResizeButtons, onDraggingPlacedMagnet, onCheckTrashHover, onClearResizeButtons, canvasRefCallback }: CanvasTargetProps) {
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

    // Notify parent component of canvas ref
    if (canvasRefCallback) {
      canvasRefCallback(canvas);
    }
  }, [pixelData, canvasRefCallback]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Only clear resize buttons on mobile when they're showing
    if (resizeButtonsIndex !== null) {
      onClearResizeButtons();
    }
  };

  return (
    <div
      ref={setNodeRef}
      className="relative w-full aspect-square md:w-[500px] md:h-[500px] md:aspect-auto"
      onClick={handleCanvasClick}
    >
      <canvas
        ref={canvasRef}
        width={256}
        height={256}
        className={`transition-all border-0 md:border-4 ${
          isOver ? 'scale-105 shadow-2xl' : ''
        }`}
        style={{
          imageRendering: 'pixelated',
          width: '100%',
          height: '100%',
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
          showResizeButtons={resizeButtonsIndex === idx}
          onHover={onHoverMagnet}
          onHoverEnd={onHoverEndMagnet}
          onResize={(newScale) => onResizeMagnet(idx, newScale)}
          onReposition={(newX, newY) => onRepositionMagnet(idx, newX, newY)}
          onDelete={() => onDeleteMagnet(idx)}
          onToggleResizeButtons={() => onToggleResizeButtons(idx)}
          onDraggingStart={(index) => onDraggingPlacedMagnet(index)}
          onDraggingEnd={(index, x, y) => onDraggingPlacedMagnet(null, x, y)}
          onCheckTrashHover={onCheckTrashHover}
          canvasRef={canvasRef}
        />
      ))}

      {/* Trash Zone in bottom right of canvas */}
      <TrashZone isDragging={draggingPlacedMagnetIndex !== null} isOver={isOverTrash} />
    </div>
  );
}

interface PlacedMagnetBoxProps {
  index: number;
  placed: PlacedMagnet;
  isShiftHeld: boolean;
  isHovered: boolean;
  showResizeButtons: boolean;
  onHover: (index: number) => void;
  onHoverEnd: () => void;
  onResize: (newScale: number) => void;
  onReposition: (newX: number, newY: number) => void;
  onDelete: () => void;
  onToggleResizeButtons: () => void;
  onDraggingStart: (index: number) => void;
  onDraggingEnd: (index: number, touchX: number, touchY: number) => void;
  onCheckTrashHover: (touchX: number, touchY: number) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

function PlacedMagnetBox({ index, placed, isShiftHeld, isHovered, showResizeButtons, onHover, onHoverEnd, onResize, onReposition, onDelete, onToggleResizeButtons, onDraggingStart, onDraggingEnd, onCheckTrashHover, canvasRef: parentCanvasRef }: PlacedMagnetBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [isTouching, setIsTouching] = useState(false);
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
  const pinchDataRef = useRef<{
    initialScale: number;
    initialDistance: number;
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
    if (!isDragging && !isTouching) return;

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

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragDataRef.current || !parentCanvasRef.current || e.touches.length !== 1) return;

      const { initialX, initialY, startMouseX, startMouseY } = dragDataRef.current;
      const canvas = parentCanvasRef.current;
      const rect = canvas.getBoundingClientRect();

      const touch = e.touches[0];
      const deltaX = touch.clientX - startMouseX;
      const deltaY = touch.clientY - startMouseY;

      // Start dragging if moved more than threshold and not already dragging
      if (!isDragging) {
        const distanceMoved = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distanceMoved > 10) {
          setIsDragging(true);
          onDraggingStart(index);
        } else {
          return; // Don't reposition until threshold is met
        }
      }

      const pixelDeltaX = (deltaX / rect.width) * 256;
      const pixelDeltaY = (deltaY / rect.height) * 256;

      const newX = Math.max(0, Math.min(256, initialX + pixelDeltaX));
      const newY = Math.max(0, Math.min(256, initialY + pixelDeltaY));

      onReposition(newX, newY);

      // Check if over trash zone
      onCheckTrashHover(touch.clientX, touch.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragDataRef.current = null;
      onDraggingEnd(null);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setIsTouching(false);
      dragDataRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, isTouching, onReposition, parentCanvasRef, index, onDraggingStart, onCheckTrashHover]);

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
    onDraggingStart(index);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setTouchStartTime(Date.now());

    if (e.touches.length === 2) {
      // Two-finger pinch to zoom
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      pinchDataRef.current = {
        initialScale: placed.scale,
        initialDistance: distance,
      };

      setIsPinching(true);
    } else if (e.touches.length === 1) {
      // Single-finger - store initial position and mark as touching
      const touch = e.touches[0];
      dragDataRef.current = {
        initialX: placed.x,
        initialY: placed.y,
        startMouseX: touch.clientX,
        startMouseY: touch.clientY,
      };
      setIsTouching(true);
      // Don't set isDragging yet - wait for actual movement
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchDuration = Date.now() - touchStartTime;

    // Check if finger moved significantly from start position
    let movedSignificantly = false;
    let touchX = 0, touchY = 0;
    if (dragDataRef.current && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      touchX = touch.clientX;
      touchY = touch.clientY;
      const deltaX = Math.abs(touch.clientX - dragDataRef.current.startMouseX);
      const deltaY = Math.abs(touch.clientY - dragDataRef.current.startMouseY);
      movedSignificantly = deltaX > 10 || deltaY > 10;
    }

    // If touch was quick (< 200ms) and didn't move much, treat as tap
    if (touchDuration < 200 && !movedSignificantly && !isPinching) {
      e.preventDefault();
      e.stopPropagation();
      onToggleResizeButtons();
    }

    // Notify parent that dragging ended with final position (only if actually dragging)
    if (isDragging) {
      onDraggingEnd(index, touchX, touchY);
    }

    // Clear drag data and reset states
    setIsDragging(false);
    setIsTouching(false);
    dragDataRef.current = null;
    setTouchStartTime(0);
  };

  const handleIncreaseSize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onResize(placed.scale * 1.10);
  };

  const handleDecreaseSize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onResize(placed.scale * 0.90);
  };

  // Handle pinch-to-zoom
  useEffect(() => {
    if (!isPinching) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchDataRef.current) return;

      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const { initialScale, initialDistance } = pinchDataRef.current;
      const scaleRatio = currentDistance / initialDistance;
      const newScale = Math.max(0.1, initialScale * scaleRatio);

      onResize(newScale);
    };

    const handleTouchEnd = () => {
      setIsPinching(false);
      pinchDataRef.current = null;
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPinching, onResize]);

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
        className="absolute touch-none"
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        onClick={(e) => e.stopPropagation()}
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

        {/* Mobile Resize Buttons */}
        {showResizeButtons && (
          <div
            className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 flex gap-2 md:hidden z-50 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-lg select-none"
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDecreaseSize(e);
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleDecreaseSize(e);
              }}
            >
              −
            </button>
            <button
              className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-lg select-none"
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleIncreaseSize(e);
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleIncreaseSize(e);
              }}
            >
              +
            </button>
          </div>
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

function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 text-zinc-100 rounded-lg p-6 max-w-md mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">How to Play</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white -mr-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <XCircleIcon className="w-8 h-8" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="hidden sm:block">
            <ul className="list-disc list-inside space-y-1 text-zinc-300">
              <li>Drag and drop magnets from the drawer onto the canvas</li>
              <li>Hold Shift to resize placed magnets</li>
              <li>Drag to reposition magnets</li>
              <li>Right click a magnet to delete it</li>
              <li>Click the camera to save a screenshot of your canvas to your Downloads</li>
            </ul>
          </div>

          <div className="sm:hidden">
            <ul className="list-disc list-inside space-y-1 text-zinc-300">
              <li>Drag and drop magnets from the drawer onto the canvas</li>
              <li>Tap a placed magnet to show resize buttons (+/-)</li>
              <li>Drag a placed magnet to move it around</li>
              <li>Drag a magnet into the trash to delete it</li>
              <li>Click the camera to save a screenshot of your canvas to your camera roll</li>
            </ul>
          </div>
        </div>

        {/* GitHub Link */}
        <div className="mt-6 pt-4 border-t border-zinc-700 flex justify-center items-center gap-2">
          <span className="text-zinc-400 text-sm">Contribute on</span>
          <a
            href="https://github.com/backseats/basepaint-fridge"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white transition-colors"
            title="View on GitHub"
          >
            <svg
              className="w-8 h-8"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

function TrashZone({ isDragging, isOver }: { isDragging: boolean; isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: 'trash',
  });

  return (
    <div
      ref={setNodeRef}
      data-trash-zone
      className={`absolute bottom-4 right-4 w-16 h-16 md:hidden rounded-full flex items-center justify-center transition-all ${
        isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${
        isOver ? 'bg-zinc-600 scale-125' : isDragging ? 'bg-zinc-700 scale-100' : 'scale-50'
      } z-0 shadow-lg`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="white"
        className="w-8 h-8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
        />
      </svg>
    </div>
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
  const [resizeButtonsIndex, setResizeButtonsIndex] = useState<number | null>(null);
  const [draggingPlacedMagnetIndex, setDraggingPlacedMagnetIndex] = useState<number | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fridgeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
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

  // Track mouse and touch position during drag
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        mousePositionRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        mousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('touchmove', handleGlobalTouchMove);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('touchmove', handleGlobalTouchMove);
      };
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
    if (resizeButtonsIndex === index) {
      setResizeButtonsIndex(null);
    }
  };

  const handleToggleResizeButtons = (index: number) => {
    setResizeButtonsIndex(prev => prev === index ? null : index);
  };

  const handleDraggingPlacedMagnet = (index: number | null, touchX?: number, touchY?: number) => {
    if (index !== null) {
      // Starting to drag a placed magnet
      // Hide resize buttons if dragging a different magnet
      if (resizeButtonsIndex !== null && resizeButtonsIndex !== index) {
        setResizeButtonsIndex(null);
      }
    } else if (index === null && draggingPlacedMagnetIndex !== null && touchX !== undefined && touchY !== undefined) {
      // Ending drag of a placed magnet
      // Check if dropped on trash zone
      const trashZone = document.querySelector('[data-trash-zone]');
      if (trashZone) {
        const rect = trashZone.getBoundingClientRect();
        const isOverTrash = touchX >= rect.left && touchX <= rect.right &&
                           touchY >= rect.top && touchY <= rect.bottom;
        if (isOverTrash) {
          handleDeleteMagnet(draggingPlacedMagnetIndex);
        }
      }
      setIsOverTrash(false);
    }
    setDraggingPlacedMagnetIndex(index);
  };

  const handleCheckTrashHover = (touchX: number, touchY: number) => {
    const trashZone = document.querySelector('[data-trash-zone]');
    if (trashZone) {
      const rect = trashZone.getBoundingClientRect();
      const isOver = touchX >= rect.left && touchX <= rect.right &&
                     touchY >= rect.top && touchY <= rect.bottom;
      setIsOverTrash(isOver);
    }
  };

  const handleCaptureScreenshot = useCallback(async () => {
    if (!fridgeCanvasRef.current) return;

    // Hide resize buttons if they're shown
    setResizeButtonsIndex(null);

    // Wait a tick for the UI to update
    await new Promise(resolve => setTimeout(resolve, 0));

    // Scale factor for output
    const scaleFactor = 4;

    // Create a new canvas for the composite image
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = 256 * scaleFactor;
    compositeCanvas.height = 256 * scaleFactor;
    const ctx = compositeCanvas.getContext('2d');
    if (!ctx) return;

    // Disable image smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false;

    // Draw the fridge background scaled up
    ctx.drawImage(fridgeCanvasRef.current, 0, 0, 256 * scaleFactor, 256 * scaleFactor);

    // Get the canvas display size to calculate proper scaling
    const canvasDisplayRect = fridgeCanvasRef.current.getBoundingClientRect();
    const canvasDisplayHeight = canvasDisplayRect.height;
    const canvasLogicalHeight = 256;
    const displayToCanvasRatio = canvasLogicalHeight / canvasDisplayHeight;

    // Draw each placed magnet
    for (const placed of placedMagnets) {
      // Create a temporary canvas to render the magnet
      const magnetCanvas = document.createElement('canvas');
      const magnetCtx = magnetCanvas.getContext('2d');
      if (!magnetCtx) continue;

      // Parse magnet pixels
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

      magnetCanvas.width = width;
      magnetCanvas.height = height;

      // Render magnet pixels
      pixels.forEach(({ x, y, color }) => {
        magnetCtx.fillStyle = color;
        magnetCtx.fillRect(x - minX, y - minY, 1, 1);
      });

      // Calculate scaled dimensions in canvas coordinates
      // Convert display pixel size to canvas pixel size
      const baseHeight = 60; // display pixels
      const scaledHeightDisplay = baseHeight * placed.scale;
      const scaledHeightCanvas = scaledHeightDisplay * displayToCanvasRatio;

      // Calculate width maintaining aspect ratio
      const aspectRatio = width / height;
      const scaledWidthCanvas = scaledHeightCanvas * aspectRatio;

      // Draw magnet onto composite canvas at its position (scaled by scaleFactor)
      ctx.drawImage(
        magnetCanvas,
        (placed.x - scaledWidthCanvas / 2) * scaleFactor,
        (placed.y - scaledHeightCanvas / 2) * scaleFactor,
        scaledWidthCanvas * scaleFactor,
        scaledHeightCanvas * scaleFactor
      );
    }

    // Convert to blob and download
    compositeCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fridge-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [placedMagnets]);

  const handleDragStart = (event: DragStartEvent) => {
    setIsDragging(true);
    const magnetData = event.active.data.current as PaintedEvent;
    setDraggedMagnet(magnetData);

    // Hide resize buttons when dragging a magnet from the drawer
    if (resizeButtonsIndex !== null) {
      setResizeButtonsIndex(null);
    }

    const activator = event.activatorEvent;
    if (activator) {
      if ('touches' in activator && activator.touches && (activator.touches as TouchList).length > 0) {
        // Touch event
        const touches = activator.touches as TouchList;
        mousePositionRef.current = { x: touches[0].clientX, y: touches[0].clientY };
      } else if ('clientX' in activator && 'clientY' in activator) {
        // Mouse/Pointer event
        mousePositionRef.current = { x: activator.clientX as number, y: activator.clientY as number };
      }
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
          setPlacedMagnets(prev => {
            const newMagnets = [...prev, {
              x: pixelX,
              y: pixelY,
              magnet: magnetData,
              scale: 1,
            }];
            // Show resize buttons for the newly placed magnet on mobile
            setResizeButtonsIndex(newMagnets.length - 1);
            return newMagnets;
          });
        }
      }
    }

    setIsDragging(false);
    setDraggedMagnet(null);
    mousePositionRef.current = null;
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="relative bg-zinc-900 overflow-hidden" style={{ height: '100vh', width: '100%' }}>
        {/* Title */}
        <div className="absolute top-4 left-0 right-0 text-center z-10">
          <h1 className="text-white text-[18px] sm:text-2xl font-bold">The BasePaint Magnet Fridge!</h1>
          <h1 className="text-gray-400 text-[13px] sm:text-md mt-1 font-semibold">created by <Link href="https://x.com/backseats_eth" target="_blank" className="text-blue-500 hover:text-blue-600">@backseats_eth</Link></h1>
        </div>

        {/* Canvas Area - Square and centered on mobile, fixed size on desktop */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-center p-0 md:p-8 canvas-area-mobile">
          <CanvasTarget
            borderColor={borderColor}
            pixelData={pixelData}
            placedMagnets={placedMagnets}
            isShiftHeld={isShiftHeld}
            hoveredMagnetIndex={hoveredMagnetIndex}
            resizeButtonsIndex={resizeButtonsIndex}
            draggingPlacedMagnetIndex={draggingPlacedMagnetIndex}
            isOverTrash={isOverTrash}
            onHoverMagnet={setHoveredMagnetIndex}
            onHoverEndMagnet={() => setHoveredMagnetIndex(null)}
            onResizeMagnet={handleResizeMagnet}
            onRepositionMagnet={handleRepositionMagnet}
            onDeleteMagnet={handleDeleteMagnet}
            onToggleResizeButtons={handleToggleResizeButtons}
            onDraggingPlacedMagnet={handleDraggingPlacedMagnet}
            onCheckTrashHover={handleCheckTrashHover}
            onClearResizeButtons={() => setResizeButtonsIndex(null)}
            canvasRefCallback={(ref) => { fridgeCanvasRef.current = ref; }}
          />
        </div>

        {/* Help Button - below canvas on the left */}
        <button
          onClick={() => setShowHelpModal(true)}
          className="absolute bottom-[calc(12vh+1rem)] md:bottom-[calc(16rem+1rem)] left-4 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg z-10 hover:bg-blue-600 transition-colors"
        >
          <QuestionMarkCircleIcon className="w-6 h-6 text-white" />
        </button>

        {/* Screenshot Button - below canvas on the right */}
        <button
          onClick={handleCaptureScreenshot}
          className="absolute bottom-[calc(12vh+1rem)] md:bottom-[calc(16rem+1rem)] right-4 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-10 hover:bg-green-600 transition-colors"
        >
          <CameraIcon className="w-6 h-6 text-white" />
        </button>

        {/* Bottom Drawer - 12vh on mobile, fixed height on desktop */}
        <div className="absolute bottom-0 left-0 right-0 h-[12vh] md:h-64 bg-zinc-800 border-t border-zinc-700 overflow-x-auto overflow-y-hidden p-4 [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0">
          <div className="grid grid-flow-col grid-rows-1 md:grid-rows-2 gap-6 sm:gap-2 h-full" style={{ gridAutoColumns: '200px' }}>
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
          <div className="opacity-90 touch-none">
            <MagnetPreview event={draggedMagnet} isDragging={true} />
          </div>
        ) : null}
      </DragOverlay>

      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </DndContext>
  );
}
