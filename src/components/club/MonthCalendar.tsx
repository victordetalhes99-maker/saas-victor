import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type DayMeta = {
  available?: boolean; // has free slots
  full?: boolean; // fully booked
  blocked?: boolean; // any block
  count?: number; // appointment count (admin)
  disabled?: boolean; // not selectable
};

type Props = {
  selected: Date;
  onSelect: (d: Date) => void;
  getMeta?: (day: Date) => DayMeta;
  minDate?: Date;
  // visible month state controlled internally
  initialMonth?: Date;
};

const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];

function MonthGrid({ month, selected, onSelect, getMeta, minDate }: Props & { month: Date }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);
  const today = startOfDay(new Date());

  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEK.map((w, i) => (
        <div
          key={i}
          className="py-1 text-center text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70"
        >
          {w}
        </div>
      ))}
      {days.map((d) => {
        const inMonth = isSameMonth(d, month);
        const isSelected = isSameDay(d, selected);
        const isToday = isSameDay(d, today);
        const meta = getMeta?.(d) ?? {};
        const hasSchedule = Boolean(meta.available || meta.full || meta.count || meta.blocked);
        const past = minDate ? d < startOfDay(minDate) : false;
        const disabled = past || meta.disabled;
        return (
          <button
            key={d.toISOString()}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(startOfDay(d))}
            aria-label={format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            aria-pressed={isSelected}
            className={`relative flex aspect-square items-center justify-center rounded-xl text-[12px] font-medium transition-all duration-200 active:scale-[0.94] ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)]"
                : disabled
                  ? "text-muted-foreground/25"
                  : inMonth
                    ? "bg-white/[0.03] text-foreground hover:bg-white/[0.08]"
                    : "text-muted-foreground/40 hover:bg-white/[0.04]"
            } ${hasSchedule && !isSelected && !disabled ? "border border-primary/30" : "border border-transparent"} ${
              meta.blocked && !isSelected ? "ring-1 ring-rose-400/30" : ""
            } ${isToday && !isSelected ? "ring-1 ring-primary/40" : ""}`}
          >
            <span className="relative z-10">{format(d, "d")}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Compact mini calendar with an "expand" affordance that opens the full month picker. */
export function MonthCalendar(props: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(props.initialMonth ?? props.selected));

  const openFull = () => {
    setMonth(startOfMonth(props.selected));
    setOpen(true);
  };

  const handleSelect = (d: Date) => {
    props.onSelect(d);
    setOpen(false);
  };

  return (
    <>
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={openFull}
            aria-label="Abrir calendário completo"
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
          >
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              aria-label="Mês anterior"
              className="grid h-7 w-7 place-items-center rounded-full border border-white/8 bg-white/[0.03] text-muted-foreground transition hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Próximo mês"
              className="grid h-7 w-7 place-items-center rounded-full border border-white/8 bg-white/[0.03] text-muted-foreground transition hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={openFull}
              aria-label="Expandir calendário completo"
              className="ml-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary transition hover:bg-primary/15"
            >
              Expandir
            </button>
          </div>
        </div>
        <MonthGrid {...props} month={month} onSelect={handleSelect} />
        <div className="mt-2 flex items-center justify-end gap-3 text-[9px] uppercase tracking-wider text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> com agenda
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> cheio
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> bloqueio
          </span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-[28px] border-white/10 bg-background p-5 shadow-2xl backdrop-blur-xl [&>button]:hidden">
          <DialogTitle className="sr-only">Calendário de agendamento</DialogTitle>
          <DialogDescription className="sr-only">
            Escolha qualquer dia disponível no calendário completo para agendar a lavagem.
          </DialogDescription>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-primary/80">
                Calendário
              </p>
              <h3 className="text-display mt-0.5 text-xl tracking-tight">
                {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar calendário"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label="Mês anterior"
              className="h-9 rounded-full border-white/10 bg-white/[0.03]"
              onClick={() => setMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Mês anterior
            </Button>
            <select
              value={month.getFullYear()}
              onChange={(e) => setMonth(new Date(Number(e.target.value), month.getMonth(), 1))}
              aria-label="Selecionar ano"
              className="h-9 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-medium tracking-wide text-foreground outline-none"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map((y) => (
                <option key={y} value={y} className="bg-background">
                  {y}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              aria-label="Próximo mês"
              className="h-9 rounded-full border-white/10 bg-white/[0.03]"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              Próximo <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>

          <MonthGrid {...props} month={month} onSelect={handleSelect} />

          <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/80">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> com agenda
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> cheio
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> bloqueio
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
