/**
 * Lab chrome — buttons, captions, telemetry.
 *
 * What: The React View. Constructs a LabViewModel, never a SimEngine.
 * Why: A critic auditing gravity should not have to read this file. Play,
 * pause, speed, and which-run are commands on the ViewModel. This file
 * paints whatever getState() returns.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Info, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TowerCanvas } from "@/view/tower-canvas";
import { playImpact, playInitiation, unlockAudio } from "@/view/audio";
import { CLAIM, PATH, SCENARIOS, scenarioById } from "@/model/scenarios";
import type { LogEvent, Phase, Scenario, SimSnapshot } from "@/model/types";
import { LabViewModel, type LabViewState } from "@/viewmodel/LabViewModel";
import { cn } from "@/lib/utils";

const DEFAULT_ID = "bonfire";

export function LabApp() {
  const vmRef = useRef<LabViewModel | null>(null);
  const [view, setView] = useState<LabViewState | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const lastPhase = useRef<Phase>("idle");

  const push = useCallback((vm: LabViewModel) => {
    setView(vm.getState());
  }, []);

  useEffect(() => {
    const vm = new LabViewModel(DEFAULT_ID, {
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    vmRef.current = vm;
    push(vm);
    const w = window as unknown as {
      __vm?: LabViewModel;
      __sim?: LabViewModel["engine"];
      __scenarios?: typeof SCENARIOS;
    };
    w.__vm = vm;
    w.__sim = vm.engine;
    w.__scenarios = SCENARIOS;
    return () => {
      vmRef.current = null;
    };
  }, [push]);

  const applyScenario = useCallback((s: Scenario) => {
    const vm = vmRef.current;
    if (!vm) return;
    unlockAudio();
    vm.selectScenario(s.id);
    lastPhase.current = "idle";
    push(vm);
  }, [push]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const vm = vmRef.current;
      if (!vm) return;
      if (e.code === "Space") {
        e.preventDefault();
        unlockAudio();
        vm.togglePlay();
        lastPhase.current = vm.snapshot().phase;
        push(vm);
      } else if (e.key === "r" || e.key === "R") {
        vm.reset();
        lastPhase.current = "idle";
        push(vm);
      } else if (e.key >= "1" && e.key <= "9") {
        if (vm.selectScenarioByIndex(Number(e.key) - 1)) {
          lastPhase.current = "idle";
          push(vm);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [push]);

  const onSnap = useCallback((s: SimSnapshot) => {
    if (s.phase !== lastPhase.current) {
      if (s.phase === "fire") playImpact();
      if (s.phase === "collapse") playInitiation();
      lastPhase.current = s.phase;
    }
    const vm = vmRef.current;
    if (vm) push(vm);
  }, [push]);

  function togglePlay() {
    const vm = vmRef.current;
    if (!vm) return;
    unlockAudio();
    vm.togglePlay();
    lastPhase.current = vm.snapshot().phase;
    push(vm);
  }

  function reset() {
    const vm = vmRef.current;
    if (!vm) return;
    vm.reset();
    lastPhase.current = "idle";
    push(vm);
  }

  function changeSpeed(v: number) {
    const vm = vmRef.current;
    if (!vm) return;
    vm.setSpeed(v);
    push(vm);
  }

  const snap = view?.snap ?? null;
  const scenario = view?.scenario ?? scenarioById(DEFAULT_ID);
  const scenarioId = view?.scenarioId ?? DEFAULT_ID;
  const speed = view?.speed ?? scenario.defaultSpeed;
  const phase = snap?.phase ?? "idle";
  const playing = view?.playing ?? false;
  const midRun = view?.midRun ?? false;
  const next = view?.next ?? null;
  const latest = view?.latest ?? null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg lg:h-dvh">
      <header className="shrink-0 border-b border-border px-4 py-2 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <a
              href="https://x.com/GrumpyTechBro"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="@GrumpyTechBro on X"
            >
              <img
                src="/grumpy-tech-bro.jpg"
                alt=""
                width={44}
                height={44}
                className="size-11 rounded-full object-cover"
              />
            </a>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">9/11 Collapse Lab</h1>
              <a
                href="https://x.com/GrumpyTechBro"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-2xs text-accent hover:text-fg"
              >
                A GrumpyTechBro Joint
              </a>
            </div>
          </div>
          <p className="hidden font-mono text-xs text-faint sm:block">Space play · R reset · 1–9 runs</p>
        </div>
        <p className="mt-0.5 max-w-3xl text-sm text-muted">
          Not a video. Gravity, heat, and members that fail into rubble. Change a switch — the numbers change.
        </p>
        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          className="mt-1 inline-flex min-h-11 items-center gap-2 text-left text-sm text-muted hover:text-fg"
        >
          <Info className="size-4" />
          What this is (and is not)
          <ChevronDown className={cn("size-4 text-faint transition-transform duration-150", notesOpen && "rotate-180")} />
        </button>
        {notesOpen ? (
          <div className="mt-2 max-w-3xl border-t border-border pt-3">
            <Notes />
          </div>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-4 lg:overflow-hidden">
        <section className="flex min-h-0 flex-col gap-2 p-3 md:p-4 lg:col-span-3">
          <Caption event={latest} idle={phase === "idle"} />
          <div className="relative min-h-[40rem] flex-1 lg:min-h-0">
            <TowerCanvas vmRef={vmRef} snap={snap} onSnap={onSnap} className="h-full min-h-[40rem] lg:min-h-0" />
            {phase === "idle" ? (
              <BriefingOverlay scenario={scenario} onIgnite={togglePlay} />
            ) : null}
            {phase === "settled" && snap ? (
              <FinishOverlay
                snap={snap}
                scenario={scenario}
                next={next}
                onNext={next ? () => applyScenario(next) : undefined}
                onAgain={reset}
              />
            ) : null}
          </div>
          <ControlBar
            playing={playing}
            midRun={midRun}
            snap={snap}
            wood={view?.wood ?? false}
            speed={speed}
            onPlay={togglePlay}
            onReset={reset}
            onSpeed={changeSpeed}
          />
          <Fold title="Telemetry" defaultOpen>
            <Telemetry snap={snap} scenario={scenario} />
          </Fold>
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-t border-border px-4 py-4 lg:border-l lg:border-t-0">
          <Fold title="Runs" defaultOpen>
            <ScenarioPicker current={scenarioId} onPick={applyScenario} />
            <p className="mt-3 text-sm leading-relaxed text-muted">{scenario.blurb}</p>
          </Fold>
          <Fold title="Simulation" defaultOpen>
            <Integrator snap={snap} scenario={scenario} />
          </Fold>
        </aside>
      </div>
    </div>
  );
}

function Caption({ event, idle }: { event: LogEvent | null; idle: boolean }) {
  const text = event?.text ?? (idle ? "Ready. Click Ignite when you have read the brief." : "Integrating.");
  const stamp = event ? (event.tMin < 0.05 ? "t0" : `+${event.tMin.toFixed(0)}m`) : "t0";
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-md bg-surface px-3 py-2 shadow-border" aria-live="polite">
      <span className="font-mono text-2xs uppercase tracking-wider text-accent">Caption</span>
      <p key={`${stamp}-${text}`} className="caption-in min-w-0 flex-1 truncate text-sm leading-snug">
        <span className="mr-2 font-mono text-2xs tabular-nums text-muted">{stamp}</span>
        {text}
      </p>
    </div>
  );
}

function BriefingOverlay({ scenario, onIgnite }: { scenario: Scenario; onIgnite: () => void }) {
  return (
    <div className="absolute inset-x-0 top-0 z-30 p-3 md:p-4">
      <div className="overlay-in mx-auto max-w-2xl rounded-lg bg-surface/95 p-4 shadow-border">
        <p className="font-mono text-2xs uppercase tracking-wider text-accent">{scenario.name}</p>
        <p className="mt-2 text-sm leading-relaxed md:text-base">{scenario.brief}</p>
        <p className="mt-2 text-sm text-muted">
          {scenario.shape === "tower"
            ? "Fire walks one story at a time — a burning floor heats the one above until it lights."
            : scenario.shape === "bonfire"
              ? "Neighbor heat: a burning log warms what it touches (~0.2 m), and fire rises. When a neighbor hits ignition temp, it lights."
            : scenario.shape === "apartment"
              ? "Room fire: the unit fills with hot gas. Next room through the wall, then the floor above — not a fuse up the face."
              : "Neighbor heat: burning timber warms what it touches (~0.3 m), and fire rises. When a neighbor hits ignition temp, it lights."}
        </p>
        <Button onClick={onIgnite} className="mt-3 min-h-11 min-w-28">
          <Play className="ml-0.5" />
          {scenario.hasPlane ? "Impact" : "Ignite"}
        </Button>
      </div>
    </div>
  );
}

function FinishOverlay({
  snap,
  scenario,
  next,
  onNext,
  onAgain,
}: {
  snap: SimSnapshot;
  scenario: Scenario;
  next: Scenario | null;
  onNext?: () => void;
  onAgain: () => void;
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-30 p-3 md:p-4">
      <div className="overlay-in mx-auto max-w-2xl rounded-lg bg-surface/95 p-4 shadow-border">
        {scenario.group === "claim" ? <ClaimBody snap={snap} /> : <PathBody snap={snap} />}
        <div className="mt-3">
          <Fold title="Review events">
            <EventLog events={snap.events} />
          </Fold>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {next && onNext ? (
            <Button onClick={onNext} className="min-h-11">
              Next: {next.name}
              <ChevronRight />
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onAgain} className="min-h-11">
            <RotateCcw />
            Run again
          </Button>
        </div>
      </div>
    </div>
  );
}

function PathBody({ snap }: { snap: SimSnapshot }) {
  return (
    <>
      <p className="font-mono text-2xs uppercase tracking-wider text-muted">What you saw</p>
      <p className="mt-2 text-sm leading-relaxed">{snap.verdict}</p>
    </>
  );
}

function ClaimBody({ snap }: { snap: SimSnapshot }) {
  const rot = Math.abs(snap.rotationDeg);
  const cg = Math.abs(snap.cgOffsetM);
  const need = (Math.atan2(snap.halfWidth, Math.max(40, snap.heightM * 0.45)) * 180) / Math.PI;
  const idle = snap.phase === "idle" || snap.phase === "approach";
  const rows = [
    { k: "Damaged face softens first", v: idle ? "—" : "Yes", ok: true },
    { k: "Center Gravity walks off-center", v: idle ? "—" : `${cg.toFixed(1)} m`, ok: true },
    {
      k: `CGrav leaves ${snap.halfWidth.toFixed(snap.halfWidth < 10 ? 1 : 0)} m half-width`,
      v: idle ? "—" : snap.cgInside ? "No" : "Yes",
      ok: snap.cgInside,
    },
    {
      k: `Amount of tilt needed to topple (~${need.toFixed(0)}°+)`,
      v: `${rot.toFixed(1)}° peak ${snap.maxRotationDeg.toFixed(0)}°`,
      ok: snap.maxRotationDeg < need,
    },
  ];
  return (
    <>
      <p className="font-mono text-2xs uppercase tracking-wider text-muted">The claim</p>
      <p className="mt-2 text-sm leading-relaxed">
        One face was hit, so that face buckles first, Center Gravity walks off midline, and a footprint collapse is
        impossible.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.k} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted">{r.k}</span>
            <span className={cn("font-mono text-xs tabular-nums", r.ok ? "text-ok" : "text-danger")}>{r.v}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-fg">{snap.verdict}</p>
    </>
  );
}

function EventLog({ events }: { events: LogEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted">Nothing logged this run.</p>;
  }
  return (
    <ol className="max-h-48 space-y-1.5 overflow-y-auto">
      {events.map((e, i) => (
        <li key={`${e.tMin}-${i}`} className="flex gap-2 text-sm leading-snug">
          <span className="shrink-0 font-mono text-2xs tabular-nums text-muted">
            {e.tMin < 0.05 ? "t0" : e.tMin < 10 ? `+${e.tMin.toFixed(1)}m` : `+${e.tMin.toFixed(0)}m`}
          </span>
          <span>{e.text}</span>
        </li>
      ))}
    </ol>
  );
}

function Fold({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-md bg-surface shadow-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="font-mono text-2xs uppercase tracking-wider text-muted">{title}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t border-border px-3 pb-3 pt-2">{children}</div> : null}
    </section>
  );
}

function Integrator({ snap, scenario }: { snap: SimSnapshot | null; scenario: Scenario }) {
  const wood = scenario.shape === "bonfire" || scenario.shape === "house" || scenario.shape === "apartment";
  const probe = snap?.probe;
  return (
    <div>
      <p className="text-sm leading-relaxed">
        Every frame runs the same three laws. Fire does not paint a wall. A burning member warms its neighbors
        (about 0.2 m in the crib — fire rises — a hand’s reach in the house, the next bay in the apartment, one story in the towers). When a neighbor’s temperature
        passes ignition, that neighbor lights. Tree → couch → room is the same rule as floor 93 → 94.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-sm bg-bg px-3 py-2 font-mono text-2xs leading-relaxed text-muted">
        {`T  ← T + (Tnbr − T)/τ · dt
if T > Tignite  →  neighbor lights
fy ← ${wood ? "woodChar" : "Eurocode3"}(T)
if load > fy·A  →  unlock
if unlocked     →  v ← v − 9.81 dt`}
      </pre>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-2xs tabular-nums">
        <div>
          <dt className="uppercase tracking-wider text-muted">Steps</dt>
          <dd className="text-sm text-fg">{snap ? snap.steps.toLocaleString() : "0"}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-muted">dt</dt>
          <dd className="text-sm text-fg">1/60 s</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-muted">g</dt>
          <dd className="text-sm text-fg">9.81 m/s²</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-muted">fy(T)</dt>
          <dd className="text-sm text-fg">{wood ? "wood char" : "Eurocode 3"}</dd>
        </div>
      </dl>
      {probe ? (
        <p className="mt-3 font-mono text-2xs leading-relaxed text-muted">
          Probe {probe.label}: {probe.temp.toFixed(0)}°C · {(probe.fy * 100).toFixed(0)}% fy ·{" "}
          {probe.dynamic ? "unlocked" : "locked"}
        </p>
      ) : null}
    </div>
  );
}

function ControlBar({
  playing,
  midRun,
  snap,
  wood,
  speed,
  onPlay,
  onReset,
  onSpeed,
}: {
  playing: boolean;
  midRun: boolean;
  snap: SimSnapshot | null;
  wood: boolean;
  speed: number;
  onPlay: () => void;
  onReset: () => void;
  onSpeed: (v: number) => void;
}) {
  const phase = snap?.phase ?? "idle";
  const probe = snap?.probe;
  const heating = snap && phase !== "idle" && phase !== "approach";
  const heatPct = probe ? Math.max(0, Math.min(1, (probe.temp - 22) / (wood ? 580 : 620))) : 0;
  const fyPct = probe ? Math.max(0, Math.min(1, probe.fy)) : 1;
  return (
    <div className="flex shrink-0 flex-col gap-2 rounded-lg bg-surface px-3 py-2 shadow-border">
      <div className="flex flex-wrap items-center gap-3">
        {midRun ? (
          <Button onClick={onPlay} className="min-h-11 min-w-24">
            {playing ? <Pause /> : <Play className="ml-0.5" />}
            {playing ? "Pause" : "Resume"}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onReset} aria-label="Reset" className="min-h-11">
          <RotateCcw />
          Reset
        </Button>
        <label className="flex min-w-48 min-h-11 flex-1 items-center gap-3">
          <span
            className="shrink-0 cursor-help font-mono text-2xs uppercase tracking-wider text-muted"
            title="Heating time-scale only. Gravity and collapse always run at 1×. 8× means fire walks eight times faster than the clock."
          >
            Fire Speed
          </span>
          <input
            className="lab-range flex-1"
            type="range"
            min={1}
            max={240}
            step={1}
            value={speed}
            onChange={(e) => onSpeed(Number(e.target.value))}
            aria-label="Fire Speed"
            suppressHydrationWarning
          />
          <span className="shrink-0 font-mono text-2xs tabular-nums text-fg">{speed}×</span>
        </label>
      </div>
      {heating && probe ? (
        <div className="space-y-2">
          <p className="font-mono text-2xs uppercase tracking-wider text-muted">Heating · {probe.label}</p>
          <div>
            <div className="mb-1 flex justify-between font-mono text-2xs uppercase tracking-wider text-muted">
              <span
                className="cursor-help border-b border-dotted border-faint"
                title="Temperature of the hottest member. Wood chars above ~300°C. Unprotected steel has lost about half its yield by 600°C."
              >
                Member temp
              </span>
              <span className="tabular-nums text-fg">{probe.temp.toFixed(0)}°C</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-fire" style={{ width: `${heatPct * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-2xs uppercase tracking-wider text-muted">
              <span
                className="cursor-help border-b border-dotted border-faint"
                title={
                  wood
                    ? "How much of this member’s original wood section still carries load. Char is the black layer that does not. Logs get shorter as this drops."
                    : "Eurocode 3 remaining yield strength at this steel temperature. 100% at room temp, about half at 600°C. Steel melts at 1500°C — office fires never get there."
                }
              >
                {wood ? "Wood remaining" : "Yield remaining"}
              </span>
              <span className="tabular-nums text-fg">{(fyPct * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={fyPct < 0.45 ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-ok"}
                style={{ width: `${fyPct * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScenarioPicker({ current, onPick }: { current: string; onPick: (s: Scenario) => void }) {
  return (
    <div className="space-y-4">
      <ChipRow label="Small scale examples" items={PATH} current={current} onPick={onPick} linked />
      <ChipRow label="9/11" items={CLAIM} current={current} onPick={onPick} />
    </div>
  );
}

function ChipRow({
  label,
  items,
  current,
  onPick,
  linked,
}: {
  label: string;
  items: Scenario[];
  current: string;
  onPick: (s: Scenario) => void;
  linked?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-2xs uppercase tracking-wider text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((s, i) => {
          const active = s.id === current;
          return (
            <span key={s.id} className="flex items-center gap-1.5">
              {linked && i > 0 ? <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden="true" /> : null}
              <button
                type="button"
                onClick={() => onPick(s)}
                className={cn(
                  "min-h-11 shrink-0 rounded-sm px-3 py-2 text-left text-sm leading-tight transition-colors",
                  active ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg hover:bg-surface-2/70",
                )}
              >
                <span className="block font-medium">{s.name}</span>
                <span className={cn("mt-0.5 block font-mono text-2xs leading-tight", active ? "text-accent-fg/70" : "text-muted")}>
                  {s.short}
                </span>
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Tip({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="cursor-help border-b border-dotted border-faint" title={hint}>
      {label}
    </span>
  );
}

function Telemetry({ snap, scenario }: { snap: SimSnapshot | null; scenario: Scenario }) {
  if (!snap) {
    return <p className="text-sm text-muted">Lab loading…</p>;
  }
  const fireMin = snap.phase === "fire" || snap.phase === "collapse" || snap.phase === "settled" ? snap.simMin : 0;
  const showImpact = scenario.hasPlane || snap.impactHi > snap.impactLo;
  const items: { k: string; v: string; hint: string }[] = [
    {
      k: "Clock",
      v: snap.clock,
      hint: "Elapsed clock in the run. Towers start at the historical impact time. Small-scale runs start at 00:00.",
    },
    {
      k: scenario.hasPlane ? "Since impact" : "Since ignition",
      v: `${fireMin.toFixed(1)} min`,
      hint: scenario.hasPlane
        ? "Simulated minutes of heating since the aircraft hit. Fire Speed stretches this; gravity does not."
        : "Simulated minutes since the match. Fire Speed stretches heating; falling still runs at 1×.",
    },
  ];
  if (showImpact) {
    items.push({
      k: "Impact story",
      v: `${snap.impactLo}–${snap.impactHi}`,
      hint: "Floors the jet actually cut. North 93–99, South 77–85. Both jets punched the core. “Only one face was damaged” is the claim, not the floor plate.",
    });
  }
  if (snap.nistMinutes > 0) {
    items.push({
      k: "NIST time",
      v: `${snap.nistMinutes} min`,
      hint: "How long the real tower stood after impact (NIST NCSTAR 1). A comparison, not a target the integrator is forced to hit.",
    });
  }
  items.push({
    k: "Initiation",
    v: snap.initiationMin === null ? "—" : `${snap.initiationMin.toFixed(0)} min`,
    hint: "When the first story lost enough capacity that the upper block started to drop. Empty until that happens.",
  });
  items.push({
    k: "Members",
    v: `${snap.looseCount} loose / ${snap.pieceCount}`,
    hint: "Pieces that have unlocked and are falling, versus still locked in the structure. Bonfire logs only unlock once they are charcoal.",
  });
  items.push({
    k: "Fire spread",
    v: scenario.noFire ? "off" : "neighbor heat",
    hint: "A burning member warms what it touches, and fire rises. When a neighbor passes ignition temperature, it lights. Nothing paints a whole wall on.",
  });
  items.push({
    k: "KE",
    v: snap.keJ > 1e6 ? `${(snap.keJ / 1e9).toFixed(2)} GJ` : snap.keJ > 1 ? `${(snap.keJ / 1e3).toFixed(0)} kJ` : "0",
    hint: "Kinetic energy of the falling block or loose members. ½mv². This is what eats the story below.",
  });
  const f = snap.faces;
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.k}>
            <dt className="font-mono text-2xs uppercase tracking-wider text-muted">
              <Tip label={it.k} hint={it.hint} />
            </dt>
            <dd className="font-mono text-sm tabular-nums">{it.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-2xs tabular-nums">
        <FaceStat
          label={scenario.shape === "bonfire" ? "Kerosene" : scenario.hasPlane ? "Hit" : scenario.shape === "house" ? "Tree" : "Fire"}
          hint={
            scenario.shape === "bonfire"
              ? "The corner the match was put to. Temperature and remaining wood strength on that face of the pile."
              : scenario.hasPlane
                ? "Inbound face the aircraft hit. Temperature and remaining yield of those columns."
                : scenario.shape === "house"
                  ? "The Christmas tree. Dry tree, one match. Temperature and remaining wood of that corner of the room."
                  : "The room that was ignited. Temperature and remaining wood strength."
          }
          face={f.impact}
        />
        <FaceStat
          label="Sides"
          hint="The two faces adjacent to the fire. If these heat, fire is walking sideways."
          face={f.sides}
        />
        <FaceStat
          label={snap.world === "pieces" ? "Mid" : "Core"}
          hint={
            snap.world === "pieces"
              ? "The middle of the pile or the house. Fire should arrive here after the tree, then the couch."
              : "The core columns. The jet punched these too. Elevator shafts also carry heat upward."
          }
          face={f.core}
        />
        <FaceStat
          label="Far"
          hint="The face opposite ignition. If this heats, fire walked. It was not hit."
          face={f.opposite}
        />
      </div>
      <div className="mt-3 space-y-2">
        <CapBar
          label="Fire side"
          hint="Remaining axial capacity of the columns on the fire face, as a fraction of design. Below 1.0 they cannot carry the stories above."
          value={snap.leftCap}
        />
        <CapBar
          label={snap.world === "pieces" ? "Middle" : "Core"}
          hint={
            snap.world === "pieces"
              ? "Remaining strength of the members in the middle of the structure."
              : "Remaining axial capacity of the core, as a fraction of design. About half the tower’s gravity load sits here."
          }
          value={snap.coreCap}
        />
        <CapBar
          label="Far side"
          hint="Remaining capacity of the untouched face. If this stays high while the fire side drops, Center Gravity walks a few metres — still inside a 63 m square."
          value={snap.rightCap}
        />
      </div>
    </div>
  );
}

function FaceStat({
  label,
  hint,
  face,
}: {
  label: string;
  hint: string;
  face: { temp: number; fire: number; cap: number; damage: number };
}) {
  return (
    <div className={cn(
      "rounded-sm bg-bg px-2 py-1.5 border-l-2",
      face.temp > 400 ? "border-fire" : face.temp > 140 ? "border-warn" : "border-ok",
    )}>
      <p className="uppercase tracking-wider text-muted">
        <Tip label={label} hint={hint} />
      </p>
      <p className={cn("mt-0.5 text-sm", face.temp > 400 ? "text-fire" : "text-fg")}>{face.temp.toFixed(0)}°C</p>
      <p className={cn(face.cap < 0.45 ? "text-danger" : "text-muted")}>{(face.cap * 100).toFixed(0)}% fy</p>
    </div>
  );
}

function CapBar({ label, hint, value }: { label: string; hint: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const tone = value < 0.45 ? "text-danger" : value < 0.85 ? "text-warn" : "text-ok";
  const bar = value < 0.45 ? "bg-danger" : value < 0.85 ? "bg-warn" : "bg-ok";
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-2xs uppercase tracking-wider text-muted">
        <Tip label={label} hint={hint} />
        <span className={cn("tabular-nums", tone)}>{(pct * 100).toFixed(0)}% strength</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function Notes() {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted">
      <p>
        This is a live 3D integrator, not a clip. Bonfires and houses are discrete members: heat, remaining strength,
        then gravity and collisions. The towers are a lumped tube-in-tube with five column groups, Eurocode 3 steel,
        and Bazant-style crush. Neither is NIST NCSTAR 1. Both are the same argument: pieces form rubble.
      </p>
      <p>
        Fire Speed is a heating time-scale, not a gravity time-scale. Collapse always integrates at 1×. Rigid-tree mode
        is the control: forbid floor failure and the upper block is a chimney. That is the assumption you need to get a
        tip-over.
      </p>
      <p>
        Change “Fire stays put” or “Impact only” and the Euler steps come out differently. That is the debate. The
        source of the step is the lab, not a rendered movie.
      </p>
    </div>
  );
}
