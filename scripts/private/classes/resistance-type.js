const {WeaponDamageDistribution} = require('./weapon-damage-distribution');

class ResistanceType {
    constructor() {
        this.id = undefined;
        this.name = undefined;
        this.resistances = new WeaponDamageDistribution();
    }

    /**
     * Returns a health type from its ID.
     * @param id
     * @returns {Promise<ResistanceType>}
     */
    static async healthTypeFromID(id) {
        if (id == null) return null;
        const {getHealthTypes} = require('../data/game');
        let healthTypeData = await getHealthTypes();
        return healthTypeData[id];
    }

    /**
     * Returns an armor type from its ID.
     * @param id
     * @returns {Promise<ResistanceType>}
     */
    static async armorTypeFromID(id) {
        if (id == null) return null;
        const {getArmorTypes} = require('../data/game');
        let armorTypeData = await getArmorTypes();
        return armorTypeData[id];
    }

    /**
     * Returns a shield type from its ID.
     * @param id
     * @returns {Promise<ResistanceType>}
     */
    static async shieldTypeFromID(id) {
        if (id == null) return null;
        const {getShieldTypes} = require('../data/game');
        let shieldTypeData = await getShieldTypes();
        return shieldTypeData[id];
    }

    setId(id) {
        this.id = id;
        return this;
    }

    setName(name) {
        this.name = name;
        return this;
    }

    setImpactResistance(impact) {
        this.resistances.setImpact(impact);
        return this;
    }

    setPunctureResistance(puncture) {
        this.resistances.setPuncture(puncture);
        return this;
    }

    setSlashResistance(slash) {
        this.resistances.setSlash(slash);
        return this;
    }

    setColdResistance(cold) {
        this.resistances.setCold(cold);
        return this;
    }

    setElectricResistance(electric) {
        this.resistances.setElectric(electric);
        return this;
    }

    setHeatResistance(heat) {
        this.resistances.setHeat(heat);
        return this;
    }

    setToxinResistance(toxin) {
        this.resistances.setToxin(toxin);
        return this;
    }

    setBlastResistance(blast) {
        this.resistances.setBlast(blast);
        return this;
    }

    setCorrosiveResistance(corrosive) {
        this.resistances.setCorrosive(corrosive);
        return this;
    }

    setGasResistance(gas) {
        this.resistances.setGas(gas);
        return this;
    }

    setMagneticResistance(magnetic) {
        this.resistances.setMagnetic(magnetic);
        return this;
    }

    setRadiationResistance(radiation) {
        this.resistances.setRadiation(radiation);
        return this;
    }

    setViralResistance(viral) {
        this.resistances.setViral(viral);
        return this;
    }

    setTrueResistance(trueD) {
        this.resistances.setTrue(trueD);
        return this;
    }

    setVoidResistance(voidD) {
        this.resistances.setVoid(voidD);
        return this;
    }
}

module.exports = {
    ResistanceType
}