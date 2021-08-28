const {WeaponDamage} = require("./weapon-damage");
const {reviver} = require('./map-util');

class WeaponResiduals {
    constructor() {
        this.originalBaseDamage = new WeaponDamage();
        this.duration = undefined;
        this.pellets = undefined;
        this.inheritsCriticalChance = undefined; // boolean
        this.overrideCriticalChance = undefined; // number or null
        this.overrideCriticalMultiplier = undefined;
        this.overrideStatusChance = undefined;
    }

    /**
     * Convert JSON object string into object with WeaponResiduals prototype.
     * @param {string} object
     */
    static fromObject(object) {
        let plainObject = JSON.parse(object, reviver);
        Object.setPrototypeOf(plainObject.originalBaseDamage, WeaponDamage.prototype)
        return Object.setPrototypeOf(plainObject, WeaponResiduals.prototype)
    }

    setOriginalBaseDamage(originalBaseDamage) {
        this.originalBaseDamage = originalBaseDamage;
        return this;
    }

    setDuration(duration) {
        this.duration = duration;
        return this;
    }

    setPellets(pellets) {
        this.pellets = pellets;
        return this;
    }

    setInheritsCriticalChance(inheritsCriticalChance) {
        this.inheritsCriticalChance = inheritsCriticalChance;
        return this;
    }

    setOverrideCriticalChance(overrideCriticalChance) {
        this.overrideCriticalChance = overrideCriticalChance;
        return this;
    }

    setOverrideCriticalMultiplier(overrideCriticalMultiplier) {
        this.overrideCriticalMultiplier = overrideCriticalMultiplier;
        return this;
    }

    setOverrideStatusChance(overrideStatusChance) {
        this.overrideStatusChance = overrideStatusChance;
        return this;
    }

}

module.exports = {
    WeaponResiduals
}