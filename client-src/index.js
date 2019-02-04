import 'ol/ol.css';
import io from 'socket.io-client';
import { Map, View, Overlay } from 'ol';
import { Tile, Vector } from 'ol/layer';
import { XYZ } from 'ol/source';
import { fromLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import { GeoJSON } from 'ol/format';
import { Style, Stroke } from 'ol/style';
import EventType from 'ol/events/EventType';
import hashed from 'hashed';
import sync from 'ol-hashed';
import { isEmpty } from 'ol/obj';

const socket = io();

class Format extends GeoJSON {
  readFeaturesFromObject(object, opt_options) {
    return super.readFeaturesFromObject(Array.isArray(object) ?
      {
        type: 'FeatureCollection',
        features: object
      } : object, opt_options);
  }
}

const state = {
  edgeid: -1
};

const selection = new VectorSource();

const features = new VectorSource({
  format: new Format(),
  url: './features'
});

const map = new Map({
  target: 'map',
  layers: [
    new Tile({
      source: new XYZ({
        url: "https://maps{1-4}.wien.gv.at/basemap/bmapgrau/normal/google3857/{z}/{y}/{x}.png"
      })
    }),
    new Vector({
      style: new Style({
        stroke: new Stroke({
          width: 3,
          color: 'red'
        })
      }),
      source: features
    }),
    new Vector({
      style: new Style({
        stroke: new Stroke({
          width: 5,
          color: 'blue'
        })
      }),
      source: selection
    })
  ],
  view: new View({
    center: fromLonLat([48.208333, 16.373056].reverse()),
    zoom: 15
  })
});
sync(map);

const overlay = new Overlay({
  element: document.createElement('div')
});
map.addOverlay(overlay);

function updateOverlay(feature, coordinate) {
  overlay.getElement().innerHTML =
    '<ul>' +
    `<li><a href="nutzungsstreifen.html#/edgeid/${feature.getId()}" target="nutzungsstreifen">> Nutzungsstreifen</a></li>` +
    `<li><a href="segment.html#/edgeid/${feature.getId()}" target="sgement">> Segment</a></li>` +
    '</ul>';
  overlay.setPosition(coordinate);
}

map.on(['pointermove', 'click'], function(e) {
  const clicked = e.type === EventType.CLICK;
  const features = map.getFeaturesAtPixel(e.pixel, {hitTolerance: 2});
  if (features) {
    map.getTargetElement().style.cursor = 'pointer';
    if (clicked) {
      selection.clear();
      const feature = features[0];
      selection.addFeature(feature);
      socket.emit('change:edgeid', feature.getId());
    }
  } else {
    map.getTargetElement().style.cursor = '';
    if (clicked) {
      selection.clear();
      overlay.setPosition(undefined);
    }
  }
});

socket.on('change:edgeid', function(edgeid) {
  state.edgeid = edgeid;
  update({
    edgeid: edgeid
  });
  updateEdge();
});

function updateEdge() {
  if (features.isEmpty()) {
    features.once('change', updateEdge);
    return;
  }
  const feature = features.getFeatureById(state.edgeid);
  if (feature) {
    selection.clear();
    selection.addFeature(feature);
    const coordinates = feature.getGeometry().getCoordinates();
    const coordinate = coordinates[Math.floor(coordinates.length / 2)];
    updateOverlay(feature, coordinate);
  }
}

const update = hashed.register(state, function(newState) {
  state.edgeid = newState.edgeid;
  updateEdge();
});

const format = new GeoJSON();
socket.on('change:features', function(edgeid) {
  fetch(`./features/${edgeid}`).then(function(res) {
    return res.json();
  }).then(function(json) {
    const feature = format.readFeature(json, {featureProjection: 'EPSG:3857'});
    const existing = features.getFeatureById(edgeid);
    features.removeFeature(existing);
    features.addFeature(feature);
    const existingSel = selection.getFeatureById(edgeid);
    if (existingSel) {
      selection.removeFeature(existingSel);
      selection.addFeature(feature);
    }
  })
});