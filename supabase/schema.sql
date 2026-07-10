-- Schéma de Base de Données Supabase pour GeckoCompta

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: Settings (Paramètres globaux)
CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    invoice_format VARCHAR(100) DEFAULT 'FAC-YYYYMM-XXXX',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles (liés à auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Commercial', 'Magasinier', 'Comptable')),
    full_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: Categories
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: Articles
CREATE TABLE public.articles (
    code VARCHAR(100) PRIMARY KEY,
    designation VARCHAR(255) NOT NULL,
    barcode VARCHAR(100),
    category_id UUID REFERENCES public.categories(id),
    purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    sale_price_ht DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    alert_threshold INTEGER DEFAULT 10,
    min_stock INTEGER DEFAULT 5,
    unit VARCHAR(50) DEFAULT 'Unité',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: Clients
CREATE TABLE public.clients (
    code VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rc VARCHAR(100),
    cc VARCHAR(100),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    balance DECIMAL(15,2) DEFAULT 0,
    credit_limit DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: Fournisseurs
CREATE TABLE public.fournisseurs (
    code VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    balance DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: Accounting Periods
CREATE TABLE public.accounting_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(month, year)
);

-- Table: Invoices
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    client_code VARCHAR(100) REFERENCES public.clients(code),
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATED', 'PAID', 'UNPAID', 'CANCELLED')),
    period_id UUID REFERENCES public.accounting_periods(id),
    user_id UUID REFERENCES auth.users(id),
    total_ht DECIMAL(15,2) DEFAULT 0,
    total_tax DECIMAL(15,2) DEFAULT 0,
    total_ttc DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: Invoice Lines
CREATE TABLE public.invoice_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    article_code VARCHAR(100) REFERENCES public.articles(code),
    quantity INTEGER NOT NULL,
    unit_price_ht DECIMAL(15,2) NOT NULL,
    discount_pct DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_ttc DECIMAL(15,2) DEFAULT 0
);

-- Table: Payments
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id),
    date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    method VARCHAR(50) NOT NULL CHECK (method IN ('CASH', 'CHECK', 'TRANSFER', 'MOBILE_MONEY')),
    period_id UUID REFERENCES public.accounting_periods(id),
    reference_tx VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: Stock Movements
CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('IN_PURCHASE', 'OUT_SALE', 'RET_CLIENT', 'RET_SUPPLIER', 'ADJ', 'LOSS')),
    article_code VARCHAR(100) REFERENCES public.articles(code),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(15,2),
    reference_id UUID, -- Peut être un ID de facture, ou autre document
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- View: Stock
CREATE OR REPLACE VIEW public.stock AS
SELECT 
    article_code,
    SUM(CASE WHEN type IN ('IN_PURCHASE', 'RET_CLIENT', 'ADJ') THEN quantity ELSE -quantity END) as current_quantity
FROM public.stock_movements
GROUP BY article_code;

-- Table: Accounts (Plan Comptable)
CREATE TABLE public.accounts (
    number VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Table: Journal Entries
CREATE TABLE public.journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    account_number VARCHAR(20) REFERENCES public.accounts(number),
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    reference_id UUID, -- Reference to Invoice or Payment
    period_id UUID REFERENCES public.accounting_periods(id),
    lettrage_code VARCHAR(50), -- Code de lettrage (ex: AAA)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Default Plan Comptable
INSERT INTO public.accounts (number, name) VALUES
('411', 'Clients'),
('401', 'Fournisseurs'),
('521', 'Banque'),
('571', 'Caisse'),
('707', 'Ventes de marchandises'),
('443', 'TVA facturée (Collectée)');
