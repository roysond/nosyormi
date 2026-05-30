# NOSYOR.M.I — QA Manual Test Cases

> Manual test cases for submission. Each case documents the action taken,
> expected result, and actual result observed during testing.
> All tests performed against: http://localhost:5173 (frontend) 
> and http://localhost:5034 (backend API).
> Test date: 21 May 2026 · Revised 29 May 2026
>
> **Revision notes:**
> - **28 May 2026:** `StatementDetailPage` removed; TC-13/TC-14 re-pointed to Dashboard date filter and new chart types.
> - **29 May 2026:** TC-14 extended for `topN`; TC-19 added for top-N fallback behaviour.
> - **29 May 2026:** Documentation aligned — chat uses full context injection, not query-time RAG; ~750 txn architectural ceiling documented (no new test case — design limit, not runtime validation).

---

## TC-01 — Upload a valid CSV statement

**Precondition:** No duplicate of the file exists in the database.  
**Steps:**
1. Navigate to Statements page
2. Click "+ Upload Statement"
3. Drop or select `sample_statement.csv`
4. Click "Reflect on this statement"

**Expected:** Success confirmation appears. Modal closes after 1.5s. Statement appears in the list with correct filename, date, and transaction count.  
**Actual:** ✅ Pass — statement uploaded successfully, appeared in list with correct metadata.

---

## TC-02 — Duplicate upload rejection

**Precondition:** `sample_statement.csv` already uploaded.  
**Steps:**
1. Navigate to Statements page
2. Click "+ Upload Statement"
3. Select the same `sample_statement.csv` again
4. Click "Reflect on this statement"

**Expected:** Error message shown: "This file has already been uploaded. Duplicate statements are not allowed."  
**Actual:** ✅ Pass — 409 Conflict returned, error message displayed in modal.

---

## TC-03 — Upload non-CSV file

**Precondition:** None.  
**Steps:**
1. Navigate to Statements page
2. Click "+ Upload Statement"
3. Select any `.txt` or `.pdf` file

**Expected:** Error message: "Only .csv files are supported."  
**Actual:** ✅ Pass — file rejected before upload attempt, error shown in modal.

---

## TC-04 — Dashboard loads most recent statement

**Precondition:** At least one statement uploaded.  
**Steps:**
1. Navigate to Dashboard

**Expected:** Dashboard shows Total Income, Total Expenses, NET, Anomalies stat cards. Donut chart renders with spending categories. Transaction list shows below.  
**Actual:** ✅ Pass — all stat cards populated, donut chart rendered, transactions listed correctly.

---

## TC-05 — Dashboard empty state

**Precondition:** No statements in the database.  
**Steps:**
1. Delete all statements from Statements page
2. Navigate to Dashboard

**Expected:** "No statements uploaded yet." message with subtext.  
**Actual:** ✅ Pass — empty state renders correctly with upload prompt.

---

## TC-06 — Anomaly detection and highlighting

**Precondition:** Statement with known anomaly uploaded (Uber Eats -$389.90).  
**Steps:**
1. Navigate to Transactions page
2. Scroll to find the anomaly transaction

**Expected:** Anomalous transaction highlighted with amber glow animation and "⚠ ANOMALY" badge. Anomaly count shown in header pill.  
**Actual:** ✅ Pass — Uber Eats -$389.90 highlighted with amber glow, "1 anomaly detected" pill visible.

---

## TC-07 — Transaction search

**Precondition:** Statement loaded with multiple transactions.  
**Steps:**
1. Navigate to Transactions page
2. Type "Uber" in the search box

**Expected:** List filters to show only transactions containing "Uber".  
**Actual:** ✅ Pass — list filtered correctly to matching transactions.

---

## TC-08 — Transaction category filter

**Precondition:** Statement loaded.  
**Steps:**
1. Navigate to Transactions page
2. Select "Shopping" from the category dropdown

**Expected:** Only shopping transactions shown. Summary panel updates to reflect filtered set.  
**Actual:** ✅ Pass — filtered correctly, summary updated.

---

## TC-09 — Transaction sort

**Precondition:** Statement loaded.  
**Steps:**
1. Navigate to Transactions page
2. Change sort to "Highest spend"

**Expected:** Transactions reorder with largest absolute amount first.  
**Actual:** ✅ Pass — reordered correctly.

---

## TC-10 — Transaction expand row

**Precondition:** Statement loaded.  
**Steps:**
1. Navigate to Transactions page
2. Click any transaction row

**Expected:** Expanded panel appears below the row showing Date, Category, and Status fields.  
**Actual:** ✅ Pass — expanded panel renders with correct details.

---

## TC-11 — Delete statement with confirmation

**Precondition:** At least one statement in the list.  
**Steps:**
1. Navigate to Statements page
2. Click "Delete" on a statement
3. Verify modal shows correct filename and transaction count
4. Click "Delete" in the modal

**Expected:** Modal shows correct filename and count. After confirmation, statement removed from list instantly. DB record and all transactions deleted.  
**Actual:** ✅ Pass — modal correct, statement removed from list, verified via GET /api/statements returning empty array.

---

## TC-12 — Delete modal cancel

**Precondition:** At least one statement in the list.  
**Steps:**
1. Click "Delete" on a statement
2. Click "Cancel" in the modal

**Expected:** Modal closes. Statement remains in the list.  
**Actual:** ✅ Pass — no deletion occurred.

---

## TC-13 — Dashboard date-range filter

> *(Revised 28 May 2026 — replaces the removed "View Details navigation"
> case; per-statement scoping is now handled by the Dashboard filter.)*

**Precondition:** A statement spanning more than one month is uploaded.  
**Steps:**
1. Navigate to Dashboard
2. Open the date-range dropdown (📅 button above "Spending by Category")
3. Select a single-month quick-select pill
4. Re-open the dropdown, enter a custom From/To range, click "Apply"

**Expected:** Stat cards (Income, Expenses, NET, Anomalies), donut chart, and transaction list all update to reflect only the selected period. Custom range applies only after "Apply". Clicking outside closes the dropdown.  
**Actual:** ✅ Pass — all figures and the donut re-scope to the selected period; custom range commits on Apply; outside-click closes the picker.

---

## TC-14 — Chat renders extended chart types (treemap / stacked / horizontal)

> *(Revised 28 May 2026 — replaces the removed StatementDetailPage case.)*

**Precondition:** Statement uploaded; on the NOSYOR.M.I Chat page.  
**Steps:**
1. Ask "show me a treemap" (and similarly "stacked by month", "rank my categories")

**Expected:** The chart panel renders the requested type — treemap, stacked bar, or horizontal bar — with the shared `UniversalTooltip` on hover.  
**Actual:** ✅ Pass — each requested chart type renders correctly with the unified tooltip.

---

## TC-19 — Chat topN chart (biggest expenses)

> *(Added 29 May 2026.)*

**Precondition:** Statement uploaded with multiple expense transactions; on Chat page.  
**Steps:**
1. Ask "show me my top 5 biggest expenses" (or "largest purchases")
2. Observe chart panel title and bars

**Expected:** Chart panel shows "Biggest Transactions" (`topN` type). Individual expense transactions appear as ranked bars (not category totals). Server fallback applies if the model omits `topN`.  
**Actual:** ✅ Pass — topN chart renders with correct ranked transactions.

---

## TC-15 — Chat loads and responds

**Precondition:** Statement uploaded.  
**Steps:**
1. Navigate to NOSYOR.M.I Chat
2. Type "Where did I spend the most?"
3. Press Enter or click →

**Expected:** Message sent. Typing indicator appears. AI response arrives with spending insight. Chart panel may update.  
**Actual:** ✅ Pass — response received with accurate spending breakdown.

---

## TC-16 — Chat reflects correct statement filename

**Precondition:** Statement uploaded.  
**Steps:**
1. Navigate to NOSYOR.M.I Chat

**Expected:** Subtitle reads "Reflecting on [filename]" matching the most recently uploaded statement.  
**Actual:** ✅ Pass — subtitle shows correct filename dynamically.

---

## TC-17 — Sidebar navigation

**Precondition:** App running.  
**Steps:**
1. Click each sidebar item: Dashboard, Transactions, Statements, NOSYOR.M.I Chat

**Expected:** Each click navigates to the correct page. Active item highlighted with the gold accent (`#E8C96A`) and icon glow.  
**Actual:** ✅ Pass — all navigation working, active state correct.

---

## TC-18 — API health check

**Precondition:** Backend running.  
**Steps:**
1. Open browser and navigate to http://localhost:5034/health

**Expected:** Returns 200 OK.  
**Actual:** ✅ Pass — health endpoint responds correctly.

---

*Total: 19 test cases | Passed: 19 | Failed: 0*