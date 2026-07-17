import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Car,
  Calendar,
  CheckCircle2,
  Camera,
  Pencil,
  History,
  Plus,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Trash2,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { VehicleUploader } from "@/components/VehicleUploader";

export const Route = createFileRoute("/_authenticated/veiculos")({
  component: VehiclesPage,
});

type Vehicle = {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  color: string | null;
  plate: string;
  year: number | null;
  mileage: number | null;
  notes: string | null;
  image_url: string | null;
  image_status: string | null;
  created_at: string;
};

function statusInfo(s?: string) {
  if (s === "active") return { label: "Ativa", dot: "bg-primary", text: "text-primary" };
  if (s === "expired") return { label: "Vencida", dot: "bg-destructive", text: "text-destructive" };
  if (s === "cancelled")
    return { label: "Cancelada", dot: "bg-muted-foreground", text: "text-muted-foreground" };
  return { label: "Pendente", dot: "bg-amber-400", text: "text-amber-400" };
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function VehiclesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [photoVehicle, setPhotoVehicle] = useState<Vehicle | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-all", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      return (data ?? []) as Vehicle[];
    },
  });

  const { data: sub } = useQuery({
    queryKey: ["sub", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("subscriptions")
          .select("*, plans(*)")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const active = vehicles?.[index] ?? null;

  const { data: nextAppt } = useQuery({
    queryKey: ["v-next", active?.id],
    enabled: !!active,
    queryFn: async () =>
      (
        await supabase
          .from("appointments")
          .select("scheduled_at, status")
          .eq("user_id", user!.id)
          .eq("vehicle_id", active!.id)
          .in("status", ["scheduled", "confirmed", "in_progress"])
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const { data: lastAppt } = useQuery({
    queryKey: ["v-last", active?.id],
    enabled: !!active,
    queryFn: async () =>
      (
        await supabase
          .from("appointments")
          .select("scheduled_at")
          .eq("user_id", user!.id)
          .eq("vehicle_id", active!.id)
          .eq("status", "completed")
          .order("scheduled_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  const totalWashes = sub?.plans?.washes_per_month ?? 0;
  const usedWashes = sub?.washes_used ?? 0;
  const remainingWashes = Math.max(0, totalWashes - usedWashes);
  const st = statusInfo(sub?.status);

  const hasVehicles = (vehicles?.length ?? 0) > 0;

  const next = () => setIndex((i) => Math.min((vehicles?.length ?? 1) - 1, i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <div className="space-y-7 pb-8">
      <header className="anim-rise pt-4">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/80">
          Minha garagem
        </p>
        <h1 className="mt-1 text-display text-[34px] leading-[1.05] sm:text-[42px] text-gradient">
          Veículo & Assinatura
        </h1>
      </header>

      {!hasVehicles ? (
        <EmptyGarage onCreate={() => setCreating(true)} />
      ) : (
        <>
          {/* Carousel indicators */}
          {(vehicles?.length ?? 0) > 1 && (
            <div className="anim-rise flex items-center justify-between">
              <button
                onClick={prev}
                disabled={index === 0}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-foreground transition disabled:opacity-30 hover:bg-white/[0.08]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                {vehicles!.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`Veículo ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1.5 bg-white/20"}`}
                  />
                ))}
              </div>
              <button
                onClick={next}
                disabled={index >= (vehicles?.length ?? 1) - 1}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-foreground transition disabled:opacity-30 hover:bg-white/[0.08]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {active && (
            <GarageStage
              vehicle={active}
              planLabel={sub?.plans?.name ?? "Sem plano"}
              status={st}
              onRequestUpload={() => setPhotoVehicle(active)}
            />
          )}

          {/* Quick info grid — status-focused */}
          {active && (
            <div className="anim-rise anim-rise-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <InfoCell label="Status" value={st.label} tone={st.text} />
              <InfoCell
                label="Próxima lavagem"
                value={
                  nextAppt?.scheduled_at
                    ? format(new Date(nextAppt.scheduled_at), "dd MMM · HH:mm", { locale: ptBR })
                    : "Ainda não agendada"
                }
              />
              <InfoCell label="Plano atual" value={sub?.plans?.name ?? "—"} />
              <InfoCell
                label="Lavagens restantes"
                value={totalWashes > 0 ? `${remainingWashes} / ${totalWashes}` : "Ilimitado"}
                tone="text-primary"
              />
            </div>
          )}

          {/* Seu Plano — benefícios inclusos */}
          {active && (
            <PlanBenefits
              planName={sub?.plans?.name ?? null}
              benefits={(sub?.plans?.benefits as string[] | null) ?? null}
            />
          )}

          {/* Actions */}
          {active && (
            <div className="anim-rise anim-rise-3 grid grid-cols-3 gap-2.5">
              <ActionBtn
                to={`/agendar`}
                icon={Calendar}
                label="Agendar"
                primary
                disabled={sub?.status !== "active"}
              />
              <ActionBtn
                onClick={() => setPhotoVehicle(active)}
                icon={Camera}
                label={active.image_url ? "Trocar foto" : "Adicionar foto"}
              />
              <ActionBtn to="/historico" icon={History} label="Histórico" />
            </div>
          )}
        </>
      )}

      {editing && (
        <VehicleEditor
          vehicle={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["vehicles-all"] });
            setEditing(null);
          }}
        />
      )}
      {creating && (
        <VehicleEditor
          onClose={() => setCreating(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["vehicles-all"] });
            setCreating(false);
          }}
        />
      )}
      {photoVehicle && (
        <PhotoUploader
          vehicle={photoVehicle}
          onClose={() => setPhotoVehicle(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["vehicles-all"] });
            setPhotoVehicle(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------- Empty ------------------------- */

function EmptyGarage({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="anim-rise anim-rise-1 relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[var(--gradient-hero)] p-8 shadow-[var(--shadow-float)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="relative flex flex-col items-center text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-primary shadow-[var(--shadow-glow-soft)]">
          <Car className="h-7 w-7" />
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-primary/80">
          Garagem digital
        </p>
        <h2 className="text-display mt-2 text-2xl leading-tight">Sua garagem está vazia</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Cadastre seu veículo para acompanhar seu plano, lavagens e próximos atendimentos.
        </p>
        <Button
          onClick={onCreate}
          className="mt-5 h-12 gap-2 rounded-2xl bg-primary px-6 text-primary-foreground shadow-[var(--shadow-glow-soft)] hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Cadastrar veículo
        </Button>
      </div>
    </section>
  );
}

/* ------------------------- Stage (visual) ------------------------- */

function GarageStage({
  vehicle,
  planLabel,
  status,
  onRequestUpload,
}: {
  vehicle: Vehicle;
  planLabel: string;
  status: ReturnType<typeof statusInfo>;
  onRequestUpload?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const reduce = prefersReducedMotion();

  useEffect(() => {
    if (!drag.active && (drag.x !== 0 || drag.y !== 0)) {
      const t = setTimeout(() => setDrag({ x: 0, y: 0, active: false }), 20);
      return () => clearTimeout(t);
    }
  }, [drag.active]);

  const start = (cx: number, cy: number) => {
    if (reduce) return;
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDrag({ x: 0, y: 0, active: true });
    (el as any)._origin = { cx, cy, r };
  };
  const move = (cx: number, cy: number) => {
    const el = stageRef.current as any;
    if (!el?._origin || !drag.active) return;
    const { cx: ox, cy: oy, r } = el._origin;
    const nx = Math.max(-1, Math.min(1, (cx - ox) / (r.width / 2)));
    const ny = Math.max(-1, Math.min(1, (cy - oy) / (r.height / 2)));
    setDrag({ x: nx, y: ny, active: true });
  };
  const end = () => setDrag((d) => ({ ...d, active: false }));

  const carT = reduce
    ? ""
    : `perspective(1200px) rotateY(${drag.x * 12}deg) rotateX(${-drag.y * 6}deg) translate3d(${drag.x * 14}px, ${drag.y * 6}px, 0)`;
  const glowT = reduce ? "" : `translate3d(${drag.x * 40}px, ${drag.y * 24}px, 0)`;
  const reflectT = reduce ? "" : `translateX(${drag.x * -30}px)`;

  const vehicleName = `${vehicle.brand} ${vehicle.model}`.trim();

  return (
    <section
      ref={stageRef}
      className="anim-rise anim-rise-1 group relative overflow-hidden rounded-[32px] border border-white/[0.07] shadow-[var(--shadow-float)] select-none"
      style={{ aspectRatio: "4 / 5", maxHeight: "620px", touchAction: "pan-y" }}
      onMouseDown={(e) => start(e.clientX, e.clientY)}
      onMouseMove={(e) => move(e.clientX, e.clientY)}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={(e) => {
        const t = e.touches[0];
        start(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        move(t.clientX, t.clientY);
      }}
      onTouchEnd={end}
    >
      {/* Floor + ambient */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.14_0.02_155)_0%,oklch(0.10_0.01_150)_60%,oklch(0.07_0.005_150)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[radial-gradient(60%_100%_at_50%_100%,oklch(0.85_0.22_145/0.18),transparent_75%)]" />
      <div
        className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/25 blur-3xl transition-transform duration-500"
        style={{ transform: glowT }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-20 h-72 w-72 rounded-full bg-[oklch(0.55_0.18_220)]/20 blur-3xl transition-transform duration-500"
        style={{ transform: glowT }}
      />

      {/* Vehicle image */}
      <VehicleImage
        vehicle={vehicle}
        carT={carT}
        reflectT={reflectT}
        onRequestUpload={onRequestUpload}
      />

      {/* Contact shadow */}
      <div
        className="pointer-events-none absolute inset-x-[15%] bottom-[15%] h-6 rounded-[50%] bg-black/60 blur-lg transition-transform duration-300"
        style={{
          transform: reduce
            ? undefined
            : `translateX(${drag.x * 20}px) scaleX(${1 + Math.abs(drag.x) * 0.15})`,
        }}
      />

      {/* Overlays — base gradient makes the title float */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/[0.04]" />

      {/* Top row */}
      <div className="absolute inset-x-5 top-5 z-10 flex items-start justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-white/60">
          Clube Detail · Member
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 backdrop-blur-md">
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot} animate-pulse`} />
          <span className={`text-[10px] font-medium uppercase tracking-wider ${status.text}`}>
            {planLabel} · {status.label}
          </span>
        </span>
      </div>

      {/* Bottom row */}
      <div className="absolute inset-x-5 bottom-5 z-10">
        <h2 className="text-display text-3xl leading-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] sm:text-4xl">
          {vehicleName}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/65">
          {vehicle.year && <span>{vehicle.year}</span>}
          {vehicle.year && (
            <span aria-hidden className="text-white/25">
              ·
            </span>
          )}
          {vehicle.color && <span>{vehicle.color}</span>}
          <span
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/55 px-2 py-1 font-mono text-[11px] font-semibold tracking-[0.25em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.6)] backdrop-blur-md"
            aria-label={`Placa ${vehicle.plate}`}
          >
            {vehicle.plate}
          </span>
        </div>
        {!vehicle.image_url && (
          <div className="mt-3">
            <span className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/70 backdrop-blur-md">
              Representação ilustrativa
            </span>
          </div>
        )}
        {!reduce && (
          <div className="mt-3 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/50">
            <span className="h-px w-6 bg-white/20" /> Arraste para visualizar{" "}
            <span className="h-px w-6 bg-white/20" />
          </div>
        )}
      </div>
    </section>
  );
}

function VehicleImage({
  vehicle,
  carT,
  reflectT,
  onRequestUpload,
}: {
  vehicle: Vehicle;
  carT: string;
  reflectT: string;
  onRequestUpload?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [url, setUrl] = useState<string | null>(vehicle.image_url);

  useEffect(() => {
    setUrl(vehicle.image_url);
    setLoaded(false);
  }, [vehicle.id, vehicle.image_url]);

  useEffect(() => {
    if (url || generating || vehicle.image_status === "generating") return;
    let cancelled = false;
    (async () => {
      setGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-vehicle-art", {
          body: { vehicleId: vehicle.id },
        });
        if (!cancelled && !error && data?.image_url) setUrl(data.image_url);
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  if (generating && !url) {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/20 backdrop-blur-sm">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Renderizando veículo
        </p>
      </div>
    );
  }

  if (!url) {
    // Silhouette fallback — clickable to upload a real photo
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRequestUpload?.();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="group absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 focus:outline-none"
        aria-label="Adicionar foto do veículo"
      >
        <Car
          className="h-40 w-40 text-white/10 transition-transform duration-300 group-hover:scale-105"
          style={{ transform: carT }}
        />
        <span className="pointer-events-none inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/80 backdrop-blur-md transition group-hover:border-primary/40 group-hover:text-white">
          <Camera className="h-3.5 w-3.5" />
          Adicionar foto
        </span>
      </button>
    );
  }

  return (
    <>
      {/* Reflection */}
      <div
        className="pointer-events-none absolute inset-x-[10%] bottom-[8%] h-[35%] overflow-hidden opacity-30 blur-[2px]"
        style={{
          transform: `scaleY(-1) ${reflectT}`,
          maskImage: "linear-gradient(to bottom, transparent 0%, black 60%)",
        }}
      >
        <img src={url} alt="" className="h-full w-full object-contain" />
      </div>
      <img
        src={url}
        alt={`${vehicle.brand} ${vehicle.model}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ transform: carT }}
      />
    </>
  );
}

/* ------------------------- Info & actions ------------------------- */

function InfoCell({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-4 backdrop-blur-md transition-colors hover:border-white/[0.1] hover:bg-white/[0.04]">
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="text-[9px] font-medium uppercase tracking-[0.28em] text-muted-foreground/70">
        {label}
      </div>
      <div
        className={`mt-2 truncate text-[15px] font-semibold leading-tight tracking-tight ${mono ? "font-mono tracking-[0.15em]" : ""} ${tone ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function ActionBtn({
  to,
  onClick,
  icon: Icon,
  label,
  primary,
  disabled,
}: {
  to?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const cls = `group flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-medium tracking-tight transition-all duration-300 active:scale-[0.97] ${
    primary
      ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)] hover:bg-primary/90"
      : "border border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.08]"
  } ${disabled ? "pointer-events-none opacity-40" : ""}`;
  const content = (
    <>
      <Icon className="h-4 w-4 transition-transform group-hover:scale-110" /> {label}
    </>
  );
  if (to && !disabled)
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {content}
    </button>
  );
}

/* ------------------------- Editor ------------------------- */

function VehicleEditor({
  vehicle,
  onClose,
  onSaved,
}: {
  vehicle?: Vehicle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    brand: vehicle?.brand ?? "",
    model: vehicle?.model ?? "",
    year: vehicle?.year?.toString() ?? "",
    color: vehicle?.color ?? "",
    plate: vehicle?.plate ?? "",
    notes: vehicle?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const setPlate = (v: string) => {
    const clean = v
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7);
    let out = clean;
    if (clean.length > 3) out = `${clean.slice(0, 3)}-${clean.slice(3)}`;
    setForm({ ...form, plate: out });
  };

  const save = async () => {
    if (!form.brand.trim() || !form.model.trim() || !form.plate.trim()) {
      toast.error("Marca, modelo e placa são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: form.year ? Number(form.year) : null,
        color: form.color.trim() || null,
        plate: form.plate.trim().toUpperCase(),
        notes: form.notes.trim() || null,
      };
      const { error } = vehicle
        ? await supabase.from("vehicles").update(payload).eq("id", vehicle.id)
        : await supabase.from("vehicles").insert({ ...payload, user_id: user!.id });
      if (error) toast.error(error.message);
      else {
        toast.success(vehicle ? "Veículo atualizado" : "Veículo cadastrado");
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!vehicle || !confirm(`Remover ${vehicle.brand} ${vehicle.model}?`)) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Veículo removido");
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl border-white/10 bg-[oklch(0.11_0.01_155)]">
        <DialogHeader>
          <DialogTitle className="text-display text-xl">
            {vehicle ? "Editar veículo" : "Novo veículo"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Marca *"
            value={form.brand}
            onChange={(v) => setForm({ ...form, brand: v })}
            placeholder="Honda"
          />
          <Field
            label="Modelo *"
            value={form.model}
            onChange={(v) => setForm({ ...form, model: v })}
            placeholder="Civic Touring"
          />
          <Field
            label="Ano"
            value={form.year}
            onChange={(v) => setForm({ ...form, year: v.replace(/\D/g, "").slice(0, 4) })}
            placeholder="2023"
            inputMode="numeric"
          />
          <Field
            label="Cor"
            value={form.color}
            onChange={(v) => setForm({ ...form, color: v })}
            placeholder="Branco Pérola"
          />
          <div className="sm:col-span-2">
            <Field
              label="Placa *"
              value={form.plate}
              onChange={setPlate}
              placeholder="ABC-1D23"
              mono
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Observações"
              value={form.notes}
              onChange={(v) => setForm({ ...form, notes: v })}
              placeholder="Versão, categoria ou detalhes"
            />
          </div>
        </div>
        <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {vehicle && (
            <Button
              variant="ghost"
              onClick={remove}
              className="gap-2 rounded-full text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Remover
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full border-white/10 bg-white/[0.04]"
            >
              Cancelar
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="gap-2 rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`h-11 rounded-xl border-white/10 bg-white/[0.04] ${mono ? "font-mono tracking-[0.2em]" : ""}`}
      />
    </label>
  );
}

/* ------------------------- Photo upload ------------------------- */

function PhotoUploader({
  vehicle,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl border-white/10 bg-[oklch(0.11_0.01_155)]">
        <DialogHeader>
          <DialogTitle className="text-display text-xl">Foto do veículo</DialogTitle>
        </DialogHeader>

        <VehicleUploader
          userId={user.id}
          vehicleId={vehicle.id}
          value={vehicle.image_url}
          onChange={() => onSaved()}
        />

        <DialogFooter className="mt-1">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-full border-white/10 bg-white/[0.04]"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function compressImage(file: File): Promise<File> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const maxW = 1600;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<File>((res) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return res(file);
        res(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.88,
    );
  });
}

/* ------------------------- Plan Benefits ------------------------- */

const DEFAULT_BENEFITS = ["Lavagens ilimitadas", "Polimento trimestral", "Atendimento prioritário"];

function PlanBenefits({
  planName,
  benefits,
}: {
  planName: string | null;
  benefits: string[] | null;
}) {
  const items = Array.isArray(benefits) && benefits.length > 0 ? benefits : DEFAULT_BENEFITS;

  return (
    <section className="anim-rise anim-rise-2 relative overflow-hidden rounded-3xl border border-white/[0.07] bg-card/60 p-6 shadow-[var(--shadow-float)] backdrop-blur-xl sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground/70">
            Seu plano
          </p>
          <h3 className="text-display mt-1.5 text-xl leading-tight text-foreground">
            {planName ?? "Benefícios inclusos"}
          </h3>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-[0_0_24px_-6px_var(--tw-shadow-color)] shadow-primary/40">
          <Sparkles className="h-4 w-4" />
        </span>
      </div>
      <ul className="relative mt-5 grid gap-1 sm:grid-cols-2 sm:gap-x-6">
        {items.map((b) => (
          <li key={b} className="flex items-center gap-3 py-2.5">
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25 shadow-[0_0_16px_-4px_var(--tw-shadow-color)] shadow-primary/60"
              aria-hidden
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="text-[14px] leading-snug text-foreground/90">{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
