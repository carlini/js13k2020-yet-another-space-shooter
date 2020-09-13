// main.js -- the main init and game loop

// Copyright (C) 2020, Nicholas Carlini <nicholas@carlini.com>.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.


var gl;

var objects;
var particles;
var camera;
var camera_position;
var camera_rotation;
var proj_mat;
var star;
var dome;
var energy;
var look_goal;

var program;
var locations;
var has_left = false;

var keys = {};
//var keyhist = 0;
var sensitivity = 3;


/* Main game setup.
 * When the game loads, hook the keybindings and start the game loop.
 */
function main_run() {
    setup_utils()
    setup_graphics()
    setup_game()
    setup_ships();
    main_go()
}

var mouse_x;
var mouse_y;
var screen_x;
var screen_y;
var initial_time;


function main_go() {

    initial_time = +new Date();
    window.onkeydown = e => keys[e.key] = true;
    //window.onkeydown = e => {
    //    keys[e.key] = true;
    //    keyhist = (keyhist<<7) ^ e.keyCode
    //}
    window.onkeyup = e => delete keys[e.key];

    window.onmousedown = _ => document.pointerLockElement == cQ || cQ.requestPointerLock();
    
    screen_x = document.body.offsetWidth;
    screen_y = document.body.offsetHeight;
    
    document.onpointerlockchange = _ => {

        mouse_x = screen_x/2;
        mouse_y = screen_y*.4 || 200;

        cQ.onmousemove = (document.pointerLockElement == cQ) && (e => {
            mouse_y = clamp(mouse_y+e.movementY/sensitivity,0,screen_y);
            mouse_x = clamp(mouse_x+e.movementX/sensitivity,0,screen_x);
        });
        cQ.onmousedown = k => keys[0] = true; 
        cQ.onmouseup = k => delete keys[0];
    }

    reset();
    game_step(1);
    
}

var wave_counter = 0;
var quantity = [
    [1, 0, 0],
    [2, 0, 0],
    [0, 1, 0],
    [2, 3, 0],
    [0, 0, 1],
    [2, 2, 1],
];
var stats = [[4, 10, .1, 1],
             [3, 15, .02, 3],
             [5, 32, .02, 3]];

function wave() {
    waiting_for_wave = false;
    var amt = quantity.shift();
    stats.map((x,i) => {
        range(amt[i]).map(y=> {
            objects.push(new Enemy(...x, urandom_vector(1000).add(dome.position)));
        });
    })
    amt[0] += 1
    amt[1] += 1
    amt[2] += 1
    quantity.push(amt)
}

/* Reset the level and start up a new camera.
 */
function reset() {
    camera = Camera();
    camera_position = ZERO;
    camera_rotation = IDENTITY;
    objects = [];
    particles = [];
    timeout_queue = [];
    DT_MUL = .8;

    add_energy(energy=1);
    particles.push(tractor = new Tractor());

    objects.push(starfield);

    //dome = sphere();
    dome = new Ship(all_ships[6], NewVector(0,-500,-50), IDENTITY);
    //dome.sprites.map(x=>x.health = 3);

    dome.update = dt => {
        if (dome.sprites.length < 80) {
            // alternate game lose reason
            console.log("DESTROY");
            screen = 3;
            cW.style.display = "none"
            shoot_lr = last_now; // this now holds time since death
            destroy(dome, range(dome.sprites.length))

            var op = 5;
            var ii = setInterval(_ => {
                if (op < 0) {
                    timeout_queue = []
                    document.exitPointerLock();
                    qQ.style.display = "block"
                    qQ.innerHTML = `Game Over.<br><br>You survived for ${0|(new Date()-initial_time)/1000}^seconds<br><a href="#" onclick="location.reload()">Play Again?</a>`;
                    clearInterval(ii);
                } else {
                    cQ.style.opacity = op-=.005
                }
            }, 10)
        }
        dome.rotation = multiply(matrix_rotate_xy(.0001*dt),dome.rotation);
        if (screen != 4 && screen != 1)
            dome.position = mat_vector_product(matrix_rotate_xy(.00001*dt),dome.position.subtract(star.position)).add(star.position)
    }
    objects.push(dome);

    hud = []
    hud.push(new Sprite([[100,0,0], [0,0,0]], ZERO, 0, 0, 5));
    hud[0].type = gl.POINTS;

    // Create the glitter, make it feel like I'm really moving
    var points = range(10).map(_=> urandom_vector(32)._xyz()).flat();
    glitter = new Sprite([points, Array(10).fill([.3, .4, .9]).flat()], ZERO, IDENTITY, [.4,.05,.5], 2);
    glitter.type = gl.POINTS;
    range(10).map(x=>glitter.a_settings[x*3+1] = 1e6);
    glitter.rebuffer()

    star = new ParticleSystem(1400 - GRAPHICS*200, 5, [1, 5, 0], [1, .8, .3], true);
    star.position = NewVector(0,0,100);
    // Push the sun
    particles.unshift(star);

    range(30).map(_=> {
        objects.push(new Sprite(load2(nicecube, 0, 6.5), NewVector(0,0,100), look_at(urandom_vector(), urandom_vector()), [10,10,10]));
    })
    
    objects.push(...ships)
    
    ships = [0,0,0,0];
    wireframes = [];
    load_screen(1);
}

function scroll(obj, fn) {
    range(30).map(i=> setTimeout(_ => obj.style.right=fn(i)+"vw", 16*i))
}


var wireframes;
function load_ships(wire) {
    var sprites = [all_ships[2],
                   all_ships[3],
                   all_ships[1],
                   all_ships[0],
                  ];
    ships = ships.map((x,i) => {
        if (x && x.sprites.length) {
            x.rotation = IDENTITY;
            x.dead = 0;
            x.sprites.map(x=>x._maketrace());
            return x;
        } else {
            var ship = new Ship(sprites[i], ZERO,
                                matrix_rotate_xz(Math.PI/2))
            glob_ship = ship;
            if (wireframes[i]) {
                wireframes[i].update = make_builder(ship, wireframes[i]);
            }
            ship.ready = 0;
            do_transfer(0, 1);
            ship.sprites.map(x=>x._maketrace());
            return ship;
        }
    })
    if (!wireframes[0]) {
        wireframes = ships.map(wireframe)
    }
    wireframes.map(x=>x.dead = false);
}

function load_screen(first) {
    if (!first) cW.style.display = "block"
    timeout_queue = [];
    load_ships(first);
    
    ships.prev_which = ships.which =ships.spin = ships.spinGoal = ships.spinTime = 0;
    if (first)
        ships[0].ready = 100;
    me = ships[0]
    particles = particles.filter(x=>!(x instanceof Hit));

    objects.push(...wireframes)
    objects.push(...ships);
    screen = 1;
    velocity=me.velocity=ZERO;
    me.rotation = IDENTITY;
}

function start(which) {
    screen = 0;
    me = ships[which]
    scroll(cZ, i=>-i)
    //range(30).map(i=> setTimeout(_ => cZ.style.right=-i+"vw", 16*i))

    ships.map(x=>x.dead = true)
    wireframes.map(x=>x.dead = true)
    me.dead = false;
    
    objects.map(x=> x.tracked = false)

    // Smoke comes from my ship
    particles.push(new Tracer(me, .5, 10, NewVector( 3.7/(1+(which>1)), -.4,-.4), [.1,.1,.1], .2, 0, 2, .6));
    particles.push(new Tracer(me, .5, 10, NewVector(-3.7/(1+(which>1)),-.4,-.4), [.1,.1,.1], .2, 0, 2, .6));
    
    hud = [hud[0]]
    // Track up to 20 enemies at a time
    range(20).map(_=>
                 hud.push(new HUDTracker(!_)));

    // Go red when I get hit
    hud.push(new DamageEffect());
}

var damage = 0;
var damage2 = 0;
var GRAPHICS = 0;

class RunningAverage { // DEBUGONLY
    constructor(n) { // DEBUGONLY
        this.count = 0; // DEBUGONLY
        this.n = n; // DEBUGONLY
    } // DEBUGONLY
    update(val) { // DEBUGONLY
        this.count = this.count * (1 - 1./this.n) + val; // DEBUGONLY
        return Math.round(this.count/this.n*100)/100; // DEBUGONLY
    } // DEBUGONLY
} // DEBUGONLY

var fps = new RunningAverage(10); // DEBUGONLY
var actual_fps = new RunningAverage(10); // DEBUGONLY
var running_sprites = new RunningAverage(10); // DEBUGONLY
var running_verts = new RunningAverage(10); // DEBUGONLY
var last_now = 0;
var last_gunshot = 0;
var speed = 0;
var global_screen_color;
var me;

var minor_badness = 0; //DEBUGONLY
var total_badness = 0; //DEBUGONLY

var shoot_lr = 0;

var frame;

var velocity = ZERO;

var hud;
var glitter;
var ships = [];
var tractor;

var screen = 1;

var settings = {}

var all_settings = {_turnrate: [5, 10, 5, 5,],
                    _momentum: [.1, .01, .15, .1,],
                    _speed:    [2.5, 1, 3, 4,],
                    _health:   [1.5, 6, .25, 1,],
                    _damage:   [.8, 2, 5, 1.1,],
                    _firerate: [150, 600, 2000, 150,],
                    _energy:   [10, 10, 10, 10,],
                    _camera:   [1, 1.5, 1, 1,],}

var DT_MUL;
var waiting_for_wave;
var ship_to_distant_position;

var local_time = 0;

/* Main game loop.
 * This is quite ugly in order to be nicely compressable, 
 * as we do all of the work right in this loop top-to-bottom.
 * (Insetad of just a simple update-render loop.)
 */
function game_step(now) {
    if (now < 1000) {
        cQ.style.animation = "z 3s";
    }
    if (now > 1000 && !sounds) {
        setup_audio();
        scroll(cZ, i=>-(30-i))
        cW.style.display = "block"
    }
    frame = requestAnimationFrame(game_step);

    if (objects.filter(x=>x instanceof Enemy).length == 0 && !waiting_for_wave && screen == 0) {
        waiting_for_wave = true;
        setTimeout(wave, 5000)
    }

    
    var dt = Math.min(now-last_now,50);
    if (screen > 1) dt *= (DT_MUL*=.99)+.05;


    check_timers(dt);

    var mouse_dx = (mouse_x/screen_x-.5);
    var mouse_dy = (.5-mouse_y/screen_y);
    
    
    var mouse_position_3d = hud[0].position = mat_vector_product(proj_mat||IDENTITY, NewVector(mouse_dx*2e5, mouse_dy*2e5, 1e5, 1e5)).add(camera_position);

    var godirs = [];
    for (var key in keys) {
        var godir = Math.max("wdsa".indexOf(key),
                             "URDL".indexOf(key[5]||key[0]))
        if (godir >=0 ) {
            godirs.push(godir);
        }
        
        var del = 0;
        if (key == "=" || key == "+") {
            del = 1;
            sensitivity /= 1.2;
        }
        if (key == "-") {
            del = 1
            sensitivity *= 1.2;
        }
        if (screen == 1 && key != 0 || del) delete keys[key];
    }

    local_time += dt;


    //if (keys['q']) damage2 = 3; // DEBUGONLY
    
    if (screen == 0) {
        // Normal gameplay screen
        var f = x=>Math.abs(x)**1.4 * Math.sign(x)/settings._turnrate;
        me.rotation = [me.rotation,
                       matrix_rotate_xy(f(mouse_x/screen_x-.5)),
                       matrix_rotate_yz(-f(mouse_y/screen_y-.4))].reduce(multiply);

        // Figure out how the player wants to move.
        var move_dir = godirs.map(godir => 
                                  mat_vector_product(multiply(me.rotation,
                                                              matrix_rotate_xy(Math.PI/2*godir)),
                                                     Y_DIR.scalar_multiply((godir!=2)+.1),
                                                     // this isn't an argument, but let's save space by passing it anyway
                                                     speed += (speed < settings._momentum)*(settings._momentum/100))
                                 )
        if (move_dir.length) {
            velocity = velocity.add(reduce_mean(move_dir).scalar_multiply((speed*settings._speed)/16));
        } else {
            speed = 0;
        }
        me.velocity = (velocity = velocity.scalar_multiply(1-settings._momentum)).copy();


        var is_hit = find_first_hit(me.position, velocity._normalize(), x=>x instanceof Enemy);
        if (is_hit[3] < 3) {
            damage2 = 1+settings._health/4;
            destroy(is_hit[0], range(is_hit[0].sprites.length))
        }

        me.position = me.position.add(velocity.scalar_multiply(16.7));


        var me_proj_forward = me.velocity.scalar_multiply(40)
            .project_onto(mat_vector_product(camera_rotation, Y_DIR))
            .add(me.velocity.scalar_multiply(20));
        camera_position = camera_position.lerp(me.position.add(me_proj_forward).add(mat_vector_product(me.rotation, NewVector(0,-2*2.3*settings._camera,1.5*3*settings._camera**.5))), .2/settings._camera)
        
        camera_rotation = look_at((look_goal=me.position.add(mat_vector_product(me.rotation, Y_DIR.scalar_multiply(10)))).subtract(camera_position),
                                  mat_vector_product(me.rotation, Z_DIR));

        if (damage2 > .75+settings._health/5) {
            destroy(me, range(me.sprites.length), 1);
        }

        
        ship_to_distant_position = mouse_position_3d.subtract(me.position);
        
        if (keys[0]) {
            if (now-last_gunshot > settings._firerate) {
                var doit = _=> {
                    var offset = mat_vector_product(me.rotation, X_DIR).scalar_multiply((settings._damage == 5 ? 0 : 4.5)*(settings._damage == .8 ? [-1,0,1,0][shoot_lr%4] : (shoot_lr%2)-.5));
                    ship_to_distant_position = ship_to_distant_position.subtract(offset)
                    var towards = mouse_position_3d.subtract(me.position.add(offset))._normalize();
                    if (settings._damage == 5) {
                        var others = objects.filter(x => x instanceof Enemy && x.is_small).map(x=> [x.position.subtract(camera_position)._normalize().dot(mouse_position_3d.subtract(camera_position)._normalize()), x]).filter(x=>x[0]>.993);
                        console.log(JSON.stringify(others.map(x=>x[0])));
                        if (others[0]) towards = others[0][1].position.subtract(me.position.add(offset));
                        ship_to_distant_position = towards;
                    }
                    var rot = look_at(towards, Z_DIR);
                    
                    particles.push(new Lazer(me.position.add(offset),
                                             ship_to_distant_position._normalize(),
                                             rot,
                                             true,
                                             settings._damage));
                }

                if (settings._firerate > 1000) {
                    play(sounds.warmup);
                    setTimeout(_=>{play(sounds.lazer2);play(sounds.hit); doit()}, 300);
                } else {
                    play(settings._firerate > 200 ? sounds.lazer2 : sounds.lazer)
                    doit();
                }
                last_gunshot = now;
                shoot_lr++;

                objects.map(x => {
                    if (x.position.subtract(me.position)._normalize().dot(ship_to_distant_position._normalize()) > .95) {
                        x.annoyed = now;
                    }
                })
                
            }
        }

        if (me.position.distance_to(dome.position) < 120 && has_left) {
            setTimeout(_=>scroll(cZ, i=>-(30-i)), 2000)
            screen = 4
        } if (me.position.distance_to(dome.position) > 140) {
            has_left = true;
        }

        
    } else if (screen == 1) {
        //if (keyhist == -1735204031) { // RIP IDKFA.
        //    ships.map(x=>x.ready = 100);
        //}
        
        // Ship selection screen
        objects.map(x=> x instanceof Enemy && (x.annoyed = 0));
        global_screen_color=[0,0,0]
        camera_position = dome.position.add(NewVector(0, -30, 5))
        camera_rotation = look_at(look_goal = dome.position.add(NewVector(-8,0,0)).subtract(camera_position), Z_DIR);
        has_left = false;



        [settings._speed/2, 10/settings._turnrate*(1-settings._momentum), ((settings._damage**2)/settings._firerate*200), settings._health**.5].map((x,i) => {
            document.body.getElementsByClassName("a")[i].style.width=(x*4)+"vw";
        });
        
        var is_ready = false;
        if (ships[ships.which].ready > 99.9) {
            ships[ships.which].ready = 100
            cU.innerHTML = "Launch";
            is_ready = true;
        } else {
            cU.innerHTML = energy > 0 ? "Construct" : "Insufficient Scraps";
        }
        cY.innerHTML= "("+ships[ships.which].ready.toFixed(1)+"% Complete)"
        
        ships.spinTime = clamp(ships.spinTime+dt/1000, 0, 1);
        
        var spin_time = (1-Math.cos(ships.spinTime*Math.PI))/2
        var cur_spin = (1-spin_time)*ships.spin + spin_time*ships.spinGoal;
        ships.map((x, i)=> {
            x.position = dome.position.add(mat_vector_product(matrix_rotate_xy(i*Math.PI/2 + cur_spin),NewVector(0,-10,0)))
        });
        

        godirs.map(godir => {
            if (godir == 3 || godir == 1) {
                ships.prev_which = ships.which;
                ships.spin = cur_spin;
                ships.spinGoal = (ships.spinGoal-Math.PI/2*(godir-2));
                ships.spinTime = .05;
                ships.which = (ships.which+godir+2)%4;
            }
        });

        var pos = cU.getBoundingClientRect();
        var over = false;
        if (pos.x < mouse_x && mouse_x < pos.right &&
            pos.y < mouse_y && mouse_y < pos.bottom) {
            over = true;
            cU.style.background = is_ready ? "#44f" : (energy > 0 ? "#4f4" : "#777");
        } else {
            cU.style.background = is_ready ? "#228" : (energy > 0 ? "#282" : "#444");
        }

        if (keys[' ']) start(ships.which);
        if (keys[0]) {

            if (over) {
                if (is_ready) {
                    start(ships.which);
                    play(sounds.hit);
                } else {
                    if (energy > 0)
                        do_transfer(ships.which);
                    else {
                        play(sounds._nope);
                        setTimeout(_=>play(sounds._nope), 160)
                    }
                }
                cU.style.background = "#fff";
            }
            
            var dists = ships.map(ship => mouse_position_3d.subtract(camera_position)._normalize().cross(ship.position.subtract(camera_position)._normalize()).vector_length()); // can't use normal_to_plane because of normalize()
            if (Math.min(...dists) < .1) {
                ships.prev_which = ships.which;
                dists.map((x, i)=> (x==Math.min(...dists)) && (ships.spinGoal = 2*Math.PI-(ships.which=i)*Math.PI/2));
                delete keys[0];
                ships.spin = (cur_spin+Math.PI*2)%(Math.PI*2);

                ships.spinGoal -= Math.PI*2*((ships.spinGoal-ships.spin)>Math.PI);

                ships.spinTime = 0;

                if ((ships.spinGoal - ships.spin)**2 < .01) {
                    if (ships[ships.which].ready > 99) {
                        start(ships.which)
                        play(sounds.hit);
                    } else {
                        play(sounds._nope);
                        setTimeout(_=>play(sounds._nope), 160)
                    }
                }

            }
        }
        Object.keys(all_settings).map(k=> settings[k] = all_settings[k][ships.prev_which]*(1-ships.spinTime) + all_settings[k][ships.which]*ships.spinTime)

        
        ships.map(x=> x.rotation = multiply(matrix_rotate_xy(.2/dt), x.rotation))
    } else if (screen == 2) {
        // player dead screen;
        camera_position = camera_position.add(mat_vector_product(camera_rotation, NewVector(-.05,-.05,0).scalar_multiply(9**(DT_MUL-1)*(1-DT_MUL)*10)));
        var next_forward = me.position.add(mat_vector_product(me.rotation, Y_DIR.scalar_multiply(10))).lerp(me.position, 1-DT_MUL).subtract(camera_position);
        camera_rotation = look_at(next_forward,
                                  mat_vector_product(me.rotation, Z_DIR));
        me.ready = 0
        damage *= .9;
    } else if (screen == 3) {
        // base dead screen
        cZ.style.display="none"
        var time_since_death = (now-shoot_lr)/1000;
        var ss = x => x < 1 ? (x>0) * (6*(x**5) -15*(x**4)+10*(x**3)) : 1;
        var dist_to = ss(dome.position.distance_to(camera_position)/500-.1)*80;
        camera_position = dome.position.subtract(camera_position) // camera -> dome vector
            ._normalize().scalar_multiply(dist_to*ss(time_since_death/5)) // move closer
            .add(mat_vector_product(camera_rotation,
                                    NewVector(ss(time_since_death/5)*10,
                                              -3*ss(time_since_death/10),
                                              0)))
            .scalar_multiply(DT_MUL+.02) // slow down over time
            .add(camera_position);
        camera_rotation = look_at(look_goal.lerp(dome.position, ss(time_since_death/2)).subtract(camera_position),
                                  mat_vector_product(camera_rotation, Z_DIR));
    } else if (screen == 4) {
        me.position = me.position.moveto(dome.position.subtract(Y_DIR.scalar_multiply(10)), 1)

        var target = dome.position.add(NewVector(0, -30, 5));
        camera_position = camera_position.moveto(target, 1);
        if (camera_position.distance_to(target) < .01) {
            load_screen()
        }
        
        var goal_look = dome.position.add(NewVector(-8,0,0));
        camera_rotation = look_at(mat_vector_product(camera_rotation, Y_DIR.scalar_multiply(10)).add(camera_position).lerp(goal_look, .1).subtract(camera_position), mat_vector_product(camera_rotation, Z_DIR).lerp(Z_DIR, .1))
        
    }

    damage = clamp(damage-dt/1000, 0, 8);
    damage2 *= .99-settings._health/200;
    if (DT_MUL > .2 && screen != 1 && screen != 4) {
        global_screen_color = [1, 0, (damage+damage2)/5];
    }
    
    // save camera
    var me_rot = me.rotation;

    starfield.position = camera_position;


    var shake = clamp(damage2*damage2/20/settings._health,0,.1)
    camera_rotation = [camera_rotation,
                       matrix_rotate_xy(urandom()*shake),
                       matrix_rotate_yz(urandom()*shake),
                       matrix_rotate_xz(urandom()*shake)].reduce(multiply)

    if (screen == 0) {
        me.rotation = multiply(me.rotation, matrix_rotate_xz((mouse_x/screen_x-.5)/settings._turnrate*10));
    }

    objects.map(x=> x.sprites && x.position.distance_to(star.position) < 100 && destroy(x, range(x.sprites.length), x == me))

    // todo space can cut the x.update && if all classes have an update method
    objects.map(x=>x.update && x.update(dt));
    particles.map(x=>x.update(dt));
    hud.map(x=>x.update && x.update(dt));
    objects.map(x=> (x instanceof ParticleSystem) && raise)// DEBUGONLY
    particles.map(x=> (x instanceof ParticleSystem) || raise)// DEBUGONLY
    
    // And finally render the scene 
    camera();
    
    // restore camera
    me.rotation = me_rot;

    objects = objects.filter(x=>!x.dead);
    particles = particles.filter(x=>!x.dead);

    minor_badness = .99*minor_badness + .01*((now-last_now) > 17)
    total_badness = .999 * total_badness + .001*(((now-last_now) > 17) + minor_badness);

    if (total_badness > .15 || minor_badness > .6) {
        total_badness = minor_badness = 0;
        set_resolution(GRAPHICS+1)
        setup_graphics();
        camera = Camera();
    }
    

    document.getElementById("fps").innerText = "ms/frame: " + fps.update(performance.now()-now) + "\nFPS: " + actual_fps.update(1000./(now-last_now)) + "\nparticles: " + PARTS + "\nminor badness: " + Math.round(minor_badness*100)/100 + "\ntotal badness: "+(Math.round(total_badness*100)/100 + "\ndamage: " + Math.round(damage*100)/100 + "\ndamage2: " + Math.round(damage2*100)/100); // DEBUGONLY
    PARTS = 0; // DEBUGONLY

    last_now = now;
}

function set_resolution(j) {
    cQ.height = (cQ.width = 3200>>(0|(GRAPHICS=clamp(j,0,6))/2))/window.innerWidth*window.innerHeight;
}

function setup() {
    gl = cQ.getContext("webgl2"); // QQ
    set_resolution(2);
    main_run();
}

window.onload = _=>setTimeout(setup, 1)
