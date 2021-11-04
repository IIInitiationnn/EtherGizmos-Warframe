const {BuildUtils} = require('../utils/buildUtils');

class Metrics {
    constructor() {
        /** @private {number} */
        this.killTime_ = 0;

        /** @private {number} */
        this.shotsFired_ = 0;

        /** @private {number} */
        this.shotsLanded_ = 0;

        /** @private {number} */
        this.pelletsFired_ = 0;

        /** @private {number} */
        this.pelletsLanded_ = 0;

        /** @private {number} */
        this.headshots_ = 0;

        /** @private {number} */
        this.headCrits_ = 0;

        /** @private {number} */
        this.reloads_ = 0;

        /** @private {number[]} - See DamageType */
        this.procs_ = [];
    }

    /**
     * @returns {number}
     */
    getKillTime() {
        return this.killTime_;
    }

    getShotsFired() {
        return this.shotsFired_;
    }

    getShotsLanded() {
        return this.shotsLanded_;
    }

    getPelletsFired() {
        return this.pelletsFired_;
    }

    getPelletsLanded() {
        return this.pelletsLanded_;
    }

    getHeadshots() {
        return this.headshots_;
    }

    getHeadCrits() {
        return this.headCrits_;
    }

    getReloads() {
        return this.reloads_;
    }

    setKillTime(killTime) {
        this.killTime_ = killTime;
        return this;
    }

    addShotsFired(shotsFired) {
        this.shotsFired_ += shotsFired;
        return this;
    }

    addShotsLanded(shotsLanded) {
        this.shotsLanded_ += shotsLanded;
        return this;
    }

    addPelletsFired(pelletsFired) {
        this.pelletsFired_ += pelletsFired;
        return this;
    }

    addPelletsLanded(pelletsLanded) {
        this.pelletsLanded_ += pelletsLanded;
        return this;
    }

    addHeadshots(headshots) {
        this.headshots_ += headshots;
        return this;
    }

    addHeadCrits(headCrits) {
        this.headCrits_ += headCrits;
        return this;
    }

    addReload() {
        this.reloads_ += 1;
        return this;
    }

    /**
     * @param {Proc[]} procs
     * @returns {Metrics}
     */
    addProcs(procs) {
        for (let proc of procs) {
            this.procs_.push(proc.getType());
        }
        return this;
    }

    /**
     *
     * @param {Metrics[]} metrics - List of all metrics to find average kill time of.
     * @returns {number} - Average kill time.
     */
    static meanKillTime(metrics) {
        return BuildUtils.average(metrics.map(metric => metric.getKillTime()));
    }

}

module.exports = {
    Metrics
}