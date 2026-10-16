# Dhara Dairy Cloud

## User Guide

**A practical guide to the dairy collection dashboard**  
**Audience:** Dairy administrators, centre operators and report users  
**Application type:** Responsive demonstration prototype

> **Important:** This project currently uses sample data. Account access, collection records, device sync, billing, payments and support delivery are not connected to a production backend. Do not treat the figures as official dairy records or enter sensitive information.

---

## 1. What the site does

Dhara presents a dairy cooperative workflow in one web dashboard: collection summaries, farmer records, centre and device status, rate calculations, billing, milk dispatches, quality checks and data-pipeline status. It tracks cow, buffalo and goat milk separately.

The site can be used on a desktop, tablet or phone. On wide screens the main navigation stays in a sidebar. On phones, use the menu button at the top left to open the navigation drawer.

### Demo-data behavior

- The live feed generates simulated sample entries; it does not connect to an analyzer or collector app.
- Dashboard records and edits are demonstration data held in the current app session. A reload can restore the seed data.
- The demo profile and appearance preferences are stored in the current browser. No password is stored by account creation.
- The Contact Support form does not transmit or save the message. It deliberately displays a temporary not-sent error because no support backend is configured.
- Paid, dispatch, sync and calibration buttons update demonstration state only. They do not move money or operate real equipment.

---

## 2. Start the site

From the project folder, run:

```bash
npm install
npm run dev
```

The development command starts Vite and asks it to open the site in the default browser. The default local address is **http://localhost:5173**. Keep the terminal running while you use the development site.

To verify a production build, run:

```bash
npm run build
npm run preview
```

The production build performs a TypeScript check before creating the build files.

---

## 3. Sign in and create an account

### Sign in

1. Open the sign-in page.
2. The email and password are pre-filled for the demo. The prototype also accepts any syntactically valid email and a password of at least four characters.
3. Select **Sign in**.

This is not production authentication. Do not reuse a real password here.

### Create an account

1. From the sign-in page, select **Create an account**.
2. Enter a name, email address, password of at least eight characters, and matching confirmation.
3. Select **Create demo account**. A local demo profile is created and the dashboard opens.

The account form is for prototype access only. The password is used only for the form's length and match checks; it is not sent to a server or saved. Use browser-local profile information for testing only.

---

## 4. Navigation and common controls

### Main navigation

The sidebar groups pages into **Today**, **Dairy**, **Money** and **Insight**. On narrow screens, tap the menu icon in the top-left corner, then choose a page. The mobile drawer closes after navigation.

### Search

Use **Search pages or farmers** in the top bar to open the command/search palette. The keyboard shortcut is **Ctrl+K** on Windows/Linux or **Cmd+K** on macOS.

### Theme, alerts and profile

- Select the moon/sun button to switch between light and dark themes.
- Select the bell to review quality alerts and offline centres, then use **Open quality watch** to go to the alert page.
- Select the initials/profile button for **Account and settings**, **Contact support** or **Sign out**.
- Selecting a page starts at the top of the page.

---

## 5. Dashboard

The dashboard is the daily overview.

- **Milk received today** compares recorded litres with the usual-day sample target. The tank and progress label show the approximate total.
- **Average fat**, **Average SNF**, **Farmers today** and **Payable today** summarize today's sample records and compare available metrics with the previous matching day where applicable.
- **Collection trend** shows daily litres by milk type. Choose **7 days**, **14 days** or **30 days**.
- **Milk mix today** shows the cow/buffalo/goat share.
- **Morning vs evening** compares the last seven days.
- **Centres today** shows received litres by centre; **Manage** opens Centres & devices.
- **Top suppliers today** ranks farmers by litres; **Full report** opens Collections.
- **Sync centres** starts a simulated centre sync. The result is demonstration state, not a real network sync.

---

## 6. Live collection

This page demonstrates the arrival of sample records.

- The three cards at the top show simulated litres and farmer counts by milk type during the current page session.
- **Pause feed** stops the incoming demo entries; **Resume feed** restarts them.
- **Latest slip** shows the newest sample's farmer, milk type, litres, fat, SNF, rate, temperature and amount.
- **Machines listening** shows the current sample centre statuses.
- **Incoming entries** lists recent generated samples, newest first, with a quality flag when applicable.

No physical analyzer is being read by this prototype.

---

## 7. Collections

Collections is the detailed reporting page.

### Filters

Results update when you change the centre, milk type, shift, start/end dates or farmer name/ID. Select **Reset** to return the filters to the default range and all centres/types.

### Report views

Use the five view tabs to change how the filtered records are grouped:

1. **Every sample** — one row per sample, including date, shift, farmer, milk, quantity, quality values, centre, rate and amount.
2. **By farmer** — totals and quality averages grouped by farmer.
3. **By centre** — totals and quality averages grouped by collection centre.
4. **By day** — totals grouped by collection date.
5. **By milk type** — totals for cow, buffalo and goat milk.

Select sortable table headings to sort. Use the row-count selector and previous/next buttons to page through longer results. On small screens the wide table can be scrolled horizontally inside its table area.

### Export and print

- **Excel** downloads an Excel-compatible `.xls` sheet.
- **CSV** downloads comma-separated values.
- **Print / PDF** opens a branded print view. In the browser print dialog, choose **Save as PDF** to create a PDF file or select a printer.
- For the Dhara background/header colors to appear, enable **Background graphics** in the browser's print settings. Printers may use their own color and margin settings.

The print action is a browser print view; it does not directly download a PDF without the user's print/save choice.

---

## 8. Farmers

- Search by farmer name, ID or village.
- Filter the list by collection centre and milk type.
- Select **Add farmer**, fill in the name, village, 10-digit phone number, centre and milk types, then select **Save farmer**. The demo assigns the new ID.
- Select a farmer row to open the ledger drawer. It summarizes litres, average fat, earnings, recent collection history, milk-type totals, phone number and advance balance.
- Use **Pause farmer** or **Reactivate** in the drawer to change the sample status.

Added or changed records are prototype state, not a production membership record.

---

## 9. Centres & devices

- Each centre card shows location, station code, today's sample litres, farmer/member counts, chilling capacity and last-sync time.
- Use **Sync now** on a centre card or **Sync all** at the top to simulate a sync. A syncing badge appears temporarily.
- The **Machines** table lists device model, serial number, centre, firmware, status, last ping and calibration date.
- Select **Calibrate** to record a sample calibration date. It does not communicate with a real device.

An overdue calibration warning appears when a device is beyond the sample 90-day window.

---

## 10. Rate chart

1. Choose **Cow**, **Buffalo** or **Goat** to edit that milk type's independent formula.
2. Adjust the fat rate, SNF rate, base amount and minimum quality values.
3. Select **Save rates** to apply the values to subsequent demo calculations. Select **Restore defaults** to replace the draft with the original sample formula.
4. In **Try a sample**, change fat, SNF or litres to see the calculated rate and payment.
5. Review the **Rate matrix** for sample combinations. Dashed cells are below a configured minimum and receive the displayed reduction.

Changing a rate is not a real cooperative payment instruction.

---

## 11. Billing

- Choose a ten-day billing cycle in the **Cycle** selector.
- Adjust the **Advance recovery** slider to choose the demonstration percentage of gross amount to recover, capped by the farmer's sample advance.
- Summary cards show billed litres, gross amount, advance recovered and net payable.
- Select a **Payslip** button or a row to open the farmer's payslip.
- In the payslip, use **Print** to open the branded print view. Use the print dialog to print or save as PDF.
- Select **Mark as paid** on an individual bill or **Mark all paid** for the displayed cycle. These are sample payment-status flags only.
- **Export CSV** downloads the displayed bill figures.

This page does not issue payments, bank transfers or official wage statements.

---

## 12. Milk sales

- The three stock cards calculate today's collected, dispatched and remaining sample litres separately for each milk type.
- Select **New dispatch**, choose a customer and milk type, then enter litres and a rate. The form checks that litres are positive and do not exceed available sample stock.
- Select **Dispatch** to add a demonstration dispatch to the history.
- Select a payment badge in the history table to toggle the sample status between received and pending.

Dispatches do not represent actual inventory movement or customer orders.

---

## 13. Quality watch

- Choose **Today**, **7 days** or **30 days** to change the reporting period.
- The summary cards count samples flagged as water suspected, low fat, low SNF or too warm.
- **Fat against SNF** plots sample quality values by milk type.
- **Farmers to talk to** ranks farmers with flagged samples in the selected period.
- **Flagged samples** shows each flagged sample and the reason.
- Set the quality thresholds in **Settings**. The underlying demo values and alerts are not laboratory or regulatory results.

---

## 14. Data pipeline

The page explains the example route from analyzer machine to collector app, Dhara cloud and reports/farmers. The phone-shaped **Collector app** panel lets you switch the milk type to preview a sample quantity and rate calculated from the current formula. **Three milk types, three lanes** summarizes their independent rates and stock. **Recent sync log** shows demonstration uploads.

The pipeline diagram and phone preview are explanatory; they do not connect to a real collector app or server.

---

## 15. Settings

- **Appearance:** choose light or dark mode. The choice is remembered in the current browser.
- **Demo data:** select **Reset demo data** and confirm to restore the original sample centres, farmers, collections, sales, rates and limits. This removes in-session changes.
- **Quality alert limits:** set minimum fat and SNF for each milk type and the warm-sample temperature limit. Select **Save limits** to apply them to the alert calculations.
- The profile card displays the local demo name/email, role and dairy label.

---

## 16. Contact support

The form asks for a name, email, topic and message. When **Send message** is selected, the site shows:

> Temporary error — message not sent. The support backend is not connected yet.

The message is not transmitted or stored. For urgent operational help, call the dairy administrator using the contact number provided by your organization. Do not enter passwords or payment information in the form.

---

## 17. Phone and tablet tips

- The mobile menu replaces the desktop sidebar; tap it to open and choose a page.
- Cards, filters, forms and most controls stack into a single column or compact grid as the screen narrows.
- Data tables retain readable columns in a horizontal scroll area rather than squeezing every field into a phone width.
- Use the page scroll to reach lower charts and sections; route changes reset the view to the top.
- On tablets, the app gradually switches from stacked cards to multi-column layouts as screen width permits.
- For printed pages, preview paper size and orientation before printing. Use landscape orientation for very wide tables and enable background graphics for the brand colors.

---

## 18. Troubleshooting and production checklist

**Sign-in returns to the login page:** use a valid email and a password with at least four characters, or create a local demo profile.

**A support message was not sent:** this is expected until a support API is connected; the page tells you the message was not delivered.

**The printout is missing color:** enable Background graphics in the browser print dialog; the final output can also depend on printer settings.

**A table looks narrow on a phone:** swipe horizontally within the table area. Other page content should remain within the screen width.

**Data changed after a reload:** sample records are not database-backed and may return to their starting seed.

Before production deployment, connect server-side authentication and access control, persistent dairy data, validated device/API sync, monitored quality rules, official billing/payment integrations, and a support-message endpoint. Add privacy, retention, audit and security policies before storing real farmer information.
