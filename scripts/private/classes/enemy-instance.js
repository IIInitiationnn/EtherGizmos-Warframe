const {Enemy} = require('./enemy');

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

        /** @type {Proc[]} - Active procs on the enemy */
        this.procs = [];

        /** @type {number} - How long the enemy is shield gated for */
        this.shieldGatedDuration = 0;
    }

    /**
     * Convert EnemyInstance object into JSON string.
     * @returns {string}
     */
    toObject() {
        return JSON.stringify(this);
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

        for (let proc of this.procs) {
            time = Math.min(time, proc.remainingDuration);
        }
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
    EnemyInstance
}