-- Table for queuing commands to terminals (like 'WRITE_SIGNATURE')
CREATE TABLE IF NOT EXISTS terminal_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terminal_id BIGINT REFERENCES terminals(id),
    action_type VARCHAR(50) NOT NULL, -- 'WRITE_SIGNATURE', 'BEEP', 'RESET'
    payload JSONB,                    -- { "signature": "..." }
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'COMPLETED', 'FAILED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime for this table so reader can listen
ALTER PUBLICATION supabase_realtime ADD TABLE terminal_actions;
