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
import { FeatureLike } from 'ol/Feature';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
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
featureNames.set('tavg', 'Temperature average');
featureNames.set('pr_above_nonzero_99th', 'Precip Days 99 pctl');
featureNames.set('prmax1day', 'Precip 1-day max');
featureNames.set('prmax5yr', 'Precip 5-year max');
featureNames.set('tmax1day', 'Temp max 1-day');
featureNames.set('tmax_days_ge_100f', 'Temp Days 100°F');
featureNames.set('tmax_days_ge_105f', 'Temp Days 105°F');
featureNames.set('tmax_days_ge_95f', 'Temp Days 95°F');
featureNames.set('tmean_jja', 'Temp mean summer');
featureNames.set('tmin_days_ge_70f', 'Temp Days Min 70°F');
featureNames.set('tmin_days_le_0f', 'Temp Days Min 0°F');
featureNames.set('tmin_days_le_32f', 'Temp Days Min 32°F');
featureNames.set('tmin_jja', 'Temp min summer');
featureNames.set('pr_annual', 'Precip Annual');
featureNames.set('pr_days_above_nonzero_99th', 'Precip Days 99 pctl');

const featureOptions: Record<string, string> = {};
featureNames.forEach((value, key) => {
  featureOptions[value] = key;
});

const GWLs = new Map();
GWLs.set('1.0', '1.5°C (2025)');
GWLs.set('2.0', '2°C (2036-2045)');
GWLs.set('3.0', '3°C (2050-2060)');
GWLs.set('4.0', '4°C (2090-2110)');

const gwlOptions: Record<string, string> = {};
GWLs.forEach((value, key) => {
  gwlOptions[value] = key;
});

function getColorArray(colormapName: string) {
  return colormap({
    colormap: colormapName,
    nshades: 256,
    format: 'hex',
    alpha: 1
  });
}

let currentFeature = 'tmax_days_ge_100f';
let gwl = '2.0';
let currentColormap = 'viridis';
let cmapColors = getColorArray(currentColormap);
let rangeMax = 20;
let rangeMin = 0;

// A simple function to map values to a color. 
function valueToColor(value: number | undefined): string {
  if (value === undefined) {
    return '#CCCCCC'; // Gray for unknown
  }
  const max = rangeMax;
  const min = rangeMin;
  const ratio = Math.max(0, Math.min((value - min) / (max - min), 1));

  const colorIndex = Math.floor(ratio * (cmapColors.length - 1));
  return cmapColors[colorIndex];
}

// Style function: given a county feature, return the style
const styleFunction = (feature: FeatureLike): Style => {
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
    url: `https://jackiepi.xyz/tiles/counties_gwl/{z}/{x}/{y}?gwl=${gwl}`
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

layerFolder.add(layerParams, 'colormap', availableColormaps).onChange((newColormap: string) => {
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

const params = { currentFeature, gwl };
layerFolder.add(params, 'currentFeature', featureOptions)
  .name('Feature: ')
  .onChange((value: string) => {
    currentFeature = value;
    const source = countiesLayer.getSource();
    if (source) {
      source.refresh();
    }
  });
layerFolder.add(params, 'gwl', gwlOptions)
  .name('Warming Level: ')
  .onChange((value: string) => {
    gwl = value;
    const source = countiesLayer.getSource();
    if (source) {
      source.setUrl(`https://jackiepi.xyz/tiles/counties_gwl/{z}/{x}/{y}?gwl=${gwl}`);
    }
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
    const name = feature.get('name') || feature.get('state_abbr');
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
