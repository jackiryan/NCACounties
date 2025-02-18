import 'ol/ol.css';
import OLMap from 'ol/Map';
import View from 'ol/View';
import { Attribution } from 'ol/control';
import { defaults } from 'ol/control';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import Text from 'ol/style/Text';
import Style from 'ol/style/Style';
import { FeatureLike } from 'ol/Feature';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import colormap from 'colormap';

const isDev = false;
let apiUrl = 'https://jackiepi.xyz/api'
if (isDev) {
    apiUrl = 'http://localhost:8000';
}

const key = import.meta.env.VITE_MAPTILER_API_KEY;
if (!key) {
    throw new Error('MapTiler API key is not configured');
}

const attribution = new Attribution({
    collapsible: false,
});


const availableColormaps = [
    'jet', 'hsv', 'hot', 'cool', 'spring', 'summer', 'autumn', 'winter', 'bone',
    'copper', 'greys', 'YIGnBu', 'greens', 'YIOrRd', 'bluered', 'RdBu', 'picnic',
    'rainbow', 'portland', 'blackbody', 'earth', 'electric', 'viridis', 'inferno',
    'magma', 'plasma', 'warm', 'cool', 'rainbow-soft', 'bathymetry', 'cdom',
    'chlorophyll', 'density', 'freesurface-blue', 'freesurface-red', 'oxygen', 'par',
    'phase', 'salinity', 'temperature', 'turbidity', 'velocity-blue', 'velocity-green',
    'cubehelix'
];

// I know this is bad, but it works for now
const numCounties = 3110;
const featureNames = new Map([
    ['tavg', { name: 'Annual Average Temperature', units: '°F', dftCmap: 'hot', dftMin: 0, dftMax: 5, values: new Float32Array(numCounties) }],
    ['pr_above_nonzero_99th', { name: 'Amt. of Precip. on Wettest Days', units: '%', dftCmap: 'viridis', dftMin: -5, dftMax: 30, values: new Float32Array(numCounties) }],
    ['prmax1day', { name: 'Precip. on Wettest Day of Year', units: '%', dftCmap: 'viridis', dftMin: -5, dftMax: 15, values: new Float32Array(numCounties) }],
    ['prmax5yr', { name: 'Precip., Wettest Day in 5 Years', units: '%', dftCmap: 'viridis', dftMin: -5, dftMax: 15, values: new Float32Array(numCounties) }],
    ['tmax1day', { name: 'Temp. on Hottest Day of Year', units: '°F', dftCmap: 'inferno', dftMin: 0, dftMax: 5, values: new Float32Array(numCounties) }],
    ['tmax_days_ge_100f', { name: 'Num. Days >100°F', units: ' Days', dftCmap: 'hot', dftMin: 0, dftMax: 30, values: new Float32Array(numCounties) }],
    ['tmax_days_ge_105f', { name: 'Num. Days >105°F', units: ' Days', dftCmap: 'hot', dftMin: 0, dftMax: 20, values: new Float32Array(numCounties) }],
    ['tmax_days_ge_95f', { name: 'Num. Days >95°F', units: ' Days', dftCmap: 'hot', dftMin: 0, dftMax: 50, values: new Float32Array(numCounties) }],
    ['tmean_jja', { name: 'Avg. Summer Temperature', units: '°F', dftCmap: 'inferno', dftMin: 0, dftMax: 6, values: new Float32Array(numCounties) }],
    ['tmin_days_ge_70f', { name: 'Num. Days with Low >70°F', units: ' Days', dftCmap: 'hot', dftMin: 0, dftMax: 30, values: new Float32Array(numCounties) }],
    ['tmin_days_le_0f', { name: 'Num. Days with Low <0°F', units: ' Days', dftCmap: 'density', dftMin: -15, dftMax: 0, values: new Float32Array(numCounties) }],
    ['tmin_days_le_32f', { name: 'Num. Days with Low <32°F', units: ' Days', dftCmap: 'density', dftMin: -35, dftMax: 0, values: new Float32Array(numCounties) }],
    ['tmin_jja', { name: 'Average Summer Low', units: '°F', dftCmap: 'inferno', dftMin: 0, dftMax: 6, values: new Float32Array(numCounties) }],
    ['pr_annual', { name: 'Annual Precipitation', units: '%', dftCmap: 'viridis', dftMin: -10, dftMax: 15, values: new Float32Array(numCounties) }],
    ['pr_days_above_nonzero_99th', { name: 'Num. Days w/ Extreme Precip.', units: ' Days', dftCmap: 'viridis', dftMin: -5, dftMax: 30, values: new Float32Array(numCounties) }],
]);

const featureOptions: Record<string, string> = {};
featureNames.forEach((value, key) => {
    featureOptions[value.name] = key;
});

const GWLs = new Map<string, string>([
    ['0', '1.5°C'],
    ['1', '2°C'],
    ['2', '3°C'],
    ['3', '4°C']
]);

function getColorArray(colormapName: string) {
    return colormap({
        colormap: colormapName,
        nshades: 256,
        format: 'hex',
        alpha: 1
    });
}

let currentFeature = 'tmax_days_ge_100f';
let relative = 'True';
let varTypeStr = 'Change in';
let gwl = '2.0';
let currentColormap = featureNames.get(currentFeature)?.dftCmap ?? 'hot';
let cmapColors = getColorArray(currentColormap);
let rangeMax = featureNames.get(currentFeature)?.dftMax ?? 30;
let rangeMin = featureNames.get(currentFeature)?.dftMin ?? 0;

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
const styleFunction = (feature: FeatureLike): Style | undefined => {
    const countyId = feature.get('id');
    const featureData = featureNames.get(currentFeature)!;
    const val = featureData.values[countyId] ?? undefined;

    const zoom = map.getView().getZoom();
    if (!zoom) return undefined;

    if (zoom > 6) {
        return new Style({
            fill: new Fill({
                color: valueToColor(val)
            }),
            stroke: new Stroke({
                color: '#333333',
                width: 1
            }),
            zIndex: 1
        });
    } else {
        return new Style({
            fill: new Fill({
                color: valueToColor(val)
            }),
            stroke: new Stroke({
                color: valueToColor(val),
                width: 1
            }),
            zIndex: 1
        });
    }

};

const countiesLayer = new VectorTileLayer({
    source: new VectorTileSource({
        format: new MVT(),
        url: `https://jackiepi.xyz/tiles/counties/{z}/{x}/{y}`,
        attributions: [
            'NCA5 data courtesy of <a href="https://nca2023.globalchange.gov/" target="_blank">U.S. Global Change Research Program</a>,'
        ]
    }),
    style: styleFunction
});


// Create base layer
const baseStyleFunction = (feature: FeatureLike): Style | undefined => {
    const layer = feature.get('layer');

    if (layer === 'water') {
        return new Style({
            fill: new Fill({
                color: '#b3d1ff'
            }),
            stroke: new Stroke({
                color: '#b3d1ff',
                width: 1
            })
        });
    }

    if (layer === 'landcover') {
        const class_ = feature.get('class');
        let color: string = '#f2f2f2';

        if (class_ === 'grass' || class_ === 'park') {
            color = '#c8e6c9';
        } else if (class_ === 'wood' || class_ === 'forest') {
            color = '#a5d6a7';
        }

        return new Style({
            fill: new Fill({
                color: color
            })
        });
    }

    if (layer === 'landuse') {
        return new Style({
            fill: new Fill({
                color: '#f2f2f2'
            })
        });
    }

    if (layer === 'place' || layer === 'poi') {
        return undefined;
    }

    return new Style({
        fill: new Fill({
            color: '#f2f2f2'
        })
    });
};

const baseLayer = new VectorTileLayer({
    source: new VectorTileSource({
        format: new MVT(),
        url: `${apiUrl}/base_tiles/{z}/{x}/{y}.pbf`,
        maxZoom: 18,
    }),
    style: baseStyleFunction
});

const labelStyleFunction = (feature: FeatureLike): Style | undefined => {
    const layer = feature.get('layer');

    // Only show labels at appropriate zoom levels
    const zoom = map.getView().getZoom();
    if (!zoom) return undefined;

    if (layer === 'boundary') {
        // Handle state and country boundaries
        if (feature.get('admin_level') === 4) {
            if (zoom > 7) return undefined;
            return new Style({
                stroke: new Stroke({
                    color: '#333333',
                    width: 1.5,
                    lineDash: undefined
                })
            });
        } else if (feature.get('admin_level') === 2) {
            if (zoom > 8) return undefined;
            return new Style({
                stroke: new Stroke({
                    color: '#333333',
                    width: 1.75,
                    lineDash: undefined
                })
            });
        }
    } else if (layer !== 'place') {
        return undefined;
    } else {
        const name = feature.get('name');
        const class_ = feature.get('class');

        // Adjust font size and visibility based on place type and zoom
        let fontSize = '12px';
        let minZoom = 0;

        switch (class_) {
            case 'city':
                fontSize = '14px';
                minZoom = 4;
                break;
            case 'town':
                fontSize = '12px';
                minZoom = 8;
                break;
            case 'village':
                fontSize = '11px';
                minZoom = 10;
                break;
            case 'hamlet':
                fontSize = '10px';
                minZoom = 12;
                break;
            default:
                return undefined;
        }

        if (zoom < minZoom) return undefined;

        return new Style({
            text: new Text({
                text: name,
                font: `${fontSize} 'Open Sans', sans-serif`,
                fill: new Fill({
                    color: '#000000'
                }),
                stroke: new Stroke({
                    color: '#ffffff',
                    width: 3
                }),
                textAlign: 'center',
                textBaseline: 'middle',
                padding: [3, 3, 3, 3],
                offsetX: 0,
                offsetY: 0,
                placement: 'point',
                overflow: true,
                maxAngle: 45,
                scale: 1.0,
            })
        });
    }
};

const labelsLayer = new VectorTileLayer({
    source: new VectorTileSource({
        format: new MVT(),
        url: `${apiUrl}/base_tiles/{z}/{x}/{y}.pbf`,
        maxZoom: 18,
        attributions: [
            'Map Data © <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a>',
            '© <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> contributors'
        ]
    }),
    style: labelStyleFunction,
    declutter: true,
    renderBuffer: 128,
    updateWhileAnimating: false,
    updateWhileInteracting: false
});

// Create the map
const map = new OLMap({
    target: 'map',
    layers: [baseLayer, countiesLayer, labelsLayer],
    controls: defaults({ attribution: false }).extend([attribution]),
    view: new View({
        center: [-11000000, 4600000], // Approx center of the US in Web Mercator
        zoom: 5
    })
});

async function populateClimateData(gwl: string) {
    fetch(`${apiUrl}/climate-variables?gwl=${gwl}&var=${currentFeature}&relative=${relative}`)
        .then((response) => response.json())
        .then((data) => {
            if (data && data.length > 0) {
                const featureData = featureNames.get(currentFeature)!;
                for (let i = 0; i < data.length; i++) {
                    const county = data[i];
                    featureData.values[county.county_id] = data[i][currentFeature];
                }
                // refresh the source after populating data
                countiesLayer.changed();
            }
        })
        .catch((error) => {
            console.error('Error fetching climate data:', error);
        });
}

(async () => {
    await populateClimateData(gwl);
})();

function updateLegend() {
    const legendCanvas = document.getElementById('legend-canvas') as HTMLCanvasElement;
    if (legendCanvas) {
        const ctx = legendCanvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, legendCanvas.width, legendCanvas.height);
            const width = legendCanvas.width;
            const height = legendCanvas.height;
            // Loop over the canvas width and fill a 1px-wide column for each color in the gradient.
            for (let i = 0; i < width; i++) {
                const colorIndex = Math.floor((i / width) * cmapColors.length);
                ctx.fillStyle = cmapColors[colorIndex];
                ctx.fillRect(i, 0, 1, height);
            }
        }
    }
}

function generateGradientCSS(colorArray: string[]) {
    return `linear-gradient(to right, ${colorArray.join(', ')})`;
}

function populateColormapDropdown() {
    dropdown.innerHTML = '';

    availableColormaps.forEach((colormapName) => {
        const optionDiv = document.createElement('div');
        optionDiv.classList.add('colormap-option');

        const colorArray = getColorArray(colormapName);
        const previewDiv = document.createElement('div');
        previewDiv.classList.add('colormap-preview');
        previewDiv.style.background = generateGradientCSS(colorArray);

        const textSpan = document.createElement('span');
        textSpan.innerText = colormapName;

        optionDiv.appendChild(previewDiv);
        optionDiv.appendChild(textSpan);

        // When the user clicks a colormap option:
        optionDiv.addEventListener('click', () => {
            currentColormap = colormapName;
            const featureData = featureNames.get(currentFeature)!;
            featureData.dftCmap = currentColormap;
            cmapColors = colorArray;
            countiesLayer.setStyle(styleFunction);
            updateLegend();
            dropdown.style.display = 'none';
        });

        dropdown.appendChild(optionDiv);
    });
}

// Create a container for the legend
const legendWidth = 384;
const legendHeight = 20;
const legendDiv = document.createElement('div');
legendDiv.style.position = 'absolute';
legendDiv.style.bottom = '10px';
legendDiv.style.left = '10px';
legendDiv.style.backgroundColor = 'rgba(241, 241, 241, 0.8)';
legendDiv.style.padding = '10px';
legendDiv.style.borderRadius = '4px';
legendDiv.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
legendDiv.style.fontFamily = 'sans-serif';
legendDiv.style.fontSize = '14px';
legendDiv.style.color = 'black';
legendDiv.style.zIndex = '100';
legendDiv.style.width = `${legendWidth}px`;

const gwlContainer = document.createElement('div');
gwlContainer.style.display = 'flex';
gwlContainer.style.alignItems = 'center';
//gwlContainer.style.gap = '10px'; // Adds spacing between elements
gwlContainer.style.marginBottom = '8px';
gwlContainer.style.justifyContent = 'space-between';

const gwlSlider = document.createElement('input');
gwlSlider.type = 'range';
gwlSlider.min = '1';
gwlSlider.max = '4';
gwlSlider.step = '1';
gwlSlider.value = '2';

const gwlLabel = document.createElement('span');
function changeGwlLabel(target: HTMLInputElement) {
    const selectedGWL = GWLs.get(String((Number(target.value) - 1))) ?? 'Unknown';
    gwlLabel.textContent = `Warming Level: ${selectedGWL}`;
}

changeGwlLabel(gwlSlider);

// Apply styles for better visibility
gwlSlider.style.width = '200px';
gwlSlider.style.flexGrow = '0';
gwlSlider.className = 'gwl-slider';
gwlSlider.style.color = 'red';
gwlLabel.style.color = 'black';
gwlLabel.style.whiteSpace = 'nowrap';

gwlSlider.addEventListener('input', async (event) => {
    const target = event.target as HTMLInputElement;
    changeGwlLabel(target);
    gwl = target.value;
    await populateClimateData(gwl);
});

gwlContainer.appendChild(gwlLabel);
gwlContainer.appendChild(gwlSlider);
legendDiv.appendChild(gwlContainer);

// Climate variable select, i.e., the data being plotted currently
const varContainer = document.createElement('div');
varContainer.style.display = 'flex';
varContainer.style.gap = '10px';
varContainer.style.alignItems = 'center';
varContainer.style.marginBottom = '8px';
varContainer.style.justifyContent = 'space-between';

const varTypeSelect = document.createElement('select');
varTypeSelect.id = 'var-type-select';
varTypeSelect.style.width = `25%`;
varTypeSelect.style.height = `${legendHeight + 4}px`;
varTypeSelect.style.backgroundColor = '#f2f2f2';
varTypeSelect.style.color = 'black';
varTypeSelect.style.border = '1px solid black';
varTypeSelect.style.borderRadius = '4px';
varTypeSelect.style.textAlign = 'center';
const optRelative = document.createElement('option');
const optAbsolute = document.createElement('option');
optRelative.text = 'Change in';
optRelative.value = 'True';
optAbsolute.text = 'Total';
optAbsolute.value = 'False';
optRelative.selected = true;
varTypeSelect.appendChild(optRelative);
varTypeSelect.appendChild(optAbsolute);

const variableSelect = document.createElement('select');
variableSelect.id = 'legend-var-select';
variableSelect.style.width = `75%`;
variableSelect.style.height = `${legendHeight + 4}px`;
variableSelect.style.backgroundColor = '#f2f2f2';
variableSelect.style.color = 'black';
variableSelect.style.border = '1px solid black';
variableSelect.style.borderRadius = '4px';
variableSelect.style.textAlign = 'center';
//legendTitleSelect.style.marginBottom = '2px';

// Populate the drop-down with the feature options.
for (const [label, value] of Object.entries(featureOptions)) {
    const option = document.createElement('option');
    option.value = value;
    option.text = label;
    if (value === currentFeature) {
        option.selected = true;
    }
    variableSelect.appendChild(option);
}
varContainer.appendChild(varTypeSelect);
varContainer.appendChild(variableSelect);
legendDiv.appendChild(varContainer);

// Create a canvas element where the gradient will be drawn
const canvas = document.createElement('canvas');
canvas.id = 'legend-canvas';
canvas.width = legendWidth;
canvas.height = 20;
canvas.style.border = '1px solid black';
canvas.style.borderRadius = '4px';
canvas.style.marginTop = '8px';
legendDiv.appendChild(canvas);

const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
arrow.setAttribute('width', '16');
arrow.setAttribute('height', '16');
arrow.setAttribute('viewBox', '0 0 16 16');

// This path draws an inverted 'V' (downward caret) without fill
const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
path.setAttribute('d', 'M7,6 L10.5,10 L14,6');
path.setAttribute('fill', 'none');
path.setAttribute('stroke', 'black');
path.setAttribute('stroke-width', '1.2');
arrow.appendChild(path);

// Position and style the arrow. We rely on opacity for fade in/out.
arrow.style.position = 'absolute';
arrow.style.top = '0';
arrow.style.left = '0';
arrow.style.opacity = '0';
arrow.style.pointerEvents = 'none';
arrow.style.transition = 'opacity 0.3s ease';
legendDiv.appendChild(arrow);

function showArrow() {
    const rect = canvas.getBoundingClientRect();
    const containerRect = legendDiv.getBoundingClientRect();

    // Position the arrow on the right side of the canvas, vertically centered
    const arrowWidth = 16;
    const arrowHeight = 16;
    arrow.style.left = `${(rect.left - containerRect.left) + rect.width - arrowWidth - 4
        }px`;
    arrow.style.top = `${(rect.top - containerRect.top) + (rect.height / 2) - (arrowHeight / 2)
        }px`;

    arrow.style.opacity = '1';
}

const dropdown = document.createElement('div');
dropdown.id = 'colormap-dropdown';
dropdown.style.display = 'none';
dropdown.style.position = 'absolute';
legendDiv.appendChild(dropdown);

function hideDropdown() {
    dropdown.style.display = 'none';
    arrow.style.opacity = '0';
}

canvas.addEventListener('click', () => {
    if (dropdown.style.display === 'block') {
        hideDropdown();
        return;
    }
    dropdown.style.display = 'block';
    // Calculate position of the canvas relative to the parent container
    // so we can place dropdown right below or next to it
    const rect = canvas.getBoundingClientRect();
    const containerRect = legendDiv.getBoundingClientRect();
    const dropdownHeight = dropdown.offsetHeight;
    const offset = 1;
    const topPosition = rect.top - containerRect.top - dropdownHeight - offset;
    const leftPosition = rect.left - containerRect.left;

    // Position the dropdown under the canvas
    dropdown.style.top = `${topPosition}px`;
    dropdown.style.left = `${leftPosition}px`;
});

canvas.addEventListener('mouseenter', () => {
    showArrow();
});

canvas.addEventListener('mouseleave', () => {
    if (dropdown.style.display !== 'block') {
        arrow.style.opacity = '0';
    }
});

document.addEventListener('click', (event: MouseEvent) => {
    if (!canvas.contains(event.target as Node)) {
        hideDropdown();
    }
});

// Create a container for the range labels
const labelsContainer = document.createElement('div');
labelsContainer.style.display = 'flex';
labelsContainer.style.justifyContent = 'space-between';
//labelsContainer.style.marginTop = '0px';
legendDiv.appendChild(labelsContainer);

const minInput = document.createElement('input');
minInput.type = 'number';
minInput.value = rangeMin.toString();
minInput.style.width = '40px';

const maxInput = document.createElement('input');
maxInput.id = 'max-input';
maxInput.type = 'number';
maxInput.value = rangeMax.toString();
maxInput.style.width = '40px';

// When the user changes the spinbox, update the range and re-draw
minInput.addEventListener('change', () => {
    rangeMin = parseFloat(minInput.value);
    countiesLayer.setStyle(styleFunction);
    updateLegend();
});

maxInput.addEventListener('change', () => {
    rangeMax = parseFloat(maxInput.value);
    countiesLayer.setStyle(styleFunction);
    updateLegend();
});

async function onUpdateVariable() {
    await populateClimateData(gwl);
    const featureData = featureNames.get(currentFeature)!;
    currentColormap = featureData.dftCmap;
    rangeMin = featureData.dftMin;
    minInput.value = rangeMin.toString();
    rangeMax = featureData.dftMax;
    maxInput.value = rangeMax.toString();
    cmapColors = getColorArray(currentColormap);
    countiesLayer.setStyle(styleFunction);
    updateLegend();
}

// When the user changes the selection, update the feature displayed.
variableSelect.addEventListener('change', async (event) => {
    const select = event.target as HTMLSelectElement;
    currentFeature = select.value;
    onUpdateVariable();
});

varTypeSelect.addEventListener('change', async (event) => {
    const select = event.target as HTMLSelectElement;
    relative = select.value;
    varTypeStr = select.options[select.selectedIndex].text;
    const pr_annual = featureNames.get('pr_annual')!;
    if (relative === 'True') {
        pr_annual['units'] = '%';
    } else {
        pr_annual['units'] = '"';
    }
    onUpdateVariable();
});

// Add the two inputs to the container
labelsContainer.appendChild(minInput);
labelsContainer.appendChild(maxInput);
document.body.appendChild(legendDiv);

// Draw the initial legend
populateColormapDropdown();
updateLegend();

const info = document.getElementById('info')!;

map.on('pointermove', (evt) => {
    if (evt.dragging) {
        info.style.display = 'none';
        return; // Ignore if map is being dragged
    }

    // Get the pixel at the mouse position
    const pixel = map.getEventPixel(evt.originalEvent);

    // Check if a feature is at that pixel
    const feature = map.forEachFeatureAtPixel(
        pixel,
        (feat) => feat,
        {
            layerFilter: (layer) => layer === countiesLayer
        }
    );

    if (feature) {
        // Show the tooltip
        const name = feature.get('name') || feature.get('state_abbr');
        const county_id = feature.get('id')!;
        const featureData = featureNames.get(currentFeature)!;
        const info_str = `${name}<br />${varTypeStr} ${featureData.name}: ${(Math.round(featureData.values[county_id] * 100) / 100).toFixed(2)}${featureData.units}`;
        updateTooltip(info_str, evt.originalEvent.pageX, evt.originalEvent.pageY);

        map.getViewport().style.cursor = 'pointer';
    } else {
        // Hide the tooltip
        info.style.display = 'none';
        map.getViewport().style.cursor = '';
    }
});

map.getViewport().addEventListener('mouseleave', () => {
    info.style.display = 'none';
    map.getViewport().style.cursor = '';
});

window.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) {
        info.style.display = 'none';
        map.getViewport().style.cursor = '';
    }
});

function updateTooltip(text: string, x: number, y: number) {
    const tooltip = document.getElementById('info')!;

    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const spaceRight = window.innerWidth - x - 10;
    const spaceBottom = window.innerHeight - y - 10;
    let isLeft = false;
    if (spaceRight < tooltipWidth) {
        // display to the left of the cursor
        tooltip.style.left = `${x - tooltipWidth - 10}px`;
        tooltip.style.borderRadius = '3px 0px 3px 3px';
        isLeft = true;
    } else {
        // display to the right of the cursor (default)
        tooltip.style.left = `${x + 10}px`;
        tooltip.style.borderRadius = '0px 3px 3px 3px';
    }
    if (spaceBottom < tooltipHeight) {
        // display above the cursor, and use a different pointy corner
        // if also displaying to the left
        tooltip.style.top = `${y - tooltipHeight - 10}px`;
        if (isLeft) {
            tooltip.style.borderRadius = '3px 3px 0px 3px';
        } else {
            tooltip.style.borderRadius = '3px 3px 3px 0px';
        }
    } else {
        // display below the cursor (default)
        tooltip.style.top = `${y + 10}px`;
    }
    tooltip.innerHTML = text;
    tooltip.style.display = 'block';
}
