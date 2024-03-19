# Fill this folder with:

## firebase.json

- Used for notifications
- This is a file pulled from the firebase project website => Project Settings => Service Accounts => Generate new private key
- Please fill out the fields with the correct info

```
{
  "type": "service_account",
  "project_id": "company-00000",
  "private_key_id": "id",
  "private_key": "-----BEGIN PRIVATE KEY-----\ a private key -----END PRIVATE KEY-----\n",
  "client_email": "service account ",
  "client_id": "id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "link",
  "universe_domain": "googleapis.com"
}
```

## sendgrid.json

- Used for sending emails
- Ensure that all emails are verified via sendgrid and can send from the connected sendgrid account
- Make sure you make all dynamic templates on sendgrid
  - Check out the EmailService.ts file to see what variables you are working with

```
{
  "apiKey": "SG.xxxxxxxx",
  "email": {
    "alert": "alert@example.com",
    "noReply": "no.reply@example.com",
    "support": "support@example.com"
  },
  "confirmation": {
    "template": "d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "subject": "Confirm Your Email",
    "headerMessage": "Please Confirm Your Email",
    "btnMessage": "Confirm",
    "btnLink": "/confirm?token="
  },
  "resetPassword": {
    "template": "d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "subject": "Password Reset Request",
    "headerMessage": "Reset Your Password",
    "btnMessage": "Reset Password",
    "btnLink": "/reset-password?token="
  },
  "alert": {
    "template": "d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "subject": "Important Alert"
  },
  "notification": {
    "template": "d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "subject": "New Notification"
  },
  "receipt": {
    "template": "d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "subject": "Your Receipt"
  }
}
```

## zoom.json

- Used for creating zoom meetings
- You need to make a zoom app on the marketplace and get this information
- Please fill out the fields with the correct info

```
{
  "accountId": "<YOUR_ACCOUNT_ID>",
  "clientId": "<YOUR_CLIENT_ID>",
  "clientSecret": "<YOUR_CLIENT_SECRET>"
}
```
