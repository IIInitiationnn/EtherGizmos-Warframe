const DamageType = {
    IMPACT: 1,
    PUNCTURE: 2,
    SLASH: 4,
    COLD: 8,
    ELECTRIC: 16,
    HEAT: 32,
    TOXIN: 64,
    BLAST: 40,
    CORROSIVE: 80,
    GAS: 96,
    MAGNETIC: 24,
    RADIATION: 48,
    VIRAL: 72,
    TRUE: 128,
    VOID: 256
}

function isPrimaryElement(damageType) {
    return [DamageType.COLD, DamageType.ELECTRIC, DamageType.HEAT, DamageType.TOXIN].includes(damageType);
}

function breakDownSecondaryElement(damageType) {
    switch (damageType) {
        case DamageType.BLAST:
            return [DamageType.COLD, DamageType.HEAT];
        case DamageType.CORROSIVE:
            return [DamageType.ELECTRIC, DamageType.TOXIN];
        case DamageType.GAS:
            return [DamageType.HEAT, DamageType.TOXIN];
        case DamageType.MAGNETIC:
            return [DamageType.COLD, DamageType.ELECTRIC];
        case DamageType.RADIATION:
            return [DamageType.ELECTRIC, DamageType.HEAT];
        case DamageType.VIRAL:
            return [DamageType.COLD, DamageType.TOXIN];
    }

}

const ModRarity = {
    COMMON: 1,
    UNCOMMON: 2,
    RARE: 4,
    LEGENDARY: 8,
    RIVEN: 16,
    PECULIAR: 32,
    AMALGAM: 64
}

// TODO write examples of mods with these effects in comments
const ModEffectType = {
    DAMAGE: 10,     //Done
    MULTISHOT: 11,  //Done

    CRITICAL_CHANCE: 20,        //Done
    CRITICAL_DAMAGE: 21,        //Done
    STATUS_CHANCE: 22,          //Done
    STATUS_CHANCE_ADDITIVE: 24, //Done
    STATUS_DURATION: 23,        //Done

    IMPACT: 30,     //Done
    PUNCTURE: 31,   //Done
    SLASH: 32,      //Done

    COLD: 40,       //Done
    ELECTRIC: 41,   //Done
    HEAT: 42,       //Done
    TOXIN: 43,      //Done

    BLAST: 50,      //Done
    CORROSIVE: 51,  //Done
    GAS: 52,        //Done
    MAGNETIC: 53,   //Done
    RADIATION: 54,  //Done
    VIRAL: 55,      //Done

    FIRE_RATE: 60,          //Done
    RELOAD_SPEED: 61,       //Done
    MAGAZINE_CAPACITY: 62,  //Done
    AMMO_CAPACITY: 63,      //Done

    BANE_OF_GRINEER: 70,        //Done
    DAMAGE_TO_GRINEER: 70,      //Done
    BANE_OF_CORPUS: 71,         //Done
    DAMAGE_TO_CORPUS: 71,       //Done
    BANE_OF_INFESTED: 72,       //Done
    DAMAGE_TO_INFESTED: 72,     //Done
    BANE_OF_CORRUPTED: 73,      //Done
    DAMAGE_TO_CORRUPTED: 73,    //Done

    PUNCH_THROUGH: 80,
    ACCURACY: 81,
    SPREAD: 82,
    RECOIL: 83,
    FLIGHT_SPEED: 84,
    ZOOM: 85,
    BEAM_RANGE: 86,
    BLAST_RADIUS: 87,
    NOISE_REDUCTION: 88,
    STICK_CHANCE: 89,
    MAGAZINE_CAPACITY_ADDITIVE: 90,
    LIFE_STEAL: 91,
    FLIGHT_DISTANCE: 92,

    HEADSHOT_DAMAGE: 100,
    FIRST_SHOT_DAMAGE: 101,
    LAST_SHOT_DAMAGE: 102,
    EXPLOSION_CHANCE: 103,
    BODY_EXPLOSION_DAMAGE: 104,
    HEADSHOT_KILL_ENERGY: 105,
    DEAD_AIM: 106,
    AMMO_EFFICIENCY: 107,

    AMMO_MUTATION: 120,
    COMBO_DURATION: 121,
    HOLSTER_RELOAD: 122,
    HOLSTER_RELOAD_ALL: 123,
    AMMO_MUTATION_SHOTGUN_SNIPER: 124,
    AMMO_MUTATION_RIFLE_PISTOL: 125,
    KILL_ENEMY_REFILL_AMMO: 126,
    BODYSHOT_DAMAGE: 127,

    RICOCHET_BOUNCE: 130,
    GORE_CHANCE: 131,

    DAGGERS_REDUCE_ARMOR: 150,
    ARGONAK_REVEAL_PUNCH_THROUGH: 151,
    LIFE_STEAL_ON_NIKANAS: 152,
    DAIKYU_PICKUP_ARROWS: 153,
    BLAST_RADIUS_FROM_MELEE: 154,
    FURAX_MELEE_KILL_KNOCKDOWN: 155,
    SHIELD_BLOCK_COMBO_COUNT: 156,
    SHOTGUN_RELOAD_SPEED: 157,

    HUNTER_MUNITIONS_EFFECT: 200,
    PROPORTIONAL_HEALTH_EXPLOSION: 201,
    INTERNAL_BLEEDING_EFFECT: 202,

    VIGILANTE_SET_EFFECT: 300,

    MITER_POP_NULLIFIER: 400,
    SILVA_AEGIS_BLOCK_CHARGE: 401,
    OBEX_FINISH_EXPLOSION: 402,
    LANKA_FLYING_SHOCK: 403,
    PANTHERA_SECONDARY_DISARM: 404,
    PENTA_TETHER: 405,
    FLUX_RIFLE_STATUS_FLUC_MIN: 406, //TODO
    FLUX_RIFLE_STATUS_FLUC_MAX: 407, //TODO
    DETRON_KILL_EXPLOSION: 408,
    PROVA_CHARGE_SHOCK: 409,
    SILVA_AEGIS_BLOCK_REDIRECT: 411,
    JAT_KITTAG_KILL_EXPLOSION: 412,
    SOBEK_KILL_EXPLOSION: 413,
    TWIN_BASOLK_CHARGE_TELEPORT: 414,
    OGRIS_NAPALM: 415, //TODO
    RIPKAS_PRONE_DAMAGE: 416,
    RIPKAS_PRONE_STATUS_CHANCE: 417,
    GRAKATA_EMPTY_MAGAZINE: 418,
    MUTALIST_QUANTA_MASS: 419, //TODO
    PENTA_NAPALM: 420, //TODO
    CONVECTRIX_EFFICIENCY: 421,
    BRONCO_CLOSE_STUN: 422,
    LATRON_NEXT_SHOT_BONUS: 423,
    LATRON_NEXT_SHOT_BONUS_BUFF: 423.5,
    DAIKYU_DISTANCE_DAMAGE: 424, //TODO
    PARIS_STATUS_RESTORE_HEALTH: 425,
    SOMA_PRIME_HIT_CRITICAL: 426, //TODO

    SPRINT_SPEED: 1020,
    DODGE_SPEED: 1021,
    MOVE_SPEED_AIMING: 1023,
    BULLET_JUMP: 1030,
    AIM_GLIDE: 1031,
    WALL_LATCH: 1032,
    HOLSTER_SPEED: 1040,
    IGNORE_STAGGER: 1041,
    REVIVE_SPEED: 1042,

    DURATION: 2000,
    RADIUS: 2001,
    RADIUS_RELATIVE_EXPLOSION: 2002,

    JUSTICE: 4000,
    TRUTH: 4001,
    ENTROPY: 4002,
    SEQUENCE: 4003,
    BLIGHT: 4004,
    PURITY: 4005
}

/**
 * Converts an elemental mod effect to its corresponding damage type.
 * @param modEffectType
 * @returns {number} damageType
 */
function elementalModEffectToDamage(modEffectType) {
    return DamageType[Object.keys(ModEffectType).find(key => ModEffectType[key] === modEffectType)];
}

/**
 *
 * @returns {number[]} - List of all mod effect types which contribute to damage output or otherwise affect kill time.
 */
function usefulModEffectTypes() {
    return [ModEffectType.DAMAGE,
        ModEffectType.MULTISHOT,
        ModEffectType.CRITICAL_CHANCE,
        ModEffectType.CRITICAL_DAMAGE,
        ModEffectType.STATUS_CHANCE,
        ModEffectType.STATUS_CHANCE_ADDITIVE,
        ModEffectType.STATUS_DURATION,
        ModEffectType.IMPACT,
        ModEffectType.PUNCTURE,
        ModEffectType.SLASH,
        ModEffectType.COLD,
        ModEffectType.ELECTRIC,
        ModEffectType.HEAT,
        ModEffectType.TOXIN,
        ModEffectType.BLAST,
        ModEffectType.CORROSIVE,
        ModEffectType.GAS,
        ModEffectType.MAGNETIC,
        ModEffectType.RADIATION,
        ModEffectType.VIRAL,
        ModEffectType.FIRE_RATE,
        ModEffectType.RELOAD_SPEED,
        ModEffectType.MAGAZINE_CAPACITY,
        ModEffectType.AMMO_CAPACITY,
        ModEffectType.DAMAGE_TO_GRINEER,
        ModEffectType.DAMAGE_TO_CORPUS,
        ModEffectType.DAMAGE_TO_INFESTED,
        ModEffectType.DAMAGE_TO_CORRUPTED,
        ModEffectType.MAGAZINE_CAPACITY_ADDITIVE,
        ModEffectType.HEADSHOT_DAMAGE,
        ModEffectType.FIRST_SHOT_DAMAGE,
        ModEffectType.LAST_SHOT_DAMAGE,
        ModEffectType.EXPLOSION_CHANCE,
        ModEffectType.BODY_EXPLOSION_DAMAGE,
        ModEffectType.DEAD_AIM,
        ModEffectType.AMMO_EFFICIENCY,
        ModEffectType.COMBO_DURATION,
        ModEffectType.BODYSHOT_DAMAGE,

        // TODO not sure which of these affect damage
        ModEffectType.DAGGERS_REDUCE_ARMOR,
        ModEffectType.BLAST_RADIUS_FROM_MELEE,
        ModEffectType.SHIELD_BLOCK_COMBO_COUNT,
        ModEffectType.SHOTGUN_RELOAD_SPEED,
        ModEffectType.HUNTER_MUNITIONS_EFFECT,
        ModEffectType.INTERNAL_BLEEDING_EFFECT,
        ModEffectType.VIGILANTE_SET_EFFECT,
        ModEffectType.MITER_POP_NULLIFIER,
        ModEffectType.SILVA_AEGIS_BLOCK_CHARGE,
        ModEffectType.OBEX_FINISH_EXPLOSION,
        ModEffectType.LANKA_FLYING_SHOCK,
        ModEffectType.PANTHERA_SECONDARY_DISARM,
        ModEffectType.PENTA_TETHER,
        ModEffectType.FLUX_RIFLE_STATUS_FLUC_MIN,
        ModEffectType.FLUX_RIFLE_STATUS_FLUC_MAX,
        ModEffectType.DETRON_KILL_EXPLOSION,
        ModEffectType.PROVA_CHARGE_SHOCK,
        ModEffectType.SILVA_AEGIS_BLOCK_REDIRECT,
        ModEffectType.JAT_KITTAG_KILL_EXPLOSION,
        ModEffectType.SOBEK_KILL_EXPLOSION,
        ModEffectType.TWIN_BASOLK_CHARGE_TELEPORT,
        ModEffectType.OGRIS_NAPALM,
        ModEffectType.RIPKAS_PRONE_DAMAGE,
        ModEffectType.RIPKAS_PRONE_STATUS_CHANCE,
        ModEffectType.GRAKATA_EMPTY_MAGAZINE,
        ModEffectType.MUTALIST_QUANTA_MASS,
        ModEffectType.PENTA_NAPALM,
        ModEffectType.CONVECTRIX_EFFICIENCY,
        ModEffectType.BRONCO_CLOSE_STUN,
        ModEffectType.LATRON_NEXT_SHOT_BONUS,
        ModEffectType.LATRON_NEXT_SHOT_BONUS_BUFF,
        ModEffectType.DAIKYU_DISTANCE_DAMAGE,
        ModEffectType.PARIS_STATUS_RESTORE_HEALTH,
        ModEffectType.SOMA_PRIME_HIT_CRITICAL]
}

/**
 *
 * @returns {number[]} - List of all elemental mod effect types (4 primary, 6 secondary).
 */
function elementalModEffectTypes() {
    return [ModEffectType.COLD,
        ModEffectType.ELECTRIC,
        ModEffectType.HEAT,
        ModEffectType.TOXIN,
        ModEffectType.BLAST,
        ModEffectType.CORROSIVE,
        ModEffectType.GAS,
        ModEffectType.MAGNETIC,
        ModEffectType.RADIATION,
        ModEffectType.VIRAL]
}

module.exports = {
    DamageType,
    isPrimaryElement,
    breakDownSecondaryElement,
    ModRarity,
    ModEffectType,
    elementalModEffectToDamage,
    usefulModEffectTypes,
    elementalModEffectTypes
}