const simulationController = require('../simulation/controller');
const $Classes = require('../../public/class-definitions/classes');
const fetch = require('isomorphic-fetch');
let weaponData, enemyData, modData;
let numEnemies = 1;

// TODO
//  - incompatibilities
//  - optimise simulator so we can use random sims
//  - finetune maximizer settings according to the correct data: ensure it returns the same stuff across many runs

let algorithm;
if (process.argv.length < 2 || !['greedy', 'a*', 'annealing', 'threshold', 'threshold2', 'test'].includes(process.argv[2])) {
    algorithm = 'threshold2';
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

async function queueSimulationMaximizer(weapon, additionalSettingsVariables) {
    let enemy = $Classes.Enemy.FromJSONObject(enemyData['corrupted-heavy-gunner']);
    let level = 800;
    enemy.SetLevel(level);

    let validModsMap = new Map();
    let validModsList = [];
    for (let [modID, modInfo] of Object.entries(modData)) {
        let mod = $Classes.Mod.FromObject(modInfo);
        if (mod.IsCompatible(weapon)) {
            validModsList.push(modID);
            validModsMap.set(modID, mod);
        }
    }
    let enemies = Array(numEnemies).fill(enemy);
    switch (algorithm) {
        // Greedy (to observe behaviour)
        case 'greedy':
            let build = []
            for (let i = 0; i < 8; i++) {
                let [modID, killTime] = await newGreedyMod(weapon, enemies, validModsMap, additionalSettingsVariables, i);
                validModsMap.delete(modID);
                weapon.SetMod(i, $Classes.Mod.FromObject(modData[modID]), false);
                build.push(modID);
                console.log(build, killTime);
            }
            break;
        // Simulated Annealing
        case 'annealing': {
            // Pick a random set of 8 mods
            let [bestMods, bestWeapon] = getRandomMods(validModsList, weapon);
            let bestResults = await runSimulation(bestWeapon, enemies, additionalSettingsVariables);
            console.log('Initial state:', bestMods, bestResults);

            let maxIterations = 5000;
            for (let k = 0; k < maxIterations; k++) {
                let temperature = maxIterations / (k + 1);
                let [currentMods, currentWeapon] = getRandomNeighbour(bestMods, validModsList, bestWeapon);
                let currentResults = await runSimulation(currentWeapon, enemies, additionalSettingsVariables);

                if (annealingAcceptance(currentResults, bestResults, temperature)) {
                    bestMods = currentMods;
                    bestResults = currentResults;
                    bestWeapon = currentWeapon;
                } else {
                    console.log('State ' + k + ': (rejected build)', currentMods, currentResults);
                }
                console.log('State ' + k + ': (current best build)', bestMods, bestResults, '\n\n\n');
            }
            break;
        }
        // Threshold Acceptance with Exponential Temperature
        case 'threshold': {
            // Pick a random set of 8 mods
            let [currentMods, currentWeapon] = getRandomMods(validModsList, weapon);
            let currentResults = await runSimulation(currentWeapon, enemies, additionalSettingsVariables);
            let allTimeBestBuilds = [currentMods];
            let allTimeBestResults = currentResults;
            console.log('Initial state:', currentMods, currentResults);

            let maxIterations = 2000;
            for (let k = 0; k < maxIterations; k++) {
                let temperature = level / (3 * k + 1);
                let [newMods, newWeapon] = getRandomNeighbour(currentMods, validModsList, currentWeapon);
                let newResults = await runSimulation(newWeapon, enemies, additionalSettingsVariables);

                if (newResults < allTimeBestResults) {
                    allTimeBestBuilds = [newMods];
                    allTimeBestResults = newResults;
                } else if (newResults === allTimeBestResults && !containsUnordered(allTimeBestBuilds, newMods)) {
                    allTimeBestBuilds.push(newMods)
                }

                if (thresholdAcceptance(newResults, currentResults, temperature)) {
                    currentMods = newMods;
                    currentResults = newResults;
                    currentWeapon = newWeapon;
                } else {
                    console.log('State ' + k + ': (rejected build)', newMods, newResults);
                }
                console.log('State ' + k + ': (current build)', currentMods, currentResults, '\n\n\n');
                if (k > 0 && k % 250 === 0) {
                    console.log('Best builds so far:', allTimeBestBuilds, allTimeBestResults, '\n\n\n');
                }
            }
            console.log('All-time best builds:', allTimeBestBuilds, allTimeBestResults);
            break;
        }
        // Threshold Acceptance with Temperature Correlated with Quality
        case 'threshold2': {
            // Pick a random set of 8 mods
            let [currentMods, currentWeapon] = getRandomMods(validModsList, weapon);
            let currentResults = await runSimulation(currentWeapon, enemies, additionalSettingsVariables);
            let allTimeBestBuilds = [currentMods];
            let allTimeBestResults = currentResults;
            //console.log('Initial state:', currentMods, currentResults);

            let maxIterations = 2000;
            let numIterationsNoImprovement = 0;
            let temperature = level * 2;
            for (let k = 0; k < maxIterations; k++) {
                if (numIterationsNoImprovement === 20) {
                    temperature *= 0.8;
                    numIterationsNoImprovement = 0;
                }

                let [newMods, newWeapon] = getRandomNeighbour(currentMods, validModsList, currentWeapon);
                let newResults = await runSimulation(newWeapon, enemies, additionalSettingsVariables);
                if (newResults < allTimeBestResults) {
                    allTimeBestBuilds = [newMods];
                    allTimeBestResults = newResults;
                    numIterationsNoImprovement = 0;
                } else if (newResults === allTimeBestResults && !containsUnordered(allTimeBestBuilds, newMods)) {
                    allTimeBestBuilds.push(newMods)
                } else {
                    numIterationsNoImprovement++;
                }

                if (thresholdAcceptance(newResults, currentResults, temperature)) {
                    currentMods = newMods;
                    currentResults = newResults;
                    currentWeapon = newWeapon;
                } else {
                    //console.log('State ' + k + ': (rejected build)', newMods, newResults);
                }
                //console.log('State ' + k + ': (current build)', currentMods, currentResults, '\n\n\n');
                if (k > 0 && k % 250 === 0) {
                    //console.log('Best builds so far:', allTimeBestBuilds, allTimeBestResults, '\n\n\n');
                }
            }
            console.log('All-time best builds:', allTimeBestBuilds, allTimeBestResults);
            break;
        }

        case 'test': {
            let builds = [[ 'heavy-caliber', 'primed-bane-of-grineer', 'hunter-munitions', 'primed-cryo-rounds', 'argon-scope', 'malignant-force', 'bladed-rounds', 'serration' ],
                [ 'heavy-caliber', 'primed-bane-of-corrupted', 'hunter-munitions', 'primed-cryo-rounds', 'argon-scope', 'malignant-force', 'bladed-rounds', 'serration' ],
                [ 'heavy-caliber', 'primed-bane-of-corrupted', 'hunter-munitions', 'rime-rounds', 'argon-scope', 'malignant-force', 'bladed-rounds', 'serration' ],
                [ 'heavy-caliber', 'primed-bane-of-infested', 'hunter-munitions', 'rime-rounds', 'argon-scope', 'malignant-force', 'bladed-rounds', 'serration' ],
                [ 'heavy-caliber', 'primed-bane-of-infested', 'hunter-munitions', 'rime-rounds', 'argon-scope', 'malignant-force', 'vital-sense', 'serration' ],
                [ 'heavy-caliber', 'primed-bane-of-infested', 'hunter-munitions', 'primed-cryo-rounds', 'argon-scope', 'malignant-force', 'bladed-rounds', 'serration' ],
                ['vile-acceleration', 'split-chamber', 'vital-sense', 'serration', 'heavy-caliber', 'point-strike', 'primed-cryo-rounds', 'malignant-force'],
                ['primed-bane-of-corrupted', 'split-chamber', 'vital-sense', 'serration', 'hunter-munitions', 'point-strike', 'primed-cryo-rounds', 'malignant-force']];
            for (let build of builds) {
                let weaponModded = $Classes.Weapon.FromObject(weapon.ToObject());
                for (let i = 0; i < 8; i++) {
                    weaponModded.SetMod(i, $Classes.Mod.FromObject(modData[build[i]]), false);
                }
                let results = await runSimulation(weaponModded, enemies, additionalSettingsVariables);
                console.log(build, results);
            }
        }

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

function annealingAcceptance(newResults, currentResults, temperature) {
    let diff = newResults - currentResults // the lower the better
    console.log('Diff:', diff, 'Temperature:', temperature);
    // If new results are better, diff will be negative, exponential > 1 => returns true
    // Otherwise returns with random chance
    return Math.exp(-diff / temperature) > Math.random();
}

function thresholdAcceptance(newResults, currentResults, temperature) {
    let quality = currentResults - newResults // the higher the better
    //console.log('Quality:', quality, '-Temperature:', -temperature);
    return quality > (-temperature);
}

function getRandomMods(validModsList, weapon) {
    let randomMods = [];
    let weaponModded = $Classes.Weapon.FromObject(weapon.ToObject());
    for (let i = 0; i < 8; i++) {
        let modID = validModsList[Math.floor(Math.random() * validModsList.length)];
        while (!isCompatible(randomMods, modID)) {
            modID = validModsList[Math.floor(Math.random() * validModsList.length)];
        }
        randomMods.push(modID);
        weaponModded.SetMod(i, $Classes.Mod.FromObject(modData[modID]), false);
    }
    return [randomMods, weaponModded];
}

/**
 *
 * @param {Array} existingMods
 * @param {Array} validModsList
 * @param {import('../../public/class-definitions/classes').Weapon} weapon
 */
function getRandomNeighbour(existingMods, validModsList, weapon) {
    let weaponModded = $Classes.Weapon.FromObject(weapon.ToObject());
    let position = Math.floor(Math.random() * existingMods.length);
    let newMods = JSON.parse(JSON.stringify(existingMods));
    // Remove existing mod
    newMods.splice(position, 1);
    // Find new compatible mod
    let modID = validModsList[Math.floor(Math.random() * validModsList.length)];
    while (!isCompatible(newMods, modID)) {
        modID = validModsList[Math.floor(Math.random() * validModsList.length)];
    }
    // Reinsert new mod
    newMods.splice(position, 0, modID);
    weaponModded.SetMod(position, $Classes.Mod.FromObject(modData[modID]), false);
    return [newMods, weaponModded];
}

/**
 *
 * @param weapon
 * @param enemies
 * @param additionalSettingsVariables
 * @returns {number} averageKillTime
 */
async function runSimulation(weapon, enemies, additionalSettingsVariables) {
    return await new Promise((resolve) => {
        console.time('sim')
        let weaponModded = $Classes.Weapon.FromObject(weapon.ToObject());
        let messageHandler;
        let killTimes = [];
        messageHandler = new $Classes.EncodedMessageHandler()
            .CreateHandle($Classes.SimulationRequest.name, function (obj) {})
            .CreateHandle($Classes.SimulationProgress.name, function (obj) {})
            .CreateHandle($Classes.Metrics.name, function (obj) {
                killTimes.push(obj['KillTime']);
                if (killTimes.length === numEnemies) {
                    resolve(mean(killTimes));
                    console.timeEnd('sim')
                }
            })
            .CreateHandle($Classes.SimulationError.name, function (obj) {});
        simulationController.QueueSimulation(messageHandler, weaponModded, enemies, false, 0.9, 0.5, additionalSettingsVariables);
    })
}

function isCompatible(existingMods, newMod) {
    if (existingMods.includes(newMod)) {
        return false;
    }
    let s = 'serration';
    let aS = 'amalgam-serration';
    let serrations = [s, aS];
    if ((existingMods.includes(s) || existingMods.includes(aS)) && serrations.includes(newMod)) {
        return false;
    }
    return true; // TODO change to check for incompatibility instead e.g. serration and amalgam
}

function mean(list) {
    return (list.reduce((a,b) => (a + b))) / list.length;
}

function containsUnordered(outerList, innerList) {
    for (let eachList of outerList) {
        if (isSameArray(eachList, innerList)) {
            return true;
        }
    }
    return false;
}

function isSameArray(array1, array2) {
    const isInArray1 = array1.every(item => array2.find(item2 => item===item2));
    const isInArray2 = array2.every(item => array1.find(item2 => item===item2));
    return array1.length === array2.length && isInArray1 && isInArray2;
}
