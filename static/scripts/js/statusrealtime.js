var transform = ol.proj.getTransform('EPSG:3857', 'EPSG:4326');
var PointerInteraction = ol.interaction.Pointer;

// -- Global Variable -- //

var HomePoint_List = new Map();
var VehicleData_List = new Map();
var lastVehicleID = 0;
var color_List = ["blue", "green", "red", "purple", "yellow"];

// -- End of Global Variable -- //

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
  }
}

function handleUpEvent() {
  this.coordinate_ = null;
  this.feature_ = null;
  return false;
}

// -- END OF Map Mouse Event -- //

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
    })
  ],
  view: new ol.View({
    center: ol.proj.transform([112.79758155388635, -7.2772675487336045], 'EPSG:4326', 'EPSG:3857'),
    zoom: 18
  })
});

// -- END OF THE MAP -- //

// -- Connect Button Clicked -- //

$('#btn-connect').on('click', function(){
  // Change button animation
  document.getElementById('btn-connect').classList.remove("btn-info");
  document.getElementById('btn-connect').classList.add("btn-warning");
  document.getElementById('btn-connect').innerHTML = '<i class="icon icon-refresh"></i>CONNECTING...';

  console.log("Connecting ...");
  var address = $('#textbox-address').val();
  var baudrate = $('#textbox-baudrate').val();
  
  $.ajax({
    method: 'PUT',
    url: '/api/connect',
    contentType : 'application/json',
    data: JSON.stringify({ addr: address, baudrate: baudrate, id: lastVehicleID }),
  })
  .done(function( msg ) {
    document.getElementById('btn-connect').classList.remove("btn-warning");


    /* error:0 = connection success
       error: selain 0 = connection failed
       sementara yang error dianggap sukses dulu
    */
    if(msg.error == 0){
      alert("Connection failed");
      document.getElementById('btn-connect').classList.add("btn-info");
      document.getElementById('btn-connect').innerHTML = '<i class="icon icon-refresh"></i>CONNECT';
    }else if(msg.error == 1){
      alert("Connection success (aslinya failed)");
      document.getElementById('btn-connect').classList.add("btn-danger");
      document.getElementById('btn-connect').innerHTML = '<i class="icon icon-refresh"></i>DISCONNECT';

      document.getElementById('blink-status').classList.remove('bg-danger');
      document.getElementById('blink-status').classList.remove('blink');
      document.getElementById('blink-status').classList.add('bg-success');

      document.getElementById('blink-status').innerHTML = '<center><h2 class="text-white">CONNECTED</h2></center>';
      document.getElementById('textbox-address').setAttribute("disabled", true);
      document.getElementById('textbox-baudrate').setAttribute("disabled", true);

      var coords = prompt("Enter lon,lat format: {\"lon\":,\"lat\":}");

      // Sample Input:
      // {"lon": 112.79758155388635,"lat":-7.2772675487336045} //
      // {"lon": 112.79817163986962,"lat":-7.27737929405518} //

      var coordsobj = JSON.parse(coords);
      addHomePoint([coordsobj.lon, coordsobj.lat], lastVehicleID);
    }else{
      alert("Unknown error");
    }
  });
});

// -- End of Connect Button Clicked -- //

// -- Function : Add Home Point -- //

function addHomePoint(coordinate, id){
  console.log(coordinate);
  var lon = coordinate[0], lat = coordinate[1];

  var Home_markerElement = document.createElement('div');
  Home_markerElement.classList.add("marker");
  Home_markerElement.setAttribute("data-point-id", id);
  var backgroundColor = color_List[HomePoint_List.size];
  var style = "display:flex;\
  justify-content:center;\
  align-items:center;\
  box-sizing:border-box;\
  width: 30px;\
  height: 30px;\
  color:#fff;\
  background: "+backgroundColor+";\
  border:solid 2px;\
  border-radius: 0 70% 70%;\
  box-shadow:0 0 2px #000;\
  cursor: pointer;\
  transform-origin:0 0;\
  transform: rotateZ(-135deg);";
  Home_markerElement.innerHTML = '<span style="'+style+'"><b style="transform: rotateZ(135deg);">H</b></span>';

  HomePoint_List.set(id, [lon,lat]);

  var Home_markerOverlay = new ol.Overlay({
    element: Home_markerElement,
    position: ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'),
    positioning: 'center-center'
  });

  map.addOverlay(Home_markerOverlay);
  console.log(HomePoint_List);
}

// -- End of Function : Add Home Point -- //


// -- Function when sidebar collapsed -- //

$('#push-menu').on('click', function(){
  // console.log(document.getElementById('page-body').classList);
  if(document.getElementById('page-body').classList.contains('sidebar-collapse')){
    console.log("Not colapsed");
    document.getElementById('header').setAttribute('style', 'left: 350px;');
  }else{
    console.log("Colapsed");
    document.getElementById('header').setAttribute('style', 'left: 20px;');
  }
});

// -- End of Function when sidebar collapsed -- //

// -- Global msg -- //

var globmsg = null;

var source = new EventSource('/api/sse/state');
source.onmessage = function(event) {
  // console.log(event.data);
  var msg = JSON.parse(event.data);
  if (!globmsg) {
    console.log('FIRST', msg);
    $('body').removeClass('disabled')
    //map.getView().setCenter(ol.proj.transform([msg.lon, msg.lat], 'EPSG:4326', 'EPSG:3857'));
  }
  globmsg = msg;

  $('#header-alt').html('<strong id="header-alt" style="color: #000;">' + msg.alt +'</strong>');
  $('#header-vspeed').html('<strong id="header-alt" style="color: #000;">' + msg.vspeed +'</strong>');
  $('#header-gspeed').html('<strong id="header-alt" style="color: #000;">' + msg.gspeed.toFixed(3) +'</strong>');
  $('#header-yaw').html('<strong id="header-alt" style="color: #000;">' + msg.heading +'</strong>');
};

// -- End of Global Message -- //

// -- Function add new vehicle -- //

function addVehicle(){
  console.log("add Vehicle");

  var markup = '<tr data-vehicle-id="'+lastVehicleID+'" onclick="switchVehicle('+lastVehicleID+')"><td><a class="nav-link" href="#"><i class="icon-plane text-'+color_List[HomePoint_List.size]+'"></i></a></td></tr>';
  $("#vehicle-list").append(markup);

  VehicleData_List.set(lastVehicleID, {address:"127.0.0.1:5670", baudrate:1000+lastVehicleID, isConnected:false});
  HomePoint_List.set(lastVehicleID, [null,null]);
  
  switchVehicle(lastVehicleID);

  lastVehicleID++;
}

// -- End of Function add new vehicle -- //

// -- Function switch vehicle -- //

function switchVehicle(vehicleID){
  var vehicleData = VehicleData_List.get(Number(vehicleID));
  console.log(vehicleData);

  document.getElementById('textbox-address').value = vehicleData.address;
  document.getElementById('textbox-baudrate').value = vehicleData.baudrate;

  if(vehicleData.isConnected){
    document.getElementById('textbox-address').setAttribute("disabled", true);
    document.getElementById('textbox-baudrate').setAttribute("disabled", true);

    document.getElementById('btn-connect').classList.add("btn-danger");
    document.getElementById('btn-connect').innerHTML = '<i class="icon icon-refresh"></i>DISCONNECT';

    document.getElementById('blink-status').classList.remove('bg-danger');
    document.getElementById('blink-status').classList.remove('blink');
    document.getElementById('blink-status').classList.add('bg-success');

    document.getElementById('blink-status').innerHTML = '<center><h2 class="text-white">CONNECTED</h2></center>';
  }else{
    document.getElementById('textbox-address').removeAttribute("disabled");
    document.getElementById('textbox-baudrate').removeAttribute("disabled");
    document.getElementById('btn-connect').classList.add("btn-info");
    document.getElementById('btn-connect').innerHTML = '<i class="icon icon-refresh"></i>CONNECT';
  }
}

// -- End of Function switch vehicle -- //
