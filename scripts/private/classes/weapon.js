const {WeaponFiringMode} = require('./weapon-firing-mode');
const {Mod, ModInstance} = require('./mod');
const {ModEffectType, isPrimaryElement, elementalModEffectToDamage, elementalModEffectTypes} = require('./magic-types');
const {WeaponDamage} = require('./weapon-damage');
const {replacer, reviver} = require('./map-util');

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
     * Convert JSON object string into object with Weapon prototype.
     * @param {string} object
     * @returns {Weapon}
     */
    static fromObject(object) {
        let plainObject = JSON.parse(object, reviver);

        // Custom class object
        for (let i = 0; i < plainObject.firingModes.length; i++) {
            plainObject.firingModes[i] = WeaponFiringMode.fromObject(JSON.stringify(plainObject.firingModes[i], replacer));
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

class WeaponInstance {
    /**
     *
     * @param {Weapon} weapon
     * @param {ModInstance[]} modInstances
     * @param {number} firingMode
     */
    constructor(weapon, modInstances, firingMode) {
        this.weapon = weapon;
        this.modInstances = modInstances;

        this.kuvaElement = null; // TODO note that this counts as base damage!! check wiki under kuva (variant)
        this.kuvaBonus = null;

        /** Cached modded stats */
        // TODO maybe change this to map as well??
        this.moddedStats = this.getOnlyModdedStats();

        /** @type {number} - Firing mode of choice */
        this.firingModeId = firingMode;

        /** @type {number} - Remaining delay in seconds before the next shot */
        this.currentShotDelay = this.getShotDelay();

        /** @type {number} - Remaining delay in seconds before the next shot is fired */
        this.currentChargeDelay = this.getActiveFiringMode().chargeDelay;

        /** @type {number} - Number of shots remaining in the magazine */
        this.remainingMagazine = this.weapon.baseMagazineSize;

        /** @type {number} - Amount of time in seconds before the weapon is reloaded */
        this.remainingReloadDuration = 0;

        /** @type {Buff[]} - Active weapon buffs. Currently no weapons have buffs before beginning combat. */
        this.buffs = [];
        // TODO new class, should contain the buffed effects as ModEffectType is my guess

        /** @type {WeaponFiringModeResidualInstance[]} Residual effects applied */
        //this.ResidualInstances = [];

    }

    /**
     * Print mods for debugging.
     */
    logMods() {
        let names = [];
        for (let modInstance of this.modInstances) names.push(modInstance.mod.name)
        console.log('Mods for ' + this.weapon.name + ':', names)
    }

    /**
     * Convert WeaponInstance object into JSON string.
     * @returns {string}
     */
    toObject() {
        return JSON.stringify(this, replacer);
    }

    /**
     * Convert JSON object string into object with WeaponInstance prototype.
     * @param {string} object
     * @returns {WeaponInstance}
     */
    static fromObject(object) {
        let plainObject = JSON.parse(object, reviver);

        plainObject.weapon = Weapon.fromObject(JSON.stringify(plainObject.weapon, replacer))
        for (let i = 0; i < plainObject.modInstances.length; i++) {
            plainObject.modInstances[i] = ModInstance.deserialize(JSON.stringify(plainObject.modInstances[i], replacer));
        }

        return Object.setPrototypeOf(plainObject, WeaponInstance.prototype)
    }

    // whatever functions are needed during simulation

    setMod(index, modInstance) {
        this.modInstances[index] = modInstance;
        this.moddedStats = this.getOnlyModdedStats();
    }

    setMods(modInstances) {
        this.modInstances = modInstances;
        this.moddedStats = this.getOnlyModdedStats();
    }

    /**
     * Returns the selected firing mode for this weapon instance.
     * @returns {WeaponFiringMode}
     */
    getActiveFiringMode() {
        return this.weapon.firingModes[this.firingModeId];
    }

    // Relative to base stats i.e. +0.15 indicates 15% buff (1.15), -0.2 represents 20% debuff (0.8).
    getModdedStat(modEffectType) {
        // If the stats weren't affected by the desired mod effect type, just return 0
        // TODO handle if it's lower than -1 in combination with the buff
        return this.moddedStats[modEffectType] || 0;
    }

    /**
     * @private
     * Given a list of the existing combined elements and some unconsidered elements,
     * merge or add these new elements appropriately.
     * @param {Map[]} elementGroups
     * @param {Map<DamageType, number>} elements - The elements to be added to the element groups for combining
     */
    combine_(elementGroups, elements) {
        for (let [damageType, damageValue] of elements.entries()) {
            let success = false;
            for (let elementGroup of elementGroups) {
                let validElements = elementGroup.get("elements");
                if (validElements.includes(damageType)) {
                    /* validElements is a list containing:
                     * (a) 1 primary element
                     * (b) 1 secondary element (e.g. innate element or a secondary element mod like Damzav-Vati)
                     * (c) 2 primary elements and the 1 resulting secondary element.
                     * If the current element is one of these, add the damage */
                    elementGroup.set("damage", elementGroup.get("damage") + damageValue);
                    success = true;
                    break;
                } else if (validElements.length === 1) {
                    /* validElements only has 1 element, and because the last condition fell through,
                     * the current element must be different from it. */
                    if (isPrimaryElement(damageType) && isPrimaryElement(validElements[0])) {
                        // Both the current and existing element are primary, so they can combine
                        elementGroup.get("elements").push(damageType, validElements[0] + damageType);
                        elementGroup.set("damage", elementGroup.get("damage") + damageValue);
                        success = true;
                        break;
                    }
                    /* If the existing is primary and the current is secondary, it obviously cannot be added.
                     * If the existing is secondary and the current is primary, it obviously cannot be added.
                     * If both are secondary, then they must be different, else (b) would have held true above. */
                }
                // Otherwise, validElements does not contain the current element and cannot take it in.
            }

            if (success) continue;

            /* None of the existing lists in elementGroups contain the element. The current damageType can be a:
             * (a) primary element
             * (b) secondary element.
             * In either case, a new list must be created with the element, and a new damage result added.
             */
            let newElementGroup = new Map();
            newElementGroup.set("elements", [damageType]);
            newElementGroup.set("damage", damageValue);
            elementGroups.push(newElementGroup);
        }
    }

    /**
     * Returns WeaponDamage object containing the damage of the base weapon without accounting for mods.
     * @returns {WeaponDamage}
     */
    getBaseDamage() {
        return this.getActiveFiringMode().getOriginalBaseDamage();
    }

    /**
     * Returns WeaponDamage object containing the damage of the base weapon after accounting for damage mods only.
     * @returns {WeaponDamage}
     */
    getModdedBaseDamage() {
        return this.getBaseDamage().multiply(1 + this.getModdedStat(ModEffectType.DAMAGE));
    }

    /**
     * Returns WeaponDamage object containing the damage of the weapon after accounting for mods.
     * This includes physical (IPS), elemental (including combinations) and regular damage mods (not faction).
     * Continuous weapons affected by multishot instead have a chance to do additional damage in multiples of
     * itself every tick (according to fire rate), as well as additional critical hits and status procs.
     * @returns {WeaponDamage}
     */
    getDamage() {
        let originalWeaponDamage = this.getBaseDamage();
        let totalBaseDamage = originalWeaponDamage.totalBaseDamage();

        let innateElementsDamage = originalWeaponDamage.innateElements();

        // TODO IPS mods

        let elementModEffects = elementalModEffectTypes(); // list of ModEffectTypes as numbers
        let moddedElements = new Map(); // map with key DamageType, value damage
        // Check each mod for elemental effects
        for (let modInstance of this.modInstances) {
            if (modInstance === undefined) continue;
            for (let elementModEffect of elementModEffects) {
                // The mod has the elemental effect
                // TODO could optimise this using effects.includes or something: put into function in ModInstance
                let multiplier = modInstance.getRankedEffect(elementModEffect);
                if (multiplier !== undefined) {
                    let damageType = elementalModEffectToDamage(elementModEffect);
                    let existingValue = moddedElements.get(damageType);
                    moddedElements.set(damageType, existingValue === undefined ? totalBaseDamage * multiplier :
                        totalBaseDamage * multiplier + existingValue);
                    break; // TODO does not handle elemental mods with more than one element??
                }
            }
        }

        // All the elemental effects of the mods
        let elementGroups = []; // list of Maps elements:[damageType] damage:number
        this.combine_(elementGroups, moddedElements);
        this.combine_(elementGroups, innateElementsDamage);

        // TODO kuva / tenet bonus

        let moddedWeaponDamage = new WeaponDamage();
        for (let elementGroup of elementGroups) {
            moddedWeaponDamage.add(Math.max(...elementGroup.get("elements")), elementGroup.get("damage"));
        }

        // Damage multiplier from damage mods e.g. Serration, Heavy Caliber
        let damageMultiplier = 1 + this.getModdedStat(ModEffectType.DAMAGE);
        moddedWeaponDamage = moddedWeaponDamage.multiply(damageMultiplier);
        return moddedWeaponDamage;
    }

    /**
     * TODO Double check how multishot on beam weapon works
     *  Maybe have all these return buffed stats??? Then if it's too slow we can split it (including the damage one above)
     *  instead of just + modded stat, have to add the buff stat too, then ensure > -1 --- use (Math.max(0, h) probably
     * @returns {number}
     */
    getPellets() {
        return this.getActiveFiringMode().pellets * (1 + this.getModdedStat(ModEffectType.MULTISHOT));
    }

    /**
     * Fetch the modded critical chance of the weapon on its current firing mode.
     * Type 20.
     * @returns {number}
     */
    getCriticalChance() {
        return this.getActiveFiringMode().criticalChance * (1 + this.getModdedStat(ModEffectType.CRITICAL_CHANCE));
    }

    /**
     * Fetch the modded critical multiplier of the weapon on its current firing mode.
     * Type 21.
     * @returns {number}
     */
    getCriticalMultiplier() {
        return this.getActiveFiringMode().criticalMultiplier * (1 + this.getModdedStat(ModEffectType.CRITICAL_DAMAGE));
    }

    /**
     * Fetch the modded status chance of the weapon on its current firing mode.
     * Type 22 and 24.
     * @returns {number}
     */
    getStatusChance() {
        return this.getActiveFiringMode().statusChance * (1 + this.getModdedStat(ModEffectType.STATUS_CHANCE)) +
            this.getModdedStat(ModEffectType.STATUS_CHANCE_ADDITIVE);
    }

    /**
     * Fetch the modded status duration multiplier of the weapon on its current firing mode.
     * Type 23.
     * @returns {number}
     */
    getStatusDurationMultiplier() {
        return 1 + this.getModdedStat(ModEffectType.STATUS_DURATION);
    }

    /**
     * Fetch the electric damage multiplier of the weapon on its current firing mode.
     * Type 41.
     * @returns {number}
     */
    getElectricMultiplier() {
        return 1 + this.getModdedStat(ModEffectType.ELECTRIC);
    }

    /**
     * Fetch the heat damage multiplier of the weapon on its current firing mode.
     * Type 42.
     * @returns {number}
     */
    getHeatMultiplier() {
        return 1 + this.getModdedStat(ModEffectType.HEAT);
    }

    /**
     * Fetch the toxin damage multiplier of the weapon on its current firing mode.
     * Type 43.
     * @returns {number}
     */
    getToxinMultiplier() {
        return 1 + this.getModdedStat(ModEffectType.TOXIN);
    }

    /**
     * Fetch the modded fire rate of the weapon on its current firing mode.
     * Type 60.
     * @returns {number}
     */
    getFireRate() {
        return this.getActiveFiringMode().fireRate * (1 + this.getModdedStat(ModEffectType.FIRE_RATE));
    }

    // FIRE_RATE: 60,
    getChargeDelay() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'ChargeDelay', function() {
            return MAIN.BaseChargeDelay / (1 + MAIN.$_GetModdedProperty(ModEffect.FIRE_RATE));
        });
    }

    getBaseChargeDelay() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'BaseChargeDelay', function() {
            return MAIN.FiringMode.ChargeDelay;
        });
    }

    /**
     * Fetch the modded shot delay of the weapon on its current firing mode.
     * Type 60.
     * @returns {number} Delay in seconds between shots.
     */
    getShotDelay() {
        let moddedFireRate = this.getFireRate();
        return moddedFireRate > 0 ? (1 / moddedFireRate) : 0;
    }

    /**
     * Fetch the modded reload duration of the weapon on its current firing mode.
     * Type 61.
     * @returns {number} Time to reload a full magazine.
     */
    getReloadDuration() {
        return this.weapon.baseReloadDuration / (1 + this.getModdedStat(ModEffectType.RELOAD_SPEED));
    }

    // MAGAZINE_CAPACITY: 62,
    // MAGAZINE_CAPACITY_ADDITIVE: 90,
    getMagazineSize() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'MagazineSize', function() {
            return MAIN.BaseMagazineSize * (1 + MAIN.$_GetModdedProperty(ModEffect.MAGAZINE_CAPACITY)) + MAIN.$_GetModdedProperty(ModEffect.MAGAZINE_CAPACITY_ADDITIVE);
        });
    }

    getAmmoConsumption() {
        return this.getActiveFiringMode().ammoConsumption;
    }

    // AMMO_CAPACITY: 63,
    getMaximumAmmo() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'MaximumAmmo', function() {
            return MAIN.BaseMaximumAmmo * (1 + MAIN.$_GetModdedProperty(ModEffect.AMMO_CAPACITY));
        });
    }

    // BANE_OF_GRINEER: 70,
    // DAMAGE_TO_GRINEER: 70,
    getDamageToGrineer() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'DamageToGrineer', function() {
            return MAIN.BaseDamageToGrineer + MAIN.$_GetModdedProperty(ModEffect.DAMAGE_TO_GRINEER);
        });
    }

    getBaseDamageToGrineer() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'BaseDamageToGrineer', function() {
            return 1;
        });
    }

    // BANE_OF_CORPUS: 71,
    // DAMAGE_TO_CORPUS: 71,
    getDamageToCorpus() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'DamageToCorpus', function() {
            return MAIN.BaseDamageToCorpus + MAIN.$_GetModdedProperty(ModEffect.DAMAGE_TO_CORPUS);
        });
    }

    getBaseDamageToCorpus() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'BaseDamageToCorpus', function() {
            return 1;
        });
    }

    // BANE_OF_INFESTED: 72,
    // DAMAGE_TO_INFESTED: 72,
    getDamageToInfested() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'DamageToInfested', function() {
            return MAIN.BaseDamageToInfested + MAIN.$_GetModdedProperty(ModEffect.DAMAGE_TO_INFESTED);
        });
    }

    getBaseDamageToInfested() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'BaseDamageToInfested', function() {
            return 1;
        });
    }

    // BANE_OF_CORRUPTED: 73,
    // DAMAGE_TO_CORRUPTED: 73,
    getDamageToCorrupted() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'DamageToCorrupted', function() {
            return MAIN.BaseDamageToCorrupted + MAIN.$_GetModdedProperty(ModEffect.DAMAGE_TO_CORRUPTED);
        });
    }

    getBaseDamageToCorrupted() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'BaseDamageToCorrupted', function() {
            return 1;
        });
    }

    // PUNCH_THROUGH: 80,
    getPunchThrough() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'PunchThrough', function() {
            return MAIN.BasePunchThrough + MAIN.$_GetModdedProperty(ModEffect.PUNCH_THROUGH);
        });
    }

    getBasePunchThrough() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'BasePunchThrough', function() {
            return 0;
        });
    }

    // ACCURACY: 81,
    getAccuracy() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'Accuracy', function() {
            return MAIN.BaseAccuracy + MAIN.$_GetModdedProperty(ModEffect.ACCURACY);
        });
    }

    getBaseAccuracy() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'BaseAccuracy', function() {
            return 0;
        });
    }

    // SPREAD: 82,
    getSpread() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'Spread', function() {
            return MAIN.BaseSpread + MAIN.$_GetModdedProperty(ModEffect.SPREAD);
        });
    }

    getBaseSpread() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'BaseSpread', function() {
            return 0;
        });
    }

    // RECOIL: 83,
    getRecoil() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'Recoil', function() {
            return MAIN.BaseRecoil + MAIN.$_GetModdedProperty(ModEffect.RECOIL);
        });
    }

    getBaseRecoil() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'BaseRecoil', function() {
            return 0;
        });
    }

    // FLIGHT_SPEED: 84,
    getFlightSpeed() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'FlightSpeed', function() {
            return MAIN.BaseFlightSpeed + MAIN.$_GetModdedProperty(ModEffect.FLIGHT_SPEED);
        });
    }

    getBaseFlightSpeed() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'BaseFlightSpeed', function() {
            return 1;
        });
    }

    getHeadshotMultiplier(enemyHeadshotMultiplier) {
        return enemyHeadshotMultiplier * (1 + this.getModdedStat(ModEffectType.HEADSHOT_DAMAGE));
    }

    // FIRST_SHOT_DAMAGE: 101,
    getFirstShotDamage() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'FirstShotDamage', function() {
            return 1 + MAIN.$_GetModdedProperty(ModEffect.FIRST_SHOT_DAMAGE);
        });
    }

    // LAST_SHOT_DAMAGE: 102,
    getLastShotDamage() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'LastShotDamage', function() {
            return 1 + MAIN.$_GetModdedProperty(ModEffect.LAST_SHOT_DAMAGE);
        });
    }

    // EXPLOSION_CHANCE: 103,
    getExplosionChance() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'ExplosionChance', function() {
            return 0 + MAIN.$_GetModdedProperty(ModEffect.EXPLOSION_CHANCE);
        });
    }

    // DEAD_AIM: 106,
    getDeadAim() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'DeadAim', function() {
            return 1 + MAIN.$_GetModdedProperty(ModEffect.DEAD_AIM);
        });
    }

    // AMMO_EFFICIENCY: 107,
    getAmmoEfficiency() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'DeadAim', function() {
            return 0 + MAIN.$_GetModdedProperty(ModEffect.AMMO_EFFICIENCY);
        });
    }

    // BODYSHOT_DAMAGE: 127,
    getBodyshotMultiplier() {
        return 1 + this.getModdedStat(ModEffectType.BODYSHOT_DAMAGE);
    }

    // Not specific to any faction at the moment, this function will be removed when faction multipliers become
    // specific to the faction of the enemy.
    getFactionMultiplier() {
        return 1 + Math.max(this.getModdedStat(ModEffectType.DAMAGE_TO_GRINEER),
            this.getModdedStat(ModEffectType.DAMAGE_TO_CORPUS),
            this.getModdedStat(ModEffectType.DAMAGE_TO_INFESTED),
            this.getModdedStat(ModEffectType.DAMAGE_TO_CORRUPTED));
    }

    /**
     * At the moment, no weapons have any pre-installed Hunter Munitions effects.
     * @returns {number}
     */
    getHunterMunitionsEffect() {
        return this.getModdedStat(ModEffectType.HUNTER_MUNITIONS_EFFECT);
    }

    /**
     * At the moment, no weapons have any pre-installed Internal bleeding effects.
     * @returns {number}
     */
    getInternalBleedingEffect() {
        let bleeding = this.getModdedStat(ModEffectType.INTERNAL_BLEEDING_EFFECT);
        return (this.getFireRate() < 2.5) ? 2 * bleeding : bleeding;
    }

    /**
     * At the moment, no weapons have any pre-installed Vigilante effects.
     * @returns {number}
     */
    getVigilanteSetEffect() {
        return this.getModdedStat(ModEffectType.VIGILANTE_SET_EFFECT);
    }

    // CONVECTRIX_EFFICIENCY: 421,
    getAugmentConvectrixEfficiency() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'AugmentConvectrixEfficiency', function() {
            return 0 + MAIN.$_GetModdedProperty(ModEffect.CONVECTRIX_EFFICIENCY);
        });
    }

    // LATRON_NEXT_SHOT_BONUS: 423,
    getAugmentLatronNextShotBonus() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'AugmentLatronNextShotBonus', function() {
            return 0 + MAIN.$_GetModdedProperty(ModEffect.LATRON_NEXT_SHOT_BONUS);
        });
    }

    // This exists for the damage bonus added by the buff, when it applies. LATRON_NEXT_SHOT_BONUS refers to the buff bonus per stage.
    // LATRON_NEXT_SHOT_BONUS_BUFF: 423.5,
    getAugmentLatronNextShotBonusBuff() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'AugmentLatronNextShotBonusBuff', function() {
            return 1 + MAIN.$_GetModdedProperty(ModEffect.LATRON_NEXT_SHOT_BONUS_BUFF);
        });
    }

    // DAIKYU_DISTANCE_DAMAGE: 424,
    getAugmentDaikyuDistanceDamageBonus() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'AugmentDaikyuDistanceDamageBonus', function() {
            return MAIN.$_GetModdedProperty(ModEffect.DAIKYU_DISTANCE_DAMAGE) > 0
                ? 1.4  //If the mod bonus exists, it's always 140%
                : 1.0; //If the mod bonus doesn't exist, it's 100%
        });
    }

    // SOMA_PRIME_HIT_CRITICAL: 426,
    getAugmentSomaPrimeHitCriticalChance() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'AugmentSomaPrimeHitCriticalChance', function() {
            return 0 + MAIN.$_GetModdedProperty(ModEffect.SOMA_PRIME_HIT_CRITICAL);
        });
    }





    /**
     * Returns an object mapping keys (ModEffectType id's) to their strength.
     * These stats are static (they do not change over time).
     * Use getOnlyBuffedStats() for dynamic stat changes, such as those caused by Condition Overload and Hata-Satya.
     * @returns {Object.<number, number>} - Key: ModEffectType. Value: number representing increase / decrease.
     */
    getOnlyModdedStats() {
        let moddedStats = {};

        for (let modInstance of this.modInstances) {
            if (modInstance === undefined) continue;
            for (let [modEffectType, modEffectValue] of modInstance.getRankedEffects().entries()) {
                moddedStats[modEffectType] = moddedStats[modEffectType] + modEffectValue || modEffectValue;
            }
        }

        // TODO move this conditional checker to the loop, since it would be inaccurate if
        //  something went to -1.1 but then a buff restored it to -0.9, but then because of this it became -0.8
        // Can only ever lose 100% on a particular stat; stats should not be able to be negative
        /*for (let [modEffectType, modEffectValue] of Object.entries(moddedStats)) {
            if (modEffectValue < -1) moddedStats[modEffectType] = -1;
        }*/
        return moddedStats;
    }



    // TODO
    //  this in combination with getModdedStats will determine the stats of the shot
    //  the moddedStats are static, these change. so have to call this every loop
    /**
     * Returns an object mapping keys (ModEffectType id's) to their strength.
     * These stats are dynamic (they may change over time according to the fight conditions).
     * For examples, see: Condition Overload and Hata-Satya.
     * @returns {Object.<number, number>}
     */
    getOnlyBuffedStats() {
        let buffedStats = {};

        for (let buff of this.buffs) {
            for (let [modEffectType, modEffectValue] of buff.getEffects().entries()) {
                buffedStats[modEffectType] = buffedStats[modEffectType] + modEffectValue || modEffectValue;
            }
        }

        return buffedStats;
    }

    /**
     * Returns the time until the next weapon-related event.
     * @returns {number} duration
     */
    getNextEventTimeStep() {
        let time;
        if (this.remainingReloadDuration > 0) {
            // If the weapon is inactive until the next reload, return the remaining time until the reload.
            time = this.remainingReloadDuration;
        } else {
            // Otherwise, find the time until the next shot.
            time = Math.max(this.currentShotDelay, this.currentChargeDelay);
        }
        for (let buff of this.buffs) {
            time = Math.min(time, buff.remainingDuration);
        }
        return time;
    }

    /**
     * Progress the weapon's event timers by the specified duration.
     * @param {number} duration
     */
    advanceTimeStep(duration) {
        if (this.remainingReloadDuration > 0) {
            this.remainingReloadDuration = Math.max(this.remainingReloadDuration - duration, 0);

            // Time step was enough for weapon to finish reloading.
            if (this.remainingReloadDuration === 0) {
                this.reload();
            }
        }
        this.currentShotDelay = Math.max(this.currentShotDelay - duration, 0);
        this.currentChargeDelay = Math.max(this.currentChargeDelay - duration, 0);
        // TODO for all buffs, advance their timer (and refresh their status if needed)
        //  just call buff.advanceTimeStep() to handle it
    }

    // TODO for charged weapons, currentshotdelay is irrelevant (should be 0) and the charge delay should be
    //  based on modded stats, as should the shotDelay above in the constructor
    //  see https://warframe.fandom.com/wiki/Fire_Rate - this should definitely be fixed soon
    canShoot() {
        return this.remainingReloadDuration === 0 && this.currentShotDelay === 0 && this.currentChargeDelay === 0;
    }

    reload() {
        this.remainingMagazine = this.weapon.baseMagazineSize;
        this.currentShotDelay = 0;
        this.currentChargeDelay = 0;
    }

}

module.exports = {
    Weapon,
    WeaponInstance
}