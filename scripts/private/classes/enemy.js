const {WeaponDamageDistribution} = require("./weapon-damage-distribution");
const {DamageType} = require('./magic-types');
const {Proc} = require('./proc');
const {ResistanceType} = require('./resistance-type');
const {replacer, reviver} = require('./map-util');

class Enemy {
    constructor() {
        this.id = undefined;
        this.name = undefined;
        this.image = undefined;

        this.baseLevel = undefined;
        this.baseHealth = undefined;
        this.healthTypeId = undefined;
        this.baseArmor = undefined;
        this.armorTypeId = undefined;
        this.baseShield = undefined;
        this.shieldTypeId = undefined;

        this.healthType = undefined;
        this.armorType = undefined;
        this.shieldType = undefined;

        this.headshotMultiplier = 2; // TODO adjust according to body part and multiplier for the future
        this.baseHealthMultiplier = 1;
        this.baseArmorMultiplier = 1;
        this.baseShieldMultiplier = 1;
    }

    /**
     * Convert JSON object string into object with Enemy prototype.
     * @param {string} object
     * @returns {Enemy}
     */
    static deserialize(object) {
        let plainObject = JSON.parse(object, reviver);
        if (plainObject.healthType != null)
            this.healthType = Object.setPrototypeOf(plainObject.healthType, ResistanceType.prototype);
        if (plainObject.armorType != null)
            this.armorType = Object.setPrototypeOf(plainObject.armorType, ResistanceType.prototype);
        if (plainObject.shieldType != null)
            this.shieldType = Object.setPrototypeOf(plainObject.shieldType, ResistanceType.prototype);
        return Object.setPrototypeOf(plainObject, Enemy.prototype)
    }

    /**
     * Returns an Enemy from its ID.
     * @param id
     * @returns {Promise<Enemy>}
     */
    static async fromID(id) {
        if (id == null) return null;
        const {getEnemies} = require('../data/game');
        let enemyData = await getEnemies();
        return enemyData[id];
    }

    // Getters
    getHealthType() {
        return this.healthType;
    }

    getArmorType() {
        return this.armorType;
    }

    getShieldType() {
        return this.shieldType;
    }

    getHeadshotMultiplier() {
        return this.headshotMultiplier;
    }

    getCriticalHeadshotMultiplier() {
        return 2; // TODO
    }

    // Setters
    setId(id) {
        this.id = id;
        return this;
    }

    setName(name) {
        this.name = name;
        return this;
    }

    setImage(value) {
        this.image = value;
        return this;
    }

    setBaseLevel(value) {
        this.baseLevel = value;
        return this;
    }

    setBaseHealth(value) {
        this.baseHealth = value;
        return this;
    }

    setHealthTypeId(healthTypeId) {
        this.healthTypeId = healthTypeId;
        return this;
    }

    async setHealthType() {
        this.healthType = await ResistanceType.healthTypeFromID(this.healthTypeId);
        return this;
    }

    setBaseArmor(value) {
        this.baseArmor = value;
        return this;
    }

    setArmorTypeId(armorTypeId) {
        this.armorTypeId = armorTypeId;
        return this;
    }

    async setArmorType() {
        this.armorType = await ResistanceType.armorTypeFromID(this.armorTypeId);
        return this;
    }

    setBaseShield(value) {
        this.baseShield = value;
        return this;
    }

    setShieldTypeId(shieldTypeId) {
        this.shieldTypeId = shieldTypeId;
        return this;
    }

    async setShieldType() {
        this.shieldType = await ResistanceType.shieldTypeFromID(this.shieldTypeId);
        return this;
    }

    setBaseHealthMultiplier(value) {
        this.baseHealthMultiplier = value;
        return this;
    }

    setBaseArmorMultiplier(value) {
        this.baseArmorMultiplier = value;
        return this;
    }

    setBaseShieldMultiplier(value) {
        this.baseShieldMultiplier = value;
        return this;
    }
}

class EnemyInstance {
    /**
     *
     * @param {Enemy} enemy
     * @param {number} level
     */
    constructor(enemy, level) {
        /** @type {Enemy} - Base enemy for simulation */
        this.enemy = enemy;

        /** @type {number} - Enemy level for simulation */
        this.level = level;

        /** @type {number} - Remaining health of the enemy */
        this.currentHealth = this.calculateStartingHealth();

        /** @type {number} - Remaining armor of the enemy */
        this.armor = this.calculateStartingArmor(); // should not ever change from base

        /** @type {number} - Remaining shield of the enemy */
        this.currentShield = this.calculateStartingShield();

        /** @type {Map<number, Proc[]>} - Active procs on the enemy, organised into lists by type. See DamageType */
        this.procs = new Map();
        for (let [dummy, damageType] of Object.entries(DamageType)) {
            this.procs.set(damageType, []);
        }

        // TODO heat armor strip duration counters, heat damage total (don't record in each proc) <-- use latter in addProcs


        /** @type {number} - How long the enemy is shield gated for */
        this.shieldGatedDuration = 0;
    }

    /**
     * Convert EnemyInstance object into JSON string.
     * @returns {string}
     */
    serialize() {
        return JSON.stringify(this, replacer);
    }

    /**
     * Convert JSON object string into object with EnemyInstance prototype.
     * @param {string} object
     * @returns {EnemyInstance}
     */
    static deserialize(object) {
        let plainObject = JSON.parse(object, reviver);

        plainObject.enemy = Enemy.deserialize(JSON.stringify(plainObject.enemy, replacer));

        return Object.setPrototypeOf(plainObject, EnemyInstance.prototype);
    }

    // Getters
    getEnemy() {
        return this.enemy;
    }

    getCurrentHealth() {
        return this.currentHealth;
    }

    // https://warframe.fandom.com/wiki/Damage#Damage_Calculation
    // Equivalent to AR in the formula in the above link
    getArmor() {
        return this.armor * this.getCorrosiveMultiplier() * this.getHeatMultiplier();
    }

    getCurrentShield() {
        return this.currentShield;
    }

    // TODO does not currently use ramp up and ramp down, is just a flat 50%
    getHeatMultiplier() {
        return this.procs.get(DamageType.HEAT).length === 0 ? 1 : 0.5;
    }

    getCorrosiveMultiplier() {
        let numCorrosiveProcs = this.procs.get(DamageType.CORROSIVE).length;
        return (numCorrosiveProcs === 0) ? 1 : 0.8 - 0.06 * numCorrosiveProcs;
    }

    getMagneticMultiplier() {
        let numMagneticProcs = this.procs.get(DamageType.MAGNETIC).length;
        return (numMagneticProcs === 0) ? 1 : 1.75 + 0.25 * numMagneticProcs;
    }

    getViralMultiplier() {
        let numViralProcs = this.procs.get(DamageType.VIRAL).length;
        return (numViralProcs === 0) ? 1 : 1.75 + 0.25 * numViralProcs;
    }

    isAlive() {
        return this.currentHealth > 0;
    }

    hasShields() {
        return this.currentShield > 0;
    }

    isShieldGated() {
        return this.shieldGatedDuration > 0;
    }

    /**
     * Calculates the starting health of an enemy. Formula derived from
     * https://warframe.fandom.com/wiki/Enemy_Level_Scaling#Health
     * @returns {number}
     */
    calculateStartingHealth() {
        let levelDiff = this.level - this.enemy.baseLevel;
        let f1 = 1 + 0.015 * Math.pow(levelDiff, 2);
        let f2 = 1 + (24 / Math.sqrt(5)) * Math.sqrt(levelDiff);
        let s1 = EnemyInstance.transitionPercentage(levelDiff);
        let healthMultiplier = f1 * (1 - s1) + f2 * s1;
        return this.enemy.baseHealth * this.enemy.baseHealthMultiplier * healthMultiplier;
    }

    /**
     * Calculates the starting armor of an enemy. Formula derived from
     * https://warframe.fandom.com/wiki/Enemy_Level_Scaling#Armor
     * @returns {number}
     */
    calculateStartingArmor() {
        let levelDiff = this.level - this.enemy.baseLevel;
        let f1 = 1 + 0.005 * Math.pow(levelDiff, 1.75);
        let f2 = 1 + 0.4 * Math.pow(levelDiff, 0.75);
        let s1 = EnemyInstance.transitionPercentage(levelDiff);
        let armorMultiplier = f1 * (1 - s1) + f2 * s1;
        return this.enemy.baseArmor * this.enemy.baseArmorMultiplier * armorMultiplier;
    }

    /**
     * Calculates the starting shield of an enemy. Formula derived from
     * https://warframe.fandom.com/wiki/Enemy_Level_Scaling#Shields
     * @returns {number}
     */
    calculateStartingShield() {
        let levelDiff = this.level - this.enemy.baseLevel;
        let f1 = 1 + 0.02 * Math.pow(levelDiff, 1.75);
        let f2 = 1 + 1.6 * Math.pow(levelDiff, 0.75);
        let s1 = EnemyInstance.transitionPercentage(levelDiff);
        let shieldMultiplier = f1 * (1 - s1) + f2 * s1;
        return this.enemy.baseShield * this.enemy.baseShieldMultiplier * shieldMultiplier;
    }

    // Other methods
    static transitionPercentage(levelDiff) {
        let t = (levelDiff - 70) / 10;
        if (levelDiff < 70) {
            return 0;
        } else if (70 <= levelDiff && levelDiff <= 80) {
            return 3 * t * t - 2 * t * t * t;
        } else {
            return 1;
        }
    }

    /**
     *
     * @param weaponDamageDistribution {WeaponDamageDistribution}
     */
    dealDamage(weaponDamageDistribution) {
        // Deal toxin damage directly to health
        let remainingDmgDist = this.damageToxin(weaponDamageDistribution);

        // Total damage to be done to shields, if there are any shields
        if (this.isAlive() && this.hasShields()) {
            remainingDmgDist = this.damageShield(remainingDmgDist);
        }

        // Total damage to be done to health
        if (this.isAlive()) {
            this.damageHealth(remainingDmgDist);
        }
    }

    damageToxin(weaponDamageDistribution) {
         let dmgDistToHealth = weaponDamageDistribution
             .afterAllHealthResistances(this.getEnemy().getHealthType(), this.getEnemy().getArmorType(), this.getArmor())
             .multiply(this.getViralMultiplier());

         let amtDmg = dmgDistToHealth.getToxin();
         let actualDamage = this.decreaseHealth(amtDmg);

         return weaponDamageDistribution.clone()
             .setToxin(weaponDamageDistribution.getToxin() * (amtDmg - actualDamage) / amtDmg);
    }

    damageHealth(weaponDamageDistribution) {
        // See https://warframe.fandom.com/wiki/Damage#Damage_Calculation and
        // https://warframe.fandom.com/wiki/Armor for more detailed explanations.
        // If x% of the damage was dealt to the shields, (100-x)% of the damage will be dealt to health.
        let shieldGatingMultiplier = this.isShieldGated() /*&& !isHeadshot*/ ? 0.05 : 1; // TODO headshot overrides shieldgate

        let dmgDistToHealth = weaponDamageDistribution
             .afterAllHealthResistances(this.getEnemy().getHealthType(), this.getEnemy().getArmorType(), this.getArmor())
             .multiply(shieldGatingMultiplier * this.getViralMultiplier());

        let amtDmg = dmgDistToHealth.totalBaseDamage();
        let actualDamage = this.decreaseHealth(amtDmg);
    }

    damageShield(weaponDamageDistribution) {
        let dmgDistToShield = weaponDamageDistribution
            .afterShieldResistances(this.getEnemy().getShieldType())
            .multiply(this.getMagneticMultiplier());

        // Deal the damage to the shields
        let amtDmg = dmgDistToShield.totalBaseDamage();
        let actualDamage = this.decreaseShield(amtDmg);

        // All shields gone from this hit; shield gating
        if (!this.hasShields()) {
            this.shieldGatedDuration = 0.1;
        }

        return weaponDamageDistribution.clone()
             .multiply((amtDmg - actualDamage) / amtDmg);
    }

    dealProcDamage() {
        for (let [damageType, procs] of this.procs.entries()) {
            for (let proc of procs) {
                if (proc.getDamage() !== 0) {
                    this.dealDamage(proc.toWeaponDamageDistribution());
                }
            }
        }
    }

    /**
     * Decrease health by a specified amount. If the damage is greater than the enemy's current health,
     * only the amount of damage that can be dealt will be dealt (i.e. health will never be negative).
     * @param {number} dmg
     * @returns {number} - amount of damage actually dealt
     */
    decreaseHealth(dmg) {
        let actualDamage = Math.min(dmg, this.currentHealth);
        this.currentHealth -= actualDamage;
        return actualDamage;
    }

    /**
     * Decrease the shields by a specified amount. If the damage is greater than the enemy's current shields,
     * only the amount of damage that can be dealt will be dealt (i.e. shields will never be negative).
     * @param {number} dmg
     * @returns {number} - amount of damage actually dealt
     */
    decreaseShield(dmg) {
        let actualDamage = Math.min(dmg, this.currentShield);
        this.currentShield -= actualDamage;
        return actualDamage;
    }

    /**
     * Adds new procs to the enemy and removes extra procs for certain statuses to ensure their caps of 10.
     * These are: Impact, Puncture, Cold, Blast, Corrosive, Gas, Magnetic, Radiation, Viral.
     * @param {Proc[]} procs - list of new procs
     * @returns {EnemyInstance}
     */
    addProcs(procs) {
        for (let proc of procs) {
            if (proc.getType() === DamageType.HEAT) {
                let heatProcs = this.procs.get(proc.getType());
                if (heatProcs.length === 0) {
                    heatProcs.push(proc);
                } else {
                    heatProcs[0].augment(proc);
                }
            } else {
                this.procs.get(proc.getType()).push(proc);
            }
        }
        return this.capExtraProcs();
    }

    /**
     * Remove all extra procs so that there are only 10 procs for certain status effects.
     * These are: Impact, Puncture, Cold, Blast, Corrosive, Gas, Magnetic, Radiation, Viral.
     * @returns {EnemyInstance}
     */
    capExtraProcs() {
        // Impact
        let numImpact = this.procs.get(DamageType.IMPACT).length;
        if (numImpact > 10) {
            this.procs.get(DamageType.IMPACT).splice(0, numImpact - 10);
        }

        // Puncture
        let numPuncture = this.procs.get(DamageType.PUNCTURE).length;
        if (numPuncture > 10) {
            this.procs.get(DamageType.PUNCTURE).splice(0, numPuncture - 10);
        }

        // Cold
        let numCold = this.procs.get(DamageType.COLD).length;
        if (numCold > 10) {
            this.procs.get(DamageType.COLD).splice(0, numCold - 10);
        }

        // Blast
        let numBlast = this.procs.get(DamageType.BLAST).length;
        if (numBlast > 10) {
            this.procs.get(DamageType.BLAST).splice(0, numBlast - 10);
        }

        // Corrosive
        let numCorrosive = this.procs.get(DamageType.CORROSIVE).length;
        if (numCorrosive > 10) {
            this.procs.get(DamageType.CORROSIVE).splice(0, numCorrosive - 10);
        }

        // Gas
        let numGas = this.procs.get(DamageType.GAS).length;
        if (numGas > 10) {
            this.procs.get(DamageType.GAS).splice(0, numGas - 10);
        }

        // Magnetic
        let numMagnetic = this.procs.get(DamageType.MAGNETIC).length;
        if (numMagnetic > 10) {
            this.procs.get(DamageType.MAGNETIC).splice(0, numMagnetic - 10);
        }

        // Radiation
        let numRadiation = this.procs.get(DamageType.RADIATION).length;
        if (numRadiation > 10) {
            this.procs.get(DamageType.RADIATION).splice(0, numRadiation - 10);
        }

        // Viral
        let numViral = this.procs.get(DamageType.VIRAL).length;
        if (numViral > 10) {
            this.procs.get(DamageType.VIRAL).splice(0, numViral - 10);
        }
        return this;
    }

    /**
     * Remove all procs which have reached 0 remaining duration.
     */
    removeExpiredProcs() {
        for (let [damageType, procs] of this.procs.entries()) {
            let activeProcs = [];
            for (let proc of procs) {
                if (proc.getRemainingDuration() > 0) {
                    activeProcs.push(proc);
                }
            }
            this.procs.set(damageType, activeProcs);
        }
    }

    /**
     * Returns the time until the next enemy-related event.
     * @returns {number} duration
     */
    getNextEventTimeStep() {
        let time = 99999; //TODO

        if (this.isShieldGated()) {
            time = this.shieldGatedDuration;
        }

        // TODO shield recharge, will need new field

        for (let [damageType, procs] of this.procs.entries()) {
            for (let proc of procs) {
                time = Math.min(time, proc.getNextEventTimeStep());
            }
        }
        return time;
    }

    /**
     * Progress the enemy's event timers by the specified duration.
     * @param {number} duration
     */
    advanceTimeStep(duration) {
        this.shieldGatedDuration -= Math.min(duration, this.shieldGatedDuration);

        for (let [damageType, procs] of this.procs.entries()) {
            for (let proc of procs) {
                proc.advanceTimeStep(duration);
            }
        }
    }

}

module.exports = {
    Enemy,
    EnemyInstance
}