class SimulationSettings {
    /**
     * Returns a SimulationSettings object supplied with accuracy (between 0 and 1),
     * headshot percentage (between 0 and 1), and the number of iterations.
     * @param {number} accuracy
     * @param {number} headshot
     * @param {number} numIterations
     */
    constructor(accuracy, headshot, numIterations) {
        this.accuracy = accuracy;
        this.headshot = headshot;
        this.numIterations = numIterations;
    }

    /**
     * Convert SimulationSettings object into JSON string.
     * @returns {string}
     */
    toObject() {
        return JSON.stringify(this);
    }

    /**
     * Convert JSON object string into object with SimulationSettings prototype.
     * @param {string} object
     * @returns {SimulationSettings}
     */
    static fromObject(object) {
        let plainObject = JSON.parse(object);
        return Object.setPrototypeOf(plainObject, SimulationSettings.prototype)
    }

}

module.exports = {
    SimulationSettings
}