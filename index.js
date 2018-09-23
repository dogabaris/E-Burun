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

	fs.readdir(applicationDir + "\\src\\projeler\\" + req.body.proje + "\\", function (err, files) {
    if (err) {
        return console.log('Koklamalar Getirilemedi: ' + err);
    }
    res.send(files);
	});
});

app.post('/src/ogren', function(req, res){
	var trainDatas = [];
	
	var dirname = applicationDir + "\\src\\projeler\\" + req.body.projeIsmi + "\\";
	function readFiles(dirname, onFileContent, onError) {
	  fs.readdir(dirname, function(err, filenames) {
	    if (err) { onError(err); return;}

	    filenames.forEach(function(filename) {
	      fs.readFile(dirname + filename, 'utf-8', function(err, content) {
	        if (err) { onError(err); return;}

	        var parsedContent = JSON.parse(content);
	        onFileContent(filename, parsedContent[parsedContent.length-1], filenames.length);
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

		//var inputLayer = new Layer(7);
		//var hiddenLayer = new Layer(8);//Gizli katman hücre sayısı
		//var outputLayer = new Layer(1);

		//inputLayer.project(hiddenLayer);
		//hiddenLayer.project(outputLayer);

		//var myNetwork = new Network({
		//	input: inputLayer,
		//	hidden: [hiddenLayer],
		//	output: outputLayer
		//});

		var myNet = new Architect.Perceptron(7, req.body.gizliKatmanHucreSayisi, 1);
		var trainer = new Trainer(myNet);

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
			json["output"] = trainDatas[z]["koklamaSinifi"];
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

		var output2 = myNet.activate([0,0,0,0,0,0,0])
		console.log("Test Sonucu => ", output2);

		var output3 = myNet.activate([100000,100000,100000,100000,100000,100000,100000])
		console.log("Test Sonucu => ", output3);

		/*var learningRate = .0003;
		for (var i = 0; i < 20000; i++)
		{
			for (var j = 0; j < trainDatas.length; j++) {
				var output = myNetwork.activate([trainDatas[j]["sensor1Alan"],trainDatas[j]["sensor2Alan"]
				,trainDatas[j]["sensor3Alan"],trainDatas[j]["sensor4Alan"],trainDatas[j]["sensor5Alan"],trainDatas[j]["sensor6Alan"]
				,trainDatas[j]["sensor7Alan"]]);
				myNetwork.propagate(learningRate, trainDatas[j]["koklamaSinifi"]);
				console.log(i + " Train ", output);
			}
		}
		//test
		var output2 = myNetwork.activate([0,0,0,0,0,0,0]);
		console.log("Test Sonucu => ", output2);*/

		res.send("Success");
	});
});
app.post('/src/yeniProjeOlustur', function(req, res){
	//console.log('body:', JSON.stringify(req.body));
	//console.log('path', applicationDir + "\\src\\projeler\\" + req.body.projeAdi);
	var dir = applicationDir + "\\src\\projeler\\" + req.body.projeAdi;
	if (!fs.existsSync(dir)){
	    fs.mkdirSync(dir);
	    res.send("Başarılı");
	}
	res.send("Proje bulunmaktadır.");
});
app.post('/src/koklamaChartiGoster', function(req, res){
	//console.log('body:', JSON.stringify(req.body));

	fs.readFile(applicationDir + "\\src\\projeler\\" + req.body.proje + "\\" + req.body.koklama + '.json', function (err, data) {
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
	   	  fs.writeFile(applicationDir + "\\src\\projeler\\" + req.body.proje + "\\" + req.body.koklamaIsmi + '.json', emptyJson, (err) => {
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

			  	fs.readFile(applicationDir + "\\src\\projeler\\" + req.body.proje + "\\" + req.body.koklamaIsmi + '.json', function (err, data) {
				    var json = JSON.parse(data);
				    json.push(lineJson);
				    fs.writeFile(applicationDir + "\\src\\projeler\\" + req.body.proje + "\\" + req.body.koklamaIsmi + '.json', JSON.stringify(json), function(err){
				      if (err) throw err;
				      //console.log('The "data to append" was appended to file!');
				    });
				});
		  });
		  setTimeout(function(){
		  	  connectedPort.close();
			  var sensor1Alan=0, sensor2Alan=0, sensor3Alan=0, sensor4Alan=0, sensor5Alan=0, sensor6Alan=0, sensor7Alan=0;

		  	  fs.readFile(applicationDir + "\\src\\projeler\\" + req.body.proje + "\\" + req.body.koklamaIsmi + '.json', function (err, koklamaData) {
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
				    fs.readFile(applicationDir + "\\src\\projeler\\" + req.body.proje + "\\" + req.body.koklamaIsmi + '.json', function (err, data) {
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
					    fs.writeFile(applicationDir + "\\src\\projeler\\" + req.body.proje + "\\" + req.body.koklamaIsmi + '.json', JSON.stringify(json), function(err){
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