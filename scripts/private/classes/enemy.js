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
    static fromObject(object) {
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

/*    /!**
     *
     * @returns {Promise<ResistanceType>}
     *!/
    getHealthType() {
        return ResistanceType.healthTypeFromID(this.healthTypeId);
    }*/

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

/*    /!**
     *
     * @returns {Promise<ResistanceType>}
     *!/
    getArmorType() {
        return ResistanceType.armorTypeFromID(this.armorTypeId);
    }*/

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

/*    /!**
     *
     * @returns {Promise<ResistanceType>}
     *!/
    getShieldType() {
        return ResistanceType.shieldTypeFromID(this.shieldTypeId);
    }*/

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
        this.currentHealth = this.startingHealth();

        /** @type {number} - Remaining armor of the enemy */
        this.armor = this.startingArmor(); // should not ever change from base

        /** @type {number} - Remaining shield of the enemy */
        this.currentShield = this.startingShield();

        /** @type {Map<DamageType, Proc[]>} - Active procs on the enemy, organised into lists by type */
        this.procs = new Map();

        /** @type {number} - How long the enemy is shield gated for */
        this.shieldGatedDuration = 0;
    }

    /**
     * Convert EnemyInstance object into JSON string.
     * @returns {string}
     */
    toObject() {
        return JSON.stringify(this, replacer);
    }

    /**
     * Convert JSON object string into object with EnemyInstance prototype.
     * @param {string} object
     * @returns {EnemyInstance}
     */
    static fromObject(object) {
        let plainObject = JSON.parse(object);

        plainObject.enemy = Enemy.fromObject(JSON.stringify(plainObject.enemy))
        for (let i = 0; i < plainObject.procs.length; i++) {
            plainObject.procs[i] = Proc.fromObject(JSON.stringify(plainObject.procs[i]));
        }

        return Object.setPrototypeOf(plainObject, EnemyInstance.prototype)
    }

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
     * Calculates the starting health of an enemy. Formula derived from
     * https://warframe.fandom.com/wiki/Enemy_Level_Scaling#Health
     * @returns {number}
     */
    startingHealth() {
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
    startingArmor() {
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
    startingShield() {
        let levelDiff = this.level - this.enemy.baseLevel;
        let f1 = 1 + 0.02 * Math.pow(levelDiff, 1.75);
        let f2 = 1 + 1.6 * Math.pow(levelDiff, 0.75);
        let s1 = EnemyInstance.transitionPercentage(levelDiff);
        let shieldMultiplier = f1 * (1 - s1) + f2 * s1;
        return this.enemy.baseShield * this.enemy.baseShieldMultiplier * shieldMultiplier;
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

    setLevel(level) {
        this.level = level;
        return this;
    }

    getCurrentHealth() {
        return this.currentHealth;
    }

    /**
     * Damage health by a specified amount. If the damage is greater than the enemy's current health,
     * only the amount of damage that can be dealt will be dealt (i.e. health will never be negative).
     * @param {number} dmg
     * @returns {number} - amount of damage actually dealt
     */
    damageHealth(dmg) {
        let actualDamage = Math.min(dmg, this.currentHealth);
        this.currentHealth -= actualDamage;
        return actualDamage;
    }

    // TODO corrosive procs and other modifiers
    // https://warframe.fandom.com/wiki/Damage#Damage_Calculation
    // Equivalent to AR in the formula in the above link
    getArmor() {
        return this.armor;
    }

    getCurrentShield() {
        return this.currentShield;
    }

    /**
     * Damage the shields by a specified amount. If the damage is greater than the enemy's current shields,
     * only the amount of damage that can be dealt will be dealt (i.e. shields will never be negative).
     * @param {number} dmg
     * @returns {number} - amount of damage actually dealt
     */
    damageShield(dmg) {
        let actualDamage = Math.min(dmg, this.currentShield);
        this.currentShield -= actualDamage;
        return actualDamage;
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

        /*for (let [damageType, procs] of this.procs.entries()) {
            // TODO procs is a list, find min value of it
            time = Math.min(time, proc.remainingDuration);
        }*/
        return time;
    }

    /**
     * Progress the enemy's event timers by the specified duration.
     * @param {number} duration
     */
    advanceTimeStep(duration) {
        this.shieldGatedDuration -= Math.min(duration, this.shieldGatedDuration);

        // TODO for all procs, advance their timer (and refresh their status if needed)
        //  just call proc.advanceTimeStep() to handle it
    }

}

module.exports = {
    Enemy,
    EnemyInstance
}