-- =====================================================
-- Migration 010: Tickets and Messages System
-- =====================================================
-- Description: Creates tickets and ticket_messages tables
--              for customer support and internal communication
-- =====================================================

-- 1) Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ticket identification
  ticket_number TEXT UNIQUE NOT NULL,
  
  -- Status and priority
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Category
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN (
    'general', 
    'order', 
    'product', 
    'technical', 
    'billing', 
    'shipping', 
    'returns',
    'complaint'
  )),
  
  -- Content
  subject TEXT NOT NULL,
  description TEXT,
  
  -- Relations
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- 2) Create ticket_messages table
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Parent ticket
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  
  -- Author (can be staff or customer)
  author_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  author_name TEXT, -- For unauthenticated messages
  author_email TEXT,
  
  -- Message content
  body TEXT NOT NULL,
  
  -- Attachments (URLs to stored files)
  attachments JSONB DEFAULT '[]', -- Array of {url, filename, size, type}
  
  -- Visibility
  is_internal BOOLEAN DEFAULT FALSE, -- Internal notes not visible to customer
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON public.tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON public.tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON public.tickets(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_author_user ON public.ticket_messages(author_user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON public.ticket_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_is_internal ON public.ticket_messages(is_internal);

-- 4) Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- 5) RLS Policies for tickets

-- Staff can view all tickets
CREATE POLICY "Staff can view all tickets"
  ON public.tickets
  FOR SELECT
  USING (
    public.has_any_role(ARRAY['admin', 'ops', 'support'])
  );

-- Staff can create tickets
CREATE POLICY "Staff can create tickets"
  ON public.tickets
  FOR INSERT
  WITH CHECK (
    public.has_any_role(ARRAY['admin', 'ops', 'support'])
  );

-- Staff can update tickets
CREATE POLICY "Staff can update tickets"
  ON public.tickets
  FOR UPDATE
  USING (
    public.has_any_role(ARRAY['admin', 'ops', 'support'])
  );

-- Customers can view their own tickets (via customer_id)
-- TODO: Implement customer portal authentication
-- CREATE POLICY "Customers can view own tickets"
--   ON public.tickets
--   FOR SELECT
--   USING (customer_id = current_customer_id());

-- 6) RLS Policies for ticket_messages

-- Staff can view all messages
CREATE POLICY "Staff can view all messages"
  ON public.ticket_messages
  FOR SELECT
  USING (
    public.has_any_role(ARRAY['admin', 'ops', 'support'])
  );

-- Staff can create messages
CREATE POLICY "Staff can create messages"
  ON public.ticket_messages
  FOR INSERT
  WITH CHECK (
    public.has_any_role(ARRAY['admin', 'ops', 'support'])
  );

-- Staff can update their own messages
CREATE POLICY "Staff can update own messages"
  ON public.ticket_messages
  FOR UPDATE
  USING (
    author_user_id = auth.uid() AND
    public.has_any_role(ARRAY['admin', 'ops', 'support'])
  );

-- 7) Updated_at triggers
CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER ticket_messages_updated_at
  BEFORE UPDATE ON public.ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 8) Function to generate ticket numbers
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  ticket_num TEXT;
  date_part TEXT;
  random_part TEXT;
BEGIN
  -- Format: TKT-YYYYMMDD-XXXX
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
  ticket_num := 'TKT-' || date_part || '-' || random_part;
  
  -- Ensure uniqueness (very unlikely collision, but check anyway)
  WHILE EXISTS (SELECT 1 FROM public.tickets WHERE ticket_number = ticket_num) LOOP
    random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    ticket_num := 'TKT-' || date_part || '-' || random_part;
  END LOOP;
  
  RETURN ticket_num;
END;
$$;

-- 9) Trigger to auto-generate ticket_number
CREATE OR REPLACE FUNCTION public.handle_new_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := public.generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tickets_auto_number
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_ticket();

-- 10) Trigger to update ticket.updated_at when message is added
CREATE OR REPLACE FUNCTION public.handle_new_ticket_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.tickets
  SET updated_at = NOW()
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_messages_update_ticket
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_ticket_message();

-- 11) Function to get ticket stats
CREATE OR REPLACE FUNCTION public.get_ticket_stats()
RETURNS TABLE (
  total_open BIGINT,
  total_in_progress BIGINT,
  total_waiting BIGINT,
  total_resolved_today BIGINT,
  avg_response_time_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'open') AS total_open,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS total_in_progress,
    COUNT(*) FILTER (WHERE status = 'waiting') AS total_waiting,
    COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at::DATE = CURRENT_DATE) AS total_resolved_today,
    ROUND(AVG(
      EXTRACT(EPOCH FROM (
        SELECT MIN(created_at) 
        FROM public.ticket_messages 
        WHERE ticket_id = tickets.id AND author_user_id IS NOT NULL
      ) - tickets.created_at) / 3600
    ), 2) AS avg_response_time_hours
  FROM public.tickets
  WHERE created_at > NOW() - INTERVAL '30 days';
END;
$$;

-- =====================================================
-- Migration complete
-- =====================================================
-- Tickets system created with:
-- - tickets table (status, priority, category, assignments)
-- - ticket_messages table (threaded conversations)
-- - Auto-generated ticket numbers (TKT-YYYYMMDD-XXXX)
-- - RLS policies (staff access)
-- - Helper functions (stats, number generation)
-- - Auto-update triggers
-- =====================================================
