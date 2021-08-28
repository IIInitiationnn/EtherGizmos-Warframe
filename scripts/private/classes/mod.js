const {usefulModEffectTypes} = require("./magic-types");
const {replacer, reviver} = require('./map-util');
// const superconsole = require('../../../../../scripts/logging/superconsole');
// const avro = require('avsc');

class Mod {
    constructor() {
        this.id = undefined;
        this.name = undefined;
        this.image = undefined;
        this.rarity = undefined;
        this.modType = undefined;
        this.minDrain = undefined;
        this.maxRank = undefined;
        this.polarity = undefined;

        /** @type {Map<ModEffectType, number>} - ModEffectType: Power */
        this.effects = new Map();

        /** @type {Map<number, Map<ModEffectType, number>>} - Rank: {ModEffectType: Power} */
        this.effectsRanked = new Map();

        /** @type {Map<ModEffectType, string>} ModEffectType: Description */
        this.effectDescriptions = new Map();
    }

    /**
     * Convert Mod object into JSON string.
     * @returns {string}
     */
    serialize() {
        return JSON.stringify(this)
    }

    /**
     * Convert JSON object string into object with Mod prototype.
     * @param {string} object
     * @returns {Mod}
     */
    static deserialize(object) {
        let plainObject = JSON.parse(object, reviver);
        return Object.setPrototypeOf(plainObject, Mod.prototype);
    }

    /**
     * Returns a Mod from its ID.
     * @param id
     * @returns {Promise<void>}
     */
    static async fromID(id) {
        if (id == null) return null;
        const {getMods} = require("../data/game");
        let modData = await getMods();
        return modData[id];

        /* Move this to modinstance, this is irrelevant for the more static mod class
        let mod = modData[id];
        if (mod == null) {
            superconsole.log(superconsole.MessageLevel.ERROR,
                `$red:Found a mod that doesn't exist: $white,bright{${id}}`);
            return null;
        }

        let applyEffects;
        if (id.indexOf('@') > -1) {
            applyEffects = id.split('@')[1];
            id = id.split('@')[0];
        }

        // set rank of mod to max

        if (applyEffects !== undefined) {
            applyEffects = applyEffects.split('&');
            for (let a = 0; a < applyEffects.length; a++) {
                let type = applyEffects[a].substring(0, applyEffects[a].indexOf(':'));
                let effect = applyEffects[a].substring(applyEffects[a].indexOf(':') + 1, applyEffects[a].length);

                switch (type) {
                    case ('r'):
                        let rankNumber = parseInt(effect);
                        if (!isNaN(rankNumber)) {
                            mod.SetRank(rankNumber);
                        }
                        break;

                    case ('e'):
                        if (id !== 'riven-mod') break;

                        let modEffects = effect.split(';');
                        for (let e = 0; e < modEffects.length; e++) {
                            let modEffect = modEffects[e];
                            let modEffectType = modEffect.split(':')[0];
                            let modEffectPower = parseFloat(modEffect.split(':')[1]);

                            if (Number.isNaN(modEffectType) || isNaN(modEffectPower)) continue;

                            if (modEffectType != null && modEffectPower != null) {
                                mod.AddEffect(modEffectType, modEffectPower, '');
                            }
                        }
                        break;
                }
            }
        }
        return mod;*/
    }

    getID() {
        return this.id;
    }

    getMaxRank() {
        return this.maxRank;
    }

    /**
     *
     * @returns {Map<ModEffectType, number>}
     */
    getEffects() {
        return this.effects;
    }

    /**
     *
     * @param {ModEffectType} effectType
     * @returns {number}
     */
    getEffect(effectType) {
        return this.effects.get(effectType);
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

    setRarity(rarity) {
        this.rarity = rarity;
        return this;
    }

    setModType(modType) {
        this.modType = modType;
        return this;
    }

    setMinDrain(minDrain) {
        this.minDrain = minDrain;
        return this;
    }

    setMaxRank(maxRank) {
        this.maxRank = maxRank;
        return this;
    }

    addEffect(modEffectType, power = 0) {
        this.effects.set(modEffectType, power);
        return this;
    }

    setEffects(effects) {
        this.effects = effects;
        return this;
    }

    addEffectRanked(rank, modEffectType, power = 0) {
        let existing = this.effectsRanked.get(rank);
        this.effectsRanked.set(rank, existing === undefined ? new Map() : existing);
        this.effectsRanked.get(rank).set(modEffectType, power);
        return this;
    }

    addEffectDescription(modEffectType, description) {
        if (description != null) this.effectDescriptions.set(modEffectType, description);
        return this;
    }

    setEffectDescriptions(effectDescriptions) {
        this.effectDescriptions = effectDescriptions;
        return this;
    }

    setPolarity(polarity) {
        this.polarity = polarity;
        return this;
    }

    isCompatibleWithWeapon(weapon) {
        return weapon.modTypes.indexOf(this.modType) >= 0 || this.modType === 9999;

    }

    /**
     *
     * @param {Weapon} weapon - The weapon type for which compatible mods will be returned.
     * @param {boolean} removeUselessMods - Whether or not to ignore mods which will not affect the simulation.
     * @returns {Mod[]} - A list of mods which are compatible with this weapon.
     */
    static async getValidModsFor(weapon, removeUselessMods = true) {
        const {getMods} = require('../data/game');

        /** @type Mod[] */
        let validMods = [];

        for (let mod of Object.values(await getMods())) {
            // Filter out all the mods incompatible with the WEAPON
            if (mod.isCompatibleWithWeapon(weapon)) validMods.push(mod);
        }

        if (removeUselessMods) {
            let usefulEffects = usefulModEffectTypes();
            for (let i = 0; i < validMods.length; i++) {
                // If the mod does not contain any effects deemed useful, remove it from the valid mods list
                if (!usefulEffects.some(effectType => Object.keys(validMods[i].effects).includes(effectType.toString()))) {
                    validMods.slice(i, 1);
                }
            }
        }
        return validMods;
    }
}

class ModInstance {
    constructor(mod) {
        /** @type Mod */
        this.mod = mod;
        this.rank = mod.getMaxRank();
    }

    static async fromModID(id) {
        return new this(await Mod.fromID(id));
    }

    /**
     * Convert ModInstance object into JSON string.
     * @returns {string}
     */
    serialize() {
        return JSON.stringify(this, replacer)
    }

    /**
     * Convert JSON object string into object with ModInstance prototype.
     * @param {string} object
     * @returns {Mod}
     */
    static deserialize(object) {
        let plainObject = JSON.parse(object);
        plainObject.mod = Mod.deserialize(JSON.stringify(plainObject.mod));
        return Object.setPrototypeOf(plainObject, this.prototype)
    }

    /**
     * TODO select according to this.rank
     * @param {number} effectType - See ModEffectType.
     * @returns {number}
     */
    getRankedEffect(effectType) {
        //return this.mod.effectsRanked[effectType];
        return this.mod.getEffect(effectType);
    }

    // TODO select according to this.rank
    getRankedEffects(effectType) {
        //return this.mod.effectsRanked;
        return this.mod.getEffects();
    }

    /**
     * Fetch the base mod.
     * @returns {Mod}
     */
    getMod() {
        return this.mod;
    }

    /**
     * Find the rank of this mod instance.
     * @returns {number}
     */
    getRank() {
        return this.rank;
    }

    /**
     * Set the rank of this mod.
     * @param rank
     * @returns {ModInstance}
     */
    setRank(rank) {
        this.rank = Math.max(Math.min(rank, this.mod.maxRank), 0);
        return this;
    }
}

module.exports = {
    Mod,
    ModInstance
}