const async = require('async');
const superconsole = require('../../../../../scripts/logging/superconsole');
const {usefulModEffectTypes} = require('../utils/magicTypes');
const {WeaponResiduals} = require('../classes/weaponResiduals');
const {conn} = require('../sql/connection');
const {Weapon} = require('../classes/weapon');
const {Mod} = require('../classes/mod');
const {Enemy} = require('../classes/enemy');
const {ResistanceType} = require('../classes/resistanceType');
const {WeaponFiringMode} = require('../classes/weaponFiringMode');
const {WeaponDamageDistribution} = require('../classes/weaponDamageDistribution');

class Data {
    /** Update Information */
    static lastUpdated_ = null;

    /** Weapons */
    static weaponData_ = null;

    /** Mods */
    static modData_ = null;
    static modEffectData_ = null;

    /** Resistances */
    static healthTypeData_ = null;
    static armorTypeData_ = null;
    static shieldTypeData_ = null;

    /** Enemies */
    static enemyData_ = null;

    /**
     * Returns a Weapon from its ID.
     * @param id
     * @returns {Promise<Weapon>}
     */
    static async getWeapon(id) {
        return (await Data.getWeapons())[id];
    }

    static async getWeapons() {
        await Data.tryUpdateData_()
        return Data.weaponData_;
    }

    /**
     * Returns a Mod from its ID.
     * @param id
     * @returns {Promise<Mod>}
     */
    static async getMod(id) {
        return (await Data.getMods())[id];
    }

    static async getMods() {
        await Data.tryUpdateData_()
        return Data.modData_;
    }

    /**
     *
     * @param {Weapon} weapon - The weapon type for which compatible mods will be returned.
     * @param {boolean} removeUselessMods - Whether or not to ignore mods which will not affect the simulation.
     * @returns {Mod[]} - A list of mods which are compatible with this weapon.
     */
    static async getValidModsFor(weapon, removeUselessMods=true) {
        /** @type Mod[] */
        let validMods = Object.values(await Data.getMods())
            .filter(mod => mod.isCompatibleWithWeapon(weapon)); // include only mods compatible with the weapon

        if (removeUselessMods) {
            // include only mods with "useful" effects
            let usefulEffects = usefulModEffectTypes();
            validMods = validMods
                .filter(mod => usefulEffects.some(effect => Array.from(mod.getEffects().keys()).includes(effect)));
        }

        return validMods;
    }

    /**
     * Returns a health type from its ID.
     * @param id
     * @returns {Promise<ResistanceType>}
     */
    static async getHealthType(id) {
        return (await Data.getHealthTypes())[id];
    }

    static async getHealthTypes() {
        await Data.tryUpdateData_()
        return Data.healthTypeData_;
    }

    /**
     * Returns an armor type from its ID.
     * @param id
     * @returns {Promise<ResistanceType>}
     */
    static async getArmorType(id) {
        return (await Data.getArmorTypes())[id];
    }

    static async getArmorTypes() {
        await Data.tryUpdateData_()
        return Data.armorTypeData_;
    }

    /**
     * Returns a shield type from its ID.
     * @param id
     * @returns {Promise<ResistanceType>}
     */
    static async getShieldType(id) {
        return (await Data.getShieldTypes())[id];
    }

    static async getShieldTypes() {
        await Data.tryUpdateData_()
        return Data.shieldTypeData_;
    }

    /**
     * Returns an Enemy from its ID.
     * @param id
     * @returns {Promise<Enemy>}
     */
    static async getEnemy(id) {
        return (await Data.getEnemies())[id];
    }

    static async getEnemies() {
        await Data.tryUpdateData_()
        return Data.enemyData_;
    }

    /**
     * If the data has not been updated in an hour, fetch the latest changes from the database.
     */
    static async tryUpdateData_() {
        if (Data.lastUpdated_ == null || new Date().getTime() - Data.lastUpdated_.getTime() > 3600000) {
            await Data.updateData_();
        }
    }

    /**
     * Fetch the latest changes from the database.
     */
    static async updateData_() {
        Data.lastUpdated_ = new Date();

        await Data.updateWeapons_();
        await Data.updateMods_();
        await Data.updateModEffects_();
        await Data.updateResistanceTypes_();
        await Data.updateEnemies_();
    }

    static async updateWeapons_() {
        let weapons = {};
        await new Promise((resolve) => {
            async.parallel([
                function (callback) {
                    conn.query(
                        `SELECT * FROM weapons w WHERE w.validated = 1 ORDER BY w.name;`,
                        function (err, results) {
                            if (err) {
                                superconsole.log(superconsole.MessageLevel.ERROR_DEBUG,
                                    `$red:Encountered an error: $white,bright{${err}}`);
                                return;
                            }

                            for (let r = 0; r < results.length; r++) {
                                let weaponResult = results[r];
                                if (weapons[weaponResult.id] == null) {
                                    weapons[weaponResult.id] = new Weapon();
                                }

                                let modTypes = weaponResult.mod_type.split(',');
                                for (let i = 0; i < modTypes.length; i++) modTypes[i] = parseInt(modTypes[i]);

                                weapons[weaponResult.id]
                                    .setID(weaponResult.id)
                                    .setName(weaponResult.name)
                                    .setImage(weaponResult.image_url)
                                    .setMastery(weaponResult.mastery)
                                    .setModTypes(modTypes)
                                    .setBaseMagazineSize(weaponResult.magazine_capacity)
                                    .setBaseReloadDuration(weaponResult.reload_time);
                            }
                            callback(null, 1);
                        }
                    );
                },
                function (callback) {
                    conn.query(
                        `SELECT wfm.* FROM weapon_fire_modes wfm INNER JOIN weapons w ON w.id = wfm.id WHERE w.validated = 1 ORDER BY wfm.id, wfm.line;`,
                        function (err, results) {
                            if (err) {
                                superconsole.log(superconsole.MessageLevel.ERROR_DEBUG,
                                    `$red:Encountered an error: $white,bright{${err}}`);
                                return;
                            }

                            for (let r = 0; r < results.length; r++) {
                                let firingModeResult = results[r];
                                if (weapons[firingModeResult.id] == null) {
                                    weapons[firingModeResult.id] = new Weapon();
                                }

                                let weapon = weapons[firingModeResult.id];

                                if (weapon.firingModes[firingModeResult.line - 1] == null) {
                                    weapon.setFiringMode(firingModeResult.line - 1, new WeaponFiringMode());
                                }

                                // Base damage
                                let baseDamage = new WeaponDamageDistribution()
                                    .setImpact(firingModeResult.impact)
                                    .setPuncture(firingModeResult.puncture)
                                    .setSlash(firingModeResult.slash)
                                    .setCold(firingModeResult.cold)
                                    .setElectric(firingModeResult.electric)
                                    .setHeat(firingModeResult.heat)
                                    .setToxin(firingModeResult.toxin)
                                    .setBlast(firingModeResult.blast)
                                    .setCorrosive(firingModeResult.corrosive)
                                    .setGas(firingModeResult.gas)
                                    .setMagnetic(firingModeResult.magnetic)
                                    .setRadiation(firingModeResult.radiation)
                                    .setViral(firingModeResult.viral);

                                weapon.firingModes[firingModeResult.line - 1]
                                    .setName(firingModeResult.name)
                                    .setPellets(firingModeResult.pellets)
                                    .setAmmoConsumption(firingModeResult.ammo_consumption)
                                    .setFireRate(firingModeResult.fire_rate)
                                    .setCriticalChance(firingModeResult.critical_chance)
                                    .setCriticalMultiplier(firingModeResult.critical_multiplier)
                                    .setStatusChance(firingModeResult.status_chance)
                                    .setIsBeam(!!firingModeResult.is_beam.readUIntBE(0, 1))
                                    .setChargeDelay(firingModeResult.charge_delay)
                                    .setBaseDamageDistribution(baseDamage);
                            }
                            callback(null, 1);
                        }
                    );
                },
                function (callback) {
                    conn.query(
                        `SELECT wfmr.* FROM weapon_fire_mode_residuals wfmr INNER JOIN weapons w ON w.id = wfmr.id WHERE w.validated = 1 ORDER BY wfmr.id, wfmr.line, wfmr.subline;`,
                        function (err, results) {
                            if (err) {
                                superconsole.log(superconsole.MessageLevel.ERROR_DEBUG,
                                    `$red:Encountered an error: $white,bright{${err}}`);
                                return;
                            }

                            for (let r = 0; r < results.length; r++) {
                                let residualResult = results[r];
                                if (weapons[residualResult.id] == null) {
                                    weapons[residualResult.id] = new Weapon();
                                }

                                let weapon = weapons[residualResult.id]; // Weapon type
                                if (weapon.firingModes[residualResult.line - 1] === undefined) {
                                    weapon.setFiringMode(residualResult.line - 1, new WeaponFiringMode());
                                }

                                let firingMode = weapon.firingModes[residualResult.line - 1]; // WeaponFiringMode type

                                // Residual base damage
                                let baseDamage = new WeaponDamageDistribution();
                                baseDamage
                                    .setImpact(residualResult.impact)
                                    .setPuncture(residualResult.puncture)
                                    .setSlash(residualResult.slash)
                                    .setCold(residualResult.cold)
                                    .setElectric(residualResult.electric)
                                    .setHeat(residualResult.heat)
                                    .setToxin(residualResult.toxin)
                                    .setBlast(residualResult.blast)
                                    .setCorrosive(residualResult.corrosive)
                                    .setGas(residualResult.gas)
                                    .setMagnetic(residualResult.magnetic)
                                    .setRadiation(residualResult.radiation)
                                    .setViral(residualResult.viral);

                                let firingModeResidual = new WeaponResiduals()
                                    .setBaseDamageDistribution(baseDamage)
                                    .setDuration(residualResult.duration)
                                    .setPellets(residualResult.pellets)
                                    .setInheritsCriticalChance(residualResult.inherit_critical_chance)
                                    .setOverrideCriticalChance(residualResult.critical_chance)
                                    .setOverrideCriticalMultiplier(residualResult.critical_multiplier)
                                    .setOverrideStatusChance(residualResult.status_chance);

                                firingMode.setResiduals(firingModeResidual);
                            }
                            callback(null, 1);
                        }
                    )
                }
            ],
            function (err, results) {
                superconsole.log(superconsole.MessageLevel.INFORMATION,
                    `$blue:Updated weapons as of $white,bright{${new Date().toString()}}`,);
                resolve();
            });
        })
        Data.weaponData_ = weapons;
    }

    static async updateMods_() {
        let mods = {};
        await new Promise((resolve) => {
            async.parallel([
                function (callback) {
                    conn.query(
                        `SELECT * FROM mods ORDER BY name;`,
                        function (err, results) {
                            if (err) {
                                superconsole.log(superconsole.MessageLevel.ERROR_DEBUG,
                                    `$red:Encountered an error: $white,bright{${err}}`);
                                return;
                            }

                            for (let r = 0; r < results.length; r++) {
                                let modResult = results[r];
                                if (mods[modResult.id] == null) {
                                    mods[modResult.id] = new Mod();
                                }

                                // TODO polarity

                                mods[modResult.id]
                                    .setID(modResult.id)
                                    .setName(modResult.name)
                                    .setImage(modResult.image_url)
                                    .setRarity(modResult.mod_rarity)
                                    .setModType(modResult.mod_type)
                                    .setMinDrain(modResult.min_drain)
                                    .setMaxRank(modResult.ranks);
                            }
                            callback(null, 1);
                        }
                    );
                },
                function (callback) {
                    conn.query(
                        `SELECT me.*, men.description, GROUP_CONCAT( CONCAT( mero.rank, ':', mero.value ) SEPARATOR ';' ) 'rank_overrides' FROM mod_effects me INNER JOIN mod_effect_names men ON men.id = me.effect_id LEFT OUTER JOIN mod_effect_rank_overrides mero ON me.id = mero.id AND me.line = mero.line GROUP BY me.id, me.line ORDER BY me.id, me.line;`,
                        function (err, results) {
                            if (err) {
                                superconsole.log(superconsole.MessageLevel.ERROR_DEBUG,
                                    `$red:Encountered an error: $white,bright{${err}}`);
                                return;
                            }

                            for (let r = 0; r < results.length; r++) {
                                let modEffectResult = results[r];
                                if (mods[modEffectResult.id] == null) {
                                    mods[modEffectResult.id] = new Mod();
                                }

                                mods[modEffectResult.id]
                                    .addEffect(modEffectResult.effect_id, parseFloat(modEffectResult.value))
                                    .addEffectDescription(modEffectResult.effect_id, modEffectResult.description);

                                if (modEffectResult.rank_overrides != null) {
                                    /** @type {string[]} */
                                    let rankOverrides = modEffectResult.rank_overrides.split(';');

                                    for (let o = 0; o < rankOverrides.length; o++) {
                                        let rankOverride = rankOverrides[o].split(':');
                                        let rank = parseInt(rankOverride[0]);
                                        let power = parseFloat(rankOverride[1]);
                                        mods[modEffectResult.id].addEffectRanked(rank, modEffectResult.effect_id, power);
                                    }
                                }
                            }
                            callback(null, 1);
                        }
                    );
                }
            ],
            function (err, results) {
                superconsole.log(superconsole.MessageLevel.INFORMATION,
                    `$blue:Updated mods as of $white,bright{${new Date().toString()}}`,);
                resolve();
            });
        });
        Data.modData_ = mods;
    }

    static async updateModEffects_() {
        let modEffects = {};
        await new Promise((resolve) => {
            async.parallel([
                function (callback) {
                    conn.query(
                        `SELECT * FROM mod_effect_names;`,
                        function (err, results) {
                            if (err) {
                                superconsole.log(superconsole.MessageLevel.ERROR_DEBUG,
                                    `$red:Encountered an error: $white,bright{${err}}`);
                                return;
                            }

                            for (let r = 0; r < results.length; r++) {
                                let result = results[r];
                                if (modEffects[result.id] == null) modEffects[result.id] = result.description;
                            }
                            callback(null, 1);
                        }
                    );
                }
            ],
    function (err, results) {
                superconsole.log(superconsole.MessageLevel.INFORMATION,
                    `$blue:Updated mod effects as of $white,bright{${new Date().toString()}}`,);
                resolve();
            });
        });
        Data.modEffectData_ = modEffects;
    }

    static async updateResistanceTypes_() {
        let healthTypes = {};
        let armorTypes = {};
        let shieldTypes = {};
        await new Promise(function (resolve) {
            async.parallel([
                function (callback) {
                    conn.query(
                        `SELECT * FROM health_types ORDER BY id;`,
                        function (err, results) {
                            if (err) {
                                superconsole.log(superconsole.MessageLevel.ERROR_DEBUG,
                                    `$red:Encountered an error: $white,bright{${err}}`);
                                return;
                            }

                            for (let r = 0; r < results.length; r++) {
                                let healthTypeResult = results[r];
                                if (healthTypes[healthTypeResult.id] == null) {
                                    healthTypes[healthTypeResult.id] = new ResistanceType();
                                }

                                /** @type {import('../classes/resistanceType').ResistanceType} */
                                let healthType = healthTypes[healthTypeResult.id];
                                healthType
                                    .setId(healthTypeResult.id)
                                    .setName(healthTypeResult.name)
                                    .setImpactResistance(healthTypeResult.impact)
                                    .setPunctureResistance(healthTypeResult.puncture)
                                    .setSlashResistance(healthTypeResult.slash)
                                    .setColdResistance(healthTypeResult.cold)
                                    .setElectricResistance(healthTypeResult.electric)
                                    .setHeatResistance(healthTypeResult.heat)
                                    .setToxinResistance(healthTypeResult.toxin)
                                    .setBlastResistance(healthTypeResult.blast)
                                    .setCorrosiveResistance(healthTypeResult.corrosive)
                                    .setGasResistance(healthTypeResult.gas)
                                    .setMagneticResistance(healthTypeResult.magnetic)
                                    .setRadiationResistance(healthTypeResult.radiation)
                                    .setViralResistance(healthTypeResult.viral);
                            }
                            callback(null, 1);
                        }
                    );
                },
                function (callback) {
                    conn.query(
                        `SELECT * FROM armor_types ORDER BY id;`,
                        function (err, results) {
                            if (err) {
                                superconsole.log(superconsole.MessageLevel.ERROR_DEBUG,
                                    `$red:Encountered an error: $white,bright{${err}}`);
                                return;
                            }

                            for (let r = 0; r < results.length; r++) {
                                let armorTypeResult = results[r];
                                if (armorTypes[armorTypeResult.id] == null) {
                                    armorTypes[armorTypeResult.id] = new ResistanceType();
                                }

                                /** @type {import('../classes/resistanceType').ResistanceType} */
                                let armorType = armorTypes[armorTypeResult.id];
                                armorType
                                    .setId(armorTypeResult.id)
                                    .setName(armorTypeResult.name)
                                    .setImpactResistance(armorTypeResult.impact)
                                    .setPunctureResistance(armorTypeResult.puncture)
                                    .setSlashResistance(armorTypeResult.slash)
                                    .setColdResistance(armorTypeResult.cold)
                                    .setElectricResistance(armorTypeResult.electric)
                                    .setHeatResistance(armorTypeResult.heat)
                                    .setToxinResistance(armorTypeResult.toxin)
                                    .setBlastResistance(armorTypeResult.blast)
                                    .setCorrosiveResistance(armorTypeResult.corrosive)
                                    .setGasResistance(armorTypeResult.gas)
                                    .setMagneticResistance(armorTypeResult.magnetic)
                                    .setRadiationResistance(armorTypeResult.radiation)
                                    .setViralResistance(armorTypeResult.viral);
                            }
                            callback(null, 1);
                        }
                    );
                },
                function (callback) {
                    conn.query(
                        `SELECT * FROM shield_types ORDER BY id;`,
                        function (err, results) {
                            if (err) {
                                superconsole.log(superconsole.MessageLevel.ERROR_DEBUG,
                                    `$red:Encountered an error: $white,bright{${err}}`);
                                return;
                            }

                            for (let r = 0; r < results.length; r++) {
                                let shieldTypeResult = results[r];
                                if (shieldTypes[shieldTypeResult.id] == null) {
                                    shieldTypes[shieldTypeResult.id] = new ResistanceType();
                                }

                                /** @type {import('../classes/resistanceType').ResistanceType} */
                                let shieldType = shieldTypes[shieldTypeResult.id];
                                shieldType
                                    .setId(shieldTypeResult.id)
                                    .setName(shieldTypeResult.name)
                                    .setImpactResistance(shieldTypeResult.impact)
                                    .setPunctureResistance(shieldTypeResult.puncture)
                                    .setSlashResistance(shieldTypeResult.slash)
                                    .setColdResistance(shieldTypeResult.cold)
                                    .setElectricResistance(shieldTypeResult.electric)
                                    .setHeatResistance(shieldTypeResult.heat)
                                    .setToxinResistance(shieldTypeResult.toxin)
                                    .setBlastResistance(shieldTypeResult.blast)
                                    .setCorrosiveResistance(shieldTypeResult.corrosive)
                                    .setGasResistance(shieldTypeResult.gas)
                                    .setMagneticResistance(shieldTypeResult.magnetic)
                                    .setRadiationResistance(shieldTypeResult.radiation)
                                    .setViralResistance(shieldTypeResult.viral);
                            }
                            callback(null, 1);
                        }
                    );
                }
                ],
            function (err, results) {
                superconsole.log(superconsole.MessageLevel.INFORMATION,
                    `$blue:Updated resistance types (health, armor, shield) as of $white,bright{${new Date().toString()}}`,);
                resolve();
            });
        });
        Data.healthTypeData_ = healthTypes;
        Data.armorTypeData_ = armorTypes;
        Data.shieldTypeData_ = shieldTypes;
    }

    static async updateEnemies_() {
        let enemies = {};
        await new Promise((resolve) => {
            async.parallel([
                function (callback) {
                    conn.query(
                        `SELECT * FROM enemies ORDER BY name;`,
                        async function (err, results) {
                            if (err) {
                                superconsole.log(superconsole.MessageLevel.ERROR_DEBUG,
                                    `$red:Encountered an error: $white,bright{${err}}`);
                                return;
                            }

                            for (let r = 0; r < results.length; r++) {
                                let enemyResult = results[r];
                                if (enemies[enemyResult.id] == null) {
                                    enemies[enemyResult.id] = new Enemy();
                                }

                                /** @type {import('../classes/enemy').Enemy} */
                                let enemy = enemies[enemyResult.id];
                                enemy
                                    .setId(enemyResult.id)
                                    .setName(enemyResult.name)
                                    .setImage(enemyResult.image_url)
                                    .setBaseLevel(enemyResult.base_level)
                                    .setBaseHealth(enemyResult.health_value)
                                    .setHealthType(Data.healthTypeData_[enemyResult.health_type])
                                    .setBaseArmor(enemyResult.armor_value)
                                    .setArmorType(Data.armorTypeData_[enemyResult.armor_type])
                                    .setBaseShield(enemyResult.shield_value)
                                    .setShieldType(Data.shieldTypeData_[enemyResult.shield_type]);
                            }
                            callback(null, 1);
                        }
                    );
                }
            ],
            function (err, results) {
                superconsole.log(superconsole.MessageLevel.INFORMATION,
                    `$blue:Updated enemies as of $white,bright{${new Date().toString()}}`,);
                resolve();
            });
        });
        Data.enemyData_ = enemies;
    }
}

module.exports = {
    Data,
}