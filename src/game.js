// game.js -- the logic for the game objects

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


function can_hit(is_mine) {
    return x => ((x == dome) || (screen == 0 && (is_mine ? x instanceof Enemy : !(x instanceof Enemy))));
}

function lazerspeed(damage) {
    return damage == 5 ? 10 : 2/(damage**2);
}

class Lazer extends ParticleSystem {
    constructor(position, direction, rot, is_mine, damage) {
        var num_particles = clamp(0|(100 - 30*damage + 200*(damage==5))*(1-GRAPHICS/9),1,1e9);
        super(40*num_particles, .5, [1, damage/10+.1, 1], is_mine ? [.3, 1, .5] : [1, .2, .1]);
        this.damage = damage;
        this.pos = this.tpos = position;

        set_timeout(_=>this.dead = true, 1500*damage);

        this.is_mine = is_mine;
        this.rotation = IDENTITY;
        this.max_spawn = num_particles;
        this.use_random = 1;
        play(sounds.lazer, .2)

        // TODO duplicated here and in the lazer creation
        this.velocity = direction._normalize().scalar_multiply(lazerspeed(this.damage));
        //console.log(this.velocity.vector_length());
    }

    particle_start(dt) {
        this.tpos = this.tpos.add(this.velocity.scalar_multiply(dt/this.max_spawn));
        return [this.tpos, ZERO];
    }

    update(dt) {
        this.tpos = this.pos

        if (this.fakedead) return;
        var [bestObject, bestSid, bestIdx, best] = find_first_hit(this.pos,
                                                                  this.velocity.scalar_multiply(dt),
                                                                  can_hit(this.is_mine))

        super.update(dt, best*this.max_spawn);
        if (!bestObject || best > 1) {
            this.pos = this.pos.add(this.velocity.scalar_multiply(dt));
            return;
        }
        
        var where = this.pos.add(this.velocity.scalar_multiply(dt*best));
        var the_sprite = bestObject.sprites[bestSid];
        var normal_dir = mat_vector_product(the_sprite.rotation,
                                            NewVectorFromList(the_sprite.a_normals.slice(bestIdx*9, bestIdx*9+3)))
        
        
        if (this.is_mine) play(sounds.hit)
        if (bestObject != me) {

            //bestObject.annoyed = last_now;
            // TODO SPACE this is duplicated twice
            var hit_tri = the_sprite.b_positions[bestIdx];
            var [h1, h2, h3] = hit_tri.map(x=> mat_vector_product(the_sprite.rotation,
                                                                  x).add(the_sprite.position))

            // TODO space this can all go away
            // Gram-Schmidt orthoganlize
            var edge1 = h2.subtract(h1)._normalize();
            var edge2 = h3.subtract(h1)._normalize();
            edge2 = edge2.subtract(edge2.project_onto(edge1));

            // Compute hit coordinates in this space
            var alpha = where.subtract(h1).project_onto(edge1).vector_length();
            var beta =  where.subtract(h1).project_onto(edge2).vector_length();

            var get_new_pos = () => {
                var [h1, h2, h3] = hit_tri.map(x=> mat_vector_product(the_sprite.rotation,
                                                                      x).add(the_sprite.position))
                
                // Gram-Schmidt orthoganlize
                var edge1 = h2.subtract(h1)._normalize();
                var edge2 = h3.subtract(h1)._normalize();
                edge2 = edge2.subtract(edge2.project_onto(edge1));
                return edge1.scalar_multiply(alpha).add(edge2.scalar_multiply(beta)).add(h1);
            }
            
            
            this.fakedead = true;
            particles.push(new Hit(ZERO, 10*this.damage*(this.is_mine ? this.damage : 1), 1.5 + this.damage/2, .5 + (bestObject == dome),
                                   normal_dir.scalar_multiply(this.damage/3+1), 1, get_new_pos));
            if (the_sprite._kind == 1) {
                // if you hit the main body, it takes health from the root
                the_sprite = bestObject.sprites[bestSid = 0];
            }
            if ((the_sprite.health -= this.damage**2/10) < 0) {
                if (bestSid == 0 && bestObject != dome) {
                    bestSid = range(bestObject.sprites.length);
                    bestObject.dead = true;
                } else {
                    bestSid = [bestSid]
                }
                destroy(bestObject, bestSid)
            }
        } else {
            particles.push(new Hit(where, 20*this.damage/3, 1, .5, normal_dir));
            if (bestObject == me) {
                play(sounds.boom2)
                damage2 += this.damage**.5/3 * (1+clamp(local_time/600000,0,.5));
                settings._health *= .99;
            }
            this.fakedead = true;
        }
        this.pos = this.pos.add(this.velocity.scalar_multiply(dt));
    }
}


class Spinner {
    constructor(sprite, velocity, gspeed) {
        this.sprite = sprite;
        this.gspeed = gspeed
        this.velocity = velocity;
        this.spins = urandom_vector(1);
        this.position = ZERO;
    }
    update(dt) {
        var speed = this.gspeed * (1+this.velocity.vector_length()) * .002  * dt;
        this.position = this.sprite.position = this.sprite.position.add(this.velocity.scalar_multiply(dt));
        this.sprite.rotation = multiply(this.sprite.rotation,
                                   [matrix_rotate_xy(this.spins.x*speed),
                                    matrix_rotate_yz(this.spins.y*speed),
                                    matrix_rotate_xz(this.spins.z*speed)].reduce(multiply));
    }
    render() {
        this.sprite.render();
    }
}

function fade_black(off,delay) {
    range(30).map(i=>
                  setTimeout(_=> global_screen_color = [0, 0, i/10], off+i*delay)
                 )
}

function destroy(bestObject, bestSid, is_me) {
    if (is_me) {
        screen = 2;
        cW.style.display = "none"
        fade_black(6000, 30)
        setTimeout(load_screen, 7000)
        range(30).map(i=> setTimeout(_ => cZ.style.right=-(30-i)+"vw", 16*i+7000))
        add_energy(energy = 0)
        damage2 = 2
    }

    bestSid.reverse().map(sid => {
        var sprite = bestObject.sprites.splice(sid, 1)[0];

        if (bestObject != me && bestObject != dome && sprite.size*urandom() > 1 || sid == 0) {
            setTimeout(_=>objects.push(new EnergyObj(sprite.position.add(urandom_vector(20)))),2000*urandom())
        }

        var velocity = urandom_vector(.01).add(bestObject.velocity.scalar_multiply(!is_me));
        var spinner = new Spinner(sprite, velocity, 4/sprite.size);
        //sprite.update = do_spin(sprite, velocity, 4/sprite.size)
        //console/**/.log("Killing", sprite, sprite.update)
        setTimeout(x=> spinner.dead = true, 60000);
        objects.push(spinner);

        sprite.b_positions.map((tri,I)=> {
            var t;
            set_timeout(_=>{
                // todo make the base dying a bigger boom
                var r = urandom_vector();
                r=r.vector_multiply(r)._xyz()
                tri = tri.map((x,i)=>mat_vector_product(sprite.rotation, x).scalar_multiply(r[i]/sum(r)));
                var mid = reduce_add(tri).add(sprite.position)
                if (urandom() < -.95) {play(sounds.rumble, is_me ? 1 : .3);}
                if (!is_me || urandom() < -.8) {
                    if (bestObject == dome && urandom() < 0) return;
                    if (is_me || urandom() < -.95) {play(sounds.boom2, is_me ? 1 : .3);}
                    particles.push(new Hit(mid, 3, 3+urandom(), 1,
                                           NewVectorFromList(sprite.a_normals.slice(I*3,I*3+3)),
                                           1, undefined, urandom()<0 ? [1, .4, 0] : [.2, .2, .2]));
                }
            }, Math.random()*2000)
        })
    })
    bestObject.dead = bestObject.sprites.length == 0;

}

function DamageEffect() {
    var sprite = new Sprite(load2(cube, 0, 10), ZERO, 0, [.1, 0, 0], 7)
    sprite.update = _ => {
        sprite.position = camera_position;
        sprite.a_colors = new Float32Array(Array(48*3).fill(global_screen_color).flat());
        sprite.rebuffer();
    }
    return sprite;
}

const State = { // DEBUGONLY
    RUN: 1, // DEBUGONLY
    CHARGE: 2, // DEBUGONLY
    CIRCLE: 3, // DEBUGONLY
    SIEGE: 4, // DEBUGONLY
}; // DEBUGONLY

class Ship {
    constructor(spriteid, position, rotation, colors) {
        this.position = position;
        this.rotation = IDENTITY;
        this._parent = this;
        this.sprites = spriteid.map(x=>{
            var sprite = new Sprite(x,
                                    x[3]||ZERO,
                                    multiply(x[4]||IDENTITY, rotation), colors)
            sprite._maketrace = _=> {
            if (x[5] == 2) {
                particles.push(new Tracer(sprite, .3, 5,
                                          mat_vector_product(x[4]||IDENTITY,
                                                             NewVector(0,0,sprite.size/1.2)),
                                          [1,.8,.3], sprite.size/2, sprite.size));
            }};
            if (this instanceof Enemy) {
                sprite._maketrace();
            }

            sprite._kind = x[5];
            sprite._parent = this;
            sprite.health = sprite.size/(spriteid == all_ships[4] ? 20 : 5);
            return sprite;
        })
        this.velocity = ZERO;
    }

render() {
        this.sprites.map(x=> x.position = this.position.add(mat_vector_product(this.rotation, x.orig_pos)));
        this.sprites.map(x=> x.rotation = multiply(multiply(this.rotation, x.orig_rot), matrix_rotate_yz(Math.PI/2)));
        this.sprites.map(x=> x.render());
    }
}

class Enemy extends Ship {
    constructor(sprite, mass, speed, damage, position) {
        super(all_ships[sprite], position, IDENTITY)
        this.position=position;
        this.state = State.CHARGE;
        this.rotation = IDENTITY;
        this.shoot_lr = 0;
        this.goal = null;
        this.last_shoot = 3000*Math.random();
        this.mass = mass;
        this.speed = speed;
        this.engines = 0;
        this.damage = damage;
        this.my_offset = urandom_vector(this.mass*20);
        this.annoyed = -1e6;
        this.is_small = mass < 20;
        this._part_idx = 1e6;
    }

    update(dt) {
        if (this.dead) return; // in case I'm killed before this turn.

        if (last_now - this.annoyed > 20000) {
            this.state = State.SIEGE;
        } else if (this.state == State.SIEGE) {
            this.state = State.CHARGE;
        }
        var speed = this.speed;

        if (!this.is_small && urandom() > .999) {
            objects.push(new Enemy(...stats[0|(urandom()>0)], this.position));
        }
        
        if (this.state == State.CHARGE) {
            this.goal = me;
            if (this.position.distance_to(this.goal.position) < this.mass*10) {
                if (me == this.goal) {
                    this.my_offset = urandom_vector(this.mass*20);
                    if (this.is_small)
                        this.state = State.RUN;
                    setTimeout(_=> this.state = State.CHARGE, 10000);
                } else {
                    this.goal = me;
                }
            }

        } else if (this.state == State.RUN) {
            this.goal = {position: me.position.add(this.my_offset)}
            speed += (velocity.vector_length()-speed)/6;
        } else if (this.state == State.SIEGE) {
            if (urandom() > .995) this.my_offset = urandom_vector(this.mass*50+150);
            this.goal = {position: dome.position.add(this.my_offset)};
            if (urandom() > .999) this.state = State.CHARGE;
        }

        if ((this.last_shoot-=dt) <= 0) {
            this.last_shoot = 1000;

            var idx = this.sprites.length > 2 ? 1+((this.shoot_lr++)%2) : 0;
            var start_pos = this.sprites[idx].position;
            var lazer_direction;
            var predicted_location = me.position;
            var vel = lazerspeed(this.damage)*1000;
            range(10).map(x=> {
                var time_to_hit = predicted_location.distance_to(start_pos)/vel;
                predicted_location = me.position.add(me.velocity.scalar_multiply(time_to_hit*1000))
            });

            if (this.state == State.SIEGE) {
                if (this._part_idx >= dome.sprites.length) {
                    this._part_idx = 0|(Math.random()*dome.sprites.length);
                } else {
                    predicted_location = dome.sprites[this._part_idx].position.add(urandom_vector(dome.position.distance_to(me.position)/1000));
                }
            }
            
            var forward = mat_vector_product(this.rotation, Y_DIR)
                .dot(me.position.subtract(this.position)) > 0;


            if (this.position.distance_to(predicted_location) < 1000
                && (!this.is_small || forward)) {
                lazer_direction = predicted_location.subtract(start_pos)._normalize()
                
                var hit = find_first_hit(start_pos.add(lazer_direction.scalar_multiply(4)), lazer_direction.scalar_multiply(10), x => x == this)
                if (!hit[0]) {
                    particles.push(new Lazer(start_pos,
                                             lazer_direction,
                                             this.rotation,
                                             false,
                                             this.damage));
                }
            }
        }
        
        var away = objects.filter(x=> x instanceof Enemy && x.position.distance_to(this.position) < 100)
            .map(x=>[x.position.distance_to(this.position), x.position])
            .sort((a,b)=>a[0]-b[0]);
        away = away.length > 1 ? away[1][1].subtract(this.position)._normalize().scalar_multiply(.2) : ZERO;
        this.engines = 0.99*this.engines + 0.01*this.sprites.filter(x=>x._kind == 2).length;

        var should_look_dir = this.goal.position.subtract(this.position)._normalize().subtract(away);
        var forward_dir = mat_vector_product(this.rotation, Y_DIR);
        var look = forward_dir.lerp(should_look_dir, .01/this.mass*dt*this.engines)

        this.rotation = look_at(look, mat_vector_product(this.rotation, Z_DIR));
        this.velocity = mat_vector_product(this.rotation, Y_DIR).scalar_multiply(speed*this.engines);
        this.position = this.position.add(this.velocity.scalar_multiply(dt));
    }
}


class Hit extends ParticleSystem {
    constructor(pos, count, age, size, normal, speed, get_new_pos, color) {
        super(count, age, [.6, .5*(size||1), 0], color||[1, .4, 0]);
        this.normal = normal;
        this.axis = matrix_rotate_xz(urandom()*10);
        this.pos = pos;
        this.speed = speed||1;
        this.get_new_pos = get_new_pos;
        set_timeout(_=> this.dead = true
                    , age*900);
    }
    particle_start() {
        if (this.normal) {
            var r;
            while ((r = urandom_vector()._normalize()).dot(this.normal) < .5+urandom()/3 && urandom() < .9);
            return [this.pos.add(r),
                    r.scalar_multiply(Math.random()*.1*this.speed)]
        } else {
            return [this.pos.add(urandom_vector()),
                    mat_vector_product(this.axis,urandom_vector()._normalize().vector_multiply(NewVector(1,1,.1)).scalar_multiply(Math.sin(urandom()))).scalar_multiply(this.speed)]
        }
    }
    update(dt) {
        super.update(dt);
        //this.position = this.position.add(this.velocity.scalar_multiply(dt))
        this.get_new_pos && (this.position = this.get_new_pos());
    }
}


class Tracer extends ParticleSystem {
    constructor(target, age, quantity, offset, color, size, rand, graphicslevel, transparent) {
        super(80*quantity, age, [transparent||.8, size/10, 1], color);
        this.size=size

        this.target = target;
        this.max_spawn = quantity/age;
        this.use_random = 1;
        this.position = ZERO;
        this.last_target_position = this.target.position;
        this.offset = offset || ZERO;
        this.rand = rand;
        this.graphicslevel = graphicslevel||9;
    }

    particle_start(dt, max) {
        var v1 = mat_vector_product(this.target.rotation, Z_DIR).scalar_multiply(dt/100);
        var v0 = mat_vector_product(this.target.rotation, this.offset);
        return [this.last_target_position.lerp(this.target.position.add(v0), this.counter++/(max)+(this.graphicslevel==9)),
                v1.scalar_multiply(this.rand*Math.random())];
    }
    render() {
        if (!this.target.count || this.target.count == this.target.a_positions.length/3)
            super.render();
    }
    
    
    update(dt) {
        //if (this.graphicslevel == 3) console.log('start',this.target.position.add(mat_vector_product(this.target.rotation, this.offset)));
        this.counter = 0;
        super.update(dt);
        this.dead |= GRAPHICS > this.graphicslevel;
        if (this.target.dead || this.target._parent.dead && !this.fakedead) {
            this.fakedead = true;
            set_timeout(_ => this.dead = true, 10000);
        }
        // This is so ugly ...
        if (this.target._parent == me) {
            this.settings[1] = this.size/20 * (1+40*this.target._parent.velocity.vector_length()/settings._speed);
        }
        var v0 = mat_vector_product(this.target.rotation, this.offset);
        this.last_target_position = this.target.position.add(v0);
        //if (this.graphicslevel == 3) console.log('end',this.last_target_position);
    }
}

class HUDTracker extends Sprite {
    constructor(base_tracker) {
        super([[0,0,0], [0,0,0]], ZERO, 0, 0, 6+base_tracker*3)
        this.target = base_tracker ? dome : undefined;
        this.type = gl.POINTS;
        this.last_position = undefined;
    }
    update(dt) {
        this.target = (this.target && !this.target.dead && this.target) || objects.filter(x=> x instanceof Enemy && (!x.tracked || x.tracked.target != x))[0];
        if (this.target) {
            this.target.tracked = this;

            var predicted_location = this.target.position;
            var start_pos = me.position;
            var vel = lazerspeed(settings._damage)*1000;
            range(5).map(_=> {
                var time_to_hit = predicted_location.distance_to(start_pos)/vel;
                predicted_location = this.target.position.add((this.target.velocity||ZERO).scalar_multiply(time_to_hit*1000));
            });
                
            this.position = predicted_location;//.lerp(this.position, 0);
        }
    }
    render() {
        if (this.target) super.render()
    }
}

class UnderConstruction {
    constructor(sprite) {
        this.N = 1;
        this.l = 0;
        this.before = this.sprite.a_positions.map(x=>x)
    }

    update(dt) {
        if (this.N < this.sprite.b_positions.length){
            this.l += 1;
            range(3).map(i=> {
                var prev = this.sprite.b_positions[this.N-1][2-i];
                var next = this.sprite.b_positions[this.N][i];
                console.log(this.N);
                var d = prev.distance_to(next);
                if (d > 0) {
                    this.sprite.a_positions.set(prev.lerp(next, clamp(this.l,0,1))._xyz(),
                                                9*this.N+3*i);
                    this.sprite.rebuffer()
                }
            })
        }
    }

    render() {
        this.sprite.count = clamp(this.N+1,0,this.sprite.b_positions.length)*3;
        if (this.l >= 1) {
            this.N += 1;
            this.l = 0;
        }
        
        this.sprite.position = NewVector(0, 28, 0);
        //this.sprite.rotation = multiply(matrix_rotate_xz(0.01),
        //                                multiply(matrix_rotate_xy(-0.01),
        //                                         this.sprite.rotation))
        this.sprite.render()
    }
}

function make_builder(obj, sp) {
    var counts = sp.sprites.map(x=>(x._texture=1)&&(x.a_positions.length/3));
    
    return _ => {
        var end_tri   = (sum(counts) * obj.ready/100) | 0;
        sp.sprites.map((x,i)=> {
            x.count = Math.min(counts[i], end_tri+36*3*5);
            x._first = clamp((0|(end_tri/36))*36-36*3*5, 0, counts[i]);
            obj.sprites[i].count = Math.min(counts[i]/36, end_tri/36);

            end_tri -= counts[i];
        });

        sp.position = obj.position;
        sp.rotation = multiply(obj.rotation,multiply(matrix_rotate_xy(Math.PI/2),
                                                     matrix_rotate_yz(-Math.PI/2)
                                                     ));
    }
}

function wireframe(obj) {
    var sp = new Ship(obj.sprites.map(sprite => {
        var out = []
        var did = {};
        sprite.b_positions.map(x=> {
            [[x[0],x[1]], [x[1],x[2]], [x[2],x[0]]].map(ab => {
                var id = ab[0]._xyz()+ab[1]._xyz();
                if (!did[id]) {
                    did[id] = 1;
                    var sp = load2(cube, 0, NewVector(.003, ab[0].distance_to(ab[1])/20, .003));
                    var rot = look_at(ab[0].subtract(ab[1]), normal_to_plane(...x))
                    sp[2] = sp[2].map(x =>
                                      x.map(y=>
                                            mat_vector_product(sprite.orig_rot,
                                                               mat_vector_product(rot, y).add(reduce_mean(ab).scalar_multiply(1))).add(mat_vector_product(matrix_rotate_xy(-Math.PI/2), sprite.orig_pos)))) // todo is math.pi/2 right?
                    
                    sp[0] = sp[2].flat().map(x=>x._xyz()).flat()
                    out.push(sp);
                }
                
            })
        })
        
        //var sp = load2(cube, 0, .1)
        return transpose(out).map(x=>x.flat(1));
    }), ZERO, IDENTITY)
    
    sp.update = make_builder(obj, sp)
    console.log(obj);
    sp.sprites.map(sprite => {
        var old_render = sprite.render.bind(sprite);
        sprite.render = () => {
            gl.uniform1f(locations.u_alpha, -9);
            old_render();
            sprite._first = clamp(sprite.count,0,1e6)*3;
            sprite.count = (sprite.a_positions.length/3)-sprite._first;
            gl.uniform1f(locations.u_alpha, -.4);
            old_render();
            gl.uniform1f(locations.u_alpha, 0);
        }
    })
    return sp;
}


class Siphon extends ParticleSystem {
    particle_start() {
        return [NewVector(Math.random()*900,0,0),
                NewVector(1,0,0).add(urandom_vector(.2))]
    }
}


class Energy extends ParticleSystem {
    constructor(_parent) {
        super(30, 2, [1, .9, 0], [.2, .4, 1], true);
        this._parent = _parent;
    }
    particle_start() {
        this.dead = this._parent.dead;
        this.fakedead = this._parent.fakedead;
        return [this._parent.position, urandom_vector()._normalize().scalar_multiply(.1)]
    }
}

class EnergyObj {
    constructor(position) {
        this.position = position
        particles.push(new Energy(this));
        this.energy = 1;
        setTimeout(_=>this.dead=1,30000)
    }
    update() {
        (this.fakedead = (this.energy < 0)) && setTimeout(_=>this.dead=1,2000)
        
    }
    render() {}
}

class Tractor extends ParticleSystem {
    constructor() {
        super(2000, 2, [1, .1, 0], [.2, .4, 1.0], true);
        this.target = undefined;
        this.max_spawn = 100;
    }
    update(dt) {
        if (screen != 0) return;
        super.update(dt);
        var ok = 1;
        if (this.target && !this.target.dead) {
            this.position = me.position;
            this.rotation = IDENTITY.map(x=>x);
            this.rotation[5] = this.position.distance_to(this.target.position);;
            this.rotation = multiply(look_at(me.position.subtract(this.target.position),
                                             Z_DIR),
                                     this.rotation);

            if (this.target.energy > 0 && energy < 10) {
                add_energy(dt/1000);
                
                this.target.energy -= dt/1000
            } else {
                ok = 0;
            }
        }
        if (ok) {
            this.target = objects.filter(x=>x instanceof EnergyObj)
                .map(x=>[x.position.distance_to(me.position), x])
                .sort((a,b) => a[0]-b[0])[0];
            if (!this.target) return;
            this.target = this.target[1];
        }
        
        this.count = Math.min(this.target.position.distance_to(me.position)*5,1000);
        if (this.target.position.distance_to(me.position) > 200) {
            this.target = 0;
        }
        
    }
    particle_start() {
        if (this.target && energy < 10 && this.target.energy > 0) {
            play(sounds._gather);            
            return [NewVector(0,-(Math.random()**2),0).add(urandom_vector(.002)),
                    NewVector(0,-.001,0)]
        } else {
            return [NewVector(1e6,0,0), ZERO];
        }
    }
}

function add_energy(e) {
    var before = energy;
    energy = clamp(energy+e,0,10)
    if (energy == 10 && before < 10) {
        scroll(cP, i=>35-1.8*i)
        setTimeout(_=> scroll(cP, i=>35-1.8*(30-i)) , 10000)
    }
    cR.style.background = `linear-gradient(to right,#35f 0%,#35f ${energy*10}%,#236 ${energy*10}%,#236 100%`
    return energy;
}

function do_transfer(which, skip) {
    if ((skip || energy > 0) && ships[which].ready < 100) {
        setTimeout(_=>do_transfer(which, skip), 30);
        add_energy(-.005);
        ships[which].ready += .06 + ((skip||0)*.3);
    }
}


var timeout_queue;
var total_time = 0;
function set_timeout(fn, when) {
    timeout_queue.push([when+total_time, fn])
}

function check_timers(dt) {
    total_time += dt;
    var this_queue = timeout_queue;
    timeout_queue = []
    this_queue.map(x=> 
                   (x[0] < total_time) ? x[1]() : timeout_queue.push(x)
                  );
}

var starfield;
function setup_game() {
    starfield = new Sprite(load2(cube, 0, 1000), ZERO, 0, 0, 15);
}
