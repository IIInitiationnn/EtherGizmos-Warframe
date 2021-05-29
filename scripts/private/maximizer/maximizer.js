const simulationController = require('../simulation/controller');
const $Classes = require('../../public/class-definitions/classes');
const fetch = require('isomorphic-fetch');
const underscore = require('underscore')
let weaponData, enemyData, modData;

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




async function queueSimulationMaximizer(weapon, additionalSettingsVariables) {
/*    let enemy = $Classes.Enemy.FromJSONObject(enemyData['corrupted-heavy-gunner']);
    enemy.SetLevel(150);
    simulationController.QueueSimulation(messageHandler, weapon, Array(20).fill(enemy), false, 0.9, 0.5, additionalSettingsVariables);
    promise.then((object) => {
        console.log('Killtimes: ' + object);
        }, (e) => {
            console.log(e);
        })
        .catch((e) => {
            console.error(e.stack);
        }
    )*/

/*    let modList = ['primed-bane-of-corrupted', 'split-chamber', 'vital-sense', 'serration',
        'hunter-munitions', 'point-strike', 'primed-cryo-rounds', 'malignant-force']
    for (let i = 0; i < 8; i++) {
        shedu.SetMod(i, $Classes.Mod.FromObject(modData[modList[i]]), false);
    }*/

    let enemy = $Classes.Enemy.FromJSONObject(enemyData['corrupted-heavy-gunner']);
    enemy.SetLevel(150);

    let validMods = new Map();
    for (let [modID, modInfo] of Object.entries(modData)) {
        let mod = $Classes.Mod.FromObject(modInfo);
        if (mod.IsCompatible(weapon)) {
            validMods[modID] = mod;
        }
    }

    let buildKilltimeMap = await runSimulation(weapon, [enemy], validMods, additionalSettingsVariables);
    console.log(buildKilltimeMap);
}

async function runSimulation(weapon, enemies, validMods, additionalSettingsVariables) {
    return await new Promise((resolve) => {
        let buildKilltimeMap = new Map();
        let numSims = 1;
        for (let [modID, mod] of Object.entries(validMods)) {
            let messageHandler;
            let killTimes = [];
            messageHandler = new $Classes.EncodedMessageHandler()
                .CreateHandle($Classes.SimulationRequest.name, function (obj) {
                })
                .CreateHandle($Classes.SimulationProgress.name, function (obj) {
                })
                .CreateHandle($Classes.Metrics.name, function (obj) {
                    killTimes.push(obj['KillTime']);
                    if (killTimes.length === numSims) {
                        buildKilltimeMap[modID] = killTimes;
                    }
                    if (underscore.size(buildKilltimeMap) === underscore.size(validMods)) {
                        resolve(buildKilltimeMap);
                    }
                })
                .CreateHandle($Classes.SimulationError.name, function (obj) {});

            weapon.SetMod(0, mod, false);
            simulationController.QueueSimulation(messageHandler, weapon, enemies, true, 0.9, 0.5, additionalSettingsVariables);
        }
    })

}

/*
async function runSimulation(weapon, enemies, validMods, additionalSettingsVariables) {
    let buildKilltimeMap = new Map();
    let numSims = 1;
    for (let [modID, mod] of Object.entries(validMods)) {
        let messageHandler;
        let promise = new Promise(function(resolve, reject) {
            let killTimes = [];
            messageHandler = new $Classes.EncodedMessageHandler()
                .CreateHandle($Classes.SimulationRequest.name, function(obj) {})
                .CreateHandle($Classes.SimulationProgress.name, function(obj) {
                    // TODO resolves one simulation too early??
                    /!*if (obj.Progress === 1) {
                        resolve(killTimes);
                    }*!/
                })
                .CreateHandle($Classes.Metrics.name, function(obj) {
                    killTimes.push(obj['KillTime']);
                    if (killTimes.length === numSims) {
                        resolve(killTimes);
                    }
                })
                .CreateHandle($Classes.SimulationError.name, function(obj) {
                    reject(new Error(obj));
                });

        });

        weapon.SetMod(0, mod, false);
        simulationController.QueueSimulation(messageHandler, weapon, enemies, true, 0.9, 0.5, additionalSettingsVariables);
        promise.then((object) => {
            buildKilltimeMap[modID] = object;
            if (underscore.size(buildKilltimeMap) === underscore.size(validMods)) {
                return buildKilltimeMap;
            }}, (e) => {
                console.log(e);
            })
            .catch((e) => {
                console.error(e.stack);
            }
        )
    }
}*/
