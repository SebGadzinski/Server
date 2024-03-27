/**
 * @file Runs scrips and processes on virtual machine (server)
 * @author Sebastian Gadzinski
 */

import { spawn } from 'child_process';
import path from 'path';
import Result from '../classes/Result';

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
}

export default new VMController();
