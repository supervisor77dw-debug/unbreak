-- =====================================================
-- Migration 011: 3D Configurator Backoffice Tables
-- =====================================================
-- Description: Creates tables for configurator management:
--              - saved_designs (customer saved configurations)
--              - production_queue (manufacturing workflow)
--              - component_inventory (stock management)
--              - pricing_rules (version-controlled pricing)
-- =====================================================

-- 1) Create saved_designs table (user-saved configurations)
CREATE TABLE IF NOT EXISTS public.saved_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Design identification
  design_code TEXT UNIQUE NOT NULL,
  design_name TEXT,
  
  -- Owner
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- For authenticated users
  
  -- Product reference
  base_product_sku TEXT NOT NULL,
  product_name TEXT,
  
  -- Configuration data
  config_json JSONB NOT NULL,
  
  -- Pricing snapshot
  price_cents BIGINT NOT NULL,
  currency TEXT DEFAULT 'EUR',
  
  -- Preview assets
  preview_image_url TEXT,
  thumbnail_url TEXT,
  model_export_url TEXT, -- GLB/GLTF export
  
  -- Status
  is_public BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0, -- How many times this design was ordered
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ
);

-- 2) Create production_queue table (manufacturing workflow)
CREATE TABLE IF NOT EXISTS public.production_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Queue identification
  queue_number TEXT UNIQUE NOT NULL,
  
  -- Related order/design
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  design_id UUID REFERENCES public.saved_designs(id) ON DELETE SET NULL,
  configuration_id UUID REFERENCES public.configurations(id) ON DELETE SET NULL,
  
  -- Production status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Awaiting production
    'in_production',     -- Currently being manufactured
    'quality_check',     -- QA stage
    'completed',         -- Ready for shipping
    'on_hold',           -- Blocked/paused
    'cancelled'          -- Cancelled order
  )),
  
  -- Priority
  priority INTEGER DEFAULT 0, -- Higher = more urgent
  
  -- Assignment
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  production_facility TEXT, -- Which factory/workshop
  
  -- Timeline
  estimated_completion_date DATE,
  actual_completion_date DATE,
  
  -- Production data
  production_notes TEXT,
  required_materials JSONB DEFAULT '[]', -- Array of {material_id, quantity}
  production_files JSONB DEFAULT '[]', -- Array of {file_url, file_type, uploaded_at}
  
  -- Quality control
  qc_passed BOOLEAN,
  qc_notes TEXT,
  qc_checked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  qc_checked_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 3) Create component_inventory table (stock management for configurator)
CREATE TABLE IF NOT EXISTS public.component_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Component identification
  component_id TEXT UNIQUE NOT NULL, -- e.g., "MAT_WOOD_OAK"
  component_name TEXT NOT NULL,
  component_category TEXT NOT NULL, -- material, finish, size, etc.
  
  -- Product association
  compatible_products TEXT[] DEFAULT '{}', -- Array of product SKUs
  
  -- Pricing
  base_price_cents BIGINT DEFAULT 0,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_multiplier NUMERIC(5,2) DEFAULT 1.0,
  
  -- Inventory
  stock_quantity INTEGER DEFAULT 0,
  stock_unit TEXT DEFAULT 'pieces', -- pieces, meters, kg, etc.
  low_stock_threshold INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  
  -- Availability
  is_available BOOLEAN DEFAULT TRUE,
  available_from DATE,
  available_until DATE,
  
  -- Supplier info
  supplier_name TEXT,
  supplier_sku TEXT,
  lead_time_days INTEGER DEFAULT 7,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  image_url TEXT,
  description TEXT,
  
  -- Metadata
  technical_specs JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_restocked_at TIMESTAMPTZ
);

-- 4) Create pricing_rules table (version-controlled pricing logic)
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule identification
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'base_price',        -- Base product price
    'component_markup',  -- Component-specific markup
    'volume_discount',   -- Quantity-based discount
    'seasonal',          -- Time-based pricing
    'custom'             -- Custom formula
  )),
  
  -- Scope
  product_sku TEXT,
  component_id TEXT,
  applies_to_all BOOLEAN DEFAULT FALSE,
  
  -- Pricing logic
  formula TEXT, -- e.g., "base * 1.2 + component_sum"
  fixed_amount_cents BIGINT,
  percentage_modifier NUMERIC(5,2),
  
  -- Conditions
  conditions JSONB DEFAULT '{}', -- e.g., {min_quantity: 10, region: "EU"}
  
  -- Versioning
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  
  -- Audit
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_designs_customer ON public.saved_designs(customer_id);
CREATE INDEX IF NOT EXISTS idx_saved_designs_user ON public.saved_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_designs_sku ON public.saved_designs(base_product_sku);
CREATE INDEX IF NOT EXISTS idx_saved_designs_public ON public.saved_designs(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_saved_designs_featured ON public.saved_designs(is_featured) WHERE is_featured = TRUE;

CREATE INDEX IF NOT EXISTS idx_production_queue_status ON public.production_queue(status);
CREATE INDEX IF NOT EXISTS idx_production_queue_priority ON public.production_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_production_queue_order ON public.production_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_production_queue_assigned ON public.production_queue(assigned_to);
CREATE INDEX IF NOT EXISTS idx_production_queue_facility ON public.production_queue(production_facility);

CREATE INDEX IF NOT EXISTS idx_component_inventory_category ON public.component_inventory(component_category);
CREATE INDEX IF NOT EXISTS idx_component_inventory_available ON public.component_inventory(is_available) WHERE is_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_component_inventory_low_stock ON public.component_inventory(stock_quantity) WHERE stock_quantity <= low_stock_threshold;

CREATE INDEX IF NOT EXISTS idx_pricing_rules_type ON public.pricing_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON public.pricing_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pricing_rules_effective ON public.pricing_rules(effective_from, effective_until);

-- 6) Enable RLS
ALTER TABLE public.saved_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- 7) RLS Policies

-- Saved designs: Public designs viewable by all, private only by owner/staff
CREATE POLICY "Public designs viewable by all"
  ON public.saved_designs
  FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Users can view own designs"
  ON public.saved_designs
  FOR SELECT
  USING (user_id = auth.uid() OR customer_id IN (
    SELECT id FROM public.customers WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  ));

CREATE POLICY "Staff can view all designs"
  ON public.saved_designs
  FOR SELECT
  USING (public.has_any_role(ARRAY['admin', 'ops', 'designer']));

-- Production queue: Staff only
CREATE POLICY "Staff can view production queue"
  ON public.production_queue
  FOR ALL
  USING (public.has_any_role(ARRAY['admin', 'ops', 'designer']));

-- Component inventory: Staff manage, public read (for configurator)
CREATE POLICY "Everyone can view available components"
  ON public.component_inventory
  FOR SELECT
  USING (is_available = TRUE);

CREATE POLICY "Staff can manage components"
  ON public.component_inventory
  FOR ALL
  USING (public.has_any_role(ARRAY['admin', 'ops', 'designer']));

-- Pricing rules: Staff only
CREATE POLICY "Staff can manage pricing rules"
  ON public.pricing_rules
  FOR ALL
  USING (public.has_any_role(ARRAY['admin', 'finance']));

-- 8) Updated_at triggers
CREATE TRIGGER saved_designs_updated_at
  BEFORE UPDATE ON public.saved_designs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER production_queue_updated_at
  BEFORE UPDATE ON public.production_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER component_inventory_updated_at
  BEFORE UPDATE ON public.component_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 9) Auto-generate codes/numbers

-- Function to generate design code
CREATE OR REPLACE FUNCTION public.generate_design_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
BEGIN
  code := 'DSN-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  
  WHILE EXISTS (SELECT 1 FROM public.saved_designs WHERE design_code = code) LOOP
    code := 'DSN-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  END LOOP;
  
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_design()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.design_code IS NULL OR NEW.design_code = '' THEN
    NEW.design_code := public.generate_design_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER saved_designs_auto_code
  BEFORE INSERT ON public.saved_designs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_design();

-- Function to generate production queue number
CREATE OR REPLACE FUNCTION public.generate_queue_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  queue_num TEXT;
  date_part TEXT;
  seq_num TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  seq_num := LPAD(
    (SELECT COUNT(*) + 1 FROM public.production_queue WHERE queue_number LIKE 'PRD-' || date_part || '-%')::TEXT,
    4,
    '0'
  );
  queue_num := 'PRD-' || date_part || '-' || seq_num;
  
  RETURN queue_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_queue_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.queue_number IS NULL OR NEW.queue_number = '' THEN
    NEW.queue_number := public.generate_queue_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER production_queue_auto_number
  BEFORE INSERT ON public.production_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_queue_item();

-- 10) Helper functions

-- Check if component is in stock
CREATE OR REPLACE FUNCTION public.is_component_in_stock(comp_id TEXT, required_qty INTEGER DEFAULT 1)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  available_qty INTEGER;
BEGIN
  SELECT stock_quantity INTO available_qty
  FROM public.component_inventory
  WHERE component_id = comp_id AND is_available = TRUE;
  
  RETURN available_qty >= required_qty;
END;
$$;

-- Get active pricing rule for product/component
CREATE OR REPLACE FUNCTION public.get_active_pricing_rule(
  p_product_sku TEXT DEFAULT NULL,
  p_component_id TEXT DEFAULT NULL,
  p_rule_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  rule_name TEXT,
  formula TEXT,
  fixed_amount_cents BIGINT,
  percentage_modifier NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.rule_name,
    pr.formula,
    pr.fixed_amount_cents,
    pr.percentage_modifier
  FROM public.pricing_rules pr
  WHERE pr.is_active = TRUE
    AND (pr.product_sku = p_product_sku OR pr.product_sku IS NULL OR pr.applies_to_all = TRUE)
    AND (pr.component_id = p_component_id OR pr.component_id IS NULL)
    AND (pr.rule_type = p_rule_type OR p_rule_type IS NULL)
    AND NOW() >= pr.effective_from
    AND (pr.effective_until IS NULL OR NOW() <= pr.effective_until)
  ORDER BY pr.version DESC
  LIMIT 1;
END;
$$;

-- =====================================================
-- Migration complete
-- =====================================================
-- 3D Configurator Backoffice created with:
-- - saved_designs (customer saved configurations)
-- - production_queue (manufacturing workflow)
-- - component_inventory (stock management)
-- - pricing_rules (version-controlled pricing)
-- - Auto-generated codes (DSN-*, PRD-*)
-- - RLS policies (role-based access)
-- - Helper functions (stock check, pricing lookup)
-- =====================================================
