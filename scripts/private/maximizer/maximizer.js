const {Metrics} = require('../classes/metrics');
const {Weapon, WeaponInstance} = require('../classes/weapon');
const {Enemy, EnemyInstance} = require('../classes/enemy');
const {Mod, ModInstance} = require('../classes/mod');
const {Simulation} = require('../classes/simulation')
const {SimulationSettings} = require('../classes/simulation-settings')
const {runSimulation} = require('./simulation-worker');

const enableLogging = true;
const numEnemies = 50;
const enemyLevel = 150; // TODO maybe just sample on 100 SUPER high level enemies to measure actual substantial differences in performance as you scale up

/* TODO
    - incompatibilities
    - optimise simulator so we can use random sims (maybe recode own which just returns the metrics)
    - finetune maximizer settings according to the correct data: ensure it returns the same stuff across many runs
*/

function sortMods(a, b) {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
}

/**
 *
 * @param {Weapon} weapon
 * @param additionalSettingsVariables
 * @param {number} firingMode
 * @returns {Promise<void>}
 */
async function queueSimulationMaximizer(weapon, additionalSettingsVariables, firingMode) {
    let enemy = await Enemy.fromID('corrupted-heavy-gunner');
    let enemyInstance = new EnemyInstance(enemy, enemyLevel)

    let validModsList = await Mod.getValidModsFor(weapon, true);
    let unwanted = ['primed-bane-of-infested',
        'primed-bane-of-corpus',
        'primed-bane-of-grineer',
        'bane-of-infested',
        'bane-of-corpus',
        'bane-of-grineer',
        'bane-of-corrupted',
        'amalgam-serration'];

    validModsList = validModsList.filter((mod) => !unwanted.includes(mod.id));

    let weaponInstance = new WeaponInstance(weapon, [], firingMode);
    let simulationSettings = new SimulationSettings(1, 0, numEnemies);

    // test code
    /*let builds = [['primed-bane-of-corrupted', 'split-chamber', 'vital-sense', 'serration', 'hunter-munitions', 'point-strike', 'primed-cryo-rounds', 'malignant-force']];
    for (let build of builds) {
        let weaponModded = $Classes.Weapon.FromObject(weapon.ToObject());
        for (let i = 0; i < 8; i++) {
            weaponModded.SetMod(i, $Classes.Mod.FromObject(modData[build[i]]), false);
        }
        let results = mean(await queueSimulation(weaponModded, enemies));
        console.log(build, results);
    }*/
    let testMods = ['primed-bane-of-corrupted', 'split-chamber', 'vital-sense', 'serration', 'hunter-munitions', 'point-strike', 'primed-cryo-rounds', 'malignant-force']
    let actualMods = [];
    for (let modId of testMods) {
        actualMods.push(await ModInstance.fromModID(modId));
    }
    weaponInstance.setMods(actualMods);

    // Threshold Acceptance with Temperature Correlated with Quality
    // Pick a random set of 8 mods
    //let currentMods = getRandomMods(validModsList, weaponInstance, true);
    let simulation = new Simulation(weaponInstance, [enemyInstance], simulationSettings);
    weaponInstance.logMods();
    let metrics = (await simulation.run())[0]; // returns Metrics[][], we seek Metrics[] which contains one Metrics for each iteration of the enemy type
    let currentResults = Metrics.meanKillTime(metrics);

    let x = []
    for (let metric of metrics) {
        x.push(metric.killTime);
    }
    console.log(x.toString());
    console.log(currentResults);
    return;

    let allTimeBestBuilds = new Map(); // build (Mod[]): kill-time (number)
    let allTimeBestResults = currentResults;

    allTimeBestBuilds.set(currentMods.sort(sortMods), currentResults);
    if (enableLogging) console.log('Maximization for:', weapon.Name);
    if (enableLogging) console.log('Initial state:', currentMods, currentResults);

    let numSamples = 100;
    let maxIterations = 7500;
    let temperatureSample = await new Promise((resolve) => {
        let temperatures = [];
        for (let k = 0; k < numSamples; k++) {
            (async () => {
                let [randomMods, randomWeapon] = getRandomMods(validModsList, weapon);
                let [neighbourMods, neighbourWeapon] = getRandomNeighbour(randomMods, validModsList, randomWeapon);
                let randomResults = await dynamicPool.exec({
                    task: runSimulation,
                    param: {
                        weapon: randomWeapon.ToObject(),
                        enemy: enemy.ToObject(),
                    }
                })
                let neighbourResults = await dynamicPool.exec({
                    task: runSimulation,
                    param: {
                        weapon: neighbourWeapon.ToObject(),
                        enemy: enemy.ToObject(),
                    }
                })
                let diff = Math.abs(neighbourResults - randomResults) / 75;
                if (diff < 0.1) diff = Math.random() * 0.9 + 0.1;
                temperatures.push(diff);
                if (temperatures.length === numSamples) {
                    temperatures.sort((a, b) => b - a);
                    resolve(temperatures);
                }
            })();

        }
    })

    let temperatures = [];
    let numFillerPoints = maxIterations / numSamples;
    for (let i = 0; i < temperatureSample.length; i++) {
        let high = temperatureSample[i];
        let low = i + 1 === temperatureSample.length ? 0.1 : temperatureSample[i + 1];
        let diff = high - low;
        for (let j = 0; j < numFillerPoints; j++) {
            temperatures[i * numFillerPoints + j] = diff * (numFillerPoints - j) / numFillerPoints + low;
        }
    }

    //let numIterationsNoImprovement = 0;
    //let temperature = enemyLevel * 2;
    let randomErrorThreshold = 0.2; // TODO run tests on all the builds at the end with 10k enemies or something
    for (let k = 0; k < maxIterations; k++) {
        /*if (numIterationsNoImprovement === 20) {
            temperature *= 0.8;
            numIterationsNoImprovement = 0;
        }*/

        let [newMods, newWeapon] = getRandomNeighbour(currentMods, validModsList, currentWeapon);
        let newResults = mean(await queueSimulation(newWeapon, enemies));
        if (newResults < allTimeBestResults - randomErrorThreshold) {
            allTimeBestBuilds.clear();
            allTimeBestBuilds.set(newMods.sort(), newResults);
            allTimeBestResults = newResults;
            //numIterationsNoImprovement = 0;
        } else if (Math.abs(newResults - allTimeBestResults) < randomErrorThreshold && !containsUnordered(allTimeBestBuilds, newMods)) {
            allTimeBestBuilds.set(newMods.sort(), newResults)
            allTimeBestResults = Math.min(allTimeBestResults, newResults);
        } else {
            //numIterationsNoImprovement++;
        }

        if (thresholdAcceptance(newResults, currentResults, temperatures[k])) {
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

/**
 *
 * @param newResults
 * @param currentResults
 * @param temperature
 * @returns {boolean}
 */
function thresholdAcceptance(newResults, currentResults, temperature) {
    let quality = currentResults - newResults // the higher the better
    if (enableLogging) console.log('Quality:', quality, '-Temperature:', -temperature);
    return quality > (-temperature);
}

/**
 *
 * @param {Mod[]} validModsList
 * @param {WeaponInstance} weaponInstance
 * @param {boolean} updateWeapon - Whether or not to set the weapon instance's mods to the random mods found.
 * @returns {ModInstance[]} - List of the random mods.
 */
function getRandomMods(validModsList, weaponInstance, updateWeapon) {
    let randomMods = [];
    for (let i = 0; i < 8; i++) {
        let newMod = new ModInstance(validModsList[Math.floor(Math.random() * validModsList.length)]);
        while (!isCompatible(randomMods, newMod)) {
            newMod = new ModInstance(validModsList[Math.floor(Math.random() * validModsList.length)]);
        }
        randomMods.push(newMod);
    }
    if (updateWeapon) weaponInstance.setMods(randomMods);
    return randomMods;
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
 * @returns {[number]} killTimes
 */
async function queueSimulation(weapon, enemies) {
    return await new Promise((resolve) => {
        let killTimes = []
        for (let e = 0; e < enemies.length; e++) {
            (async () => {
                // Kill time for this enemy
                killTimes[e] = await dynamicPool.exec({
                    task: runSimulation,
                    param: {
                        weapon: weapon.ToObject(),
                        enemy: enemies[e].ToObject(),
                    }
                })
                if (killTimes.length === enemies.length) {
                resolve(killTimes);
            }
            })();

        }
    })

}

/**
 *
 * @param {ModInstance[]} existingMods
 * @param {ModInstance} newMod
 * @returns {boolean}
 */
function isCompatible(existingMods, newMod) {
    for (let mod of existingMods) if (mod.getMod().getID() === newMod.getMod().getID()) return false;

    /*let s = 'serration';
    let aS = 'amalgam-serration';
    let serrations = [s, aS];
    if ((existingMods.includes(s) || existingMods.includes(aS)) && serrations.includes(newMod)) {
        return false;
    }*/
    return true; // TODO change to check for incompatibility instead, would be Mod.isCompatibleWithMods, same signature
}

/**
 *
 * @param list
 * @returns {number}
 */
function mean(list) {
    return (list.reduce((a,b) => (a + b))) / list.length;
}

/**
 *
 * @param outerList
 * @param innerList
 * @returns {boolean}
 */
function containsUnordered(outerList, innerList) {
    for (let eachList of outerList) {
        if (isSameArray(eachList, innerList)) {
            return true;
        }
    }
    return false;
}

/**
 *
 * @param array1
 * @param array2
 * @returns {boolean}
 */
function isSameArray(array1, array2) {
    const isInArray1 = array1.every(item => array2.find(item2 => item===item2));
    const isInArray2 = array2.every(item => array1.find(item2 => item===item2));
    return array1.length === array2.length && isInArray1 && isInArray2;
}



// Driver code
(async () => {
    let weapon = await Weapon.fromID('ignis-wraith');
    await new Promise(r => setTimeout(r, 2000));
    queueSimulationMaximizer(weapon, {}, 0)
        .then(async () => {
            const {dynamicPool} = require('../classes/simulation');
            await dynamicPool.destroy();
        });
    console.log('Ready to start min/maxing hard...');
})()