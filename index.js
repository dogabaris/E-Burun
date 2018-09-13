const express = require('express')
var bodyParser = require("body-parser");
var serialport = require('serialport');
var createInterface = require('readline').createInterface;
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
app.get('/src/koklamalariGetir', function(req,res){
	fs.readdir(applicationDir + "\\src\\koklamalar\\", function (err, files) {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }
    var data;
    res.send(files);
	});
});
app.post('/src/kokla', function(req, res){
	console.log('body:', JSON.stringify(req.body));
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
	   	  fs.writeFile(applicationDir + "\\src\\koklamalar\\" + req.body.koklamaIsmi + '.json', emptyJson, (err) => {
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

			  	fs.readFile(applicationDir + "\\src\\koklamalar\\" + req.body.koklamaIsmi + '.json', function (err, data) {
				    var json = JSON.parse(data);
				    json.push(lineJson);
				    fs.writeFile(applicationDir + "\\src\\koklamalar\\" + req.body.koklamaIsmi + '.json', JSON.stringify(json), function(err){
				      if (err) throw err;
				      //console.log('The "data to append" was appended to file!');
				    });
				});
		  });
		  setTimeout(function(){
		  	  connectedPort.close();
			  var sensor1Alan=0, sensor2Alan=0, sensor3Alan=0, sensor4Alan=0, sensor5Alan=0, sensor6Alan=0, sensor7Alan=0;

		  	  fs.readFile(applicationDir + "\\src\\koklamalar\\" + req.body.koklamaIsmi + '.json', function (err, koklamaData) {
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
				    fs.readFile(applicationDir + "\\src\\koklamalar\\" + req.body.koklamaIsmi + '.json', function (err, data) {
					    var json = JSON.parse(data);
					    var alanJson = {};
					    alanJson['sensor1Alan'] = sensor1Alan;
					    alanJson['sensor2Alan'] = sensor2Alan;
					    alanJson['sensor3Alan'] = sensor3Alan;
					    alanJson['sensor4Alan'] = sensor4Alan;
					    alanJson['sensor5Alan'] = sensor5Alan;
					    alanJson['sensor6Alan'] = sensor6Alan;
					    alanJson['sensor7Alan'] = sensor7Alan;
					    json.push(alanJson);
					    fs.writeFile(applicationDir + "\\src\\koklamalar\\" + req.body.koklamaIsmi + '.json', JSON.stringify(json), function(err){
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