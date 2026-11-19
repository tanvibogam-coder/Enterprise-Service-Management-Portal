# Test Cases and Results

**API tests** were executed with curl against the running API (Node 22, MariaDB 10.11 – MySQL-compatible; target is MySQL 8) using the seed data. You can repeat them in Postman using `docs/API.md`.
**UI tests** are a manual checklist to run in the browser (fill in the last column during your demo).

## A. API tests (executed)

| # | Area | Test | Expected | Result |
|---|---|---|---|---|
| A1 | Auth | Login with wrong password | 401 `Invalid email or password` | Pass |
| A2 | Auth | Call `/requests` without token | 401 | Pass |
| A3 | Auth | Register new user | 201 + token, role = employee | Pass |
| A4 | Auth | Register same email again | 409 | Pass |
| A5 | Auth | Malformed JSON body | 400 `Malformed JSON body` | Pass |
| A6 | Auth | 6 wrong logins in a row | 6th returns 429 | Pass |
| A7 | Auth | Token of a disabled user | 401 `Account not found or disabled` | Pass |
| A8 | Validation | Create request with short title / description, bad department | 422 with per-field errors | Pass |
| A9 | Validation | Upload `.exe` attachment | 422 `File type .exe is not allowed` | Pass |
| A10 | Validation | `GET /requests/abc` | 400 `Invalid request id` | Pass |
| A11 | Requests | Employee creates request with attachment | 201, ID `REQ-2026-0000X`, auto-assigned to lowest-workload IT agent, status Assigned | Pass |
| A12 | Requests | Employee lists requests | Only own requests returned | Pass |
| A13 | Requests | Search `q=laptop` | Only matching request | Pass |
| A14 | Requests | Date range in the future | 0 results | Pass |
| A15 | Requests | `limit=2&page=2` | 2 rows, `totalPages` = 4 | Pass |
| A16 | Requests | Sort by priority desc | Highest priority first | Pass |
| A17 | Requests | Employee edits own Assigned request (title, priority) | 200 | Pass |
| A18 | Requests | Employee deletes own Assigned request | 200 | Pass |
| A19 | Requests | Employee edits / deletes own In-Progress request | 403 | Pass |
| A20 | Requests | Employee changes deadline | 403 | Pass |
| A21 | Authorization | Employee opens another employee's request | 403 | Pass |
| A22 | Authorization | HR agent opens an IT request | 403 | Pass |
| A23 | Authorization | Employee calls `/users` and `/requests/export/csv` | 403 | Pass |
| A24 | Workflow | Assigned → Closed (invalid transition) | 400 `Invalid status change` | Pass |
| A25 | Workflow | Employee sets In Progress | 403 | Pass |
| A26 | Workflow | Agent who is not the assignee changes status | 403 | Pass |
| A27 | Workflow | Assigned agent: Assigned → In Progress → Resolved | 200, 200 | Pass |
| A28 | Workflow | Employee closes Resolved request | 200 | Pass |
| A29 | Assignment | Admin assigns an IT agent to an Administration request | 422 `Agent does not belong to the request department` | Pass |
| A30 | Assignment | Admin reassigns to a valid agent with a note | 200, assignment history row + notification created | Pass |
| A31 | Assignment | Admin moves a request to another department | 200, re-routed to an HR agent, status Assigned | Pass |
| A32 | Overdue | Past-due request is flagged by the overdue job / dashboard read | `is_overdue = 1`, `overdue_flagged` audit entry, notification | Pass |
| A33 | Overdue | Admin extends the deadline into the future | Overdue flag cleared | Pass |
| A34 | Dashboard | Admin summary | Totals, by department / priority / status, average resolution hours, agent workload | Pass |
| A35 | Export | Admin exports CSV with status filter | `text/csv`, header row + only closed requests | Pass |
| A36 | Notifications | Employee unread count after assignments/updates | Count increases (verified `2`) | Pass |
| A37 | Attachments | Download attachment as request owner | 200 file | Pass |
| A38 | Users | Admin demotes own account | 422 | Pass |
| A39 | Users | Admin creates an agent without department | 422 | Pass |
| A40 | Errors | Unknown route | 404 JSON | Pass |

## B. UI checklist (manual)

| # | Test | Expected | Result |
|---|---|---|---|
| B1 | Open `/` without logging in | Redirect to login | |
| B2 | Login form with empty / invalid email | Inline field errors, no API call | |
| B3 | Register with mismatched passwords | Error under "Confirm password" | |
| B4 | Login as employee | Dashboard shows only own request metrics; no "Users" menu | |
| B5 | Employee opens `/users` directly | "Access denied" page | |
| B6 | Submit new request with all fields + file | Success toast, redirect to detail page | |
| B7 | Submit with empty form | Warning toast + field errors | |
| B8 | Attach file > 5 MB or `.exe` | Error under the file field | |
| B9 | Requests table: search, filters, sort headers, pagination | Table updates, loading dim, empty state when nothing matches | |
| B10 | Agent opens assigned request → Start work → Mark resolved | Status badge + timeline update | |
| B11 | Employee sees notification badge, opens notification | Badge decreases, goes to request | |
| B12 | Admin dashboard date-range filter | KPIs and bars update | |
| B13 | Admin "Export CSV" | File downloads, opens in any editor | |
| B14 | Overdue request | Red "Overdue" badge + banner on detail page | |
| B15 | Resize to 375 px wide | Sidebar becomes a menu, tables scroll, forms stack | |
| B16 | Stop the API and reload | Friendly "Cannot reach the server" error state with retry | |
