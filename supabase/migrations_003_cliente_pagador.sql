-- ============================================================================
-- Migration 003 — Dados do pagador (CPF/email) para integração com Asaas
-- Rodar no SQL Editor do Supabase. Idempotente.
-- ============================================================================

alter table public.clientes
  add column if not exists email text,
  add column if not exists cpf   text;

alter table public.pedidos
  add column if not exists cliente_email text,
  add column if not exists cliente_cpf   text;
