const {DynamicPool} = require('node-worker-threads-pool');

class Multithread {
    static dynamicPool = new DynamicPool(8);

    static getDynamicPool() {
        return Multithread.dynamicPool;
    }

    static async close() {
        await Multithread.dynamicPool.destroy();
    }
}

module.exports = {
    Multithread
}