# Gadzy Work Server

Server for Gadzy Work. This application hooks up to the /Client Repo.

## Uses

- Freelancing Management API
- Outsourcing Management API
- Work Management API

## Before Running

### Mongo DB

You need to have mongo db installed on your server. If you are running this on linux you will need to update the .env.dev MONGO_DB env to go to port 27017 instead of 27019.

### Server

1. Navigate to a folder that you would like the server inside.
2. [git clone](https://github.com/SebGadzinski/Server.git)
3. cd Server
4. Make a .env file and .env.dev | staging | prod
   - Below are all possible env variables
5. npm install

#### Configs

6. Make sure you have your configuration set up.

All files must be in /src/config

- ./firebase.json
- ./sendGrid.json
- ./zoom.json
- View the readme inside /src/configs to view how they are to look.

/db

- ./categories.json
- ./template.json
- ./user.json
- ./workers.json

##### For more information on configuring your server or if you have any questions regarding the setup, please feel free to contact the developer team. We're here to help you get started smoothly. For a cost of course...

Edit the StripeService file to attach to your stripe account.

#### Env Variables

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
| SSL_CERT_PATH             | Path to SSL certificate               | Production |
| ACCEPTING_WORK            | Accepting new work requests           | No         |
| SEND_EMAIL_STATUS         | Accepting new work requests           | No         |

#### Run

7. npm database-seeder:dev
   - T
8. npm run server:dev | prod | staging

#### pm2

If you want to run this via pm2 ensure to install pm2 globally.

1. npm i pm2 -g
2. pm2 start ecosystem.config.js --env development | staging | production

## Help

This project can be improved alot. If you have any ideas or want to contribute, please feel free to contact the developer team.
