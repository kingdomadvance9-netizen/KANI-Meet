"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { PictureInPicture2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Position {
  x: number;
  y: number;
}

interface DraggablePiPButtonProps {
  onTogglePiP: () => void;
  isPiPActive: boolean;
  isPiPSupported: boolean;
  canActivate: boolean;
  canActivateReason?: string | null;
  isAutoActivateEnabled?: boolean;
  containerRef?: React.RefObject<HTMLElement>;
}

const BUTTON_SIZE = 48;
const EDGE_PADDING = 16;
const SNAP_THRESHOLD = 60;

const DraggablePiPButton = ({
  onTogglePiP,
  isPiPActive,
  isPiPSupported,
  canActivate,
  canActivateReason,
  isAutoActivateEnabled,
  containerRef,
}: DraggablePiPButtonProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [buttonStart, setButtonStart] = useState<Position>({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  // Initialize position to top-right corner
  useEffect(() => {
    if (position.x === -1 && position.y === -1) {
      const container = containerRef?.current || document.body;
      const rect = container.getBoundingClientRect();
      setPosition({
        x: rect.width - BUTTON_SIZE - EDGE_PADDING,
        y: EDGE_PADDING,
      });
    }
  }, [containerRef, position.x, position.y]);

  // Get container bounds
  const getContainerBounds = useCallback(() => {
    const container = containerRef?.current || document.body;
    const rect = container.getBoundingClientRect();
    return {
      left: 0,
      top: 0,
      right: rect.width - BUTTON_SIZE,
      bottom: rect.height - BUTTON_SIZE,
      width: rect.width,
      height: rect.height,
    };
  }, [containerRef]);

  // Snap position to nearest edge
  const snapToEdge = useCallback((pos: Position): Position => {
    const bounds = getContainerBounds();
    const centerX = pos.x + BUTTON_SIZE / 2;
    const centerY = pos.y + BUTTON_SIZE / 2;

    // Calculate distances to each edge
    const distLeft = pos.x;
    const distRight = bounds.width - (pos.x + BUTTON_SIZE);
    const distTop = pos.y;
    const distBottom = bounds.height - (pos.y + BUTTON_SIZE);

    // Find nearest horizontal edge
    const snapX = distLeft < distRight
      ? EDGE_PADDING
      : bounds.width - BUTTON_SIZE - EDGE_PADDING;

    // Find nearest vertical edge (only snap if close to edge)
    let snapY = pos.y;
    if (distTop < SNAP_THRESHOLD) {
      snapY = EDGE_PADDING;
    } else if (distBottom < SNAP_THRESHOLD) {
      snapY = bounds.height - BUTTON_SIZE - EDGE_PADDING;
    }

    // Clamp Y to valid bounds
    snapY = Math.max(EDGE_PADDING, Math.min(snapY, bounds.height - BUTTON_SIZE - EDGE_PADDING));

    return { x: snapX, y: snapY };
  }, [getContainerBounds]);

  // Constrain position within bounds
  const constrainPosition = useCallback((pos: Position): Position => {
    const bounds = getContainerBounds();
    return {
      x: Math.max(EDGE_PADDING, Math.min(pos.x, bounds.right - EDGE_PADDING)),
      y: Math.max(EDGE_PADDING, Math.min(pos.y, bounds.bottom - EDGE_PADDING)),
    };
  }, [getContainerBounds]);

  // Handle pointer down (start drag)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: e.clientX, y: e.clientY });
    setButtonStart({ ...position });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  // Handle pointer move (drag)
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // Mark as moved if drag distance exceeds threshold
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setHasMoved(true);
    }

    const newPos = constrainPosition({
      x: buttonStart.x + deltaX,
      y: buttonStart.y + deltaY,
    });

    setPosition(newPos);
  }, [isDragging, dragStart, buttonStart, constrainPosition]);

  // Handle pointer up (end drag)
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;

    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);

    // Snap to edge on release
    setPosition(snapToEdge(position));

    // If didn't move, treat as click
    if (!hasMoved) {
      onTogglePiP();
    }
  }, [isDragging, position, snapToEdge, hasMoved, onTogglePiP]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => constrainPosition(prev));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [constrainPosition]);

  if (!isPiPSupported) {
    return null;
  }

  return (
    <button
      ref={buttonRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      disabled={!canActivate && !isPiPActive}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        touchAction: "none",
        userSelect: "none",
        zIndex: 50,
      }}
      className={cn(
        "flex items-center justify-center rounded-full shadow-xl transition-all",
        isDragging ? "scale-110 cursor-grabbing" : "cursor-grab hover:scale-105",
        isPiPActive
          ? "bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-400/50"
          : isAutoActivateEnabled
          ? "bg-green-600/90 hover:bg-green-700 border border-green-400/30"
          : "bg-dark-2/90 hover:bg-dark-3 backdrop-blur-sm border border-white/10",
        !canActivate && !isPiPActive && "opacity-50 cursor-not-allowed"
      )}
      title={
        !canActivate && !isPiPActive
          ? canActivateReason || "PiP unavailable"
          : isPiPActive
          ? "Exit Picture-in-Picture"
          : isAutoActivateEnabled
          ? "PiP (auto-activates on tab switch)"
          : "Click to enable PiP (drag to move)"
      }
      aria-label={isPiPActive ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture"}
    >
      <PictureInPicture2
        className={cn(
          "w-5 h-5 transition-colors",
          isPiPActive ? "text-white" : "text-gray-300"
        )}
      />
    </button>
  );
};

export default DraggablePiPButton;
