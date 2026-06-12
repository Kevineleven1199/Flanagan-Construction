# Joist, Square, CPA Reporting, And Quote Workflow

This site should bridge the business from Joist-first operations to a fuller in-house CRM without interrupting how invoices currently go out.

## Current Operating Plan

- Keep official estimates and invoices in Joist for now. Joist is still the source that emails customers as Flanagan Construction.
- Use the website CRM for lead capture, started-but-unfinished requests, follow-up stage, notes, internal quote math, Joist estimate numbers, Joist invoice numbers, and payment links.
- Paste Joist references back into each lead after creating the estimate or invoice in Joist.
- Use the admin Money tab to export CPA-ready revenue/expense CSVs or open an email draft summary.
- Later, after Google Workspace is set up, move outbound website emails from `nickflanagan73@gmail.com` to `info@yourdomain.com`.

## Joist Compatibility Notes

I did not find a public Joist developer API in the official Joist materials. Public Joist pages position the product as a contractor app for estimates, invoices, payments, and project/client management, with QuickBooks sync/export paths rather than a developer API.

Useful references:

- Joist home: https://www.joist.com/
- Joist Pro / QuickBooks features: https://www.joist.com/joist-pro/
- Joist + QuickBooks sync: https://www.joist.com/features/quickbooks-sync/
- Joist App Store listing notes estimate/invoice creation, payment tracking, client management, estimate-to-invoice conversion, and accounting export: https://apps.apple.com/ca/app/joist-invoice-estimate-app/id592163563

Practical bridge:

- `joistClientName`: customer/client name as entered in Joist.
- `joistEstimateNumber`: Joist estimate reference.
- `joistInvoiceNumber`: Joist invoice reference.
- `joistStatus`: quick office status like `Estimate drafted`, `Invoice sent`, `Paid in Joist`.
- `paymentLink`: paste Joist or Square payment link for follow-up emails.

## Square Payment Path

Square has public APIs for the future payment replacement path.

Useful references:

- Square Payments overview: https://developer.squareup.com/docs/payments-overview
- Square Checkout API: https://developer.squareup.com/docs/checkout-api
- Square Create Payment Link endpoint: https://developer.squareup.com/reference/square/checkout-api/create-payment-link
- Square Invoices API overview: https://developer.squareup.com/docs/invoices-api/overview
- Square Invoices API reference: https://developer.squareup.com/reference/square/invoices-api
- Square Payment Links product page: https://squareup.com/us/en/payment-links

Recommended rollout:

1. Phase 1: paste Square or Joist payment links into the CRM manually.
2. Phase 2: add Square Checkout API credentials and create Square-hosted payment links from the lead.
3. Phase 3: create Square Orders and publish Square Invoices when the business is ready to replace Joist invoicing.

## Internal Quote And Margin Workflow

For each lead, the admin dashboard now supports:

- Labor cost
- Material cost
- Subcontractor cost
- Other cost
- Markup percent
- Suggested external customer price
- Entered customer quote price
- Deposit target
- Revenue received
- Expense total
- Gross profit and margin

Keep the customer-facing estimate clean. The CRM margin math is internal only.

## CPA Reporting

Use Admin > Money:

- `Export CPA CSV` downloads lead/job financial fields.
- `Email CPA summary` opens a mail draft with totals and job lines.
- If the CPA email is known later, make it a saved setting so the button can prefill the recipient.

Recommended monthly habit:

1. Reconcile paid invoices in Joist or QuickBooks.
2. Update `revenueReceived`, `expenseTotal`, and Joist invoice references in each won/completed lead.
3. Export the CPA CSV.
4. Email the CPA summary and attach the CSV.

## Email Sender Plan

Current:

- Mail drafts use Nick's Gmail address.
- Joist still sends official estimate/invoice emails.

Railway SMTP variables prepared:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=nickflanagan73@gmail.com`
- `SMTP_PASS=<Gmail app password>`
- `SMTP_FROM=Nick Flanagan <nickflanagan73@gmail.com>`

Future:

- Set up Google Workspace.
- Replace `SMTP_USER` and `SMTP_FROM` with `info@yourdomain.com`.
- Add server-sent stage emails after SPF, DKIM, and DMARC are configured.
