# 2026-09-23 — SMG Fleet UI/UX Redesign

Source of truth: `fleet-management-opencode-updated-design.md`. Rebuild the UI to match the spec while preserving business logic, schema, CRUD, import/export, auth, dark mode and i18n.

## Global constants

Light tokens: primary `#1A73E8` (hover `#1765CC`, soft `#EAF2FF`), headings `#000000`, secondary `#575757`, page bg `#F5F4F4`, surfaces white, borders `#E5E5E5`, shadows `0 1px 2px rgba(0,0,0,0.04)` / `0 4px 12px rgba(0,0,0,0.06)`.

Dark equivalents: bg `#0B0B10`, surface `#16161C`, raised `#1E1E26`, border `rgba(255,255,255,0.10)`, label `#F2F2F7`, secondary `#A0A0A8`, primary `#4D8DF7`, active bg `rgba(26,115,232,0.18)`.

Hex map across `src/**/*.jsx` light branches: `#0073d2`→`#1A73E8`, `#0068bd`→`#1765CC`, `#007AFF`→`#1A73E8`, `#0A84FF`→`#4D8DF7`, `#409CFF`→`#6EA8FE`. Leave red/green/amber semantic colors untouched.

## Files

### New
- `src/utils/chargeCalculations.js`
- `src/components/ui/Drawer.jsx` — right slide-in panel + backdrop (Esc/backdrop close)
- `src/components/ui/Skeleton.jsx`
- `src/components/ui/KpiCard.jsx`
- `src/components/vehicles/ChargeAmountFields.jsx`
- `src/components/vehicles/VehicleDrawer.jsx`
- `src/components/vehicles/EditVehicleChargesModal.jsx`
- `docs/superpowers/plans/2026-09-23-fleet-redesign.md`

### Deleted
- `src/pages/charges/ChargesList.jsx`
- `src/pages/charges/ChargeForm.jsx`
- `/charges`, `/charges/new`, `/charges/:id/edit` routes in `src/App.jsx`

### Modified
- `tailwind.config.js`, `src/main.jsx`, `src/index.css`
- `src/components/ui/{Button,Card,Table,Input,Select,Modal,Spinner,EmptyState,AutocompleteInput,FileUpload,ThemeToggle}.jsx`
- `src/components/layout/{Sidebar,Layout,Header}.jsx`
- `src/App.jsx`
- `src/services/api.js` (dashboardApi)
- `src/pages/Dashboard.jsx` (rewrite), `src/pages/vehicles/VehiclesList.jsx` (rewrite), `VehicleDetail.jsx`, `VehicleForm.jsx` (2-step)
- `src/pages/import/Import.jsx` (redirect fix), `src/pages/export/Export.jsx` (columns)
- `src/constants/exportColumns.js` (sync with Export.jsx VEHICLE_COLUMN_KEYS)
- `src/pages/Login.jsx`, `src/pages/settings/Settings.jsx`
- `src/i18n/locales/en.json`, `fr.json`

## Business logic

```js
// src/utils/chargeCalculations.js
getChargeMonths(name, vehicleType) // chrono→24, visite technique+minibus→6, else→12
monthlyAmount(amount, name, vehicleType) // amount/divisor, round 2dp
vehicleAnnualTotal(charges)
vehicleMonthlyTotal(vehicle, charges) // sum monthlyAmount per charge
```

Monthly calc replaces the flat `/12` everywhere (dashboard KPI, tables, drawer, detail, export).

## Tasks

1. Design tokens + Geist typography
2. Shared UI primitives restyle
3. Sidebar + shell + routes (remove charges nav/routes)
4. chargeCalculations util + dashboardApi extension
5. Dashboard rewrite: year selector, 3 KPIs, 4 tables, no recharts, pagination on Vehicle Charges
6. Vehicles list rewrite (search, filters, Import/Export, Add) + VehicleDrawer + EditVehicleChargesModal
7. VehicleDetail restyle + monthly
8. VehicleForm 2-step stepper
9. Import/Export restyle; Import redirect → `/vehicles`; export adds fiscal HP, tonnage, monthly columns (keep exportColumns.js in sync)
10. Login/Settings restyle
11. i18n additions (both locales)
12. QA: `npm run build`, `npm run preview`, manual checklist

## Verification

- `npm run build` after each task (dist/ regenerates — committed artifact, fine).
- No test framework / typecheck; `npm run lint` is broken — never run it.
- Manual checklist per spec §54: sidebar 3 items; no charts; KPI+table year linkage; /24 /6 /12 monthly calc; search+filters; drawer totals/edit; stepper; deep link `/vehicles/:code`; import/export; dark mode; mobile; EN/FR.