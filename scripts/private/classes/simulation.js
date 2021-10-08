const {DamageType} = require('./magic-types');
const {SimulationSettings} = require('./simulation-settings');
const {EnemyInstance} = require('./enemy');
const {WeaponInstance} = require('./weapon');
const {Metrics} = require('./metrics');
const {Proc} = require('./proc')
const {SimulationUtils} = require('../utils/simulation-utils')
const {DynamicPool} = require('node-worker-threads-pool');
const dynamicPool = new DynamicPool(8);

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
        this.dynamicWorkerPool = dynamicPool;
    }

    /**
     * Runs the simulation and returns the results of the simulation as a list of Metrics[].
     * The outermost list is in order of the enemyInstances,
     * while the innermost list contains a Metric for each enemy killed.
     * @returns {Promise<Metrics[][]>}
     */
    // TODO may need to put everything in here into multithreading to prevent blocking of main thread
    async run() {
        let allMetrics = []; // Metrics[][], in order of enemyInstances. need to resolve
        let weaponInstance = this.weaponInstance.toObject();
        let simulationSettings = this.simulationSettings.toObject();

        // Loop for each enemy type
        for (let e = 0; e < this.enemyInstances.length; e++) {
            let metricsForThisEnemy = [];
            for (let i = 0; i < this.simulationSettings.numIterations; i++) {
                metricsForThisEnemy.push(await executeSimulationNoMultithread(
                    this.weaponInstance, EnemyInstance.deserialize(this.enemyInstances[e].serialize()), this.simulationSettings));
            }


            allMetrics[e] = metricsForThisEnemy;

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

/*async function executeSimulation(param) {
    // TODO if a shot was fired, reset the shot delay to its default and charge delay to its default
    //  if need to reload, execute reload then reset the shot delay to 0 and charge delay to its default

    // are these paths relative to the script that is run??
    const {SimulationSettings} = require('../classes/simulation-settings');
    const {EnemyInstance} = require('../classes/enemy');
    const {WeaponInstance} = require('../classes/weapon');
    const {Metrics} = require('../classes/metrics');
    const {shoot} = require('../classes/simulation');

    const maxSimulationDuration = 999999;

    let weaponInstance = WeaponInstance.fromObject(param.weaponInstance);
    let enemyInstance = EnemyInstance.deserialize(param.enemyInstance);
    let simulationSettings = SimulationSettings.fromObject(param.simulationSettings);

    let metrics = new Metrics();
    let timeElapsed = 0;
    //console.log('initial enemy status:', enemyInstance);

    while (enemyInstance.isAlive() && timeElapsed < maxSimulationDuration) {
        let timeUntilNextWeaponEvent = weaponInstance.getNextEventTimeStep();
        let timeUntilNextEnemyEvent = enemyInstance.getNextEventTimeStep();
        let timeUntilNextEvent = Math.min(timeUntilNextWeaponEvent, timeUntilNextEnemyEvent);

        //console.log('time elapsed:', timeElapsed, '\n');
        timeElapsed += timeUntilNextEvent;
        weaponInstance.advanceTimeStep(timeUntilNextEvent);
        enemyInstance.advanceTimeStep(timeUntilNextEvent);

        // TODO Handle weapon buffs.
        /!*for (let buff of weaponInstance.buffs) {
        }*!/
        // TODO work out if its 1hit 2proc 3hit 4proc or 1hit 2residual 3hitproc 4residualproc
        //  if the latter (which i suspect) we will need to simply keep a record of the procs and add them after
        //  so itd be like 1hit (save procs), 2hitresiduals (save procs), 3 add the procs, 4 add the procs, 5 calculate damage of procs
        //  did some testing and it could be the former but would need to use numbers to be certain
        // Shoot the enemy, or wait until you can. - inherently handles adding procs
        if (weaponInstance.canShoot()) {
            await shoot(weaponInstance, enemyInstance, metrics, simulationSettings);

            /!*!//Keep track of metrics from the shot
            let hitCount = 0;
            let critCount = {};
            let headCount = 0;
            let headCritCount = 0;
            let procs = [];

            //Loop through each pellet
            for (let s = 0; s < shotRng.length; s++) {
                let shot = shotRng[s];
                if (shot.Hit) hitCount++;
                if (shot.Critical !== undefined) critCount[shot.Critical] = (critCount[shot.Critical] || 0) + 1;
                if (shot.Headshot) headCount++;
                if (shot.Critical && shot.Headshot) headCritCount++;
                if (shot.Procs !== undefined && shot.Procs.length > 0) {
                    procs = procs.concat(shot.Procs);
                }
                if (shot.Residuals !== undefined && shot.Residuals.length > 0) {
                    for (let r = 0; r < shot.Residuals.length; r++)
                    {
                        procs = procs.concat(shot.Residuals[r].Procs);
                    }
                }
            }*!/


        }

        // TODO each possible event that can occur should be processed e.g. a proc does damage


        // TODO Handle effects of residuals e.g. Shedu electricity explosion damage - also handles procs


        // TODO deal damage from procs, similar to the process of dealing damage in shoot()
        enemyInstance.removeExpiredProcs();

        // TODO Calculate residual procs ??? can be merged with above or not? no idea what this involves

        //console.log('enemy health:', enemyInstance.getCurrentHealth());

    }
    //console.log('final kill time:', timeElapsed);
    //console.log(enemyInstance.procs);
    metrics.setKillTime(timeElapsed);
    return metrics;
}*/

async function executeSimulationNoMultithread(weaponInstance, enemyInstance, simulationSettings) {
    // TODO if a shot was fired, reset the shot delay to its default and charge delay to its default
    //  if need to reload, execute reload then reset the shot delay to 0 and charge delay to its default

    // are these paths relative to the script that is run??
    const {Metrics} = require('../classes/metrics');
    const {shoot} = require('../classes/simulation');

    const maxSimulationDuration = 999999;

    let metrics = new Metrics();
    let timeElapsed = 0;
    //console.log('initial enemy status:', enemyInstance);

    while (enemyInstance.isAlive() && timeElapsed < maxSimulationDuration) {
        let timeUntilNextWeaponEvent = weaponInstance.getNextEventTimeStep();
        let timeUntilNextEnemyEvent = enemyInstance.getNextEventTimeStep();
        let timeUntilNextEvent = Math.min(timeUntilNextWeaponEvent, timeUntilNextEnemyEvent);

        //console.log('time elapsed:', timeElapsed, '\n');
        timeElapsed += timeUntilNextEvent;
        weaponInstance.advanceTimeStep(timeUntilNextEvent);
        enemyInstance.advanceTimeStep(timeUntilNextEvent);

        // TODO Handle weapon buffs.
        /*for (let buff of weaponInstance.buffs) {
        }*/
        // TODO work out if its 1hit 2proc 3hit 4proc or 1hit 2residual 3hitproc 4residualproc
        //  if the latter (which i suspect) we will need to simply keep a record of the procs and add them after
        //  so itd be like 1hit (save procs), 2hitresiduals (save procs), 3 add the procs, 4 add the procs, 5 calculate damage of procs
        //  did some testing and it could be the former but would need to use numbers to be certain
        // Shoot the enemy, or wait until you can. - inherently handles adding procs
        if (weaponInstance.canShoot()) {
            await shoot(weaponInstance, enemyInstance, metrics, simulationSettings);

            /*//Keep track of metrics from the shot
            let hitCount = 0;
            let critCount = {};
            let headCount = 0;
            let headCritCount = 0;
            let procs = [];

            //Loop through each pellet
            for (let s = 0; s < shotRng.length; s++) {
                let shot = shotRng[s];
                if (shot.Hit) hitCount++;
                if (shot.Critical !== undefined) critCount[shot.Critical] = (critCount[shot.Critical] || 0) + 1;
                if (shot.Headshot) headCount++;
                if (shot.Critical && shot.Headshot) headCritCount++;
                if (shot.Procs !== undefined && shot.Procs.length > 0) {
                    procs = procs.concat(shot.Procs);
                }
                if (shot.Residuals !== undefined && shot.Residuals.length > 0) {
                    for (let r = 0; r < shot.Residuals.length; r++)
                    {
                        procs = procs.concat(shot.Residuals[r].Procs);
                    }
                }
            }*/


        }

        // TODO each possible event that can occur should be processed e.g. a proc does damage
        enemyInstance.dealProcDamage();

        // TODO Handle effects of residuals e.g. Shedu electricity explosion damage - also handles procs


        // TODO deal damage from procs, similar to the process of dealing damage in shoot()
        enemyInstance.removeExpiredProcs();

        // TODO Calculate residual procs ??? can be merged with above or not? no idea what this involves

        //console.log('enemy health:', enemyInstance.getCurrentHealth());

    }
    //console.log('final kill time:', timeElapsed);
    //console.log(enemyInstance.procs);
    metrics.setKillTime(timeElapsed);
    return metrics;
}



/**
 * Fire one shot (many contain many pellets) at the enemy.
 * @param {WeaponInstance} weaponInstance
 * @param {EnemyInstance} enemyInstance
 * @param {Metrics} metrics
 * @param {SimulationSettings} simulationSettings
 */
async function shoot(weaponInstance, enemyInstance, metrics, simulationSettings) {
    let procs = [];

    // Ammo consumption NVM ammo consumption is not chance based
    //let ammoConsumed = SimulationUtils.happens(weaponInstance.getAmmoConsumption());

    // Fire rate
    let fireRate = weaponInstance.getFireRate();

    // Internal Bleeding (chance is independent of pellet)
    // TODO cannot produce multiple procs in a single instance of damage alongside any other slash sources
    let internalBleedingChance = weaponInstance.getInternalBleedingEffect();

    let damageInstances = SimulationUtils.shotDamageInstances(simulationSettings, weaponInstance,
        enemyInstance, weaponInstance.getDamage());
    for (let damageInstance of damageInstances) {
        if (!enemyInstance.isAlive()) break;

        enemyInstance.dealDamage(damageInstance);

        // Status
        let statTier = SimulationUtils.getStatusTier(weaponInstance.getStatusChance());
        procs.push(...SimulationUtils.getProcs(statTier, weaponInstance, weaponInstance.getDamage()));
    }

    let residualInstances; // TODO

    // Below is the additional procs, after all damage instances considered

    // Hunter Munitions
    // TODO Cannot produce multiple procs in a single instance of damage alongside forced Slash from sources
    if (SimulationUtils.randomChance(weaponInstance.getHunterMunitionsEffect())) { // TODO also needs crit
        procs.push(new Proc(DamageType.SLASH, weaponInstance.getDamage(), weaponInstance));
    }

    /*
    //  such as Internal Bleeding or the debuff from Seeking Talons, but can stack with
    //  Slash statuses applied using a weapon's innate status chance.
    let isHunterMunitions = critOccurred && SimulationUtils.happens(weaponInstance.getHunterMunitionsEffect());

    // TODO first calculate regular slash from status, then hunter, then if nothing happens from either, try internal bleeding
    //  may need to calculate after the pellet loop
    let isInternalBleeding = false;

    //Do procs for this pellet
    let procs = $_DoProcs(this.Weapon.Damage, statusChance, rngHandler, remainChance, '');

    //If Hunter Munitions proc'd and the shot was a crit, apply a slash proc
    if (hunterChance.Result.HunterMunitions && (remainChance.Result.Critical || criticalLevel > 0)) {
        procs.push($Classes.DamageType.SLASH);
    }

    //Loop through the procs and roll Internal Bleeding for every impact proc
    for (let pe = 0; pe < procs.length; pe++) {
        if (procs[pe] === $Classes.DamageType.IMPACT) {
            let internalBleedingChance = vigilanteChance
                .Chance(internalBleedingChanceChance, 'InternalBleeding');

            if (internalBleedingChance.Result.InternalBleeding) {
                procs.push($Classes.DamageType.SLASH);
            }
        }
    }*/

    // Apply the procs from normal shot and residual
    enemyInstance.addProcs(procs);

    // Consume ammo
    weaponInstance.remainingMagazine -= weaponInstance.getAmmoConsumption();

    //If there is ammo remaining, reset the shot and charge delays, otherwise reload
    if (weaponInstance.remainingMagazine > 0) {
        weaponInstance.currentShotDelay = weaponInstance.getShotDelay();
        //weaponInstance.currentChargeDelay = weaponInstance.chargeDelay();
    } else {
        weaponInstance.remainingReloadDuration = weaponInstance.getReloadDuration();
        //this.CurrentChargeDelay = this.ChargeDelay;
    }

    //metrics.addPelletsFired(numPellets);
    metrics.addShotsFired(1);
    metrics.addProcs(procs);

    //console.log('remaining magazine:', weaponInstance.remainingMagazine);

    /*
        //Handle rng that will be used for the shot
        let rng = this.DoShotRng(rngHandler);

        //Tracks whether any shots hit or not; some buffs are removed if no pellets hit the enemy
        let anyHit = false;

        //Loop through each pellet's rng
        for (let p = 0; p < rng.length; p++) {
            //Get the rng
            let pelletRng = rng[p];
            anyHit = anyHit || pelletRng.Hit;

            //If the pellet hits
            if (pelletRng.Hit) {
                //Get damage multipliers
                let pelletCriticalMultiplier = (pelletRng.Critical * this.Weapon.CriticalMultiplier - (pelletRng.Critical - 1));
                let pelletHeadshotMultiplier = (pelletRng.Headshot ? this.Weapon.HeadshotMultiplier * 2 : this.Weapon.BodyshotMultiplier);
                let pelletHeadCritMultiplier = (pelletRng.Critical && pelletRng.Headshot ? 2 : 1);
                let pelletFactionMultiplier = (this.Weapon.MaxFactionDamageMultiplier);

                //If the Latron mod effect is in effect
                if (this.Weapon.AugmentLatronNextShotBonus > 0) {
                    //Add its relevant buff
                    let latronNextShotBonusBuff = new $Classes.Buff(MAIN.Timer, 2)
                        .SetName($Classes.BuffNames.LATRON_NEXT_SHOT_BONUS)
                        .SetCanRefresh(true)
                        .SetMaxStacks(20)
                        .SetRefreshToMaxDurationWhenExpires(false)
                        .AddModEffect($Classes.ModEffect.LATRON_NEXT_SHOT_BONUS_BUFF, this.Weapon.AugmentLatronNextShotBonus);

                    this.Weapon.AddBuff(latronNextShotBonusBuff);
                }

                //If the Soma Prime mod effect is in effect
                if (this.Weapon.AugmentSomaPrimeHitCriticalChance > 0) {
                    //Add its relevant buff
                    let somaPrimeHitCriticalChanceBuff = new $Classes.Buff()
                        .SetName($Classes.BuffNames.SOMA_PRIME_HIT_CRITICAL)
                        .SetCanRefresh(true)
                        .SetMaxBonus(5)
                        .SetRefreshToMaxDurationWhenExpires(false)
                        .AddModEffect($Classes.ModEffect.CRITICAL_CHANCE, this.Weapon.AugmentSomaPrimeHitCriticalChance);

                    this.Weapon.AddBuff(somaPrimeHitCriticalChanceBuff);
                }

                //Get various other damage multipliers
                var otherDamageMultipliers = $_GetOtherMultipliersFromWeapon(this.Weapon);

                //Deal damage to the enemy
                enemy.DealDamage(
                    weapon.Damage,
                    {
                        Critical: pelletCriticalMultiplier,
                        Headshot: pelletHeadshotMultiplier,
                        HeadCrit: pelletHeadCritMultiplier,
                        Faction: pelletFactionMultiplier,
                        Other: otherDamageMultipliers
                    },
                    { Identifier: identifier, Source: 'shot' }
                );

                //Loop through proc types
                for (let s = 0; s < pelletRng.Procs.length; s++) {
                    //Create a proc for the proc type, and apply it to the enemy
                    let proc = new Proc(
                        parseInt(pelletRng.Procs[s]),
                        this.Weapon,
                        {
                            Critical: pelletCriticalMultiplier,
                            Headshot: {
                                Active: pelletRng.Headshot, Multiplier: 2
                            },
                            Faction: pelletFactionMultiplier,
                            Other: otherDamageMultipliers
                        },
                        this.Timer,
                        identifier
                    );
                    enemy.ApplyProc(proc);
                }

                //Loop through residuals as well
                for (let r = 0; r < weapon.Residuals.length; r++) {
                    let residual = weapon.Residuals[r];

                    //For each pellet of the residual (typically 1, but some cluster explosions are more than 1)
                    for (let rp = 0; rp < residual.Pellets; rp++) {
                        //Create a residual instance
                        let instance = residual.Instantiate(WeaponFiringModeResidualInstance, identifier, this.Timer, pelletCriticalMultiplier);

                        //Residual ticks immediately, so it gets put at the start of the residuals array
                        this.ResidualInstances.unshift(instance);
                    }
                }
            }
        }

        //If the Convectric augment is in effect and the enemy wasn't hit, don't consume ammo
        let canConsumeAmmo = !(this.Weapon.AugmentConvectrixEfficiency > 0 && !anyHit)

        //If ammo can be consumed, consume it
        if (rng.ConsumeAmmo && canConsumeAmmo) {
            this.RemainingMagazine -= weapon.AmmoConsumption;
        }

        //If there is ammo remaining, reset the shot and charge delays, otherwise reload
        if (this.RemainingMagazine > 0) {
            this.CurrentShotDelay = this.ShotDelay;
            this.CurrentChargeDelay = this.ChargeDelay;
        } else {
            this.RemainingReloadDuration = weapon.ReloadDuration;
            this.CurrentChargeDelay = this.ChargeDelay;
        }

        //If nothing hit, remove relevant buffs that require consecutive hits
        if (!anyHit) {
            this.Weapon.RemoveBuff($Classes.BuffNames.LATRON_NEXT_SHOT_BONUS);
        }*/
}



module.exports = {
    Simulation,
    shoot,
    dynamicPool
}