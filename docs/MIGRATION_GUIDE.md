# Migration Guide

Data da revisão: 2026-07-17

## Migration revisada

- `supabase/migrations/20260717090000_secure_appointment_booking.sql`

## Resultado da revisão

- Reexecução segura: sim, porque usa `create extension if not exists`, `drop ... if exists`, `create or replace function` e recria a constraint de forma determinística.
- Apaga registros: não.
- Modifica agendamentos existentes: não altera linhas existentes; apenas adiciona constraint e função.
- Eleva privilégios do usuário final: não concede papel administrativo ao cliente, mas usa `security definer`; por isso o controle depende corretamente de `auth.uid()` e das checagens internas.
- Usa `auth.uid()` corretamente: sim, a função deriva o usuário autenticado no servidor e não recebe `user_id` do frontend.
- Impede colisão por intervalo: sim, via `exclude using gist` com `tstzrange(..., '[)')`.
- Ignora status cancelado: sim, e na prática ignora todos os status fora de `scheduled`, `confirmed`, `in_progress`. Isso está coerente com os pontos atuais do código que tratam agenda ativa, mas continua sendo uma regra a validar no negócio antes de produção.
- Respeita timezone: trabalha com `timestamptz`, então preserva instantes absolutos. A política de disponibilidade por fuso depende do app continuar enviando ISO UTC coerente com `America/Fortaleza`.
- Calcula preço e duração no servidor: sim.
- Confia em `user_id`, preço, duração ou status do frontend: não.

## Consulta diagnóstica

- Arquivo: `supabase/diagnostics/2026-07-17_appointment_integrity_diagnostic.sql`
- Objetivo: detectar sobreposições, horários duplicados, duração inválida, registros sem janela final válida, órfãos de assinatura, veículos ausentes e usuários ausentes.
- A consulta é somente leitura.

## Ordem manual de aplicação

1. Rodar a consulta diagnóstica.
2. Corrigir inconsistências retornadas.
3. Aplicar `20260715000000_schedule_conflicts.sql` se ainda ausente no ambiente.
4. Aplicar `20260717090000_secure_appointment_booking.sql`.
5. Testar a RPC com usuário autenticado de homologação.

## Rollback seguro

```sql
drop function if exists public.create_client_appointment(timestamptz, uuid, uuid[]);

alter table public.appointments
  drop constraint if exists appointments_active_timeslot_excl;

create unique index if not exists appointments_active_slot_unique
  on public.appointments (scheduled_at)
  where status in ('scheduled', 'confirmed', 'in_progress');
```

## Condição para aprovação

- A migration está pronta para aplicação manual em homologação.
- A migration não deve ser classificada como pronta para produção até passar pelo diagnóstico em banco real de homologação e por validação funcional ponta a ponta.
