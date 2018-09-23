const express = require('express')
var bodyParser = require("body-parser");
var serialport = require('serialport');
var createInterface = require('readline').createInterface;
const util = require('util');
var synaptic = require('synaptic');
var options = {
	baudRate: 9600,
	bufferSize: 1024
};
var fs = require("fs")
var path = require('path')
var applicationDir = path.dirname(require.main.filename)
const app = express()
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/src', express.static('src'))
app.use('/node_modules', express.static('node_modules'))
app.use('/bower_components', express.static('bower_components'))

const { Layer, Network, Architect, Trainer, Train } = require('synaptic');
const { lstatSync, readdirSync } = require('fs')
const { join } = require('path')

const isDirectory = source => lstatSync(source).isDirectory()
const getDirectories = source =>
  readdirSync(source).map(name => join(source, name)).filter(isDirectory)

app.get('/src/projeleriGetir', function(req,res){
	var projectDirs = fs.readdirSync(applicationDir + '\\src\\projeler')
    	.map(file => path.join(applicationDir + '/src/projeler/', file))
    	.filter(path => fs.statSync(path).isDirectory());
    //projectDirs.map(x => x.split("/"));
    //var projectNames = [].split("/")[projectDirs.length];
	res.send(projectDirs.map(x => x.split("/")));
});

app.post('/src/koklamalariGetir', function(req,res){

	fs.readdir(applicationDir + "\\src\\projeler\\" + req.body.proje + "\\" + req.body.tur + "\\", function (err, files) {
    if (err) {
        return console.log('Koklamalar Getirilemedi: ' + err);
    }
    var targetFiles = files.filter(function(file) {
	    return path.extname(file).toLowerCase() === '.json';
	});
    res.send(targetFiles);
	});
});

function calculatePerformance(network, dataSet){
	console.log("CALCULATE PERFORMANCE ------------");
	var testOptions = {
		log: 100,
		cost: Trainer.cost.BINARY
	}
	var trainer = new Trainer(network);
	trainer.test(dataSet, testOptions);
	console.log("CALCULATE PERFORMANCE ------------");
}

function getOutputArray(sinifListesi, koklamaSinifi) {
	var arr = new Array(sinifListesi.length);
	for (var i = 0; i < arr.length; i++) {
		if(sinifListesi[i] == koklamaSinifi){ 
			arr[i] = 1;
		}
		else
			arr[i] = 0;
	}
	return arr;
}

app.post('/src/ogren', function(req, res){
	var trainDatas = [];
	
	var dirname = applicationDir + "\\src\\projeler\\" + req.body.projeIsmi + "\\egitim\\";
	var projectDir = applicationDir + "\\src\\projeler\\" + req.body.projeIsmi + "\\";
	function readFiles(dirname, onFileContent, onError) {
	  fs.readdir(dirname, function(err, filenames) {
	    if (err) { onError(err); return;}
	    var targetFiles = filenames.filter(function(file) {
		    return path.extname(file).toLowerCase() === '.json';
		});
		console.log("targetFiles", targetFiles);

		if(targetFiles.length==0) res.send("Eğitilecek koklama bulunamadı");

	    targetFiles.forEach(function(filename) {
			fs.readFile(dirname + filename, 'utf-8', function(err, content) {
		        if (err) { onError(err); return;}

		        var parsedContent = JSON.parse(content);
		        onFileContent(filename, parsedContent[parsedContent.length-1], targetFiles.length);
	        });
	    });
	  });
	}
	new Promise(function(resolve, reject) {
		var data = [];
		readFiles(dirname, function(filename, content, fileCount) {
			data.push(content);
			if(fileCount==data.length)
				resolve(data);
		}, function(err) {
		  throw err;
		});
	}).then(function(jsonTrainDatas) {
		trainDatas = jsonTrainDatas;
		//console.log("data ", trainDatas);
		var cfgJson;

		fs.readFile(projectDir + "ProjeSinifConfig.cfg", function (err, cfgData) {
	    	cfgJson = JSON.parse(cfgData);
	    	modelEgit();
	    });
		
		function modelEgit() {
		    var myNet = new Architect.Perceptron(7, req.body.gizliKatmanHucreSayisi, cfgJson["sinifSayisi"]);
			var trainer = new Trainer(myNet);

			//console.log("cfgJson siniflar", cfgJson["siniflar"]);
			//console.log("koklamaSinifi", trainDatas[1]["koklamaSinifi"]);
			//console.log("getOutputArray ", getOutputArray(cfgJson["siniflar"], trainDatas[1]["koklamaSinifi"]));

			var trainingSet = [];
			for (var z = 0; z < trainDatas.length; z++) {
				var json = {};
				json["input"] = [trainDatas[z]["sensor1Alan"],
				trainDatas[z]["sensor2Alan"],
				trainDatas[z]["sensor3Alan"],
				trainDatas[z]["sensor4Alan"],
				trainDatas[z]["sensor5Alan"],
				trainDatas[z]["sensor6Alan"],
				trainDatas[z]["sensor7Alan"]];
				json["output"] = getOutputArray(cfgJson["siniflar"], trainDatas[z]["koklamaSinifi"]);
				trainingSet.push(json);
			}
			console.log("trainingSet", JSON.stringify(trainingSet));
			//0.03 40000 0.000005, 100
			var trainingOptions = {
			  rate: req.body.ogrenmeOrani,
			  iterations: req.body.epochSayisi,
			  error: req.body.hataOrani,
			  log: 100
			}

			trainer.train(trainingSet, trainingOptions);

			//EĞİTİM BAŞARIMI
			var output2 = myNet.activate([0,0,0,0,0,0,0])
			console.log("Test Sonucu2 => ", output2);

			var output3 = myNet.activate([8382445.5,77544214.5,25673840.5,5555374,13139094,14735382,14298.335999999994])
			console.log("Test Sonucu3 => ", output3);

			var output4 = myNet.activate([999,999,999,999,999,999,999])
			console.log("Test Sonucu4 => ", output4);

			//TEST BAŞARIMI


			//calculatePerformance(myNet, trainingSet);

			res.send("Success");
		};

			//calculatePerformance(myNet, trainingSet);

			/*var storedModel = myNet.toJSON();
			var modelName = "Model" + Date.now();
			var modelDirName = dirname + modelName;
			var saveModelDirname = path.dirname(modelDirName);
			if (fs.existsSync(saveModelDirname)) {
			  return true;
			}
			ensureDirectoryExistence(saveModelDirname);
			fs.mkdirSync(saveModelDirname);

			fs.writeFile(modelDirName, storedModel, (err) => {
			    if (err) throw err;

			    console.log("The file was succesfully saved!");
			    res.send("Success");
		    });*/
	});
});
app.post('/src/yeniProjeOlustur', function(req, res){
	//console.log('body:', JSON.stringify(req.body));
	//console.log('path', applicationDir + "\\src\\projeler\\" + req.body.projeAdi);
	var siniflar = req.body.yeniSinifIsimleri.split(',');
	console.log("siniflar ", siniflar);

	var dir = applicationDir + "\\src\\projeler\\" + req.body.projeAdi;
	var projeSinifConfig = {};
	projeSinifConfig["siniflar"] = siniflar;
	projeSinifConfig["sinifSayisi"] = siniflar.length;

	if (!fs.existsSync(dir)){
	    fs.mkdirSync(dir);
	    fs.writeFile(dir + "\\ProjeSinifConfig.cfg", JSON.stringify(projeSinifConfig), (err) => {
			    if (err) throw err;

			    console.log("The file was succesfully saved!");
        });
        res.send("Başarılı");
	}
	res.send("Proje bulunmaktadır.");
});
app.post('/src/koklamaChartiGoster', function(req, res){
	//console.log('body:', JSON.stringify(req.body));

	fs.readFile(applicationDir + "\\src\\projeler\\" + req.body.proje + "\\" + req.body.tur + "\\" + req.body.koklama + '.json', function (err, data) {
	    var json = JSON.parse(data);
	    res.send(json);
	});
});

app.post('/src/kokla', function(req, res){
	//console.log('body:', JSON.stringify(req.body));
	var sure = 0;
	if (req.body.koklamaSaati)
		sure += req.body.koklamaSaati*3600;

	if (req.body.koklamaDakikasi)
		sure += req.body.koklamaDakikasi*60;
	
	console.log("sure", sure*1000);

	console.log('COM port list:');
	var connectedPort;

	serialport.list(function (err, ports){
	  ports.forEach(function(port) {
	    console.log(port.comName);
	    console.log(' - pnpId: ' + port.pnpId);
	    console.log(' - manufacturer: ' + port.manufacturer);
	    console.log(' - serialNumber: ' + port.serialNumber);
	    console.log(' - vendorId: ' + port.vendorId);
	    console.log(' - productId: ' + port.productId);

	    if(port.productId == 7523){
	    	connectedPort = new serialport(port.comName , options, function (err) { //, parser: serialport.parsers.readline("\n")
			  if (err) {
			    return console.log('Error: ', err.message);
			  }
			});
	    }
	    
	  });
	}).then(function(value) {
	  	connectedPort.on('open', function () {
	  	  var lineReader = createInterface({
			  input: connectedPort
	   	  });
	   	  var emptyJson = "[]";//Öncelikle array json file oluşturulması gerek ki json ile içi append edilebilsin
	   	  var folderDir = applicationDir + "\\src\\projeler\\" + req.body.proje + "\\" + req.body.secilenKoklamaTuru;
	   	  if (!fs.existsSync(folderDir)){
		    fs.mkdirSync(folderDir);
		  }

	   	  fs.writeFile(folderDir + "\\" + req.body.koklamaIsmi + '.json', emptyJson, (err) => {
			    if (err) throw err;

			    console.log("The file was succesfully saved!");
		  });

	   	  lineReader.on('line', function (line) {
			  	console.log(line);
			  	var splitLine = line.split(" ");
				var lineJson = {};
				lineJson['sicaklik'] = splitLine[0];
				lineJson['nem'] = splitLine[1];
				lineJson['sensor1'] = splitLine[2];
				lineJson['sensor2'] = splitLine[3];
				lineJson['sensor3'] = splitLine[4];
				lineJson['sensor4'] = splitLine[5];
				lineJson['sensor5'] = splitLine[6];
				lineJson['sensor6'] = splitLine[7];
				lineJson['sensor7'] = splitLine[8];
				lineJson['tarih'] = new Date();

			  	fs.readFile(folderDir + "\\" + req.body.koklamaIsmi + '.json', function (err, data) {
				    var json = JSON.parse(data);
				    json.push(lineJson);
				    fs.writeFile(folderDir + "\\" + req.body.koklamaIsmi + '.json', JSON.stringify(json), function(err){
				      if (err) throw err;
				      //console.log('The "data to append" was appended to file!');
				    });
				});
		  });
		  setTimeout(function(){
		  	  connectedPort.close();
			  var sensor1Alan=0, sensor2Alan=0, sensor3Alan=0, sensor4Alan=0, sensor5Alan=0, sensor6Alan=0, sensor7Alan=0;

		  	  fs.readFile(folderDir + "\\" + req.body.koklamaIsmi + '.json', function (err, koklamaData) {
				    var koklamaJson = JSON.parse(koklamaData);
				    for (var i = 0; i < koklamaJson.length; i++) {
				    	if (koklamaJson[i+1]) {
				    		var sensorZamanFarki = new Date(koklamaJson[i+1].tarih).getTime() - new Date(koklamaJson[i].tarih).getTime();
				    		var sensor1Fark = parseInt(koklamaJson[i+1].sensor1) + parseInt(koklamaJson[i].sensor1);
					    	sensor1Alan += (sensor1Fark * sensorZamanFarki) / 2;

					    	var sensor2Fark = parseInt(koklamaJson[i+1].sensor2) + parseInt(koklamaJson[i].sensor2);
					    	sensor2Alan += (sensor2Fark * sensorZamanFarki) / 2;

					    	var sensor3Fark = parseInt(koklamaJson[i+1].sensor3) + parseInt(koklamaJson[i].sensor3);
					    	sensor3Alan += (sensor3Fark * sensorZamanFarki) / 2;

					    	var sensor4Fark = parseInt(koklamaJson[i+1].sensor4) + parseInt(koklamaJson[i].sensor4);
					    	sensor4Alan += (sensor4Fark * sensorZamanFarki) / 2;

					    	var sensor5Fark = parseInt(koklamaJson[i+1].sensor5) + parseInt(koklamaJson[i].sensor5);
					    	sensor5Alan += (sensor5Fark * sensorZamanFarki) / 2;

					    	var sensor6Fark = parseInt(koklamaJson[i+1].sensor6) + parseInt(koklamaJson[i].sensor6);
					    	sensor6Alan += (sensor6Fark * sensorZamanFarki) / 2;

					    	var sensor7Fark = parseInt(koklamaJson[i+1].sensor7) + parseInt(koklamaJson[i].sensor7);
					    	sensor7Alan += (sensor7Fark * (sensorZamanFarki / 1000)) / 2;
					    	//console.log("sensorZamanFarki", sensorZamanFarki / 1000);
					    	//console.log("sensor1Alan", sensor1Alan);
					    	//console.log("sensor1Fark", sensor1Fark);
					    	
				    	}
				    }
				    console.log("sensor1 Nihai Alan", sensor1Alan);
				    fs.readFile(folderDir + "\\" + req.body.koklamaIsmi + '.json', function (err, data) {
					    var json = JSON.parse(data);
					    var alanJson = {};
					    alanJson['sensor1Alan'] = sensor1Alan;
					    alanJson['sensor2Alan'] = sensor2Alan;
					    alanJson['sensor3Alan'] = sensor3Alan;
					    alanJson['sensor4Alan'] = sensor4Alan;
					    alanJson['sensor5Alan'] = sensor5Alan;
					    alanJson['sensor6Alan'] = sensor6Alan;
					    alanJson['sensor7Alan'] = sensor7Alan;
					    alanJson['koklamaSinifi'] = req.body.koklamaSinifi;
					    json.push(alanJson);
					    fs.writeFile(folderDir + "\\" + req.body.koklamaIsmi + '.json', JSON.stringify(json), function(err){
					      if (err) throw err;
					      //console.log('The "data to append" was appended to file!');
					    });
					});
			  });
		  	  res.send('Succesful!');
		  }, sure*1000);//ms to sn
		});
	});

	/*console.log('COM port list:');
	var connectedPort;

	serialport.list(function (err, ports){
	  ports.forEach(function(port) {
	    console.log(port.comName);
	    console.log(' - pnpId: ' + port.pnpId);
	    console.log(' - manufacturer: ' + port.manufacturer);
	    console.log(' - serialNumber: ' + port.serialNumber);
	    console.log(' - vendorId: ' + port.vendorId);
	    console.log(' - productId: ' + port.productId);

	    if(port.productId == 7523){
	    	connectedPort = new serialport(port.comName , options, function (err) { //, parser: serialport.parsers.readline("\n")
			  if (err) {
			    return console.log('Error: ', err.message);
			  }
			});
	    }
	    
	  });
	}).then(function(value) {
	  connectedPort.on('open', function () { //readable
	  //var data = connectedPort.read().toString('utf8');
	  connectedPort.on('data', function(data) {
	    console.log(data.toString('utf8'));
	  });
	  var splittedData = data.split("\n");
	  splittedData.forEach(function(dat){
	  	console.log('splittedData:', dat);
	  })
	  console.log('----');
	});
	});*/

	
});
app.listen(3000, () => console.log('Example app listening on port 3000!'))