const async = require('async');
const superconsole = require('../../../../../scripts/logging/superconsole');
const {WeaponResiduals} = require('../classes/weapon-residuals');
const {conn} = require('../sql/connection');
const {Weapon} = require('../classes/weapon');
const {Mod} = require('../classes/mod');
const {Enemy} = require('../classes/enemy');
const {ResistanceType} = require('../classes/resistance-type');
const {WeaponFiringMode} = require('../classes/weapon-firing-mode');
const {WeaponDamage} = require('../classes/weapon-damage');

let lastUpdated = new Date(0);
let isUpdating = false;
let updatePromise = null;
let weaponData = null;
let modData = null;
let modEffectData = null;
let enemyData = null;
let healthTypeData = null;
let armorTypeData = null;
let shieldTypeData = null;

//console.log('initial:', lastUpdated)

function tryUpdateData() {
    if (!isUpdating) {
        updatePromise = new Promise(function (resolve) {
            if ((new Date().getTime() - lastUpdated.getTime()) > 3600000) {
                isUpdating = true;
                updateData().then(() => {
                    isUpdating = false;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    return updatePromise;
}

function updateData() {
    return new Promise(function (resolve) {
        let wepPromise = updateWeapons();
        let modPromise = updateMods();
        let mefPromise = updateModEffects();
        let resPromise = updateResistanceTypes();

        Promise.all([wepPromise, modPromise, mefPromise, resPromise]).then(() => {
            lastUpdated = new Date();
            resolve();
        });
        (async() => {await updateEnemies()})();
    });
}

function updateWeapons() {
    return new Promise(function (resolve) {
        let weapons = {};

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
                                let baseDamage = new WeaponDamage()
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
                                    .setOriginalBaseDamage(baseDamage);
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
                                let baseDamage = new WeaponDamage();
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
                                    .setOriginalBaseDamage(baseDamage)
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
                weaponData = weapons;
                superconsole.log(superconsole.MessageLevel.INFORMATION,
                    `$blue:Updated weapons as of $white,bright{${new Date().toString()}}`,);
                resolve();
            });
    });
}

function updateMods() {
    return new Promise(function (resolve) {
        let mods = {};

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
                modData = mods;
                superconsole.log(superconsole.MessageLevel.INFORMATION,
                    `$blue:Updated mods as of $white,bright{${new Date().toString()}}`,);
                resolve();
            });
    });
}

function updateModEffects() {
    return new Promise(function (resolve) {
        let modEffects = {};

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
                modEffectData = modEffects;
                superconsole.log(superconsole.MessageLevel.INFORMATION,
                    `$blue:Updated mod effects as of $white,bright{${new Date().toString()}}`,);
                resolve();
            });
    });
}

function updateEnemies() {
    return new Promise(function (resolve) {
        let enemies = {};

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
                                    .setHealthTypeId(enemyResult.health_type)
                                    .setBaseArmor(enemyResult.armor_value)
                                    .setArmorTypeId(enemyResult.armor_type)
                                    .setBaseShield(enemyResult.shield_value)
                                    .setShieldTypeId(enemyResult.shield_type);
                                await enemy.setHealthType();
                                await enemy.setArmorType();
                                await enemy.setShieldType();
                            }
                            callback(null, 1);
                        }
                    );
                }
            ],
            function (err, results) {
                enemyData = enemies;
                superconsole.log(superconsole.MessageLevel.INFORMATION,
                    `$blue:Updated enemies as of $white,bright{${new Date().toString()}}`,);
                resolve();
            });
    });
}

function updateResistanceTypes() {
    return new Promise(function (resolve) {
        let healthTypes = {};
        let armorTypes = {};
        let shieldTypes = {};

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

                                /** @type {import('../classes/resistance-type').ResistanceType} */
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

                                /** @type {import('../classes/resistance-type').ResistanceType} */
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

                                /** @type {import('../classes/resistance-type').ResistanceType} */
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
                healthTypeData = healthTypes;
                armorTypeData = armorTypes;
                shieldTypeData = shieldTypes;
                superconsole.log(superconsole.MessageLevel.INFORMATION,
                    `$blue:Updated resistance types (health, armor, shield) as of $white,bright{${new Date().toString()}}`,);
                resolve();
            });
    });
}

async function getWeapons() {
    await tryUpdateData();
    return weaponData;
}

async function getMods() {
    await tryUpdateData();
    return modData;
}

async function getModEffects() {
    await tryUpdateData();
    return modEffectData;
}

async function getEnemies() {
    await tryUpdateData();
    return enemyData;
}

async function getHealthTypes() {
    await tryUpdateData();
    return healthTypeData;
}

async function getArmorTypes() {
    await tryUpdateData();
    return armorTypeData;
}

async function getShieldTypes() {
    await tryUpdateData();
    return shieldTypeData;
}

module.exports = {
    getWeapons,
    getMods,
    getModEffects,
    getEnemies,
    getHealthTypes,
    getArmorTypes,
    getShieldTypes
}