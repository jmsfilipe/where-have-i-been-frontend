var Emitter = require('emitter-component');
var Hammer = require('../module/hammer');
var util = require('../util');
var DataSet = require('../DataSet');
var DataView = require('../DataView');
var Range = require('./Range');
var Core = require('./Core');
var TimeAxis = require('./component/TimeAxis');
var CurrentTime = require('./component/CurrentTime');
var CustomTime = require('./component/CustomTime');
var ItemSet = require('./component/ItemSet');
var Timeline = require('./Timeline');

var map;
var markers = {};
var trips = {};
var bounds = new google.maps.LatLngBounds();
var icons = {};

    var selectedStyle = {
        strokeColor: '#fc6355',
        strokeWeight: 3
    }
        var unselectedStyle = {
        strokeColor: '#e0e0e0',
        strokeWeight: 2
    }


function Map() {

}

function initialize() {

    var mapProp = {
        center: new google.maps.LatLng(38.7902476,-9.2141835),
        zoom: 10,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("map"), mapProp);

var range = 0;
      document.addEventListener("rangeInfo", function(event) {
            range = event.detail.message;
            
        });

var iconBase = 'http://www.google.com/intl/en_us/mapfiles/ms/micons/';
icons = {
  selected: {
    icon: iconBase + 'red-dot.png'
  },
  unselected: {
    icon: iconBase + 'grey.png'
  }
};

document.addEventListener("showCoordinates", function(event) {

coords = event.detail.message;
res = coords.split(",");
var position = new google.maps.LatLng(res[0], res[1]);
map.panTo(position);

              var iconBase = 'http://maps.google.com/mapfiles/ms/icons/';
            var marker = new google.maps.Marker({
                position: position,
                map: map,
                icon: iconBase + 'red-dot.png'
            });

              setTimeout(function () {
        marker.setMap(null);
        delete marker;
    }, 4000);

});

google.maps.event.addListener(map, "click", function (event) {
    var latitude = event.latLng.lat();
    var longitude = event.latLng.lng();
    var coords = latitude + ', ' + longitude;

    var yourLocation = new google.maps.LatLng(latitude, longitude);

              var iconBase = 'http://maps.google.com/mapfiles/ms/icons/';
            var marker = new google.maps.Marker({
                position: yourLocation,
                map: map,
                icon: iconBase + 'red-dot.png'
            });

            var circle = new google.maps.Circle({
  map: map,
  radius: range,    // 10 miles in metres
  fillColor: '#AA0000'
});
circle.bindTo('center', marker, 'position');
            
              setTimeout(function () {
        marker.setMap(null);
        circle.setMap(null);
        delete marker;
        delete circle;
    }, 2000);

var event1 = new CustomEvent(
  "mapCoordinates", 
  {
    detail: {
      message: coords
    }
  }
);

document.dispatchEvent(event1);


}); //end addListener


  google.maps.event.trigger(map, 'resize')
};


function setAllMap(map) {

for(var key in markers) {
    if(markers.hasOwnProperty(key)) {
        //key                 = keys,  left of the ":"
        //driversCounter[key] = value, right of the ":"
        markers[key].setMap(map);
    }
}

}

function clearMarkers() {
  bounds = new google.maps.LatLngBounds();


    


  setAllMap(null);
}

// Shows any markers currently in the array.
function showMarkers() {
  setAllMap(map);
}


function addMarker(name, data){
    if( data.features[0].geometry.coordinates[1] != 0 && data.features[0].geometry.coordinates[0] != 0){
    var yourLocation = new google.maps.LatLng(data.features[0].geometry.coordinates[1], data.features[0].geometry.coordinates[0]);

            var marker = new google.maps.Marker({
                position: yourLocation,
                map: map,
                icon: icons["unselected"].icon
            });
            var iw = new google.maps.InfoWindow({
       content: name
     });
     google.maps.event.addListener(marker, "click", function (e) { iw.open(map, this); });

            markers[name] = marker;


  for(var key in markers) {
    if(markers.hasOwnProperty(key)) {
        bounds.extend(markers[key].getPosition());
    }
}
}

}

Map.prototype.resizeMap = function() {
google.maps.event.trigger(map, 'resize');
}

Map.prototype.highlightLocation = function(id) {

if(markers[id]){
for(var mKey in markers) {
      if(mKey === id){
        markers[mKey].icon = icons["selected"].icon;
      }
      else{
         markers[mKey].icon = icons["unselected"].icon;
      }
    

}

showMarkers();

map.setZoom(17);
map.panTo(markers[id].position);
}
}


Map.prototype.highlightRoute = function(id) {


     map.data.addGeoJson(trips[id]);

}

Map.prototype.clearAll = function(id) {
    clearMarkers();
    clearMap();
}

Map.prototype.globalMapView = function(data) {
    clearMarkers();
    clearMap();

  var locations = data["locations"];
  var trips = data["trips"];



for(var key in locations) {
    if(locations.hasOwnProperty(key) && locations[key] && locations[key].features !== null) {
        addMarker(key, locations[key]);
    }
}



var noTrips = false;
map.data.setStyle(selectedStyle);
for(var key in trips) {
    if(trips.hasOwnProperty(key) && trips[key] && trips[key].features !== null) {
        map.data.addGeoJson(trips[key]);
    }
    else{
      noTrips = true;
    }
}


  if(Object.keys(trips).length == 0 || noTrips){
  map.fitBounds(bounds);
  map.setCenter(bounds.getCenter());}
else{
  zoom(map);
}

}

Map.prototype.mapView = function(data) {
        for(var mKey in markers) {

        markers[mKey].icon = icons["unselected"].icon;
      }
      showMarkers();

trips={};
markers ={};
    clearMarkers();
    clearMap();

  var locations = data["locations"];
  var trips = data["trips"];


var noMarkers = false;
for(var key in locations) {
  console.log(locations)
    if(locations.hasOwnProperty(key) && locations[key] && locations[key].features[0].geometry.coordinates[0] != 0 && locations[key].features[0].geometry.coordinates[1] != 0 && locations[key].features[0].geometry.coordinates[2] != 0) {
      console.log("impossible1")
        addMarker(key, locations[key]);
    }
    else{
      noMarkers = true;
    }
}


for(var mKey in markers) {
    markers[mKey].icon = icons["unselected"].icon;
    for(var lKey in locations) {
      if(mKey === lKey){
        console.log("SELECTED " + mKey)
        markers[mKey].icon = icons["selected"].icon;
      }
    
}
}

var noTrips = false;
map.data.setStyle(selectedStyle);
for(var key in trips) {
    if(trips.hasOwnProperty(key) && trips[key] && trips[key].features !== null) {
            console.log("impossible2")

        map.data.addGeoJson(trips[key]);
    }
    else{
      noTrips = true;
    }
}

if(noMarkers && noTrips){
  return;
}
  if(Object.keys(markers).length > 0 || !noMarkers){

    console.log("KLOLL")
  map.fitBounds(bounds);
  map.setCenter(bounds.getCenter());

}
else if (Object.keys(trips).length > 0 || !noTrips){
  console.log("JLOL")
  zoom(map);
}

}

Map.prototype.highlightMapView = function(data) {
  var locations = data["locations"];
  var _trips = data["trips"];
console.log(markers)
console.log(locations)
for(var mKey in markers) {
    markers[mKey].icon = icons["unselected"].icon;
    for(var lKey in locations) {
      if(mKey === lKey){
        console.log("SELECTED " + mKey)
        markers[mKey].icon = icons["selected"].icon;
      }
    
}
}
  
showMarkers();



  if(Object.keys(trips).length == 0){
  map.fitBounds(bounds);
  map.setCenter(bounds.getCenter());}
else{
  zoom(map);
}

}


Map.prototype.loadJson = function(geoString) {
    clearMap();
    for (i = 0; i < geoString.length; i++) {

        if (geoString[i].features[0].geometry.type === "Point") {
              var iconBase = 'http://maps.google.com/mapfiles/ms/icons/';
            var marker = new google.maps.Marker({
                position: new google.maps.LatLng(geoString[i].features[0].geometry.coordinates[1], geoString[i].features[0].geometry.coordinates[0]),
                map: map,
                icon: iconBase + 'red-dot.png'
            });
            markers.push(marker);

        } else {
            var featureStyle = {
                strokeColor: '#494949',
                strokeWeight: 2
            }
            map.data.addGeoJson(geoString[i]);
            map.data.setStyle(featureStyle);

        }


    }

    zoom(map);
};



function clearMap() {
  bounds = new google.maps.LatLngBounds();
    map.data.forEach(function(feature) {
       map.data.remove(feature);
    });
}

function zoom(map) {
    bounds = new google.maps.LatLngBounds();
    map.data.forEach(function(feature) {
        processPoints(feature.getGeometry(), bounds.extend, bounds);
    });
    map.fitBounds(bounds);
};

function processPoints(geometry, callback, thisArg) {
    if (geometry instanceof google.maps.LatLng) {
        callback.call(thisArg, geometry);
    } else if (geometry instanceof google.maps.Data.Point) {
        callback.call(thisArg, geometry.get());
    } else {
        geometry.getArray().forEach(function(g) {
            processPoints(g, callback, thisArg);
        });
    }
}

google.maps.event.addDomListener(window, 'load', initialize);



module.exports = Map;