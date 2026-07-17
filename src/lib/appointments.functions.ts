import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const appointmentSchema = z.object({
  scheduledAt: z.string().datetime(),
  vehicleId: z.string().uuid().nullable(),
  extraServiceIds: z.array(z.string().uuid()).max(12).default([]),
});

type CreateAppointmentResult = {
  appointment_id: string;
  scheduled_at: string;
  estimated_minutes: number;
  total_extras_cents: number;
};

type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
};

function throwJsonError(status: number, error: string, message: string): never {
  throw new Response(JSON.stringify({ error, message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function throwCreateAppointmentRpcError(error: RpcErrorLike): never {
  const normalizedMessage = (error.message ?? "").toLowerCase();

  if (
    error.code === "PGRST202" ||
    normalizedMessage.includes("create_client_appointment") ||
    normalizedMessage.includes("function public.create_client_appointment")
  ) {
    throwJsonError(
      503,
      "booking_not_ready",
      "O agendamento seguro ainda não foi habilitado neste ambiente. Solicite a aplicação da migration antes de tentar novamente.",
    );
  }

  if (error.code === "P0001") {
    throwJsonError(400, "booking_invalid", error.message ?? "Agendamento inválido.");
  }

  if (error.code === "23505" || error.code === "23P01") {
    throwJsonError(409, "slot_conflict", "Este horário não está mais disponível. Escolha outro.");
  }

  throwJsonError(500, "booking_failed", "Não foi possível concluir o agendamento.");
}

export const createClientAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => appointmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { scheduledAt, vehicleId, extraServiceIds } = data;
    const dedupedExtraIds = [...new Set(extraServiceIds)];

    const { data: result, error } = await context.supabase.rpc("create_client_appointment", {
      _scheduled_at: scheduledAt,
      _vehicle_id: vehicleId,
      _extra_service_ids: dedupedExtraIds,
    });

    if (error) {
      throwCreateAppointmentRpcError(error);
    }

    const appointment = Array.isArray(result) ? result[0] : result;
    if (!appointment?.appointment_id) {
      throwJsonError(500, "booking_failed", "Resposta inválida ao criar o agendamento.");
    }

    return appointment as CreateAppointmentResult;
  });
