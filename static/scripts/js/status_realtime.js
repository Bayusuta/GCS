var transform = ol.proj.getTransform('EPSG:3857', 'EPSG:4326');
var PointerInteraction = ol.interaction.Pointer;

// -- Global Variable -- //

var VehicleData_List = new Map();
var VehicleOverlay_List = new Map();

var lastVehicleID = 0;
var color_List = [
    { color: "blue", taken: false },
	{ color: "red", taken: false },
	{ color: "purple", taken: false },
	{ color: "yellow", taken: false },
	{ color: "green", taken: false },
	{ color: "brown", taken: false },
	{ color: "lime", taken: false },
	{ color: "orange", taken: false }
];
var currentStatusDisplay = 0;

var globmsg = null;

// -- End of Global Variable -- //

// -- TRANSFORM FUNCTION -- //

function convertToLonLat(x, y) {
	return ol.proj.transform([x, y], 'EPSG:3857', 'EPSG:4326');
}

function convertFromLongLat(long, lat) {
	return ol.proj.transform([long, lat], 'EPSG:4326', 'EPSG:3857')
}

// -- TRANSFORM FUNCTION -- //

const features_Track = [];
// create the source and layer for random features
const vectorSource_Track = new ol.source.Vector({  });
const vectorLayer_Track = new ol.layer.Vector({
    source: vectorSource_Track,
    style: new ol.style.Style({
    image: new ol.style.Circle({
            radius: 2,
            fill: new ol.style.Fill({color: 'yellow'})
        })
    })
});

function addTrackPath(coordinates){
    lon = coordinates[0];
    lat = coordinates[1];
    // console.log("try to draw point : ["+lon+","+lat+"]" );
    features_Track.push(new ol.Feature({
        geometry: new ol.geom.Point(convertFromLongLat(lon,lat))
    }));
    vectorSource_Track.clear();
    vectorSource_Track.addFeatures(features_Track);
}

// -- Map Mouse Event -- //

var Drag = (function(PointerInteraction) {
	function Drag() {
		PointerInteraction.call(this, {
			handleDownEvent: handleDownEvent,
			handleDragEvent: handleDragEvent,
			handleMoveEvent: handleMoveEvent,
			handleUpEvent: handleUpEvent,
		});

		this.coordinate_ = null;
		this.cursor_ = 'pointer';
		this.feature_ = null;
		this.previousCursor_ = undefined;
	}

	if (PointerInteraction) Drag.__proto__ = PointerInteraction;
	Drag.prototype = Object.create(PointerInteraction && PointerInteraction.prototype);
	Drag.prototype.constructor = Drag;

	return Drag;
}(PointerInteraction));

function handleDownEvent(evt) {
	var map = evt.map;

	var feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
		return feature;
	});

	if (feature) {
		this.coordinate_ = evt.coordinate;
		this.feature_ = feature;
	}

	return !!feature;
}

function handleDragEvent(evt) {
	var deltaX = evt.coordinate[0] - this.coordinate_[0];
	var deltaY = evt.coordinate[1] - this.coordinate_[1];

	var geometry = this.feature_.getGeometry();
	geometry.translate(deltaX, deltaY);

	this.coordinate_[0] = evt.coordinate[0];
	this.coordinate_[1] = evt.coordinate[1];
}

function handleMoveEvent(evt) {
	if (this.cursor_) {
		var coords = ol.proj.toLonLat(evt.coordinate);

		var lon = coords[0];
		var lat = coords[1];

		document.getElementById('pointer-coordinate').innerHTML = "<b>Longitude</b>: " + lon + " <b>Latitude</b>: " + lat;

		var map = evt.map;
		var feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
			return feature;
		});
		var element = evt.map.getTargetElement();
		if (feature) {
			if (element.style.cursor != this.cursor_) {
				this.previousCursor_ = element.style.cursor;
				element.style.cursor = this.cursor_;
			}
		} else if (this.previousCursor_ !== undefined) {
			element.style.cursor = this.previousCursor_;
			this.previousCursor_ = undefined;
		}
	}
}

function handleUpEvent() {
	this.coordinate_ = null;
	this.feature_ = null;
	return false;
}

// -- END OF Map Mouse Event -- //

// -- Transfer Data To engine.py

function TransferData() {
	var data = [];
	VehicleData_List.forEach(function(items, key) {
		data.push(items);
	});

	$.ajax({
        method: 'POST',
        url: '/api/update_data',
        contentType: 'application/json',
        data: JSON.stringify({
            type: "vehicle_dataList",
            data: data
        }),
	}).done(function(msg) {
		console.log("Transfer data:");
		console.table(data);
	});
}

var Page = document.getElementById("html_page");
Page.addEventListener("keyup", function(event) {
	if (event.keyCode === 68) {
		event.preventDefault();
		TransferData();
	}
});

// -- End Transfer Data To engine.py

// -- Get Data from engine.py

function GetData() {
	$.ajax({
        method: 'PUT',
        url: '/api/get_data',
        contentType: 'application/json',
        data: JSON.stringify({
            request: "vehicle_dataList",
            data: null
        }),
    })
    .done(function(msg) {
        console.log("Get Data:");
        // console.log(msg);
        for (var i = 0; i < msg.data.length; i++) {
            console.log(msg.data[i]);
            VehicleData_List.set(msg.data[i].key, msg.data[i]);
            addVehicle(msg.data[i].key, msg.data[i].vehicleColor);
            if (msg.data[i].isConnected) { // Has overlay
                addVehicleOverlay([0, 0], msg.data[i].key);
                selectVehicle(msg.data[i].key);
            }
		}
		if(VehicleData_List){
			console.log("no vehicle");
			$('#btn-addvehicle').click();
			selectVehicle(0);
		}
    });
}

var Page = document.getElementById("html_page");
Page.addEventListener("keyup", function(event) {
	if (event.keyCode === 70) {
		event.preventDefault();
		GetData();
	}
});

// -- End Get Data from engine.py

// -- THE MAP -- //

var map = new ol.Map({
	// controls: [],
	// interactions : ol.interaction.defaults({
	//   doubleClickZoom: false,
	//   dragZoom: false,
	//   keyboardZoom: false,
	//   mouseWheelZoom: false,
	//   pinchZoom: false,
	// }),
	interactions: ol.interaction.defaults().extend([new Drag()]),
	target: 'map',
	renderer: 'canvas', // Force the renderer to be used
	layers: [
		new ol.layer.Tile({
			source: new ol.source.BingMaps({
				key: 'AnGHr16zmRWug0WA8mJKrMg5g6W4GejzGPBdP-wQ4Gqqw-yHNqsHmYPYh1VUOR1q',
				imagerySet: 'AerialWithLabels',
				// imagerySet: 'Road',
			})
        }),
        vectorLayer_Track
	],
	view: new ol.View({
		center: ol.proj.transform([112.79758155388635, -7.2772675487336045], 'EPSG:4326', 'EPSG:3857'),
		zoom: 18
	})
});

// -- END OF THE MAP -- //

// -- Connect Button Clicked -- //

$('#btn-connect').on('click', function() {
	// Display Connecting
	document.getElementById('btn-connect').style.display = "none";
	document.getElementById('btn-connecting').style.display = "block";

	console.log("Connecting ...");
	var address = $('#textbox-address').val();
	var baudrate = $('#textbox-baudrate').val();

	$.ajax({
			method: 'PUT',
			url: '/api/connect',
			contentType: 'application/json',
			data: JSON.stringify({
				addr: address,
				baudrate: baudrate,
				id: currentStatusDisplay
			}),
		})
		.done(function(msg) {
			document.getElementById('btn-connect').classList.remove("btn-warning");
			/* error:0 = connection success
			   error: selain 0 = connection failed
			   sementara yang error dianggap sukses dulu
			*/
			if (msg.error == 0) {
				alert("Connection Success");

				var tempVehicleData = VehicleData_List.get(currentStatusDisplay);
				VehicleData_List.set(currentStatusDisplay, {
					key: currentStatusDisplay,
					vehicleColor: tempVehicleData.vehicleColor,
					address: address,
					baudrate: baudrate,
					isConnected: true,
					home: [],
					missionList: []
				});
				TransferData();

				//toggle button connect/disconnect
				document.getElementById("btn-connecting").style.display = "none";
				document.getElementById("btn-disconnect").style.display = "block";

				// //toggle button delete
				// document.getElementById("delete-vehicle").style.display = "none";

				//disable textbox address && baudrate
				document.getElementById('textbox-address').setAttribute("disabled", true);
				document.getElementById('textbox-baudrate').setAttribute("disabled", true);

				selectVehicle(currentStatusDisplay);
				addVehicleOverlay([msg.lon, msg.lat], currentStatusDisplay);
			} else if (msg.error == 1) {
				alert("Connection failed");

				//toggle button connect/disconnect
				document.getElementById("btn-connecting").style.display = "none";
				document.getElementById("btn-connect").style.display = "block";
			} else {
				alert("Unknown error");
			}
		});
});

// -- End of Connect Button Clicked -- //

// Disconnect button clicked //
$('#btn-disconnect').on('click', function() {
	//toggle button connect/disconnecting
	document.getElementById("btn-disconnect").style.display = "none";
	document.getElementById("btn-disconnecting").style.display = "block";

	$.ajax({
			method: 'PUT',
			url: '/api/disconnect',
			contentType: 'application/json',
			data: JSON.stringify({
				id: currentStatusDisplay
			}),
		})
		.done(function(msg) {
			alert("Disconnect Success");
			//toggle button connect/disconnecting
			document.getElementById("btn-disconnecting").style.display = "none";
			document.getElementById("btn-connect").style.display = "block";

			// //toggle status connect/disconnect
			// document.getElementById("status-connect").style.display = "block";
			// document.getElementById("status-disconnect").style.display = "none";

			// //toggle delete button
			// document.getElementById("delete-vehicle").style.display = "block";

			// Update
			var tempVehicleData = VehicleData_List.get(currentStatusDisplay);
			VehicleData_List.set(currentStatusDisplay, {
				key: currentStatusDisplay,
				vehicleColor: tempVehicleData.vehicleColor,
				address: tempVehicleData.address,
				baudrate: tempVehicleData.baudrate,
				isConnected: false,
				home: tempVehicleData.home,
				missionList: tempVehicleData.missionList
			});
			TransferData();
			selectVehicle(currentStatusDisplay);
			//VehicleOverlay_List.delete(currentStatusDisplay);  
		});
});
// End Disconnect button clicked //

// -- Function : Add Vehicle Overlay -- //

function addVehicleOverlay(coordinate, id) {
	var lon = coordinate[0],
		lat = coordinate[1];

	var Vehicle_Element = document.createElement('div');
	Vehicle_Element.style.position = 'relative';
	Vehicle_Element.style.height = '80px';
	Vehicle_Element.style.width = '80px';
	Vehicle_Element.innerHTML = '' +
		'<div style="background: rgba(0, 220, 255, 1); opacity: 0.2; width: 100%; height: 100%; border-radius: 50%; position: absolute; top: 0; left: 0; box-sizing: border-box; border: 2px solid rgb(0, 100, 150);"></div>' +
		'<div style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; -webkit-transform: rotate(45deg);" class="heading"><div style="width: 0; height: 0; border-width: 10px; border-style: solid; border-color: red transparent transparent red; position: absolute; top: 0; left: 0;"></div></div>' +
		'<img src="static/images/solo.png" height="50" style="z-index: 100; position: absolute; top: 50%; left: 50%; margin-left: -43px; margin-top: -20px;">';

	var Vehicle_Overlay = new ol.Overlay({
		element: Vehicle_Element,
		position: ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'),
		positioning: 'center-center'
	});

	VehicleOverlay_List.set(id, Vehicle_Overlay);

	map.addOverlay(VehicleOverlay_List.get(Number(id)));
	map.getView().setCenter(ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'));
	console.log("Add Vehicle Overlay With ID: " + id);
}

// -- End of Function : Add Vehicle Overlay -- //

//add vehicle //
$('#btn-addvehicle').on('click', function() {
	if (VehicleData_List.size < color_List.length) {
		var vehicleColor;

		for (var i = 0; i < color_List.length; i++) {
			if (!color_List[i].taken) {
				vehicleColor = color_List[i].color;
				color_List[i].taken = true;
				break;
			}
		}

		$("#table-vehiclelist").append(
			`<tr id="icon-vehicle-` + lastVehicleID + `" onclick="selectVehicle(` + lastVehicleID + `)">
		<td>
			<div style="border: none; background: none; width: 100%; margin-left:auto; margin-right:auto;"><center><i class="icon-plane text-` + vehicleColor + `"></i></center></div>
		</td>
	  </tr>`
		);

		VehicleData_List.set(lastVehicleID, {
			key: lastVehicleID,
			vehicleColor: vehicleColor,
			address: null,
			baudrate: null,
			isConnected: false,
			home: [],
			missionList: []
		});
		selectVehicle(lastVehicleID);
		lastVehicleID++;
		TransferData();
	}
});
//end add vehicle //

// Begin of addVehicle()

function addVehicle(id, color) {
	lastVehicleID = id + 1;
	for (var i = 0; i < color_List.length; i++) {
		if (color_List[i].color == color) {
			color_List[i].taken = true;
			break;
		}
	}

	var tr = document.getElementsByTagName('tr');
	$("#table-vehiclelist").append(
		`<tr id="icon-vehicle-` + id + `" onclick="selectVehicle(` + id + `)">
	  <td>
		  <div style="border: none; background: none; width: 100%; margin-left:auto; margin-right:auto;"><center><i class="icon-plane text-` + color + `"></i></center></div>
	  </td>
	</tr>`
	);
}

// End of addVehicle()

// -- Function when sidebar collapsed -- //

$('#push-menu').on('click', function() {
	// console.log(document.getElementById('page-body').classList);
	if (document.getElementById('page-body').classList.contains('sidebar-collapse')) {
		console.log("Not colapsed");
		document.getElementById('header').setAttribute('style', 'left: 350px;');
	} else {
		console.log("Colapsed");
		document.getElementById('header').setAttribute('style', 'left: 20px;');
	}
});

// -- End of Function when sidebar collapsed -- //

// select vehicle //
function selectVehicle(id) {
	currentStatusDisplay = id;
	var tr = document.getElementsByTagName('tr');
	for (var i = 0; i < tr.length; i++) {
		tr[i].style.background = "none";
	}

	document.getElementById("icon-vehicle-" + id).style.background = "rgba(0,0,0,.1)";

	var vehicleData = VehicleData_List.get(Number(id));
	console.log(vehicleData);

	document.getElementById('textbox-address').value = vehicleData.address;
	document.getElementById('textbox-baudrate').value = vehicleData.baudrate;

	if (vehicleData.isConnected) {
		document.getElementById('textbox-address').setAttribute("disabled", true);
		document.getElementById('textbox-baudrate').setAttribute("disabled", true);

		//toggle button connect/disconnect
		document.getElementById('btn-disconnect').style.display = "block";
		document.getElementById('btn-connect').style.display = "none";

		//toggle status connect/disconnect
		document.getElementById("status-connect").style.display = "block";
		document.getElementById("status-disconnect").style.display = "none";

		//toggle button delete
		document.getElementById("delete-vehicle").style.display = "none";
	} else {
		document.getElementById('textbox-address').removeAttribute("disabled");
		document.getElementById('textbox-baudrate').removeAttribute("disabled");

		//toggle button connect/disconnect
		document.getElementById('btn-connect').style.display = "block";
		document.getElementById('btn-disconnect').style.display = "none";

		//toggle status connect/disconnect
		document.getElementById("status-disconnect").style.display = "block";
		document.getElementById("status-connect").style.display = "none";

		//toggle button delete
		document.getElementById("delete-vehicle").style.display = "block";
	}

	$('#uavid').html('<span id="uavid" class="badge r-2 badge-success">STATUS UAVID : ' + currentStatusDisplay + '</span>');
	// if(globmsg != null){
	//   if(globmsg.id == currentStatusDisplay){
	//	 $('#header-alt').html('<strong id="header-alt" style="color: #000;">' + globmsg.alt +' m</strong>');
	//	 $('#header-vspeed').html('<strong id="header-alt" style="color: #000;">' + globmsg.vspeed +'</strong>');
	//	 $('#header-gspeed').html('<strong id="header-alt" style="color: #000;">' + globmsg.gspeed.toFixed(3) +'</strong>');
	//	 $('#header-yaw').html('<strong id="header-alt" style="color: #000;">' + globmsg.heading +'</strong>');
	//   } else{
	//	 $('#header-alt').html('<strong id="header-alt" style="color: #000;">NAN m</strong>');
	//	 $('#header-vspeed').html('<strong id="header-alt" style="color: #000;">NAN</strong>');
	//	 $('#header-gspeed').html('<strong id="header-alt" style="color: #000;">NAN</strong>');
	//	 $('#header-yaw').html('<strong id="header-alt" style="color: #000;">NAN</strong>');
	//   }
	// }
	console.log("currentStatusDisplay " + currentStatusDisplay);
}
// end select vehicle //

// Delete vehicle //
$('#delete-vehicle').on('click', function() {
	if (currentStatusDisplay != 0) {
		var tempVehicleData = VehicleData_List.get(currentStatusDisplay);
		for (var i = 0; i < color_List.length; i++) {
			if (color_List[i].color == tempVehicleData.vehicleColor) {
				color_List[i].taken = false;
			}
		}
		VehicleData_List.delete(currentStatusDisplay);

		var p3 = document.getElementById("icon-vehicle-" + currentStatusDisplay);
		p3.parentNode.removeChild(p3);
		while (!VehicleData_List.get(currentStatusDisplay)) {
			currentStatusDisplay--;
		}
		selectVehicle(currentStatusDisplay);
		TransferData();
		//VehicleOverlay_List.delete(currentStatusDisplay);  
	}
});
//end delete vehicle//

// -- Global msg -- //

var last_lon = null;
var last_lat = null;
var source = new EventSource('/api/sse/state');
var timer_point = 0;
source.onmessage = function(event) {
	// console.log(event.data);
	var msg = JSON.parse(event.data);
	if (!globmsg) {
		console.log('FIRST', msg);
		$('body').removeClass('disabled');
		//map.getView().setCenter(ol.proj.transform([msg.lon, msg.lat], 'EPSG:4326', 'EPSG:3857'));
	}
	globmsg = msg;
	var CurrentOverlay = VehicleOverlay_List.get(msg.id);
	CurrentOverlay.setPosition(ol.proj.transform([msg.lon, msg.lat], 'EPSG:4326', 'EPSG:3857'));
	$(CurrentOverlay.getElement()).find('.heading').css('-webkit-transform', 'rotate(' + ((msg.heading) + 45) + 'deg)');
	if (msg.id == currentStatusDisplay) {
        console.log(msg);
        if(msg.lon != last_lon || msg.lat != last_lat){
            timer_point++;
            if(timer_point%10 == 0){
                last_lon = msg.lon;
                last_lat = msg.lat;
                addTrackPath([msg.lon, msg.lat]);
                timer_point=0;    
            }
        }
		if (document.getElementById('toggle-centermap').checked) {
			map.getView().setCenter(ol.proj.transform([msg.lon, msg.lat], 'EPSG:4326', 'EPSG:3857'));
		}
		$('#header-alt').html('<strong id="header-alt" style="color: #000;">' + msg.alt + ' m</strong>');
		$('#header-vspeed').html('<strong id="header-alt" style="color: #000;">' + msg.vspeed.toFixed(3) + '</strong>');
		$('#header-gspeed').html('<strong id="header-alt" style="color: #000;">' + msg.gspeed.toFixed(3) + '</strong>');
		$('#header-yaw').html('<strong id="header-alt" style="color: #000;">' + msg.heading + '</strong>');
	}
	// else{
	//   $('#header-alt').html('<strong id="header-alt" style="color: #000;">NAN m</strong>');
	//   $('#header-vspeed').html('<strong id="header-alt" style="color: #000;">NAN</strong>');
	//   $('#header-gspeed').html('<strong id="header-alt" style="color: #000;">NAN</strong>');
	//   $('#header-yaw').html('<strong id="header-alt" style="color: #000;">NAN</strong>');
	// }
};

// -- End of Global Message -- //