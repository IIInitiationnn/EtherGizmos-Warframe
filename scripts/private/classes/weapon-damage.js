const {isElement, DamageType} = require('./magic-types');
const {replacer, reviver} = require('./map-util');

class WeaponDamage extends Map {
    constructor() {
        super();
        this.set(DamageType.IMPACT, 0);
        this.set(DamageType.PUNCTURE, 0);
        this.set(DamageType.SLASH, 0);
        this.set(DamageType.COLD, 0);
        this.set(DamageType.ELECTRIC, 0);
        this.set(DamageType.HEAT, 0);
        this.set(DamageType.TOXIN, 0);
        this.set(DamageType.BLAST, 0);
        this.set(DamageType.CORROSIVE, 0);
        this.set(DamageType.GAS, 0);
        this.set(DamageType.MAGNETIC, 0);
        this.set(DamageType.RADIATION, 0);
        this.set(DamageType.VIRAL, 0);
        this.set(DamageType.TRUE, 0);
        this.set(DamageType.VOID, 0);
    }

    /**
     *
     * @returns {WeaponDamage}
     */
    clone() {
        return Object.setPrototypeOf(JSON.parse(JSON.stringify(this, replacer), reviver), WeaponDamage.prototype);
    }

    totalBaseDamage() {
        let sum = 0;
        for (let damageValue of this.values()) sum += damageValue;
        return sum;
        // TODO kuva / tenet bonus counts to base damage
    }

    /**
     * Finds all the innate elements (4 primary and 6 secondary) as well as their damage.
     * Key: damage type. Value: damage.
     * @returns {Map<DamageType, number>}
     */
    innateElements() {
        let elements = new Map();
        for (let [damageType, damageValue] of this.entries()) {
            if (damageValue !== 0 && isElement(damageType)) {
                elements.set(damageType, damageValue);
            }
        }
        return elements;
    }

    add(damageType, damageValue) {
        this.set(damageType, this.get(damageType) + damageValue);
    }

    multiply(multiplier) {
        let multiplied = this.clone();
        for (let [damageType, damageValue] of this.entries()) {
            multiplied.set(damageType, damageValue * multiplier);
        }
        return multiplied;
    }

    /**
     * Randomly select status effect(s) using this damage distribution.
     * @returns {DamageType[]}
     */
    randomStatus(num = 1) {
        let statuses = [];
        for (let i = 0; i < num; i++) {
            let total = 0;
            let target = Math.random() * this.totalBaseDamage();
            for (let [damageType, damageValue] of this.entries()) {
                total += damageValue;
                if (total >= target) {
                    statuses.push(damageType);
                    break;
                }
            }
        }
        return statuses;
    }

    /**
     *
     * @param {ResistanceType} healthType
     * @returns {WeaponDamage}
     */
    afterHealthResistances(healthType) {
        let damageAfterResistances = this.clone();
        for (let [damageType, damageValue] of damageAfterResistances.entries()) {
            damageAfterResistances.set(damageType, damageValue * (1 + healthType.resistances.get(damageType))); // 1 + HM
        }
        //console.log('afterHealthResistances:', damageAfterResistances)
        return damageAfterResistances;
    }

    /**
     *
     * @param {ResistanceType} armorType
     * @returns {WeaponDamage}
     */
    afterArmorTypeResistances(armorType) {
        let damageAfterResistances = this.clone();
        if (armorType == null) return damageAfterResistances;
        for (let [damageType, damageValue] of damageAfterResistances.entries()) {
            damageAfterResistances.set(damageType, damageValue * (1 + armorType.resistances.get(damageType))); // 1 + AM
        }
        //console.log('afterArmorTypeResistances:', damageAfterResistances)
        return damageAfterResistances;
    }

    // TODO note: does not consider complete armor strip
    /**
     *
     * @param {ResistanceType} armorType
     * @param {number} enemyArmor
     * @returns {WeaponDamage}
     */
    afterNetArmorResistances(armorType, enemyArmor) {
        // General armor damage reduction = Net Armor / (Net Armor + 300)
        // so multiplier = 1 - reduction = 300 / (Net Armor + 300)
        let damageAfterResistances = this.clone();
        if (armorType == null) return damageAfterResistances;
        for (let [damageType, damageValue] of damageAfterResistances.entries()) {
            let netArmor = enemyArmor * (1 - armorType.resistances.get(damageType)); // AR * (1 - AM)
            let multiplier = 300 / (300 + netArmor);
            damageAfterResistances.set(damageType, damageValue * multiplier);
        }
        //console.log('afterNetArmorResistances:', damageAfterResistances)
        return damageAfterResistances;
    }

    /**
     *
     * @param {ResistanceType} shieldType
     * @returns {WeaponDamage}
     */
    afterShieldResistances(shieldType) {
        let damageAfterResistances = this.clone();
        if (shieldType == null) return damageAfterResistances;
        for (let [damageType, damageValue] of damageAfterResistances.entries()) {
            damageAfterResistances.set(damageType, damageValue * (1 + shieldType.resistances.get(damageType)));
        }
        return damageAfterResistances;
    }

    setImpact(impact) {
        this.set(DamageType.IMPACT, parseFloat(impact));
        return this;
    }

    setPuncture(puncture) {
        this.set(DamageType.PUNCTURE, parseFloat(puncture));
        return this;
    }

    setSlash(slash) {
        this.set(DamageType.SLASH, parseFloat(slash));
        return this;
    }

    setCold(cold) {
        this.set(DamageType.COLD, parseFloat(cold));
        return this;
    }

    setElectric(electric) {
        this.set(DamageType.ELECTRIC, parseFloat(electric));
        return this;
    }

    setHeat(heat) {
        this.set(DamageType.HEAT, parseFloat(heat));
        return this;
    }

    setToxin(toxin) {
        this.set(DamageType.TOXIN, parseFloat(toxin));
        return this;
    }

    setBlast(blast) {
        this.set(DamageType.BLAST, parseFloat(blast));
        return this;
    }

    setCorrosive(corrosive) {
        this.set(DamageType.CORROSIVE, parseFloat(corrosive));
        return this;
    }

    setGas(gas) {
        this.set(DamageType.GAS, parseFloat(gas));
        return this;
    }

    setMagnetic(magnetic) {
        this.set(DamageType.MAGNETIC, parseFloat(magnetic));
        return this;
    }

    setRadiation(radiation) {
        this.set(DamageType.RADIATION, parseFloat(radiation));
        return this;
    }

    setViral(viral) {
        this.set(DamageType.VIRAL, parseFloat(viral));
        return this;
    }

    setTrue(trueD) {
        this.set(DamageType.TRUE, parseFloat(trueD));
        return this;
    }

    setVoid(voidD) {
        this.set(DamageType.VOID, parseFloat(voidD));
        return this;
    }

}

module.exports = {
    WeaponDamage
}