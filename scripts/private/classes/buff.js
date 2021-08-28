class Buff {
    /**
     * A conditional buff applied to a weapon. Includes:
     * - Latron: Double Tap mod augment
     * - Soma Prime: Hata-Satya mod augment
     * - TODO other stuff not implemented... including condition overload... basically conditional mods / weapon fx
     */
    constructor() {
        /** @type {Map<ModEffectType, number>} ModEffectType: Power */
        this.effects = new Map();

        this.remainingDuration = undefined;
    }

    /**
     *
     * @returns {Map<ModEffectType, number>}
     */
    getEffects() {
        return this.effects;
    }
}