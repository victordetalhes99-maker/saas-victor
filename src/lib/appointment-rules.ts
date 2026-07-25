export const ACTIVE_APPOINTMENT_STATUSES = ["scheduled", "confirmed", "in_progress"] as const;

export type ActiveAppointmentStatus = (typeof ACTIVE_APPOINTMENT_STATUSES)[number];

export type AppointmentWindow = {
  scheduledAt: string;
  estimatedMinutes: number;
  status?: string;
};

export type ExtraLike = {
  id: string;
  active: boolean;
  duration_minutes: number;
  price_cents: number;
};

export function calculateAppointmentEnd(scheduledAt: string, estimatedMinutes: number) {
  return new Date(new Date(scheduledAt).getTime() + Math.max(estimatedMinutes, 1) * 60_000);
}

export function intervalsOverlap(
  startA: string | Date,
  endA: string | Date,
  startB: string | Date,
  endB: string | Date,
) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();
  return aStart < bEnd && aEnd > bStart;
}

export function appointmentIntervalsOverlap(
  candidate: Pick<AppointmentWindow, "scheduledAt" | "estimatedMinutes">,
  existing: Pick<AppointmentWindow, "scheduledAt" | "estimatedMinutes">,
) {
  return intervalsOverlap(
    candidate.scheduledAt,
    calculateAppointmentEnd(candidate.scheduledAt, candidate.estimatedMinutes),
    existing.scheduledAt,
    calculateAppointmentEnd(existing.scheduledAt, existing.estimatedMinutes),
  );
}

export function hasActiveAppointmentCollision(
  candidate: Pick<AppointmentWindow, "scheduledAt" | "estimatedMinutes">,
  existingAppointments: AppointmentWindow[],
) {
  return existingAppointments.some((existing) => {
    if (
      !existing.status ||
      !ACTIVE_APPOINTMENT_STATUSES.includes(existing.status as ActiveAppointmentStatus)
    ) {
      return false;
    }
    return appointmentIntervalsOverlap(candidate, existing);
  });
}

export function calculateExtraTotals(planDurationMinutes: number, extras: ExtraLike[]) {
  const activeExtras = extras.filter((extra) => extra.active);
  const extraDurationMinutes = activeExtras.reduce((sum, extra) => sum + extra.duration_minutes, 0);
  const extraPriceCents = activeExtras.reduce((sum, extra) => sum + extra.price_cents, 0);

  return {
    totalDurationMinutes: Math.max(planDurationMinutes + extraDurationMinutes, 1),
    totalExtraPriceCents: extraPriceCents,
  };
}

export type BookingWindowRules = {
  emergencyMode: boolean;
  minLeadMinutes: number;
};

export type BookingWindowResult =
  { ok: true } | { ok: false; reason: "emergency_mode" | "past" | "lead_time" };

/**
 * Mirrors the checks added to create_client_appointment in
 * supabase/migrations/20260725000000_enforce_booking_rules.sql:
 * emergency_mode blocks all new bookings, and min_booking_lead_minutes
 * requires a minimum gap between "now" and the requested slot. Both
 * settings existed in the admin UI/schema before but were never enforced.
 */
export function validateBookingWindow(
  scheduledAt: string | Date,
  now: string | Date,
  rules: BookingWindowRules,
): BookingWindowResult {
  if (rules.emergencyMode) return { ok: false, reason: "emergency_mode" };

  const scheduledMs = new Date(scheduledAt).getTime();
  const nowMs = new Date(now).getTime();
  if (scheduledMs <= nowMs) return { ok: false, reason: "past" };

  if (rules.minLeadMinutes > 0 && scheduledMs < nowMs + rules.minLeadMinutes * 60_000) {
    return { ok: false, reason: "lead_time" };
  }

  return { ok: true };
}

export function validateVehicleOwnership(
  ownerUserId: string,
  vehicleUserId: string | null | undefined,
) {
  return !!vehicleUserId && ownerUserId === vehicleUserId;
}

type AtomicBookingStore = {
  runExclusive<T>(work: () => Promise<T>): Promise<T>;
  bookings: AppointmentWindow[];
};

export function createAtomicBookingStore(
  existingBookings: AppointmentWindow[] = [],
): AtomicBookingStore {
  let queue = Promise.resolve();
  const bookings = [...existingBookings];

  return {
    bookings,
    async runExclusive<T>(work: () => Promise<T>) {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await work();
      } finally {
        release();
      }
    },
  };
}

export async function createBookingAtomically(
  store: AtomicBookingStore,
  candidate: AppointmentWindow,
) {
  return store.runExclusive(async () => {
    if (hasActiveAppointmentCollision(candidate, store.bookings)) {
      return { ok: false as const, reason: "slot_conflict" };
    }
    store.bookings.push({ ...candidate, status: candidate.status ?? "scheduled" });
    return { ok: true as const };
  });
}
