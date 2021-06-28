const {usefulModEffectTypes} = require("./magic-types");
// const superconsole = require('../../../../../scripts/logging/superconsole');

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

        /** @type {Object.<number, number>} - Note that the number key is cast to a string */
        this.effects = {};
        // TODO mod instance with max rank constructor (thats the only field ik rn)

        /** @type {Object.<number, number>} - Rank: {Mod Effect: Power} */
        this.effectsRanked = {};

        /** @type {Object.<number, string>} - Note that the number key is cast to a string */
        this.effectDescriptions = {};
    }

    /**
     * Convert JSON object string into object with Mod prototype.
     * @param {string} object
     * @returns {Mod}
     */
    static fromObject(object) {
        let plainObject = JSON.parse(object);
        return Object.setPrototypeOf(plainObject, Mod.prototype)
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

    /**
     *
     * @returns {Object<number, number>}
     */
    getEffects() {
        return this.effects;
    }

    /**
     *
     * @param {number} effectType - See ModEffectType.
     * @returns {number}
     */
    getEffect(effectType) {
        return this.effects[effectType];
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
        this.maxRank = maxRank; //Math.max(Math.min(maxRank, this.maxRank), 0) use this for modinstance constructor
        return this;
    }

    addEffect(modEffectType, power = 0) {
        this.effects[modEffectType] = power;
        return this;
    }

    setEffects(effects) {
        this.effects = effects;
        return this;
    }

    addEffectRanked(rank, modEffectType, power = 0) {
        this.effectsRanked[rank] = this.effectsRanked[rank] || {};
        this.effectsRanked[rank][modEffectType] = power;
        return this;
    }

    addEffectDescription(modEffectType, description) {
        if (description != null) this.effectDescriptions[modEffectType] = description;
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

module.exports = {
    Mod
}