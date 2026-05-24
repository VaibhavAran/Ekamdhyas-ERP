<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# PESCE Attendance Portal

A student attendance portal built with React, Vite, Tailwind CSS, and Firebase.

This project includes a student login page, dashboard UI, attendance data handling, and Firebase integration.

## Local Setup

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create a `.env` file in the project root and add Firebase configuration values using `VITE_FIREBASE_*` keys.
3. Run the app:
   `npm run dev`

## Firebase Environment Variables

Add the following values to `.env`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Available Scripts

- `npm run dev` - start development server
- `npm run build` - build production bundle
- `npm run preview` - preview production build locally
- `npm run lint` - verify TypeScript types

## Project Structure

- `src/` - source code
- `src/pages/LoginPage.tsx` - login page UI
- `src/firebase.ts` - Firebase initialization
- `src/lib/firebaseService.ts` - Firestore helper functions
- `src/data/mockData.ts` - sample data and user helpers

## Notes

This README replaces the earlier AI Studio template text with content for your student portal app. The app runs as a normal Vite + React project.

