// graphics.js -- the core rendering engine

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


function make_proj_matrix() {
    //var f = Math.tan(Math.PI/2 - fov/2);

    // Only allow one field of view to save space
    return [
        [1, 0, 0, camera_position.x,
         0, 1, 0, camera_position.y,
         0, 0, 1, camera_position.z,
         0, 0, 0, 1],
        camera_rotation,
        [aspect/1.0734, 0, 0, 0,
         0, 0, 1, 0,
         0, 1/1.0734, 0, 0,
         0, 0, -1, 1]
    ].reduce(multiply)
}

var aspect;
function Camera() {
    aspect = cQ.width/cQ.height;

    return _ => {
        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        //gl.enable(gl.CULL_FACE);
        //gl.cullFace(gl.FRONT);

        gl.viewport(0, 0, cQ.width, cQ.height)

        gl.uniform4fv(locations.u_sun_position, star.position._xyzw());

        gl.uniform1f(locations.u_time, local_time);
        gl.uniform4fv(locations.u_camera_position, camera_position._xyzw());
        gl.uniformMatrix4fv(locations.u_camera_matrix, true,
                            proj_mat = make_proj_matrix());

        objects.map(obj=> obj.render());

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.depthMask(false);
        
        var base = NewVectorFromList(camera_position._xyz().map(x=>(x>>5)<<5));
        if (screen != 1) {
        range(8*8*8).map(z => {
            var v = NewVector((z&7)-3,((z>>=3)&7)-3,(z>>3)-3);
            if (v.vector_length() < 3) {
                glitter.position = base.add(v.scalar_multiply(32));
                glitter.render();
            }
        });
        }

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        particles.map(obj => obj.render());

        gl.depthMask(true);
        gl.disable(gl.DEPTH_TEST);
        
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        if (screen < 2 && local_time > 100) {
            hud.map(x=>x.render());
        }
        
        
        gl.disable(gl.BLEND);
    }
}


var PARTS = 0; // DEBUGONLY

class ParticleSystem extends Sprite {
    constructor(num_particles, maxage, settings, color, dont_use_random) {
        super([range((num_particles|=0)*3).map(x=>1e8),
                                    range(num_particles).map(x=>color).flat(1)], ZERO, IDENTITY,
              settings, 2);
        this.velocitys = range(num_particles*3);
        this.settings = settings;
        this.ages = Array(num_particles).fill(0)
        //console.log(this.a_colors);
        //range(num_particles).map(x=>this.a_colors[i*3+2] = Math.random())

        this.type = gl.POINTS;
        this.maxage = maxage;
        this.fakedead = undefined;
        this.max_spawn = 1e6;
        // todo space check argument assigned not through constructor
        this.use_random = !dont_use_random;
    }

    particle_start() {
        var u;
        do {
            u = urandom_vector()._normalize();
        } while (Math.abs(u.dot(this.position.subtract(camera_position)._normalize())) > .1);
        
        return [u.scalar_multiply(95+urandom()*5),
                u.scalar_multiply(.2 + urandom()*.1)]
    }
    
    update(dt, other_max) {
        var did = 0;

        var max = Math.min(other_max||1e9,this.max_spawn)*dt/16.7;
        
        for (var i = 0; i < this.ages.length; i++) {
            if ((this.ages[i] -= dt) < 0 && did < max && !this.fakedead) {
                did++;
                var [tmp, tmp2] = this.particle_start(dt, max);
                this.ages[i] = this.maxage*1000*(this.use_random||Math.random());
                this.a_colors[i*3] = this.settings[0];
                this.a_colors[i*3+1] = this.settings[1];
                this.a_settings[i*3] = local_time;
                this.a_settings[i*3+1] = local_time + this.ages[i];
                this.a_positions.set(tmp._xyz(), i*3)
                this.a_velocity.set(tmp2._xyz(), i*3)
            }
        }

        if (did) {
            this.rebuffer()
        }
    }
}

function setup_graphics() {
var fragmentShaderSource = `#version 300 es
precision mediump float;

in vec4 v_normal,world_position,v_color,v_project_onto_camera,v_position, v_sun_offset;
in float v_off_screen;

uniform int u_texture_mux;
uniform vec4 u_world_position,u_shift_color,u_camera_position;
uniform float u_alpha;

out vec4 out_color;

void main() {
  vec3 v_normal_ = normalize(v_normal.xyz);
  float light_add;

  vec2 uv = v_project_onto_camera.xy/max(v_project_onto_camera.w,1.);
  vec2 uvd = uv*(length(uv));
  vec2 pos = v_sun_offset.xy/v_sun_offset.w;

  if (u_texture_mux != 2) {
    float flare_amt = v_sun_offset.z < 0. ? 4.*max(2.-pow(max(abs(pos.x),abs(pos.y))-.2,5.),0.) : 0.;
  
    float amt[8] = float[](1.2, 5., .4, 2.4, .1, 5.5, -.4, 1.6);
    
    for (int i = 0; i < 8; i += 2) {
      vec2 uvx = mix(uv,uvd,-.5);
      out_color.r += max(0.01-pow(length(uvx+(amt[i]*(1. + .0*amt[i+1]))*pos),amt[i+1]),.0)*(7.-amt[i+1])*flare_amt;
      out_color.g += max(0.01-pow(length(uvx+(amt[i]*(1. + .05*amt[i+1]))*pos),amt[i+1]),.0)*(7.-amt[i+1])*flare_amt;
      out_color.b += max(0.01-pow(length(uvx+(amt[i]*(1. + .1*amt[i+1]))*pos),amt[i+1]),.0)*(7.-amt[i+1])*flare_amt;
    }
  }

  vec2 from_center = 2.*gl_PointCoord.xy-vec2(1,1);
  if (u_texture_mux == 1) {
    light_add += pow(clamp(dot(vec3(0, 0, -1), v_normal_),0.,1.),3.);
    light_add += pow(clamp(dot(vec3(1, 0, .5), v_normal_),0.,1.),3.);
    light_add += pow(clamp(dot(vec3(-.5, -.86, .5), v_normal_),0.,1.),3.);
    light_add += pow(clamp(dot(vec3(-.5, .86, .5), v_normal_),0.,1.),3.);

    light_add /= 2.;
    light_add += .2 + u_alpha;
    out_color += (v_color) * vec4(light_add, light_add, light_add, 1);
  } else if (u_texture_mux == 2) {
    /* particles system */
    out_color.rgb = v_normal.rgb;
    out_color.w = smoothstep(1.,0.,length(from_center)) * v_color.x;
  } else if (u_texture_mux == 5) {
    /* mouse cursor */
    from_center = abs(from_center);
    out_color = vec4(1,1,1, (max(from_center.x,from_center.y) < .875 || min(from_center.x,from_center.y) < .5) && max(from_center.x,from_center.y) > .125  ? 0 : 1)
;
  } else if (u_texture_mux == 6 || u_texture_mux == 9) {
    /* aim dot */
    if (v_off_screen > 0.) {
      float a = -atan(uv.y, uv.x);
      vec2 x_dir = vec2(cos(a),sin(a));
      vec2 y_dir = vec2(-sin(a),cos(a));
      out_color.w = dot(from_center,x_dir) > -1. && dot(from_center,x_dir)+abs(dot(from_center,y_dir))*3. < -.3 ? 1. : 0.;
    } else {
      out_color.w = min(abs(from_center.x),abs(from_center.y)) < .25 ? 1. : 0.;
    }
    out_color.xyz = u_texture_mux == 6 ? vec3(1,.3,0) : vec3(.2,.2,1);
  } else if (u_texture_mux == 7) {
    /* damage sprite */
    out_color.xyzw = v_color.rggb; /* Can do xyzw, rgbb if I want */
  } else if (u_texture_mux == 15) {
    /* Backdrop */

     vec3 p = normalize(normalize((u_camera_position-world_position).xyz)-.5);
     float pa,a=pa= 0.;
     for (int i=0; i<15; i += 1) { 
       p=abs(p)/dot(p,p)-.49;
       a+=abs(length(p)-pa);
       pa=length(p);
     }
     a *= a*a;
     vec3 s = pow(vec3(a/3e5, a/2e5, a/1e5), vec3(.9));
     out_color.rgb += .5 * clamp(s,0.,2.);
     out_color.w = 1.;
  }
  
}
`;

    var program = gl.createProgram();
    var vertexShaderSource = `#version 300 es
precision mediump float;
precision mediump int; /* TODO space only necessary if I have utexturemux*/

in vec4 a_position,a_normal,a_color,a_velocity,a_settings;
uniform int u_texture_mux;
uniform float u_time;

out vec4 v_normal,world_position,v_color,v_position,v_project_onto_camera,v_sun_offset;
out float v_off_screen;

uniform vec4 u_world_position,u_camera_position,u_sun_position;
uniform mat4 u_world_rotation,u_camera_matrix;


/* settings. x: start, y: end */
void main() {
  vec4 my_pos = a_position + vec4((u_time-a_settings.x)/16.*a_velocity.xyz,0);
  world_position = (my_pos) * u_world_rotation - u_world_position;
 
  v_normal = a_normal * u_world_rotation;
  v_color = a_color;

  mat4 c_inv = inverse(u_camera_matrix);

  gl_Position = v_project_onto_camera = c_inv * world_position;

  if (u_texture_mux == 2) { /* particle system */
     /* x sets the size and transparency, y just sets the size */
     v_color.x *= smoothstep(1., 0., (u_time-a_settings.x)/(a_settings.y-a_settings.x));
     gl_PointSize = (2000./gl_Position.w) * (2.+v_color.x) * a_color.y / float(${1<<(GRAPHICS>>1)-1});
     v_normal = a_normal;
  } else if (u_texture_mux == 5 || u_texture_mux == 6 || u_texture_mux == 9) { /* hud */
     gl_PointSize = u_texture_mux == 5 ? 20. : 8.;

     vec2 screen_pos = gl_Position.xy/max(gl_Position.w,1.);
     float bigger = max(abs(screen_pos.x), abs(screen_pos.y));
     if (bigger > 1.) {
         screen_pos /= bigger;
         gl_PointSize *= 6.;
         v_off_screen = 1.;
     } else if (u_texture_mux == 9) {
         gl_PointSize = 0.;
     }

     gl_Position = vec4(clamp(screen_pos, -.95, .95), 0, 1);
  }

  v_position = a_position;
  v_sun_offset = c_inv * (u_camera_position - u_sun_position);

}
`;

    [[gl.VERTEX_SHADER, vertexShaderSource],
     [gl.FRAGMENT_SHADER, fragmentShaderSource]].map(type_and_code => {
         var shader = gl.createShader(type_and_code[0]);
         gl.shaderSource(shader, type_and_code[1]); 
         gl.compileShader(shader);
         gl.attachShader(program, shader);

         // Just assume success on the compiled version
         var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS); // DEBUGONLY
         if (!success) { // DEBUGONLY
             console.log(type_and_code[1].split("\n").map((x,i)=>(i+1)+":" + x).join("\n")); // DEBUGONLY
             console.log(gl.getShaderInfoLog(shader)); // DEBUGONLY
             gl.deleteShader(shader); // DEBUGONLY
             sdf; // DEBUGONLY
         } // DEBUGONLY
     });
    
    gl.linkProgram(program);

    // Again assume success on the compiled version
    var success = gl.getProgramParameter(program, gl.LINK_STATUS); // DEBUGONLY
    if (success) { // DEBUGONLY
        // TODO SPACE is it shorter to just inline all the assignments?
        locations = {};
        var prev_in = true;
        (fragmentShaderSource+vertexShaderSource).match(/[a-zA-Z_]+/g).map(tok => {
            if (tok == "in") prev_in = true;
            if (tok == "uniform") prev_in = false;
            locations[tok] = locations[tok] || (prev_in ? gl.getAttribLocation(program, tok) :gl.getUniformLocation(program, tok))
        })
    } else { // DEBUGONLY
        console.log(gl.getProgramInfoLog(program)); // DEBUGONLY
        gl.deleteProgram(program); // DEBUGONLY
    } // DEBUGONLY

    gl.useProgram(program);

}
