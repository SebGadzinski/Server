/**
 * @file Runs scrips and processes on virtual machine (server)
 * @author Sebastian Gadzinski
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import Result from '../classes/Result';
import { Config } from '../models';

class VMController {
    public reseedDB(req: any, res: any) {
        res.send(new Result({ success: true }));

        const projectDir = path.resolve(__dirname, '..');
        const scriptPath = path.resolve(projectDir, 'scripts', 'reseedDB.js');

        // Spawn the update and seed script in a detached process
        const updateProcess = spawn('node', [scriptPath], { detached: true, stdio: 'ignore' });
        updateProcess.unref();
    }
    public gitPull(req: any, res: any) {
        res.send(new Result({ success: true }));

        const projectDir = path.resolve(__dirname, '..');
        const scriptPath = path.resolve(projectDir, 'scripts', 'gitPull.js');

        // Spawn the update and seed script in a detached process
        const updateProcess = spawn('node', [scriptPath], { detached: true, stdio: 'ignore' });
        updateProcess.unref();
    }
    public updateClient(req: any, res: any) {
        try {
            const projectDir = path.resolve(__dirname, '..');
            const scriptPath = path.resolve(projectDir, 'scripts', 'updateClient.js');

            // TODO: Causing crash
            const updateProcess = spawn('node', [scriptPath], { detached: true, stdio: 'inherit' });
            updateProcess.unref();
            updateProcess.on('error', (err) => {
                console.error('Failed to start subprocess.', err);
            });
            updateProcess.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });

            updateProcess.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
            });
        } catch (err) {
            console.log(err);
        }

        res.send(new Result({ success: true }));
    }
}

export default new VMController();
