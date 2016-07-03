var express = require('express');
var router = express.Router();
var moduleLoader = require('../utils/jsloader.js');
var request = require('request');
var multer = require('multer');
var fs = require('fs');
var unzip = require('unzip');
var path_module = require('path');
var exec = require('child_process').exec;
var pmRegister = require('../utils/register');
var baseAgentKey = "";
var path = require('path');
var KEYDIR = path.join(__dirname, "../keys/key.pm");

fs.readFile(KEYDIR, 'utf8', function (err,data) {
  if (err) {
	  pmRegister.registerAgent(function(key){
		  baseAgentKey = key;
	  });
  }
  else{
	  baseAgentKey = data;
	  pmRegister.updateAgent(baseAgentKey);
  }
});

/* GET home page. */
router.post('/task/register', function(req, res, next) {
	var execution_result = {msg: "registered task!"};
	var action = req.body.action;
	var key = req.body.key;
	console.log("Got Task");
	console.log(action);
	console.log('action server --- > ' + JSON.stringify(action.server, null, 2));
	console.log('action method --- > ' + JSON.stringify(action.method, null, 2));
	console.log('action type --- > ' + action.server.type);
	console.log('action name --- > ' + action.method.name);
	if(!key){
		console.log("No key provided");
		res.status(500);
		return res.send(JSON.stringify({error: "No key provided to baseAgent"}));
	}
	if(key != baseAgentKey) {
		console.log("Wrong Key provided - no permissions");
		console.log(key);
		console.log(baseAgentKey);
		res.status(500);
		return res.send(JSON.stringify({error: "Wrong Key provided to baseAgent - no permissions to execute actions"}));
	}
	if(!action.server.url) {
		console.log("Running local agent");
		moduleLoader.runModuleFunction(action.server.type, action.method.name, action).then(
			function(result){
				if(result.hasOwnProperty('error')) {
					res.status(500);
				    return res.send(JSON.stringify(result));
				}
				else {
					res.status(200);
					return res.send(JSON.stringify(result));
				}
			});
	}
	else {
		var DEDICATED_AGENT_URL = action.server.url;

		request.post(
		    DEDICATED_AGENT_URL,
		    { form: action },
		    function (error, response, body) {
		        if (!error && response.statusCode == 200) {
		            body = JSON.parse(body);
		            if(body.hasOwnProperty("error")){
		            	res.status(500);
		            	console.log("Return with status 500");
		            }
		            console.log(body);
		            return res.send(JSON.stringify(body));
		        }
		        else{
		        	console.log(error);
		        	res.status(500);
		        	return res.send(JSON.stringify({error: error}));
		        }
		    }
		);
	}
});

router.use(multer({ dest: './uploads/'}).single('file'));

/** API path that will upload the files */
router.post('/registeragent', function(req, res) {
	console.log(req.file);
	var filename = req.file.originalname.split('.')[0];
	if (!fs.existsSync('./libs/' + filename)){
	    fs.mkdirSync('./libs/' + filename);
	}
	fs.createReadStream(req.file.path)
	    .pipe(unzip.Parse())
	    .on('entry', function (entry) {
	        var fileName = entry.path;
	        var type = entry.type; // 'Directory' or 'File'
	        var size = entry.size;
	        if(fileName !== "config.json"){
	        	entry.pipe(fs.createWriteStream('./libs/' + filename + "/" + fileName));
	        }
	        else {
	            entry.autodrain();
	        }
	    }).on('close', function(data){
	    	console.log('end data');
	    	var cmd = 'cd ' + __dirname + '/../' + 'libs/' + filename + '&&' + ' npm install ' + " && cd " + __dirname;
				exec(cmd, function(error, stdout, stderr) {
				  console.log(stdout);
				  console.log(stderr);
				  console.log(error);
				  moduleLoader.loadModules(__dirname + '/../' + 'libs/' + filename ).then(function(err){
								console.log(err);
						}); // Load initial modules
				  setTimeout(function () {
				      res.json({error_code:0,err_desc:null});
				    }, 2000);
				});
	    });

});

router.post('/isalive', function(req, res, next) {
	console.log("I am in is Alive function");
	var key = req.body.key;
	if(!key){
		console.log("No key provided");
		res.status(500);
		return res.send(JSON.stringify({error: "No key provided to baseAgent"}));
	}
	if(key != baseAgentKey) {
		console.log("Wrong Key provided - no permissions");
		console.log(key);
		console.log(baseAgentKey);
		res.status(500);
		return res.send(JSON.stringify({error: "Wrong Key provided to baseAgent - no permissions to install library"}));
	}
	res.status(200);
	return res.send(JSON.stringify({res: "Success"}));
});

module.exports = router;