const {ResistanceType} = require('./resistance-type');

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
        let plainObject = JSON.parse(object);
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

module.exports = {
    Enemy
}