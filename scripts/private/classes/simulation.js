const {SimulationSettings} = require('../classes/simulation-settings');
const {EnemyInstance} = require('../classes/enemy');
const {WeaponInstance} = require('../classes/weapon');
const {Metrics} = require('../classes/metrics');
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
            allMetrics[e] = await new Promise((resolve) => {
                let enemyInstance = this.enemyInstances[e].toObject();
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
            })
        }
        return allMetrics;
    }

}

async function executeSimulation(param) {
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
    let enemyInstance = EnemyInstance.fromObject(param.enemyInstance);
    let simulationSettings = SimulationSettings.fromObject(param.simulationSettings);

    let metrics = new Metrics();
    let timeElapsed = 0;
    let shotCount = 0;
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
        // Shoot the enemy, or wait until you can. - inherently handles adding procs
        if (weaponInstance.canShoot()) {
            await shoot(weaponInstance, enemyInstance, metrics, simulationSettings);
            shotCount++;

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


        // TODO Handle effects of residuals e.g. Shedu electricity explosion damage - also handles procs


        // TODO Calculate damage caused by procs?? not sure if can be done in shoot() loop


        // TODO Calculate residual procs ??? can be merged with above or not? no idea what this involves

        //console.log('enemy health:', enemyInstance.getCurrentHealth());

    }
    //console.log('final kill time:', timeElapsed);
    metrics.setKillTime(timeElapsed);
    return metrics;
}

/**
 *
 * @param {number} chance - Chance of event occurring.
 * @returns {boolean} - Whether or not the event occurred.
 */
function happens(chance) {
    return chance >= 1 || (chance > 0 && Math.random() < chance);
}

/**
 * Fire one shot (many contain many pellets) at the enemy.
 * @param {WeaponInstance} weaponInstance
 * @param {EnemyInstance} enemyInstance
 * @param {Metrics} metrics
 * @param {SimulationSettings} simulationSettings
 */
async function shoot(weaponInstance, enemyInstance, metrics, simulationSettings) {
    // Multishot
    let numPellets = weaponInstance.getPellets();

    let isExtraPellet = happens(numPellets - Math.floor((numPellets)));
    if (isExtraPellet) numPellets++;

    // Critical chance
    let overallCritChance = weaponInstance.getCriticalChance();
    let critTier = Math.floor(overallCritChance);
    let critChance = overallCritChance - critTier;

    // Ammo consumption NVM ammo consumption is not chance based
    //let ammoConsumed = happens(weaponInstance.getAmmoConsumption());

    // Fire rate
    let fireRate = weaponInstance.getFireRate();

    // Internal Bleeding (chance is independent of pellet)
    // TODO cannot produce multiple procs in a single instance of damage alongside any other slash sources
    let internalBleedingChance = weaponInstance.getInternalBleedingEffect();

    let damage = weaponInstance.getDamage(); // will not change for each pellet

    /*let healthType = await enemyInstance.enemy.getHealthType();
    let armorType = await enemyInstance.enemy.getArmorType();
    let shieldType = await enemyInstance.enemy.getShieldType();*/

    let healthType = enemyInstance.enemy.healthType;
    let armorType = enemyInstance.enemy.armorType;
    let shieldType = enemyInstance.enemy.shieldType;

    // Damage modifier for type-specific health and armor resistances
    let damageToHealth = damage.afterHealthResistances(healthType)
        .afterArmorTypeResistances(armorType)

    // Damage modifier for type-specific shield resistances
    let damageToShield = damage.afterShieldResistances(shieldType);

    // TODO toxin ignores shields

    for (let i = 0; i < numPellets; i++) {
        if (!enemyInstance.isAlive()) break;

        // Accuracy of pellet: if it misses, go next
        if (!happens(simulationSettings.accuracy)) continue;

        // Critical hit
        let isExtraCritical = happens(critChance);

        // Headshot
        let isHeadshot = happens(simulationSettings.headshot);

        // Actual crit of the pellet
        let critTierPellet = critTier;
        if (isExtraCritical) critTierPellet++;

        // Either it was a guaranteed critical hit without extra chance calculation (e.g. 100% CC, 200% etc.)
        // or it was a sub-100% critical hit which happened (e.g. 90% CC)
        // If it was not a critical hit at all, critOccurred will be false
        let critOccurred = critTier !== 0;

        // TODO Critical headshots (dependent on enemy, refer to wiki)
        let criticalHeadshotMultiplier = critOccurred && isHeadshot ? 2 : 1;

        // Vigilante set critical chance
        // Crit needs to occur, then Vigilante set chance
        let isVigilanteEnhanced = critOccurred && happens(weaponInstance.getVigilanteSetEffect());

        // TODO any other factors affecting stats, like buffs from augments (may need to be passed in as parameter)
        if (isVigilanteEnhanced) critTierPellet++;

        // TODO Deal direct damage
        //  when calculating for beams:
        //  On continuous weapons, however, Multishot bonus does not generate additional instances of damage.
        //  Additional "projectiles" instead merge into the original beam's damage ticks allowing each regular tick
        //  interval (based on the weapon's fire rate) a chance to roll bonus damage in multiples of itself,
        //  similar to how Critical Hits function. Even though the number of damage ticks overall does not increase,
        //  additional multishot still increases the Status Chance of each individual tick.
        //  Due to Multishot increasing both per-tick damage and status chance, status damage
        //  is affected twice by multishot on all continuous weapons.
        //  so each tick rolls status chance and crit chance, which can be increased by multishot.

        // TODO handle all procs eg magnetic amps shield damage, viral amps health damage

        // Percentage of remaining damage to be dealt
        let remainingDamage = 1;

        // Damage multipliers
        let damageMultiplier = 1;
        damageMultiplier *= 1 + (critTierPellet * (weaponInstance.getCriticalMultiplier() - 1)); // crit
        damageMultiplier *= isHeadshot ? weaponInstance.getHeadshotMultiplier(enemyInstance.enemy.headshotMultiplier) : 1; // headshot
        damageMultiplier *= criticalHeadshotMultiplier;
        damageMultiplier *= weaponInstance.getFactionMultiplier();
        // any other multipliers go here...
        //console.log('moddedDamageBeforeMultipliers:', damage)
        //console.log('afterCritsHeadshotsFactionEtc:', multipliedDamage)

        // Total damage to be done to shields, if there are any shields
        if (enemyInstance.hasShields()) {
            let amtDmgToShields = damageToShield.multiply(damageMultiplier).totalBaseDamage();

            // Deal the damage to the shields
            let dealtDamage = enemyInstance.damageShield(amtDmgToShields);

            // Calculate how much more damage needs to be done to health
            let proportionOfDamageDealt = dealtDamage / amtDmgToShields;
            remainingDamage -= proportionOfDamageDealt;

            // All shields gone from this hit
            if (!enemyInstance.hasShields()) {
                enemyInstance.shieldGatedDuration = 0.1;
            }
        }

        // Total damage to be done to health
        if (remainingDamage > 0) {
            // See https://warframe.fandom.com/wiki/Damage#Damage_Calculation and
            // https://warframe.fandom.com/wiki/Armor for more detailed explanations.
            // If x% of the damage was dealt to the shields, (100-x)% of the damage will be dealt to health.
            let shieldGatingMultiplier = enemyInstance.isShieldGated() && !isHeadshot ? 0.05 : 1;
            //console.log('shield gating:', shieldGatingMultiplier);
            let healthDamage =damageToHealth.multiply(damageMultiplier * shieldGatingMultiplier * remainingDamage)
                // General armor damage reduction = Net Armor / (Net Armor + 300)
                // so multiplier = 1 - reduction = 300 / (Net Armor + 300)
                .afterNetArmorResistances(armorType, enemyInstance.getArmor());

            //console.log('healthDamage after all calculations:', healthDamage)
            let amtDmgToHealth = healthDamage.totalBaseDamage();

            // Deal the damage to health
            enemyInstance.damageHealth(amtDmgToHealth);
        }
        /*
                // TODO Record procs from status chance, then apply them after all the pellets, and after residuals

                // Below is the additional procs

                // Hunter Munitions
                // TODO Cannot produce multiple procs in a single instance of damage alongside forced Slash from sources
                //  such as Internal Bleeding or the debuff from Seeking Talons, but can stack with
                //  Slash statuses applied using a weapon's innate status chance.
                let isHunterMunitions = critOccurred && happens(weaponInstance.getHunterMunitionsEffect());

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


    }

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