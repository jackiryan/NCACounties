# NCACounties

This project is a prototype dynamic data visualization of county-level data from the 5th National Climate Assessment (NCA5). The live version can be found on [jackiepi.xyz/nca_atlas](https://jackiepi.xyz/nca_atlas/). The backend services for this webapp can be found here: [nca-counties-infrastructure](https://github.com/jackiryan/nca-counties-infrastructure).

The basic architecture is that GeoJSON files from the NCA5 Atlas project were parsed and ingested into a PostGIS database (PostgreSQL with GIS-specific features). County-level geometry is stored in a `counties` database table and served as a vector tile layer via [MapLibre's Martin project](https://martin.maplibre.org/). Climate metrics for each county are served separately via a `climate_metrics` table that is accessible to this frontend code through an API endpoint. Finally, the underlying map tiles layer providing place names, state and country borders, and land/ocean extents is provided via MapTiler through a reverse proxy endpoint that I have set up as a cloudflare worker with `wrangler`.

## Running Locally

If you would like to run this webapp locally, you will need to clone both this repository and the previously mentioned nca-counties-infrastructure repo. Follow the instructions in the backend repo to set up all three `docker-compose`d services on localhost, being sure to set `useDev=True` (reminder that this is a prototype and not meant for general use). Once the database, Martin endpoint, and FastAPI endpoint services are running, you can `npm install` the dependencies for this project and `npm run dev` to run it on localhost.

## Future Development

One of the key challenges I have encountered with this project is that the source climate data effectively "bakes in" certain processing from the source CMIP6 climate model data it is derived from. This means that there are several hard limitations on the scalability of using this data source:

- Adding other countries would require finding the same or similar analysis from climate researchers in that country
- Adding other climate metrics, such as number of deadly wet bulb days, growing degree days, or number of days over 30ºC is not possible with the source data
- Climate normals are not provided and need to be computed from scratch ([see normals computation for a subset of metrics in nca-counties-infrastructure](https://github.com/jackiryan/nca-counties-infrastructure/blob/main/scripts/create_gridded_raster.py))
- Data is sorted by Global Warming Levels (GWLs) rather than as a timeline. This allows for a scenario-independent data presentation, but may leave some users confused about the implied date that 2, 3, or 4ºC of warming will occur. 


As a result of these challenges, I have opted to re-analyze [downscaled daily CMIP6 outputs](https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6) myself and produce regional climate metrics in a consistent way for the entire world. You can find the code for that effort here: [cmip6-atlas](https://github.com/jackiryan/cmip6-atlas)

When that processing is complete, this frontend will be repurposed to allow users to explore a timeline-based (rather than GWL-based) representation of climate metrics for all nations. As not all countries have a concept of "counties", I'll need to determine some administrative boundary that provides a similar granularity for presenting the data. I prefer this approach (i.e., presenting data as metrics for vector counties) as opposed to gridded rasters because it offers improved performance when switching between datasets, and it obscures the low-resolution nature of model outputs. Since 25km model outputs are only about 1440x720, the pixelated appearance of these gridded rasters may be distracting or give users the impression that there ought to be a higher-resolution version.