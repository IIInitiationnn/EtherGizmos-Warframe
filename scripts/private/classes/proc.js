class Proc {
    constructor(damageType) {
        this.damageType = damageType;
        this.damage = 0;
        this.duration = 0;
        // TODO
    }

    getDamageType() {
        return this.damageType;
    }
}

module.exports = {
    Proc
}