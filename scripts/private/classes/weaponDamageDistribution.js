const {isElement, DAMAGE_TYPE} = require('../utils/magicTypes');
const {replacer, reviver} = require('../utils/mapUtils');

class WeaponDamageDistribution extends Map {
    constructor() {
        super();
        this.set(DAMAGE_TYPE.IMPACT, 0);
        this.set(DAMAGE_TYPE.PUNCTURE, 0);
        this.set(DAMAGE_TYPE.SLASH, 0);
        this.set(DAMAGE_TYPE.COLD, 0);
        this.set(DAMAGE_TYPE.ELECTRIC, 0);
        this.set(DAMAGE_TYPE.HEAT, 0);
        this.set(DAMAGE_TYPE.TOXIN, 0);
        this.set(DAMAGE_TYPE.BLAST, 0);
        this.set(DAMAGE_TYPE.CORROSIVE, 0);
        this.set(DAMAGE_TYPE.GAS, 0);
        this.set(DAMAGE_TYPE.MAGNETIC, 0);
        this.set(DAMAGE_TYPE.RADIATION, 0);
        this.set(DAMAGE_TYPE.VIRAL, 0);
        this.set(DAMAGE_TYPE.TRUE, 0);
        this.set(DAMAGE_TYPE.VOID, 0);
    }

    /**
     *
     * @returns {WeaponDamageDistribution}
     */
    clone() {
        return Object.setPrototypeOf(JSON.parse(JSON.stringify(this, replacer), reviver), WeaponDamageDistribution.prototype);
    }

    getToxin() {
        return this.get(DAMAGE_TYPE.TOXIN);
    }

    isZero() {
        return this.totalBaseDamage() === 0;
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
     * @returns {Map<DAMAGE_TYPE, number>}
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

    /**
     *
     * @param multiplier
     * @returns {WeaponDamageDistribution}
     */
    multiply(multiplier) {
        let multiplied = this.clone();
        for (let [damageType, damageValue] of this.entries()) {
            multiplied.set(damageType, damageValue * multiplier);
        }
        return multiplied;
    }

    /**
     * Randomly select status effect(s) using this damage distribution.
     * @returns {DAMAGE_TYPE[]}
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
     * @returns {WeaponDamageDistribution}
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
     * @returns {WeaponDamageDistribution}
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

    /**
     *
     * @param {ResistanceType} armorType
     * @param {number} enemyArmor
     * @returns {WeaponDamageDistribution}
     */
    afterNetArmorResistances(armorType, enemyArmor) {
        // General armor damage reduction = Net Armor / (Net Armor + 300)
        // so multiplier = (1 - reduction) = 300 / (Net Armor + 300)
        let damageAfterResistances = this.clone();
        if (armorType == null || enemyArmor === 0) return damageAfterResistances;
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
     * @returns {WeaponDamageDistribution}
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
        this.set(DAMAGE_TYPE.IMPACT, parseFloat(impact));
        return this;
    }

    setPuncture(puncture) {
        this.set(DAMAGE_TYPE.PUNCTURE, parseFloat(puncture));
        return this;
    }

    setSlash(slash) {
        this.set(DAMAGE_TYPE.SLASH, parseFloat(slash));
        return this;
    }

    setCold(cold) {
        this.set(DAMAGE_TYPE.COLD, parseFloat(cold));
        return this;
    }

    setElectric(electric) {
        this.set(DAMAGE_TYPE.ELECTRIC, parseFloat(electric));
        return this;
    }

    setHeat(heat) {
        this.set(DAMAGE_TYPE.HEAT, parseFloat(heat));
        return this;
    }

    setToxin(toxin) {
        this.set(DAMAGE_TYPE.TOXIN, parseFloat(toxin));
        return this;
    }

    setBlast(blast) {
        this.set(DAMAGE_TYPE.BLAST, parseFloat(blast));
        return this;
    }

    setCorrosive(corrosive) {
        this.set(DAMAGE_TYPE.CORROSIVE, parseFloat(corrosive));
        return this;
    }

    setGas(gas) {
        this.set(DAMAGE_TYPE.GAS, parseFloat(gas));
        return this;
    }

    setMagnetic(magnetic) {
        this.set(DAMAGE_TYPE.MAGNETIC, parseFloat(magnetic));
        return this;
    }

    setRadiation(radiation) {
        this.set(DAMAGE_TYPE.RADIATION, parseFloat(radiation));
        return this;
    }

    setViral(viral) {
        this.set(DAMAGE_TYPE.VIRAL, parseFloat(viral));
        return this;
    }

    setTrue(trueD) {
        this.set(DAMAGE_TYPE.TRUE, parseFloat(trueD));
        return this;
    }

    setVoid(voidD) {
        this.set(DAMAGE_TYPE.VOID, parseFloat(voidD));
        return this;
    }

    /**
     * Sum a list of damage distributions into once distribution
     * @param {WeaponDamageDistribution[]} weaponDamageDistributions
     * @returns {WeaponDamageDistribution} - Sum of all the damage distributions
     */
    static coalesce(weaponDamageDistributions) {
        let sum = new WeaponDamageDistribution();
        for (let dmgDist of weaponDamageDistributions) {
            for (let [damageType, damageValue] of dmgDist.entries()) {
                sum.add(damageType, damageValue);
            }
        }
        return sum;
    }

    /**
     * Precalculate distributions accounting for health, armor and shield resistances.
     * Significantly reduces simulation execution time.
     * @param {WeaponDamageDistribution} damageDistribution
     * @param {Enemy} enemy
     * @returns {Map<String, WeaponDamageDistribution> | Map<String, Map<number, WeaponDamageDistribution>>}
     */
    static precalculate(damageDistribution, enemy) {
        let dmgDists = new Map();
        dmgDists.set('noModifiers', damageDistribution);
        dmgDists.set('afterHealth', damageDistribution.afterHealthResistances(enemy.getHealthType()));
        dmgDists.set('afterArmorType+Health', dmgDists.get('afterHealth').afterArmorTypeResistances(enemy.getArmorType()));
        dmgDists.set('afterShield', damageDistribution.afterShieldResistances(enemy.getShieldType()));

        dmgDists.set('armoredHealthCache', new Map());
        return dmgDists;
    }

    /**
     *
     * @param distributions
     * @param {EnemyInstance} enemyInstance
     * @param {boolean} isShieldDamage - If the damage distribution is to be dealt to shields.
     * @returns {WeaponDamageDistribution}
     */
    static fromEnemyState(distributions, enemyInstance, isShieldDamage) {
        if (enemyInstance.hasShields() && isShieldDamage) {
            return distributions.get('afterShield');
        } else {
            if (enemyInstance.hasArmor()) {
                let cache = distributions.get('armoredHealthCache');

                let cachedArmor = cache.get(enemyInstance.getArmor());
                if (cachedArmor === undefined) {
                    let dmg = distributions.get('afterArmorType+Health')
                        .afterNetArmorResistances(enemyInstance.getEnemy().getArmorType(), enemyInstance.getArmor())
                    cache.set(enemyInstance.getArmor(), dmg);
                    return dmg;
                } else {
                    return cachedArmor;
                }
            } else {
                return distributions.get('afterHealth')
            }
        }
    }

}

module.exports = {
    WeaponDamageDistribution
}