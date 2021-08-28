const {WeaponResiduals} = require('./weapon-residuals');
const {WeaponDamage} = require('./weapon-damage');
const {reviver} = require('./map-util');

/**
 * Contains the stats for the firing mode of a weapon.
 */
class WeaponFiringMode {
    constructor() {
        this.name = undefined;
        this.pellets = undefined;
        this.ammoConsumption = undefined;
        this.fireRate = undefined;

        this.criticalChance = undefined;
        this.criticalMultiplier = undefined;
        this.statusChance = undefined;
        this.isBeam = undefined;
        this.chargeDelay = undefined;

        this.originalBaseDamage = new WeaponDamage();
        this.residuals = new WeaponResiduals();
    }
    /**
     * Convert JSON object string into object with WeaponFiringMode prototype.
     * @param {string} object
     * @returns {WeaponFiringMode}
     */
    static fromObject(object) {
        let plainObject = JSON.parse(object, reviver);

        Object.setPrototypeOf(plainObject.originalBaseDamage, WeaponDamage.prototype);
        plainObject.residuals = WeaponResiduals.fromObject(JSON.stringify(plainObject.residuals));

        return Object.setPrototypeOf(plainObject, WeaponFiringMode.prototype);
    }

    setName(name) {
        this.name = name;
        return this;
    }

    setPellets(pellets) {
        this.pellets = pellets;
        return this;
    }

    setAmmoConsumption(ammoConsumption) {
        this.ammoConsumption = ammoConsumption;
        return this;
    }

    setFireRate(fireRate) {
        this.fireRate = fireRate;
        return this;
    }

    setCriticalChance(criticalChance) {
        this.criticalChance = criticalChance;
        return this;
    }

    setCriticalMultiplier(criticalMultiplier) {
        this.criticalMultiplier = criticalMultiplier;
        return this;
    }

    setStatusChance(statusChance) {
        this.statusChance = statusChance;
        return this;
    }

    setIsBeam(isBeam) {
        this.isBeam = isBeam;
        return this;
    }

    setChargeDelay(chargeDelay) {
        this.chargeDelay = chargeDelay;
        return this;
    }

    getOriginalBaseDamage() {
        return this.originalBaseDamage;
    }

    setOriginalBaseDamage(originalBaseDamage) {
        this.originalBaseDamage = originalBaseDamage;
        return this;
    }

    setResiduals(residuals) {
        this.residuals = residuals;
        return this;
    }
}

module.exports = {
    WeaponFiringMode
}