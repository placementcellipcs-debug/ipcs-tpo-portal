# IPCS workbook split

The migration copied all 48 tabs from the original Placement Ecosystem and Academic workbooks into the four destination spreadsheets below. The original workbooks were left unchanged as rollback copies. Tabs were copied on Google's side, which preserves their cell values, formulas, and formatting. A new `Hiring Inquiries` tab was added for the public company form.

| Destination | Tabs | Spreadsheet |
| --- | ---: | --- |
| IPCS Students | 3 | [Open spreadsheet](https://docs.google.com/spreadsheets/d/14WvBO50cY66NLQVQXs1OrR-jcOD6AQSKz9Yya60KG3o/edit) |
| IPCS Placements & Recruitment | 9 | [Open spreadsheet](https://docs.google.com/spreadsheets/d/1eSMP6u8G11ErXOYS1XTU0qR4RvyCNcFQtP19dHkNz5c/edit) |
| IPCS Learning & Academics | 26 | [Open spreadsheet](https://docs.google.com/spreadsheets/d/18alS1bVj33kZ8wX7VcQiwrPzLSfOyQWkc8fRooTD7Nk/edit) |
| IPCS Operations & System Logs | 11 | [Open spreadsheet](https://docs.google.com/spreadsheets/d/1qLS3e0xJX0IVhNoGFGM8uPtet7mxI6QHzpz-AwfoBnI/edit) |

## Tab groups

- **Students:** `Data`, `Student_Diary`, `Leave_Applications`.
- **Placements:** `NewsLetter`, `Event`, `Drive_Registration`, `Opening_Applied`, `Clients`, `TPO_Log`, `TPO_Stats`, `Corporate Training Inquiries`, `Hiring Inquiries`.
- **Learning:** `Courses`, `Study_Materials`, Talentino schedule and attendance, technical and aptitude question/result tabs, and all 16 academic tabs (`Training`, `Batches`, `Topics`, `Sessions`, `Attendance`, `Topic_Progress`, `Diary`, `Trainer_Remarks`, `Assignments`, `Assessments`, `Assessment_Results`, `Activities`, `Certificate_Requests`, `Certificates`, `Attendance_Corrections`, `Audit_Log`).
- **Operations:** `Contact`, `User`, `Branches`, `Issues`, `Security_Logs`, `Auth_Sessions`, `Password_Reset_Tokens`, `Mail`, `EmailQueue`, `EmailQuotaUsage`, `Trainer/TL_Log`.

## Connect the portal

The backend now uses these four spreadsheet IDs as defaults. Render variables override those defaults, so if any of the following variables already exist there, set them to the matching IDs above:

- `STUDENT_DATA_SPREADSHEET_ID`
- `PLACEMENT_SPREADSHEET_ID`
- `LEARNING_SPREADSHEET_ID`
- `OPERATIONS_SPREADSHEET_ID`

Deploy the backend code for the portal to start using the split workbooks. Keep `SPREADSHEET_ID` and `ACADEMIC_SPREADSHEET_ID` pointing to the original workbooks for rollback. To roll back, point the four group variables to the original primary workbook and point `LEARNING_SPREADSHEET_ID` to that primary workbook; the backend will also load the legacy academic workbook.

The migration runner is idempotent. From the backend folder, run `node migrateSheets.js` to copy any missing tabs and verify them again. It reads credentials from the existing `backend/.env` and does not print those credentials or student records.

Splitting organizes the records and reduces the amount of data in each workbook; it does not raise the Google API project quota. The backend cache now reads Contact/User together, then batches the remaining cached tabs by workbook. This reduces the recurring cache refresh from roughly 25 individual tab reads to 5 batch reads. Changes made through the portal trigger an immediate refresh; manual edits made directly in Sheets are picked up by the two-minute poll. If a refresh fails, the last good data stays available and retries start after one minute, then every two minutes until a refresh succeeds. Other direct app operations still use Sheets API calls, so keep the cache as the normal read path.

The email Apps Script template in `backend/apps-script/Code.gs` only sends mail and reads that sender account's quota; it does not read or write any workbook. The existing Apps Script endpoint in the backend is used for Drive uploads. Update an Apps Script project only if its own deployed code contains a hard-coded reference to one of the old spreadsheet IDs; changing email sender accounts alone does not require a workbook change.

The new files contain student and company contact information. `Anyone with the link can edit` gives every link holder access; after the backend is connected, limit sharing to the staff who need access and the portal service account.
