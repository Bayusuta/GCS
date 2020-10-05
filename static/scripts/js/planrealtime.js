var transform = ol.proj.getTransform('EPSG:3857', 'EPSG:4326');
var PointerInteraction = ol.interaction.Pointer;

// -- Global Variable -- //

var VehicleData_List = new Map();
var VehicleOverlay_List = new Map();

var lastVehicleID = 0;
var color_List = ["blue", "green", "red", "purple", "yellow"];
var currentStatusDisplay = 0;

var HomePoint_List = new Map();
var Overlay_HomePoint_List = new Map();

var WayPoint_List = new Map();
var Overlay_WayPoint_List = new Map();

var Mission_List = new Map();

var lastPointID = 1;
var lastHomeID = 0;

var draw_line = {active:false, new :false, onMarker:false}
var Global_HomePointIndex;

var drawMission = false;
var setHomeEvent = false;
var toggleDragging = false;

var globmsg = null;

// -- End of Global Variable -- //



var missionvectorLineSource = new ol.source.Vector({});
var missionvectorLineLayer = new ol.layer.Vector({
  source: missionvectorLineSource,
  style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: '#00FF00',
      weight: 4
    }),
    stroke: new ol.style.Stroke({
      color: '#00FF00',
      width: 2
    })
  })
});

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

  if ( PointerInteraction ) Drag.__proto__ = PointerInteraction;
  Drag.prototype = Object.create( PointerInteraction && PointerInteraction.prototype );
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

    if(draw_line.active && draw_line.new == false && draw_line.onMarker == false){
        Mission_List.get(Global_HomePointIndex).push(["TEMP", lon, lat]);
        UpdateLine();
        Mission_List.get(Global_HomePointIndex).pop();
    }
  }
}

function handleUpEvent() {
  this.coordinate_ = null;
  this.feature_ = null;
  return false;
}

// -- END OF Map Mouse Event -- //

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
  layers: [raster, missionvectorLineLayer],
  view: new ol.View({
    center: ol.proj.transform([112.79758155388635, -7.2772675487336045], 'EPSG:4326', 'EPSG:3857'),
    zoom: 18
  })
});

// -- END OF THE MAP -- //

// -- UPDATE DRAW LINE FUNCTION -- //

function UpdateLine(){
    missionvectorLineSource.clear();
  
    Mission_List.forEach(function(items, key){
      // console.log("KEY : " + key);
      var missionPoints_ = [];
  
      // console.log("DATA BEGIN");
      items.forEach(function(data){
        if(data[0] == "HOME"){
          missionPoints_.push([ HomePoint_List.get(Number(data[1]))[0], HomePoint_List.get(Number(data[1]))[1] ]);
        }else if(data[0] == "POINT"){
          missionPoints_.push([WayPoint_List.get(Number(data[1]))[0], WayPoint_List.get(Number(data[1]))[1]]);
        }else if(data[0] == "TEMP"){
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

function addMissionRow(lon, lat, id, type){
    var commandList="";
    if(type==1){
        var commandList = `<select name="commandList" id="commandList" style="border:none; width:100%;">
        <option selected="" value="1">Home Point</option>
        <option value="2">Way Point</option>
        <option value="3">Test 3</option>
        <option value="4">Test 4</option>
        </select>`;
    }else{
        var commandList = `<select name="commandList" id="commandList" style="border:none; width:100%;">
        <option value="1">Home Point</option>
        <option selected="" value="2">Way Point</option>
        <option value="3">Test 3</option>
        <option value="4">Test 4</option>
        </select>`;
    }

    $("#tbody-mission-list").append(
        `<tr>
            <td>`+id+`</td>
            <td class="id">`+commandList+`</td>
            <td><input type="text" id="textbox-lon-`+id+`" style="border:none; width:100%;" disabled="true" value="`+lon+`"/></td>
            <td><input type="text" id="textbox-lat-`+id+`" style="border:none; width:100%;" disabled="true" value="`+lat+`"/></td>
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

// -- PUSH PointLayer source -- //

function addWayPointOverlay(coordinate, id){
    var lon = coordinate[0];
    var lat = coordinate[1];

    var MarkerOverlayContent = document.createElement('div');
    MarkerOverlayContent.classList.add("marker");
    MarkerOverlayContent.setAttribute("data-point-id", lastPointID); 
    MarkerOverlayContent.innerHTML = '<span><b>'+lastPointID+'</b></span>';

    WayPoint_List.set(lastPointID, [lon,lat]);

    var MarkerOverlay = new ol.Overlay({
        element: MarkerOverlayContent,
        position: ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'),
        positioning: 'center-center'
    });

    Overlay_WayPoint_List.set(id, MarkerOverlay);
    map.addOverlay(Overlay_WayPoint_List.get(Number(id)));

    MarkerOverlayContent.addEventListener('mousedown', function(evt){
      var thisPointID = this.getAttribute("data-point-id");

      if(draw_line.active){
        if(draw_line.new){
          alert("This is not Home Point, Try Again!");
        }else{
          Mission_List.get(Global_HomePointIndex).push(["POINT", thisPointID, null]);
          UpdateLine();
        }
      }
      
      function move(evt){
        if (toggleDragging){ // Enable draging
          var convertedCoordinate = convertToLonLat(map.getEventCoordinate(evt)[0], map.getEventCoordinate(evt)[1]);
          Overlay_WayPoint_List.get(Number(id)).setPosition(map.getEventCoordinate(evt));
          WayPoint_List.set(Number(thisPointID), convertedCoordinate);
          UpdateLine();
        }
      }
      function end(evt) {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', end);
      }
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
    });

    MarkerOverlayContent.addEventListener('mouseenter', function(evt){
      draw_line.onMarker = true;
      if(draw_line.active){
        var converted = convertToLonLat(Overlay_WayPoint_List.get(Number(id)).getPosition()[0], Overlay_WayPoint_List.get(Number(id)).getPosition()[1]);
        console.log(converted);
        Mission_List.get(Global_HomePointIndex).push(["TEMP", converted[0], converted[1]]);
        UpdateLine();
        Mission_List.get(Global_HomePointIndex).pop();  
      }
    });

    MarkerOverlayContent.addEventListener('mouseleave', function(evt){
      draw_line.onMarker = false;
    });

    lastPointID++;
    console.log("done");
}

// -- END OF PUSH PointLayer source -- //

// -- PUSH Home Point Overlay -- //

function addHomePointOverlay(coordinate, id){
    var lon = coordinate[0];
    var lat = coordinate[1];

    var MarkerOverlayContent = document.createElement('div');
    MarkerOverlayContent.classList.add("marker");
    MarkerOverlayContent.setAttribute("data-point-id", lastPointID);
    MarkerOverlayContent.innerHTML = '<span style="background: '+color_List[HomePoint_List.size]+';"><b>H</b></span>';

    WayPoint_List.set(lastPointID, [lon,lat]);

    var MarkerOverlay = new ol.Overlay({
        element: MarkerOverlayContent,
        position: ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'),
        positioning: 'center-center'
    });

    HomePoint_List.set(id, [lon,lat]);
    Overlay_HomePoint_List.set(id, MarkerOverlay);
    map.addOverlay(Overlay_HomePoint_List.get(Number(id)));

    MarkerOverlayContent.addEventListener('mousedown', function(evt){
        console.log("Home clicked");
        var thisPointID = this.getAttribute("data-home-id");
            
        if(draw_line.active){
          if(draw_line.new){
            Global_HomePointIndex = thisPointID;
            Mission_List.set(thisPointID, []);
            Mission_List.get(thisPointID).push(["HOME",thisPointID,null]);
            draw_line.new = false;
          }else{
            Mission_List.get(thisPointID).push(["HOME",thisPointID,null]);
            draw_line.active = false;
            draw_line.new = false;
            $('#btn-toggle-draw').click();
            Global_HomePointIndex = null;    
            UpdateLine();
          }
        }
    
        function move(evt){
          if (toggleDragging){ // Enable dragging
            var convertedCoordinate = convertToLonLat(map.getEventCoordinate(evt)[0], map.getEventCoordinate(evt)[1]);
            Overlay_HomePoint_List.get(Number(id)).setPosition(map.getEventCoordinate(evt));
            HomePoint_List.set(Number(thisPointID), convertedCoordinate);
            UpdateLine();
          }
        }
        function end(evt) {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', end);
        }
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
    });
    
    MarkerOverlayContent.addEventListener('mouseenter', function(evt){
        draw_line.onMarker = true;
        if(draw_line.active){
          var converted = convertToLonLat(Overlay_HomePoint_List.get(Number(id)).getPosition()[0], Overlay_HomePoint_List.get(Number(id)).getPosition()[1]);
          if(Global_HomePointIndex){
            Mission_List.get(Global_HomePointIndex).push(["TEMP", converted[0], converted[1]]);
            UpdateLine();
            Mission_List.get(Global_HomePointIndex).pop();    
          }
        }
    });
    
    MarkerOverlayContent.addEventListener('mouseleave', function(evt){
        draw_line.onMarker = false;
    });

    document.getElementById("btn-set-home").setAttribute("disabled", true);
    setHomeEvent = false;
    lastHomeID++;
}

// -- END OF PUSH Home Point Overlay -- //

// -- Enable Togle -- //

$('#btn-toggle-marker').on('click', function() {
    var toggleactive = this.getAttribute("data-toggle");
    if(toggleactive == "on"){
        drawMission = false;
        this.setAttribute("data-toggle", "off");
        this.style.opacity = 0.7;
    }else{
        drawMission = true;
        this.setAttribute("data-toggle", "on");
        this.style.opacity = 1;
    }
});

// -- End of Enable Togle -- //

// -- Set Home -- //

$('#btn-set-home').on('click', function() {
    var toggleactive = this.getAttribute("data-toggle");
    if(toggleactive == "on"){
        setHomeEvent = false;
        this.setAttribute("data-toggle", "off");
        this.style.opacity = 0.7;
    }else{
        setHomeEvent = true;
        this.setAttribute("data-toggle", "on");
        this.style.opacity = 1;
    }
});

// -- End of Set Home -- //

// -- Toggle Draw -- //

$('#btn-toggle-draw').on('click', function() {
    var toggleactive = this.getAttribute("data-toggle");
    if(toggleactive == "on"){
        UpdateLine();
        draw_line.active = false;
        draw_line.new = false;
        this.setAttribute("data-toggle", "off");
        this.style.opacity = 0.7;
    }else{
        alert("Please select Home Point first");    
        draw_line.active = true;
        draw_line.new = true;
        this.setAttribute("data-toggle", "on");
        this.style.opacity = 1;
    }
});

// -- End of Toggle Draw -- //

// -- Enable Togle Drag -- //

$('#btn-toggle-drag').on('click', function() {
    var toggleactive = this.getAttribute("data-toggle");
    if(toggleactive == "on"){
        toggleDragging = false;
        this.setAttribute("data-toggle", "off");
        this.style.opacity = 0.7;
    }else{
        toggleDragging = true;
        this.setAttribute("data-toggle", "on");
        this.style.opacity = 1;
    }
});

// -- End of Enable Togle Drag -- //

//

function selectVehicle(id){
    var tr = document.getElementsByTagName('tr');
    for(var i=0; i<tr.length; i++){
      tr[i].style.background = "none";
    }
    document.getElementById("icon-vehicle-"+id).style.background="rgba(0,0,0,.1)";
    

    Mission_List.forEach(function(items, key){
        console.log("KEY : " + key);
        var missionPoints_ = [];
    
        // console.log("DATA BEGIN");
        counter = 1;
        items.forEach(function(data){
            if(data[0] == "HOME"){
                addMissionRow(HomePoint_List.get(Number(data[1]))[0], HomePoint_List.get(Number(data[1]))[1], counter, 1);
            }else{
                addMissionRow(WayPoint_List.get(Number(data[1]))[0], WayPoint_List.get(Number(data[1]))[1], counter, 2);
            }
            counter++;
        });
        
        // console.log("DATA END");
    });
}
//

map.on('click', function(evt) {
    var coords = ol.proj.toLonLat(evt.coordinate);
  
    var lat = coords[1];
    var lon = coords[0];

    if (setHomeEvent == true){
        console.log([lon,lat]);
        addHomePointOverlay([lon,lat],lastHomeID);
    }
    if (drawMission == true){
        console.log([lon,lat]);
        addWayPointOverlay([lon,lat],lastPointID);
    }


});
