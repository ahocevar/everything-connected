import hashed from 'hashed';

function synchronize(features, selected) {
  const config = {
    edgeid: ''
  };

  function hashHandler(state) {
    if (state.edgeid) {

    }
  }

  const update = hashed.register(config, hashHandler);

  function onAddFeature(e) {
    update({
      center: view.getCenter(),
      zoom: view.getZoom(),
      rotation: view.getRotation()
    });
  }

  selected.on('addfeature', onAddFeature);

  return function unregister() {
    map.un('moveend', onMoveEnd);
    hashed.unregister(hashHandler);
  };
}

export default synchronize;