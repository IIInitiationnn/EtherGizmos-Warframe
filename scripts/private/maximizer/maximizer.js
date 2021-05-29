const simulationController = require('../simulation/controller');
const $Classes = require('../../public/class-definitions/classes');
const fetch = require('isomorphic-fetch');
const underscore = require('underscore')
let weaponData, enemyData, modData;
let numSims = 1;

let algorithm;
if (process.argv.length < 2 || !['greedy', 'a*', 'annealing'].includes(process.argv[2])) {
    algorithm = 'greedy';
} else {
    algorithm = process.argv[2];
}
console.log('Algorithm selected: ' + algorithm);

(async () => {
    function logError(e) {
        console.log(e);
    }
    const response1 = await fetch('https://warframe.ethergizmos.com/data/weapons')
        .catch(logError);
    weaponData = await response1.json();

    const response2 = await fetch('https://warframe.ethergizmos.com/data/enemies')
        .catch(logError);
    enemyData = await response2.json();

    const response3 = await fetch('https://warframe.ethergizmos.com/data/mods')
        .catch(logError);
    modData = await response3.json();

    let shedu = $Classes.Weapon.FromJSONObject(weaponData['shedu']);
    await queueSimulationMaximizer(shedu, {});


})()


function mean(list) {
    return (list.reduce((a,b) => (a + b))) / list.length;
}

async function queueSimulationMaximizer(weapon, additionalSettingsVariables) {
/*    let modList = ['vile-acceleration', 'split-chamber', 'vital-sense', 'serration',
        'heavy-caliber', 'point-strike', 'primed-cryo-rounds', 'malignant-force']
    for (let i = 0; i < 8; i++) {
        weapon.SetMod(i, $Classes.Mod.FromObject(modData[modList[i]]), false);
    }
    simulationController.QueueSimulation(messageHandler, weapon, [enemy], true, 0.9, 0.5, additionalSettingsVariables);
*/
    let enemy = $Classes.Enemy.FromJSONObject(enemyData['corrupted-heavy-gunner']);
    enemy.SetLevel(150);

    let validModsMap = new Map();
    let validModsList = [];
    for (let [modID, modInfo] of Object.entries(modData)) {
        let mod = $Classes.Mod.FromObject(modInfo);
        if (mod.IsCompatible(weapon)) {
            validModsList.push(modID);
            validModsMap.set(modID, mod);
        }
    }

    switch (algorithm) {
        // Greedy (to observe behaviour)
        case 'greedy':
            let build = []
            for (let i = 0; i < 8; i++) {
                let [modID, killTime] = await newGreedyMod(weapon, Array(1).fill(enemy), validModsMap, additionalSettingsVariables, i);
                validModsMap.delete(modID);
                weapon.SetMod(i, $Classes.Mod.FromObject(modData[modID]), false);
                build.push(modID);
                console.log(build, killTime);
            }
            break;
        // A* (Incomplete - probably scrap)
        case 'a*':
            let ratioMap = await ratio(weapon, Array(1).fill(enemy), validModsMap, additionalSettingsVariables, 0)
            console.log(ratioMap);
            break;
        // Simulated Annealing (Incomplete)
        case 'annealing':
            // Pick a random set of 8 mods
            let randomMods = []
            for (let i = 0; i < 8; i++) {
                let modID = validModsList[Math.floor(Math.random() * validModsList.length)];
                while (randomMods.includes(modID)) { // TODO change to check for incompatibility instead e.g. serration and amalgam
                    modID = validModsList[Math.floor(Math.random() * validModsList.length)];
                }
                randomMods.push(modID);
                weapon.SetMod(i, $Classes.Mod.FromObject(modData[modID]), false);
            }
            let results = await runSimulation(weapon, [enemy], additionalSettingsVariables);
            console.log(randomMods, results);
            break;
    }
}

async function newGreedyMod(weapon, enemies, validModsMap, additionalSettingsVariables, position) {
    let buildKillTimeMap = new Map();
    for (let [modID, mod] of validModsMap.entries()) {
        let weaponModded = $Classes.Weapon.FromObject(weapon.ToObject());
        weaponModded.SetMod(position, mod, false);
        let averageKillTime = await runSimulation(weaponModded, enemies, additionalSettingsVariables);
        buildKillTimeMap.set(modID, averageKillTime);
    }
    let ordered = [...buildKillTimeMap.entries()].sort((a, b) => a[1] - b[1]);
    return ordered[0];
}

async function ratio(weapon, enemies, validMods, additionalSettingsVariables, position) {
    let baseline = await runSimulation(weapon, enemies, additionalSettingsVariables);
    let buildKillTimeMap = await runSimulation(weapon, enemies, validMods, additionalSettingsVariables, position);
    for (let [modID, killTime] of buildKillTimeMap.entries()) {
        let ratio = baseline / killTime;
        if (ratio === 1) {
            buildKillTimeMap.delete(modID);
        } else {
            buildKillTimeMap.set(modID, ratio);
        }
    }
    return buildKillTimeMap;
}

/**
 *
 * @param weapon
 * @param enemies
 * @param additionalSettingsVariables
 * @returns {Promise<Map<String><number>>}
 */
async function runSimulation(weapon, enemies, additionalSettingsVariables) {
    return await new Promise((resolve) => {
        let weaponModded = $Classes.Weapon.FromObject(weapon.ToObject());
        let messageHandler;
        let killTimes = [];
        messageHandler = new $Classes.EncodedMessageHandler()
            .CreateHandle($Classes.SimulationRequest.name, function (obj) {})
            .CreateHandle($Classes.SimulationProgress.name, function (obj) {})
            .CreateHandle($Classes.Metrics.name, function (obj) {
                killTimes.push(obj['KillTime']);
                if (killTimes.length === numSims) {
                    resolve(mean(killTimes));
                }
            })
            .CreateHandle($Classes.SimulationError.name, function (obj) {});

        simulationController.QueueSimulation(messageHandler, weaponModded, enemies, true, 0.9, 0.5, additionalSettingsVariables);
        }
    )
}
