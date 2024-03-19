# Gadzy Work Server

Server for Gadzy Work. This application hooks up to the /Client Repo.

## Uses

- Freelancing Management API
- Outsourcing Management API
- Work Management API

## Before Running

1. Navigate to a folder that you would like the server inside.
2. [git clone](https://github.com/SebGadzinski/Server.git)
3. cd Server
4. Make a .env file and .env.dev | staging | prod
   - Below are all possible env variables
5. npm install

### Configs

6. Make sure you have your configuration set up.

All files must be in /src/config

- ./firebase.json
- ./sendGrid.json
- ./zoom.json
- View the readme inside the folder to view how they are to look.

/db

- ./categories.json
- ./template.json
- ./user.json
- ./workers.json

<small>For more information on configuring your server or if you have any questions regarding the setup, please feel free to contact the developer team. We're here to help you get started smoothly. For a cost of course...</small>

Edit the StripeService file to attach to your stripe account.

## Env Variables

| Name                      | Meaning                               | Required   |
| ------------------------- | ------------------------------------- | ---------- |
| NODE_ENV                  | Running env                           | Yes        |
| MONGO_DB                  | Mongo DB Connection String            | Yes        |
| PORT                      | What port this server is listening on | Yes        |
| SALT_ROUNDS               | Salt rounds for hashing               | Yes        |
| SECRET                    | Secret key for JWT acess token        | Yes        |
| REFRESH_SECRET            | Secret key for JWT refresh token      | Yes        |
| TOKEN_EXPIRY_SECONDS      | Expiry time for token in seconds      | Yes        |
| REFRESH_TOKEN_EXPIRY_DAYS | Expiry time for refresh token in days | Yes        |
| COMPANY                   | Company name                          | Yes        |
| DOMAIN                    | Server domain                         | Yes        |
| FRONT_END_DOMAIN          | Front-end domain                      | Yes        |
| APP_VERSION_DIRECTORY     | Directory for app versions            | Yes        |
| DOWNLOAD_APP_ENDPOINT     | Endpoint for downloading app versions | Yes        |
| STRIPE_SK_CATEGORY        | Stripe secret key for your category   | Yes        |
| SEND_EMAIL_STATUS         | Status of email sending feature       | No         |
| SSL_KEY_PATH              | Path to SSL key                       | Production |
| SSL_CERT_PATH             | Path to SSL certificate               | Yes        |
| ACCEPTING_WORK            | Accepting new work requests           | No         |
| SEND_EMAIL_STATUS         | Accepting new work requests           | No         |

## Run

7. npm database-seeder:dev
8. npm run server:dev | prod | staging

## Help

This project can be improved alot. If you have any ideas or want to contribute, please feel free to contact the developer team.
