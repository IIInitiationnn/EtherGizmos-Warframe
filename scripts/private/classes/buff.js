class Buff {
    /**
     * A conditional buff applied to a weapon. Includes:
     * - Latron: Double Tap mod augment
     * - Soma Prime: Hata-Satya mod augment
     * - TODO other stuff not implemented... including condition overload... basically conditional mods / weapon fx
     */
    constructor() {
        /** @type {Object.<number, number>} ModEffectType: strength */
        this.effects = undefined;
        this.remainingDuration = undefined;
    }

    /**
     *
     * @returns {Object<number, number>}
     */
    getEffects() {
        return this.effects;
    }
}