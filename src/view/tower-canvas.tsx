/**
 * 4-pane host.
 *
 * What: Owns the RAF loop and the WebGL canvas. Calls vm.advance(dt) so
 * time only moves through the ViewModel. Reads vm.engine to draw.
 * Why the View still sees the engine: THREE needs live piece positions.
 * It must not `new SimEngine` and it must not call `engine.step`.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { STEP } from "@/model/constants";
import { World3D, WORLD3D_REV, type PaneRect } from "@/view/scene3d";
import type { Bubble, SimSnapshot } from "@/model/types";
import type { LabViewModel } from "@/viewmodel/LabViewModel";
import { cn } from "@/lib/utils";

interface Props {
  vmRef: RefObject<LabViewModel | null>;
  snap: SimSnapshot | null;
  onSnap: (s: SimSnapshot) => void;
  className?: string;
}

export function TowerCanvas({ vmRef, snap, onSnap, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frontSlot = useRef<HTMLDivElement>(null);
  const isoSlot = useRef<HTMLDivElement>(null);
  const zoomSlot = useRef<HTMLDivElement>(null);
  const topSlot = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World3D | null>(null);
  const zoomPane = useRef<PaneRect>({ x: 0, y: 0, w: 1, h: 1 });
  const onSnapRef = useRef(onSnap);
  onSnapRef.current = onSnap;
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const world = new World3D(canvas);
    worldRef.current = world;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hud = 0;
    let frames = 0;
    let cancelled = false;

    const paneOf = (slot: HTMLDivElement | null): PaneRect => {
      if (!slot) return { x: 0, y: 0, w: 0, h: 0 };
      const a = slot.getBoundingClientRect();
      const b = host.getBoundingClientRect();
      return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
    };

    const loop = (now: number) => {
      if (cancelled) return;
      const vm = vmRef.current;
      const cssW = host.clientWidth;
      const cssH = host.clientHeight;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;

      if (vm && cssW > 4 && cssH > 4) {
        acc += dt;
        while (acc >= STEP) {
          vm.advance(STEP);
          acc -= STEP;
        }
        const front = paneOf(frontSlot.current);
        const iso = paneOf(isoSlot.current);
        const zoom = paneOf(zoomSlot.current);
        const top = paneOf(topSlot.current);
        zoomPane.current = zoom;
        world.render(vm.engine, cssW, cssH, { front, iso, zoom, top }, now / 1000);
        frames += 1;
        if (world.ready && frames >= 2 && !readyRef.current) {
          readyRef.current = true;
          setReady(true);
        }
        hud += dt;
        if (hud > 0.1) {
          hud = 0;
          onSnapRef.current(vm.snapshot());
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const timeout = window.setTimeout(() => {
      if (!readyRef.current) {
        readyRef.current = true;
        setReady(true);
      }
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      cancelAnimationFrame(raf);
      world.dispose();
      worldRef.current = null;
    };
  }, [vmRef, WORLD3D_REV]);

  const bubbles = snap?.bubbles ?? [];
  const loadingLabel =
    snap?.shape === "bonfire" ? "Building the pit…" : snap?.world === "tower" ? "Raising the tower…" : "Loading the lab…";

  return (
    <div
      ref={hostRef}
      className={cn("relative grid h-full min-h-96 grid-cols-2 grid-rows-2 gap-2 md:gap-3", className)}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-10 col-span-full row-span-full h-full w-full"
      />
      <Pane label="Front" slotRef={frontSlot} dataPane="front" />
      <Pane label="Everything" slotRef={isoSlot} dataPane="iso" />
      <Pane label="Action" slotRef={zoomSlot} dataPane="zoom">
        {bubbles.map((b) => (
          <StatusBubble key={b.id} bubble={b} pane={zoomPane.current} world={worldRef.current} />
        ))}
      </Pane>
      <Pane label="Top" slotRef={topSlot} dataPane="top" />
      {!ready ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-sky/90">
          <div className="w-64 space-y-3 rounded-md bg-surface px-4 py-4 text-center shadow-border">
            <p className="font-mono text-2xs uppercase tracking-widest text-muted">Loading</p>
            <p className="text-sm text-fg">{loadingLabel}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="load-bar h-full w-1/2 bg-accent" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Pane({
  label,
  slotRef,
  children,
  className,
  dataPane,
}: {
  label: string;
  slotRef: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
  className?: string;
  dataPane?: string;
}) {
  return (
    <div
      ref={slotRef}
      data-pane={dataPane}
      className={cn("relative z-20 min-h-0 w-full overflow-hidden rounded-md", className)}
      style={{ touchAction: "none" }}
    >
      <p className="pointer-events-none absolute left-2 top-2 z-30 rounded-sm bg-black/75 px-2 py-1 font-mono text-xs font-semibold uppercase tracking-widest text-white">
        {label}
      </p>
      {children}
    </div>
  );
}

function StatusBubble({
  bubble,
  pane,
  world,
}: {
  bubble: Bubble;
  pane: PaneRect;
  world: World3D | null;
}) {
  const p = world ? world.project(bubble.x, bubble.y, pane, "zoom") : { x: pane.w / 2, y: 40 };
  const color =
    bubble.kind === "critical"
      ? "border-danger/50 text-fg"
      : bubble.kind === "fire"
        ? "border-fire/50 text-fg"
        : bubble.kind === "warn"
          ? "border-warn/50 text-fg"
          : bubble.kind === "ok"
            ? "border-ok/50 text-fg"
            : "border-border text-fg";
  const faded = bubble.ttl < 0.6 ? 0.35 : 1;
  return (
    <div
      className={cn(
        "bubble-pop pointer-events-none absolute z-20 w-56 max-w-56 rounded-sm border bg-surface/95 px-3 py-2 shadow-border",
        color,
      )}
      style={{ left: p.x, top: p.y, opacity: faded }}
    >
      <div className="font-mono text-2xs uppercase tracking-wider text-muted">{bubble.kind}</div>
      <div className="text-sm font-medium leading-snug">{bubble.title}</div>
      {bubble.detail ? <p className="mt-1 text-xs leading-snug text-muted">{bubble.detail}</p> : null}
    </div>
  );
}
