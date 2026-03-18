# University Transport Management System - React + TailwindCSS

## Project Overview

A complete multi-page React application with TailwindCSS styling for a university transport management system. The application features professional logistics-inspired design with 6 main pages and reusable component architecture.

---

## Project Structure

```
project/
├── index.html                    # HTML entry point
├── vite.config.js               # Vite configuration for React
├── tailwind.config.js           # TailwindCSS configuration
├── postcss.config.js            # PostCSS configuration for Tailwind
├── package.json                 # Dependencies and scripts
│
└── src/
    ├── main.jsx                 # React entry point
    ├── App.jsx                  # Main app component with routing
    ├── index.css                # Global styles (Tailwind imports)
    │
    ├── components/
    │   ├── Navbar.jsx          # Navigation bar (all pages)
    │   └── Footer.jsx          # Footer component (all pages)
    │
    └── pages/
        ├── Dashboard.jsx       # Home page with overview cards
        ├── SelectRoute.jsx     # Booking page with bus search
        ├── LiveTracking.jsx    # Real-time bus tracking
        ├── Routes.jsx          # All available routes
        ├── Support.jsx         # Support & FAQ page
        └── Complaints.jsx      # Complaint filing page
```

---

## Pages Description

### 1. Dashboard Page (`/`)
- **Features:**
  - User welcome banner with profile info
  - Active bookings card
  - Next bus arrival card
  - Travel summary statistics
  - Quick action buttons to Book Ride and View Routes
- **Components:** Profile display, status cards, CTAs
- **Data:** User info, upcoming buses, ride statistics

### 2. Select Route / Book Ride Page (`/select-route`)
- **Features:**
  - Dropdown selectors for pickup and destination
  - Mock bus results grid
  - Bus cards showing number, ETA, capacity, type
  - Bus selection functionality
- **Components:** Form inputs, result cards, buttons
- **Data:** Locations list, available buses

### 3. Live Tracking Page (`/live-tracking`)
- **Features:**
  - Real-time map placeholder (integration-ready)
  - Active buses sidebar with status indicators
  - Selected bus route timeline
  - Bus information display
  - Location-based filtering
- **Components:** Map container, bus list, route timeline
- **Data:** Active buses, routes, locations

### 4. Routes Page (`/routes`)
- **Features:**
  - Expandable route cards
  - Route timeline with stops
  - Departure schedule grid
  - Distance and duration info
  - Multiple bus availability
- **Components:** Route accordion, stop timeline, schedule grid
- **Data:** 3 sample routes with stops and schedules

### 5. Support & Help Page (`/support`)
- **Features:**
  - 3 support contact cards (phone, email, chat)
  - Contact form (name, email, subject, message)
  - 6 FAQ items
  - Success message on submission
- **Components:** Contact form, FAQ accordion, contact cards
- **Data:** Support channels, FAQ items

### 6. Complaints Page (`/complaints`)
- **Features:**
  - Detailed complaint form
  - Category dropdown
  - Bus number and date fields
  - Title and description inputs
  - Success notification with reference ID
  - Statistics cards (24/7, 48h response, 100% confidential)
- **Components:** Multi-field form, success alert, info cards
- **Data:** Categories, form submission

---

## Components

### Navbar Component
- **Location:** `src/components/Navbar.jsx`
- **Features:**
  - Fixed navigation with sticky positioning
  - Logo with icon
  - Navigation links (Dashboard, Book Ride, Live Tracking, Routes, Support, Complaints)
  - Active route highlighting
  - Profile avatar with gradient
  - Mobile menu toggle
  - Responsive design

### Footer Component
- **Location:** `src/components/Footer.jsx`
- **Features:**
  - 3-column layout (Company info, Contact, Hours)
  - Social media links
  - Company description
  - Contact details
  - Office hours
  - Dark theme with yellow highlights

---

## Design System

### Colors
```javascript
--primary: #FACC15 (Yellow)
--dark: #111827 (Black)
--slate: #E5E7EB (Light Gray)
--white: #FFFFFF (White)
--gray-800: #1F2937
--gray-100: #F3F4F6
--gray-600: #4B5563
```

### Typography
- Font Family: Inter, system UI stack
- Heading Sizes: 2xl, 3xl, 4xl
- Font Weights: 400 (normal), 500, 600 (semibold), 700 (bold), 800 (extra-bold)

### Spacing System
- Base unit: 4px (Tailwind standard)
- Common values: px-4, px-6, px-8, py-3, py-6, py-8, py-12
- Gap sizes: gap-2, gap-4, gap-6, gap-8

### Border Radius
- Small: rounded-lg (0.5rem)
- Medium: rounded-xl (0.75rem)
- Full circle: rounded-full

### Shadows
- Default: shadow-md
- Hover: shadow-lg
- Transitions: 0.3s ease

---

## Routing Structure

```
/                    → Dashboard
/select-route        → Book Ride
/live-tracking       → Live Tracking
/routes              → Routes
/support             → Support & Help
/complaints          → File Complaint
```

---

## Technologies Used

- **React 18.2.0** - UI framework
- **React Router DOM 6.20.0** - Client-side routing
- **TailwindCSS 3.3.0** - Utility-first CSS framework
- **Vite 5.4.2** - Fast build tool and dev server
- **PostCSS 8.4.31** - CSS transformations
- **Autoprefixer 10.4.16** - Browser compatibility

---

## Key Features

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Hamburger menu on mobile
- Flexible grids

### Interactive Elements
- Form inputs with Tailwind styling
- Expandable accordions (Routes page)
- Dropdown selectors
- Status badges
- Loading states
- Success notifications

### Professional UI Patterns
- Card layouts with borders and shadows
- Timeline visualizations
- Badge indicators (status, categories)
- Information rows with labels and values
- Hero sections with gradients
- Grid layouts for data display

### Accessibility
- Semantic HTML
- Form labels
- Focus states
- Color contrast compliance
- Clear visual hierarchy

---

## Installation & Development

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

---

## Customization Guide

### Adding a New Page
1. Create `src/pages/NewPage.jsx`
2. Import in `src/App.jsx`
3. Add route in the Routes component
4. Add navigation link in `Navbar.jsx`

### Modifying Styles
- Edit `tailwind.config.js` to customize colors, fonts, or spacing
- Use Tailwind utility classes in JSX
- Add custom CSS in `src/index.css` if needed

### Updating Colors
Edit `tailwind.config.js` theme.extend.colors:
```javascript
colors: {
  primary: '#FACC15',
  dark: '#111827',
  // Add more colors
}
```

---

## Integration Points

### Database Integration (Supabase)
Ready for integration:
- User authentication on Dashboard
- Booking history in Dashboard
- Live bus data in LiveTracking
- Route information in Routes page
- Complaint submissions
- Support ticket tracking

### API Integration
All pages have mock data ready for API replacement:
- SelectRoute: Replace mock buses with API call
- LiveTracking: Integrate real GPS data
- Routes: Fetch from schedule database
- Support: Send form data to backend
- Complaints: Store complaints in database

### Authentication
Dashboard and booking features ready for:
- User login integration
- Role-based access control
- Profile data from auth provider

---

## Future Enhancements

1. **Map Integration** - Replace map placeholder with Google Maps/Leaflet
2. **Real-time Updates** - WebSocket for live bus tracking
3. **Payment Integration** - Add Stripe/payment gateway
4. **Notifications** - Email/SMS alerts for buses
5. **Admin Dashboard** - Route management, bus tracking
6. **Booking History** - Past and future bookings list
7. **Rating & Reviews** - User feedback system
8. **Mobile App** - React Native version

---

## Production Checklist

- [ ] Connect to Supabase database
- [ ] Implement authentication
- [ ] Add real API endpoints
- [ ] Integrate payment system
- [ ] Set up real-time tracking
- [ ] Deploy to production (Vercel, Netlify)
- [ ] Configure domain and SSL
- [ ] Set up analytics
- [ ] Enable error tracking (Sentry)
- [ ] Configure email notifications

---

## Performance Optimization

- Lazy loading of pages with React.lazy()
- Image optimization for production
- Code splitting at route level
- Minified CSS and JavaScript
- Gzip compression enabled
- Browser caching configured

---

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## License

University Transport Management System - 2024
