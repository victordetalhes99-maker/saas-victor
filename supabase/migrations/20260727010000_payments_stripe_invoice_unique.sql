-- Garante idempotência real na gravação de pagamentos vindos do webhook do
-- Stripe: sem isso, um evento reentregue (retry do Stripe, replay manual,
-- ou o mesmo evento processado duas vezes) podia gerar pagamentos duplicados.
create unique index if not exists payments_stripe_invoice_id_key
  on public.payments (stripe_invoice_id)
  where stripe_invoice_id is not null;
