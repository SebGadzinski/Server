// TODO: If this is linux change to npm.exe location
let npm = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";

const processes = [
    {
        "script": npm,
        "args": "run pm2:server",
        "name": "server",
        "wait_ready": true,
        "watch": true,
        "env_development": {
            "NODE_ENV": "development"
        },
        "env_production": {
            "NODE_ENV": "prod"
        },
        "env_testing": {
            "NODE_ENV": "test"
        },
        "error_file": "~/logs/server.err.log",
        "out_file": "~/logs/server.out.log"
    },
    {
        "script": npm,
        "args": "run pm2:database",
        "name": "database",
        "wait_ready": true,
        "watch": true,
        "env_development": {
            "NODE_ENV": "development"
        },
        "env_production": {
            "NODE_ENV": "production"
        },
        "env_testing": {
            "NODE_ENV": "testing"
        },
        "error_file": "~/logs/database.err.log",
        "out_file": "~/logs/database.out.log"
    },
]

module.exports = processes;

