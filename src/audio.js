// audio.js -- sounds (both audio and music) for the game

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

var sounds;

var context = new AudioContext();
var play = (which, amt) => {
    if (which === undefined) return; // DEBUGONLY
    if (last_now-which._last < 120) return;
    if (which == sounds._gather && last_now-which._last < 1000) return;
    which._last = last_now;
    var m = context.createBuffer(1,which.length,48e3);
    m.copyToChannel(new Float32Array(which), 0, 0);
    var src = context.createBufferSource();
    src.buffer = m;

    var gain = context.createGain()
    gain.gain.value = amt || 1
    gain.connect(context.destination)
    src.connect(gain);
    
    src.start(); // QQ
    return src;
}

var toaudio = x => transpose(x).map(sum);


function setup_audio() {
    /*
    arr = [
        1,0.25,0.9,0,0.1,0.4,0.05,-0.2,-0.1,0.55,0.9,0.1,0.7,1,-0.85,1,-0.05,-0.1,0.1,-0.1,0.55,0.35,0,0.05,
        1,0.75,0.95,0,1,0.35,0.05,-0.2,-0.1,0.55,0.9,0.6,0.9,1,-0.85,1,0.55,0.2,0.1,-0.15,0.35,0,0,0.2,
        0,0.05,0.2,0.2,0.05,0.05,0,0,0,0,0,-0.65,0,0,0,0,0,0,0.1,-0.8,0,0.05,0,0.25,
        1,0.1,0.2,0,0.3,0.5,0.1,-0.05,-0.05,0.85,0,0,-1,0,0,0,-0.1,0.7,0.1,-0.05,0.2,0,-1,0.05,
        1,0.15,0.35,0,0.55,0.2,0,-0.15,-0.05,1,0,0,0,0.2,-0.5,0.95,-0.7,-0.1,0.15,-0.05,0,0,0,0.15,
        1,0.5,0.7,0,1,0.2,0,-0.15,-0.05,1,0,0,0,0.2,-0.5,0.95,-0.7,-0.1,0.15,-0.05,0,0,0,0.2,
        1,0.65,0.7,0,0.2,0.35,0,-0.25,0,0.95,0,0,0,0,0,0.05,0.4,0.1,0.1,-0.4,0.85,0,-0.05,0.2,
        3,.7,0.1,0,0.05,0.1,0,0.1,0,0.45,0,0,0,0.1,-0.15,0,-0.65,0,0.15,-0.15,0.45,0,0,0.2,
        0,0.8,0,0,0.3,0.3,0.05,0,-0.1,0.6,0.05,0,0,0,0,0,0.65,0.35,0.1,-0.05,0,0,0,0.2
          ]
    */
    var arr = [100,25,90,,10,40,5,-20,-10,55,90,10,70,100,-85,100,-5,-10,10,-10,55,35,,5,100,75,95,,100,35,5,-20,-10,55,90,60,90,100,-85,100,55,20,10,-15,35,,,20,,5,20,20,5,5,,,,,,-65,,,,,,,10,-80,,5,,25,100,10,20,,30,50,10,-5,-5,85,,,-100,,,,-10,70,10,-5,20,,-100,5,100,15,35,,55,20,,-15,-5,100,,,,20,-50,95,-70,-10,15,-5,,,,15,100,50,70,,100,20,,-15,-5,100,,,,20,-50,95,-70,-10,15,-5,,,,20,100,65,70,,20,35,,-25,,95,,,,,,5,40,10,10,-40,85,,-5,20,300,70,10,,5,10,,10,,45,,,,10,-15,,-65,,15,-15,45,,,20,,80,,,30,30,5,,-10,60,5,,,,,,65,35,10,-5,,,,20]
    arr = reshape(arr.map(x=>x/100),24)

    sounds = {}
    sounds.lazer = toaudio([jsfxr(arr[3])]);
    ///* // DEBUGONLY
    sounds.boom = toaudio([jsfxr(arr[0])]);
    sounds.boom2 = toaudio([jsfxr(arr[1])]);
    sounds.bass = toaudio([jsfxr(arr[4])]);
    sounds.rumble = toaudio([jsfxr(arr[5])]);
    sounds.hit = toaudio([jsfxr(arr[6])]);
    sounds.warmup = toaudio([jsfxr(arr[7])]);

    sounds._nope = toaudio([jsfxr(arr[2])]);
    sounds._gather = toaudio([jsfxr(arr[8])]);
    
    arr[3][2] = .6;
    sounds.lazer2 = toaudio([jsfxr(arr[3])]);
    //*/ // DEBUGONLY
    range(30,1).map(i=> setTimeout(_=>qQ.style.opacity = 1-(i/30)+"",i*16));
    setTimeout(_=>{qQ.style.display = "none";qQ.style.opacity="1"},1000);
    cQ.style.opacity = "1"
    
}
