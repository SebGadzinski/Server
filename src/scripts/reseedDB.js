/**
 * @file Reseeds Database.
 * @author Sebastian Gadzinski
 */

const exec = require('child_process').exec;
const path = require('path');

const projectDir = path.resolve(__dirname, '..', '..');
const env = process.platform === 'win32' ? 'dev' : 'prod';

console.log('Startng script..');
console.log(projectDir);
exec('pm2 delete "Database Seeder"', { cwd: projectDir }, () => {
    // Perform git pull
    exec(`pm2 start npm --name "Database Seeder" --no-autorestart -- run node:database-seeder:${env}`, { cwd: projectDir }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
});

