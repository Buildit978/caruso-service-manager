# Caruso Service Manager — Project Context (for Copilot)

This is a full-stack auto service management system built for Caruso’s Service Center.

## 🧱 Architecture Overview

- **Backend**: Node.js + Express + MongoDB (Mongoose)
  - Runs on port 4000
  - API base path: /api
- **Frontend**: React + TypeScript + Vite
  - Runs on port 5173
  - Proxy set to forward /api → backend

## 📦 Core Entities

### Customers
- Model: customer.model.ts
- Key fields: firstName, lastName, phone, email, address, vehicles[]
- Accessible via /api/customers

### Work Orders
- Model: workOrder.model.ts
- Contains:
  - customerId
  - status: open | in_progress | completed | invoiced
  - vehicle snapshot
  - lineItems: { description, qty, unitPrice, type }
  - subtotal, taxRate, taxAmount, total
- Endpoints: /api/work-orders

### Invoices
- Model: invoice.model.ts
- Contains:
  - invoiceNumber (incremental string)
  - status: draft | sent | paid
  - workOrderId
  - customerSnapshot
  - vehicleSnapshot
  - lineItems snapshot
  - subtotal, taxRate, taxAmount, total
- Endpoints: /api/invoices

#### Create Invoice:


## 📡 Frontend API Helpers

- All invoice calls should use `frontend/src/api/invoices.ts`
- All work order calls should use `frontend/src/api/workOrders.ts`
- API client is the shared axios instance named `api`

## 🧭 Routing Rules

### Frontend Routes


- Invoice Detail Page must call:
  `fetchInvoiceById(id)` from `api/invoices.ts`
- Work Order Detail Page must call:
  `navigate("/invoices/${invoice._id}")` after create

## 📝 Guiding Principles for Copilot

- Use the axios `api` instance for ALL network calls
- Keep consistency in route naming:
/invoices, not /invoice and not /from-workorder
- Avoid raw fetch() unless necessary
- Keep Work Order → Invoice as a snapshot (copy data, not reference)
- Use strongly typed interfaces in /frontend/src/types/
- Avoid generating duplicate helpers
- Follow React functional component patterns and hooks
