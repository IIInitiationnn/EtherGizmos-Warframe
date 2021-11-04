const {Multithread} = require('./multithread');
const {SimulationSettings} = require('../classes/simulationSettings');
const {Maximizer} = require('../maximizer/maximizer');
const {conn} = require('../sql/connection');

// Driver code
(async () => {
    // Settings
    const weaponId = 'ignis-wraith';
    const enemyId = 'corrupted-heavy-gunner';
    const enemyLevel = 100;
    const firingMode = 0;
    let simulationSettings = new SimulationSettings(1, 0, 2, 750, true);

    console.log('Ready to start min/maxing hard...');

    await Maximizer.findOptimalBuild(weaponId, enemyId, enemyLevel, firingMode, simulationSettings);
    conn.end()

    await Multithread.close();
})();