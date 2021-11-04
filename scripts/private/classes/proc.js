const {WeaponDamageDistribution} = require("./weaponDamageDistribution");
const {DAMAGE_TYPE, MOD_EFFECT_TYPE} = require('../utils/magicTypes');

class Proc {
    constructor(damageType, moddedBaseDamage, weaponInstance) {
        this.type = damageType; // element type of the actual status effect
        this.damageType = undefined; // element type of the tick damage
        this.damage = undefined;
        this.duration = undefined;

        /* Stores the duration since the proc was created for all procs except heat.
        * In the case of heat, it stores the time since the last proc was added. */
        this.elapsedDuration = 0;

        // Heat related fields
        this.stacks = 0;
        this.totalDuration = 0;

        switch (damageType) {
            case (DAMAGE_TYPE.IMPACT):
                this.damageType = null;
                this.damage = 0;
                this.duration = 1;
                break;
            case (DAMAGE_TYPE.PUNCTURE):
                this.damageType = null;
                this.damage = 0;
                this.duration = 6;
                break;
            case (DAMAGE_TYPE.SLASH):
                this.damageType = DAMAGE_TYPE.TRUE;
                this.damage = 0.35 * moddedBaseDamage;
                this.duration = 6;
                break;
            case (DAMAGE_TYPE.COLD):
                this.damageType = null;
                this.damage = 0;
                this.duration = 6;
                break;
            case (DAMAGE_TYPE.ELECTRIC):
                this.damageType = damageType;
                this.damage = 0.5 * moddedBaseDamage * weaponInstance.getElectricMultiplier();
                this.duration = 6;
                break;
            case (DAMAGE_TYPE.HEAT):
                this.damageType = damageType;
                this.damage = 0.5 * moddedBaseDamage * weaponInstance.getHeatMultiplier();
                this.duration = 6;
                this.stacks = 1;
                break;
            case (DAMAGE_TYPE.TOXIN):
                this.damageType = damageType;
                this.damage = 0.5 * moddedBaseDamage * weaponInstance.getToxinMultiplier();
                this.duration = 6;
                break;
            case (DAMAGE_TYPE.BLAST):
                this.damageType = null;
                this.damage = 0;
                this.duration = 6;
                break;
            case (DAMAGE_TYPE.CORROSIVE):
                this.damageType = null;
                this.damage = 0;
                this.duration = 8;
                break;
            case (DAMAGE_TYPE.GAS):
                this.damageType = damageType;
                this.damage = 0.5 * moddedBaseDamage;
                this.duration = 6;
                break;
            case (DAMAGE_TYPE.MAGNETIC):
                this.damageType = null;
                this.damage = 0;
                this.duration = 6;
                break;
            case (DAMAGE_TYPE.RADIATION):
                this.damageType = null;
                this.damage = 0;
                this.duration = 12;
                break;
            case (DAMAGE_TYPE.VIRAL):
                this.damageType = null;
                this.damage = 0;
                this.duration = 6;
                break;
        }

        this.duration = Math.max(0, this.duration * weaponInstance.getStatusDurationMultiplier());
    }

    /**
     * The status effect type. Not to be confused with the status damage type, which may be null for statuses
     * which do not inflict damage, or may be different from the status effect type (e.g. Slash has True damage type).
     * @returns {number} - See DamageType.
     */
    getType() {
        return this.type;
    }

    /**
     * The status damage type. Not to be confused with the status effect type.
     * @returns {number} - See DamageType.
     */
    getDamageType() {
        return this.damageType;
    }

    getDamage() {
        return this.damage;
    }

    /**
     * Fetch the remaining time on the status effect.
     * @returns {number}
     */
    getRemainingDuration() {
        return this.duration - this.elapsedDuration;
    }

    getNextEventTimeStep() {
        switch (this.type) {
            case (DAMAGE_TYPE.IMPACT):
            case (DAMAGE_TYPE.PUNCTURE):
            case (DAMAGE_TYPE.COLD):
            case (DAMAGE_TYPE.BLAST):
            case (DAMAGE_TYPE.CORROSIVE):
            case (DAMAGE_TYPE.MAGNETIC):
            case (DAMAGE_TYPE.RADIATION):
            case (DAMAGE_TYPE.VIRAL):
                // Removal at duration 0
                return this.getRemainingDuration();
            case (DAMAGE_TYPE.SLASH):
                // Damage ticks at elapsed duration: 1 2 ... Math.floor(this.duration)
                // Removal at elapsed duration: this.duration
            case (DAMAGE_TYPE.ELECTRIC):
                // Damage ticks at elapsed duration: 0 1 2 ... Math.ceiling(this.duration) - 1
                // Removal at elapsed duration: this.duration
            case (DAMAGE_TYPE.HEAT):
                // Damage ticks at elapsed duration: 1 2 ... Math.floor(this.duration)
                // Removal at elapsed duration: this.duration
            case (DAMAGE_TYPE.TOXIN):
                // Damage ticks at elapsed duration: 1 2 ... Math.floor(this.duration)
                // Removal at elapsed duration: this.duration
            case (DAMAGE_TYPE.GAS):
                // Damage ticks at elapsed duration: 0 1 2 ... Math.ceiling(this.duration) - 1
                // Removal at elapsed duration: this.duration

                let x;
                if (Number.isInteger(this.elapsedDuration)) {
                    /* We are on an integer elapsedDuration so
                     * (a) we have a damage tick in 1 second
                     * (b) the proc is going to end in <1 second */
                    x = Math.min(1, this.getRemainingDuration());
                } else {
                    /* We are on a non-integer elapsedDuration so
                     * (a) we have a damage tick in <1 second
                     * (b) the proc is going to end in <1 second */
                    x = Math.min(Math.ceil(this.elapsedDuration) - this.elapsedDuration, this.getRemainingDuration());
                }
                return x;
        }
    }

    /**
     * Coalesces a new heat proc into an existing heat proc.
     * TODO when existing heat proc is at 0 duration remaining, dont add a new heat proc
     *  this can happen since we add procs before removing, as some procs need to do damage on their final tick
     *  so in this case, the coalescence process should kill the old proc first then start a new one without
     *  all the damage buildup
     */
    augment(proc) {
        this.elapsedDuration = 0;
        this.duration = proc.duration; // in case status duration can change, which it cannot at the moment
        this.damage += proc.damage;
        this.stacks += 1;
    }

    /**
     * Progress the proc timer by the specified duration.
     * @param {number} duration
     */
    advanceTimeStep(duration) {
        this.elapsedDuration += duration;
        this.totalDuration += duration;
    }

    toWeaponDamageDistribution() {
        return new WeaponDamageDistribution()
            .set(this.getDamageType(), this.getDamage());
    }

    /**
     *
     * @param {Map<number, Proc[]>} procs
     * @returns {WeaponDamageDistribution} - The total damage of all the procs.
     */
    static damageDistributionOfProcs(procs) {
        let damagingProcs = [];
        for (let damageType of [DAMAGE_TYPE.SLASH, DAMAGE_TYPE.ELECTRIC, DAMAGE_TYPE.HEAT, DAMAGE_TYPE.TOXIN, DAMAGE_TYPE.GAS]) {
            damagingProcs.push(...(procs.get(damageType).filter(proc => proc.getRemainingDuration() === 0 && proc.getDamage() !== 0)));
        }

        return WeaponDamageDistribution.coalesce(damagingProcs.map(proc => proc.toWeaponDamageDistribution()));
    }

    /**
     * @private
     * @param {Proc[]} procs
     * @param {number} type - See DamageType
     * @returns {boolean} - Whether or not the list of procs contains a damage type.
     */
    static hasProcType_(procs, type) {
        for (let proc of procs) {
            if (proc.getType() === type) return true;
        }
        return false;
    }

    /**
     * @param {Proc[]} procs
     * @returns {boolean} Whether or not the list of procs contains a slash proc.
     */
    static hasSlash(procs) {
        return Proc.hasProcType_(procs, DAMAGE_TYPE.SLASH);
    }

    /**
     * @param {Proc[]} procs
     * @returns {boolean} Whether or not the list of procs contains an impact proc.
     */
    static hasImpact(procs) {
        return Proc.hasProcType_(procs, DAMAGE_TYPE.IMPACT);
    }

}

module.exports = {
    Proc
}