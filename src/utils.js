// utils.js -- a collection of short functions used throughout

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


var transpose = (mat) => mat[0].map((x,i) => mat.map(x => x[i]))

var range = (N,a) => Array(N).fill().map((_,x)=>x+(a||0));

var reshape = (A,m) => 
    range(A.length/m).map(x=>A.slice(x*m,(x+1)*m));

var urandom = _ => Math.random()*2 - 1;
var urandom_vector = n => NewVector(urandom()*(n=n||1),urandom()*n,urandom()*n)


function uncompress(x) {
    return atob(x).split("").map(x=>x.charCodeAt(0));
}

var multiply, mat_vector_product;

var cartesian_product_map = (a,b,f) =>
    [].concat(...a.map(x=>b.map(y=>f(x,y))));

var normal_to_plane = (a,b,c) =>
    (a.subtract(b).cross(c.subtract(b)))._normalize();

var NewVector = (a,b,c,d) => new Vector(a,b,c,d);
var NewVectorFromList = (x) => NewVector(...x); // TODO space need this?

var reduce_add = (lst) => lst.reduce((a,b)=>a.add(b));
var reduce_mean = (lst) => reduce_add(lst).scalar_multiply(1/lst.length);

// todo make this a function on vectors
var angle_between = (a,b) => Math.atan2(a.subtract(b).x,
                                        a.subtract(b).y)


var push = (x,y) => (x.push(y), x);

var clamp = (x,low,high) => Math.min(Math.max(low, x), high)
var sum = (x) => x.reduce((a,b)=>a+b)

var matrix_rotate_yz = (theta) => 
    [1,0,0,0,
     0,Math.cos(theta), -Math.sin(theta), 0,
     0,Math.sin(theta), Math.cos(theta), 0,
     0, 0, 0, 1];

var matrix_rotate_xz = (theta) => 
    [Math.cos(theta),0,-Math.sin(theta),0,
     0, 1, 0, 0,
     Math.sin(theta),0, Math.cos(theta), 0,
     0, 0, 0, 1];

var matrix_rotate_xy = (theta) => 
    [Math.cos(theta), -Math.sin(theta), 0, 0,
     Math.sin(theta), Math.cos(theta), 0, 0,
     0, 0, 1, 0,
     0, 0, 0, 1];


var IDENTITY = matrix_rotate_xy(0);


function look_at(forward, up) {
    forward = forward._normalize()
    var right = up.cross(forward)._normalize();
    up = forward.cross(right);

    return [right.x, forward.x, up.x, 0,
            right.y, forward.y, up.y, 0,
            right.z, forward.z, up.z, 0,
            0, 0, 0, 1];
                       
}


class Vector {
    constructor(x, y, z, w) {
        this.x = +x||0;
        this.y = +y||0;
        this.z = +z||0;
        this.w = +w||0;
    };

    add(other) {
        return NewVector(this.x+other.x,
                         this.y+other.y,
                         this.z+other.z)
    }
    
    subtract(other) {
        return this.add(other.negate())
    }
    
    negate() {
        return this.scalar_multiply(-1);
    }
    
    scalar_multiply(c) {
        return NewVector(this.x * c,
                         this.y * c,
                         this.z * c)
    }

    vector_multiply(other) {
        return NewVector(this.x*other.x,
                         this.y*other.y,
                         this.z*other.z);
    }

    dot(other) {
        return this.x*other.x+this.y*other.y+this.z*other.z;
    }

    _xyz() {
        return [this.x,this.y,this.z]
    }

    _xyzw() {
        return push(this._xyz(),this.w);
    }

    lerp(other, frac) {
        return this.scalar_multiply(1-frac).add(other.scalar_multiply(frac));
    }

    moveto(other, distance) {
        var f = other.subtract(this);
        if (f.vector_length() > distance) f = f._normalize().scalar_multiply(distance)
        return this.add(f);
    }
    
    cross(other) {
        return NewVector(this.y*other.z-this.z*other.y,
                          this.z*other.x-this.x*other.z,
                          this.x*other.y-this.y*other.x);
    }

    project_onto(other) {
        return other.scalar_multiply(this.dot(other)/other.length_squared())
    }
    
    
    copy() {
        return NewVectorFromList(this._xyzw());
    }

    length_squared() {
        return this.dot(this)
    }

    vector_length() {
        return this.length_squared()**.5;
    }

    distance_to(other) {
        return this.subtract(other).vector_length();
    }

    _normalize() {
        return this.scalar_multiply(1.0/(this.vector_length()+1e-30))
    }
}


// TODO space write in terms of proj_uv
function dist_ray_point(start, direction, point) {
    return direction.cross(start.subtract(point)).vector_length()/direction.vector_length()
}

function ray_triangle_intersect(orig, direction, v0, v1, v2) {
    var v0v1 = v1.subtract(v0);
    var v0v2 = v2.subtract(v0);
    var pvec = direction.cross(v0v2);

    var det = 1/v0v1.dot(pvec);

    // TODO SAFE?
    //if (det > 1e5)
    //    return 0;
    
    var tvec = orig.subtract(v0);
    var u = tvec.dot(pvec) * det;
    
    if (u < 0 || u > 1)
        return 0;

    var qvec = tvec.cross(v0v1);
    var v = direction.dot(qvec) * det;

    if (v < 0 || u + v > 1)
        return 0;

    return v0v2.dot(qvec) * det;
}

function find_first_hit(position, direction, filter) {
    var best = 1e9;
    var bestIdx;
    var bestSid=-1;
    var bestObject;
    objects.map(other => {
        if ((!filter || filter(other)) && // It's the right kind of object
            other.sprites
           ) {

            other.sprites.map((sprite, sid) => {
                if (sprite.position.distance_to(position) < direction.vector_length()+sprite.size &&  // and it's in range
                    dist_ray_point(position, direction, sprite.position) < sprite.size) { // and the ray says it's in range
                    sprite.b_positions.map((tri,idx) => {
                        var distance;
                        if (sprite.size < 3 && other != me && false) {
                            distance = sprite.position.subtract(position).project_onto(direction).vector_length()/direction.vector_length();
                        } else {
                            tri = tri.map(x=>mat_vector_product(sprite.rotation, x).add(sprite.position))
                            distance = ray_triangle_intersect(position, direction, ...tri);
                        }
                        if (distance < best && distance > 0) {
                            best = distance;
                            bestIdx = idx;
                            bestSid = sid;
                            bestObject = other;
                        }
                    })
                }
            })
        }
    });
    return [bestObject, bestSid, bestIdx, best]
}
    

var ZERO = new Vector(0, 0, 0); // TODO keep it like this to stop the optimizer from inlining the class definition and making things 10x slower
var X_DIR = NewVector(1, 0, 0);
var Y_DIR = NewVector(0, 1, 0);
var Z_DIR = NewVector(0, 0, 1);

var last_sent_rotation;

class Sprite {
    constructor(pos_and_normal, position, rotation, colors, texture) {
        this.count = (this.a_positions = new Float32Array(pos_and_normal[0])).length/3;
        this.a_velocity = new Float32Array(pos_and_normal[0].length);
        this.a_settings = new Float32Array(pos_and_normal[0].length);
        if (this.b_positions = pos_and_normal[2]) { // YES THIS IS AN ASSIGNMENT
            this.size = Math.max(...this.b_positions.flat(1).map(x=>x.vector_length()));
        }
        this.a_normals = new Float32Array(pos_and_normal[1]);
        this.orig_pos = this.position = position;
        this.buffers = range(5).map(x=>gl.createBuffer())
        this.orig_rot = this.rotation = rotation||IDENTITY;

        this.a_colors = new Float32Array(Array(this.count).fill(colors || [1,1,1]).flat());

        this._texture = texture || 1;

        this.type = gl.TRIANGLES;
        this._first = 0;
        
        this.rebuffer();
    }

    rebuffer() {
        [this.a_positions, this.a_normals, this.a_velocity, this.a_settings, this.a_colors].map((which, i) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[i]);
            gl.bufferData(gl.ARRAY_BUFFER, which, gl.DYNAMIC_DRAW);
        });
    }

    render() {
        if (this.count-this._first < 1) return;
        gl.uniform4fv(locations.u_world_position, this.position.negate()._xyzw());
        if (this.rotation != last_sent_rotation) {
            last_sent_rotation = this.rotation;
            gl.uniformMatrix4fv(locations.u_world_rotation, false, this.rotation);
        }

        [locations.a_position,
         locations.a_normal,
         locations.a_velocity,
         locations.a_settings,
         locations.a_color].map((location,i) => {
             gl.enableVertexAttribArray(location);
             gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[i]);
             gl.vertexAttribPointer(
                 location, 3, gl.FLOAT, false, 0, 0);
         });
        gl.uniform1i(locations.u_texture_mux, this._texture);

        gl.drawArrays(this.type, this._first, this.count-this._first);
    }
}

var setup_utils = () => {
    var mat_product_symbolic = B =>
        `(a,b)=>[${reshape(range(16),4).map(c=>B[0].map((_,i)=>B.reduce((s,d,j)=>`${s}+b[${d[i]}]*a[${c[j]}]`,0))).flat()}]`;

    
    multiply = eval/*HACK*/(mat_product_symbolic(reshape(range(16),4))
                           )    
    var mat_vector_product_q = eval/*HACK*/(mat_product_symbolic(reshape(range(4),1))
                                       )

    mat_vector_product = (m,x) => NewVectorFromList(mat_vector_product_q(m,x._xyzw()));
};

