
/*expose(function runSimulationInstance(weapon, enemy, accuracy, headshot) {
    // Create a timer to reside over the simulation
    let timer = new $Classes.Timer();

    //Create objects to handle runtime instances of static weapon/enemies
    let runtimeWeapon = new $Classes.RuntimeWeapon(weapon, timer, this.Events, accuracy, headshot);
    let runtimeEnemy = new RuntimeEnemy(enemy, timer, this.Events);

    //Keep track of shots fired
    let shotCount = 0;

    // Enemy information
    let enemyCurrentHealth = enemy.Health;
    let enemyCurrentShield = enemy.Shield;
    let enemy

    // Weapon information


    //Loop while enemy is alive, or until 999ks passes in the simulation (a lot of time)
    while (runtimeEnemy.IsAlive && timer.ElapsedTime < maxSimulationDuration) {
        //Get the next notable events from each runtime object
        let timeStepWeapon = runtimeWeapon.NextEventTimeStep;
        let timeStepEnemy = runtimeEnemy.NextEventTimeStep;

        //Jump to the earliest notable event
        let timeStep = Math.min(timeStepWeapon, timeStepEnemy);
        timer.AddTime(timeStep);

        //Handle buffs
        runtimeWeapon.DoBuffs();

        //If the weapon can shoot
        if (runtimeWeapon.CanShoot) {
            //Shoot the enemy
            let [shotRng, identifier] = runtimeWeapon.Shoot(runtimeEnemy, this.RngHandler);
            shotCount++;

            //Keep track of metrics from the shot
            let hitCount = 0;
            let critCount = {};
            let headCount = 0;
            let headCritCount = 0;
            let procs = [];

            //Loop through each pellet
            for (let s = 0; s < shotRng.length; s++) {
                let shot = shotRng[s];
                if (shot.Hit) hitCount++;
                if (shot.Critical !== undefined) critCount[shot.Critical] = (critCount[shot.Critical] || 0) + 1;
                if (shot.Headshot) headCount++;
                if (shot.Critical && shot.Headshot) headCritCount++;
                if (shot.Procs !== undefined && shot.Procs.length > 0) {
                    procs = procs.concat(shot.Procs);
                }
                if (shot.Residuals !== undefined && shot.Residuals.length > 0) {
                    for (let r = 0; r < shot.Residuals.length; r++)
                    {
                        procs = procs.concat(shot.Residuals[r].Procs);
                    }
                }
            }

            //Pass along the 'shot' event
            this.Events['shot'](identifier, {
                Fired: shotRng.length,
                Hits: hitCount,
                Criticals: critCount,
                Headshots: headCount,
                HeadCrits: headCritCount,
                Procs: procs,
                Time: timer.ElapsedTime
            });

        } else {
            //It can't shoot, so do actions such as waiting between shots or reloading
            runtimeWeapon.PrepareForShot(timeStep);
        }

        //Handle residual effects, like explosions or gas clouds
        runtimeWeapon.DoResiduals(this.RngHandler, runtimeEnemy, this.Events['residual']);

        //Handle procs on the enemy
        runtimeEnemy.DoProcs(timeStep);

        // If the enemy is dead
        if (runtimeEnemy.CurrentHealth <= 0) {
            //Note progress and pass along the 'progress' event
            let progress = 1 - runtimeEnemy.CurrentHealth / enemy.Health;
            this.Events['progress'](progress);

            //Terminate the loop
            break;
        }
    }

    //Pass along the 'finish' event
    this.Events['finish'](timer.ElapsedTime, runtimeEnemy);

    //Return various information about the simulation
    return { KillTime: timer.ElapsedTime, ShotCount: shotCount };
})
*/

/**
 * Run one iteration of a simulation over one enemy.
 * TODO: do we want to split a full simulation into a set of iterations, each of which goes over each enemy?
 *  how we split the simulation will determine how we handle frontend information
 *  i definitely dont think we should just run a simulation a bunch to get the number of iterations,
 *  that seems like unnecessary post processing after getting all the data from each iteration
 *  it would be better to contain it all in one function
 *  delegate each iteration to a thread i think because each full simulation is awaited on, no point having it all on 1 thread then only 1 thread gets utilised
 * @param param
 * @returns {number} killTime
 */
function runSimulation(param) {
    let weapon = param.weapon;
    let enemy = param.enemy;
    const $Classes = require('../../public/class-definitions/classes');
    const $ClassesPriv = require('../class-definitions/classes');
    const maxSimulationDuration = 999999;

    let rngHandler = new $ClassesPriv.RngHandler(false);

    // Create a timer to reside over this enemy interaction
    let timer = new $Classes.Timer();

    //Create objects to handle runtime instances of static weapon/enemies
    let runtimeWeapon = new $Classes.RuntimeWeapon($Classes.Weapon.FromObject(weapon), timer, this.Events, 1, 0);
    let runtimeEnemy = new $Classes.RuntimeEnemy($Classes.Enemy.FromObject(enemy), timer, this.Events);

    //Keep track of shots fired
    let shotCount = 0;

    //Loop while enemy is alive, or until 999ks passes in the simulation (a lot of time)
    while (runtimeEnemy.IsAlive && timer.ElapsedTime < maxSimulationDuration) {
        //Get the next notable events from each runtime object
        let timeStepWeapon = runtimeWeapon.NextEventTimeStep;
        let timeStepEnemy = runtimeEnemy.NextEventTimeStep;

        // Jump to the earliest notable event
        let timeStep = Math.min(timeStepWeapon, timeStepEnemy);
        timer.AddTime(timeStep);

        // Handle buffs
        runtimeWeapon.DoBuffs();

        // If the weapon can shoot
        if (runtimeWeapon.CanShoot) {
            //Shoot the enemy
            let [shotRng, identifier] = runtimeWeapon.Shoot(runtimeEnemy, rngHandler);
            shotCount++;

            // Keep track of metrics from the shot
            let hitCount = 0;
            let critCount = {};
            let headCount = 0;
            let headCritCount = 0;
            let procs = [];

            // Loop through each pellet
            for (let s = 0; s < shotRng.length; s++) {
                let shot = shotRng[s];
                if (shot.Hit) hitCount++;
                if (shot.Critical !== undefined) critCount[shot.Critical] = (critCount[shot.Critical] || 0) + 1;
                if (shot.Headshot) headCount++;
                if (shot.Critical && shot.Headshot) headCritCount++;
                if (shot.Procs !== undefined && shot.Procs.length > 0) {
                    procs = procs.concat(shot.Procs);
                }
                if (shot.Residuals !== undefined && shot.Residuals.length > 0) {
                    for (let r = 0; r < shot.Residuals.length; r++) {
                        procs = procs.concat(shot.Residuals[r].Procs);
                    }
                }
            }

        } else {
            //It can't shoot, so do actions such as waiting between shots or reloading
            runtimeWeapon.PrepareForShot(timeStep);
        }

        //Handle residual effects, like explosions or gas clouds
        runtimeWeapon.DoResiduals(rngHandler, runtimeEnemy);

        //Handle procs on the enemy
        runtimeEnemy.DoProcs(timeStep);

        //If the enemy is dead
        if (runtimeEnemy.CurrentHealth <= 0) {
            break;
        }
    }
    return timer.ElapsedTime;
}

module.exports = {
    runSimulation
};