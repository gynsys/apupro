-- Evita duplicados por usuario/regla/día
ALTER TABLE pending_notifications 
ADD CONSTRAINT uix_pending_user_rule_date 
UNIQUE (recipient_id, notification_rule_id, scheduled_for);

-- Índices recomendados para performance
CREATE INDEX IF NOT exists idx_pending_status_scheduled ON pending_notifications(status, scheduled_for) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT exists idx_notification_log_recipient_sent ON notification_logs(recipient_id, sent_at);
CREATE INDEX IF NOT exists idx_cycle_user_active ON cycle_users(id) WHERE is_active = true;

-- Agregar columnas faltantes si no existen (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_notifications' AND column_name='updated_at') THEN
        ALTER TABLE pending_notifications ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_notifications' AND column_name='sent_at') THEN
        ALTER TABLE pending_notifications ADD COLUMN sent_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_notifications' AND column_name='channel_used') THEN
        ALTER TABLE pending_notifications ADD COLUMN channel_used VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_notifications' AND column_name='locked_by') THEN
        ALTER TABLE pending_notifications ADD COLUMN locked_by VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_notifications' AND column_name='locked_at') THEN
        ALTER TABLE pending_notifications ADD COLUMN locked_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
