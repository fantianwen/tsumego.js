var fs = require('fs');
var path = require('path');
var babel = require('babel');

var srcPath = process.argv[2];
var outPath = process.argv[3];

var es6src = fs.readFileSync(srcPath, 'utf8');
var es6map = fs.readFileSync(srcPath + '.map', 'utf8');

var es5 = babel.transform(es6src, {
    inputSourceMap: JSON.parse(es6map),
    sourceMaps: true
});

es5.code += '\n//# sourceMappingURL=' + outPath + '.map';

fs.writeFileSync(outPath, es5.code, 'utf8');
fs.writeFileSync(outPath + '.map', JSON.stringify(es5.map, null, '\t'), 'utf8');
