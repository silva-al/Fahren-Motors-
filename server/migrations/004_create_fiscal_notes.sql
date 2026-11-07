-- Migração 004: Tabela dedicada para armazenamento persistente e auditoria de notas fiscais (DANFE / DACCE / CC-e)
-- Elimina a dependência de dados gravados exclusivamente no localStorage do navegador.

CREATE TABLE IF NOT EXISTS fiscal_notes (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  nf_number INTEGER NOT NULL,
  access_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AUTORIZADA' CHECK (status IN ('AUTORIZADA', 'CANCELADA', 'PENDENTE')),
  printed BOOLEAN NOT NULL DEFAULT false,
  printed_at TIMESTAMPTZ,
  cce_text TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fiscal_notes_order_id UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_notes_order_id ON fiscal_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_notes_nf_number ON fiscal_notes(nf_number);
CREATE INDEX IF NOT EXISTS idx_fiscal_notes_status ON fiscal_notes(status);

