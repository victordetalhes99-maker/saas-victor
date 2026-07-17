import assert from "node:assert/strict";
import test from "node:test";
import { throwCreateAppointmentRpcError } from "../src/lib/appointments.functions";

async function getErrorPayload(response: Response) {
  return (await response.json()) as { error?: string; message?: string };
}

test("rpc ausente retorna erro claro e nao cria agendamento parcial", async () => {
  let thrown: unknown;

  try {
    throwCreateAppointmentRpcError({
      code: "PGRST202",
      message: "Could not find the function public.create_client_appointment",
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof Response);
  assert.equal(thrown.status, 503);

  const payload = await getErrorPayload(thrown);
  assert.equal(payload.error, "booking_not_ready");
  assert.match(payload.message ?? "", /migration/i);
});

test("colisao de horario retorna conflito", async () => {
  let thrown: unknown;

  try {
    throwCreateAppointmentRpcError({
      code: "23P01",
      message: "conflicting key value violates exclusion constraint",
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof Response);
  assert.equal(thrown.status, 409);

  const payload = await getErrorPayload(thrown);
  assert.equal(payload.error, "slot_conflict");
});
