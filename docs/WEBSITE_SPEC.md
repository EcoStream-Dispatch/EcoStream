# EcoStream Website Spec (public site + Owner / Driver / Shipper portals)

Version 0.1 - 21 Nov 2026. Source of truth for every page of the web app. Brand: `docs/BRAND.md`. Plans and parameter keys: `docs/PLANS_SPEC.md`.

## 1. Brief, brand and public website

Build a responsive web application (desktop 1440 px first, also tablet 768 px and mobile 375 px) called EcoStream - predictive maintenance and smart dispatch for Indian trucks, starting with tyres. Tagline: PREDICT · PROTECT · PERFORM. Use the uploaded logo.

### Users and the feeling we want
- **Truck owners / fleet managers** (1-200 trucks, Tamil Nadu first): "I can see every truck's health, every shipment and every risk on one screen, and I know exactly what to do."
- **Drivers:** "Someone has my back - one tap gets me help, in my language."
- **Shippers / customers** (businesses sending goods): "I can see where my goods are, when they will arrive, and that the truck is healthy."
- **Business goal:** an owner understands a problem and acts on it (books a garage) in under 10 seconds. It must look trustworthy enough to show investors.

### Brand (follow exactly)
- Colours: navy #0B1E36 (headings, sidebar, dark surfaces), green #3E7231 (primary buttons), green #5C9A35 (OK, accents), light green #8CC152 (highlights), soft green #F4F9F1 (section backgrounds), white #FFFFFF (page). Status: OK #5C9A35, Warning #E0A100, Critical #C62828, Offline grey #9AA5B1.
- Fonts: Montserrat (headings, uppercase brand name) + Inter (body, tables).
- Look: clean, white, navy text, green accents like the logo; high contrast; simple line icons; no neon, no heavy gradients, no stock photos of people.
- Language switch in the header: English / தமிழ் / हिंदी.
- Units: pressure psi and bar, temperature °C, distance km, money ₹.
- Never show status by colour alone - always icon + word (OK / Warning / Critical / Offline).

### Public website pages
1. **Home** - hero with logo and the line "Know a tyre or engine problem before it stops your truck - and reach a verified garage, even at 2 a.m."; buttons "Login" and "Book a demo"; five pillars from the logo (Real-Time Tracking, Fuel Efficiency, Predictive Maintenance, Safety Assurance, Smart Insights); "How it works" (Sensor → Cloud → Alert → Garage); sections for Owners, Drivers, Shippers; "Works on any truck brand, any age"; footer.
2. **Plans & pricing** - Lite (list ₹399, founding-member ₹299/truck/month), Pro (₹499), Fleet (₹899), comparison table of what each plan monitors, add-ons (fuel monitoring, cold chain, cargo security, wheel-hub temperature, driver safety, breakdown assistance), "Annual prepaid -10%".
3. **For garages** - join our verified 24x7 garage network (benefits, verification steps, sign-up form).
4. **About / Contact** - mission, contact form, Chennai address placeholder.
5. **Login** - one login page with a role selector: Owner / Fleet manager, Driver, Shipper. Phone number + OTP (email + password as an option). "New owner? Book a demo." Each role lands on its own portal.

## 2. Owner / fleet-manager portal (left sidebar layout)
Sidebar: Dashboard · Live Map · Trucks · Predictive Maintenance · Alerts · Shipments · Drivers · Garages · Reports · Plan & Billing · Settings. Top bar: search (truck number, shipment ID), language switch, notifications bell, profile.

1. **Dashboard** - KPI cards: trucks OK / Warning / Critical / Offline, active shipments, alerts today, breakdowns avoided this month, estimated ₹ saved this month; map of all trucks coloured by status; "Needs attention now" list (e.g. "TN 99 ZZ 0001 - rear-left outer tyre leaking - unsafe in ~3 h - Book garage"); upcoming maintenance (next 7 days); shipments in transit with ETA.
2. **Live Map** - all trucks on a map with status pins; filters (status, plan, shipment); side panel for the selected truck; layers: verified garages, mapped dead zones (no signal), ghat stretches, bad-road stretches.
3. **Trucks list** - table: registration, make/model, plan badge (Lite/Pro/Fleet), driver, current shipment, health status, last seen, next service; filters and export.
4. **Truck detail** - header (registration, model, plan, driver, live status, last seen). Tabs:
   - Overview: live location mini-map, current trip (sender → receiver, ETA), health summary per system (Tyres, Engine, Brakes, Power, Cargo) with status, active alerts.
   - Tyres: top-view axle diagram (6 / 10 / 12 / 14 / 18-wheel layouts), each tyre coloured by status showing pressure, corrected pressure, temperature, leak rate, tread depth, sensor battery; 24-hour chart; tyre history (fitted date, km run, retreads, cost per km).
   - Engine, Brakes & Chassis, Power & Device, Driver, Cargo: cards with live values, mini-trend sparklines and normal ranges for the parameters in the list below. Cards the truck's plan does not include are shown locked (grey, lock icon, "Available in Pro - Upgrade").
   - Predictions: per component risk (Low / Medium / High), predicted issue, "time to unsafe" or "service due in X days / km", confidence, recommended action, "Book garage" button.
   - Maintenance & documents: service history, garage jobs, upcoming services, compliance reminders (permit, fitness certificate, PUC, insurance, road tax) with due dates.
5. **Predictive Maintenance** - fleet-wide risk ranking table (truck, component, predicted issue, risk, time window, estimated cost if ignored vs cost to fix now, action); filters by component; a "this week" plan.
6. **Alerts** - alert centre with tabs Open / Acknowledged / Resolved; each alert: severity, truck, parameter, plain-language message, time, location; alert detail with countdown ("unsafe in ~3 h"), what to do, 3 nearest open verified garages (distance, open 24x7 or open-till, price estimate, rating, Call, Book slot), "Share with driver", "Mark resolved".
7. **Shipments (dispatch)** - list (ID, sender, receiver, goods type, truck, driver, status: Scheduled / Loading / In transit / Delivered / Delayed, ETA); Create shipment form: sender (name, address, contact), receiver (name, address, contact), goods type and weight, pickup date/time, suggested truck + driver (based on availability, truck type for the goods, and truck health), assign, notify shipper.
8. **Shipment / live routing** - big route map from sender to receiver: truck's live position, planned route, ETA, distance left, stops; warnings on the route (ghat ahead, dead zone ahead, bad road, last verified garage before the ghat); timeline of events (picked up, crossed checkpoint, alert raised, delivered); proof of delivery; share tracking link with the shipper.
9. **Drivers** - list with photo placeholder, phone, licence expiry, rating (0-100 from driving data), availability (On trip / Available / Off), assigned truck; driver profile with trip history and score trends.
10. **Garages** - verified garage network map and list (24x7 badge, services: tyre / air-brake / engine, rating, distance); my bookings.
11. **Reports** - monthly savings, tyre cost per km by brand, fuel efficiency, idle time, alerts acted on, breakdowns avoided; download PDF.
12. **Plan & Billing** - current plan per truck, add-ons, upgrade/downgrade, invoices (placeholder, "no payments in demo").
13. **Settings** - users and roles (owner, manager, viewer), alert thresholds, notification channels (WhatsApp, SMS, email), language.

## 3. Driver portal (mobile-first, works on a cheap Android phone, large buttons)
1. **My trip** - sender and receiver (name, address, call buttons), goods, pickup and delivery times, route map with next turn and ETA, "Start trip" / "Reached" buttons.
2. **Truck health cockpit** - big tyre diagram with colours, simple icons for engine / brakes / battery, any active alert at the top.
3. **Alert screen** - full screen, one icon, one sentence in Tamil + English, big "Play voice" button, "Navigate to garage", "Call owner"; dark navy version for night.
4. **SOS** - one big red emergency button that alerts the owner and emergency contacts with location.
5. **Trip history and my rating** - past trips, driver score with simple tips ("smoother braking saves tyres").

## 4. Shipper portal
1. **My shipments** - list with status and ETA; "Request a shipment" (pickup, drop, goods type, weight, date).
2. **Shipment tracking** - live map of the truck, ETA, distance left, timeline, driver and truck details with contact button, vehicle health indicator ("Truck condition: Good"), temperature for cold-chain loads.
3. **Delivery & invoices** - proof of delivery (photo + signature placeholder), invoice download, history.

Optional: EcoStream team console - customers, devices (online/offline), garage verification queue, support tickets.

## Parameters to display
Group them in cards exactly like this; [Plan] shows which plan unlocks it.

- **Tyres:** Tyre pressure (each wheel) (psi + bar) [Lite+]; Tyre air temperature (each wheel) (°C) [Lite+]; Temperature-corrected pressure (psi at 20 °C) [Lite+]; Leak rate (trend) (psi/hour + "unsafe in ~X h") [Lite+]; Sensor battery / signal health (battery % + signal) [Lite+]; Tyre tread depth (mm per tyre) [Lite+]
- **Location & Context:** GPS position, speed, heading (map pin, km/h, heading) [Lite+]; Altitude / road gradient (% + altitude m) [Pro+]; Cellular signal strength (RSSI) + network (bars / dBm) [Lite+]; Ambient temperature (°C) [Lite+]; Acceleration (3-axis) - harsh brake, pothole, crash (count of harsh brakes / impacts) [Lite+]; Road roughness / pothole map (bad-road stretches on map) [Pro+]
- **Power:** Truck battery voltage (24 V) (V) [Lite+]; Ignition on/off (on/off) [Lite+]; Battery health (cranking voltage dip) (lowest start voltage) [Lite+]
- **Device:** Device tamper / power-cut / GNSS jamming (events) [Lite+]
- **Engine (from truck CAN bus):** Active & stored fault codes (DTCs) (code + plain Tamil/English meaning + action) [Pro+]; Coolant temperature (°C) [Pro+]; Coolant level (OK / low) [Pro+]; Engine oil pressure (kPa) [Pro+]; Engine oil temperature (°C) [Pro+]; Engine speed (rpm) [Pro+]; Engine load % and accelerator position (%) [Pro+]; Intake air temp + boost pressure (°C, kPa) [Pro+]; Exhaust gas temperature (°C) [Pro+]; Fuel rate (L/h, km/L) [Pro+]; Fuel level (%) [Pro+]; DEF/AdBlue level (%) [Pro+]; DPF differential pressure / soot load (%) [Pro+]; Engine hours + odometer (h, km) [Pro+]; Wheel-based vehicle speed (km/h) [Pro+]; Idle time (min/day) [Pro+]; Transmission oil temperature (°C) [Pro+]; Clutch slip (%) [Pro+]; Water-in-fuel indicator (yes/no) [Pro+]; Air filter restriction (kPa / OK-change) [Pro+]; Engine oil life estimate (% remaining) [Pro+]
- **Brakes & Chassis:** Air-brake tank pressure (bar) [Pro+]; Wheel-end / hub temperature (°C per wheel) [Add-on: Wheel-end temperature]; Vibration signature (driveline / bearings) (normal / rising) [Pro+]; Brake air leak rate (bar/min) [Pro+]
- **Driver:** Driver ID (driver name) [Add-on: Driver safety]; Dashcam / driver fatigue camera (drowsiness events) [Add-on: Driver safety]; Driver behaviour score (0-100) [Pro+]; Emergency (panic) button (SOS events) [Add-on: AIS-140 kit]
- **Fuel (add-on):** Fuel level (accurate probe) (litres) [Add-on: Fuel monitoring]
- **Cargo:** Cargo temperature & humidity (reefers) (°C, %RH) [Add-on: Cold chain]; Door open/close (open/closed) [Add-on: Cargo security]; Cargo lock / seal status (intact/broken) [Add-on: Cargo security]; Payload estimate (no load cells) (t estimate) [Fleet]

## Sample data rules
Use realistic but clearly fictional data: trucks TN 99 ZZ 0001-0006 (Tata Signa 4825.T, Ashok Leyland 3520, BharatBenz 2823R, Eicher Pro 6028), drivers with common Tamil names, the Chennai-Krishnagiri-Salem-Namakkal corridor, garages named "Sample Tyre Works 1-3". No fake customer logos, testimonials, ratings of real companies or made-up market statistics.

## Navigation flows that must work
- Home → Login (choose role) → that role's portal
- Owner: Dashboard → Truck detail → Alert → Garage booked
- Shipments → Create shipment → Live routing
- Locked card → Plan & Billing
