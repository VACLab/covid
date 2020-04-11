class NCMap {
    constructor(covid_data, map_data, units) {
        // Listen to resize events.
        let container = document.getElementById("map_container");
        let this_vis = this;
        this.data = covid_data;
        this.map_data = map_data;
        let map_div = d3.select("#map_container");
        this.units = units;
        this.max_value = 0;
        let region_names = Object.keys(this.data.regions);
        for (let i=0; i<region_names.length; i++) {
            let region_values = this.data.regions[region_names[i]];
            let last_value_for_region = region_values[region_values.length-1];
            if (last_value_for_region > this.max_value) {
                this.max_value = last_value_for_region;
            }
        }

        this.svg = map_div.append("svg")
            .attr("id", "map")
            .style("height", "100px")
            .style("width", "300px");

        let size_observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                let width = Math.floor(entry.contentRect.width);
                let height = Math.floor(entry.contentRect.height);
                // A resize handler is required of all subclasses...
                this_vis.resize(height, width);
            }
        });
        size_observer.observe(container);

        this.svg.append("g")
            .attr('id','mapgroup');

        this.tool_tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-8, 0])
            .html(function(d,i) {
                let case_count = 0;
                let county_name = d.properties.NAME + " County"
                let county_vals = covid_data.regions[county_name];
                if (county_vals != undefined) {
                    case_count = county_vals[county_vals.length-1];
                }
                return "" + case_count + " " + units + " in " + d.properties.NAME + " County";
            });
        this.svg.call(this.tool_tip);
    }

    resize(height, width) {
        this.height = height;
        this.width = width;

        // Set width of SVG element.
        this.svg
            .style("height", this.height+"px")
            .style("width", this.width+"px");

        // Scale the map.
        let scale_factor = Math.min(this.width / 300.0, this.height / 100.0);
        this.svg.select("#mapgroup")
            .attr("transform", "scale(" + scale_factor + " " + scale_factor + ")");

        this.render();
    }

    render() {
        let thisvis = this;

        //let projection = d3.geoAlbersUsa()
        //    .translate([-400, -15]) // translate to center of screen
        let projection = d3.geoMercator()
            //.translate([2900, 1400]) // translate to center of screen
            .translate([2216, 1034]) // translate to center of screen
            .scale([1500]); // scale things down so see entire US

        // Define path generator
        let path = d3.geoPath().projection(projection);

        let val_range = [0,this.max_value];
        let colormap = d3.scaleLinear().domain(val_range).range(["white", "red"]);


        // Add the map.
        this.svg.select("#mapgroup").selectAll("path")
            .data(topojson.feature(this.map_data, this.map_data.objects.cb_2015_north_carolina_county_20m).features)
            .enter().append("path")
            .attr("d", path)
            .on('mouseover', this.tool_tip.show)
            .on('mouseout', this.tool_tip.hide)
            .on('click', function(d) {
                legend_select(d.properties.NAME + " County");
                covid_time_chart.select(d.properties.NAME + " County");
            })
            .attr("stroke", "#888888")
            .attr("stroke-width", "1px")
            .attr("fill", function(d) {
                let county_name = d.properties.NAME + " County";
                let county_vals = thisvis.data.regions[county_name];
                if (county_vals === undefined) {
                    return colormap(0);
                }
                else {
                    return colormap(county_vals[county_vals.length-1]);
                }
            });
    }
}