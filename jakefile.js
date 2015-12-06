/* global jake:false */
/* global task:false */
/* global desc:false */
/* global complete:false */
/* global process:false */

var exec = (cmd, arg) => new Promise(resolve => {
    jake.exec(cmd, arg || {}, resolve);
});

var invoke = (task) => new Promise(resolve => {
    var t = jake.Task[task];
    t.addListener('complete', resolve);
    t.invoke();
});

function babel(args) {
    args = args || {};

    var fs = require('fs');
    var path = require('path');
    var babel = require('babel');

    var tsconfig = require(path.resolve('tsconfig.json'));

    var srcPath = args.srcPath || tsconfig.compilerOptions.out;
    var outPath = args.outPath || srcPath;

    var es6src = fs.readFileSync(srcPath, 'utf8');
    var es6map = fs.readFileSync(srcPath + '.map', 'utf8');

    var es5 = babel.transform(es6src, {
        inputSourceMap: JSON.parse(es6map),
        sourceMaps: true,
        loose: 'all',
        compact: false,
        blacklist: args.blacklist || [
            'regenerator',
            //'es6.forOf',
            //'es6.classes',
            //'es6.blockScoping',
            //'es6.templateLiterals',
        ]
    });

    es5.code = es5.code.replace(/(\r?\n\/\/# sourceMappingURL=)(.+)$/img, '$1' + outPath + '.map');

    fs.writeFileSync(outPath, es5.code, 'utf8');
    fs.writeFileSync(outPath + '.map', JSON.stringify(es5.map, null, '\t'), 'utf8');
}

desc('Builds the tsumego.js library.');
task('lib', { async: true }, () => {
    console.log('building tsumego.js...');
    exec('node ./node_modules/typescript/lib/tsc').then(() => {
        babel({
            outPath: 'tsumego.es5.js',
            blacklist: []
        });

        babel({
            outPath: 'tsumego.es6.js'
        });
    }).then(complete);
});

desc('Runs unit tests.');
task('test', { async: true }, filter => {
    console.log('running tests...');
    process.chdir('tests');

    exec('node ../node_modules/typescript/lib/tsc').then(() => {
        return babel();
    }).then(() => {
        return exec('node tests ' + (filter || ''), { printStdout: true });
    }).then(() => {
        process.chdir('..');
    }).then(complete);
});

desc('Builds the testbench app.');
task('tb', { async: true }, () => {
    console.log('building the testbench app...');
    process.chdir('testbench');

    exec('node ../node_modules/typescript/lib/tsc').then(() => {
        return babel({
            blacklist: ['regenerator', 'es6.forOf', 'es6.blockScoping']
        });
    }).then(() => {
        console.log('rebuilding problems/manifest.json...');
        process.chdir('../problems');
        return exec('npm i');
    }).then(() => {
        return exec('node sgf > manifest.json');
    }).then(() => {
        process.chdir('..');
    }).then(complete);
});

desc('Builds the console app.');
task('tgs', { async: true }, () => {
    console.log('building the console app...');
    process.chdir('console');

    exec('node ../node_modules/typescript/lib/tsc').then(() => {
        return babel();
    }).then(() => {
        process.chdir('..');
    }).then(complete);
});

desc('Prepares a release package.');
task('release', ['lib'], () => {
    console.log('prepairing a release package...');
    jake.rmRf('bin/release');
    jake.mkdirP('bin');
    jake.cpR('release', 'bin');

    var copy = path => jake.cpR(path, 'bin/release/' + path);

    copy('regenerator-runtime.js');
    copy('tsumego.es5.js');
    copy('tsumego.es6.js');
});

desc('Builds the site contents.');
task('site', ['tb'], () => {
    console.log('building the site...');
    jake.rmRf('bin/site');
    jake.mkdirP('bin');
    jake.cpR('site', 'bin');
    jake.cpR('problems', 'bin/site/problems');
    jake.cpR('regenerator-runtime.js', 'bin/site/regenerator-runtime.js');
    jake.mkdirP('bin/site/testbench');
    jake.cpR('testbench/app.js', 'bin/site/testbench/app.js');
    jake.cpR('testbench/index.html', 'bin/site/testbench/index.html');
    jake.cpR('testbench/styles.css', 'bin/site/testbench/styles.css');
});

desc('Builds everything and runs the tests.');
task('default', { async: true }, () => {
    invoke('tb').then(() => {
        return invoke('tgs');
    }).then(() => {
        return invoke('lib');
    }).then(() => {
        return invoke('release');
    }).then(() => {
        return invoke('site');
    }).then(() => {
        return invoke('test');
    }).then(complete);
});