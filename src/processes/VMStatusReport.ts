/**
 * @author Sebastian Gadzinski
 */

import { DateTime } from 'luxon';
import mongoose from 'mongoose';
import os from 'os';
import pm2 from 'pm2';
import util from 'util';
import config, { c } from '../config';
import { VMStatusReport } from '../models';
import { IVMStatus, IVMStatusReport } from '../models/VMStatusReport';
import EmailService from '../services/EmailService';
import CronProcess from './_CronProcess';

// Promisify pm2 methods
const connectToPM2Async = util.promisify(pm2.connect.bind(pm2));
const listPM2ProcessesAsync = util.promisify(pm2.list.bind(pm2));
const disconnectPM2Async = util.promisify(pm2.disconnect.bind(pm2));

class VMStatus extends CronProcess {
    private readonly ALERT_EMAIL_SEND_INTERVAL_HOURS = 1;
    private state = new VMStatusReport({
        _id: new mongoose.Types.ObjectId(),
        database: { status: [], details: [] }, // Assuming status should be an array
        pm2: { status: [], processes: [] },
        system: { status: [], details: [] }, // Corrected to array
        status: [{ name: 'new', severity: 'none', info: 'Booting up I guess?', date: new Date() }],
    });

    constructor() {
        super('VMStatus', {
            func: () => this.vmStatusCode(),
            interval: '0 */1 * * * *',
        }, {
            connectToDb: true,
            startMessage: 'VM Status Running...'
        });
    }

    private async vmStatusCode() {
        const vmStatusReport = await VMStatusReport.findById(this.state._id);
        if (!vmStatusReport) {
            this.state.save();
        } else {
            this.state = vmStatusReport;
        }

        this.state.status = [];

        // Database Connectivity Check
        try {
            if (!mongoose.connection.readyState) {
                await mongoose.connect(config.db.uri);
            }
        } catch (err) {
            this.state.database.status.push({
                name: 'database offline',
                severity: c.SEVERITY.CRITICAL,
                info: 'MongoDB connection failed.',
                date: new Date()
            });

            await this.sendErrorEmail(err, 'MongoDB Connection Failed');
        }

        // PM2 Process Check
        try {
            await connectToPM2Async();
            const pm2Processes = await listPM2ProcessesAsync();
            this.state.pm2.processes = [];

            for (const process of pm2Processes) {
                const status: IVMStatus[] = [];

                // Default PM2 process data contains valuable info for determining process health
                const { name, pm2_env } = process;
                // Extract necessary information from pm2_env
                const { status: pm2Status, unstable_restarts, axm_monitor } = pm2_env;
                const heapUsagePercent = axm_monitor['Heap Usage']?.value || 0;
                const eventLoopLatencyP95 = axm_monitor['Event Loop Latency p95']?.value || 0;
                const eventLoopLatencyP50 = axm_monitor['Event Loop Latency']?.value || 0;
                const activeHandles = axm_monitor['Active handles']?.value || 0;
                const activeRequests = axm_monitor['Active requests']?.value || 0;

                // Check if fixing is needed (e.g., process not online)
                if (pm2Status !== 'online') {
                    status.push({
                        name: 'offline',
                        severity: c.SEVERITY.CRITICAL,
                        info: 'not online.',
                        date: new Date()
                    });
                }

                // Heap usage warning
                if (heapUsagePercent > 80) { // Warning if heap usage exceeds 80%
                    status.push({
                        name: 'high heap usage',
                        severity: c.SEVERITY.WARNING,
                        info: `Heap usage is high at ${heapUsagePercent}%.`,
                        date: new Date()
                    });
                }

                // Event Loop Latency warnings
                if (eventLoopLatencyP95 > 1000) { // Example: Warning if 95th percentile latency is over 1000ms
                    status.push({
                        name: 'high event loop latency (p95)',
                        severity: c.SEVERITY.WARNING,
                        info: `Event loop latency (p95) is high at ${eventLoopLatencyP95} ms.`,
                        date: new Date()
                    });
                }

                if (eventLoopLatencyP50 > 500) { // Example: Warning if median latency is over 500ms
                    status.push({
                        name: 'high event loop latency (p50)',
                        severity: c.SEVERITY.WARNING,
                        info: `Event loop latency (median) is high at ${eventLoopLatencyP50} ms.`,
                        date: new Date()
                    });
                }

                // Unstable restarts check
                if (unstable_restarts > 5) {
                    status.push({
                        name: 'unstable restarts',
                        severity: c.SEVERITY.WARNING,
                        info: `Unstable restarts detected. Count: ${unstable_restarts}.`,
                        date: new Date()
                    });
                }

                // Active handles and requests can provide insight into
                // the load and concurrency level of the application
                // Adjust the thresholds based on typical behavior and capacity
                if (activeHandles > 100) { // Example threshold, adjust based on your application's normal operation
                    status.push({
                        name: 'high active handles',
                        severity: c.SEVERITY.NOTICE,
                        info: `Number of active handles is high at ${activeHandles}.`,
                        date: new Date()
                    });
                }

                if (activeRequests > 50) { // Example threshold, adjust based on your application's normal operation
                    status.push({
                        name: 'high active requests',
                        severity: c.SEVERITY.NOTICE,
                        info: `Number of active requests is high at ${activeRequests}.`,
                        date: new Date()
                    });
                }

                // Warning if there are many restarts indicating instability
                if (unstable_restarts > 5) {
                    status.push({
                        name: 'unstable restarts',
                        severity: c.SEVERITY.CRITICAL,
                        info: `unstable restarts warning (${unstable_restarts})`,
                        date: new Date()
                    });
                }

                // Assuming you have a structure to hold process information
                this.state.pm2.processes.push({
                    name,
                    date: new Date(), // Current date for the report entry
                    status
                });
            }

            if (pm2Processes.length === 0) {
                this.state.pm2.status = [{
                    name: 'No processes running',
                    severity: c.SEVERITY.CRITICAL,
                    info: 'Cannot find processes',
                    date: new Date()
                }];
            } else if (this.state.pm2.processes.some((x) => x.status.some((y) => y.severity === c.SEVERITY.CRITICAL))) {
                this.state.pm2.status = [{
                    name: 'Process Error',
                    severity: c.SEVERITY.CRITICAL,
                    info: 'A process is having issues',
                    date: new Date()
                }];
            }
        } catch (err) {
            console.error(err);
            this.state.pm2.status = [{
                name: 'error',
                severity: c.SEVERITY.CRITICAL,
                info: 'pm2 cannot connect',
                date: new Date()
            }];
        } finally {
            await disconnectPM2Async();
        }

        // System Health Checks (CPU, Memory)
        this.state.system.status = [];
        const freeMemoryPercentage = (os.freemem() / os.totalmem()) * 100;
        if (freeMemoryPercentage < 10) { // Example threshold
            this.state.system.status = [{
                name: 'memory low',
                severity: c.SEVERITY.CRITICAL,
                info: 'Low system memory',
                date: new Date()
            }];
        }

        const loadAverage = os.loadavg()[0]; // 1-minute average
        if (loadAverage > os.cpus().length) { // Threshold could be number of CPUs
            this.state.system.status = [{
                name: 'cpu overload',
                severity: c.SEVERITY.CRITICAL,
                info: `High CPU load. load: ${loadAverage} vs cpus: ${os.cpus().length}`,
                date: new Date()
            }];
        }

        // Consolidate and send reports if there are warnings or errors
        const canSendDate = DateTime.local().minus({ hours: this.ALERT_EMAIL_SEND_INTERVAL_HOURS }).toJSDate();
        const canSend = (!this.state?.lastAlertEmailSent || canSendDate > this.state.lastAlertEmailSent);
        if ([this.state.database, this.state.pm2, this.state.system]
            .some((x) => x.status.filter((y) => y.severity === c.SEVERITY.CRITICAL).length > 0) &&
            canSend) {
            // const reportDetails = this.formatReportDetails(this.state);
            // await this.sendErrorEmail(new Error('VM Status Check: Issues Detected'), reportDetails);
            this.state.lastAlertEmailSent = new Date();
        }

        try {
            this.state.save();
        } catch (Err) {
            console.log(Err);
        }
    }

    private formatReportDetails(state: IVMStatusReport): string {
        const formatDate = (date: Date) => new Date(date).toLocaleString();

        // Function to generate HTML for each status section
        const generateStatusHTML = (status: IVMStatus[]) => {
            return status.map((s) => `
                <div style="margin-bottom: 10px; padding-left: 10px; border-left: 2px solid #333;">
                    <p><b>Name:</b> <span>${s.name}</span></p>
                    <p><b>Severity:</b> <span>${s.severity}</span></p>
                    <p><b>Info:</b> <span>${s.info}</span></p>
                    <p><b>Date:</b> <span>${formatDate(s.date)}</span></p>
                </div>
            `).join('');
        };

        // Assembling the report
        const html = `
            <div style="font-family: Arial, sans-serif;">
                <h2 style="background-color: #f2f2f2; padding: 5px;">Database Status</h2>
                <div>${generateStatusHTML(state.database.status)}</div>

                <h2 style="background-color: #f2f2f2; padding: 5px;">PM2 Status</h2>
                <div>${generateStatusHTML(state.pm2.status)}</div>

                <h2 style="background-color: #f2f2f2; padding: 5px;">PM2 Processes</h2>
                ${state.pm2.processes.map((process) => `
                    <div style="margin-bottom: 15px;">
                        <h3 style="padding-left: 5px; border-left: 3px solid #4CAF50;">Process Name: ${process.name}</h3>
                        <p style="padding-left: 5px;"><b>Date:</b> ${formatDate(process.date)}</p>
                        <div>${generateStatusHTML(process.status)}</div>
                    </div>
                `).join('')}

                <h2 style="background-color: #f2f2f2; padding: 5px;">System Status</h2>
                <div>${generateStatusHTML(state.system.status)}</div>

                <h2 style="background-color: #f2f2f2; padding: 5px;">General Status</h2>
                <div>${generateStatusHTML(state.status)}</div>

                ${state.lastAlertEmailSent ? `<p><b>Last Alert Email Sent:</b> ${formatDate(state.lastAlertEmailSent)}</p>` : ''}
            </div>
        `;

        return html;
    }

    private async sendErrorEmail(err: Error, info: string) {
        const alertBody = `<div>${info}</div>`;
        await EmailService.sendAlertEmail(config.sendGrid.email.alert, 'VM Status Alert', alertBody);
    }
}

const vmStatus = new VMStatus();
vmStatus.run();
