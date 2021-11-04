const {replacer, reviver} = require('../utils/mapUtils');

class SimulationSettings {
    /**
     * Returns a SimulationSettings object supplied with accuracy (between 0 and 1),
     * headshot percentage (between 0 and 1), and the number of iterations.
     * @param {number} accuracy
     * @param {number} headshot
     * @param {number} numIterations
     * @param {number} maxSimulationDuration
     * @param {boolean} isMaximizeSimulation
     */
    constructor(accuracy, headshot, numIterations, maxSimulationDuration=999999, isMaximizeSimulation=false) {
        this.accuracy_ = accuracy;
        this.headshot_ = headshot;
        this.numIterations_ = numIterations;
        this.maxSimulationDuration_ = maxSimulationDuration;
        this.isMaximizeSimulation_ = isMaximizeSimulation;
    }

    /**
     * Convert SimulationSettings object into JSON string.
     * @returns {string}
     */
    serialize() {
        return JSON.stringify(this, replacer);
    }

    /**
     * Convert JSON object string into object with SimulationSettings prototype.
     * @param {string} object
     * @returns {SimulationSettings}
     */
    static deserialize(object) {
        let plainObject = JSON.parse(object, reviver);
        return Object.setPrototypeOf(plainObject, SimulationSettings.prototype)
    }

    /**
     * @returns {number}
     */
    getAccuracy() {
        return this.accuracy_;
    }

    /**
     * @returns {number}
     */
    getHeadshotChance() {
        return this.headshot_;
    }

    /**
     * @returns {number}
     */
    getNumIterations() {
        return this.numIterations_;
    }

    /**
     * @returns {number}
     */
    getMaxSimulationDuration() {
        return this.maxSimulationDuration_;
    }

    /**
     * @returns {boolean}
     */
    isMaximizeSimulation() {
        return this.isMaximizeSimulation_;
    }

    setNumIterations(numIterations) {
        this.numIterations_ = numIterations;
        return this;
    }

}

module.exports = {
    SimulationSettings
}