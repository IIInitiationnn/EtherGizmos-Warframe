class Metrics {
    constructor() {
        this.killTime = 0;
        this.shotsFired = 0;
        this.pelletsFired = 0;
        this.hits = 0;
        this.headshots = 0;
        this.headCrits = 0;
        this.reloads = 0;
    }

    getKillTime() {
        return this.killTime;
    }

    setKillTime(value) {
        this.killTime = value;
        return this;
    }

    getShotsFired() {
        return this.shotsFired;
    }

    addShotsFired(shotsFired) {
        this.shotsFired += shotsFired;
        return this;
    }

    setShotsFired(shotsFired) {
        this.shotsFired = shotsFired;
        return this;
    }

    getPelletsFired() {
        return this.pelletsFired;
    }

    setPelletsFired(pelletsFired) {
        this.pelletsFired = pelletsFired;
        return this;
    }

    getHits() {
        return this.hits;
    }

    setHits(hits) {
        this.hits = hits;
        return this;
    }

    getHeadshots() {
        return this.headshots;
    }

    setHeadshots(headshots) {
        this.headshots = headshots;
        return this;
    }

    getHeadCrits() {
        return this.headCrits;
    }

    setHeadCrits(headCrits) {
        this.headCrits = headCrits;
        return this;
    }

    getReloads() {
        return this.reloads;
    }

    setReloads(reloads) {
        this.reloads = reloads;
        return this;
    }

    /**
     *
     * @param {Metrics[]} metrics - List of all metrics to find average kill time of.
     * @returns {number} - Average kill time.
     */
    static meanKillTime(metrics) {
        let total = 0;
        for (let metric of metrics) total += metric.killTime;
        return total / metrics.length;
    }

}

module.exports = {
    Metrics
}