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
    execSync('git pull', { cwd: projectDir });
    console.log('Git pull completed.');

    // Build the project
    execSync('npm run build-www', { cwd: projectDir }); // Assuming 'npm run build' is the correct command
    console.log('Project build completed.');

    // Assuming you want to move files from a directory named ClientUpdater inside projectDir to a directory named Client
    const sourceDir = path.resolve(projectDir, 'src-capacitor', 'www');
    // Define the destination directory (two levels up from projectDir, then into 'Client')
    const destinationDir = path.resolve(projectDir, '..', '..', 'Client');

    // Copy the files from sourceDir to destinationDir
    try {
        console.log(`Copying: ${sourceDir}`);
        console.log(`Moving To: ${destinationDir}`);
        execSync(`cp -Rf "${sourceDir}/." "${destinationDir}/"`, { cwd: projectDir });
        console.log('Files have been copied.');
    } catch (error) {
        console.error('An error occurred while copying files:', error);
    }

} catch (error) {
    console.error('An error occurred:', error);
}
