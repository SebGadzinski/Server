// TODO: If this is linux change to npm.exe location
const os = require('os');

let npm;
let env;
const ignore_watch = {}

if(os.platform().includes("win")){
    npm ="C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";
    env = 'dev';
    ignore_watch.all = ["C:/WorkTemp/Projects/Work Website/Server/src/configs/db"];
}
else{
    npm = "npm";
    env = 'prod';
    ignore_watch.all = ["/home/www-node/GadzyWorks/Server/src/configs/db"];
}

const processes = [
    {
        "script": npm,
        "args": `run pm2:server:${env}`,
        "name": "Server",
        "wait_ready": true,
        "watch": true,
        "env_development": {
            "NODE_ENV": "development"
        },
        "env_production": {
            "NODE_ENV": "production"
        },
        "env_testing": {
            "NODE_ENV": "test"
        },
        "error_file": "~/logs/server.err.log",
        "out_file": "~/logs/server.out.log"
    },
    {
        "script": npm,
        "args": `run pm2:database-cleaner:${env}`,
        "name": "Database Cleaner",
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
        "error_file": "~/logs/database-cleaner.err.log",
        "out_file": "~/logs/database-cleaner.out.log"
    },
    {
        "script": npm,
        "args": `run pm2:reminders:${env}`,
        "name": "Reminders",
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
        "error_file": "~/logs/reminders.err.log",
        "out_file": "~/logs/reminders.out.log"
    },
    {
        "script": npm,
        "args": `run pm2:sub-payments:${env}`,
        "name": "Subscription Payments",
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
        "error_file": "~/logs/sub-payments.err.log",
        "out_file": "~/logs/sub-payments.out.log"
    },
    {
        "script": npm,
        "args": `run pm2:class-maintence:${env}`,
        "name": "Class Maintence",
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
        "error_file": "~/logs/class-maintence.err.log",
        "out_file": "~/logs/class-maintence.out.log"
    },
    {
        "script": npm,
        "args": `run pm2:vm-status-report:${env}`,
        "name": "VM Status Reporter",
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
        "error_file": "~/logs/vm-status-report.err.log",
        "out_file": "~/logs/vm-status-report.out.log"
    },
]

for(const process of processes){
    if(!process.ignore_watch){
        process.ignore_watch = ignore_watch.all;
    }
    else{
        process.ignore_watch.push(...ignore_watch.all);
        // You can add custom ones here
    }
}

module.exports = processes;

