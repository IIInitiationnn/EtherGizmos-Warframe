const {Results} = require('../utils/buildUtils');
const {Data} = require('../data/game');
const {Weapon, WeaponInstance} = require('../classes/weapon');
const {EnemyInstance} = require('../classes/enemy');
const {Simulation} = require('../classes/simulation')
const {runSimulation} = require('./simulation-worker');

/* TODO
    - incompatibilities
    - optimisation
    - fixing runtimes
    - finetune maximizer settings according to the correct data: ensure it returns the same stuff across many runs
    - validMods is a list given by the client; the client's supplied list is pre-filtered for only useful mods
*/

class Maximizer {
    static async findOptimalBuild(weaponId, enemyId, enemyLevel, firingMode, simulationSettings) {
        const enableLogging = true;

        let weapon = await Data.getWeapon(weaponId);
        let enemy = await Data.getEnemy(enemyId);

        let currentWeapon = new WeaponInstance(weapon, [], firingMode);
        let enemyInstance = new EnemyInstance(enemy, enemyLevel);

        let validMods = await Data.getValidModsFor(weapon, true);
        let unwanted = ['primed-bane-of-infested', 'primed-bane-of-corpus', 'primed-bane-of-grineer',
            'bane-of-infested', 'bane-of-corpus', 'bane-of-grineer', 'bane-of-corrupted',
            'amalgam-serration',
            'proton-jet',
            'crash-course', 'rupture',
            'cryo-rounds',
            'piercing-caliber', 'piercing-hit',
            'fanged-fusillade', 'sawtooth-clip',
            'vile-precision', 'shred',
            'combustion-beam',
            'fast-hands',
            'riven-mod']
        validMods = validMods.filter(mod => !unwanted.includes(mod.getId()));

        //validMods.forEach(mod => console.log(mod.getId()))

        let results = new Results();

        // Threshold Acceptance with Temperature Correlated with Quality
        // Pick a random set of 8 mods
        let currentMods = currentWeapon.getRandomMods(validMods);
        currentWeapon.setMods(currentMods);

        let simulation = new Simulation(currentWeapon, [enemyInstance], simulationSettings);
        let currentResults = (await simulation.run())[0].map(metric => metric.getKillTime());
        let currentAvg = results.addResult(currentWeapon, currentResults);

        if (enableLogging) {
            console.log('Maximization for:', weapon.name);
            console.log('----- INITIAL STATE -----\n' + currentWeapon.getBuild() + '    - average: ' + currentAvg + '\n\n');
        }

        let maxIterations = 5000;

        let temperatures = await Maximizer.calculateTemperatures(weapon, firingMode, enemyInstance, maxIterations, validMods)

        for (let k = 0; k < maxIterations; k++) {
            let targetNumIterations = Math.floor(k / 25) + 2;

            let newWeapon = await currentWeapon.getRandomNeighbor(validMods, results, targetNumIterations);
            let iterationsNeeded = results.iterationsNeeded(newWeapon,  targetNumIterations);

            simulationSettings.setNumIterations(iterationsNeeded);
            if (enableLogging) {
                console.log('----- STATE ' + k + ' -----')
                console.log('Number of target iterations: ' + targetNumIterations);
                console.log('Number of iterations needed: ' + iterationsNeeded);
            }

            simulation = new Simulation(newWeapon, [enemyInstance], simulationSettings);
            let newResults = (await simulation.run())[0].map(metric => metric.getKillTime());
            let newAvg = results.addResult(newWeapon, newResults);

            if (Maximizer.thresholdAcceptance(newAvg, currentAvg, temperatures[k])) {
                currentWeapon = newWeapon;
                currentMods = currentWeapon.getMods();
                currentAvg = newAvg;
            } else {
                if (enableLogging) console.log('Rejected build:\n' + newWeapon.getBuild() + '    - average: '+ newAvg);
            }

            if (enableLogging) {
                console.log('Current build:\n' + currentWeapon.getBuild() + '    - average: ' + currentAvg, '\n\n');
                if (k > 0 && k % 50 === 0) results.printBest('----- BEST BUILDS SO FAR -----');
            }
        }
        if (enableLogging) results.printBest('----- All-TIME BEST BUILDS -----');
    }

    static async calculateTemperatures(weapon, firingMode, enemyInstance, maxIterations, validMods) {
        /*let temperatureSettings = new SimulationSettings(1, 0, 1);
        let numSamples = 10;
        let temperatureSamples = [];
        for (let k = 0; k < numSamples; k++) {
            let randomWeapon = new WeaponInstance(weapon, [], firingMode);
            randomWeapon.setMods(getRandomMods(validMods));

            let neighborWeapon = await getRandomNeighbor(validMods, randomWeapon);

            let randomSimulation = new Simulation(randomWeapon, [enemyInstance], temperatureSettings);
            let neighborSimulation = new Simulation(neighborWeapon, [enemyInstance], temperatureSettings);

            let randomResults = meanKillTime((await randomSimulation.run())[0]);
            let neighborResults = meanKillTime((await neighborSimulation.run())[0]);

            let diff = Math.abs(neighborResults - randomResults) / 75;
            if (diff < 0.1) diff = Math.random() * 0.9 + 0.1;
            temperatureSamples.push(diff);
        }

        temperatureSamples.sort((a, b) => b - a);

        let temperatures = [];
        let numFillerPoints = maxIterations / numSamples;
        for (let i = 0; i < temperatureSamples.length; i++) {
            let high = temperatureSamples[i];
            let low = i + 1 === temperatureSamples.length ? 0.1 : temperatureSamples[i + 1];
            let diff = high - low;
            for (let j = 0; j < numFillerPoints; j++) {
                temperatures[i * numFillerPoints + j] = diff * (numFillerPoints - j) / numFillerPoints + low;
            }
        }
        return temperatures;*/

        /*let temperatureSettings = new SimulationSettings(1, 0, 1);
        let numSamples = 2;
        let temperatureSamples = [];

        /!*let unmoddedWeapon = new WeaponInstance(weapon, [], firingMode);
        let unmoddedSimulation = new Simulation(unmoddedWeapon, [enemyInstance], temperatureSettings);
        let randomResults = meanKillTime((await unmoddedSimulation.run())[0]);*!/

        temperatureSamples.push(100);
        temperatureSamples.push(0.001);

        temperatureSamples.sort((a, b) => b - a);

        let temperatures = [];
        let numFillerPoints = maxIterations / numSamples;
        for (let i = 0; i < temperatureSamples.length; i++) {
            let high = temperatureSamples[i];
            let low = i + 1 === temperatureSamples.length ? 0.1 : temperatureSamples[i + 1];
            let diff = high - low;
            for (let j = 0; j < numFillerPoints; j++) {
                temperatures[i * numFillerPoints + j] = diff * (numFillerPoints - j) / numFillerPoints + low;
            }
        }
        return temperatures;*/

        let initialTemp = 500;
        let finalTemp = 0.03; // roughly the margin of error

        // y = a * b^x
        let b = Math.exp(Math.log(finalTemp / initialTemp) / maxIterations);

        let temperatures = [];
        temperatures.push(initialTemp);
        for (let i = 1; i < maxIterations; i++) {
            temperatures.push(temperatures[i - 1] * b);
        }

        // console.log("Temperatures: ", temperatures.toString()) // hhh
        return temperatures;
    }

    /**
     *
     * @param newAvg
     * @param currentAvg
     * @param temperature
     * @returns {boolean}
     */
    static thresholdAcceptance(newAvg, currentAvg, temperature) {
        let quality = currentAvg - newAvg // the higher the better
        console.log('Quality:', quality, '-Temperature:', -temperature);
        return quality > (-temperature);
    }
}

/**
 *
 * @param {Weapon} weapon
 * @param additionalSettingsVariables
 * @param {number} firingMode
 * @returns {Promise<void>}
 */
//async function queueSimulationMaximizer(weapon, enemy, additionalSettingsVariables, firingMode) {
//    let enemyInstance = new EnemyInstance(enemy, enemyLevel);
//
//    let validModsList = await Mod.getValidModsFor(weapon, true);
//    let unwanted = ['primed-bane-of-infested',
//        'primed-bane-of-corpus',
//        'primed-bane-of-grineer',
//        'bane-of-infested',
//        'bane-of-corpus',
//        'bane-of-grineer',
//        'bane-of-corrupted',
//        'amalgam-serration'];
//
//    validModsList = validModsList.filter((mod) => !unwanted.includes(mod.id));
//
//    let weaponInstance = new WeaponInstance(weapon, [], firingMode);
//    let simulationSettings = new SimulationSettings(1, 0, numEnemies);
//
//    // test code
//    /*let builds = [['primed-bane-of-corrupted', 'split-chamber', 'vital-sense', 'serration', 'hunter-munitions', 'point-strike', 'primed-cryo-rounds', 'malignant-force']];
//    for (let build of builds) {
//        let weaponModded = $Classes.Weapon.FromObject(weapon.ToObject());
//        for (let i = 0; i < 8; i++) {
//            weaponModded.SetMod(i, $Classes.Mod.FromObject(modData[build[i]]), false);
//        }
//        let results = mean(await queueSimulation(weaponModded, enemies));
//        console.log(build, results);
//    }*/
//    let testMods = ['primed-bane-of-corrupted', 'split-chamber', 'vital-sense', 'serration', 'point-strike', 'hunter-munitions', 'primed-cryo-rounds', 'malignant-force']
//    let actualMods = [];
//    for (let modId of testMods) {
//        actualMods.push(await ModInstance.fromModID(modId));
//    }
//    weaponInstance.setMods(actualMods);
//
//    // Threshold Acceptance with Temperature Correlated with Quality
//    // Pick a random set of 8 mods
//    //let currentMods = getRandomMods(validModsList, weaponInstance, true);
//    let simulation = new Simulation(weaponInstance, [enemyInstance], simulationSettings);
//    weaponInstance.logMods();
//    let metrics = (await simulation.run())[0]; // returns Metrics[][], we seek Metrics[] which contains one Metrics for each iteration of the enemy type
//    let currentResults = Metrics.meanKillTime(metrics);
//
//    let killTimes = []
//    for (let metric of metrics) {
//        killTimes.push(metric.killTime);
//    }
//    console.log(killTimes.toString());
//    console.log(currentResults);
//
//    let totalProcs = new Map();
//    for (let metric of metrics) {
//        for (let proc of metric.procs) {
//            totalProcs.set(proc.getType(), totalProcs.get(proc.getType()) + 1 || 0)
//        }
//    }
//
//    console.log(totalProcs);
//    return;
//
//    let allTimeBestBuilds = new Map(); // build (Mod[]): kill-time (number)
//    let allTimeBestResults = currentResults;
//
//    allTimeBestBuilds.set(currentMods.sort(sortMods), currentResults);
//    if (enableLogging) console.log('Maximization for:', weapon.Name);
//    if (enableLogging) console.log('Initial state:', currentMods, currentResults);
//
//    let numSamples = 100;
//    let maxIterations = 7500;
//    let temperatureSample = await new Promise((resolve) => {
//        let temperatures = [];
//        for (let k = 0; k < numSamples; k++) {
//            (async () => {
//                let [randomMods, randomWeapon] = getRandomMods(validModsList, weapon);
//                let [neighborMods, neighborWeapon] = getRandomNeighbor(randomMods, validModsList, randomWeapon);
//                let randomResults = await dynamicPool.exec({
//                    task: runSimulation,
//                    param: {
//                        weapon: randomWeapon.ToObject(),
//                        enemy: enemy.ToObject(),
//                    }
//                })
//                let neighborResults = await dynamicPool.exec({
//                    task: runSimulation,
//                    param: {
//                        weapon: neighborWeapon.ToObject(),
//                        enemy: enemy.ToObject(),
//                    }
//                })
//                let diff = Math.abs(neighborResults - randomResults) / 75;
//                if (diff < 0.1) diff = Math.random() * 0.9 + 0.1;
//                temperatures.push(diff);
//                if (temperatures.length === numSamples) {
//                    temperatures.sort((a, b) => b - a);
//                    resolve(temperatures);
//                }
//            })();
//
//        }
//    })
//
//    let temperatures = [];
//    let numFillerPoints = maxIterations / numSamples;
//    for (let i = 0; i < temperatureSample.length; i++) {
//        let high = temperatureSample[i];
//        let low = i + 1 === temperatureSample.length ? 0.1 : temperatureSample[i + 1];
//        let diff = high - low;
//        for (let j = 0; j < numFillerPoints; j++) {
//            temperatures[i * numFillerPoints + j] = diff * (numFillerPoints - j) / numFillerPoints + low;
//        }
//    }
//
//    //let numIterationsNoImprovement = 0;
//    //let temperature = enemyLevel * 2;
//    let randomErrorThreshold = 0.2; // TODO run tests on all the builds at the end with 10k enemies or something
//    for (let k = 0; k < maxIterations; k++) {
//        /*if (numIterationsNoImprovement === 20) {
//            temperature *= 0.8;
//            numIterationsNoImprovement = 0;
//        }*/
//
//        let [newMods, newWeapon] = getRandomNeighbor(currentMods, validModsList, currentWeapon);
//        let newResults = mean(await queueSimulation(newWeapon, enemies));
//        if (newResults < allTimeBestResults - randomErrorThreshold) {
//            allTimeBestBuilds.clear();
//            allTimeBestBuilds.set(newMods.sort(), newResults);
//            allTimeBestResults = newResults;
//            //numIterationsNoImprovement = 0;
//        } else if (Math.abs(newResults - allTimeBestResults) < randomErrorThreshold && !containsUnordered(allTimeBestBuilds, newMods)) {
//            allTimeBestBuilds.set(newMods.sort(), newResults)
//            allTimeBestResults = Math.min(allTimeBestResults, newResults);
//        } else {
//            //numIterationsNoImprovement++;
//        }
//
//        if (thresholdAcceptance(newResults, currentResults, temperatures[k])) {
//            currentMods = newMods;
//            currentResults = newResults;
//            currentWeapon = newWeapon;
//        } else {
//            if (enableLogging) console.log('State ' + k + ': (rejected build)', newMods, newResults);
//        }
//        if (enableLogging) console.log('State ' + k + ': (current build)', currentMods, currentResults, '\n\n\n');
//        if (k > 0 && k % 250 === 0) {
//            if (enableLogging) console.log('Best builds so far:', allTimeBestBuilds, allTimeBestResults, '\n\n\n');
//        }
//    }
//    if (enableLogging) console.log('All-time best builds:', allTimeBestBuilds, allTimeBestResults);
//}



module.exports = {
    Maximizer
}