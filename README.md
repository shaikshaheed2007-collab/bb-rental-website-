# BB Rentals

BB Rentals is a React + Vite car-rental application with customer and rental-business modules. The current version stores accounts, storefronts, vehicles, and reservations in the current browser's `localStorage`.

## Modules

### User module
- Customer signup and login
- Browse rental businesses and their available vehicles
- View vehicle details and reserve dates
- View booking history and payment status

### Admin module
- Business signup and login
- Create a public storefront with 20 starter vehicles
- Manage vehicle availability and daily rates
- Review reservations, record pay-at-pickup collections, and export CSV reports

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.
4. Open the Vite URL shown in the terminal (usually `http://localhost:5173/`).

Use the Vite URL, not VS Code Live Server or a `file://` URL. Login, signup, business setup, and bookings work without a database connection.

The rental directory is initialized with BB Rentals and four sample businesses, each with eight example vehicles. The listings are created only when missing, so existing businesses, users, and bookings are preserved. Sample listings are for exploring the app, not real rental offers.

## Data storage limits

- Data stays in the browser profile and device where it was entered. It does not sync to another browser or device.
- Clearing site data or using private browsing can remove or isolate the saved records.
- Browser `localStorage` is for demos and local projects; it is not appropriate for real customer data or production authentication.
- Vercel can host the frontend, but deploying it does not make browser records shared or backed up. A shared production service needs a configured backend and database.
- Payments are recorded manually at pick-up; this app does not process online payments.

## Deploy to Vercel

1. Push the project to GitHub and import it into Vercel, or deploy with the Vercel CLI.
2. Use the Vite defaults: build command `npm run build`, output directory `dist`.
3. `vercel.json` rewrites routes to `index.html` for React Router.
4. Open the deployed URL and test signup, business setup, and booking in that browser.

Accounts and records on the deployed website are separate from local development and from other visitors' browser profiles.

## Build

```bash
npm run build
```
