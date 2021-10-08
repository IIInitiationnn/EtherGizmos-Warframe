const {Proc} = require('../classes/proc');

class SimulationUtils {

    /**
     *
     * @param {number} chance - Chance of event occurring.
     * @returns {boolean} - Whether or not the event occurred.
     */
    static randomChance(chance) {
        return chance >= 1 || (chance > 0 && Math.random() < chance);
    }

    /**
     * Generate a list of damage instances without considering enemy resistances.
     * These are used to calculate status procs.
     * @param simulationSettings {SimulationSettings}
     * @param weaponInstance {WeaponInstance}
     * @param enemyInstance {EnemyInstance}
     * @param weaponDamageDistribution {WeaponDamageDistribution}
     * @returns {WeaponDamageDistribution[]}
     */
    static shotDamageInstances(simulationSettings, weaponInstance, enemyInstance, weaponDamageDistribution) {
        let damageInstances = [];

        // Multishot
        let numPellets = this.getNumPellets(weaponInstance.getMultishot());

        for (let i = 0; i < numPellets; i++) {
            // Accuracy of pellet: if it misses, go next
            if (!this.randomChance(simulationSettings.accuracy)) continue;

            // Critical
            let critTier = this.getCriticalTier(weaponInstance.getCriticalChance(), weaponInstance.getVigilanteSetEffect());
            let critMultiplier = this.getCriticalMultiplier(critTier, weaponInstance.getCriticalMultiplier());

            // Headshot
            let headshotMultiplier = this.getHeadshotMultiplier(simulationSettings.headshot,
                weaponInstance.getHeadshotMultiplier(), enemyInstance.getEnemy().getHeadshotMultiplier())

            // Critical headshot
            let critHeadshotMultiplier = this.getCriticalHeadshotMultiplier(critTier,
                headshotMultiplier !== 1, enemyInstance.getEnemy().getCriticalHeadshotMultiplier());

            // Faction
            let factionMultiplier = weaponInstance.getFactionMultiplier();

            // Total multiplier
            let overallMultiplier = critMultiplier * headshotMultiplier * critHeadshotMultiplier * factionMultiplier;

            damageInstances.push(weaponDamageDistribution.multiply(overallMultiplier));
        }
        return damageInstances;
    }

    /**
     * Given the modded multishot of a weapon, find the number of pellets.
     * @param moddedMultishot
     * @returns {number|number}
     */
    static getNumPellets(moddedMultishot) {
        let guaranteedPellets = Math.floor(moddedMultishot);
        let extraPelletChance = moddedMultishot - guaranteedPellets;
        return this.randomChance(extraPelletChance) ? guaranteedPellets + 1 : guaranteedPellets;
    }

    /**
     * Given the modded critical chance of a weapon, find the crit tier.
     * @param moddedCriticalChance
     * @param moddedVigilanteChance
     * @returns {number} Crit tier
     */
    static getCriticalTier(moddedCriticalChance, moddedVigilanteChance) {
        let critTier = Math.floor(moddedCriticalChance);
        let extraCritChance = moddedCriticalChance - critTier;
        critTier = this.randomChance(extraCritChance) ? critTier + 1 : critTier;

        // Either it was a guaranteed critical hit without extra chance calculation (e.g. 100% CC, 200% etc.)
        // or it was a sub-100% critical hit which happened (e.g. 90% CC)
        // If it was not a critical hit at all, critOccurred will be false
        let critOccurred = critTier !== 0;

        // Vigilante set critical chance
        // Crit needs to occur, then Vigilante set chance
        let isVigilanteEnhanced = critOccurred && this.randomChance(moddedVigilanteChance);

        return isVigilanteEnhanced ? critTier + 1 : critTier;
    }

    static getCriticalMultiplier(critTier, moddedCriticalMultiplier) {
        return 1 + (critTier * (moddedCriticalMultiplier - 1));
    }

    static getHeadshotMultiplier(headshotChance, weaponHeadshotMultiplier, enemyHeadshotMultiplier) {
        let isHeadshot = this.randomChance(headshotChance);
        return isHeadshot ? weaponHeadshotMultiplier * enemyHeadshotMultiplier : 1;
    }

    static getCriticalHeadshotMultiplier(critTier, isHeadshot, enemyCriticalHeadshotMultiplier) {
        // Either it was a guaranteed critical hit without extra chance calculation (e.g. 100% CC, 200% etc.)
        // or it was a sub-100% critical hit which happened (e.g. 90% CC)
        // If it was not a critical hit at all, critOccurred will be false
        let critOccurred = critTier !== 0;
        return (critOccurred && isHeadshot) ? enemyCriticalHeadshotMultiplier : 1;
    }

    static getStatusTier(moddedStatusChance) {
        let statTier = Math.floor(moddedStatusChance);
        let extraStatChance = moddedStatusChance - statTier;
        return this.randomChance(extraStatChance) ? statTier + 1 : statTier;
    }

    static getProcs(statTier, weaponInstance, weaponDamageDistribution) {
        let procs = [];
        //  TODO now sure how headmultipliers work into this

        let factionMultiplier = weaponInstance.getFactionMultiplier();
        let critTier = this.getCriticalTier(weaponInstance.getCriticalChance(), weaponInstance.getVigilanteSetEffect());
        let critMultiplier = this.getCriticalMultiplier(critTier, weaponInstance.getCriticalMultiplier());
        // let headshotMultiplier = this.getHeadshotMultiplier(); TODO
        let multipliers = factionMultiplier * factionMultiplier * critMultiplier;

        let statusDamage = weaponInstance.getModdedBaseDamage().totalBaseDamage() * multipliers;
        for (let statusType of weaponDamageDistribution.randomStatus(statTier)) {
            procs.push(new Proc(statusType, statusDamage, weaponInstance));
        }
        return procs;
    }

}

module.exports = {
    SimulationUtils
}