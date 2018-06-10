#!/usr/bin/env node

'use strict';

const cp = require('child_process');
const path = require('path');
// const expect = require('chai').expect;
const streamSplitter = require('stream-splitter');

const simCmd = path.join(__dirname, '/node_modules/.bin/hue-simulator');
const simArgs = ['--hostname=127.0.0.1'];
let sim;
let simPipeOut;
let simPipeErr;
const simSubscriptions = {};
const simBuffer = [];

const hueCmd = path.join(__dirname, '/index.js');
const hueArgs = ['backup', '--user', 'newdeveloper', '--bridge', '127.0.0.1'];
let hue;
let huePipeOut;
let huePipeErr;
const hueSubscriptions = {};
const hueBuffer = [];

let subIndex = 0;

function subscribe(type, rx, cb) {
    subIndex += 1;
    if (type === 'sim') {
        simSubscriptions[subIndex] = {rx, cb};
    } else if (type === 'hue') {
        hueSubscriptions[subIndex] = {rx, cb};
    }
    matchSubscriptions(type);
    return subIndex;
}

// function unsubscribe(type, subIndex) {
//     if (type === 'sim') {
//         delete simSubscriptions[subIndex];
//     } else if (type === 'hue') {
//         delete hueSubscriptions[subIndex];
//     }
// }

function matchSubscriptions(type, data) {
    let subs;
    let buf;
    if (type === 'sim') {
        subs = simSubscriptions;
        buf = simBuffer;
    } else if (type === 'hue') {
        subs = hueSubscriptions;
        buf = hueBuffer;
    }
    if (data) {
        buf.push(data);
    }
    buf.forEach((line, index) => {
        Object.keys(subs).forEach(key => {
            const sub = subs[key];
            if (line.match(sub.rx)) {
                sub.cb(line);
                delete subs[key];
                buf.splice(index, 1);
            }
        });
    });
}

function startHue() {
    hue = cp.spawn(hueCmd, hueArgs);
    huePipeOut = hue.stdout.pipe(streamSplitter('\n'));
    huePipeErr = hue.stderr.pipe(streamSplitter('\n'));
    huePipeOut.on('token', data => {
        console.log('hue', data.toString());
        matchSubscriptions('hue', data.toString());
    });
    huePipeErr.on('token', data => {
        console.log('hue', data.toString());
        matchSubscriptions('hue', data.toString());
    });
}

function startSim() {
    sim = cp.spawn(simCmd, simArgs);
    simPipeOut = sim.stdout.pipe(streamSplitter('\n'));
    simPipeErr = sim.stderr.pipe(streamSplitter('\n'));
    simPipeOut.on('token', data => {
        console.log('sim', data.toString());
        matchSubscriptions('sim', data.toString());
    });
    simPipeErr.on('token', data => {
        console.log('sim', data.toString());
        matchSubscriptions('sim', data.toString());
    });
}

function end(code) {
    if (hue.kill) {
        hue.kill();
    }
    if (sim.kill) {
        sim.kill();
    }
    if (typeof code !== 'undefined') {
        process.exit(code);
    }
}

process.on('SIGINT', () => {
    end(1);
});

process.on('exit', () => {
    end();
});

describe('start hue-simulator', () => {
    it('hue-simulator should start without error', function (done)  {
        this.timeout(20000);
        subscribe('sim', /hue simulator listening/, data => {
            done();
        });
        startSim();

    });
});

describe('run hueconf backup', () => {
    it('hueconf should run without error', function (done) {
        this.timeout(20000);
        subscribe('hue', /saved to .\/backups\/rules.json/, data => {
            done();
        });
        startHue();
    });
});
