# Web Portal Testing Checklist
Based on the PRD for the CRCY Scan and Help System.

## 1. Authentication & Access Control 
- [ ✅] **Unauthenticated Redirection:** Attempt to directly access protected pages (like `/pages/dashboard.html`) without logging in. Verify that you are automatically redirected to `login.html`.
- [✅ ] **MFA OTP Generation:** Log in using the Admin email (`neowarsia@gmail.com`) and password. Verify that a 6-digit OTP is successfully sent to the configured email (`taskerrandemail@gmail.com`).
- [ ✅] **OTP Verification:** Enter the correct OTP and verify that you successfully enter the Admin Dashboard.
- [✅ ] **Brute Force Protection:** Attempt to log in but enter an incorrect OTP 3 consecutive times. Verify that the system locks the account out for 15 minutes as per the threat mitigation rules.

## 2. Student & Medical Profile Management
- [✅ ] **Create Student Record:** Register a new student profile. Fill out their medical details (e.g., allergies, hypertension, guardian contact details) as if migrating from a physical consent form.
- [✅ ] **Update Student Record:** Edit an existing student's medical file, save the changes, and ensure they persist.
- [✅ ] **Email Receipt:** Verify that upon creating the student, the system automatically sends an email receipt summarizing their encoded medical profile to their email address.

## 3. QR Tag Generation & Deactivation
- [✅ ] **Generate QR Tag:** Generate a print-ready QR tag for a registered student. Ensure the payload is a tokenized UUID and not raw plain-text medical data.
- [❌ ] **Test the Deactivation Link (Right-to-Erasure):** Open the automated email receipt sent to the student and click the 1-click "Deactivate My Medical Tag" link. 
- [✅ ] **Verify Void Status:** Check the dashboard to confirm that the specific tag is now voided/deactivated server-side and can no longer be used.

## 4. Staff & Responder Management
- [✅ ] **Create a Responder Account:** Navigate to staff management and create a new CRCY Responder account. Verify that an automated account creation email is sent to them.
- [ ] **Create an Admin Account:** Create another Clinic Admin account. Verify they also receive a setup email.
- [ ] **Remote Kill Switch:** Execute the "Remote Kill Switch" on a responder account from the dashboard. Verify that their account is instantly deactivated/archived.

## 5. Immutable Audit Log
- [ ] **Access the Audit Trail:** Navigate to the Audit Logs view in the dashboard.
- [ ] **Verify Recorded Actions:** Check that the system accurately logged the events you just performed, specifically:
  - Your login attempts (Successes and Failures) along with your IP and Timestamp.
  - The creation and update of the student record.
  - The responder account creation and the execution of the Kill Switch.




DON'T MIND THE CHECKS AND EXES ABOVE FIRST. SOME OF THEM ARE NOT YET TEST. INSTEAD FIX WHAT'S LISTED BELOW

ISSUES / NEEDS TO BE FIXED
1. Time in records doesn't match my actual time
2. Not sending email after editing a student's medical details. Fix this accordingly



## CRITICAL SYSTEM WORKFLOW ERROR:
1. staff account even in read only (in all page) can still click the "add respondent" in the respondant page, though after clicking it then inputting details the system will stop u from finalizing the creation of the user but still the button should not be clicked, since even in the student tab the "add student" cannot be clicked already, it just looks like unpolished
2. As a staff, when I try to update my own credentials (in this specific case password), for some reason the system will say that you do not have access to the respondent module (this time, this is because my admin account didn't give the write permission to the respondent account in the rbac of the admin). Now I tried giving it permission to write in the RBAC of the admin, then as a staff again I tried to change my own credentials but the system says "respondent not found". Which is weird cause in this case I'm not testing as the respondent. but as a staff. Anyways all issue written in this number must be fixed accordingly. ✅
3. As a staff when editing my own personal credentials too (in my case I was trying password again but this should be the same case for all personal credentails) it also says "Responder not found" which is a grave mistake. This should be fixed accordingly. I haven't tested the Responder account since responder can only be tested on mobile, but there might be a similar issue to this.  FIX THIS! ✅


4. In the responder tab after editing a credentials after clicking "save changes", when u click edit again just right after that, the "save changes" button will for some reason be grayed out. and only if u refresh the page again then click edit again then only that will u see the "save changes" button be clickable again. This is also the same case when editing the staff credentials

5. This issue had been brought already above in the ISSUES / NEEDS TO BE FIXED, but upon editing an email





JUST FIX EVERYTHING I LISTED AS AN ISSUE ABOVE FIRST. BELOW IS FOR THE FUTURE


## TO BE IMPLEMENTED IN THE FUTURE:
PRD ERROR (IN THIS ONE WE WILL BE IMPLEMENTING HOSTING FOR THIS TO BE HOSTED PROPERLY )
1. Deactivation Link will not work on the student's side since this system is not hosted online
1. Must choose: 
If want to remain local, no hosting online, then the deactivation link can't be used by the student, but the admin can manually deactivate the student's tag from the dashboard.
if want to host online, there will be a huge fix imlemented such as changing from SQLITE TO POSTGRESQL 