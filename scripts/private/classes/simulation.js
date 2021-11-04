const {Multithread} = require('../utils/multithread');
const {DAMAGE_TYPE, SIMULATION} = require('../utils/magicTypes');
const {WeaponDamageDistribution} = require('./weaponDamageDistribution');
const {SimulationSettings} = require('./simulationSettings');
const {EnemyInstance} = require('./enemy');
const {WeaponInstance} = require('./weapon');
const {Metrics} = require('./metrics');
const {Proc} = require('./proc')

/**
 * Clarification on terminology:
 * - Simulation: a set of mini-simulations, for each desired enemy type
 * - Mini-Simulation: a set of rounds for a certain type of enemy, for a number of iterations
 * - Round: a single encounter (iteration) with a single enemy
 */
class Simulation {
    /**
     * Constructs a simulation; call run() on the simulation to execute.
     * @param {WeaponInstance} weaponInstance
     * @param {EnemyInstance[]} enemyInstances
     * @param {SimulationSettings} simulationSettings
     */
    constructor(weaponInstance, enemyInstances, simulationSettings) {
        this.weaponInstance = weaponInstance;
        this.enemyInstances = enemyInstances;
        this.simulationSettings = simulationSettings;
    }

    /**
     * Runs the simulation and returns the results of the simulation as a list of Metrics[].
     * The outermost list is in order of the enemyInstances,
     * while the innermost list contains a Metric for each enemy killed.
     * @returns {Promise<Metrics[][]>}
     */
    async run() {
        let allMetrics = []; // Metrics[][], in order of enemyInstances. need to resolve
        //let weaponInstance = weaponInstance.toObject();
        //let simulationSettings = this.simulationSettings.toObject();

        // Iterate over each enemy type
        for (let miniNum = 0; miniNum < this.enemyInstances.length; miniNum++) {
            let miniSimulation = new MiniSimulation(this.weaponInstance, this.enemyInstances[miniNum], this.simulationSettings);
            allMetrics[miniNum] = await miniSimulation.run();
            /*allMetrics[e] = await new Promise((resolve) => {
                let enemyInstance = this.enemyInstances[e].serialize();
                let metricsForThisEnemy = []; // Metrics[]
                let numIterationsCompleted = 0;

                // Loop for number of iterations of a given enemy type
                for (let i = 0; i < this.simulationSettings.numIterations; i++) {
                    (async () => {
                        metricsForThisEnemy.push(await this.dynamicWorkerPool.exec({
                            task: executeSimulation,
                            param: {
                                weaponInstance,
                                enemyInstance,
                                simulationSettings
                            }
                        }))
                        numIterationsCompleted++;
                        if (numIterationsCompleted === this.simulationSettings.numIterations) {
                            resolve(metricsForThisEnemy); // TODO change this to make a new metrics object returning the averages (static method)
                        }
                    })();
                }
            })*/
        }
        return allMetrics;
    }
}

class MiniSimulation {
    constructor(weaponInstance, enemyInstance, simulationSettings) {
        this.weaponInstance = weaponInstance;
        this.enemyInstance = enemyInstance;
        this.simulationSettings = simulationSettings;

        // Precalculate health, armor and shield resistances for optimisation
        this.dmgDists = WeaponDamageDistribution.precalculate(weaponInstance.getDamage(), enemyInstance.getEnemy());

        this.dynamicPool = Multithread.getDynamicPool();
    }

    /**
     * @returns {Promise<Metrics[]>}
     */
    async run() {
        let metricsForCurrentEnemyType = [];
        for (let roundNum = 0; roundNum < this.simulationSettings.getNumIterations(); roundNum++) {
            if (this.simulationSettings.isMaximizeSimulation() && roundNum > SIMULATION.SLOW_ITERATIONS &&
                Metrics.meanKillTime(metricsForCurrentEnemyType) > SIMULATION.SLOW_KILL_TIME) {
                break;
            }

            let round = new Round(this.weaponInstance.clone(), this.enemyInstance.clone(), this.simulationSettings, this.dmgDists);
            metricsForCurrentEnemyType[roundNum] = await round.run();
        }
        return metricsForCurrentEnemyType;
    }
}

class Round {
    constructor(weaponInstance, enemyInstance, simulationSettings, dmgDists) {
        this.weaponInstance = weaponInstance;
        this.enemyInstance = enemyInstance;
        this.simulationSettings = simulationSettings;
        this.metrics = new Metrics();
        this.dmgDists = dmgDists;
    }

    /**
     * @returns {Promise<Metrics>}
     */
    async run() {
        // TODO if a shot was fired, reset the shot delay to its default and charge delay to its default
        //  if need to reload, execute reload then reset the shot delay to 0 and charge delay to its default

        const maxSimulationDuration = this.simulationSettings.getMaxSimulationDuration();

        let timeElapsed = 0;
        //console.log('initial enemy status:', enemyInstance);

        while (this.enemyInstance.isAlive() && timeElapsed < maxSimulationDuration) {
            // TODO return all tasks which need to be done at the next time step
            let timeUntilNextWeaponEvent = this.weaponInstance.getNextEventTimeStep();
            let timeUntilNextEnemyEvent = this.enemyInstance.getNextEventTimeStep();
            let timeUntilNextEvent = Math.min(timeUntilNextWeaponEvent, timeUntilNextEnemyEvent);

            //console.log('time elapsed:', timeElapsed, '\n');
            timeElapsed += timeUntilNextEvent;
            this.weaponInstance.advanceTimeStep(timeUntilNextEvent);
            this.enemyInstance.advanceTimeStep(timeUntilNextEvent);

            // TODO Handle weapon buffs in WeaponInstance.
            /*for (let buff of weaponInstance.buffs) {
            }*/

            // Shoot the enemy, or wait until you can
            if (this.weaponInstance.canShoot()) {
                await this.shoot();
            }

            // TODO each possible event that can occur should be processed e.g. a proc does damage
            this.enemyInstance.dealProcDamage();

            // TODO Handle effects of residuals e.g. Shedu electricity explosion damage - also handles procs


            // TODO deal damage from procs, similar to the process of dealing damage in shoot()
            this.enemyInstance.removeExpiredProcs();

            // TODO Calculate residual procs ??? can be merged with above or not? no idea what this involves

            //console.log('enemy health:', enemyInstance.getCurrentHealth()); // hhh

        }
        //console.log('final kill time:', timeElapsed); // hhh
        //console.log(enemyInstance.procs); // hhh
        this.metrics.setKillTime(timeElapsed);
        return this.metrics;
    }

    /**
     * Fire one shot (many contain many pellets) at the enemy.
     */
    async shoot() {
        let procs = [];

        // Internal Bleeding (chance is independent of pellet)
        // TODO cannot produce multiple procs in a single instance of damage alongside any other slash sources
        let internalBleedingChance = this.weaponInstance.getInternalBleedingEffect();

        // Since each pellet will have the same damage distribution, we simply record how many multiples of the base damage
        // are dealt in total
        let totalMultiplier = 0;

        // Multishot
        let numPellets = this.getNumPellets();

        // Information for metrics
        let shotCrit = false;
        let numPelletsLanded = numPellets;
        let headshot = false;
        let critHeadshot = false;

        // Fire each pellet
        for (let i = 0; i < numPellets; i++) {
            // Accuracy of pellet: if it misses, go next
            if (!Round.randomChance(this.simulationSettings.getAccuracy())) {
                numPelletsLanded -= 1;
                continue;
            }

            // Critical
            let critTier = this.getCriticalTier();
            let critMultiplier = this.getCriticalMultiplier(critTier);

            // Headshot
            let headshotMultiplier = this.getHeadshotMultiplier();

            // Critical headshot
            let critHeadshotMultiplier = this.getCriticalHeadshotMultiplier(critTier, headshotMultiplier !== 1);

            // Faction
            let factionMultiplier = this.weaponInstance.getFactionMultiplier();

            // Total multiplier
            let combinedMultiplier = critMultiplier * headshotMultiplier * critHeadshotMultiplier * factionMultiplier;

            totalMultiplier += combinedMultiplier;

            // Status
            let statTier = this.getStatusTier();
            procs.push(...this.getProcs(statTier));

            // Collect info for metrics
            if (critTier > 0) shotCrit = true;
            if (headshotMultiplier > 1) headshot = true;
            if (critHeadshotMultiplier > 1) critHeadshot = true;

        }

        this.enemyInstance.dealDamage(this.dmgDists, totalMultiplier);

        let residualInstances; // TODO

        // Below is the additional procs, after all damage instances considered

        /* Hunter Munitions
         * Cannot produce multiple procs in a single instance of damage alongside forced Slash from sources such as
         * Internal Bleeding or the debuff from Seeking Talons, but can stack with Slash statuses applied
         * using a weapon's innate status chance. */
        if (shotCrit && Round.randomChance(this.weaponInstance.getHunterMunitionsEffect())) {
            procs.push(new Proc(DAMAGE_TYPE.SLASH, this.dmgDists.get('noModifiers'), this.weaponInstance));
        }

        /* Internal Bleeding
         * Cannot produce multiple procs in a single instance of damage alongside any other Slash sources such as a
         * weapon's innate Slash, Hunter Munitions, or the debuff from Seeking Talons.
         * Proccing impact more than once in a single instance of damage will not allow this mod to proc more than once,
         * nor will it increase the chance of the mod proccing. */
        if (Proc.hasImpact(procs) && !Proc.hasSlash(procs) && Round.randomChance(this.weaponInstance.getInternalBleedingEffect())) {
            procs.push(new Proc(DAMAGE_TYPE.SLASH, this.dmgDists.get('noModifiers'), this.weaponInstance));
        }

        // Apply the procs from normal shot and residual
        this.enemyInstance.addProcs(procs);

        // Consume ammo
        this.weaponInstance.remainingMagazine -= this.weaponInstance.getAmmoConsumption();

        if (this.weaponInstance.remainingMagazine > 0) {
            // There is ammo remaining: reset the shot and charge delays
            this.weaponInstance.currentShotDelay = this.weaponInstance.getShotDelay();
            //weaponInstance.currentChargeDelay = weaponInstance.chargeDelay();
        } else {
            // There is no ammo remaining: reload
            this.weaponInstance.remainingReloadDuration = this.weaponInstance.getReloadDuration();
            //this.CurrentChargeDelay = this.ChargeDelay;
            this.metrics.addReload();
        }

        // Metrics
        this.metrics
            .addShotsFired(1)
            .addPelletsFired(numPellets)
            .addPelletsLanded(numPelletsLanded)
            .addShotsLanded(numPelletsLanded > 0 ? 1 : 0)
            .addHeadshots(headshot ? 1 : 0)
            .addHeadCrits(critHeadshot ? 1 : 0)
            .addProcs(procs);

        //console.log('remaining magazine:', weaponInstance.remainingMagazine);
    }

    /**
     *
     * @param {number} chance - Chance of event occurring.
     * @returns {boolean} - Whether or not the event occurred.
     */
    static randomChance(chance) {
        return chance >= 1 || (chance > 0 && Math.random() < chance);
    }

    /**
     * Using the modded multishot of a weapon, find the number of pellets.
     * @returns {number|number}
     */
    getNumPellets() {
        let moddedMultishot = this.weaponInstance.getMultishot();
        let guaranteedPellets = Math.floor(moddedMultishot);
        let extraPelletChance = moddedMultishot - guaranteedPellets;
        return Round.randomChance(extraPelletChance) ? guaranteedPellets + 1 : guaranteedPellets;
    }

    /**
     * Using the modded critical chance of a weapon, find the crit tier.
     * @returns {number} Crit tier
     */
    getCriticalTier() {
        let moddedCriticalChance = this.weaponInstance.getCriticalChance()
        let moddedVigilanteChance = this.weaponInstance.getVigilanteSetEffect()

        let critTier = Math.floor(moddedCriticalChance);
        let extraCritChance = moddedCriticalChance - critTier;
        critTier = Round.randomChance(extraCritChance) ? critTier + 1 : critTier;

        // Either it was a guaranteed critical hit without extra chance calculation (e.g. 100% CC, 200% etc.)
        // or it was a sub-100% critical hit which happened (e.g. 90% CC)
        // If it was not a critical hit at all, critOccurred will be false
        let critOccurred = critTier !== 0;

        // Vigilante set critical chance
        // Crit needs to occur, then Vigilante set chance
        let isVigilanteEnhanced = critOccurred && Round.randomChance(moddedVigilanteChance);

        return isVigilanteEnhanced ? critTier + 1 : critTier;
    }

    getCriticalMultiplier(critTier) {
        return 1 + (critTier * (this.weaponInstance.getCriticalMultiplier() - 1));
    }

    getHeadshotMultiplier() {
        let isHeadshot = Round.randomChance(this.simulationSettings.getHeadshotChance());
        return isHeadshot ?
            this.weaponInstance.getHeadshotMultiplier() * this.enemyInstance.getEnemy().getHeadshotMultiplier() : 1;
    }

    getCriticalHeadshotMultiplier(critTier, isHeadshot) {
        // Either it was a guaranteed critical hit without extra chance calculation (e.g. 100% CC, 200% etc.)
        // or it was a sub-100% critical hit which happened (e.g. 90% CC)
        // If it was not a critical hit at all, critOccurred will be false
        let critOccurred = critTier !== 0;
        return (critOccurred && isHeadshot) ? this.enemyInstance.getEnemy().getCriticalHeadshotMultiplier() : 1;
    }

    getStatusTier() {
        let moddedStatusChance = this.weaponInstance.getStatusChance();
        let statTier = Math.floor(moddedStatusChance);
        let extraStatChance = moddedStatusChance - statTier;
        return Round.randomChance(extraStatChance) ? statTier + 1 : statTier;
    }

    getProcs(statTier) {
        let weaponDamageDistribution = this.dmgDists.get('noModifiers');

        let procs = [];
        //  TODO now sure how headmultipliers work into this

        let factionMultiplier = this.weaponInstance.getFactionMultiplier();
        let critTier = this.getCriticalTier();
        let critMultiplier = this.getCriticalMultiplier(critTier, this.weaponInstance.getCriticalMultiplier());
        // let headshotMultiplier = this.getHeadshotMultiplier(); TODO
        let multipliers = factionMultiplier * factionMultiplier * critMultiplier;

        let statusDamage = this.weaponInstance.getModdedBaseDamage().totalBaseDamage() * multipliers;
        for (let statusType of weaponDamageDistribution.randomStatus(statTier)) {
            procs.push(new Proc(statusType, statusDamage, this.weaponInstance));
        }
        return procs;
    }
}

module.exports = {
    Simulation,
}