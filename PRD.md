# Product Requirements Document (PRD)
## SMG Fleet Management System

---

### Document Information
- **Product Name:** SMG Fleet Manager
- **Version:** 1.0 (MVP)
- **Date:** September 1, 2026
- **Author:** Product Team
- **Status:** Approved - Ready for Development
- **Project Type:** Greenfield Web Application

---

## Executive Summary

SMG Fleet Manager is a web-based application designed to manage a fleet of 50-200+ commercial vehicles and track their associated regulatory charges. The system provides comprehensive vehicle management, bulk data operations, and financial visibility through a simple dashboard interface.

**Core Value Proposition:** Centralized tracking of vehicle information and regulatory charge amounts, enabling better financial planning and compliance oversight for fleet operations.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Target Users](#2-target-users)
3. [Business Requirements](#3-business-requirements)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [User Stories](#6-user-stories)
7. [Data Model](#7-data-model)
8. [User Interface Requirements](#8-user-interface-requirements)
9. [Technical Architecture](#9-technical-architecture)
10. [Success Metrics](#10-success-metrics)
11. [Release Plan](#11-release-plan)
12. [Out of Scope](#12-out-of-scope)
13. [Appendices](#13-appendices)

---

## 1. Product Vision

### 1.1 Problem Statement
Managing a large commercial vehicle fleet requires tracking multiple regulatory charges per vehicle, with varying frequencies and amounts. Current manual methods (spreadsheets, external systems) lack centralized visibility and make bulk operations cumbersome.

### 1.2 Solution
A dedicated web application that centralizes vehicle information and charge tracking, providing:
- Single source of truth for fleet data
- Efficient bulk import/export capabilities
- Clear financial visibility through dashboard KPIs
- Scalable foundation for future enhancements

### 1.3 Success Criteria
- All 50-200+ vehicles successfully imported and managed in the system
- Reduction in time spent on data entry and reporting
- Clear visibility into total fleet costs and charge distribution
- Zero monthly operational costs

---

## 2. Target Users

### 2.1 Primary User (MVP)
**Fleet Manager**
- **Role:** Single administrator with full system access
- **Goals:** Track vehicle charges, generate reports, manage fleet data
- **Technical Proficiency:** Moderate (comfortable with web applications)
- **Usage Pattern:** Daily check-ins, weekly data updates, monthly reporting

### 2.2 Future Users (Post-MVP)
- Accounting team members (view-only access)
- Additional fleet managers (full access)
- Executive stakeholders (dashboard access)

---

## 3. Business Requirements

### 3.1 Primary Objectives
1. **BR-001:** Centralize vehicle and charge data in a single system
2. **BR-002:** Enable bulk vehicle data import from existing records
3. **BR-003:** Provide flexible export capabilities for reporting and analysis
4. **BR-004:** Display real-time financial KPIs for fleet oversight
5. **BR-005:** Maintain zero monthly operational costs

### 3.2 Business Constraints
- **BC-001:** Must use free-tier cloud services exclusively
- **BC-002:** No integration with payment processing systems required
- **BC-003:** Payment tracking remains in external AS-TECH system
- **BC-004:** No hard deadline, flexible timeline for quality delivery

### 3.3 Compliance Requirements
- **CR-001:** Track regulatory charge types mandated in Morocco (visite technique, taxe transport, taxe à l'essieu, chrono tachygraphe, assurance)
- **CR-002:** Maintain historical charge records for audit purposes
- **CR-003:** Support data export for external auditing

---

## 4. Functional Requirements

### 4.1 Vehicle Management

#### FR-VEH-001: Create Vehicle
**Priority:** P0 (Must Have)
- **Description:** Add new vehicle to the fleet
- **Inputs:** Code, registration plate, vehicle type, brand, fuel type, purchase date, category, status
- **Validation:** 
  - Code must be unique
  - All fields required except notes
  - Registration plate format validation
- **Output:** Success confirmation toast, vehicle added to database
- **Error Handling:** Display validation errors inline, prevent duplicate codes

#### FR-VEH-002: View Vehicle List
**Priority:** P0 (Must Have)
- **Description:** Display all vehicles in a searchable, filterable table
- **Features:**
  - Search by code or registration plate
  - Filter by type, status, category
  - Sort by any column
  - Pagination (25/50/100 per page)
- **Display Fields:** All vehicle properties plus charge summary

#### FR-VEH-003: View Vehicle Details
**Priority:** P0 (Must Have)
- **Description:** Display comprehensive vehicle information and associated charges
- **Contents:**
  - All vehicle properties
  - List of all charges with amounts and dates
  - Total charges for this vehicle
  - Edit and delete actions

#### FR-VEH-004: Update Vehicle
**Priority:** P0 (Must Have)
- **Description:** Modify existing vehicle information
- **Validation:** Same as FR-VEH-001
- **Output:** Success confirmation toast, vehicle updated in database
- **Constraint:** Cannot change vehicle code (primary identifier)

#### FR-VEH-005: Delete Vehicle
**Priority:** P1 (Should Have)
- **Description:** Remove vehicle from system or mark as sold
- **Options:**
  1. Soft delete (mark as "Sold" status)
  2. Hard delete (remove from database)
- **Confirmation:** Require explicit confirmation with vehicle code entry
- **Cascade:** Display warning if vehicle has associated charges

### 4.2 Charge Management

#### FR-CHG-001: Add Charge Record
**Priority:** P0 (Must Have)
- **Description:** Record a charge for a specific vehicle
- **Inputs:**
  - Vehicle selection (dropdown or search)
  - Charge type (dropdown: visite technique, taxe transport, taxe à l'essieu, chrono tachygraphe, assurance)
  - Amount (MAD)
  - Payment date
  - Notes (optional)
- **Validation:**
  - Amount must be positive number
  - Payment date cannot be in future
- **Output:** Success confirmation, charge added to vehicle record

#### FR-CHG-002: View Charges
**Priority:** P0 (Must Have)
- **Description:** Display charges in multiple contexts
- **Views:**
  1. By vehicle (on vehicle detail page)
  2. All charges (dedicated charges page with filters)
  3. Dashboard aggregates
- **Filters:** By vehicle, charge type, date range, amount range

#### FR-CHG-003: Update Charge
**Priority:** P0 (Must Have)
- **Description:** Modify existing charge record
- **Use Case:** Correcting data entry errors, updating variable charges (insurance)
- **Validation:** Same as FR-CHG-001
- **Output:** Success confirmation toast

#### FR-CHG-004: Delete Charge
**Priority:** P1 (Should Have)
- **Description:** Remove charge record
- **Confirmation:** Require explicit confirmation
- **Audit:** Log deletion with timestamp and user

### 4.3 Category Management

#### FR-CAT-001: Manage Categories
**Priority:** P1 (Should Have)
- **Description:** CRUD operations for vehicle categories
- **Examples:** "camion benne 8x4", "plateau 12M", "porte char", "minibus 30 places"
- **Features:**
  - Add new category
  - Edit category name
  - Delete category (if no vehicles assigned)
  - View vehicle count per category

### 4.4 Import Operations

#### FR-IMP-001: Import Vehicles from CSV
**Priority:** P0 (Must Have)
- **Description:** Bulk import vehicle data from CSV file
- **Required Columns:**
  - Code (unique identifier)
  - Registration plate
  - Vehicle type
  - Brand
  - Fuel type
  - Purchase date (format: YYYY-MM-DD or DD/MM/YYYY)
  - Category
  - Status (active/sold)
- **Process:**
  1. Upload file
  2. Validate file format and headers
  3. Preview first 10 rows
  4. User confirms import
  5. Process all rows
  6. Display summary report
- **Duplicate Handling:** 
  - If vehicle code exists → Update existing record
  - Track: X added, Y updated, Z failed
- **Error Handling:**
  - Continue processing on row errors
  - Collect all errors for final report
  - Provide downloadable error log with row numbers and reasons

#### FR-IMP-002: Import Vehicles from Excel
**Priority:** P0 (Must Have)
- **Description:** Same as FR-IMP-001 but for XLSX format
- **Additional:** Support multiple sheets (prompt user to select sheet)

#### FR-IMP-003: Import Summary Report
**Priority:** P0 (Must Have)
- **Description:** Display detailed import results
- **Contents:**
  - Total rows processed
  - Successfully added (count + list)
  - Successfully updated (count + list)
  - Failed (count + error details per row)
  - Processing time
- **Actions:** Download error log, view affected vehicles

### 4.5 Export Operations

#### FR-EXP-001: Export by Year
**Priority:** P0 (Must Have)
- **Description:** Export all vehicles and charges from a specific year
- **Input:** Year selection (dropdown: current year ± 5 years)
- **Output:** Vehicles active or purchased in that year, plus charges paid in that year

#### FR-EXP-002: Export by Vehicle Codes
**Priority:** P0 (Must Have)
- **Description:** Export specific vehicles by uploading a code list
- **Process:**
  1. Upload file (CSV/TXT with one code per line)
  2. System matches codes to vehicles
  3. Display matched vehicles + unmatched codes
  4. User reviews and proceeds to column selection
- **Error Handling:** Display list of unmatched codes

#### FR-EXP-003: Export with Manual Selection
**Priority:** P0 (Must Have)
- **Description:** Combined approach: filter + manual add/remove
- **Process:**
  1. Apply filters (year, codes, or both)
  2. Display matching vehicles
  3. User can add more vehicles manually (search + add)
  4. User can remove vehicles from selection
  5. Proceed to column selection

#### FR-EXP-004: Column Selection
**Priority:** P0 (Must Have)
- **Description:** Choose which fields to include in export
- **Available Columns:**
  - **Vehicle Info:** Code, registration plate, vehicle type, brand, fuel type, purchase date, category, status
  - **Charge Info:** Charge type, amount paid, payment date
  - **Other:** Notes, year
- **Presets:**
  - "All columns" (default)
  - "Basic info" (code, plate, type, status)
  - "Financial summary" (code, plate, total charges)
- **Validation:** At least one column must be selected

#### FR-EXP-005: Export to CSV
**Priority:** P0 (Must Have)
- **Description:** Generate CSV file with selected data
- **Format:** UTF-8 with BOM, comma-separated, quoted strings
- **Filename:** `SMG-Fleet-Export-{date}-{time}.csv`

#### FR-EXP-006: Export to Excel
**Priority:** P0 (Must Have)
- **Description:** Generate XLSX file with selected data
- **Features:**
  - Formatted headers (bold)
  - Auto-column width
  - Freeze top row
  - Basic styling
- **Filename:** `SMG-Fleet-Export-{date}-{time}.xlsx`

#### FR-EXP-007: Export to PDF
**Priority:** P1 (Should Have)
- **Description:** Generate formatted PDF report
- **Features:**
  - Company header (configurable)
  - Report title and generation date
  - Formatted table with page breaks
  - Page numbers
  - Summary footer (total vehicles, total charges)
- **Filename:** `SMG-Fleet-Report-{date}.pdf`

### 4.6 Dashboard

#### FR-DASH-001: Dashboard KPIs
**Priority:** P0 (Must Have)
- **Description:** Display key fleet metrics as card widgets
- **Metrics:**
  1. **Total Vehicles:** Count of active vehicles
  2. **Total Charges:** Sum of all charge amounts across all vehicles (all time)
  3. **Annual Total (Current Year):** Sum of charges paid in current year
  4. **Monthly Average:** Annual total ÷ 12
- **Format:**
  - Large number display
  - Currency formatting (MAD)
  - Icon per metric
  - Optional trend indicator (if historical data available)

#### FR-DASH-002: Dashboard Filters
**Priority:** P1 (Should Have)
- **Description:** Filter dashboard by time period
- **Options:**
  - Current year (default)
  - Previous year
  - All time
  - Custom date range

### 4.7 User Management

#### FR-USER-001: Authentication
**Priority:** P0 (Must Have)
- **Description:** Secure login system
- **Method:** Email + password via Supabase Auth
- **Features:**
  - Login page
  - Password reset via email
  - Session persistence
  - Auto-logout after 30 days
- **Security:**
  - Password minimum 8 characters
  - HTTPS only
  - Rate limiting on login attempts

#### FR-USER-002: User CRUD (Admin)
**Priority:** P1 (Should Have - Future)
- **Description:** Manage user accounts
- **MVP:** Single admin user (created during setup)
- **Future:** Add/edit/delete users, assign roles
- **Fields:** Name, email, role (admin/viewer)

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **NFR-PERF-001:** Page load time < 2 seconds on 3G connection
- **NFR-PERF-002:** Import 200 vehicles in < 30 seconds
- **NFR-PERF-003:** Export 200 vehicles in < 10 seconds
- **NFR-PERF-004:** Dashboard metrics update in < 1 second

### 5.2 Scalability
- **NFR-SCALE-001:** Support up to 500 vehicles without performance degradation
- **NFR-SCALE-002:** Support up to 10,000 charge records
- **NFR-SCALE-003:** Handle 5 concurrent users (future)

### 5.3 Usability
- **NFR-USE-001:** Responsive design (desktop, tablet, mobile)
- **NFR-USE-002:** Intuitive navigation, max 3 clicks to any feature
- **NFR-USE-003:** Consistent UI patterns across all pages
- **NFR-USE-004:** Toast notifications for all actions (success/error)
- **NFR-USE-005:** Form validation with inline error messages
- **NFR-USE-006:** Loading states for all async operations

### 5.4 Reliability
- **NFR-REL-001:** 99% uptime (Vercel free tier SLA)
- **NFR-REL-002:** Automatic database backups (Supabase daily backups)
- **NFR-REL-003:** Graceful error handling with user-friendly messages
- **NFR-REL-004:** No data loss on failed imports

### 5.5 Security
- **NFR-SEC-001:** All data transmission via HTTPS
- **NFR-SEC-002:** SQL injection prevention (Supabase parameterized queries)
- **NFR-SEC-003:** XSS protection (React default escaping)
- **NFR-SEC-004:** CSRF protection (Supabase auth tokens)
- **NFR-SEC-005:** Row-level security policies in Supabase
- **NFR-SEC-006:** No sensitive data in client-side logs

### 5.6 Maintainability
- **NFR-MAINT-001:** Clean, documented code following React best practices
- **NFR-MAINT-002:** Component-based architecture for reusability
- **NFR-MAINT-003:** Environment-based configuration (dev/staging/prod)
- **NFR-MAINT-004:** Version control with Git + GitHub

### 5.7 Cost
- **NFR-COST-001:** Zero monthly operational costs
- **NFR-COST-002:** Stay within free tier limits:
  - Supabase: 500MB database, 2GB bandwidth/month
  - Vercel: 100GB bandwidth/month
  - No paid services or APIs

---

## 6. User Stories

### Epic 1: Vehicle Management
- **US-001:** As a fleet manager, I want to add a new vehicle so that I can track it in the system
- **US-002:** As a fleet manager, I want to search for vehicles by code or plate so that I can quickly find specific vehicles
- **US-003:** As a fleet manager, I want to edit vehicle information so that I can keep records up to date
- **US-004:** As a fleet manager, I want to mark vehicles as sold so that they don't appear in active fleet reports
- **US-005:** As a fleet manager, I want to view all details of a vehicle including its charges so that I have complete visibility

### Epic 2: Charge Tracking
- **US-006:** As a fleet manager, I want to record charges for each vehicle so that I can track regulatory compliance costs
- **US-007:** As a fleet manager, I want to update charge amounts so that I can correct errors or reflect changed prices
- **US-008:** As a fleet manager, I want to see all charges for a vehicle so that I understand its total cost
- **US-009:** As a fleet manager, I want to filter charges by type and date so that I can analyze specific cost categories

### Epic 3: Bulk Operations
- **US-010:** As a fleet manager, I want to import 200 vehicles from Excel so that I can quickly populate the system initially
- **US-011:** As a fleet manager, I want to see which vehicles were successfully imported so that I can verify the import
- **US-012:** As a fleet manager, I want to download error details if import fails so that I can fix data issues
- **US-013:** As a fleet manager, I want to export vehicles by year so that I can provide annual reports to accounting
- **US-014:** As a fleet manager, I want to upload a list of vehicle codes and export only those so that I can create custom reports
- **US-015:** As a fleet manager, I want to choose which columns to export so that I can customize reports for different audiences

### Epic 4: Reporting & Analytics
- **US-016:** As a fleet manager, I want to see total fleet charges on a dashboard so that I understand overall costs
- **US-017:** As a fleet manager, I want to see monthly average charges so that I can predict future expenses
- **US-018:** As a fleet manager, I want to export data to PDF so that I can share professional reports with executives

### Epic 5: System Administration
- **US-019:** As a fleet manager, I want to log in securely so that fleet data is protected
- **US-020:** As a fleet manager, I want to manage vehicle categories so that I can organize the fleet logically
- **US-021:** As a system admin, I want to add new users (future) so that I can grant access to team members

---

## 7. Data Model

### 7.1 Database Schema

#### Table: `users`
```sql
users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, -- Managed by Supabase Auth
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin', -- Future: 'admin' | 'viewer'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

#### Table: `vehicle_categories`
```sql
vehicle_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

#### Table: `vehicles`
```sql
vehicles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL, -- T535, C320, etc.
  registration_plate VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(100) NOT NULL, -- camion, minibus, van
  brand VARCHAR(100) NOT NULL,
  fuel_type VARCHAR(50) NOT NULL, -- Diesel, electric, gas
  purchase_date DATE NOT NULL,
  category_id INTEGER REFERENCES vehicle_categories(id),
  status VARCHAR(20) DEFAULT 'active', -- 'active' | 'sold'
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

**Indexes:**
- `idx_vehicles_code` on `code`
- `idx_vehicles_status` on `status`
- `idx_vehicles_category` on `category_id`

#### Table: `charge_types`
```sql
charge_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL, -- 'visite_technique', 'taxe_transport', etc.
  display_name VARCHAR(100) NOT NULL, -- 'Visite technique', 'Taxe transport'
  frequency VARCHAR(50), -- 'annual', '6_months', '12_months', '24_months'
  due_date_type VARCHAR(50), -- 'fixed' (Jan 1) | 'variable' (per vehicle)
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)
```

**Default Records:**
```sql
INSERT INTO charge_types (name, display_name, frequency, due_date_type) VALUES
('visite_technique', 'Visite technique', '12_months', 'variable'),
('taxe_transport', 'Taxe transport', 'annual', 'fixed'),
('taxe_essieu', 'Taxe à l''essieu', 'annual', 'fixed'),
('chrono_tachygraphe', 'Chrono tachygraphe', '24_months', 'variable'),
('assurance', 'Assurance', 'annual', 'fixed');
```

#### Table: `charges`
```sql
charges (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  charge_type_id INTEGER NOT NULL REFERENCES charge_types(id),
  amount DECIMAL(10, 2) NOT NULL, -- Amount in MAD
  payment_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

**Indexes:**
- `idx_charges_vehicle` on `vehicle_id`
- `idx_charges_type` on `charge_type_id`
- `idx_charges_date` on `payment_date`

#### Table: `import_logs`
```sql
import_logs (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255),
  total_rows INTEGER,
  added_count INTEGER,
  updated_count INTEGER,
  failed_count INTEGER,
  error_details JSONB, -- Array of {row, code, error}
  imported_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)
```

### 7.2 Database Views

#### View: `vehicle_summary`
```sql
CREATE VIEW vehicle_summary AS
SELECT 
  v.id,
  v.code,
  v.registration_plate,
  v.vehicle_type,
  v.brand,
  v.status,
  vc.name as category_name,
  COUNT(c.id) as charge_count,
  COALESCE(SUM(c.amount), 0) as total_charges
FROM vehicles v
LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
LEFT JOIN charges c ON v.id = c.vehicle_id
GROUP BY v.id, v.code, v.registration_plate, v.vehicle_type, v.brand, v.status, vc.name;
```

### 7.3 Row-Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read/write all data (MVP - single user)
CREATE POLICY "Authenticated users full access" ON vehicles
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON charges
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON vehicle_categories
  FOR ALL USING (auth.role() = 'authenticated');
```

---

## 8. User Interface Requirements

### 8.1 Layout Structure

#### Global Navigation
- **Header:** Logo, app name, user menu (profile, logout)
- **Sidebar (collapsible):**
  - Dashboard
  - Vehicles
  - Charges
  - Import
  - Export
  - Categories
  - Users (admin only)
- **Mobile:** Bottom navigation or hamburger menu

### 8.2 Page Designs

#### 8.2.1 Dashboard Page
**Route:** `/dashboard` or `/`

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Dashboard                                    │
├─────────────┬─────────────┬─────────────────┤
│ Total       │ Total       │ Annual Total    │
│ Vehicles    │ Charges     │ (2026)          │
│ 187         │ 2,450,000   │ 1,200,000 MAD   │
│             │ MAD         │                 │
├─────────────┴─────────────┴─────────────────┤
│ Monthly Average                             │
│ 100,000 MAD                                 │
├─────────────────────────────────────────────┤
│ [Year Filter: 2026 ▼]                      │
└─────────────────────────────────────────────┘
```

#### 8.2.2 Vehicles List Page
**Route:** `/vehicles`

**Features:**
- Search bar (code or plate)
- Filter dropdowns (type, status, category)
- Add Vehicle button (top right)
- Data table with columns: Code, Plate, Type, Brand, Category, Status, Total Charges, Actions
- Pagination controls
- Click row → Vehicle detail page

#### 8.2.3 Vehicle Detail Page
**Route:** `/vehicles/:id`

**Sections:**
1. **Vehicle Info Card:** All properties, Edit/Delete buttons
2. **Charges Table:** List of all charges, Add Charge button
3. **Summary:** Total charges for this vehicle

#### 8.2.4 Add/Edit Vehicle Form
**Route:** `/vehicles/new` or `/vehicles/:id/edit`

**Form Fields:**
- Code (text input, required, unique)
- Registration Plate (text input, required)
- Vehicle Type (dropdown or text, required)
- Brand (text input, required)
- Fuel Type (dropdown, required)
- Purchase Date (date picker, required)
- Category (dropdown from categories table, required)
- Status (radio: Active/Sold, required)
- Notes (textarea, optional)

**Actions:** Save, Cancel

#### 8.2.5 Charges Page
**Route:** `/charges`

**Features:**
- Filter by vehicle, charge type, date range
- Add Charge button
- Data table: Vehicle Code, Charge Type, Amount, Payment Date, Actions
- Pagination

#### 8.2.6 Import Page
**Route:** `/import`

**Flow:**
1. **Upload Step:**
   - File upload zone (drag-drop or click)
   - Supported formats: CSV, XLSX
   - Template download link
2. **Preview Step:**
   - Show first 10 rows
   - Column mapping (if headers don't match exactly)
   - Confirm/Back buttons
3. **Processing Step:**
   - Progress bar
   - "Processing X of Y rows..."
4. **Results Step:**
   - Summary cards (Added, Updated, Failed)
   - Failed rows table with error messages
   - Download error log button
   - View imported vehicles button

#### 8.2.7 Export Page
**Route:** `/export`

**Flow:**
1. **Filter Selection:**
   - Option 1: Export by year (dropdown)
   - Option 2: Upload vehicle codes (file upload)
   - Option 3: Combination (both above)
2. **Vehicle Selection:**
   - Table showing matched vehicles
   - Checkboxes to add/remove
   - Search to add more manually
3. **Column Selection:**
   - Checkboxes for each available column
   - Preset buttons (All, Basic, Financial)
4. **Export Format:**
   - Radio buttons: CSV, Excel, PDF
   - Export button
5. **Download:**
   - File downloads automatically
   - Success message with filename

#### 8.2.8 Categories Page
**Route:** `/categories`

**Features:**
- Add Category button
- Table: Category Name, Vehicle Count, Actions (Edit/Delete)
- Inline editing or modal form

### 8.3 UI Components Library

**Reusable Components:**
- `Button` (primary, secondary, danger)
- `Input` (text, number, date)
- `Select` (dropdown)
- `Table` (sortable, paginated)
- `Modal` (confirmation, forms)
- `Toast` (success, error, info)
- `Card` (dashboard KPIs, info cards)
- `FileUpload` (drag-drop zone)
- `LoadingSpinner`
- `EmptyState` (no data illustrations)
- `Breadcrumb` (navigation trail)

### 8.4 Design System

**Colors:**
- Primary: Blue (#2563EB)
- Success: Green (#10B981)
- Warning: Yellow (#F59E0B)
- Danger: Red (#EF4444)
- Neutral: Gray scale (#F9FAFB to #111827)

**Typography:**
- Font Family: Inter or System UI
- Headings: 24px (H1), 20px (H2), 16px (H3)
- Body: 14px (regular), 12px (small)
- Weight: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

**Spacing:**
- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64

**Responsive Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

---

## 9. Technical Architecture

### 9.1 Technology Stack

| Layer | Technology | Version | Justification |
|-------|------------|---------|---------------|
| **Frontend Framework** | React | 18.x | Industry standard, large ecosystem, component-based |
| **Build Tool** | Vite | 5.x | Fast dev server, optimized production builds |
| **UI Library** | Tailwind CSS | 3.x | Utility-first, rapid development, small bundle |
| **State Management** | React Context + Hooks | Built-in | Sufficient for MVP, no redux complexity needed |
| **Routing** | React Router | 6.x | Standard React routing solution |
| **Forms** | React Hook Form | 7.x | Performant, good validation support |
| **Data Fetching** | Supabase JS Client | 2.x | Official client for Supabase, real-time ready |
| **Backend** | Supabase (PostgreSQL) | Cloud | Managed Postgres, auth, APIs, free tier |
| **File Parsing** | PapaParse (CSV) + SheetJS (Excel) | Latest | Robust CSV/Excel parsing in browser |
| **PDF Generation** | jsPDF or react-pdf | Latest | Client-side PDF generation |
| **Hosting** | Vercel | Cloud | Free tier, auto-deploy, CDN, serverless |
| **Version Control** | Git + GitHub | - | Standard, enables CI/CD |

### 9.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   User Browser                       │
├─────────────────────────────────────────────────────┤
│  React App (Vite)                                   │
│  ├─ Pages (Dashboard, Vehicles, etc.)               │
│  ├─ Components (Button, Table, Modal)               │
│  ├─ Context (Auth, App State)                       │
│  ├─ Utils (formatters, validators, parsers)         │
│  └─ Supabase Client                                 │
└────────────────┬────────────────────────────────────┘
                 │ HTTPS / API Calls
                 ▼
┌─────────────────────────────────────────────────────┐
│              Supabase (Cloud)                        │
│  ├─ PostgreSQL Database                             │
│  │   └─ Tables: vehicles, charges, users, etc.      │
│  ├─ Authentication (Email/Password)                 │
│  ├─ Row-Level Security Policies                     │
│  ├─ Auto-generated REST API                         │
│  └─ Real-time Subscriptions (future)                │
└─────────────────────────────────────────────────────┘
```

### 9.3 Frontend Architecture

**Directory Structure:**
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base components (Button, Input, etc.)
│   ├── layout/         # Layout components (Header, Sidebar)
│   └── features/       # Feature-specific components
├── pages/              # Page components (route targets)
│   ├── Dashboard.jsx
│   ├── Vehicles/
│   ├── Charges/
│   ├── Import/
│   └── Export/
├── context/            # React Context providers
│   ├── AuthContext.jsx
│   └── AppContext.jsx
├── hooks/              # Custom React hooks
│   ├── useVehicles.js
│   ├── useCharges.js
│   └── useAuth.js
├── services/           # API/business logic
│   ├── supabase.js
│   ├── vehicleService.js
│   ├── chargeService.js
│   └── importService.js
├── utils/              # Helper functions
│   ├── formatters.js   # Number, date formatting
│   ├── validators.js   # Form validation
│   └── parsers.js      # CSV/Excel parsing
├── constants/          # App constants
│   └── chargeTypes.js
├── App.jsx             # Root component
└── main.jsx            # Entry point
```

### 9.4 Data Flow

**Example: Adding a Vehicle**

1. User fills out form in `AddVehicle.jsx`
2. Form validation via `react-hook-form`
3. On submit → call `vehicleService.createVehicle(data)`
4. Service calls `supabase.from('vehicles').insert(data)`
5. Supabase validates via RLS policies
6. Database insert + returns new record
7. Success → toast notification + redirect to vehicle list
8. Error → display inline form errors

**Example: Importing Vehicles**

1. User uploads CSV in `Import.jsx`
2. `parsers.js` parses CSV → array of objects
3. Preview first 10 rows
4. User confirms → `importService.importVehicles(data)`
5. Service loops through rows:
   - Check if code exists → insert or update
   - Catch validation errors per row
6. Collect results (added, updated, failed)
7. Store in `import_logs` table
8. Display summary report

### 9.5 API Layer (Supabase)

**Auto-generated REST endpoints:**
- `GET /rest/v1/vehicles` - List vehicles
- `POST /rest/v1/vehicles` - Create vehicle
- `PATCH /rest/v1/vehicles?id=eq.{id}` - Update vehicle
- `DELETE /rest/v1/vehicles?id=eq.{id}` - Delete vehicle
- Similar for `charges`, `categories`, etc.

**Custom RPC functions (if needed):**
```sql
-- Example: Get dashboard KPIs
CREATE OR REPLACE FUNCTION get_dashboard_kpis(target_year INTEGER)
RETURNS JSON AS $$
  SELECT json_build_object(
    'total_vehicles', (SELECT COUNT(*) FROM vehicles WHERE status = 'active'),
    'total_charges', (SELECT COALESCE(SUM(amount), 0) FROM charges),
    'annual_total', (SELECT COALESCE(SUM(amount), 0) FROM charges WHERE EXTRACT(YEAR FROM payment_date) = target_year),
    'monthly_average', (SELECT COALESCE(SUM(amount), 0) / 12 FROM charges WHERE EXTRACT(YEAR FROM payment_date) = target_year)
  );
$$ LANGUAGE SQL;
```

### 9.6 Deployment Pipeline

**GitHub Actions CI/CD:**
```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: vercel/actions@v2
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

**Environment Variables (.env):**
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=ey...
```

---

## 10. Success Metrics

### 10.1 Launch Criteria (MVP Go-Live)

- [ ] All 50-200+ vehicles imported successfully
- [ ] All 5 charge types tracked per vehicle
- [ ] Import/export working for CSV and Excel
- [ ] Dashboard displaying accurate KPIs
- [ ] Zero critical bugs
- [ ] Single admin user can log in
- [ ] Deployed on Vercel with HTTPS
- [ ] Data backed up in Supabase

### 10.2 Key Performance Indicators (KPIs)

**Usage Metrics:**
- Daily active sessions
- Number of vehicles managed
- Number of charge records created per month
- Import frequency and volume
- Export frequency and volume

**Efficiency Metrics:**
- Time to add a vehicle: < 1 minute
- Time to import 100 vehicles: < 30 seconds
- Time to generate export report: < 10 seconds
- User clicks to complete common tasks: < 3

**Quality Metrics:**
- Import success rate: > 95%
- Export accuracy: 100%
- User-reported bugs: < 5 per month
- System uptime: > 99%

### 10.3 Success Criteria (Post-Launch)

**3 Months Post-Launch:**
- Fleet manager uses app daily for vehicle/charge management
- Zero usage of old spreadsheet system
- At least 10 exports generated for reporting
- No data migration issues

**6 Months Post-Launch:**
- Full year of charge data tracked
- Ready to add additional users
- User satisfaction: 8/10 or higher

---

## 11. Release Plan

### 11.1 Development Phases

**Phase 1: Foundation (Weeks 1-2)**
- Set up development environment
- Initialize React + Vite project
- Set up Supabase project and database schema
- Create base UI components library
- Implement authentication

**Phase 2: Core CRUD (Weeks 3-4)**
- Vehicles CRUD pages and functionality
- Charges CRUD pages and functionality
- Categories CRUD
- Form validations
- Toast notifications

**Phase 3: Import/Export (Weeks 5-6)**
- CSV import with validation
- Excel import
- Export by year
- Export by codes
- Column selection
- CSV/Excel export
- Import/export testing with real data

**Phase 4: Dashboard & Reporting (Week 7)**
- Dashboard KPIs
- Dashboard filters
- PDF export (optional)

**Phase 5: Polish & Testing (Week 8)**
- UI/UX refinements
- Responsive design testing
- Cross-browser testing
- Performance optimization
- Bug fixes

**Phase 6: Deployment (Week 9)**
- Set up Vercel project
- Configure environment variables
- Deploy to production
- User acceptance testing
- Initial data migration (import real fleet data)

### 11.2 Rollout Strategy

**Soft Launch:**
- Deploy to production
- Single admin user (fleet manager) gets access
- Monitor for issues for 1 week
- Collect initial feedback

**Full Launch:**
- Announce to stakeholders
- Migrate all data from old system
- Decommission spreadsheet workflow
- Document common tasks

**Post-Launch Support:**
- Weekly check-ins for first month
- Bug fixes within 48 hours
- Feature requests logged for Phase 2

### 11.3 Future Enhancements (Post-MVP)

**Phase 2 (3-6 months post-launch):**
- Multi-user support with role-based access
- Due date tracking and reminders
- Advanced dashboard with charts
- Email notifications
- Charge history and trends

**Phase 3 (6-12 months post-launch):**
- Mobile app (React Native)
- Integration with AS-TECH for payment sync
- Driver management module
- Maintenance history beyond charges
- Document attachments (insurance papers, inspection certificates)

---

## 12. Out of Scope

The following features are **explicitly excluded** from the MVP:

### 12.1 Not in MVP
- ❌ Alerts/notifications for upcoming due dates
- ❌ Payment tracking (handled externally in AS-TECH)
- ❌ Due date reminders
- ❌ Overdue notifications
- ❌ Charts and graphs (dashboard KPIs only)
- ❌ Trend analysis
- ❌ JSON import/export
- ❌ Multi-tenant architecture
- ❌ Driver management
- ❌ Geolocation/GPS tracking
- ❌ Maintenance history (beyond the 5 fixed charges)
- ❌ Mobile native apps
- ❌ Email reminders
- ❌ Advanced analytics/BI tools
- ❌ Fuel consumption tracking
- ❌ Route planning
- ❌ Document storage (PDFs, images)
- ❌ Audit logs (beyond import logs)
- ❌ API for third-party integrations

### 12.2 Explicitly Not Supported
- Payment processing (stays in AS-TECH)
- Integration with AS-TECH system
- Automatic charge calculations
- Contract management
- Vendor management
- Multi-language support (French only for MVP)

---

## 13. Appendices

### Appendix A: Charge Types Reference

| Charge Type | French Name | Frequency | Due Date Type | Typical Amount Range |
|-------------|-------------|-----------|---------------|---------------------|
| Technical Inspection | Visite technique | 12 months (trucks)<br>6 months (minibus) | Variable per vehicle | 500-1,500 MAD |
| Transport Tax | Taxe transport | Annual | Fixed (Jan 1) | 2,000-5,000 MAD |
| Axle Tax | Taxe à l'essieu | Annual | Fixed (Jan 1) | 1,000-3,000 MAD |
| Tachograph | Chrono tachygraphe | 24 months | Variable per vehicle | 800-2,000 MAD |
| Insurance | Assurance | Annual | Fixed (Jan 1) | 5,000-15,000 MAD |

### Appendix B: Sample CSV Import Format

```csv
code,registration_plate,vehicle_type,brand,fuel_type,purchase_date,category,status
T535,AB-12345,camion,Mercedes,Diesel,2020-03-15,camion benne 8x4,active
C320,CD-67890,camion,Volvo,Diesel,2019-11-20,plateau 12M,active
M500,EF-11223,minibus,Iveco,Diesel,2021-06-10,minibus 30 places,active
```

### Appendix C: Export Column Options

**Vehicle Information Columns:**
- Vehicle Code
- Registration Plate
- Vehicle Type
- Brand
- Fuel Type
- Purchase Date
- Category
- Status

**Charge Information Columns:**
- Charge Type
- Amount (MAD)
- Payment Date

**Aggregated Columns:**
- Total Charges (sum for vehicle)
- Charge Count (number of charges)

**Metadata Columns:**
- Year
- Notes
- Last Updated Date

### Appendix D: Free Tier Limits

**Supabase Free Tier:**
- 500 MB database storage
- 2 GB bandwidth per month
- 50,000 monthly active users
- 500 MB file storage
- Automatic daily backups (7-day retention)
- No credit card required

**Vercel Free Tier:**
- 100 GB bandwidth per month
- Unlimited websites
- Automatic HTTPS
- Serverless functions: 100 GB-hours
- No credit card required

**Estimated Usage (200 vehicles, 2000 charges):**
- Database size: ~5 MB
- Monthly bandwidth: < 500 MB
- Well within free tier limits

### Appendix E: Glossary

- **Charge:** A fixed periodic regulatory expense (inspection, tax, insurance)
- **Vehicle Code:** Primary identifier for vehicles (e.g., T535, C320)
- **Category:** Vehicle body type/configuration (e.g., "camion benne 8x4")
- **Active Status:** Vehicle currently in fleet operation
- **Sold Status:** Vehicle no longer in fleet, archived
- **MAD:** Moroccan Dirham (currency)
- **CRUD:** Create, Read, Update, Delete operations
- **KPI:** Key Performance Indicator
- **RLS:** Row-Level Security (Supabase security feature)
- **AS-TECH:** External system used for payment tracking

### Appendix F: Contact & Approval

**Product Owner:** Fleet Manager  
**Technical Lead:** TBD  
**Stakeholders:** Accounting team, Management  

**Approval Signatures:**
- [ ] Product Owner: _________________ Date: _________
- [ ] Technical Lead: _________________ Date: _________

---

**Document Version:** 1.0  
**Last Updated:** September 1, 2026  
**Next Review:** Post-MVP Launch  

---

**End of Product Requirements Document**
