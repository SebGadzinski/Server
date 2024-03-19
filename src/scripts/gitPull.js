/**
 * @file Pulls Server.
 * @author Sebastian Gadzinski
 */

const exec = require('child_process').exec;
const path = require('path');

const projectDir = path.resolve(__dirname, '..', '..');

console.log('Startng script..');
console.log(projectDir);

exec('pm2 delete "Git Pull"', { cwd: projectDir }, () => {
    // Perform git pull
    exec(`pm2 start git --name "Git Pull" --no-autorestart -- pull`, { cwd: projectDir }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
});

