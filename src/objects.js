// objects.js -- create 3d objects loading from .obj files

// Copyright (C) 2019, Nicholas Carlini <nicholas@carlini.com>.
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

function load_compressed(scale2, offset2, rotation, data, idxs, offset, scale, symetries) {
    //idxs = idxs.toString(2).split("").reverse()
    var the_face = [];
    var history = [];
    var faces = [];
    var prev=0;
    //console.log("\n\n\nNEW", data);
    for (var i = 0; i < data.length;) {
        if ((data[i]|0)<128) {
            //console.log("OK", data[i], data[i+1], data[i+2])
            history.unshift(mat_vector_product(rotation, NewVectorFromList(data.slice(i,i+=3))).scalar_multiply(scale).vector_multiply(scale2).add(NewVectorFromList(offset).add(offset2).vector_multiply(scale2)))
            //console.log("Real", history[0])

        } else {
            history.unshift(history[(data[i++]|0)-128])
        }

        the_face[prev=(prev+(idxs&1)+1)%3] = history[0];
        idxs = Math.floor(idxs/2);
        if (history.length > 2) {
            //console.log("Adding", JSON.stringify(the_face))
            faces.unshift(the_face.map(x=>x));
            if (i%2 == 1) {
                faces[0].reverse();
            }
        }
    }
    // TODO merge symetries_axis and symetries_offset
    symetries.map(elt => {
        faces = [...faces, ...faces.map(f=> f.map(x=>x.subtract(history[elt[0]]).vector_multiply(NewVectorFromList(elt[1])).add(history[elt[0]])).reverse())]
    })
    return faces;
}

function load2(str, subdivisions, N, offset, rotation, randomize) {
    var outsf = [];
    if (!(N instanceof Vector)) N = NewVector(N,N,N);

    JSON.parse(JSON.stringify(str)).map(it => {
        // make a ternary op
        if (it.length == 2) {
            outsf.push(outsf[it[0]].map(f=> f.map(x=>x.vector_multiply(NewVectorFromList(it[1]))).reverse()));
        } else {
            outsf.push(load_compressed(N, offset||ZERO, rotation||IDENTITY, ...it));
        }
    })

    outsf = outsf.flat(1).map(x=>x.map(randomize || (_=>_)));
    var outsn = outsf.map(x=> {
        var q=normal_to_plane(...x).negate()._xyz();
        if (sum(q.map(Math.abs)) < 1e-5) sdf; // DEBUGONLY
        return [q,q,q];
    })
    return [outsf.flat().map(x=>x._xyz()).flat(), outsn.flat(2), outsf]
}

var all_ships = []

function setup_ships() {
                /*0      1     2   3      4       5     6       7          8        9    10       11       12, 13*/
    var pieces = [body, body, wing0, , wing2, wing2, big_bad1, big_bad2, engine, body3, wing5, gunmount, nicecube, nicecube, nicecube]
    var type   = [1,    1,    1,     1,     1,      1,    1,        1,        2,      1,     1,     3,        1, 1, 3];

    // TYPE: 1: BODY, 2: ENGINE, 3: GUN

    // [INDEX, SIZE, POSITION, ROTATION, OFFSET, ROT_OFFSET]

    
    var ships = [
        [ // 
            [0, 1, [0, 0, 0],  IDENTITY],
            [10, .1, [0, 10, 0], matrix_rotate_yz(-Math.PI/4), [0,-1.5,0]],
            [8, .03, [5, 0, 40], IDENTITY, [-1,-.2,-.3]],
            [8, .03, [5, 0, 40], IDENTITY,  [1,-.2,-.3]],
        ],
        [ // high damage one
            [0, 1, [0, 0, 0],  IDENTITY],
            [4, 1, [0, 0, 0], IDENTITY],
            [8, .03, [5, 0, 40], IDENTITY],
        ],
        [ // initial one
            [9, .1, [0, 0, 0],  IDENTITY],
            [10, .1, [0, 0, 0], IDENTITY],
            [10, .08, [20, 6, 0], matrix_rotate_xy(.8)],
            [8, .06, [0, 0, 0], IDENTITY, [0, -2, 0]],
        ],
        [ // cube thing
            [12, .1, [0, 0, 0],  IDENTITY,  [0, 0+4.5, 0]],
            [12, .08, [0, 0, 0],  IDENTITY, [0, -1.5+4.5, 0]],
            [12, .1, [0, 0, 0],  IDENTITY,  [0, -3+4.5, 0]],
            [12, .08, [0, 0, 0],  IDENTITY, [0, -4.5+4.5, 0]],
            [12, .1, [0, 0, 0],  IDENTITY,  [0, -6+4.5, 0]],
            [12, .08, [0, 0, 0],  IDENTITY, [1.5, -6+4.5, 0]],
            [12, .08, [0, 0, 0],  IDENTITY, [-1.5, -6+4.5, 0]],
            [12, .1, [0, 0, 0],  IDENTITY, [3, -6+4.5, 0]],
            [12, .1, [0, 0, 0],  IDENTITY, [-3, -6+4.5, 0]],
            [8, .08, [0, 0, 0],  IDENTITY, [3, -7+4.5, 0]],
            [8, .08, [0, 0, 0],  IDENTITY, [-3, -7+4.5, 0]],
            [8, .1, [0, 0, 0],  IDENTITY,  [0, -7+4.5, 0]],
        ],
        [
            [0, 3, [0, 0, 0],  IDENTITY],
            [2, 3, [0, 0, 0], IDENTITY, [0,0,0]],
            [8, .15, [0, 0, 0], IDENTITY, [0, -3, 0]],
        ],
        [ // big bad
            [7, 1, [0, 0, 0], IDENTITY],
            [11, .2, [0, 0, 0], IDENTITY, [3.5, 8, 8], matrix_rotate_xz(Math.PI+.3)],
            [11, .2, [0, 0, 0], IDENTITY, [3.5, 8, -8], matrix_rotate_xz(Math.PI-.3)],
            [6, 1, [-10, 0, 0], IDENTITY],
            [8, 1, [0, 0, 0], IDENTITY, [0, -30, 10]],
            [8, 1, [0, 0, 0], IDENTITY, [0, -30, -10]],
        ],
        // outpost 2
        range(3).map(j=> 
                     range(32).map(i=> {
                         var angle = multiply((i==8 || i==24) ? IDENTITY : matrix_rotate_xz(j*Math.PI/3),
                                              matrix_rotate_xy(-i/16*Math.PI))
                         return [14, 1-(i%2)/3, [0, 0, 0],  IDENTITY, mat_vector_product(angle, X_DIR.scalar_multiply(80))._xyz(), angle];
                     })
                    ).flat(1),
            
    ];

    function make(index, size, position, rotation, finalpos, finalrot) {
        // todo space negative never used
        return [...(index < 0 ? ships[-index].map(x=>make(...x)) : load2(pieces[index], 0, size, NewVectorFromList(position), rotation)),
                NewVectorFromList(finalpos||[0,0,0]),
                finalrot,
                type[index]];
    }
    
    all_ships = ships.map(pieces_list => pieces_list.map(x => make(...x)))
}

