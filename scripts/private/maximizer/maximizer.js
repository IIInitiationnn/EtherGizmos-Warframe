const $Classes = require('../../public/class-definitions/classes');
const fetch = require('isomorphic-fetch');
const {queueSimulation} = require("./simulation-worker");
const enableLogging = true;

let weaponData, enemyData, modData;
const numEnemies = 20;
const enemyLevel = 150;

/* TODO
    - incompatibilities
    - optimise simulator so we can use random sims (maybe recode own which just returns the metrics)
    - finetune maximizer settings according to the correct data: ensure it returns the same stuff across many runs
    - 3rd threshold acceptance method using more mathematical temperature / threshold sequences, after trying tweaking (ie the above task)
*/

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
    enemy.SetLevel(enemyLevel);

    let validModsMap = new Map();
    let validModsList = [];
    for (let [modID, modInfo] of Object.entries(modData)) {
        if (modID === 'proton-jet') continue;
        let mod = $Classes.Mod.FromObject(modInfo);
        if (mod.IsCompatible(weapon)) {
            validModsList.push(modID);
            validModsMap.set(modID, mod);
        }
    }
    let enemies = Array(numEnemies).fill(enemy);

    // Threshold Acceptance with Temperature Correlated with Quality
    // Pick a random set of 8 mods
    let [currentMods, currentWeapon] = getRandomMods(validModsList, weapon);
    let currentResults = mean(queueSimulation(new $Classes.EncodedMessageHandler(), currentWeapon, enemies));
    let allTimeBestBuilds = [currentMods];
    let allTimeBestResults = currentResults;
    if (enableLogging) console.log('Initial state:', currentMods, currentResults);

    let maxIterations = 2000;
    let numIterationsNoImprovement = 0;
    let temperature = enemyLevel * 3;
    for (let k = 0; k < maxIterations; k++) {
        if (numIterationsNoImprovement === 20) {
            temperature *= 0.8;
            numIterationsNoImprovement = 0;
        }

        let [newMods, newWeapon] = getRandomNeighbour(currentMods, validModsList, currentWeapon);
        let newResults = mean(queueSimulation(new $Classes.EncodedMessageHandler(), newWeapon, enemies));
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
            if (enableLogging) console.log('State ' + k + ': (rejected build)', newMods, newResults);
        }
        if (enableLogging) console.log('State ' + k + ': (current build)', currentMods, currentResults, '\n\n\n');
        if (k > 0 && k % 250 === 0) {
            if (enableLogging) console.log('Best builds so far:', allTimeBestBuilds, allTimeBestResults, '\n\n\n');
        }
    }
    if (enableLogging) console.log('All-time best builds:', allTimeBestBuilds, allTimeBestResults);
}

function thresholdAcceptance(newResults, currentResults, temperature) {
    let quality = currentResults - newResults // the higher the better
    if (enableLogging) console.log('Quality:', quality, '-Temperature:', -temperature);
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
    return true; // TODO change to check for incompatibility instead
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