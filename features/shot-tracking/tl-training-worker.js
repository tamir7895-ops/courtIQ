/* ══════════════════════════════════════════════════════════════
   Transfer Learning Training Worker
   Offloads TF.js tensor operations to a background thread
   so the main UI thread never freezes during training.
   ══════════════════════════════════════════════════════════════ */

/* Import TF.js in worker context */
var TF_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
var MOBILENET_URL = 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json';

var featureModel = null;
var classifierModel = null;

importScripts(TF_CDN);

self.onmessage = function (e) {
  var msg = e.data;

  if (msg.type === 'train') {
    trainClassifier(msg.samples).then(function (result) {
      self.postMessage({ type: 'trained', result: result });
    }).catch(function (err) {
      self.postMessage({ type: 'error', error: err.message || String(err) });
    });
  }
};

function loadFeatureModel() {
  if (featureModel) return Promise.resolve(true);

  return tf.ready().then(function () {
    return tf.loadLayersModel(MOBILENET_URL);
  }).then(function (mobilenet) {
    var layer = null;
    try { layer = mobilenet.getLayer('conv_pw_13_relu'); } catch (e) {}
    if (!layer) layer = mobilenet.layers[mobilenet.layers.length - 3];

    featureModel = tf.model({
      inputs: mobilenet.inputs,
      outputs: layer.output
    });
    return true;
  });
}

function trainClassifier(samples) {
  return loadFeatureModel().then(function () {
    if (samples.length < 20) {
      return { success: false, reason: 'not enough samples' };
    }

    /* Convert samples to tensors */
    var xs = [];
    var ys = [];
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      if (!s.pixels || s.pixels.length !== 64 * 64 * 4) continue;

      var imgTensor = tf.tensor3d(
        new Uint8Array(s.pixels), [64, 64, 4]
      ).slice([0, 0, 0], [64, 64, 3])
       .resizeBilinear([96, 96])
       .toFloat().div(127.5).sub(1);

      xs.push(imgTensor);
      ys.push(s.label === 'ball' ? 1 : 0);
    }

    if (xs.length < 10) {
      xs.forEach(function (t) { t.dispose(); });
      return { success: false, reason: 'too few valid samples' };
    }

    var xBatch = tf.stack(xs);
    var features = featureModel.predict(xBatch);
    var yBatch = tf.tensor1d(ys);

    xs.forEach(function (t) { t.dispose(); });
    xBatch.dispose();

    /* Build classifier head */
    var classifier = tf.sequential();
    classifier.add(tf.layers.flatten({ inputShape: features.shape.slice(1) }));
    classifier.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    classifier.add(tf.layers.dropout({ rate: 0.3 }));
    classifier.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    classifier.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return classifier.fit(features, yBatch, {
      epochs: 10,
      batchSize: 16,
      shuffle: true,
      verbose: 0
    }).then(function (history) {
      var finalAcc = history.history.acc
        ? history.history.acc[history.history.acc.length - 1]
        : 0;

      /* Save classifier weights to transfer back to main thread */
      var weightData = [];
      var weightSpecs = [];
      var weights = classifier.getWeights();
      var promises = weights.map(function (w) {
        return w.data().then(function (data) {
          weightSpecs.push({ name: w.name, shape: w.shape, dtype: w.dtype });
          weightData.push(Array.from(data));
        });
      });

      return Promise.all(promises).then(function () {
        features.dispose();
        yBatch.dispose();
        classifier.dispose();

        return {
          success: true,
          accuracy: finalAcc,
          weightSpecs: weightSpecs,
          weightData: weightData
        };
      });
    });
  });
}
