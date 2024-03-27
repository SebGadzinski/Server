/**
 * @file Updates Front End Client.
 * @author Sebastian Gadzinski
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = path.resolve(__dirname, '..', '..', '..', 'Client-Updater', 'Client');
const env = process.platform === 'win32' ? 'dev' : 'prod';

console.log('Starting script..');
console.log(projectDir);

try {
    // Pull latest changes from Git
    execSync('/usr/bin/git pull', { cwd: projectDir, stdio: 'inherit', shell: true });
    console.log('Git pull completed.');

    // Pull latest changes from Git
    execSync('sudo ./prod-install.sh', { cwd: projectDir, stdio: 'inherit', shell: true });
    console.log('Client updated.');
} catch (error) {
    console.error('An error occurred:', error);
}
