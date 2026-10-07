# SafeScan — QR Emergency Identification System for Senior Citizens

**SafeScan** is a full-stack Community Service Project (CSP) web application designed to protect senior citizens through wearable, privacy-preserving QR emergency identification cards. When an elderly person experiences a medical emergency, memory disorientation, or fall in public, any bystander or first responder can scan their SafeScan QR code to immediately access life-saving medical details and dial family emergency contacts.

---

## 🌟 Key Features

### 1. Universal QR Code Generation (Works on Any Phone & Offline)
- **Universal Phone Scan Mode (Default):** Encodes the senior's complete emergency medical card (SafeScan ID, Full Name, Age, Blood Group, Primary & Backup Emergency Contacts, Allergies, Medical Conditions, Medications, and Helpline `112`) directly into the QR payload so any smartphone camera displays the life-saving details immediately without requiring login.
- **Web App Link Mode:** Encodes the direct web link (`/#/emergency/:id`) to open the interactive Emergency Medical Profile page.
- **Printable Dual-Sided ID Cards:** Generates standard wallet/lanyard-sized front-and-back emergency badges ready for printing or saving as high-resolution PNGs.

### 2. Multi-Method QR Code Scanner (`/scan`)
- **Live Camera Scanner:** Uses the device's rear or front camera (`html5-qrcode`) to scan SafeScan badges in real time.
- **Select QR Image from Media:** Allows uploading a saved QR code image or screenshot directly from device media files.
- **Manual SafeScan ID Lookup:** Supports entering a unique SafeScan ID (e.g., `SAFE-XXXXXX`) directly.

### 3. Senior Profile Registration with Media Upload (`/seniors/new`)
- **Device Media & Camera Upload:** Upload senior profile photos directly from device gallery/media files (`JPG`, `PNG`, `WEBP`), capture photos with the camera, or link an external image URL with automatic client-side image optimization.
- **Comprehensive Medical & Care Data:** Records blood group, severe allergies, chronic conditions, regular medications, mobility/communication notes, treating doctor details, and first-responder instructions.
- **Granular Privacy Controls:** Caregivers choose exactly which fields (photo, age, blood group, allergies, conditions, hospital, residential address) are visible on the public emergency profile.

### 4. Public Emergency Medical Profile (`/emergency/:id`)
- **Zero-Login Emergency Access:** Immediately accessible to first responders and bystanders when a QR code is scanned.
- **1-Tap Emergency Calling:** Prominent action buttons to call the primary family caregiver or National Emergency Services (`112`).
- **Nearby Emergency Hospitals:** Finds operational 24/7 trauma centers and emergency rooms near the senior's location with direct Google Maps navigation links.
- **First-Aid & Triage Guidance:** Generates tailored bystander first-aid instructions and allergy warnings based on the senior's medical profile.
- **Bystander Incident Reporting with GPS:** Allows good Samaritans to submit an incident alert with optional browser GPS coordinates so caregivers and administrators can see where the senior was assisted.

### 5. Role-Based Access Control (`/auth`, `/dashboard`, `/admin`)
- **Google Authentication & Instant Demo Roles:** Supports Firebase Google Sign-In alongside 1-click role testing for **Caregiver**, **Senior Citizen**, and **Administrator** accounts.
- **Caregiver Dashboard:** Manage registered seniors, toggle QR status (`Active` / `Deactivated` if a badge is lost), print ID cards, and review bystander incident reports.
- **Administrator Console:** System-wide registry oversight, QR status management, and emergency incident log auditing.
- **Senior-Friendly Accessibility:** Includes a global **A+ Large Text** toggle in the navigation bar for elderly readability.

---

## 🛠️ Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Vite
- **QR Code Engine:** `qrcode` (high-res generation) & `html5-qrcode` (camera & image file scanning)
- **Backend Server:** Node.js, Express (`server.ts`)
- **Database & Authentication:** Firebase Authentication (Google Sign-In) & Cloud Firestore (`users`, `senior_profiles`, `emergency_reports`, `admins`)

---

## 📂 Project Structure

```text
├── firebase-applet-config.json   # Firebase project & Firestore database configuration
├── firebase-blueprint.json       # Data model schema & Firestore collection definitions
├── firestore.rules               # Cloud Firestore security rules
├── server.ts                     # Express full-stack server & API routes
├── src/
│   ├── App.tsx                   # Application router & layout shell
│   ├── components/
│   │   ├── EmergencyCard.tsx     # Printable dual-sided senior emergency ID card
│   │   ├── Footer.tsx            # Application footer & emergency helpline links
│   │   ├── Navbar.tsx            # Responsive navigation, role switcher & A+ font toggle
│   │   └── QRDisplayModal.tsx    # QR modal with Universal Phone / Web Link switcher
│   ├── context/
│   │   └── AuthContext.tsx       # Firebase Google Auth & role management context
│   ├── firebase/
│   │   └── config.ts             # Firebase SDK initialization & error handler
│   ├── pages/
│   │   ├── AboutCSPPage.tsx      # Community Service Project documentation page
│   │   ├── AdminDashboardPage.tsx# Master registry & incident audit console
│   │   ├── AuthPage.tsx          # Google Sign-In & 1-click demo role portal
│   │   ├── DashboardPage.tsx     # Caregiver & Senior profile management hub
│   │   ├── EmergencyProfilePage.tsx # Public zero-login emergency responder view
│   │   ├── HomePage.tsx          # Landing page & quick emergency access
│   │   ├── QRScannerPage.tsx     # Camera, media image & manual ID scanner
│   │   └── SeniorFormPage.tsx    # Senior profile registration & media photo uploader
│   ├── services/
│   │   └── seniorService.ts      # Firestore CRUD operations & local caching
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   └── utils/
│       └── qrUtils.ts            # QR code generation & universal payload formatting
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A configured Firebase project (`firebase-applet-config.json`)

### Installation & Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and set your environment variables if needed:
   ```bash
   cp .env.example .env
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application runs on `http://localhost:3000`.

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🔒 Security & Privacy Notes

- **Public Emergency Read vs. Protected Management:** Senior profiles can be looked up by responders in an emergency, while profile creation, status toggling, and account data are protected via Firestore security rules (`firestore.rules`).
- **Lost Badge Deactivation:** Caregivers and administrators can immediately deactivate a senior's QR code from the dashboard if a physical card or wristband is lost.
- **Address Privacy:** Residential addresses are hidden from public QR scans by default unless explicitly enabled by the caregiver.
