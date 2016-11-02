"use strict";

var fs = require('fs');
var path = require('path');

var rootDir = __dirname
var allFiles = {}

var walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

function getTSFiles() {
	return new Promise((resolve, reject) => {
		walk('.', function(err, results) {
			if (err) {
				reject(err)
			} else {
				resolve(results.filter(f => f.substr(-3, 3) === '.ts'))
			}
		});	
	})
}

function convert(file) {
	console.log('--', file)
  let currentFileDir = path.parse(file).dir

  let fileInfo = allFiles[file]
  let newContent = fileInfo.content
  let regexp = /import\s+(\w+)\s+\=\s+require\((("|')[a-zA-Z0-9\/\.-]+\3)\)\;?/g
  let res
  let needToWrite = false
  while (res = regexp.exec(fileInfo.content)) {
    needToWrite = true
    let importExpression = res[0]
    let moduleName = res[1]
    let modulePath = res[2]
    modulePath = modulePath.substr(1, modulePath.length - 2)

    let resolvedModulePath
    if(modulePath.substr(0, 1) === '.') {
      resolvedModulePath = path.resolve(currentFileDir, modulePath)
    } else {
      resolvedModulePath = path.resolve(modulePath)
    }
    let replacement
    let importFileInfo = allFiles[resolvedModulePath + '.ts']
    if(importFileInfo && importFileInfo.hasDefaultExport) {
      replacement = `import ${res[1]} from ${res[2]}`
    } else {
      replacement = `import * as ${res[1]} from ${res[2]}`
    }
    newContent = newContent.replace(importExpression, replacement)
  }
  fs.writeFileSync(file, newContent)
}

function readAllFiles(files) {
  files.forEach(f => {
    let content = fs.readFileSync(f, "utf-8")
    let hasDefaultExport = content.indexOf('export =') !== -1 //заменить на регексп
    allFiles[f] = {
      content: content,
      hasDefaultExport: hasDefaultExport
    }
  })
}

getTSFiles()
	.then((files) => {
		console.log('files', files.length)
    readAllFiles(files)
		files.forEach(f => convert(f))
    console.log('Done')
	})
	.catch((err) => {
		console.log(err)
	})

