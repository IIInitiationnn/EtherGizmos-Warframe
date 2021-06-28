const {WeaponFiringMode} = require('./weapon-firing-mode');

class Weapon {
    constructor() {
        this.id = undefined;
        this.name = undefined;
        this.image = undefined;
        this.mastery = undefined;

        /** @type {number[]} - First value is the weapon type */
        this.modTypes = [];

        this.baseMagazineSize = undefined;
        this.baseReloadDuration = undefined;

        /** @type {WeaponFiringMode[]} - Contains the stats of the weapon according to firing mode */
        this.firingModes = [];
    }

    /**
     * Convert Weapon object into JSON string.
     * @returns {string}
     */
    toObject() {
        return JSON.stringify(this);
    }

    /**
     * Convert JSON object string into object with Weapon prototype.
     * @param {string} object
     * @returns {Weapon}
     */
    static fromObject(object) {
        let plainObject = JSON.parse(object);

        // Custom class object
        for (let i = 0; i < plainObject.firingModes.length; i++) {
            plainObject.firingModes[i] = WeaponFiringMode.fromObject(JSON.stringify(plainObject.firingModes[i]));
        }

        return Object.setPrototypeOf(plainObject, Weapon.prototype)
    }

    /**
     * Returns a Weapon from its ID.
     * @param id
     * @returns {Promise<Weapon>}
     */
    static async fromID(id) {
        if (id == null) return null;
        const {getWeapons} = require('../data/game');
        let weaponData = await getWeapons();
        return weaponData[id];
    }

    setID(id) {
        this.id = id;
        return this;
    }

    setName(name) {
        this.name = name;
        return this;
    }

    setImage(image) {
        this.image = image;
        return this;
    }

    setMastery(mastery) {
        this.mastery = mastery;
        return this;
    }

    getWeaponType() {
        return this.modTypes[0];
    }

    setModTypes(modTypes) {
        this.modTypes = modTypes;
        return this;
    }

    setBaseMagazineSize(baseMagazineSize) {
        this.baseMagazineSize = baseMagazineSize;
        return this;
    }

    setBaseReloadDuration(baseReloadDuration) {
        this.baseReloadDuration = baseReloadDuration;
        return this;
    }

    addFiringMode(firingMode) {
        this.firingModes.push(firingMode);
        return this;
    }

    setFiringMode(index, firingMode) {
        this.firingModes[index] = firingMode;
        return this;
    }

    setFiringModes(firingModes) {
        this.firingModes = firingModes;
        return this;
    }

}

module.exports = {
    Weapon
}