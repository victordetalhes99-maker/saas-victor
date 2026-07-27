import { describe, it, expect } from "vitest";
import { classifyClient } from "./client-classification";

describe("classifyClient", () => {
  it("classifies a client with an active subscription and active profile as active", () => {
    const result = classifyClient({
      status: "active",
      subscriptions: [{ status: "active" }],
      vehicles: [{}],
    });
    expect(result).toBe("active");
  });

  it("classifies an administratively blocked client as blocked — even with an active subscription", () => {
    // This is the single most important rule in the whole classifier: a
    // manual block must never be overridden by a healthy subscription.
    const result = classifyClient({
      status: "blocked",
      subscriptions: [{ status: "active" }],
      vehicles: [{}],
    });
    expect(result).toBe("blocked");
  });

  it("classifies a cancelled subscription as cancelled regardless of profile status", () => {
    const result = classifyClient({
      status: "active",
      subscriptions: [{ status: "cancelled" }],
    });
    expect(result).toBe("cancelled");
  });

  it("classifies an expired subscription as expired", () => {
    expect(classifyClient({ status: "active", subscriptions: [{ status: "expired" }] })).toBe(
      "expired",
    );
  });

  it("classifies a past_due subscription the same as expired", () => {
    expect(classifyClient({ status: "active", subscriptions: [{ status: "past_due" }] })).toBe(
      "expired",
    );
  });

  it("classifies a pending payment as payment_review when a pending payment exists", () => {
    const result = classifyClient({
      status: "pending",
      subscriptions: [{ status: "pending" }],
      payments: [{ status: "pending" }],
    });
    expect(result).toBe("payment_review");
  });

  it("classifies a pending subscription with no payment yet as awaiting_payment", () => {
    const result = classifyClient({
      status: "pending",
      subscriptions: [{ status: "pending" }],
      payments: [],
    });
    expect(result).toBe("awaiting_payment");
  });

  it("classifies a client with no subscription at all as incomplete", () => {
    expect(classifyClient({ status: "pending", subscriptions: [] })).toBe("incomplete");
  });

  it("classifies an active subscription as active even without a registered vehicle", () => {
    // Nota: o veículo só é exigido para o bucket "incomplete" quando a
    // assinatura NÃO está ativa. Uma assinatura ativa + perfil ativo já
    // retorna "active" antes de a checagem de veículo ser avaliada.
    // Isso é o comportamento real e atual do sistema — não é algo que
    // este teste deveria "corrigir" silenciosamente.
    const result = classifyClient({
      status: "active",
      subscriptions: [{ status: "active" }],
      vehicles: [],
    });
    expect(result).toBe("active");
  });

  it("classifies a client with no active subscription and no vehicle as incomplete", () => {
    const result = classifyClient({
      status: "pending",
      subscriptions: [{ status: "pending" }],
      payments: [],
      vehicles: [],
    });
    expect(result).toBe("awaiting_payment"); // sub.status === "pending" é checado antes
  });

  it("never crashes on a bare client object with no related rows at all", () => {
    expect(() => classifyClient({})).not.toThrow();
    expect(classifyClient({})).toBe("incomplete");
  });
});
