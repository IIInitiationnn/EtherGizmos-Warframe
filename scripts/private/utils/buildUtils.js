const {SIMULATION} = require('./magicTypes');
const {replacer} = require('./mapUtils');

class BuildUtils {
    /**
     * @param {any[]} list
     * @returns {number}
     */
    static average(list) {
        return list.reduce((a, b) => (a + b)) / list.length;
    }

    /**
     * Pseudo-hashes the build of the weapon to a string.
     * @param {WeaponInstance} weaponInstance
     * @returns {string}
     */
    static toHashString(weaponInstance) {
        return JSON.stringify(weaponInstance.getOnlyModdedStats()) + JSON.stringify(weaponInstance.getDamage(), replacer);
    }

    /**
     * Whether or not two builds are the same (same mods and equivalent order i.e. elemental combination is preserved).
     * @param {WeaponInstance} weaponInstanceA
     * @param {WeaponInstance} weaponInstanceB
     * @returns {boolean}
     */
    static equals(weaponInstanceA, weaponInstanceB) {
        return BuildUtils.toHashString(weaponInstanceA) === BuildUtils.toHashString(weaponInstanceB);
    }

    /**
     * Given a list of mods, returns a string describes all mods by IDs and ranks.
     * @param {ModInstance[]} modInstances
     * @returns {string} - String describing the mods
     */
    static toBuildString(modInstances) {
        let build = '';
        for (let modInstance of modInstances) {
            build = build.concat('    - ', modInstance.getMod().getId(), ' (rank ', modInstance.getRank().toString(), ')\n');
        }
        return build;
    }
}

class Results {
    static BUILD_STRING_ = 0;
    static KILL_TIMES_ = 1;
    static TOO_SLOW_TIME = 50;

    constructor() {
        /** @type {Map<string, [string, number[]]>} - HashString: [String, KillTimes] */
        this.results_ = new Map();
    }

    /**
     * @param {WeaponInstance} weaponInstance
     * @param {number[]} killTimes
     * @returns {number} - The average kill time for this build.
     */
    addResult(weaponInstance, killTimes) {
        let hashString = BuildUtils.toHashString(weaponInstance);

        let result = this.results_.get(hashString);

        let buildString;
        let existingKillTimes;

        if (result !== undefined) {
            buildString = this.results_.get(hashString)[Results.BUILD_STRING_];
            existingKillTimes = this.results_.get(hashString)[Results.KILL_TIMES_];
        } else {
            buildString = BuildUtils.toBuildString(weaponInstance.getMods());
            existingKillTimes = [];
        }

        existingKillTimes.push(...killTimes);
        this.results_.set(hashString, [buildString, existingKillTimes]);
        return BuildUtils.average(existingKillTimes);
    }

    /**
     * Determines if the build needs additional rounds to reach the target number of iterations.
     * @param {WeaponInstance} weaponInstance
     * @param {number} targetNumIterations
     * @returns {number}
     */
    iterationsNeeded(weaponInstance, targetNumIterations) {
        let result = this.results_.get(BuildUtils.toHashString(weaponInstance));
        if (result === undefined) return targetNumIterations; // no results for this build yet
        let existingKillTimes = result[Results.KILL_TIMES_];

        // Not enough results
        if (existingKillTimes.length < targetNumIterations) {
            let averageKillTime = BuildUtils.average(existingKillTimes);

            // Slow kill time, return the number of iterations needed to reach SLOW_ITERATIONS iterations total
            if (averageKillTime > SIMULATION.SLOW_KILL_TIME) {
                return Math.max(SIMULATION.SLOW_ITERATIONS - existingKillTimes.length, 0);
            }

            // Fast kill time, return the number of target iterations
            return targetNumIterations - existingKillTimes.length;
        }

        // Enough results
        return 0;
    }

    printBest(text) {
        let print = Array.from(this.results_.values())
            .sort((a, b) => BuildUtils.average(a[Results.KILL_TIMES_]) - BuildUtils.average(b[Results.KILL_TIMES_]))
            .slice(0, 5)
            .map(a => [a[Results.BUILD_STRING_] + '    - average: ' + BuildUtils.average(a[Results.KILL_TIMES_])])
            .join('\n\n');
        console.log(text + '\n' + print + '\n\n');
    }

}

module.exports = {
    BuildUtils,
    Results
}