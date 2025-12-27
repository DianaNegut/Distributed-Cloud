/**
 * Job Queue for Provider Agent
 * Manages storage tasks in a sequential queue
 */

const EventEmitter = require('events');

class JobQueue extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.processing = false;
        this.currentJob = null;
        this.completedJobs = [];
        this.failedJobs = [];
    }

    /**
     * Add job to queue
     */
    addJob(job) {
        // Validate job structure
        if (!job.id || !job.type) {
            console.error('❌ Invalid job structure:', job);
            return false;
        }

        // Check for duplicates
        const exists = this.queue.find(j => j.id === job.id);
        if (exists) {
            console.log(`⚠️ Job ${job.id} already in queue, skipping`);
            return false;
        }

        console.log(`📥 Job added: ${job.type} (${job.id})`);
        this.queue.push({
            ...job,
            addedAt: Date.now(),
            status: 'queued'
        });

        this.emit('job_added', job);

        // Start processing if not already
        if (!this.processing) {
            this.processNext();
        }

        return true;
    }

    /**
     * Process next job in queue
     */
    async processNext() {
        if (this.queue.length === 0) {
            this.processing = false;
            console.log('✅ Queue empty, waiting for jobs...');
            return;
        }

        this.processing = true;
        this.currentJob = this.queue.shift();
        this.currentJob.status = 'processing';
        this.currentJob.startedAt = Date.now();

        console.log(`⚙️ Processing job: ${this.currentJob.type} (${this.currentJob.id})`);
        this.emit('job_started', this.currentJob);

        try {
            // Execute job handler
            const result = await this.executeJob(this.currentJob);

            this.currentJob.status = 'completed';
            this.currentJob.completedAt = Date.now();
            this.currentJob.result = result;

            this.completedJobs.push(this.currentJob);

            console.log(`✅ Job completed: ${this.currentJob.id}`);
            this.emit('job_completed', this.currentJob);

        } catch (error) {
            this.currentJob.status = 'failed';
            this.currentJob.completedAt = Date.now();
            this.currentJob.error = error.message;

            this.failedJobs.push(this.currentJob);

            console.error(`❌ Job failed: ${this.currentJob.id}`, error.message);
            this.emit('job_failed', this.currentJob, error);
        }

        // Process next
        const completedJob = this.currentJob;
        this.currentJob = null;

        // Small delay before next job
        setTimeout(() => {
            this.processNext();
        }, 100);

        return completedJob;
    }

    /**
     * Execute job based on type
     */
    async executeJob(job) {
        switch (job.type) {
            case 'pin':
                return await this.handlePinJob(job);

            case 'unpin':
                return await this.handleUnpinJob(job);

            case 'storage_contract':
                return await this.handleStorageJob(job);

            default:
                throw new Error(`Unknown job type: ${job.type}`);
        }
    }

    /**
     * Handle pin job
     */
    async handlePinJob(job) {
        const { cid, contractId } = job.data;

        // Emit to IPFSManager (will be handled by AgentCore)
        this.emit('execute_pin', { cid, contractId, jobId: job.id });

        // Wait for completion
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Pin job timeout (5 minutes)'));
            }, 300000); // 5 minutes

            this.once(`pin_complete_${cid}`, (result) => {
                clearTimeout(timeout);
                resolve(result);
            });

            this.once(`pin_failed_${cid}`, (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Handle unpin job
     */
    async handleUnpinJob(job) {
        const { cid } = job.data;

        this.emit('execute_unpin', { cid, jobId: job.id });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Unpin job timeout (1 minute)'));
            }, 60000);

            this.once(`unpin_complete_${cid}`, (result) => {
                clearTimeout(timeout);
                resolve(result);
            });

            this.once(`unpin_failed_${cid}`, (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Handle storage contract job
     */
    async handleStorageJob(job) {
        const { contractId, storageGB, duration } = job.data;

        this.emit('execute_storage_contract', {
            contractId,
            storageGB,
            duration,
            jobId: job.id
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Storage contract job timeout (10 minutes)'));
            }, 600000);

            this.once(`contract_complete_${contractId}`, (result) => {
                clearTimeout(timeout);
                resolve(result);
            });

            this.once(`contract_failed_${contractId}`, (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            processing: this.processing,
            currentJob: this.currentJob ? {
                id: this.currentJob.id,
                type: this.currentJob.type,
                status: this.currentJob.status,
                startedAt: this.currentJob.startedAt
            } : null,
            completedCount: this.completedJobs.length,
            failedCount: this.failedJobs.length
        };
    }

    /**
     * Clear completed jobs history
     */
    clearHistory() {
        const count = this.completedJobs.length + this.failedJobs.length;
        this.completedJobs = [];
        this.failedJobs = [];
        console.log(`🗑️ Cleared ${count} jobs from history`);
    }

    /**
     * Get job by ID
     */
    getJob(jobId) {
        // Check current job
        if (this.currentJob && this.currentJob.id === jobId) {
            return this.currentJob;
        }

        // Check queue
        const queued = this.queue.find(j => j.id === jobId);
        if (queued) return queued;

        // Check completed
        const completed = this.completedJobs.find(j => j.id === jobId);
        if (completed) return completed;

        // Check failed
        const failed = this.failedJobs.find(j => j.id === jobId);
        if (failed) return failed;

        return null;
    }
}

module.exports = JobQueue;
