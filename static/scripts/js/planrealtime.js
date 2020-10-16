var transform = ol.proj.getTransform('EPSG:3857', 'EPSG:4326');
var PointerInteraction = ol.interaction.Pointer;

// -- Global Variable -- //

var VehicleData_List = new Map();
var currentStatusDisplay = 0;

var HomePoint_List = new Map();
var Overlay_HomePoint_List = new Map();

var WayPoint_List = new Map();
var Overlay_WayPoint_List = new Map();

var Mission_List = new Map();

var VehicleOverlay_List = new Map();

var lastPointID = 1;
var lastHomeID = 0;

var draw_line = {
	active: false,
	new: false,
	onMarker: false
}

var Global_HomePointIndex;
var globmsg;

var drawMission = false;
var setHomeEvent = false;
var toggleDragging = false;


// -- End of Global Variable -- //

var missionvectorLineSource = new ol.source.Vector({});
var missionvectorLineStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: '#00FF00',
    weight: 4
  }),
  stroke: new ol.style.Stroke({
    color: '#00FF00',
    width: 2
  })
});

var missionvectorLineLayer = new ol.layer.Vector({
	source: missionvectorLineSource,
	style: missionvectorLineStyle
});


// -- Arrow Layer

var style_Arrow = [];
// var source_Arrow = new ol.source.Vector({});
// var arrow_VectorLayer = new ol.layer.Vector({
// 	source: missionvectorLineSource,
// 	style: style_Arrow
// });

// -- Using point track layer
const features_Track = [];
features_Track.push(new ol.Feature({
	geometry: new ol.geom.Point(convertFromLongLat(149.16460762750856,-35.36386907794211))
}));

const source_Arrow = new ol.source.Vector({});
source_Arrow.addFeatures(features_Track);
const arrow_VectorLayer = new ol.layer.Vector({
	source: source_Arrow,
	style: style_Arrow
    // style: new ol.style.Style({
    // 	image: new ol.style.Circle({
    //         radius: 2,
    //         fill: new ol.style.Fill({color: 'yellow'})
    //     })
    // })
});

function generateStyleArrow(){
  console.log("generateStyleArrow called");

	Mission_List.forEach(function (items, key) {
		console.log("KEY : " + key);
    var missionPoints_ = [];

    // console.log("DATA BEGIN");
    items.forEach(function (data){
      if (data[0] == "HOME") {
        missionPoints_.push([HomePoint_List.get(Number(data[1]))[0], HomePoint_List.get(Number(data[1]))[1]]);
      } else {
        missionPoints_.push([WayPoint_List.get(Number(data[1]))[0], WayPoint_List.get(Number(data[1]))[1]]);
      }
    });

    console.table(missionPoints_);
    
    for(var i=1; i<missionPoints_.length; i++){
      var start = convertFromLongLat(missionPoints_[i-1][0], missionPoints_[i-1][1]);
      var end   = convertFromLongLat(missionPoints_[i][0], missionPoints_[i][1]);
      console.log(start);
	  console.log(end);
	  
	  x1 = start[0];
	  y1 = start[1];
	  
	  x2 = end[0];
	  y2 = end[1];

	  mid = [(x1 + x2)/2,(y1 + y2)/2];

      var dx = end[0] - start[0];
      var dy = end[1] - start[1];
      console.log(`dx :${dx}`);
      console.log(`dy :${dy}`);
      var rotation = Math.atan2(dy, dx);
      // arrows
      style_Arrow.push(
        new ol.style.Style({
          geometry: new ol.geom.Point(mid),
          image: new ol.style.Icon({
            src: 'static/images/arrow.png',
            anchor: [0.75, 0.5],
            rotateWithView: true,
            rotation: -rotation,
          }),
        })
      );
	}
	arrow_VectorLayer.setStyle(style_Arrow);
    // console.log("DATA END")
  });
};

// -- End Arrow Layer

// -- TRANSFORM FUNCTION -- //

function convertToLonLat(x, y) {
	return ol.proj.transform([x, y], 'EPSG:3857', 'EPSG:4326');
}

function convertFromLongLat(long, lat) {
	return ol.proj.transform([long, lat], 'EPSG:4326', 'EPSG:3857')
}

// -- TRANSFORM FUNCTION -- //

// -- Map Mouse Event -- //

var Drag = (function (PointerInteraction) {
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

	var feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
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
		var feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
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

		// Draw Line

		if (draw_line.active && draw_line.new == false && draw_line.onMarker == false) {
			Mission_List.get(Number(Global_HomePointIndex)).push(["TEMP", lon, lat]);
			UpdateLine();
			Mission_List.get(Number(Global_HomePointIndex)).pop();
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
	// return;
	// vehicle_dataList 
	var vehicle_data = [];
	VehicleData_List.forEach(function(items, key) {
		vehicle_data.push(items);
	});

	$.ajax({
        method: 'POST',
        url: '/api/update_data',
        contentType: 'application/json',
        data: JSON.stringify({
            type: "vehicle_dataList",
            data: vehicle_data
        }),
	}).done(function(msg) {
		console.log("Transfer data:");
		console.table(vehicle_data);
	});

	// HomePoint
	var homepoint_data = [];
	HomePoint_List.forEach(function (items, key){
		var temp = {id:key,lon:items[0],lat:items[1]};
		homepoint_data.push(temp);
	});

	$.ajax({
		method: 'POST',
		url: '/api/update_data',
		contentType: 'application/json',
		data: JSON.stringify({
			type: "homepoint_list",
			data: homepoint_data
		}),
	})
	.done(function (msg) {
		console.log("Transfer data:");
		console.table(homepoint_data);
	});

	// Waypoint
	var waypoint_data = [];
	WayPoint_List.forEach(function (items, key){
		var temp = {id:key,lon:items[0],lat:items[1]};
		waypoint_data.push(temp);
	});

	$.ajax({
		method: 'POST',
		url: '/api/update_data',
		contentType: 'application/json',
		data: JSON.stringify({
			type: "waypoint_list",
			data: waypoint_data
		}),
	})
	.done(function (msg) {
		console.log("Transfer data:");
		console.table(waypoint_data);
	});

	// Mission_List
	var mission_list_data = [];
	Mission_List.forEach(function (items, key){
		var temp = {id:key,value:items};
		mission_list_data.push(temp);
	});

	$.ajax({
		method: 'POST',
		url: '/api/update_data',
		contentType: 'application/json',
		data: JSON.stringify({
			type: "mission_list",
			data: mission_list_data
		}),
	})
	.done(function (msg) {
		console.log("Transfer data:");
		console.table(mission_list_data);
	});
}

var Page = document.getElementById("html_page");
Page.addEventListener("keyup", function(event) {
  	if (event.keyCode === 68) {
		event.preventDefault();
		// TransferData();
		$.ajax({
			method: 'POST',
			url: '/api/debug_test',
			contentType: 'application/json',
			data: JSON.stringify({
				id: currentStatusDisplay
			}),
		})
		.done(function (msg){
			console.log("Upload mission from file:");
			console.table(msg);
		});
  	}
});

// -- End Transfer Data To engine.py

// -- Get Data from engine.py

function GetData() {
	// Get vehicle_dataList
	$.ajax({
		method: 'PUT',
		url: '/api/get_data',
		contentType: 'application/json',
		data: JSON.stringify({
			request:"vehicle_dataList",
			data: null
		}),
	})
	.done(function (msg) {
		console.log("Get Data:");
		// console.log(msg);
		var Selected = false;
		for (var i = 0; i < msg.data.length; i++) {
			console.log(msg.data[i]);
			VehicleData_List.set(msg.data[i].key, msg.data[i]);
			addVehicle(msg.data[i].key, msg.data[i].vehicleColor);
            if (msg.data[i].isConnected) { // Has overlay
                addVehicleOverlay([0, 0], msg.data[i].key);
				selectVehicle(msg.data[i].key);
				Selected = true;
            }
		}

		if(msg.data.length>0 && !Selected){
			selectVehicle(msg.data[0].key);
		}
	});

	// Get homepoint_list
	$.ajax({
		method: 'PUT',
		url: '/api/get_data',
		contentType: 'application/json',
		data: JSON.stringify({
			request:"homepoint_list",
			data: null
		}),
	})
	.done(function (msg) {
		console.log("Get Data:");
		// console.log(msg);
		for (var i = 0; i < msg.data.length; i++) {
			console.log(msg.data[i]);
			HomePoint_List.set(msg.data[i].id, [msg.data[i].lon, msg.data[i].lat]);
			addHomePointOverlay([msg.data[i].lon, msg.data[i].lat], msg.data[i].id, true);
		}
	});

	// Get waypoint_list
	$.ajax({
		method: 'PUT',
		url: '/api/get_data',
		contentType: 'application/json',
		data: JSON.stringify({
			request:"waypoint_list",
			data: null
		}),
	})
	.done(function (msg) {
		console.log("Get Data:");
		// console.log(msg);
		for (var i = 0; i < msg.data.length; i++) {
			console.log(msg.data[i]);
			WayPoint_List.set(msg.data[i].id, [msg.data[i].lon, msg.data[i].lat]);
			addWayPointOverlay([msg.data[i].lon, msg.data[i].lat], msg.data[i].id, true);
		}
	});

	// Get mission_list
	$.ajax({
		method: 'PUT',
		url: '/api/get_data',
		contentType: 'application/json',
		data: JSON.stringify({
			request:"mission_list",
			data: null
		}),
	})
	.done(function (msg) {
		console.log("Get Data:");
		// console.log(msg);
		for (var i = 0; i < msg.data.length; i++) {
			console.log(msg.data[i]);
			Mission_List.set(msg.data[i].id, msg.data[i].value);
		}
		UpdateLine();
		style_Arrow = [];
		generateStyleArrow();
	});
}

// -- End Get Data from engine.py

// -- THE MAP -- //
// Raster = BingMap
var raster = new ol.layer.Tile({
	source: new ol.source.BingMaps({
		key: 'AnGHr16zmRWug0WA8mJKrMg5g6W4GejzGPBdP-wQ4Gqqw-yHNqsHmYPYh1VUOR1q',
		imagerySet: 'AerialWithLabels',
		// imagerySet: 'Road',
	})
});

var map = new ol.Map({
	interactions: ol.interaction.defaults().extend([new Drag()]),
	target: 'map',
	renderer: 'canvas', // Force the renderer to be used
	layers: [raster, missionvectorLineLayer, arrow_VectorLayer],
	view: new ol.View({
		center: ol.proj.transform([112.79758155388635, -7.2772675487336045], 'EPSG:4326', 'EPSG:3857'),
		zoom: 18
	})
});

// -- END OF THE MAP -- //

// -- UPDATE DRAW LINE FUNCTION -- //

function UpdateLine() {
	missionvectorLineSource.clear();

	Mission_List.forEach(function (items, key) {
		// console.log("KEY : " + key);
		var missionPoints_ = [];

		// console.log("DATA BEGIN");
		items.forEach(function (data) {
			if (data[0] == "HOME") {
				missionPoints_.push([HomePoint_List.get(Number(data[1]))[0], HomePoint_List.get(Number(data[1]))[1]]);
			} else if (data[0] == "POINT") {
				missionPoints_.push([WayPoint_List.get(Number(data[1]))[0], WayPoint_List.get(Number(data[1]))[1]]);
			} else if (data[0] == "TEMP") {
				missionPoints_.push([data[1], data[2]]);
			}
		});
		// console.log("DATA END");

		for (var k = 0; k < missionPoints_.length; k++) {
			missionPoints_[k] = ol.proj.transform(missionPoints_[k], 'EPSG:4326', 'EPSG:3857');
		}

		var missionfeatureLine = new ol.Feature({
			geometry: new ol.geom.LineString(missionPoints_)
		});

    missionvectorLineSource.addFeature(missionfeatureLine);
    
	});

	// missionList.forEach(function(mission){
	//   var missionPoints_ = [];
	//   mission.foreach(function(item){
	//     missionPoints_.push(convertFromLongLat([item[0], item[1]]));
	//   });

	//   var missionfeatureLine = new ol.Feature({
	//     geometry: new ol.geom.LineString(missionPoints_)
	//   });

	//   missionvectorLineSource.addFeature(missionfeatureLine);
	// });
}

// -- END OF UPDATE  DRAW LINE FUNCTION -- //

// -- Add Mission Row -- //

function addMissionRow(lon, lat, id, type) {
	var listCommand = `
	<select name="commandList" id="commandList" style="border:none; width:100%;">
		<option value="16" selected="">WAYPOINT</option>
		<option value="82" >SPLINE_WAYPOINT</option>
		<option value="18" >LOITER_TURNS</option>
		<option value="19" >LOITER_TIME</option>
		<option value="17" >LOITER_UNLIM</option>
		<option value="20" >RETURN_TO_LAUNCH</option>
		<option value="21" >LAND</option>
		<option value="22" >TAKEOFF</option>
		<option value="93" >DELAY</option>
		<option value="92" >GUIDED_ENABLE</option>
		<option value="94" >PAYLOAD_PLACE</option>
		<option value="222" >DO_GUIDED_LIMITS</option>
		<option value="42600" >DO_WINCH</option>
		<option value="201" >DO_SET_ROI</option>
		<option value="112" >CONDITION_DELAY</option>
		<option value="113" >CONDITION_CHANGE_ALT</option>
		<option value="114" >CONDITION_DISTANCE</option>
		<option value="115" >CONDITION_YAW</option>
		<option value="177" >DO_JUMP</option>
		<option value="178" >DO_CHANGE_SPEED</option>
		<option value="211" >DO_GRIPPER</option>
		<option value="208" >DO_PARACHUTE</option>
		<option value="206" >DO_SET_CAM_TRIGG_DIST</option>
		<option value="181" >DO_SET_RELAY</option>
		<option value="183" >DO_SET_SERVO</option>
		<option value="184" >DO_REPEAT_SERVO</option>
		<option value="202" >DO_DIGICAM_CONFIGURE</option>
		<option value="203" >DO_DIGICAM_CONTROL</option>
		<option value="205" >DO_MOUNT_CONTROL</option>
	</select>
	`;

	$("#tbody-mission-list").append(
		`<tr>
            <td>` + id + `</td>
            <td class="id">` + listCommand + `</td>
            <td><input type="text" id="textbox-lon-` + id + `" style="border:none; width:100%;" disabled="true" value="` + lon + `"/></td>
            <td><input type="text" id="textbox-lat-` + id + `" style="border:none; width:100%;" disabled="true" value="` + lat + `"/></td>
            <td>-</td>
            <td>0.00</td>
            <td>-</td>
            <td>
                <button type="button" class="btn btn-default btn-sm" id="btnEdit" data-toggle="modal" data-target="#exampleModal">
                    <i class="icon-plus"></i>
                </button>
                <button type="button" class="btn btn-warning btn-sm" id="btnEdit" data-toggle="modal" data-target="#exampleModal">
                    <i class="icon-pencil"></i>
                </button>
                <button type="button" class="btn btn-danger btn-sm" id="btnDelete" data-toggle="modal" data-target="#exampleModal">
                    <i class="icon-trash"></i>
                </button>
            </td>
        </tr>`
	);
}

// -- End of Add Mission Row -- //

// Begin Update Flight Table

function UpdateFlightTable(id){
	console.log(Mission_List);
	document.getElementById("tbody-mission-list").innerHTML = `
	<tr>
	  <th>#</th>
	  <th>Command</th>
	  <th width="210px">Lon</th>
	  <th width="210px">Lat</th>
	  <th>Alt</th>
	  <th>Angle</th>
	  <th>Dist</th>
	  <th width="210px">Aksi</th>
	</tr>
	`;
	  Mission_List.forEach(function (items, key) {
		  if (key == id) {
			  // console.log("DATA BEGIN");
			  counter = 1;
			  items.forEach(function (data) {
				  if (data[0] == "HOME") {
					  addMissionRow(HomePoint_List.get(Number(data[1]))[0], HomePoint_List.get(Number(data[1]))[1], counter, 1);
				  } else {
					  addMissionRow(WayPoint_List.get(Number(data[1]))[0], WayPoint_List.get(Number(data[1]))[1], counter, 2);
				  }
				  counter++;
			  });
			  // console.log("DATA END")  
		  }
	  });
}

// End Update Flight Table

// -- PUSH PointLayer source -- //

function addWayPointOverlay(coordinate, id, fromGet=false) {
	var lon = coordinate[0];
	var lat = coordinate[1];

	var MarkerOverlayContent = document.createElement('div');
	MarkerOverlayContent.classList.add("marker");
	MarkerOverlayContent.setAttribute("data-point-id", lastPointID);
	MarkerOverlayContent.innerHTML = '<span><b>' + lastPointID + '</b></span>';

	WayPoint_List.set(lastPointID, [lon, lat]);
	if(!fromGet) TransferData();

	var MarkerOverlay = new ol.Overlay({
		element: MarkerOverlayContent,
		position: ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'),
		positioning: 'center-center'
	});

	Overlay_WayPoint_List.set(id, MarkerOverlay);
	map.addOverlay(Overlay_WayPoint_List.get(Number(id)));

	MarkerOverlayContent.addEventListener('mousedown', function (evt) {
		var thisPointID = this.getAttribute("data-point-id");

		if (draw_line.active) {
			if (draw_line.new) {
				alert("This is not Home Point, Try Again!");
			} else {
				Mission_List.get(Number(Global_HomePointIndex)).push(["POINT", thisPointID, null]);
				UpdateLine();
				UpdateFlightTable(currentStatusDisplay);
				style_Arrow = [];
				generateStyleArrow();
			}
		}

		function move(evt) {
			if (toggleDragging) { // Enable draging
				var convertedCoordinate = convertToLonLat(map.getEventCoordinate(evt)[0], map.getEventCoordinate(evt)[1]);
				Overlay_WayPoint_List.get(Number(id)).setPosition(map.getEventCoordinate(evt));
				WayPoint_List.set(Number(thisPointID), convertedCoordinate);
				if(!fromGet) TransferData();
				UpdateLine();
				console.log("Move Point");
				style_Arrow = [];
				generateStyleArrow();
			}
		}

		function end(evt) {
			window.removeEventListener('mousemove', move);
			window.removeEventListener('mouseup', end);
		}
		window.addEventListener('mousemove', move);
		window.addEventListener('mouseup', end);
	});

	MarkerOverlayContent.addEventListener('mouseenter', function (evt) {
		draw_line.onMarker = true;
		if (draw_line.active) {
			var converted = convertToLonLat(Overlay_WayPoint_List.get(Number(id)).getPosition()[0], Overlay_WayPoint_List.get(Number(id)).getPosition()[1]);
			console.log(converted);
			Mission_List.get(Number(Global_HomePointIndex)).push(["TEMP", converted[0], converted[1]]);
			UpdateLine();
			Mission_List.get(Number(Global_HomePointIndex)).pop();
		}
	});

	MarkerOverlayContent.addEventListener('mouseleave', function (evt) {
		draw_line.onMarker = false;
	});

	lastPointID++;
	console.log("done");
}

// -- END OF PUSH PointLayer source -- //

// -- PUSH Home Point Overlay -- //

function addHomePointOverlay(coordinate, id, fromGet=false) {
	var lon = coordinate[0];
	var lat = coordinate[1];
	
	var tempVehicleData = VehicleData_List.get(id);
	VehicleData_List.set(id, {key:id, vehicleColor:tempVehicleData.vehicleColor, address:tempVehicleData.address, baudrate:tempVehicleData.baudrate, isConnected:tempVehicleData.isConnected, home:[lon,lat], missionList:[]});
	TransferData();

	var MarkerOverlayContent = document.createElement('div');
	MarkerOverlayContent.classList.add("marker");
	MarkerOverlayContent.setAttribute("data-home-id", id);
	MarkerOverlayContent.innerHTML = '<span style="background: ' + VehicleData_List.get(id).vehicleColor + ';"><b>H</b></span>';

	var MarkerOverlay = new ol.Overlay({
		element: MarkerOverlayContent,
		position: ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'),
		positioning: 'center-center'
	});

	HomePoint_List.set(id, [lon, lat]);
	if(!fromGet) TransferData();

	Overlay_HomePoint_List.set(id, MarkerOverlay);
	map.addOverlay(Overlay_HomePoint_List.get(Number(id)));

	MarkerOverlayContent.addEventListener('mousedown', function (evt) {
		var thisPointID = this.getAttribute("data-home-id");
		console.log("Home clicked");
		console.log("data-home-id : " + thisPointID);

		if (draw_line.active){
			if (draw_line.new){
				Global_HomePointIndex = thisPointID;
				console.log(thisPointID);
				Mission_List.set(Number(thisPointID), []);
				Mission_List.get(Number(thisPointID)).push(["HOME", thisPointID, null]);
				draw_line.new = false;
			} else {
				Mission_List.get(Number(thisPointID)).push(["HOME", thisPointID, null]);
				draw_line.active = false;
		        draw_line.new = false;
				$('#btn-toggle-draw').click();
				Global_HomePointIndex = null;
				UpdateLine();
				UpdateFlightTable(currentStatusDisplay);
				// Finish drawing line
				style_Arrow = [];
				generateStyleArrow();
			}
		}

		function move(evt) {
			if (toggleDragging) { // Enable dragging
				var convertedCoordinate = convertToLonLat(map.getEventCoordinate(evt)[0], map.getEventCoordinate(evt)[1]);
				Overlay_HomePoint_List.get(Number(id)).setPosition(map.getEventCoordinate(evt));
				HomePoint_List.set(Number(thisPointID), convertedCoordinate);
				if(!fromGet) TransferData();
				UpdateLine();
				style_Arrow = [];
				generateStyleArrow();
      		}
		}

		function end(evt) {
			window.removeEventListener('mousemove', move);
			window.removeEventListener('mouseup', end);
		}
		window.addEventListener('mousemove', move);
		window.addEventListener('mouseup', end);
	});

	MarkerOverlayContent.addEventListener('mouseenter', function (evt) {
		draw_line.onMarker = true;
		if (draw_line.active) {
			var converted = convertToLonLat(Overlay_HomePoint_List.get(Number(id)).getPosition()[0], Overlay_HomePoint_List.get(Number(id)).getPosition()[1]);
			if (Global_HomePointIndex) {
				Mission_List.get(Number(Global_HomePointIndex)).push(["TEMP", converted[0], converted[1]]);
				UpdateLine();
				Mission_List.get(Number(Global_HomePointIndex)).pop();
			}
		}
	});

	MarkerOverlayContent.addEventListener('mouseleave', function (evt) {
		draw_line.onMarker = false;
	});

	toggleActive("", true);
	document.getElementById("btn-set-home").setAttribute("disabled", true);
	setHomeEvent = false;
	lastHomeID++;
}

// -- END OF PUSH Home Point Overlay -- //

// -- Enable Togle -- //

$('#btn-toggle-marker').on('click', function () {
	var toggleactive = this.getAttribute("data-toggle");
	if (toggleactive == "on") {
		toggleActive("btn-toggle-marker", true);
		drawMission = false;
		this.setAttribute("data-toggle", "off");
		this.style.opacity = 0.7;
	} else {
		toggleActive("btn-toggle-marker", false);
		drawMission = true;
		this.setAttribute("data-toggle", "on");
		this.style.opacity = 1;
	}
});

// -- End of Enable Togle -- //

// -- Set Home -- //

$('#btn-set-home').on('click', function () {
	var toggleactive = this.getAttribute("data-toggle");
	if (toggleactive == "on") {
		toggleActive("btn-set-home", true);
		setHomeEvent = false;
		this.setAttribute("data-toggle", "off");
		this.style.opacity = 0.7;
	}else{
		toggleActive("btn-set-home", false);
		setHomeEvent = true;
		this.setAttribute("data-toggle", "on");
		this.style.opacity = 1;
	}
});

// -- End of Set Home -- //

// -- Toggle Draw -- //

$('#btn-toggle-draw').on('click', function () {
	var toggleactive = this.getAttribute("data-toggle");
	if (toggleactive == "on") {
		toggleActive("btn-toggle-draw", true);
		UpdateLine();
		draw_line.active = false;
		draw_line.new = false;
		this.setAttribute("data-toggle", "off");
		this.style.opacity = 0.7;
	} else {
		toggleActive("btn-toggle-draw", false);
		// alert("Please select Home Point first");
		draw_line.active = true;
		draw_line.new = true;
		this.setAttribute("data-toggle", "on");
		this.style.opacity = 1;
	}
});

// -- End of Toggle Draw -- //

// -- Enable Togle Drag -- //

$('#btn-toggle-drag').on('click', function () {
	var toggleactive = this.getAttribute("data-toggle");
	if (toggleactive == "on") {
		toggleActive("btn-toggle-drag", true);
		toggleDragging = false;
		this.setAttribute("data-toggle", "off");
		this.style.opacity = 0.7;
	} else {
		toggleActive("btn-toggle-drag", false);
		toggleDragging = true;
		this.setAttribute("data-toggle", "on");
		this.style.opacity = 1;
	}
});

// -- End of Enable Togle Drag -- //

// -- Enable Togle Hide Overlay -- //

function hideVehicleOverlay(hide){
	var vehicleOverlays = document.getElementsByClassName("vehicleOverlay");
	for (var i = 0; i < vehicleOverlays.length; i++) {
		if(hide){
			vehicleOverlays.item(i).style.display = "none";
		}else{
			vehicleOverlays.item(i).style.display = "block";
		}
	}	
}

$('#btn-toggle-hide-overlay').on('click', function () {
	var toggleactive = this.getAttribute("data-toggle");
	if (toggleactive == "on") {
		// toggleActive("btn-toggle-hide-overlay", true);
		// toggleHideOverlay = false;
		hideVehicleOverlay(false);
		this.setAttribute("data-toggle", "off");
		this.style.opacity = 0.7;
	} else {
		// toggleActive("btn-toggle-hide-overlay", false);
		// toggleHideOverlay = true;
		hideVehicleOverlay(true);
		this.setAttribute("data-toggle", "on");
		this.style.opacity = 1;
	}
});

// -- End of Enable Togle Hide Overlay -- //

// Begin of selectVehicle()

var pendingHomePoint = true;
function selectVehicle(id) {
	console.log("Select vehicle : " + id);
	toggleActive("", true);
	if(VehicleData_List.get(id).home.length == 0){
		if(VehicleData_List.get(id).isConnected){
			alert("Vehicle sudah terhubung, home point adalah lokasi vehicle saat ini");
			$('#btn-set-home').click();
			if(globmsg){
				addHomePointOverlay([globmsg.lon, globmsg.lat], id);
			}else{
				pendingHomePoint = true;
			}
		}else{
			alert("Vehicle belum terhubung, set home point secara manual");
			$('#btn-set-home').click();	
		}
	}
	currentStatusDisplay = id;

	var tr = document.getElementsByTagName('tr');
	for (var i = 0; i < tr.length; i++) {
		tr[i].style.background = "none";
	}

	document.getElementById("icon-vehicle-" + id).style.background = "rgba(0,0,0,.1)";

	if (VehicleData_List.get(id).home.length == 0) {
		// alert("This vehicle has no home point, please set home point");
		document.getElementById("btn-set-home").removeAttribute("disabled");
		document.getElementById("btn-set-home").setAttribute("data-toggle", "off");
	}else{
	    document.getElementById("btn-set-home").setAttribute("disabled", true);
	}
	UpdateFlightTable(id);
}

// End of selectVehicle()

// Begin of addVehicle()

function addVehicle(id, color) {
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

// Begin of enable/disableElement

function toggleActive(element, enableAll){
	var elementID = ["btn-toggle-marker", "btn-toggle-draw", "btn-toggle-drag", "btn-upload", "btn-save", "btn-autowp" ];
	elementID.forEach(item => {
		if(enableAll){
			document.getElementById(item).removeAttribute("disabled");
		}else{
			if(item != element){
				document.getElementById(item).setAttribute("disabled", true);
			}	
		}
	});
}

// End of enable/disableElement

// Begin generate mission text
function createMission() {
    var text = "QGC WPL 110\n";
    // HOME POINT
    var lon = HomePoint_List.get(currentStatusDisplay)[0];
    var lat = HomePoint_List.get(currentStatusDisplay)[1];
	text += "0\t1\t0\t16\t0\t0\t0\t0\t"+lat+"\t"+lon+"\t583.989990\t1\n";
	
	var missionPoints_ = []
	var MissionListSelectedVehicle = Mission_List.get(currentStatusDisplay);
	for(var i=0; i<MissionListSelectedVehicle.length; i++){
		data = MissionListSelectedVehicle[i];
		if(data[0] == "HOME"){
			// missionPoints_.push([HomePoint_List.get(Number(data[1]))[0], HomePoint_List.get(Number(data[1]))[1]]);
		}else{
			missionPoints_.push([WayPoint_List.get(Number(data[1]))[0], WayPoint_List.get(Number(data[1]))[1]]);
		}
	}

    var index = 1;
    missionPoints_.forEach(element => {
        console.log(element[0]); // Longitude
        console.log(element[1]); // Latitude
        text += index + "\t0\t3\t16\t0.00000000\t0.00000000\t0.00000000\t0.00000000\t" + element[1] + "\t" + element[0] + "\t100.000000\t1\n";
        index++;
    });
    return text;
}

// End generate mission text

// Begin save mission

$('#btn-save').on('click', function () {
	var text = createMission();

	var element = document.createElement('a');
	var file = new Blob([text], {
	  type: 'text/json'
	});
	element.href = URL.createObjectURL(file);
	element.download = "waypoints.txt";
  
	element.style.display = 'none';
	document.body.appendChild(element);
  
	element.click();
  
	document.body.removeChild(element);
});

// End save mission

// Begin upload mission

$('#btn-upload').on('click', function () {
	var text = createMission();
	$.ajax({
        method: 'POST',
        url: '/api/upload_mission',
        contentType: 'application/json',
        data: JSON.stringify({
            id: currentStatusDisplay,
            mission_text: text
        }),
	}).done(function(msg) {
		console.log("Upload mission:");
		console.log(msg);
		alert(msg);
	});
});

// End upload mission

// Begin of addVehicleOverlay
// -- Function : Add Vehicle Overlay -- //

function addVehicleOverlay(coordinate, id) {
	var lon = coordinate[0],
		lat = coordinate[1];

	var Vehicle_Element = document.createElement('div');
	Vehicle_Element.classList.add("vehicleOverlay");

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

// -- Global msg -- //

var done = false;
var source = new EventSource('/api/sse/state');
source.onmessage = function(event) {
	// console.log(event.data);
	var msg = JSON.parse(event.data);
	if (!globmsg) {
		console.log('FIRST', msg);
		$('body').removeClass('disabled');
		//map.getView().setCenter(ol.proj.transform([msg.lon, msg.lat], 'EPSG:4326', 'EPSG:3857'));
	}
	globmsg = msg;
	if(pendingHomePoint){
		addHomePointOverlay([globmsg.lon, globmsg.lat], currentStatusDisplay);
		pendingHomePoint = false;
	}
	var CurrentOverlay = VehicleOverlay_List.get(msg.id);
	CurrentOverlay.setPosition(ol.proj.transform([msg.lon, msg.lat], 'EPSG:4326', 'EPSG:3857'));
	$(CurrentOverlay.getElement()).find('.heading').css('-webkit-transform', 'rotate(' + ((msg.heading) + 45) + 'deg)');
	if (msg.id == currentStatusDisplay) {
        console.log(msg);
		if (!done){
			map.getView().setCenter(ol.proj.transform([msg.lon, msg.lat], 'EPSG:4326', 'EPSG:3857'));
			done = true;
		}
	}
};

map.on('click', function (evt) {
	var coords = ol.proj.toLonLat(evt.coordinate);

	var lat = coords[1];
	var lon = coords[0];

	if (setHomeEvent == true) {
		console.log([lon, lat]);
		addHomePointOverlay([lon, lat], currentStatusDisplay);
		TransferData();
	}

	if (drawMission == true) {
		console.log([lon, lat]);
		addWayPointOverlay([lon, lat], lastPointID);
		TransferData();
	}
});