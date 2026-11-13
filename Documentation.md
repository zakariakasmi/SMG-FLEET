# SMG FLEET MANAGEMENT

## MASTER IMPLEMENTATION & DESIGN SPECIFICATION FOR OPENCODE

---

# 0. ROLE

You are implementing a production-oriented Fleet Management application called:

**SMG Fleet Management**

This is an internal operational application for a real vehicle fleet.

It is NOT:

- A generic SaaS dashboard
- A marketing website
- An AI showcase
- A maintenance system
- A CRM
- A telematics platform

The application must feel:

- Industrial
- Automotive
- Enterprise
- Operational
- Structured
- Precise
- Professional
- Data-focused
- Calm
- High-density

Do not impose a generic AI-generated SaaS template onto the application.

---

# 1. FIRST ACTION — INSPECT THE EXISTING PROJECT

Before modifying anything:

1. Inspect the complete repository.
2. Inspect `package.json`.
3. Inspect the Next.js structure.
4. Inspect Supabase configuration.
5. Inspect existing schema/migrations.
6. Inspect authentication.
7. Inspect existing components.
8. Inspect existing styles.
9. Inspect existing routes.
10. Inspect existing data models.
11. Identify what already works.
12. Identify incomplete or incorrect functionality.

Do not blindly rebuild working functionality.

Do not destroy existing database logic or real data.

Create a short implementation plan before making major changes.

---

# 2. PRODUCT PURPOSE

SMG Fleet Management manages:

- Vehicles
- Vehicle administrative/technical information
- Fixed vehicle charges
- Annualized costs
- Monthly costs
- Cost analysis
- Import
- Export
- Reference data
- Authentication
- Role-based authorization

The application must support real operational data.

---

# 3. STRICTLY OUT OF SCOPE

Do NOT create:

- Maintenance schedules
- Repairs
- Work orders
- Spare parts
- Workshop management
- Preventive maintenance
- Fuel consumption
- Fuel logs
- GPS tracking
- Driver management
- Telematics
- Payroll
- CRM
- Invoicing
- Subscription management
- AI assistant
- Chat
- Marketing pages

Scope:

**VEHICLES + FIXED CHARGES + COST ANALYSIS + DATA MANAGEMENT**

---

# 4. TECHNOLOGY STACK

Use:

- Next.js
- App Router
- TypeScript strict
- Tailwind CSS
- Supabase
- PostgreSQL
- Supabase Authentication
- Supabase RLS
- Server Actions and/or Route Handlers

Use strict TypeScript.

Avoid unnecessary `any`.

---

# 5. ICON SYSTEM — IMPORTANT

## DO NOT USE LUCIDE

Do NOT use:

```text
lucide-react
Lucide icons
```

If Lucide already exists in the project:

- Find every Lucide usage.
- Replace it with the appropriate Untitled UI icon.
- Remove the dependency if it is no longer needed.

## PRIMARY ICON SYSTEM

Use **Untitled UI Icons** as the application's primary and consistent icon system.

Reference:

https://www.untitledui.com/react/components/

Use Untitled UI icons for:

- Sidebar navigation
- Header actions
- Search
- Filter
- Sort
- Add
- Edit
- Delete
- View
- Settings
- Import
- Export
- Download
- Upload
- User/profile
- Vehicle actions
- Table actions
- Dropdowns
- Dialog actions
- Breadcrumbs
- Pagination
- Status-related UI where appropriate

Do NOT mix icon libraries.

Do NOT use:

- Heroicons
- Font Awesome
- Bootstrap Icons
- Material Icons
- Random SVG icons
- Emoji as UI icons
- Lucide

Use icons functionally, not decoratively.

Typical icon sizes:

```text
16px
18px
20px
24px
```

Icon-only buttons must have:

- Accessible labels
- Tooltips where appropriate
- Proper keyboard focus

Use **shadcn/ui for structural components** and **Untitled UI icons + application patterns as references**.

---

# 6. SUPABASE SETUP

Use:

```text
@supabase/supabase-js
@supabase/ssr
```

Create:

```text
.env.example
```

with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
```

to the browser.

---

# 7. DATABASE FIRST

Database architecture must be established before UI implementation.

Create:

```text
supabase/schema.sql
```

Include:

- Tables
- Enums
- Foreign keys
- Indexes
- Constraints
- RLS
- RLS policies

---

# 8. DATABASE STRUCTURE

## profiles

```text
id
role
full_name
created_at
```

Roles:

```text
ADMIN
STANDARD_USER
```

## vehicle_categories

```text
id
name
created_at
```

## vehicle_types

```text
id
name
created_at
```

## brands

```text
id
name
created_at
```

## fuel_types

```text
id
name
created_at
```

## charge_types

```text
id
name
created_at
```

## vehicles

```text
id
code
registration
category_id
type_id
brand_id
model
fuel_type_id
fiscal_hp
tonnage
status
created_at
updated_at
```

Status:

```text
ACTIVE
INACTIVE
OUT_OF_SERVICE
```

Constraints:

```text
code UNIQUE
registration UNIQUE
```

## vehicle_charges

```text
id
vehicle_id
charge_type_id
amount
frequency
start_date
end_date
notes
created_at
```

Frequency:

```text
1_MONTH
3_MONTHS
6_MONTHS
12_MONTHS
24_MONTHS
```

---

# 9. EXISTING DATABASE MIGRATION

The existing project may contain legacy text fields:

```text
brand
vehicle_type
fuel_type
```

which need migration to:

```text
brand_id
type_id
fuel_type_id
```

If these exist:

DO NOT destroy data.

Migration must:

1. Create missing lookup tables.
2. Add missing foreign-key columns.
3. Map existing text values.
4. Preserve vehicles.
5. Create indexes.
6. Update dependent views.
7. Preserve RLS.

Never drop production data simply to simplify the schema.

---

# 10. NO DEMO DATA

This is mandatory.

Do NOT seed:

- Fake vehicles
- Fake brands
- Fake categories
- Fake charges
- Fake costs
- Fake statistics
- Fake activity
- Fake percentages

Fresh installation may contain zero records.

The UI must look professional with an empty database.

---

# 11. AUTHENTICATION

Create:

```text
/login
```

Use Supabase Authentication.

After login:

```text
ADMIN
→ full access

STANDARD_USER
→ read-only operational access
```

---

# 12. AUTHORIZATION

Authorization must exist at:

1. UI level
2. Server level
3. Database/RLS level

## ADMIN

Can:

- Create vehicles
- Edit vehicles
- Delete vehicles
- Create charges
- Edit charges
- Delete charges
- Import
- Export
- Manage reference data

## STANDARD_USER

Can:

- View dashboard
- View vehicles
- Search
- Filter
- Sort
- View vehicle details
- View charges
- Export permitted data

Cannot modify administrative data.

---

# 13. ROUTING — UPDATED

Use these routes:

```text
/login

/dashboard

/vehicles
/vehicles/new
/vehicles/[id]

/import

/export

/settings
```

### IMPORTANT

Import and Export are **separate full pages**.

Do NOT implement Import as:

```text
/vehicles/import
```

Do NOT implement Export only as a modal/dropdown.

Use:

```text
/import
/export
```

as dedicated application pages.

The Vehicles page should contain actions/buttons that navigate to:

```text
Importer → /import
Exporter → /export
```

---

# 14. NAVIGATION

Keep the main navigation intentionally small.

Primary navigation:

```text
Dashboard
Vehicles
Import
Export
```

Settings is secondary/footer navigation:

```text
Settings
```

Settings is ADMIN-only.

Do NOT create navigation items for:

```text
Charges
Interventions
Reports
Analytics
Maintenance
```

Charges belong inside vehicle workflows.

Analytics belong inside Dashboard.

Import and Export are now independent operational pages.

---

# 15. VEHICLES PAGE

Route:

```text
/vehicles
```

Header:

```text
Vehicles
```

Actions:

```text
Ajouter un véhicule
Importer
Exporter
```

The buttons must navigate to:

```text
Ajouter → /vehicles/new
Importer → /import
Exporter → /export
```

Below:

- Search
- Filters
- Sorting
- Table
- Pagination

---

# 16. VEHICLE TABLE

Recommended columns:

```text
Code
Immatriculation
Catégorie
Type
Marque
Modèle
Puissance fiscale
Tonnage
Statut
Charges annuelles
Actions
```

Use a high-density professional table.

---

# 17. VEHICLE TABLE REQUIREMENTS

Support:

- Search
- Server-side filtering
- Server-side sorting
- Server-side pagination
- Status filtering
- Category filtering
- Brand filtering
- Type filtering
- Row actions
- Export navigation

Do not load the entire fleet into the browser.

---

# 18. VEHICLE DETAIL

Route:

```text
/vehicles/[id]
```

Structure:

```text
Breadcrumb

Vehicle Header
    Identity
    Status
    Actions

Vehicle Information

Charges

Cost Summary
    Annualized total
    Monthly total
```

Vehicle information:

```text
Code
Registration
Category
Type
Brand
Model
Fuel
Fiscal HP
Tonnage
```

Charges:

```text
Charge type
Amount
Frequency
Start date
End date
Annualized amount
Actions
```

---

# 19. ADD VEHICLE

Route:

```text
/vehicles/new
```

Two-step workflow.

### STEP 1

Vehicle information:

- Code
- Registration
- Category
- Vehicle Type
- Brand
- Model
- Fuel Type
- Fiscal HP
- Tonnage
- Status

### STEP 2

Initial fixed charges.

Actions:

```text
Back
Continue
Cancel
Save
```

---

# 20. CHARGE CALCULATIONS

Create:

```text
lib/calculations.ts
```

Annualized:

```text
12_MONTHS = amount

1_MONTH = amount × 12

3_MONTHS = amount × 4

6_MONTHS = amount × 2

24_MONTHS = amount ÷ 2
```

Monthly:

```text
monthlyCost = annualizedCost / 12
```

All pages must use the centralized calculation logic.

Do not duplicate calculations inside components.

The functions must be unit-testable.

---

# 21. DASHBOARD

Route:

```text
/dashboard
```

Dashboard is operational, not decorative.

Primary KPIs:

```text
Total Vehicles
Total Annual Charges
Monthly Charges
```

Only three primary KPI cards.

---

# 22. DASHBOARD — COST BY CATEGORY

Table:

```text
Category
Vehicle Count
Annual Charges
Monthly Charges
```

Use real database aggregation.

---

# 23. DASHBOARD — COST BY BRAND

Table:

```text
Brand
Vehicle Count
Annual Charges
Monthly Charges
```

Use real database data.

---

# 24. DASHBOARD — ADDITIONAL TABLES

Useful operational tables may include:

### Highest Cost Vehicles

```text
Vehicle
Registration
Category
Annual Cost
Monthly Cost
```

### Missing Charges

```text
Vehicle
Registration
Category
Status
```

### Charge Breakdown

```text
Charge Type
Number of Charges
Annualized Cost
```

Do not add unnecessary widgets.

---

# 25. IMPORT PAGE — NEW DEDICATED PAGE

Route:

```text
/import
```

This is a complete page, not a modal.

Page title:

```text
Import
```

Purpose:

Import vehicle and charge data into the fleet system.

The page should provide a professional multi-step workflow.

## Import workflow

```text
1. Select file
2. Detect file type
3. Parse file
4. Detect columns
5. Map columns
6. Preview
7. Validate
8. Show errors
9. Confirm
10. Commit
11. Show result
```

Support appropriate:

```text
CSV
XLSX
```

Do not silently accept invalid files.

---

# 26. IMPORT PAGE — FILE UPLOAD

Use a professional file uploader.

Reference Untitled UI file-upload patterns.

Show:

```text
Select file
Supported formats
Selected filename
File size
Remove
Continue
```

Do not use decorative upload illustrations.

---

# 27. IMPORT PAGE — COLUMN MAPPING

Allow mapping imported columns to fields such as:

```text
Code
Registration
Category
Type
Brand
Model
Fuel Type
Fiscal HP
Tonnage
Status
Charge Type
Amount
Frequency
Start Date
End Date
Notes
```

The mapping UI must clearly distinguish:

```text
Required
Optional
Unmapped
Invalid
```

---

# 28. IMPORT PAGE — PREVIEW

Show a real preview table.

Include:

```text
Row
Mapped fields
Validation status
Error count
```

Allow the user to inspect invalid rows before committing.

---

# 29. IMPORT VALIDATION

Validate:

- Required fields
- Data types
- Foreign-key references
- Duplicate code
- Duplicate registration
- Invalid frequency
- Invalid dates
- Invalid amounts
- Invalid status

Show summary:

```text
Total rows
Valid rows
Invalid rows
Duplicates
Rows to import
Rows to skip
```

Do not silently skip records.

---

# 30. IMPORT COMMIT

Preferred flow:

```text
Parse
→ Validate
→ Preview
→ Confirm
→ Transaction
```

Do not partially corrupt the database.

Where possible, commit the import transactionally.

Show final result:

```text
Imported
Skipped
Failed
```

with useful error details.

---

# 31. EXPORT PAGE — NEW DEDICATED PAGE

Route:

```text
/export
```

This is a complete page.

Do NOT make Export only a dropdown action.

Page title:

```text
Export
```

Purpose:

Allow users to export real fleet data in a controlled way.

---

# 32. EXPORT PAGE — EXPORT OPTIONS

Provide export choices such as:

```text
Vehicles
Vehicles + Charges
Filtered Vehicles
Dashboard / Analytical Data
```

Formats:

```text
CSV
XLSX
PDF where appropriate
```

---

# 33. EXPORT PAGE — FILTERS

Allow users to choose relevant filters before export:

```text
Category
Brand
Vehicle Type
Status
Charge Type
Date range
```

Only show filters that actually affect the selected export.

Do not create fake filters.

---

# 34. EXPORT PAGE — PREVIEW

Before exporting, show:

```text
Export type
Filters
Number of records
Selected columns
```

Then:

```text
Generate export
```

After generation:

```text
Download
```

Export must always use real database data.

---

# 35. EXPORT PAGE — VEHICLE EXPORT

Allow:

```text
Vehicle information
```

with fields such as:

```text
Code
Registration
Category
Type
Brand
Model
Fuel Type
Fiscal HP
Tonnage
Status
```

---

# 36. EXPORT PAGE — VEHICLE + CHARGES

Allow a detailed export containing:

```text
Vehicle
Registration
Category
Type
Brand
Model
Charge Type
Amount
Frequency
Start Date
End Date
Annualized Amount
Monthly Amount
```

Use the centralized calculation functions.

---

# 37. EXPORT PAGE — FILTERED DATA

If a user comes from `/vehicles` after applying filters, support exporting the corresponding filtered dataset where practical.

Do not export data that does not match the selected filter criteria.

---

# 38. SETTINGS

Route:

```text
/settings
```

ADMIN-only.

Manage:

```text
Vehicle Categories
Vehicle Types
Brands
Fuel Types
Charge Types
```

Use tables + dialogs/drawers/forms.

Do not create decorative settings cards.

---

# 39. SHADCN/UI

Use shadcn/ui as the primary structural component foundation.

Reference:

https://ui.shadcn.com/docs/components

Use for:

- Button
- Input
- Label
- Select
- Combobox
- Dialog
- Drawer
- Sheet
- Dropdown Menu
- Command
- Popover
- Calendar
- Date Picker
- Tabs
- Table
- Pagination
- Badge
- Alert
- Toast
- Tooltip
- Skeleton
- Checkbox
- Radio Group
- Switch
- Textarea
- Separator
- Breadcrumb
- Sidebar

Do not manually recreate components that shadcn already provides.

---

# 40. UNTITLED UI REACT

Use Untitled UI React as the primary **visual/application pattern reference**.

Reference:

https://www.untitledui.com/react/components/

Use it especially for:

- Icons
- Tables
- Data tables
- Pagination
- Filter bars
- Empty states
- File uploaders
- Page headers
- Navigation
- Sidebars
- Drawers
- Modals
- Forms
- Utility buttons
- Application layouts

Do not blindly copy Untitled UI pages.

Adapt patterns to SMG.

---

# 41. COMPONENT STYLE RULE

Do not blindly mix shadcn and Untitled UI.

Create ONE SMG design system.

Use:

```text
shadcn/ui
    ↓
structural primitives

Untitled UI
    ↓
icons + application patterns + interaction references

SMG Design System
    ↓
final unified visual language
```

Normalize:

- Radius
- Typography
- Spacing
- Borders
- Shadows
- Colors
- States
- Density

The final interface must look like one product.

---

# 42. COMPONENT ARCHITECTURE

Use approximately:

```text
components/
├── ui/
├── layout/
├── dashboard/
├── vehicles/
├── charges/
├── import/
├── export/
└── settings/
```

Examples:

```text
components/import/
├── import-uploader.tsx
├── import-mapping.tsx
├── import-preview.tsx
├── import-validation.tsx
└── import-summary.tsx
```

```text
components/export/
├── export-type-selector.tsx
├── export-filters.tsx
├── export-preview.tsx
└── export-summary.tsx
```

Adapt to the existing project.

Do not create unnecessary abstractions.

---

# 43. SIDEBAR

Use compact navigation:

```text
SMG FLEET

Dashboard
Vehicles
Import
Export

----------------

Settings
```

Use **Untitled UI icons**.

Do not use Lucide.

Do not fill the sidebar with decorative icons.

Active navigation should be clearly identifiable.

---

# 44. HEADER

Header may contain:

- Page title
- Context
- Relevant actions
- User/profile menu

Use Untitled UI icons.

Do not create a marketing header.

---

# 45. BUTTONS

Keep buttons compact.

Examples:

```text
Ajouter un véhicule
Importer
Exporter
Enregistrer
Annuler
Supprimer
```

Use appropriate Untitled UI icons when useful.

Do not put icons on every button unnecessarily.

Avoid excessive `rounded-full`.

---

# 46. TABLES

Tables are first-class UI.

Use:

- Clear headers
- Tight rows
- Subtle borders
- Hover states
- Status badges
- Numeric alignment
- Pagination
- Search
- Filters

Use Untitled UI table patterns as visual references.

---

# 47. CARDS

Use cards only when they structure useful information.

Prefer:

```text
rounded-sm
rounded-md
```

Avoid:

```text
rounded-2xl
rounded-3xl
```

Do not create floating card piles.

---

# 48. FORMS

Forms must be:

- Compact
- Structured
- Accessible
- Clearly labeled

Use:

- Labels
- Help text
- Validation
- Required indicators
- Select/Combobox
- Date picker
- Numeric inputs
- Error messages

---

# 49. DIALOGS AND DRAWERS

Use for:

- Charge creation
- Charge editing
- Reference data
- Confirmations
- Quick actions

Use full pages for complex workflows such as:

```text
Import
Export
Add Vehicle
```

---

# 50. TOASTS

Provide concise feedback for:

- Vehicle created
- Vehicle updated
- Vehicle deleted
- Charge created
- Charge updated
- Charge deleted
- Import completed
- Import failed
- Export generated
- Settings updated

---

# 51. EMPTY STATES

Empty states must be operational.

Examples:

```text
Aucun véhicule enregistré.

Ajouter un véhicule
Importer des véhicules
```

```text
Aucune charge enregistrée.
```

Never add fake data to make an empty state look populated.

---

# 52. LOADING STATES

Use skeletons.

Avoid unnecessary full-screen spinners.

---

# 53. ERROR STATES

Never expose raw database errors.

Example:

Instead of:

```text
duplicate key value violates unique constraint
```

show:

```text
Un véhicule avec ce code existe déjà.
```

---

# 54. COLOR SYSTEM

Use:

```text
#0F172A
#1E293B
#64748B
#CBD5F5
#F8FAFC
#FFFFFF
```

Do not introduce random brand colors.

Avoid:

- Purple gradients
- Blue gradients
- Neon colors
- Glassmorphism

Semantic colors may be used for:

- Success
- Warning
- Error

but sparingly.

---

# 55. VISUAL DIRECTION

The product should feel:

```text
INDUSTRIAL
AUTOMOTIVE
ENTERPRISE
OPERATIONAL
TECHNICAL
HIGH-DENSITY
PRECISE
CALM
```

Think:

```text
Fleet office
Transport company
Vehicle administration
Operational control system
```

Not:

```text
Startup
Fintech
Marketing SaaS
AI dashboard
```

---

# 56. DARK MODE

Support dark mode.

Use the SMG navy/slate palette.

Do not simply invert the light interface.

Tables, dialogs and forms must remain readable.

---

# 57. RESPONSIVE DESIGN

Support:

- Desktop
- Laptop
- Tablet
- Mobile

Desktop is the primary operational environment.

On mobile:

- Preserve important information.
- Allow intentional horizontal table scrolling.
- Move secondary information into detail views.
- Keep actions accessible.

---

# 58. PERFORMANCE

Use:

- Server-side pagination
- Server-side filtering
- Server-side sorting
- Indexed database queries
- Efficient Supabase queries
- Lazy loading where useful

Do not load the entire fleet into the browser.

Do not create unnecessary realtime subscriptions.

---

# 59. DATABASE INDEXES

Index frequently queried fields:

```text
vehicles.code
vehicles.registration
vehicles.status
vehicles.category_id
vehicles.type_id
vehicles.brand_id
vehicles.fuel_type_id
vehicle_charges.vehicle_id
vehicle_charges.charge_type_id
```

Add additional indexes only when justified by query patterns.

---

# 60. DATA INTEGRITY

Use:

- Foreign keys
- Unique constraints
- Check constraints
- Validation
- Transactions where required

Do not allow orphaned charges.

Do not allow invalid vehicle references.

---

# 61. ANALYTICS

All dashboard values must come from real database data.

Never hard-code:

```text
127 vehicles
52,400
+12.5%
```

unless these values actually exist.

No fake growth percentages.

No fake historical comparisons.

---

# 62. COST AGGREGATION

All dashboard and export cost calculations must use:

```text
lib/calculations.ts
```

Do not implement different formulas in different pages.

Be careful when joining vehicles with multiple charges.

Avoid JOIN multiplication errors.

---

# 63. EXISTING VEHICLE SUMMARY VIEW

If the existing project has:

```text
vehicle_summary
```

inspect it before modifying.

It may contain:

```text
id
code
registration_plate
vehicle_type
type_id
type_name
brand
brand_id
brand_name
fuel_type
fuel_type_id
fuel_type_name
purchase_date
status
notes
ptac
puissance_fiscale
category_id
category_name
charge_count
total_charges
```

Preserve compatibility where possible.

Fix incorrect aggregation carefully.

---

# 64. TESTING

Test:

## Authentication

- Login
- Logout
- Unauthorized access
- ADMIN
- STANDARD_USER

## Vehicles

- Create
- Read
- Update
- Delete
- Search
- Filter
- Sort
- Pagination

## Charges

- Create
- Update
- Delete
- Annualized calculation
- Monthly calculation

## Import

- CSV
- XLSX
- Invalid file
- Missing columns
- Invalid fields
- Duplicate code
- Duplicate registration
- Empty file
- Large file

## Export

- CSV
- XLSX
- PDF where implemented
- Filtered data
- Vehicle + charges
- Correct calculations

## Settings

- Create
- Update
- Delete
- Empty states

## Dashboard

- Correct totals
- Category aggregation
- Brand aggregation
- Charge aggregation
- Empty database

---

# 65. FINAL QUALITY AUDIT

Before declaring the application complete:

```text
[ ] No fake data
[ ] No fake analytics
[ ] No fake charts
[ ] No maintenance module
[ ] No fuel module
[ ] No GPS module
[ ] No driver module

[ ] Authentication works
[ ] RLS works
[ ] ADMIN permissions work
[ ] STANDARD_USER permissions work

[ ] Vehicle CRUD works
[ ] Charge CRUD works
[ ] Calculations centralized

[ ] /import works as a dedicated page
[ ] /export works as a dedicated page
[ ] Import validation works
[ ] Export filtering works

[ ] Settings work
[ ] Empty states work
[ ] Loading states work
[ ] Error states work

[ ] Responsive design works
[ ] Dark mode works
[ ] Tables are usable
[ ] Pagination works
[ ] Search works
[ ] Filters work

[ ] Database indexes exist
[ ] Service-role key is not exposed
[ ] No TypeScript errors
[ ] No obvious runtime errors
[ ] No unnecessary dependencies

[ ] No Lucide
[ ] No Heroicons
[ ] No Font Awesome
[ ] No mixed icon libraries
[ ] Untitled UI icons used consistently

[ ] shadcn/ui used appropriately
[ ] Untitled UI used as visual/application reference
[ ] One coherent SMG design system

[ ] No generic AI dashboard styling
```

---

# 66. FINAL DESIGN PRINCIPLE

Do NOT build:

> "Another AI-generated SaaS dashboard."

Build:

> "A professional fleet operations system used every day by a transport/fleet administration team."

The application must immediately communicate:

- What vehicles exist
- What each vehicle costs
- Which categories cost the most
- Which brands cost the most
- Which vehicles have missing charges
- How to add/edit a vehicle
- How to manage charges
- How to import data
- How to export data

Prioritize operational clarity over visual decoration.

Use:

**shadcn/ui**

as the structural foundation.

Use:

**Untitled UI React**

as the reference for polished application patterns and iconography.

Use:

**Untitled UI Icons**

as the application's icon system.

Do NOT use Lucide.

Everything must be unified into:

# SMG FLEET DESIGN SYSTEM

using:

```text
#0F172A
#1E293B
#64748B
#CBD5F5
#F8FAFC
#FFFFFF
```

No generic AI styling.

No unnecessary features.

No fake data.

No fake analytics.

No unnecessary decoration.

Build the product around the actual fleet workflow.

# END OF SPECIFICATION
