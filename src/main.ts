import 'ol/ol.css';
import { GUI } from 'lil-gui';
import OLMap from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer } from 'ol/layer';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { OSM } from 'ol/source';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { Feature } from 'ol';
import colormap from 'colormap';

const availableColormaps = [
  'jet', 'hsv', 'hot', 'cool', 'spring', 'summer', 'autumn', 'winter', 'bone',
  'copper', 'greys', 'YIGnBu', 'greens', 'YIOrRd', 'bluered', 'RdBu', 'picnic',
  'rainbow', 'portland', 'blackbody', 'earth', 'electric',

  'viridis', 'inferno', 'magma', 'plasma', 'warm', 'cool', 'rainbow-soft',

  'bathymetry', 'cdom', 'chlorophyll', 'density', 'freesurface-blue', 'freesurface-red', 'oxygen', 'par', 'phase', 'salinity', 'temperature', 'turbidity', 'velocity-blue', 'velocity-green',

  'cubehelix'
];

const featureNames = new Map();
featureNames.set('tavg_gwl2', 'Temperature average');
featureNames.set('pr_above_nonzero_99th_gwl2', 'Precip Days 99 pctl');
featureNames.set('prmax1day_gwl2', 'Precip 1-day max');
featureNames.set('prmax5yr_gwl2', 'Precip 5-year max');
featureNames.set('tmax1day_gwl2', 'Temp max 1-day');
featureNames.set('tmax_days_ge_100f_gwl2', 'Temp Days 100°F');
featureNames.set('tmax_days_ge_105f_gwl2', 'Temp Days 105°F');
featureNames.set('tmax_days_ge_95f_gwl2', 'Temp Days 95°F');
featureNames.set('tmean_jja_gwl2', 'Temp mean summer');
featureNames.set('tmin_days_ge_70f_gwl2', 'Temp Days Min 70°F');
featureNames.set('tmin_days_le_0f_gwl2', 'Temp Days Min 0°F');
featureNames.set('tmin_days_le_32f_gwl2', 'Temp Days Min 32°F');
featureNames.set('tmin_jja_gwl2', 'Temp min summer');
featureNames.set('pr_annual_gwl2', 'Precip Annual');
featureNames.set('pr_days_above_nonzero_99th_gwl2', 'Precip Days 99 pctl');

const featureOptions: Record<string, string> = {};
featureNames.forEach((value, key) => {
  featureOptions[value] = key;
});

function getColorArray(colormapName: string) {
  return colormap({
    colormap: colormapName,
    nshades: 256,
    format: 'hex',
    alpha: 1
  });
}

let currentFeature = 'tmax_days_ge_100f_gwl2';
let currentColormap = 'viridis';
let cmapColors = getColorArray(currentColormap);
let rangeMax = 20;
let rangeMin = 0;



// A simple function to map values to a color. 
// Replace this with something more nuanced if you prefer.
function valueToColor(value: number | undefined): string {
  if (value === undefined) {
    return '#CCCCCC'; // Gray for unknown
  }
  // Example: Just map the value range you expect onto a gradient
  // Let's assume the values range roughly from 0 to 200
  const max = rangeMax;
  const min = rangeMin;
  const ratio = Math.max(0, Math.min((value - min) / (max - min), 1));

  const colorIndex = Math.floor(ratio * (cmapColors.length - 1));
  console.log(colorIndex);
  return cmapColors[colorIndex];
  /*
  const r = Math.floor(255 * ratio);
  const g = 0;
  const b = Math.floor(255 * (1 - ratio));
  return `rgb(${r},${g},${b})`;
  */
}

// Style function: given a county feature, return the style
const styleFunction = (feature: Feature): Style => {
  const val = feature.get(currentFeature);
  return new Style({
    fill: new Fill({
      color: valueToColor(val)
    }),
    stroke: new Stroke({
      color: '#333333',
      width: 1
    })
  });
};

const countiesLayer = new VectorTileLayer({
  source: new VectorTileSource({
    format: new MVT(),
    url: 'http://localhost:3000/nca_atlas_gwl_2c/{z}/{x}/{y}'
  }),
  style: styleFunction
});


// Create base layer
const baseLayer = new TileLayer({
  source: new OSM()
});

// Create the map
const map = new OLMap({
  target: 'map', // The ID of the container element in your HTML
  layers: [baseLayer, countiesLayer],
  view: new View({
    center: [-10000000, 4500000], // Approx center of the US in Web Mercator
    zoom: 4
  })
});

const gui = new GUI();
const layerFolder = gui.addFolder('Layer Controls');
const layerParams = { opacity: 1.0, visible: true, rangeMax: 20, rangeMin: 0, colormap: currentColormap };

layerFolder.add(layerParams, 'opacity', 0, 1, 0.1).onChange((value: number) => {
  countiesLayer.setOpacity(value);
});

layerFolder.add(layerParams, 'visible').onChange((value: boolean) => {
  countiesLayer.setVisible(value);
});

layerFolder.add(layerParams, 'colormap', availableColormaps).onChange((newColormap) => {
  currentColormap = newColormap;
  cmapColors = getColorArray(currentColormap);
  // Re-apply style to the vector layer
  countiesLayer.setStyle(styleFunction);
});

gui.add(layerParams, 'rangeMax', -10, 50).onChange(() => {
  rangeMax = layerParams.rangeMax;
  countiesLayer.setStyle(styleFunction); // Reapply the style
});

gui.add(layerParams, 'rangeMin', -50, 50).onChange(() => {
  rangeMin = layerParams.rangeMin;
  countiesLayer.setStyle(styleFunction); // Reapply the style
});

const params = { currentFeature };
layerFolder.add(params, 'currentFeature', featureOptions)
  .name('Feature: ')
  .onChange((value: string) => {
    console.log(`Feature changed to: ${value}`);
    currentFeature = value;
    countiesLayer.getSource().refresh();
  });



const info = document.getElementById('info')!;

map.on('pointermove', (evt) => {
  if (evt.dragging) {
    return; // Ignore if map is being dragged
  }

  // Get the pixel at the mouse position
  const pixel = map.getEventPixel(evt.originalEvent);

  // Check if a feature is at that pixel
  const feature = map.forEachFeatureAtPixel(pixel, (feat) => feat);

  if (feature) {
    // If there's a feature, show the tooltip
    const name = feature.get('name') || feature.get('state_name');
    const val = feature.get(currentFeature);
    //const info_str = `${name}<br />Add. days &ge; 100&#176;F: ${(Math.round(val * 100) / 100).toFixed(2)}`;
    const info_str = `${name}<br />${featureNames.get(currentFeature)}: ${(Math.round(val * 100) / 100).toFixed(2)}`;
    info.innerHTML = info_str;
    info.style.display = 'block';

    // Position the tooltip near the cursor
    info.style.left = (evt.originalEvent.pageX + 10) + 'px';
    info.style.top = (evt.originalEvent.pageY + 10) + 'px';

    // Change cursor style
    map.getViewport().style.cursor = 'pointer';
  } else {
    // If no feature is found, hide the tooltip
    info.style.display = 'none';
    map.getViewport().style.cursor = '';
  }
});
