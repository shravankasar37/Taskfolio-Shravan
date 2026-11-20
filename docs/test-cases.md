# To-Do Application – Test Cases

Owner: Vaishnavi Subhash Gaikwad (Testing & QA) · Branch: `feature/testing-docs`

**Before testing:** start the database, backend (`http://localhost:5000`) and frontend (`http://localhost:4200`).
Use the test logins listed in `database/README.md` (1 admin, 2 users). Never write real passwords in this file.

| Test ID | Feature | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| TC-01 | Register | Open **Create an account**, enter name, a new email and a password (6+ characters), click **Register** | "Account created. Sign in to continue." appears; the new account can sign in | | Not Run |
| TC-02 | Login – User | Enter a valid user email and password, click **Sign in** | **My tasks** dashboard opens and shows only this user's tasks | | Not Run |
| TC-03 | Login – Admin | Enter the admin email and password, click **Sign in** | **Admin dashboard** opens with Registered users and All tasks | | Not Run |
| TC-04 | Wrong Password | Enter a valid email with a wrong password, click **Sign in** | Error "Invalid email or password." appears; user stays on the Sign in screen | | Not Run |
| TC-05 | Unknown Email | Enter an email that is not registered, click **Sign in** | Same error "Invalid email or password." appears; login fails | | Not Run |
| TC-06 | Add Task | Enter a title, choose a priority and due date, click **Add task** | New task appears in the list as **pending** with the chosen priority and due date; Total and Pending counts increase by 1 | | Not Run |
| TC-07 | Edit Task | Click **Edit** on a task, change title, description and priority, click **Save changes** | Task shows the new values; form returns to "Add task" | | Not Run |
| TC-08 | Delete Task | Click **Delete** on a task and confirm | Task disappears from the list; Total count decreases by 1 | | Not Run |
| TC-09 | Complete Task | Click **Mark completed** on a pending task | Task shows **completed** badge and is crossed out; Completed count +1, Pending count −1 | | Not Run |
| TC-10 | Reopen Task | Click **Reopen** on a completed task | Task shows **pending** again; counts update back | | Not Run |
| TC-11 | Pending Filter | Click the **pending** filter | Only pending tasks are shown | | Not Run |
| TC-12 | Completed Filter | Click the **completed** filter | Only completed tasks are shown | | Not Run |
| TC-13 | Sign Out | Click **Sign out** (top right) | User returns to the Sign in screen; dashboard data is no longer visible | | Not Run |
| TC-14 | Admin – View Users | Sign in as admin, look at **Registered users** | All registered users are listed with email, role and Active/Inactive status | | Not Run |
| TC-15 | Admin – View Tasks | Sign in as admin, look at **All tasks** | Tasks from every user are listed with "Assigned to <name>" | | Not Run |
| TC-16 | Admin – Task Statistics | Sign in as admin and compare the **Total / Pending / Completed** cards with the task list | Total = number of tasks in the list; Pending + Completed = Total; counts change correctly after completing or deleting a task | | Not Run |
| TC-17 | Deactivate User | As admin, click **Deactivate** on a user and confirm; then sign out and try to sign in as that user | User shows **Inactive**; the deactivated user **cannot sign in** ("Your account is inactive…" message) | | Not Run |
| TC-18 | Activate User | As admin, click **Activate** on the inactive user; then sign in as that user | User shows **Active** and can sign in again | | Not Run |
| TC-19 | User Access Control (UI) | Sign in as a normal user | Only **My tasks** is shown; no Registered users list, no Activate/Deactivate buttons, no other users' tasks | | Not Run |
| TC-20 | Empty Task Title | Leave the title empty (or only spaces) and try to add a task | **Add task** button stays disabled; no task is added | | Not Run |
| TC-21 | Empty Registration Email | Try to register without an email | **Register** button stays disabled; no account is created | | Not Run |
| TC-22 | Empty Registration Name | Try to register without a name | **Register** button stays disabled; no account is created | | Not Run |
| TC-23 | Empty Registration Password | Try to register without a password | **Register** button stays disabled; no account is created | | Not Run |
| TC-24 | Invalid Email Format | Register with an email like `abc@` or `abc.com` | Registration is blocked (button disabled or a validation error is shown); no account is created | | Not Run |
| TC-25 | Very Long Task Title | Try typing a title longer than 200 characters | Title box stops accepting text after 200 characters; the task saves with at most 200 characters and no error | | Not Run |
| TC-26 | Duplicate Email | Register with an email that already exists (try different upper/lower case too) | Error "This email is already registered." appears; no new account | | Not Run |
| TC-27 | Refresh After Login | Sign in, then press **F5** | User stays signed in and the dashboard reloads with the same data | | Not Run |
| TC-28 | Empty Login Email | Leave email empty and try to sign in | **Sign in** button stays disabled | | Not Run |
| TC-29 | Empty Login Password | Enter an email, leave password empty, try to sign in | **Sign in** button stays disabled | | Not Run |
| TC-30 | User Task Visibility | Sign in as user A, add a task; sign out; sign in as user B | User B does **not** see user A's task | | Not Run |
| TC-31 | Add Multiple Tasks | Add 3 tasks one after another | All 3 appear in the list; Total count increases by 3 | | Not Run |
| TC-32 | Search by Title | Type part of a task title in **Search by title** | Only matching tasks are shown; clearing the box shows all again | | Not Run |
| TC-33 | Delete Completed Task | Delete a task that is **completed** | Task is removed; Completed count decreases by 1 | | Not Run |
| TC-34 | Sign Out After Admin Login | Sign in as admin, click **Sign out** | Admin returns to the Sign in screen | | Not Run |
| TC-35 | New Browser Tab | Sign in, then open `http://localhost:4200` in a **new tab** | New tab shows the Sign in screen (login is saved per tab) | | Not Run |
| TC-36 | Admin API Protection | Sign in as a **normal user** in Thunder Client/Postman (`POST /api/auth/login`), then call `GET http://localhost:5000/api/admin/users` with that token | Server returns **403** "Only admins can do this." | | Not Run |
| TC-37 | Admin Cannot Deactivate Self | Sign in as admin and look at your own row in Registered users | No **Deactivate** button is shown for the logged-in admin | | Not Run |
| TC-38 | Sort Tasks | Change **Sort by** to due date, then to title | Tasks are reordered by due date (earliest first), then alphabetically by title | | Not Run |
| TC-39 | Short Password | Register with a password of fewer than 6 characters | An error about the password length appears; no account is created | | Not Run |

## How to update this file

- Keep **Actual Result** empty and **Status = Not Run** until you have actually run the test.
- After testing, write what really happened in **Actual Result** and set **Status** to **PASS** or **FAIL**.
- For every **FAIL**, add a row in `docs/bug-report.md` and tell the person responsible.
