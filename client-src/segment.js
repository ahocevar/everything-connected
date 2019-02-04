import 'ol/ol.css';
import io from 'socket.io-client';
import { Map, View } from 'ol';
import { Tile, Vector } from 'ol/layer';
import { XYZ } from 'ol/source';
import { fromLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import { GeoJSON } from 'ol/format';
import { Style, Stroke } from 'ol/style';
import EventType from 'ol/events/EventType';
import hashed from 'hashed';
import { Modify } from 'ol/interaction';

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
const format = new Format();

const state = {
  edgeid: -1
};

const selection = new VectorSource();
const features = new VectorSource({
  format: format,
  url: './features'
});
features.once(EventType.CHANGE, updateEdge);

function updateEdge() {
  const feature = features.getFeatureById(state.edgeid);
  if (feature) {
    selection.clear();
    selection.addFeature(feature);
    const geom = feature.getGeometry();
    map.getView().fit(geom.getExtent(), {
      duration: 1000,
      constrainResolution: false,
      padding: [20, 20, 20, 20]
    });
  }
}

const update = hashed.register(state, function(newState) {
  document.getElementById('edgeid').innerText = newState.edgeid;
  state.edgeid = newState.edgeid;
  updateEdge();
});


const map = new Map({
  target: 'map',
  layers: [
    new Tile({
      source: new XYZ({
        url: "https://maps{1-4}.wien.gv.at/basemap/bmapgrau/normal/google3857/{z}/{y}/{x}.png",
        maxZoom: 19
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

map.on(['pointermove', 'click'], function(e) {
  const clicked = e.type === EventType.CLICK;
  const features = map.getFeaturesAtPixel(e.pixel, {hitTolerance: 2});
  if (features) {
    map.getTargetElement().style.cursor = 'pointer';
    if (clicked) {
      selection.clear();
      const feature = features[features.length - 1];
      const edgeid = feature.getId();
      state.edgeid = edgeid;
      update({
        edgeid: edgeid
      });
      updateEdge();
      socket.emit('change:edgeid', edgeid);
    }
  } else {
    map.getTargetElement().style.cursor = '';
  }
});

socket.on('change:edgeid', function(edgeid) {
  state.edgeid = edgeid;
  update({
    edgeid: edgeid
  });
  updateEdge();
});

const modify = new Modify({
  source: selection
});
map.addInteraction(modify);
modify.on('modifyend', function(e) {
  const feature = e.features.item(0);
  const json = format.writeFeature(feature, {featureProjection: 'EPSG:3857'});
  console.log(json);
  fetch(`./features/${feature.getId()}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: json
  }).then(function(res) {
    console.log(res);
  });
});