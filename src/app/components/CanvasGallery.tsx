import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Image as DreiImage, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { X, ExternalLink, MapPin, Calendar, Camera } from "lucide-react";
import type { GalleryItem } from "@/app/components/gallery-utils";

interface CanvasGalleryProps {
  items: GalleryItem[];
  columns?: number;
  mobileColumns?: number;
  gap?: number;
  itemWidth?: number;
  itemHeight?: number;
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

const CAMERA_Z = 7;
const CAMERA_Z_MOBILE = 5;
const CAMERA_Z_SELECTED = 5.5;
const CAMERA_Z_SELECTED_MOBILE = 5;

function Rig({
  selectedPosition,
  isSelected,
  isMobile,
}: {
  selectedPosition: THREE.Vector3 | null;
  isSelected: boolean;
  isMobile: boolean;
}) {
  const { camera } = useThree();
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const baseZ = isMobile ? CAMERA_Z_MOBILE : CAMERA_Z;
  const target = useRef({ x: 0, y: 0 });
  const lockedTarget = useRef<{ x: number; y: number; z: number } | null>(null);

  useEffect(() => {
    if (isSelected && selectedPosition) {
      lockedTarget.current = isMobile
        ? { x: selectedPosition.x, y: selectedPosition.y + 1.5, z: CAMERA_Z_SELECTED_MOBILE }
        : { x: selectedPosition.x - 1.2, y: selectedPosition.y, z: CAMERA_Z_SELECTED };
    } else {
      lockedTarget.current = null;
    }
  }, [isSelected, selectedPosition, isMobile]);

  useEffect(() => {
    const el = document.getElementById("canvas-gallery-container");
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (isSelected) return;
      isDragging.current = true;
      previousMouse.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: 0, y: 0 };
      el.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const sensitivity = isMobile ? 0.015 : 0.01;
      const dx = (e.clientX - previousMouse.current.x) * sensitivity;
      const dy = (e.clientY - previousMouse.current.y) * sensitivity;
      velocity.current = { x: -dx, y: dy };
      target.current.x += -dx;
      target.current.y += dy;
      previousMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => {
      isDragging.current = false;
      el.style.cursor = isSelected ? "default" : "grab";
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointerleave", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerleave", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [isSelected, isMobile]);

  useFrame(() => {
    const lerpSpeed = lockedTarget.current ? 0.06 : 0.1;
    if (lockedTarget.current) {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, lockedTarget.current.x, lerpSpeed);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, lockedTarget.current.y, lerpSpeed);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, lockedTarget.current.z, lerpSpeed);
    } else {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, target.current.x, lerpSpeed);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, target.current.y, lerpSpeed);
      camera.position.z = baseZ;
    }
    if (!isDragging.current && !lockedTarget.current) {
      velocity.current.x *= 0.92;
      velocity.current.y *= 0.92;
      target.current.x += velocity.current.x;
      target.current.y += velocity.current.y;
    }
  });

  return null;
}

function ImageCard({
  item, position, width, height, isSelected, onSelect,
}: {
  item: GalleryItem;
  position: [number, number, number];
  width: number;
  height: number;
  isSelected: boolean;
  onSelect: (item: GalleryItem, pos: THREE.Vector3) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useFrame(() => {
    if (!meshRef.current) return;
    const targetScale = isSelected ? 1.08 : hovered ? 1.04 : 1;
    meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.1);
    meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetScale, 0.1);
    const targetZ = isSelected ? 0.3 : hovered ? 0.15 : 0;
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, 0.1);
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onSelect(item, new THREE.Vector3(...position)); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <DreiImage url={item.image} scale={[width, height]} transparent toneMapped={false} />
      {isSelected && (
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[width + 0.12, height + 0.12]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

function InfiniteGrid({
  items, columns, gap, itemWidth, itemHeight, selectedId, onSelect,
}: {
  items: GalleryItem[];
  columns: number;
  gap: number;
  itemWidth: number;
  itemHeight: number;
  selectedId: string | null;
  onSelect: (item: GalleryItem, pos: THREE.Vector3) => void;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null!);

  const rows = Math.ceil(items.length / columns);
  const cellW = itemWidth + gap;
  const cellH = itemHeight + gap;
  const tileW = columns * cellW;
  const tileH = rows * cellH;

  const basePositions = useMemo(() => {
    const offsetX = -tileW / 2 + itemWidth / 2 + gap / 2;
    return items.map((_, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      return [offsetX + col * cellW, -(row * cellH), 0] as [number, number, number];
    });
  }, [items, columns, cellW, cellH, tileW, itemWidth, gap]);

  const [tileOffset, setTileOffset] = useState({ ox: 0, oy: 0 });

  useFrame(() => {
    const ox = Math.round(camera.position.x / tileW);
    const oy = Math.round(-camera.position.y / tileH);
    if (ox !== tileOffset.ox || oy !== tileOffset.oy) setTileOffset({ ox, oy });
  });

  const tileOffsets = useMemo(() => {
    const offsets: { tx: number; ty: number }[] = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        offsets.push({ tx: tileOffset.ox + dx, ty: tileOffset.oy + dy });
    return offsets;
  }, [tileOffset]);

  return (
    <group ref={groupRef}>
      {tileOffsets.map(({ tx, ty }) => (
        <group key={`${tx},${ty}`} position={[tx * tileW, -ty * tileH, 0]}>
          {items.map((item, i) => (
            <ImageCard
              key={`${tx},${ty}-${item.id}`}
              item={item}
              position={basePositions[i]}
              width={itemWidth}
              height={itemHeight}
              isSelected={selectedId === item.id}
              onSelect={onSelect}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

function PanelMeta({ item }: { item: GalleryItem }) {
  return (
    <div className="flex flex-col gap-2.5">
      {item.source && (
        <div className="flex items-center gap-2.5">
          <MapPin size={15} className="text-slate-400 dark:text-slate-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">{item.source}</span>
        </div>
      )}
      {item.date && (
        <div className="flex items-center gap-2.5">
          <Calendar size={15} className="text-slate-400 dark:text-slate-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">{item.date}</span>
        </div>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SidePanel({
  item, onClose, isMobile,
}: {
  item: GalleryItem | null;
  onClose: () => void;
  isMobile: boolean;
}) {
  const isOpen = item !== null;
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => { if (!isOpen) setDragOffset(0); }, [isOpen]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    dragStartY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setDragOffset(dy);
  };
  const onTouchEnd = () => {
    if (!isMobile) return;
    if (dragOffset > 100) onClose();
    setDragOffset(0);
    dragStartY.current = null;
  };

  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={onClose}
        />
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 backdrop-blur-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "translate-y-0" : "translate-y-full"}`}
          style={{ transform: isOpen ? `translateY(${dragOffset}px)` : "translateY(100%)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex shrink-0 justify-center pb-2 pt-3">
            <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>
          {item && (
            <div className="flex-1 overflow-y-auto">
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/95 dark:from-slate-900/95 to-transparent" />
              </div>
              <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
                <div>
                  <h2 className="text-lg font-bold leading-tight">{item.title}</h2>
                  {item.description && <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>}
                </div>
                <PanelMeta item={item} />
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  <ExternalLink size={15} /> Open Link
                </a>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className={`pointer-events-none fixed inset-y-0 right-0 z-50 flex w-[380px] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
      <div className="pointer-events-auto relative flex h-full w-full flex-col overflow-y-auto border-l border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 backdrop-blur-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-200">
          <X size={18} />
        </button>
        {item && (
          <>
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/90 dark:from-slate-900/90 to-transparent" />
            </div>
            <div className="flex flex-1 flex-col gap-5 p-6">
              <div>
                <h2 className="text-xl font-bold leading-tight">{item.title}</h2>
                {item.description && <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>}
              </div>
              <PanelMeta item={item} />
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                <ExternalLink size={15} /> Open Link
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HUD({ itemCount, isMobile }: { itemCount: number; isMobile: boolean }) {
  return (
    <div className="fixed left-3 top-[72px] z-40 flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 backdrop-blur-md sm:left-5 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs">
      <Camera size={isMobile ? 11 : 13} />
      <span>{itemCount} items</span>
      <span className="mx-0.5 opacity-30 sm:mx-1">|</span>
      <span>Drag to pan</span>
    </div>
  );
}

export default function CanvasGallery({
  items, columns = 5, mobileColumns = 3, gap = 0.3, itemWidth = 2, itemHeight = 1.4,
}: CanvasGalleryProps) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  const [selectedPos, setSelectedPos] = useState<THREE.Vector3 | null>(null);

  const cols = isMobile ? mobileColumns : columns;
  const w = isMobile ? 1.6 : itemWidth;
  const h = isMobile ? 1.1 : itemHeight;
  const g = isMobile ? 0.2 : gap;

  const handleSelect = useCallback((item: GalleryItem, pos: THREE.Vector3) => {
    setSelected((prev) => (prev?.id === item.id ? null : item));
    setSelectedPos(pos);
  }, []);

  const handleClose = useCallback(() => { setSelected(null); setSelectedPos(null); }, []);

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        No resources with images to display in gallery view.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div id="canvas-gallery-container" className="h-full w-full touch-none" style={{ cursor: selected ? "default" : "grab" }}>
        <Canvas
          camera={{ position: [0, 0, isMobile ? CAMERA_Z_MOBILE : CAMERA_Z], fov: 50 }}
          dpr={[1, isMobile ? 1.5 : 2]}
          gl={{ antialias: !isMobile, alpha: true }}
          style={{ background: "transparent" }}
        >
          <Rig selectedPosition={selectedPos} isSelected={selected !== null} isMobile={isMobile} />
          <InfiniteGrid items={items} columns={cols} gap={g} itemWidth={w} itemHeight={h} selectedId={selected?.id ?? null} onSelect={handleSelect} />
          <ambientLight intensity={1.5} />
        </Canvas>
      </div>
      <HUD itemCount={items.length} isMobile={isMobile} />
      <SidePanel item={selected} onClose={handleClose} isMobile={isMobile} />
    </div>
  );
}
