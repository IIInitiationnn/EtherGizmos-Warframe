const {BuildUtils} = require('../utils/buildUtils');
const {DAMAGE_TYPE} = require('../utils/magicTypes');
const {WeaponFiringMode} = require('./weaponFiringMode');
const {ModInstance} = require('./mod');
const {MOD_EFFECT_TYPE, isPrimaryElement, elementalModEffectToDamage, elementalModEffectTypes} = require('../utils/magicTypes');
const {WeaponDamageDistribution} = require('./weaponDamageDistribution');
const {replacer, reviver} = require('../utils/mapUtils');

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
        this.remainingMagazine = this.getWeapon().baseMagazineSize;

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
        console.log('Mods for ' + this.getWeapon().name + ':', names)
    }

    /**
     * Convert WeaponInstance object into JSON string.
     * @returns {string}
     */
    serialize() {
        return JSON.stringify(this, replacer);
    }

    /**
     * Convert JSON object string into object with WeaponInstance prototype.
     * @param {string} object
     * @returns {WeaponInstance}
     */
    static deserialize(object) {
        let plainObject = JSON.parse(object, reviver);

        plainObject.weapon = Weapon.fromObject(JSON.stringify(plainObject.weapon, replacer))
        for (let i = 0; i < plainObject.modInstances.length; i++) {
            plainObject.modInstances[i] = ModInstance.deserialize(JSON.stringify(plainObject.modInstances[i], replacer));
        }

        return Object.setPrototypeOf(plainObject, WeaponInstance.prototype)
    }

    clone() {
        return WeaponInstance.deserialize(this.serialize());
    }

    /**
     * @returns {Weapon}
     */
    getWeapon() {
        return this.weapon;
    }

    /**
     * @returns {ModInstance[]}
     */
    getMods() {
        return this.modInstances;
    }

    /**
     * @returns {string} - String describing the mods
     */
    getBuild() {
        return BuildUtils.toBuildString(this.modInstances);
    }

    /**
     *
     * @param {Mod[]} validMods
     * @returns {ModInstance[]} - List of the random mods.
     */
    getRandomMods(validMods) {
        // TODO in future, use Data.getValidModsFor(this.weapon);
        let randomMods = [];
        for (let i = 0; i < 8; i++) {
            let newMod = new ModInstance(validMods[Math.floor(Math.random() * validMods.length)]);
            while (!newMod.isCompatible(randomMods)) {
                newMod = new ModInstance(validMods[Math.floor(Math.random() * validMods.length)]);
            }
            randomMods.push(newMod);
        }
        return randomMods;
    }

    /**
     *
     * @param {Array} validMods
     * @param {Results} results
     * @param {number} targetNumIterations
     * @returns {WeaponInstance} Weapon with new mod
     */
    async getRandomNeighbor(validMods, results, targetNumIterations) {
        let currentMods = [...this.getMods()];
        let newMods = [...currentMods];
        let position = Math.floor(Math.random() * currentMods.length);
        currentMods.splice(position, 1);

        let weapon = this.getWeapon();
        let validUntestedMods = [...validMods];

        // Remove existing mod, find new compatible mod
        let newMod = new ModInstance(validUntestedMods.splice(Math.floor(Math.random() * validUntestedMods.length), 1)[0]);
        newMods.splice(position, 1, newMod);
        let newWeaponInstance = new WeaponInstance(weapon, newMods, this.firingModeId);

        while (!newMod.isCompatible(currentMods) || BuildUtils.equals(this, newWeaponInstance) ||
            results.iterationsNeeded(newWeaponInstance, targetNumIterations) === 0) {
            newMod = new ModInstance(validUntestedMods.splice(Math.floor(Math.random() * validUntestedMods.length), 1)[0]);
            newMods.splice(position, 1, newMod);
            newWeaponInstance = new WeaponInstance(weapon, newMods, this.firingModeId);

            if (validUntestedMods.length === 0) {
                // TODO: no valid neighbour
                console.log("no valid neighbour");
            }
        }

        // TODO potentially run a round with a build even if iterationsNeeded == 0
        //  since maybe you want to just want to explore the space more
        //  at the moment this is disabled for efficiency; analyse success of maximizer

        return newWeaponInstance;
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
        return this.getWeapon().firingModes[this.firingModeId];
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
     * @param {Map<DAMAGE_TYPE, number>} elements - The elements to be added to the element groups for combining
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
     * @returns {WeaponDamageDistribution}
     */
    getBaseDamage() {
        return this.getActiveFiringMode().getBaseDamageDistribution();
    }

    /**
     * Returns WeaponDamage object containing the damage of the base weapon after accounting for damage mods only.
     * @returns {WeaponDamageDistribution}
     */
    getModdedBaseDamage() {
        return this.getBaseDamage().multiply(1 + this.getModdedStat(MOD_EFFECT_TYPE.DAMAGE));
    }

    /**
     * Returns WeaponDamage object containing the damage of the weapon after accounting for mods.
     * This includes physical (IPS), elemental (including combinations) and regular damage mods (not faction).
     * Continuous weapons affected by multishot instead have a chance to do additional damage in multiples of
     * itself every tick (according to fire rate), as well as additional critical hits and status procs.
     * @returns {WeaponDamageDistribution}
     */
    getDamage() {
        // TODO check that the new changes by having getModdedBaseDamage instead of getBaseDamage have not affected times
        let originalWeaponDamage = this.getModdedBaseDamage();
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

        let moddedWeaponDamage = new WeaponDamageDistribution();

        // IPS TODO integrate with IPS mods
        moddedWeaponDamage.add(DAMAGE_TYPE.IMPACT, originalWeaponDamage.get(DAMAGE_TYPE.IMPACT));
        moddedWeaponDamage.add(DAMAGE_TYPE.PUNCTURE, originalWeaponDamage.get(DAMAGE_TYPE.PUNCTURE));
        moddedWeaponDamage.add(DAMAGE_TYPE.SLASH, originalWeaponDamage.get(DAMAGE_TYPE.SLASH));

        // Elements
        for (let elementGroup of elementGroups) {
            moddedWeaponDamage.add(Math.max(...elementGroup.get("elements")), elementGroup.get("damage"));
        }

        return moddedWeaponDamage;

        /*let originalWeaponDamage = this.getBaseDamage();
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

        let moddedWeaponDamage = new WeaponDamageDistribution();

        // IPS TODO integrate with IPS mods
        moddedWeaponDamage.add(DamageType.IMPACT, originalWeaponDamage.get(DamageType.IMPACT));
        moddedWeaponDamage.add(DamageType.PUNCTURE, originalWeaponDamage.get(DamageType.PUNCTURE));
        moddedWeaponDamage.add(DamageType.SLASH, originalWeaponDamage.get(DamageType.SLASH));

        // Elements
        for (let elementGroup of elementGroups) {
            moddedWeaponDamage.add(Math.max(...elementGroup.get("elements")), elementGroup.get("damage"));
        }

        // Damage multiplier from damage mods e.g. Serration, Heavy Caliber
        let damageMultiplier = 1 + this.getModdedStat(ModEffectType.DAMAGE);
        moddedWeaponDamage = moddedWeaponDamage.multiply(damageMultiplier);
        return moddedWeaponDamage;*/
    }

    /**
     * TODO Double check how multishot on beam weapon works
     *  Maybe have all these return buffed stats??? Then if it's too slow we can split it (including the damage one above)
     *  instead of just + modded stat, have to add the buff stat too, then ensure > -1 --- use (Math.max(0, h) probably
     * @returns {number}
     */
    getMultishot() {
        return this.getActiveFiringMode().pellets * (1 + this.getModdedStat(MOD_EFFECT_TYPE.MULTISHOT));
    }

    /**
     * Fetch the modded critical chance of the weapon on its current firing mode.
     * Type 20.
     * @returns {number}
     */
    getCriticalChance() {
        return this.getActiveFiringMode().criticalChance * (1 + this.getModdedStat(MOD_EFFECT_TYPE.CRITICAL_CHANCE));
    }

    /**
     * Fetch the modded critical multiplier of the weapon on its current firing mode.
     * Type 21.
     * @returns {number}
     */
    getCriticalMultiplier() {
        return this.getActiveFiringMode().criticalMultiplier * (1 + this.getModdedStat(MOD_EFFECT_TYPE.CRITICAL_DAMAGE));
    }

    /**
     * Fetch the modded status chance of the weapon on its current firing mode.
     * Type 22 and 24.
     * @returns {number}
     */
    getStatusChance() {
        return this.getActiveFiringMode().statusChance * (1 + this.getModdedStat(MOD_EFFECT_TYPE.STATUS_CHANCE)) +
            this.getModdedStat(MOD_EFFECT_TYPE.STATUS_CHANCE_ADDITIVE);
    }

    /**
     * Fetch the modded status duration multiplier of the weapon on its current firing mode.
     * Type 23.
     * @returns {number}
     */
    getStatusDurationMultiplier() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.STATUS_DURATION);
    }

    /**
     * Fetch the electric damage multiplier of the weapon on its current firing mode.
     * Type 41.
     * @returns {number}
     */
    getElectricMultiplier() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.ELECTRIC);
    }

    /**
     * Fetch the heat damage multiplier of the weapon on its current firing mode.
     * Type 42.
     * @returns {number}
     */
    getHeatMultiplier() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.HEAT);
    }

    /**
     * Fetch the toxin damage multiplier of the weapon on its current firing mode.
     * Type 43.
     * @returns {number}
     */
    getToxinMultiplier() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.TOXIN);
    }

    /**
     * Fetch the modded fire rate of the weapon on its current firing mode.
     * Type 60.
     * @returns {number}
     */
    getFireRate() {
        return this.getActiveFiringMode().fireRate * (1 + this.getModdedStat(MOD_EFFECT_TYPE.FIRE_RATE));
    }

    /**
     * Fetch the modded charge delay of the weapon on its current firing mode.
     * Type 60.
     * @returns {number}
     */
    getChargeDelay() {
        return this.getActiveFiringMode().chargeDelay / (1 + this.getModdedStat(MOD_EFFECT_TYPE.FIRE_RATE));
        /*var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'ChargeDelay', function() {
            return MAIN.BaseChargeDelay / (1 + MAIN.$_GetModdedProperty(ModEffect.FIRE_RATE));
        });*/
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
        return this.getWeapon().baseReloadDuration / (1 + this.getModdedStat(MOD_EFFECT_TYPE.RELOAD_SPEED));
    }

    /**
     * Fetch the modded magazine size of the weapon on its current firing mode.
     * Type 62, 90.
     * @returns {number}
     */
    getMagazineSize() {
        return this.getWeapon().baseMagazineSize * (1 + this.getModdedStat(MOD_EFFECT_TYPE.MAGAZINE_CAPACITY)) +
            this.getModdedStat(MOD_EFFECT_TYPE.MAGAZINE_CAPACITY_ADDITIVE);
    }

    getAmmoConsumption() {
        return this.getActiveFiringMode().ammoConsumption;
    }

    /**
     * Fetch the modded ammo capacity of the weapon on its current firing mode.
     * Type 63.
     * @returns {number}
     */
    getMaximumAmmo() {
        var MAIN = this;
        return $_CalculateOrLoadProperty(this, 'MaximumAmmo', function() {
            return MAIN.BaseMaximumAmmo * (1 + MAIN.$_GetModdedProperty(ModEffect.AMMO_CAPACITY));
        });
    }

    /**
     * Fetch the modded Grineer damage of the weapon on its current firing mode.
     * Type 70.
     * @returns {number}
     */
    getDamageToGrineer() {
        return this.getModdedStat(MOD_EFFECT_TYPE.DAMAGE_TO_GRINEER);
    }

    /**
     * Fetch the modded Corpus damage of the weapon on its current firing mode.
     * Type 71.
     * @returns {number}
     */
    getDamageToCorpus() {
        return this.getModdedStat(MOD_EFFECT_TYPE.DAMAGE_TO_CORPUS);
    }


    /**
     * Fetch the modded Infested damage of the weapon on its current firing mode.
     * Type 72.
     * @returns {number}
     */
    getDamageToInfested() {
        return this.getModdedStat(MOD_EFFECT_TYPE.DAMAGE_TO_INFESTED);
    }

    /**
     * Fetch the modded Corrupted damage of the weapon on its current firing mode.
     * Type 73.
     * @returns {number}
     */
    getDamageToCorrupted() {
        return this.getModdedStat(MOD_EFFECT_TYPE.DAMAGE_TO_CORRUPTED);
    }

    /**
     * Fetch the modded punch through of the weapon on its current firing mode.
     * Type 80.
     * @returns {number}
     */
    getPunchThrough() {
        return this.getModdedStat(MOD_EFFECT_TYPE.PUNCH_THROUGH);
    }

    /**
     * Fetch the modded accuracy of the weapon on its current firing mode.
     * Type 81.
     * @returns {number}
     */
    getAccuracy() {
        return this.getModdedStat(MOD_EFFECT_TYPE.ACCURACY);
    }

    /**
     * Fetch the modded spread of the weapon on its current firing mode.
     * Type 82.
     * @returns {number}
     */
    getSpread() {
        return this.getModdedStat(MOD_EFFECT_TYPE.SPREAD);
    }

    /**
     * Fetch the modded recoil of the weapon on its current firing mode.
     * Type 83.
     * @returns {number}
     */
    getRecoil() {
        return this.getModdedStat(MOD_EFFECT_TYPE.RECOIL);
    }

    /**
     * Fetch the modded flight speed of the weapon on its current firing mode.
     * Type 84.
     * @returns {number}
     */
    getFlightSpeed() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.FLIGHT_SPEED);
    }

    getHeadshotMultiplier() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.HEADSHOT_DAMAGE);
    }

    /**
     * Fetch the modded first shot damage of the weapon on its current firing mode.
     * Type 101.
     * @returns {number}
     */
    getFirstShotDamage() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.FIRST_SHOT_DAMAGE);
    }

    /**
     * Fetch the modded last shot damage of the weapon on its current firing mode.
     * Type 102.
     * @returns {number}
     */
    getLastShotDamage() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.LAST_SHOT_DAMAGE);
    }

    /**
     * Fetch the modded explosion chance of the weapon on its current firing mode.
     * Type 103.
     * @returns {number}
     */
    getExplosionChance() {
        return this.getModdedStat(MOD_EFFECT_TYPE.EXPLOSION_CHANCE);
    }

    /**
     * Fetch the modded dead aim of the weapon on its current firing mode.
     * Type 106.
     * @returns {number}
     */
    getDeadAim() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.DEAD_AIM);
    }

    /**
     * Fetch the modded ammo efficiency of the weapon on its current firing mode.
     * Type 107.
     * @returns {number}
     */
    getAmmoEfficiency() {
        return this.getModdedStat(MOD_EFFECT_TYPE.AMMO_EFFICIENCY);
    }

    /**
     * Fetch the modded bodyshot multiplier of the weapon on its current firing mode.
     * Type 127.
     * @returns {number}
     */
    getBodyshotMultiplier() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.BODYSHOT_DAMAGE);
    }

    // Not specific to any faction at the moment, this function will be removed when faction multipliers become
    // specific to the faction of the enemy.
    getFactionMultiplier() {
        return 1 + Math.max(this.getModdedStat(MOD_EFFECT_TYPE.DAMAGE_TO_GRINEER),
            this.getModdedStat(MOD_EFFECT_TYPE.DAMAGE_TO_CORPUS),
            this.getModdedStat(MOD_EFFECT_TYPE.DAMAGE_TO_INFESTED),
            this.getModdedStat(MOD_EFFECT_TYPE.DAMAGE_TO_CORRUPTED));
    }

    /**
     * At the moment, no weapons have any pre-installed Hunter Munitions effects.
     * @returns {number}
     */
    getHunterMunitionsEffect() {
        return this.getModdedStat(MOD_EFFECT_TYPE.HUNTER_MUNITIONS_EFFECT);
    }

    /**
     * At the moment, no weapons have any pre-installed Internal bleeding effects.
     * @returns {number}
     */
    getInternalBleedingEffect() {
        let bleeding = this.getModdedStat(MOD_EFFECT_TYPE.INTERNAL_BLEEDING_EFFECT);
        return (this.getFireRate() < 2.5) ? 2 * bleeding : bleeding;
    }

    /**
     * At the moment, no weapons have any pre-installed Vigilante effects.
     * @returns {number}
     */
    getVigilanteSetEffect() {
        return this.getModdedStat(MOD_EFFECT_TYPE.VIGILANTE_SET_EFFECT);
    }

    /**
     * Fetch the Convectrix augment efficiency of the weapon on its current firing mode.
     * Type 421.
     * @returns {number}
     */
    getAugmentConvectrixEfficiency() {
        return this.getModdedStat(MOD_EFFECT_TYPE.CONVECTRIX_EFFICIENCY);
    }

    /**
     * Fetch the Latron augment next shot bonus of the weapon on its current firing mode.
     * Type 423.
     * @returns {number}
     */
    getAugmentLatronNextShotBonus() {
        return this.getModdedStat(MOD_EFFECT_TYPE.LATRON_NEXT_SHOT_BONUS);
    }

    /**
     * Fetch the Latron augment next shot bonus buff of the weapon on its current firing mode.
     * This exists for the damage bonus added by the buff, when it applies.
     * LATRON_NEXT_SHOT_BONUS refers to the buff bonus per stage.
     * Type 423.5.
     * @returns {number}
     */
    getAugmentLatronNextShotBonusBuff() {
        return 1 + this.getModdedStat(MOD_EFFECT_TYPE.LATRON_NEXT_SHOT_BONUS_BUFF);
    }

    /**
     * Fetch the Daikyu augment distance damage bonus of the weapon on its current firing mode.
     * Type 424.
     * @returns {number}
     */
    getAugmentDaikyuDistanceDamageBonus() {
        return this.getModdedStat(MOD_EFFECT_TYPE.DAIKYU_DISTANCE_DAMAGE) > 0 ? 1.4 : 1;
    }

    /**
     * Fetch the Soma Prime augment critical chance of the weapon on its current firing mode.
     * Type 426.
     * @returns {number}
     */
    getAugmentSomaPrimeHitCriticalChance() {
        return this.getModdedStat(MOD_EFFECT_TYPE.SOMA_PRIME_HIT_CRITICAL);
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
        this.remainingMagazine = this.getWeapon().baseMagazineSize;
        this.currentShotDelay = 0;
        this.currentChargeDelay = 0;
    }

}

module.exports = {
    Weapon,
    WeaponInstance
}