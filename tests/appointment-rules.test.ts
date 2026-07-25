import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  calculateExtraTotals,
  createAtomicBookingStore,
  createBookingAtomically,
  hasActiveAppointmentCollision,
  validateBookingWindow,
  validateVehicleOwnership,
} from "../src/lib/appointment-rules";

const BASE = "2026-07-20T09:00:00.000Z";

test("ACTIVE_APPOINTMENT_STATUSES ignores cancelled appointments", () => {
  assert.deepEqual([...ACTIVE_APPOINTMENT_STATUSES], ["scheduled", "confirmed", "in_progress"]);
});

test("horario livre nao colide", () => {
  const collision = hasActiveAppointmentCollision(
    { scheduledAt: "2026-07-20T11:00:00.000Z", estimatedMinutes: 60 },
    [{ scheduledAt: BASE, estimatedMinutes: 60, status: "scheduled" }],
  );
  assert.equal(collision, false);
});

test("colisao exata bloqueia", () => {
  const collision = hasActiveAppointmentCollision({ scheduledAt: BASE, estimatedMinutes: 60 }, [
    { scheduledAt: BASE, estimatedMinutes: 60, status: "scheduled" },
  ]);
  assert.equal(collision, true);
});

test("colisao parcial no inicio bloqueia", () => {
  const collision = hasActiveAppointmentCollision(
    { scheduledAt: "2026-07-20T08:30:00.000Z", estimatedMinutes: 60 },
    [{ scheduledAt: BASE, estimatedMinutes: 60, status: "scheduled" }],
  );
  assert.equal(collision, true);
});

test("colisao parcial no final bloqueia", () => {
  const collision = hasActiveAppointmentCollision(
    { scheduledAt: "2026-07-20T09:30:00.000Z", estimatedMinutes: 60 },
    [{ scheduledAt: BASE, estimatedMinutes: 60, status: "scheduled" }],
  );
  assert.equal(collision, true);
});

test("horario totalmente dentro de outro bloqueia", () => {
  const collision = hasActiveAppointmentCollision(
    { scheduledAt: "2026-07-20T09:15:00.000Z", estimatedMinutes: 15 },
    [{ scheduledAt: BASE, estimatedMinutes: 60, status: "scheduled" }],
  );
  assert.equal(collision, true);
});

test("horario que contem outro bloqueia", () => {
  const collision = hasActiveAppointmentCollision(
    { scheduledAt: "2026-07-20T08:45:00.000Z", estimatedMinutes: 120 },
    [{ scheduledAt: BASE, estimatedMinutes: 30, status: "scheduled" }],
  );
  assert.equal(collision, true);
});

test("horarios adjacentes nao conflitam", () => {
  const collision = hasActiveAppointmentCollision(
    { scheduledAt: "2026-07-20T10:00:00.000Z", estimatedMinutes: 30 },
    [{ scheduledAt: BASE, estimatedMinutes: 60, status: "scheduled" }],
  );
  assert.equal(collision, false);
});

test("usuario nao pode usar veiculo de outro cliente", () => {
  assert.equal(validateVehicleOwnership("user-a", "user-b"), false);
  assert.equal(validateVehicleOwnership("user-a", "user-a"), true);
});

test("extra aumenta duracao e preco no servidor", () => {
  const totals = calculateExtraTotals(45, [
    { id: "1", active: true, duration_minutes: 15, price_cents: 2500 },
    { id: "2", active: true, duration_minutes: 30, price_cents: 4000 },
  ]);

  assert.deepEqual(totals, {
    totalDurationMinutes: 90,
    totalExtraPriceCents: 6500,
  });
});

test("duas requisicoes simultaneas aceitam uma e rejeitam outra", async () => {
  const store = createAtomicBookingStore();
  const candidate = { scheduledAt: BASE, estimatedMinutes: 60, status: "scheduled" };

  const [first, second] = await Promise.all([
    createBookingAtomically(store, candidate),
    createBookingAtomically(store, candidate),
  ]);

  const accepted = [first, second].filter((result) => result.ok);
  const rejected = [first, second].filter((result) => !result.ok);

  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0]?.reason, "slot_conflict");
});

test("modo de emergencia bloqueia novos agendamentos", () => {
  const result = validateBookingWindow("2026-07-20T12:00:00.000Z", BASE, {
    emergencyMode: true,
    minLeadMinutes: 0,
  });
  assert.deepEqual(result, { ok: false, reason: "emergency_mode" });
});

test("horario no passado e rejeitado mesmo sem modo de emergencia", () => {
  const result = validateBookingWindow("2026-07-20T08:00:00.000Z", BASE, {
    emergencyMode: false,
    minLeadMinutes: 0,
  });
  assert.deepEqual(result, { ok: false, reason: "past" });
});

test("antecedencia minima rejeita horario muito proximo", () => {
  const result = validateBookingWindow("2026-07-20T09:10:00.000Z", BASE, {
    emergencyMode: false,
    minLeadMinutes: 30,
  });
  assert.deepEqual(result, { ok: false, reason: "lead_time" });
});

test("antecedencia minima aceita horario suficientemente distante", () => {
  const result = validateBookingWindow("2026-07-20T09:45:00.000Z", BASE, {
    emergencyMode: false,
    minLeadMinutes: 30,
  });
  assert.deepEqual(result, { ok: true });
});
