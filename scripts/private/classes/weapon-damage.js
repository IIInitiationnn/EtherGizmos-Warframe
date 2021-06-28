const {DamageType} = require('./magic-types');

class WeaponDamage {
    constructor() {
        this[DamageType.IMPACT] = 0;
        this[DamageType.PUNCTURE] = 0;
        this[DamageType.SLASH] = 0;
        this[DamageType.COLD] = 0;
        this[DamageType.ELECTRIC] = 0;
        this[DamageType.HEAT] = 0;
        this[DamageType.TOXIN] = 0;
        this[DamageType.BLAST] = 0;
        this[DamageType.CORROSIVE] = 0;
        this[DamageType.GAS] = 0;
        this[DamageType.MAGNETIC] = 0;
        this[DamageType.RADIATION] = 0;
        this[DamageType.VIRAL] = 0;
        this[DamageType.TRUE] = 0;
        this[DamageType.VOID] = 0;
    }

    /**
     *
     * @returns {WeaponDamage}
     */
    clone() {
        return Object.setPrototypeOf(JSON.parse(JSON.stringify(this)), WeaponDamage.prototype);
    }

    totalBaseDamage() {
        let sum = 0;
        for (let damageType of Object.keys(this)) sum += this[damageType];
        return sum;
    }

    /**
     * Finds all the innate elements (4 primary and 6 secondary) as well as their damage.
     * Key: damage type. Value: damage.
     * @returns {Object.<number, number>}
     */
    innateElements() {
        let elements = {};
        for (let damageType of Object.keys(this)) {
            if (this[damageType] !== 0 && parseFloat(damageType) >= DamageType.COLD && parseFloat(damageType) <= DamageType.GAS) {
                elements[damageType] = this[damageType];
            }
        }
        return elements;
    }

    multiply(multiplier) {
        let multiplied = this.clone();
        for (let damageType of Object.keys(multiplied)) {
            multiplied[damageType] *= multiplier;
        }
        return multiplied;
    }

    /**
     *
     * @param {ResistanceType} healthType
     * @returns {WeaponDamage}
     */
    afterHealthResistances(healthType) {
        let damageAfterResistances = this.clone();
        for (let damageType of Object.keys(damageAfterResistances)) {
            damageAfterResistances[damageType] *= (1 + healthType.resistances[damageType]); // 1 + HM
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
        for (let damageType of Object.keys(this)) {
            damageAfterResistances[damageType] *= (1 + armorType.resistances[damageType]); // 1 + AM
        }
        //console.log('afterArmorTypeResistances:', damageAfterResistances)
        return damageAfterResistances;
    }

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
        for (let damageType of Object.keys(this)) {
            let netArmor = enemyArmor * (1 - armorType.resistances[damageType]); // AR * (1 - AM)
            let multiplier = 300 / (300 + netArmor);
            damageAfterResistances[damageType] *= multiplier;
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
        for (let damageType of Object.keys(this)) {
            damageAfterResistances[damageType] *= (1 + shieldType.resistances[damageType]);
        }
        return damageAfterResistances;
    }

    setImpact(impact) {
        this[DamageType.IMPACT] = parseFloat(impact);
        return this;
    }

    setPuncture(puncture) {
        this[DamageType.PUNCTURE] = parseFloat(puncture);
        return this;
    }

    setSlash(slash) {
        this[DamageType.SLASH] = parseFloat(slash);
        return this;
    }

    setCold(cold) {
        this[DamageType.COLD] = parseFloat(cold);
        return this;
    }

    setElectric(electric) {
        this[DamageType.ELECTRIC] = parseFloat(electric);
        return this;
    }

    setHeat(heat) {
        this[DamageType.HEAT] = parseFloat(heat);
        return this;
    }

    setToxin(toxin) {
        this[DamageType.TOXIN] = parseFloat(toxin);
        return this;
    }

    setBlast(blast) {
        this[DamageType.BLAST] = parseFloat(blast);
        return this;
    }

    setCorrosive(corrosive) {
        this[DamageType.CORROSIVE] = parseFloat(corrosive);
        return this;
    }

    setGas(gas) {
        this[DamageType.GAS] = parseFloat(gas);
        return this;
    }

    setMagnetic(magnetic) {
        this[DamageType.MAGNETIC] = parseFloat(magnetic);
        return this;
    }

    setRadiation(radiation) {
        this[DamageType.RADIATION] = parseFloat(radiation);
        return this;
    }

    setViral(viral) {
        this[DamageType.VIRAL] = parseFloat(viral);
        return this;
    }

    setTrue(trueD) {
        this[DamageType.TRUE] = parseFloat(trueD);
        return this;
    }

    setVoid(voidD) {
        this[DamageType.VOID] = parseFloat(voidD);
        return this;
    }

}

module.exports = {
    WeaponDamage
}