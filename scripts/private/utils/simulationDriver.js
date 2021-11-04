const {Multithread} = require('./multithread');
const {Metrics} = require('../classes/metrics');
const {BuildUtils} = require('./buildUtils');
const {Data} = require('../data/game');
const {ModInstance} = require("../classes/mod");
const {Simulation} = require('../classes/simulation')
const {SimulationSettings} = require("../classes/simulationSettings");
const {EnemyInstance} = require("../classes/enemy");
const {WeaponInstance} = require("../classes/weapon");
const {conn} = require('../sql/connection');

// Driver code
(async () => {
    // Settings
    const weaponId = 'ignis-wraith';
    const enemyId = 'corrupted-heavy-gunner';
    const build1 = ['primed-bane-of-corrupted', 'split-chamber', 'vital-sense', 'serration', 'hunter-munitions', 'point-strike', 'primed-cryo-rounds', 'malignant-force']
    const build2 = ['bladed-rounds', 'combustion-beam', 'primed-bane-of-corrupted', 'stormbringer', 'split-chamber', 'primed-shred', 'infected-clip', 'serration'];
    const build3 = ['bladed-rounds', 'combustion-beam', 'primed-bane-of-corrupted', 'stormbringer', 'split-chamber', 'vile-acceleration', 'infected-clip', 'serration'];
    const build4 = ['vital-sense', 'point-strike', 'primed-bane-of-corrupted', 'stormbringer', 'split-chamber', 'vile-acceleration', 'infected-clip', 'serration'];
    const build5 = [/*'galvanized-chamber', 'galvanized-scope', */'primed-bane-of-corpus', 'critical-delay', 'vile-acceleration', 'vital-sense', 'primed-cryo-rounds', 'infected-clip'];

    const build = build4;

    const numEnemies = 5000;
    const enemyLevel = 100;
    const firingMode = 0;

    let weapon = await Data.getWeapon(weaponId);
    let enemy = await Data.getEnemy(enemyId);
    let currentWeapon = new WeaponInstance(weapon, await ModInstance.fromModIds(build), firingMode);
    let enemyInstance = new EnemyInstance(enemy, enemyLevel);

    console.log(BuildUtils.toBuildString(currentWeapon.getMods()));

    let simulationSettings = new SimulationSettings(1, 0, numEnemies);
    let simulation = new Simulation(currentWeapon, [enemyInstance], simulationSettings);
    let metrics = (await simulation.run())[0];

    //console.log(metrics);
    console.log(Metrics.meanKillTime(metrics));
    conn.end()

    await Multithread.close();
})();