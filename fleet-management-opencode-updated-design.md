# Fleet Management App — Updated OpenCode UI/UX Specification

## 1. Goal

Redesign the existing fleet-management application using the uploaded **Color & Typography** reference as the visual direction.

The application should feel like a modern, premium enterprise SaaS product: clean, minimal, professional, compact, and highly usable for daily fleet administration.

The uploaded image is a **visual guide for the color palette and typography**. Do not copy its exact design.

---

# 2. Important Navigation Change

Simplify the sidebar.

The sidebar should contain ONLY:

```text
Dashboard
Vehicles
```

Remove these navigation items completely:

```text
Charges
Interventions
Reports
```

Do not leave empty routes, disabled links, or unnecessary placeholders for the removed sections.

The functionality related to vehicle charges should live inside the **Vehicles** experience and the **Dashboard**.

Recommended sidebar:

```text
┌──────────────────────┐
│ LOGO                 │
│                      │
│ Menu                 │
│                      │
│ ▦  Dashboard         │
│ 🚚 Vehicles          │
│                      │
│                      │
│                      │
│ ⚙  Settings          │
└──────────────────────┘
```

If Settings already exists in the application, it may remain at the bottom. Do not add unnecessary navigation items.

---

# 3. Visual Direction

Use the uploaded Color & Typography image as the main visual reference.

The design language should be:

- Minimal
- Premium
- Modern
- Enterprise
- High contrast
- Clean
- Data-focused
- Calm
- Professional

Avoid making the application look like a generic AI-generated dashboard.

The UI should feel closer to a professionally designed SaaS/admin product than a template.

---

# 4. Color Palette

Use the palette shown in the uploaded image.

## Primary Accent

```text
#1A73E8
```

Use this as the main application accent.

Use it for:

- Primary buttons
- Active sidebar item
- Selected navigation
- Links
- Focus states
- Selected filters
- Important interactive elements
- Important icons
- Active pagination
- Progress indicators

## Black

```text
#000000
```

Use for:

- Main headings
- Important numbers
- Strong labels
- High-priority text
- Selected/high-emphasis content

## Dark Gray

```text
#575757
```

Use for:

- Secondary text
- Descriptions
- Metadata
- Table headers
- Supporting labels
- Secondary icons

## Light Background

```text
#F5F4F4
```

Use for:

- Application background
- Subtle sections
- Hover backgrounds where appropriate

## White

```text
#FFFFFF
```

Use for:

- Cards
- Tables
- Modals
- Inputs
- Main content surfaces
- Sidebar where appropriate

---

# 5. Color Usage Ratio

Do NOT use blue everywhere.

The application should be mostly:

```text
White
#F5F4F4
#000000
#575757
```

with:

```text
#1A73E8
```

used selectively as the accent.

Blue should communicate:

> interactive, selected, active, or important.

Avoid:

- Blue backgrounds everywhere
- Blue KPI cards everywhere
- Gradients
- Excessive colored cards
- Random accent colors
- Purple gradients
- Glassmorphism
- Neon effects

---

# 6. Typography

Use the typography direction shown in the reference image.

Preferred font:

```text
Geist
```

If Geist is not already available, use:

```text
Inter
```

or the existing project's modern sans-serif font.

Typography should be:

- Clean
- Strong
- Modern
- High readability
- Slightly compact
- Professional

Use clear hierarchy.

### Main page titles

Black:

```text
#000000
```

### Primary content

```text
#000000
```

### Secondary content

```text
#575757
```

### Interactive text

```text
#1A73E8
```

Avoid oversized typography.

---

# 7. Main Application Structure

Use:

```text
┌─────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar                                            │
│         ├───────────────────────────────────────────────────┤
│         │                                                   │
│         │ Main Content                                      │
│         │                                                   │
│         │                                                   │
│         │                                                   │
└─────────────────────────────────────────────────────────────┘
```

The sidebar should be visually quiet.

The main content should receive the most visual attention.

---

# 8. Sidebar Design

The sidebar should use:

- White background
- Subtle border
- Clean logo area
- Small section label
- Simple outline icons
- Compact navigation items
- Active state using `#1A73E8`

Example:

```text
Fleet Management

MENU

▦  Dashboard
🚚 Vehicles
```

Active item:

```text
┌─────────────────────┐
│ 🚚  Vehicles        │
└─────────────────────┘
```

Use a subtle light-blue background for the active item rather than a full blue block.

Suggested active background:

```text
#EAF2FF
```

Active icon/text:

```text
#1A73E8
```

---

# 9. Dashboard

The Dashboard is the main overview page.

It should answer these questions immediately:

1. How many vehicles do we have?
2. How much are the total charges?
3. How much are the monthly charges?
4. How are vehicles distributed by category?
5. How are vehicles distributed by brand?
6. Which vehicles have the highest charges?
7. Which charge types contribute the most?
8. Are there any unusual or important charge situations?

Do not turn this into a chart-heavy dashboard.

Use tables as the primary information display.

---

# 10. Dashboard KPI Cards

At the top of the dashboard, create exactly these main KPI cards:

### KPI 1 — Total Vehicles

```text
Total Vehicles

128
```

Show the number of vehicles.

Use a vehicle icon.

---

### KPI 2 — Total Charges

```text
Total Charges

XXX XXX DH
```

This should represent the total charge amount according to the application's existing charge calculation.

---

### KPI 3 — Monthly Charges

```text
Monthly Charges

XX XXX DH
```

Show the monthly equivalent.

Use the existing business rules for calculating monthly values.

Do not invent new calculation logic.

---

# 11. KPI Card Design

Cards should be compact and elegant.

Example:

```text
┌──────────────────────────────┐
│ Total Vehicles          🚚   │
│                              │
│ 128                          │
│                              │
│ Vehicles in fleet            │
└──────────────────────────────┘
```

Use:

- White background
- Subtle border
- Very subtle shadow
- 10–14px radius
- Black primary number
- Gray supporting text
- Blue icon/accent

Do not make every KPI card blue.

---

# 12. Dashboard — Vehicle Categories Table

Under the KPI cards, create a table showing vehicle categories.

Title:

```text
Vehicles by Category
```

Columns:

```text
Category
Vehicles
Total Charges
Monthly Charges
```

Example:

```text
┌────────────────────────────────────────────────────┐
│ Vehicles by Category                               │
├──────────────┬──────────┬──────────────┬───────────┤
│ Category     │ Vehicles │ Total Charges│ Monthly   │
├──────────────┼──────────┼──────────────┼───────────┤
│ Tracteur     │ 42       │ 850,000 DH   │ 70,833 DH │
│ Camion       │ 56       │ 920,000 DH   │ 76,667 DH │
│ Minibus      │ 30       │ 310,000 DH   │ 25,833 DH │
└──────────────┴──────────┴──────────────┴───────────┘
```

Do not use a chart instead of this table.

The table should be the primary representation.

---

# 13. Dashboard — Vehicle Brands Table

Create a second table showing the same information grouped by vehicle brand.

Title:

```text
Vehicles by Brand
```

Columns:

```text
Brand
Vehicles
Total Charges
Monthly Charges
```

Example:

```text
┌────────────────────────────────────────────────────┐
│ Vehicles by Brand                                  │
├──────────────┬──────────┬──────────────┬───────────┤
│ Brand        │ Vehicles │ Total Charges│ Monthly   │
├──────────────┼──────────┼──────────────┼───────────┤
│ Volvo        │ 30       │ 620,000 DH   │ 51,667 DH │
│ Scania       │ 25       │ 510,000 DH   │ 42,500 DH │
│ Mercedes     │ 40       │ 700,000 DH   │ 58,333 DH │
└──────────────┴──────────┴──────────────┴───────────┘
```

Use real data from the database.

Do not hard-code these examples.

---

# 14. Dashboard — Charge Breakdown Table

Add a useful table showing charges by charge type.

Title:

```text
Charges Breakdown
```

Columns:

```text
Charge Type
Vehicles
Total Amount
Monthly Amount
```

Rows:

```text
Assurance
Taxe transport
Vignette
Visite technique
Chronotachygraphe
```

This gives the user a quick understanding of where fleet costs come from.

---

# 15. Dashboard — Vehicle Cost Table

Add another practical table:

```text
Vehicle Charges
```

Columns:

```text
Code
Matricule
Type
Marque
Total Charges
Monthly Charges
```

Show vehicles sorted by total charges.

This allows the user to immediately see which vehicles represent the highest fixed costs.

Add pagination.

Do not load an unnecessarily huge table at once.

---

# 16. Dashboard — Optional Attention Section

If useful and supported by existing data, add a compact section:

```text
Attention
```

Possible information:

- Vehicles with missing charge values
- Vehicles with unusually high charges
- Vehicles with incomplete data

Do not invent validity tracking or expiration functionality if that functionality is not already part of the application.

This application is focused on charge amounts.

---

# 17. Dashboard Layout

Recommended layout:

```text
Dashboard

[ Total Vehicles ]
[ Total Charges  ]
[ Monthly Charges ]

┌───────────────────────────────────────────────┐
│ Vehicles by Category                          │
│                                               │
│ Table                                         │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ Vehicles by Brand                             │
│                                               │
│ Table                                         │
└───────────────────────────────────────────────┘

┌───────────────────────┐ ┌─────────────────────┐
│ Charges Breakdown     │ │ Vehicle Charges     │
│                       │ │                     │
│ Table                 │ │ Table               │
└───────────────────────┘ └─────────────────────┘
```

On smaller screens, stack sections vertically.

---

# 18. Vehicles Page

The Vehicles page replaces the previous separate Charges page.

The user should manage the entire fleet from here.

Page title:

```text
Vehicles
```

Subtitle:

```text
Manage vehicles and their fixed charges
```

Top actions:

```text
[ Search ] [ Filters ] [ Import ] [ Export ] [ + Add Vehicle ]
```

---

# 19. Vehicle List

Main table:

```text
┌──────────────────────────────────────────────────────────────────┐
│ □ Code │ Matricule │ Type │ Brand │ Fiscal HP │ Tonnage │ View │
├──────────────────────────────────────────────────────────────────┤
│ □ ...  │ ...       │ ...  │ ...   │ ...       │ ...     │ View │
│ □ ...  │ ...       │ ...  │ ...   │ ...       │ ...     │ View │
└──────────────────────────────────────────────────────────────────┘
```

Use the existing truck/vehicle data.

Do not remove existing fields that are required by the application.

---

# 20. Vehicle Selection Behavior

When the user chooses a vehicle, show a detailed vehicle view.

This can be implemented as:

- Side panel
- Drawer
- Modal
- Dedicated detail area

Prefer a **right-side drawer or detail panel** for desktop because it allows the user to keep the vehicle list visible.

The selected vehicle should be visually highlighted.

---

# 21. Vehicle Detail Panel

The panel should show:

```text
Vehicle Details

Code
Matricule
Type
Brand
Fiscal HP
Tonnage
```

Then:

```text
Fixed Charges
```

Show each charge clearly:

```text
Assurance
12,500 DH

Taxe transport
4,500 DH

Vignette
2,000 DH

Visite technique
1,500 DH

Chronotachygraphe
800 DH
```

Then show:

```text
Total Charges
21,300 DH

Monthly Charges
1,775 DH
```

Use strong typography for totals.

---

# 22. Vehicle Detail Charge Cards

Charge items can use compact rows/cards.

Do NOT make five giant cards.

Recommended:

```text
┌──────────────────────────────────────────┐
│ Assurance                         12,500 │
│ Taxe transport                      4,500│
│ Vignette                             2,000│
│ Visite technique                     1,500│
│ Chronotachygraphe                       800│
├──────────────────────────────────────────┤
│ Total Charges                    21,300 DH│
│ Monthly Charges                   1,775 DH│
└──────────────────────────────────────────┘
```

Use blue only for emphasis.

---

# 23. Vehicle Detail Actions

Inside the selected vehicle panel:

```text
[ Edit Vehicle ]
[ Edit Charges ]
```

Optional:

```text
[ Export Vehicle ]
```

Do not add unnecessary actions.

---

# 24. Add Vehicle

Keep the existing multi-step creation process.

### Step 1

Vehicle information:

```text
Code
Matricule
Type
Brand
Fiscal HP
Tonnage
```

### Step 2

Fixed charges:

```text
Assurance
Taxe transport
Vignette
Visite technique
Chronotachygraphe
```

Step indicator:

```text
① Vehicle Information ───── ② Fixed Charges
```

Active step:

```text
#1A73E8
```

---

# 25. Edit Charges

Existing charge values MUST always be loaded into the form.

Never replace stored values with:

```text
0
```

unless the database actually contains zero.

Never use fake sample values.

The form should show the real stored amount for:

- Assurance
- Taxe transport
- Vignette
- Visite technique
- Chronotachygraphe

---

# 26. Monthly / Annual Calculations

Preserve the existing business rules.

General rule:

```text
Annual / 12 = Monthly
```

Special rules:

```text
Chronotachygraphe:
24-month basis

Minibus technical inspection:
6-month basis
```

Use the application's existing implementation/data model where possible.

Do not change calculations merely because the UI is being redesigned.

---

# 27. Vehicle Search

Search should support practical fleet lookup.

Search by:

- Code
- Matricule
- Brand
- Type

Example:

```text
🔍 Search vehicles...
```

Results should update smoothly.

---

# 28. Filters

Useful filters:

```text
Type
Brand
Fiscal HP
Tonnage
```

Keep filters compact.

Do not create a huge filter form.

---

# 29. Import / Export

Keep existing import/export functionality.

Top actions:

```text
[ Import ] [ Export ] [ + Add Vehicle ]
```

Excel export should include:

```text
Code
Matricule
Type
Brand
Fiscal HP
Tonnage
Assurance
Taxe transport
Vignette
Visite technique
Chronotachygraphe
Total Charges
Monthly Charges
```

Use real stored data.

---

# 30. Table Design

Tables should be the core visual language of the application.

Use:

- White background
- Thin borders
- Compact rows
- Strong alignment
- Clear headers
- Subtle hover
- Consistent column spacing

Table headers:

```text
#575757
```

Important values:

```text
#000000
```

Links/actions:

```text
#1A73E8
```

Avoid excessive badges.

---

# 31. Page Background

Use:

```text
#F5F4F4
```

as the main application background.

Use white for content surfaces.

Example:

```text
#F5F4F4
    ┌────────────────────────────────────┐
    │ #FFFFFF                            │
    │                                    │
    │ Content                            │
    │                                    │
    └────────────────────────────────────┘
```

This creates the same visual separation seen in the uploaded color/design reference.

---

# 32. Cards

Cards should be:

- White
- Clean
- Lightly bordered
- Slightly rounded
- Minimal shadow

Suggested:

```text
border-radius: 10–14px
```

Avoid very large rounded cards.

---

# 33. Buttons

### Primary

```text
Background: #1A73E8
Text: #FFFFFF
```

Example:

```text
+ Add Vehicle
```

### Secondary

```text
Background: #FFFFFF
Border: #E5E5E5
Text: #000000
```

### Ghost

```text
Background: transparent
Text: #575757
```

Use subtle hover states.

---

# 34. Icons

Use one consistent outline icon library.

Prefer Lucide if already installed.

Suggested icons:

```text
Dashboard → LayoutDashboard
Vehicles → Truck
Search → Search
Filter → SlidersHorizontal
Import → Upload
Export → Download
Edit → Pencil
View → Eye
Settings → Settings
```

Do not mix icon styles.

---

# 35. Typography Scale

Use a restrained hierarchy.

Example:

```text
Page title: 24–28px
Section title: 16–20px
Body: 14px
Table: 13–14px
Metadata: 12–13px
KPI number: 28–36px
```

Use Geist weights:

```text
Regular
Medium
Semibold
Bold
```

Do not use bold everywhere.

---

# 36. Spacing

Use a consistent spacing scale:

```text
4
8
12
16
20
24
32
40
48
```

Avoid arbitrary spacing values.

---

# 37. Borders and Shadows

Use borders as the main separation mechanism.

Suggested:

```text
border: 1px solid #E5E5E5
```

Shadows should be extremely subtle.

Avoid floating-heavy UI.

---

# 38. Responsive Behavior

Desktop is the primary environment.

For smaller screens:

- Collapse sidebar
- Allow table horizontal scrolling
- Stack dashboard tables
- Make KPI cards responsive
- Make detail drawer full-width when necessary
- Keep buttons usable
- Keep touch targets comfortable

Do not simply shrink the desktop layout.

---

# 39. Dashboard Data Integrity

All dashboard values MUST be calculated from the real vehicle and charge data.

Do NOT hard-code:

```text
128 vehicles
850,000 DH
70,833 DH
```

Those are visual examples only.

Use the actual database.

Dashboard calculations should automatically update when:

- Vehicle is added
- Vehicle is edited
- Vehicle is deleted
- Charge is changed
- Vehicle is imported

---

# 40. Important Business Logic

Preserve the existing application logic.

Do not change:

- Database schema
- Supabase tables
- Existing column names
- Authentication
- Existing CRUD behavior
- Import behavior
- Export behavior
- Charge calculations

unless absolutely necessary.

This is primarily a **UI/UX redesign and information architecture update**.

---

# 41. Remove Unused Sections

The previous application structure may contain:

```text
Dashboard
Camions
Charges
Interventions
Rapports
```

Replace it with:

```text
Dashboard
Vehicles
```

Charges are now a part of Vehicle management.

Do not create a standalone Charges page.

Do not create standalone Interventions or Reports pages.

---

# 42. Dashboard Information Architecture

The dashboard should contain:

### Row 1

```text
Total Vehicles
Total Charges
Monthly Charges
```

### Row 2

```text
Vehicles by Category
```

### Row 3

```text
Vehicles by Brand
```

### Row 4

```text
Charges Breakdown
Vehicle Charges
```

### Optional Row 5

```text
Attention / Data Quality
```

Only include the optional section if useful with the existing data.

---

# 43. Avoid Excessive Charts

The user specifically wants tables to be useful.

Tables should be the primary dashboard components.

Charts can be added only if they provide information that a table cannot communicate efficiently.

Do not add charts simply to make the dashboard look impressive.

---

# 44. UX Philosophy

The application should optimize for:

- Daily fleet administration
- Fast lookup
- Fast cost understanding
- Easy vehicle selection
- Easy charge editing
- Clear totals
- Easy Excel export

The user should be able to:

```text
Open Dashboard
→ Understand fleet size
→ Understand total costs
→ Understand monthly costs
→ See cost distribution
→ Select Vehicles
→ Open a vehicle
→ See all its charges
→ Edit charges
→ Export data
```

with minimal clicks.

---

# 45. Loading States

Use skeleton loaders.

Examples:

```text
KPI skeleton
Table row skeleton
Vehicle detail skeleton
```

Do not display a blank screen while loading.

---

# 46. Empty States

Example:

```text
No vehicles found

Try changing your search or filters.

[Clear Filters]
```

If there are no vehicles:

```text
No vehicles yet

Add your first vehicle to start managing your fleet.

[+ Add Vehicle]
```

---

# 47. Toasts

Use concise notifications.

Examples:

```text
Vehicle added successfully
Charges updated successfully
Vehicle updated successfully
Export completed
Import completed
Unable to save changes
```

Keep toasts visually consistent.

---

# 48. Accessibility

Maintain:

- Keyboard navigation
- Visible focus states
- Accessible labels
- Good contrast
- Semantic HTML
- Accessible dialogs
- Accessible buttons

Do not rely only on color to communicate important information.

---

# 49. Animation

Use subtle transitions only.

Recommended:

```text
150–250ms
```

Use for:

- Hover
- Focus
- Sidebar
- Drawer
- Modal
- Dropdown
- Toast

Avoid excessive motion.

---

# 50. Component Architecture

Create reusable components.

Recommended:

```text
AppShell
Sidebar
Topbar
PageHeader
KpiCard
DataTable
SearchInput
FilterButton
PrimaryButton
SecondaryButton
VehicleDrawer
VehicleDetails
ChargeList
ChargeSummary
AddVehicleStepper
FormField
Pagination
EmptyState
LoadingSkeleton
Toast
```

Reuse components across the application.

Do not duplicate styles.

---

# 51. Design Tokens

Centralize the visual system.

Example:

```css
:root {
  --color-primary: #1A73E8;
  --color-black: #000000;
  --color-dark-gray: #575757;
  --color-background: #F5F4F4;
  --color-white: #FFFFFF;

  --color-border: #E5E5E5;
  --color-primary-soft: #EAF2FF;

  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
}
```

Adapt this to the existing styling architecture.

Do not introduce a second CSS framework unnecessarily.

---

# 52. Existing Tech Stack

Before modifying anything, inspect the actual project.

Determine:

- Framework
- Build system
- CSS framework
- Component library
- Supabase integration
- Routes
- Database structure
- Existing CRUD
- Existing import/export
- Existing calculations

Work with the current architecture.

Do not rewrite the application from scratch.

---

# 53. Implementation Order

Follow this sequence.

## Phase 1 — Inspect

Understand the existing application and data model.

## Phase 2 — Remove Navigation

Remove:

```text
Charges
Interventions
Reports
```

Keep:

```text
Dashboard
Vehicles
```

## Phase 3 — Design System

Implement:

- Colors
- Geist typography
- Spacing
- Borders
- Radius
- Shadows
- Buttons
- Inputs
- Tables

## Phase 4 — App Shell

Implement:

- Sidebar
- Topbar
- Page container

## Phase 5 — Dashboard

Implement:

- 3 KPI cards
- Category table
- Brand table
- Charge breakdown table
- Vehicle charge table
- Optional attention section

## Phase 6 — Vehicles

Implement:

- Vehicle list
- Search
- Filters
- Import
- Export
- Add vehicle

## Phase 7 — Vehicle Detail

Implement:

- Selected vehicle detail
- Charge list
- Total charges
- Monthly charges
- Edit vehicle
- Edit charges

## Phase 8 — Responsive

Test smaller screens.

## Phase 9 — QA

Verify functionality and data integrity.

---

# 54. Final QA Checklist

## Navigation

- [ ] Dashboard exists
- [ ] Vehicles exists
- [ ] Charges navigation removed
- [ ] Interventions navigation removed
- [ ] Reports navigation removed
- [ ] No broken routes

## Dashboard

- [ ] Total Vehicles KPI
- [ ] Total Charges KPI
- [ ] Monthly Charges KPI
- [ ] Category table
- [ ] Brand table
- [ ] Charge breakdown table
- [ ] Vehicle charges table
- [ ] Real database data
- [ ] Values update automatically

## Vehicles

- [ ] Vehicle list works
- [ ] Search works
- [ ] Filters work
- [ ] Add vehicle works
- [ ] Edit vehicle works
- [ ] Vehicle selection works
- [ ] Vehicle detail appears
- [ ] Charges appear in vehicle detail
- [ ] Edit charges works
- [ ] Import works if already supported
- [ ] Export works

## Charges

- [ ] Assurance
- [ ] Taxe transport
- [ ] Vignette
- [ ] Visite technique
- [ ] Chronotachygraphe
- [ ] Existing values load correctly
- [ ] Existing values are not replaced by zeros
- [ ] Monthly calculation is correct
- [ ] Annual calculation is correct
- [ ] Special 24-month and 6-month rules remain correct

## Design

- [ ] Palette follows uploaded reference
- [ ] Primary blue is #1A73E8
- [ ] Black is #000000
- [ ] Dark gray is #575757
- [ ] Background is #F5F4F4
- [ ] Surfaces are white
- [ ] Geist typography used where possible
- [ ] No excessive gradients
- [ ] No excessive rounded cards
- [ ] No excessive shadows
- [ ] No unnecessary colors
- [ ] Tables are clean and readable
- [ ] Sidebar is minimal
- [ ] Active navigation is clear

## UX

- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Success notifications
- [ ] Hover states
- [ ] Focus states
- [ ] Accessible dialogs
- [ ] Responsive behavior

---

# 55. Final Design Goal

The final product should feel like:

> **A premium, minimal fleet-management SaaS application built for real daily operations.**

The visual hierarchy should be:

```text
Clean layout
      ↓
Strong typography
      ↓
Neutral surfaces
      ↓
Precise tables
      ↓
#1A73E8 for interaction
      ↓
Clear vehicle + charge information
```

The uploaded Color & Typography reference should guide the visual identity, especially:

- Blue accent
- Black typography
- Gray secondary text
- Light-gray background
- White surfaces
- Geist-style typography
- Minimal high-contrast aesthetic

Do not clone the reference.

Create an original interface optimized specifically for:

**Fleet → Vehicles → Vehicle details → Charges → Costs.**

The application should be visually impressive because it is **clean, consistent, and useful**, not because it contains unnecessary decoration.
