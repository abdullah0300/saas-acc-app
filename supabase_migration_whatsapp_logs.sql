-- Create whatsapp_logs table for tracking WhatsApp message delivery
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  recipient_phone TEXT NOT NULL,
  message_id TEXT,  -- WhatsApp message ID for tracking
  status TEXT NOT NULL DEFAULT 'sent',  -- sent, delivered, read, failed
  template_name TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_invoice_id ON whatsapp_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON whatsapp_logs(status);

-- Enable RLS
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for whatsapp_logs
CREATE POLICY "Users can view their own WhatsApp logs"
  ON whatsapp_logs
  FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own WhatsApp logs"
  ON whatsapp_logs
  FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE user_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE whatsapp_logs IS 'Tracks WhatsApp messages sent for invoices';
