To-Do Application – Test Cases

Test ID| Feature| Steps| Expected Result| Actual Result| Status
TC-01| Register| Open Create Account, enter name, email and password, click Register| Account should be created successfully| | Not Run
TC-02| Login - User| Enter valid user email and password, click Sign in| User Dashboard should open| | Not Run
TC-03| Login - Admin| Enter valid admin email and password, click Sign in| Admin Dashboard should open| | Not Run
TC-04| Wrong Password| Enter valid email with wrong password| Error message should appear and login should fail| | Not Run
TC-05| Unknown Email| Enter an email that is not registered| Error message should appear| | Not Run
TC-06| Add Task| Enter a task title and click Add Task| New task should be added| | Not Run
TC-07| Edit Task| Select an existing task, change its title and save| Task should be updated| | Not Run
TC-08| Delete Task| Select an existing task and click Delete| Task should be deleted| | Not Run
TC-09| Complete Task| Select a pending task and mark it as Completed| Task status should change to Completed| | Not Run
TC-10| Reopen Task| Select a completed task and mark it as Pending| Task should become Pending again| | Not Run
TC-11| Pending Filter| Click the Pending filter| Only pending tasks should be displayed| | Not Run
TC-12| Completed Filter| Click the Completed filter| Only completed tasks should be displayed| | Not Run
TC-13| Logout| Click the Logout button| User should be logged out and returned to login screen| | Not Run
TC-14| Admin - View Users| Login as admin and open the users section| Admin should see all users| | Not Run
TC-15| Admin - View Tasks| Login as admin and open the tasks section| Admin should see all tasks| | Not Run
TC-16| Admin - Task Statistics| Open the admin dashboard and check task statistics| Task statistics should display correct values| | Not Run
TC-17| Deactivate User| Login as admin and deactivate a user| Selected user should become inactive| | Not Run
TC-18| Activate User| Login as admin and activate an inactive user| Selected user should become active| | Not Run
TC-19| User Access Control| Login as a normal user and try to open the Admin Dashboard| Normal user should not be allowed to access Admin Dashboard| | Not Run
TC-20| Empty Task Title| Try to add a task without entering a title| Task should not be added and an error message should appear| | Not Run
TC-21| Empty Registration Email| Try to register without entering an email| Registration should not be completed| | Not Run
TC-22| Empty Registration Name| Try to register without entering a name| Registration should not be completed| | Not Run
TC-23| Empty Registration Password| Try to register without entering a password| Registration should not be completed| | Not Run
TC-24| Invalid Email Format| Enter an incorrectly formatted email during registration| Validation error should appear| | Not Run
TC-25| Very Long Task Title| Try adding a task with a very long title| Application should handle the input properly| | Not Run
TC-26| Duplicate Email| Register using an email that already exists| Duplicate registration should not be allowed| | Not Run
TC-27| Refresh After Login| Login successfully and refresh the browser page| Application should handle the login session correctly| | Not Run
TC-28| Empty Login Email| Click Sign in without entering an email| Login should not be completed| | Not Run
TC-29| Empty Login Password| Enter a valid email but leave the password empty| Login should not be completed| | Not Run
TC-30| User Task Visibility| Login as a user and open the task list| User should see their own tasks| | Not Run
TC-31| Add Multiple Tasks| Add more than one task| All added tasks should appear in the task list| | Not Run
TC-32| Edit Task Title| Change the title of an existing task| Updated title should be displayed| | Not Run
TC-33| Delete Completed Task| Select a completed task and delete it| Completed task should be deleted| | Not Run
TC-34| Logout After Admin Login| Login as admin and click Logout| Admin should be logged out| | Not Run
TC-35| Refresh Dashboard| Login successfully and refresh the dashboard| Dashboard should load correctly| | Not Run

Important:

- Keep Actual Result empty.
- Keep Status as Not Run.
- Change the status to PASS or FAIL only after actually testing the application.