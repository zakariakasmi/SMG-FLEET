# SMG Fleet Management System

A comprehensive web application for managing commercial vehicle fleets and tracking regulatory charges.

## Features

- **Vehicle Management** - Full CRUD operations for managing 50-200+ vehicles
- **Charge Tracking** - Track 5 types of regulatory charges per vehicle
- **Bulk Import** - Import vehicle data from CSV/Excel files with validation
- **Flexible Export** - Export data by year, vehicle codes, with customizable columns
- **Dashboard** - KPI cards showing fleet metrics and financial overview
- **Categories Management** - Organize vehicles by body type/configuration
- **Authentication** - Secure login system with session management

## Tech Stack

- **Frontend:** React 18 + Vite
- **UI:** Tailwind CSS + Custom Components
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Forms:** React Hook Form + Zod
- **File Processing:** PapaParse (CSV) + XLSX (Excel)
- **Hosting:** Vercel (Free Tier)

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier)
- Git

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SMG-FLEET
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Run the SQL schema from `supabase/schema.sql` in the Supabase SQL Editor

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project on [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

Vercel will automatically:
- Build your project on push
- Provide HTTPS
- Deploy to a CDN
- Enable preview deployments

## Project Structure

```
SMG-FLEET/
├── src/
│   ├── components/
│   │   ├── layout/          # Header, Sidebar, Layout
│   │   └── ui/              # Reusable UI components
│   ├── context/             # React Context (Auth, Toast)
│   ├── pages/               # Route components
│   │   ├── vehicles/        # Vehicle CRUD
│   │   ├── charges/         # Charge CRUD
│   │   ├── categories/      # Categories CRUD
│   │   ├── import/          # Bulk import
│   │   ├── export/          # Flexible export
│   │   ├── Dashboard.jsx    # Dashboard KPIs
│   │   └── Login.jsx        # Authentication
│   ├── services/            # API services
│   │   ├── supabase.js      # Supabase client
│   │   └── api.js           # API functions
│   ├── utils/               # Utilities
│   │   ├── formatters.js    # Number/date formatting
│   │   ├── validators.js    # Form validation
│   │   └── parsers.js       # CSV/Excel parsing
│   ├── constants/           # App constants
│   ├── App.jsx              # Root component
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── supabase/
│   └── schema.sql           # Database schema
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## Usage

### First Login

Use the demo credentials:
- Email: `demo@smg-fleet.ma`
- Password: `demo123456`

### Adding Vehicles

1. Navigate to **Vehicles** → **Add Vehicle**
2. Fill in vehicle information
3. Click **Add Vehicle**

### Importing Vehicles

1. Navigate to **Import**
2. Download the template CSV
3. Fill in your vehicle data
4. Upload the file
5. Preview and confirm import

### Adding Charges

1. Navigate to a vehicle detail page
2. Click **Add Charge**
3. Select charge type and enter amount
4. Click **Add Charge**

### Exporting Data

1. Navigate to **Export**
2. Filter by year or vehicle codes
3. Select vehicles and columns
4. Choose format (CSV/Excel/PDF)
5. Click **Export**

## Database Schema

### Tables

- `vehicles` - Vehicle information
- `charges` - Charge records per vehicle
- `vehicle_categories` - Vehicle categories
- `charge_types` - Reference table for charge types
- `import_logs` - Import history

### Key Features

- Row-level security (RLS) enabled
- Automatic timestamps (created_at, updated_at)
- Foreign key constraints
- Indexes on frequently queried columns

## Charge Types

1. **Visite technique** - Technical inspection (12 months for trucks, 6 months for minibus)
2. **Taxe transport** - Transport tax (annual, fixed date)
3. **Taxe à l'essieu** - Axle tax (annual, fixed date)
4. **Chrono tachygraphe** - Tachograph (24 months)
5. **Assurance** - Insurance (annual, variable amount)

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style

- Use functional components with hooks
- Follow React best practices
- Use Tailwind utility classes
- Keep components small and focused
- Validate all user inputs

## Troubleshooting

### Build Errors

If you encounter build errors:
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Clear Vite cache: `npm run build -- --force`

### Supabase Connection Issues

- Verify your environment variables
- Check Supabase project status
- Ensure RLS policies are set up correctly
- Check browser console for errors

### Import Fails

- Ensure CSV/Excel headers match template
- Check date format (YYYY-MM-DD)
- Verify vehicle codes are unique
- Check file encoding (UTF-8)

## Free Tier Limits

### Supabase
- 500 MB database storage
- 2 GB bandwidth/month
- 50,000 monthly active users

### Vercel
- 100 GB bandwidth/month
- Unlimited websites
- Automatic HTTPS

**Estimated Usage:**
- 200 vehicles + 2000 charges = ~5 MB
- Monthly bandwidth < 500 MB
- Well within free tier limits

## Future Enhancements

- [ ] Due date reminders
- [ ] Advanced dashboard with charts
- [ ] Email notifications
- [ ] Multi-user role-based access
- [ ] Mobile app
- [ ] Integration with AS-TECH
- [ ] Document attachments
- [ ] Maintenance history

## License

MIT License - feel free to use for your own fleet management needs.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the PRD.md for detailed requirements
3. Check Supabase logs for backend errors

---

**Built with ❤️ for SMG Fleet Management**

Version: 1.0.0 (MVP)  
Last Updated: September 1, 2026