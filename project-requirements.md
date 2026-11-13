# SMG Fleet Management App - Project Requirements

**Date:** 2026-09-01  
**Status:** Requirements Locked  
**Project Type:** MVP - New Development  
**Timeline:** Flexible, no hard deadline

---

## 1. Project Overview

A personal web app to manage a vehicle fleet (50-200+ vehicles), tracking vehicle information and their associated fixed regulatory charges. The app provides full CRUD operations, flexible import/export capabilities, and a simple dashboard for visibility into fleet costs.

**Key Goal:** Track which vehicles have which charges and their amounts. Payment tracking happens externally in AS-TECH.

---

## 2. Vehicle Data Model

Each vehicle has the following properties:

| Field | Type | Notes |
|-------|------|-------|
| **Code** | String | Primary identifier (e.g., T535, C320, CTR53, CPB01, M500) |
| **Registration Plate** | String | Secondary identifier |
| **Vehicle Type** | String | e.g., camion, minibus, van |
| **Brand** | String | Vehicle manufacturer |
| **Fuel Type** | String | Diesel, electric, gas, etc. |
| **Purchase Date** | Date | When vehicle was acquired |
| **Category** | String | Body/config: "camion benne 8x4", "plateau 12M", "porte char", etc. |
| **Status** | Enum | Active or Sold |

**Fleet Size:** 50-200+ vehicles

---

## 3. Charge Types (per vehicle)

All charges are **per vehicle**, not fleet-wide.

| Charge Name | Frequency | Due Date Type | Amount |
|-------------|-----------|---------------|--------|
| **Visite technique** | Trucks: 12 months<br>Minibus: 6 months | Variable per vehicle | Fixed |
| **Taxe transport** | Annual | Fixed (Jan 1 – Dec 31, all vehicles) | Fixed |
| **Taxe à l'essieu** | Annual | Fixed (Jan 1 – Dec 31, all vehicles) | Fixed |
| **Chrono tachygraphe** | 24 months | Variable per vehicle | Fixed |
| **Assurance** | Annual | Fixed (Jan 1 – Dec 31, all vehicles) | **Variable** (can change) |

**Important:** We only track **amounts**. Payment tracking and due date reminders are handled externally in AS-TECH.

---

## 4. CRUD Operations

Full Create, Read, Update, Delete on:

- **Vehicles** — add new, edit info, remove/archive
- **Charges** — add charge records, edit amounts, delete
- **Categories** — manage vehicle categories (camion benne 8x4, etc.)
- **Users** — manage access (single user now, scalable later)

### Notifications

Toast/feedback messages on all CRUD operations:
- "Vehicle T535 added successfully"
- "Vehicle T535 updated successfully"
- "Vehicle T535 removed"
- Import summary: "148 added, 9 updated, 3 failed"

---

## 5. Import Feature

**Purpose:** Bulk fill database initially, then incremental updates/additions of vehicles

**What to Import:** Vehicle data only (not charge records)

**Supported Formats:**
- CSV
- Excel (XLSX)

**Required Columns:**
- Code (unique identifier)
- Registration plate
- Vehicle type
- Brand
- Fuel type
- Purchase date
- Category
- Status (active/sold)

**Duplicate Handling:**
- If vehicle code already exists → **Update** existing record

**CSV Delimiter Support:**
- App must auto-detect delimiter (`;` or `,`) from the first line of the CSV

**Import Summary Modal:**
After uploading a file (vehicles or charges), a modal must appear showing:
- **Added** — number of new rows successfully inserted
- **Updated** — number of existing rows updated (vehicles only)
- **Failed** — number of rows that failed validation or DB insert

If there are errors:
- Show up to 5 error details in the modal
- If more than 5 errors, display a "Download Error Report" button that exports all errors as CSV
- Each error row shows: row number, vehicle code, and error message

After closing the modal, redirect to the relevant list:
- Charges import → `/charges`
- Vehicles import → `/vehicles`

---

## 6. Export Feature

**Use Cases:** Reports, sharing with accountants, backup, import to other systems

**Export Filters:**
1. **By year** — export vehicles/charges from a specific year
2. **By vehicle codes** — upload a file with codes (T535, C320, etc.) → app shows matching vehicles
3. **Combination** — upload codes + manually add/remove vehicles from selection

**Export Flow:**
1. User selects filter (year, codes, or both)
2. App shows matching vehicles
3. User can add/remove vehicles from selection
4. User selects which columns to include
5. App exports selected vehicles with selected columns

**Available Columns for Selection:**

**Vehicle Info:**
- Code
- Registration plate
- Vehicle type
- Brand
- Fuel type
- Purchase date
- Category
- Status (active/sold)

**Charge Info:**
- Charge type
- Amount paid
- Payment date

**Other:**
- Notes/comments
- Year

**Supported Export Formats:**
- CSV
- Excel (XLSX)
- PDF (for reports)

---

## 7. Dashboard

Simple KPI cards showing:

- **Total charges** across all vehicles
- **Total vehicle count**
- **Annual total charges** (e.g., 2026: 1.2M MAD)
- **Monthly average** = Annual total ÷ 12 (e.g., 100K MAD/month)

**Out of scope:**
- Charts/graphs
- Trend analysis
- Alerts/reminders for upcoming due dates
- Overdue notifications

---

## 8. Users & Access Control

**Current:** Single user (you) with full admin access

**Future-ready:**
- Login system (username/password via Supabase Auth)
- User management CRUD built-in
- Role-based access ready to add later (admin vs. view-only)

---

## 9. Tech Stack (All Free Tiers)

| Layer | Technology | Reason |
|-------|------------|--------|
| **Frontend** | React + Vite | Modern, fast, free deployment |
| **Backend + Database** | Supabase (PostgreSQL) | Free tier: 500MB DB, 2GB bandwidth, auth included, no server management |
| **Auth** | Supabase Auth | Built-in, email/password, ready for multi-user |
| **Hosting** | Vercel or Netlify | Free tier, auto-deploy from GitHub |

**Cost:** $0/month forever on free tiers

---

## 10. Out of Scope (Not in MVP)

- Alerts/notifications for upcoming due dates
- Payment tracking (handled in AS-TECH externally)
- JSON import/export
- Multi-tenant access
- Driver management
- Geolocation/GPS tracking
- Maintenance history beyond fixed charges
- Mobile app
- Email reminders
- Advanced analytics/reporting

---

## 11. Questions & Answers Reference

### Q1: What is a "charge"?
**A:** Fixed periodic regulatory expenses paid per vehicle (technical inspection, transport tax, axle tax, tachograph, insurance).

### Q2: Are charges per vehicle or fleet-wide?
**A:** Per vehicle.

### Q3: Do charges have the same due dates for all vehicles?
**A:** Mixed — transport tax, axle tax, and insurance have fixed annual dates (Jan 1–Dec 31). Technical inspection and tachograph have variable dates per vehicle.

### Q4: How are vehicles identified?
**A:** Primary: vehicle code (T535, C320, etc.). Secondary: registration plate.

### Q5: How many vehicles?
**A:** 50-200+

### Q6: What other vehicle info matters?
**A:** Type, brand, fuel type, purchase date, category (body type/config), status (active/sold).

### Q7: What are categories?
**A:** Vehicle body type/configuration like "camion benne 8x4", "plateau 12M", "porte char".

### Q8: What charges do you track?
**A:** Visite technique, taxe transport, taxe à l'essieu, chrono tachygraphe, assurance.

### Q9: What needs CRUD?
**A:** Vehicles, charges, categories, users.

### Q10: What's the main use case for export?
**A:** All of the above — reports, sharing with accountants, backup, import to other systems.

### Q11: Which columns for export?
**A:** Vehicle info (code, plate, type, brand, fuel, purchase date, category, status) + Charge info (type, amount, payment date) + Year, notes.

### Q12: How does "upload vehicle codes" export work?
**A:** Upload file → app shows matching vehicles → user can add/remove → user selects columns → export.

### Q13: Import/export file formats?
**A:** Import: CSV, Excel. Export: CSV, Excel, PDF.

### Q14: What happens if imported vehicle code already exists?
**A:** Update the existing record + show summary report after import.

### Q15: Who uses the app?
**A:** Single user (you) now, but built with user management ready to scale.

### Q16: Do you need dashboards?
**A:** Yes — total charges, total vehicles, annual total, monthly average (annual/12).

### Q17: Alerts for due dates?
**A:** No — manual checks or exports only.

### Q18: Tech stack preference?
**A:** Your choice, must be free with no additional costs → React + Supabase + Vercel.

### Q19: What data to import?
**A:** Vehicle data only (not charge records). Charges are entered individually as they occur.

### Q20: How to track charge payments?
**A:** Don't track payments in this app. Only track amounts. Payments managed externally in AS-TECH.

---

## 12. Next Steps

1. Design database schema (vehicles, charges, categories, users tables)
2. Set up Supabase project
3. Build React app structure (pages, components)
4. Implement CRUD operations
5. Build import/export features
6. Create dashboard
7. Deploy to Vercel

---

**End of Requirements Document**
