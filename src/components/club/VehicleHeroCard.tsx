import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import carHero from "@/assets/car-hero.png";

type Vehicle = {
  id: string;
  brand: string;
  model: string;
  color: string | null;
  plate: string;
  image_url: string | null;
  image_status: string | null;
};

type Props = {
  vehicle: Vehicle;
  planLabel: string;
  statusDot: string;
  statusText: string;
  isActive: boolean;
  nextAt?: string | null;
  lastAt?: string | null;
  onArtReady?: (url: string) => void;
};

export function VehicleHeroCard({
  vehicle,
  planLabel,
  statusDot,
  statusText,
  isActive,
  nextAt,
  lastAt,
  onArtReady,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(vehicle.image_url);
  const [loaded, setLoaded] = useState(false);

  // Auto-generate art if missing
  useEffect(() => {
    if (imgUrl || generating) return;
    if (vehicle.image_status === "generating") return;
    let cancelled = false;
    (async () => {
      setGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-vehicle-art", {
          body: { vehicleId: vehicle.id },
        });
        if (cancelled) return;
        if (!error && data?.image_url) {
          setImgUrl(data.image_url);
          onArtReady?.(data.image_url);
        }
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  // Parallax — mouse + scroll
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    setTilt({ x, y });
  };
  const onLeave = () => setTilt({ x: 0, y: 0 });

  useEffect(() => {
    const onScroll = () => {
      const el = cardRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const center = r.top + r.height / 2 - window.innerHeight / 2;
      setScrollY(Math.max(-1, Math.min(1, -center / window.innerHeight)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const carShift = `translate3d(${tilt.x * 10}px, ${tilt.y * 6 + scrollY * -14}px, 0)`;
  const glowShift = `translate3d(${tilt.x * 30}px, ${tilt.y * 20}px, 0)`;

  return (
    <section
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="anim-rise anim-rise-1 group relative overflow-hidden rounded-[32px] border border-white/[0.07] shadow-[var(--shadow-float)]"
      style={{ aspectRatio: "4 / 5", maxHeight: "640px" }}
    >
      {/* Hero image */}
      <div className="absolute inset-0">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={`${vehicle.brand} ${vehicle.model}`}
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-out ${
              loaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
            }`}
            style={{ transform: `${loaded ? "scale(1.04)" : "scale(1.08)"} ${carShift}` }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--gradient-hero)]">
            <img
              src={carHero}
              alt=""
              className="h-2/5 w-auto opacity-30 blur-[2px]"
              style={{ transform: carShift }}
            />
          </div>
        )}

        {/* Ambient color blobs reacting to mouse */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/35 blur-3xl transition-transform duration-300"
          style={{ transform: glowShift }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-[oklch(0.55_0.18_220)]/30 blur-3xl transition-transform duration-300"
          style={{ transform: glowShift }}
        />

        {/* Cinematic gradient overlays */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/55" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_120%,oklch(0.85_0.22_145/0.15),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        {/* Film grain */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage: "radial-gradient(oklch(1 0 0) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />
      </div>

      {/* Loading shimmer */}
      {generating && !imgUrl && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Renderizando seu veículo
          </p>
        </div>
      )}

      {/* Top — plan badge */}
      <div className="absolute inset-x-5 top-5 z-10 flex items-start justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-white/60">
            Clube Detail · Member
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 backdrop-blur-md">
          <span
            className={`h-1.5 w-1.5 rounded-full ${statusDot} ${isActive ? "animate-pulse" : ""}`}
          />
          <span className={`text-[10px] font-medium uppercase tracking-wider ${statusText}`}>
            {planLabel}
          </span>
        </span>
      </div>

      {/* Bottom — info */}
      <div className="absolute inset-x-5 bottom-5 z-10 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
            {vehicle.color || "—"}
          </div>
          <h2 className="text-display mt-0.5 text-2xl leading-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] sm:text-3xl">
            {vehicle.brand} <span className="text-white/80">{vehicle.model}</span>
          </h2>
        </div>

        {/* Plate */}
        <div className="flex justify-start">
          <div className="rounded-xl border border-white/20 bg-white/[0.08] px-4 py-1.5 font-mono text-[15px] tracking-[0.4em] text-white backdrop-blur-md">
            {vehicle.plate}
          </div>
        </div>

        {/* Stats inline */}
        <div className="grid grid-cols-2 gap-2">
          <MiniStat
            icon={Calendar}
            label="Próxima"
            value={nextAt ? format(new Date(nextAt), "dd MMM · HH:mm", { locale: ptBR }) : "—"}
          />
          <MiniStat
            icon={Sparkles}
            label="Última"
            value={lastAt ? format(new Date(lastAt), "dd MMM", { locale: ptBR }) : "—"}
          />
        </div>
      </div>
    </section>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-3 py-2 backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-white/55">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 text-[13px] font-medium tracking-tight text-white">{value}</div>
    </div>
  );
}
