
class TimeChart {
    constructor(covid_data, grand_total_label) {
        this.old_model_offset = 3;
        this.forecast_period = 3;
        this.margin = 30;
        this.is_rerender = false;
        this.selected_region_list = [];
        this.show_totals = true;
        this.color_mapped_regions = [];
        this.grand_total_label = grand_total_label;

        // Listen to resize events.
        let container = document.getElementById("time_chart_container");
        let this_vis = this;
        this.data = covid_data;
        let time_chart_div = d3.select("#time_chart_container");

        this.svg = time_chart_div.append("svg")
             .attr("id", "time_chart")
            .style("height", 600)
            .style("width", 200);

        let size_observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                let width = Math.floor(entry.contentRect.width);
                let height = Math.floor(entry.contentRect.height);
                // A resize handler is required of all subclasses...
                this_vis.resize(height, width);
            }
        });
        size_observer.observe(container);

        // Scales
        this.end_date = new Date();
        this.end_date.setDate(this.data.dates[this.data.dates.length-1].getDate()+this.forecast_period);
        this.end_date.setHours(0,0,0,0);
        this.xdates = d3.scaleTime().domain([this.data.dates[0], this.end_date]);
        this.x = d3.scaleLinear().domain([0,this.data.totals.length+this.forecast_period]);
        this.ylinear = d3.scaleLinear().domain([0,3*this.data.max_count]);
        this.ylog = d3.scaleSymlog().domain([0,3*this.data.max_count]);
        this.y = this.ylinear;
        this.colors = d3.scaleOrdinal().range(d3.schemeCategory10);

        // Initialize to use the latest model
        this.useoldmodel = false;

        // Setup the tool tip.  Note that this is just one example, and that many styling options are available.
        // See original documentation for more details on styling: http://labratrevenge.com/d3-tip/
        let numformat = d3.format(",");
        let dates = this.data.date_strings;
        this.tool_tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-8, 0])
            .html(function(d,i) { return ""+numformat(d)+" confirmed cases on " + dates[i]; });
        this.svg.call(this.tool_tip);

        // Define a clipping region.  x/y/h/w will be updated in render based on current scales.
        this.svg.append("clipPath")
                .attr("id", "chart-clip")
                    .append("rect")
                    .attr("id", "chart-clip-rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", 1)
                    .attr("height", 1);
    }

    resize(height, width) {
        this.height = height;
        this.width = width;

        // Set width of SVG element.
        this.svg
            .style("height", this.height+"px")
            .style("width", this.width+"px");

        this.render();
    }

    use_old_model(flag) {
        this.useoldmodel = flag;
        this.render()
    }

    use_log_scale(flag) {
        if (flag) {
            this.y = this.ylog;
        }
        else {
            this.y = this.ylinear;
        }
        this.render()
    }

    select(region_name) {
        let region_index = this.selected_region_list.indexOf(region_name);

        if (region_index < 0) {
            // Add the region
            this.selected_region_list.push(region_name)
        }
        else {
            // Remove the region
            this.selected_region_list.splice(region_index,1)
        }
        this.render();
    }

    toggle_total() {
        this.show_totals = !this.show_totals;
        this.render();
    }

    render() {
        let colorscale = this.colors;

        // For each selected region, create an object that includes the corresponding data and model.  We do this first
        // so we can get a max count value, which we can in turn use to scale the visualization.
        let selected_region_data = this.selected_region_list.map(region => {
            let region_data = this.data.regions[region];
            // First, the region model.
            // Calculate exponential regression
            let pairs = d3.zip(d3.range(region_data.length-(this.useoldmodel ? this.old_model_offset : 0)), region_data);
            // Avoid log(0) errors by alterning all zero values to "just over zero"
            pairs = pairs.map(d => (d[1] == 0 ? [d[0], 0.000001] : d));
            let exponential_model = exponential(pairs, {precision: 5});
            // Generate samples from the exponential model.
            let model_totals = d3.range(region_data.length+this.forecast_period).map(d => exponential_model.predict(d)[1]);

            return {
                region: region,
                real_data: region_data,
                model_data: model_totals
            }
        });

        // Calculate exponential regression for the totals, and sample it to use for drawing the total chart.  Similarly, we
        // do this first so we can get a good max value for scaling the visualizations.
        let pairs = d3.zip(d3.range(this.data.totals.length-(this.useoldmodel ? this.old_model_offset : 0)), this.data.totals);
        // Avoid log(0) errors by alterning all zero values to "just over zero"
        pairs = pairs.map(d => (d[1] == 0 ? [d[0], 0.000001] : d));
        let exponential_model = exponential(pairs, {precision: 5});
        let model_totals = d3.range(this.data.totals.length+this.forecast_period).map(d => exponential_model.predict(d)[1]);

        //////////////////////////////////////////////////////////////////////
        // Find the max value across all regions.
        //////////////////////////////////////////////////////////////////////
        let max_observed_value = 0;
        for (let i=0; i<selected_region_data.length; i++) {
            max_observed_value = Math.max(max_observed_value, d3.max(selected_region_data[i].model_data));
            max_observed_value = Math.max(max_observed_value, d3.max(selected_region_data[i].real_data));
        }
        if (this.show_totals) {
            max_observed_value = Math.max(max_observed_value, model_totals[model_totals.length-1])
            max_observed_value = Math.max(max_observed_value, this.data.totals[this.data.totals.length-1])
        }

        //////////////////////////////////////////////////////////////////////
        // Update scales
        //////////////////////////////////////////////////////////////////////
        this.x.range([3*this.margin, this.width-2*this.margin]);
        this.xdates.range([3*this.margin, this.width-2*this.margin]);
        this.ylog.range([this.height-2*this.margin, this.margin]);
        this.ylinear.range([this.height-2*this.margin, this.margin]);
        // Apply the max observed value.
        this.ylinear.domain([0,1.05*max_observed_value]);
        this.ylog.domain([0,1.05*max_observed_value]);

        //////////////////////////////////////////////////////////////////////
        // Render
        //////////////////////////////////////////////////////////////////////
        if (!this.is_rerender) {
            this.is_rerender = true;

            // Define the clipping region size
            this.svg.select("#chart-clip-rect")
                .attr("x", 3*this.margin)
                .attr("y", this.margin)
                .attr("width", (this.width-2*this.margin) - 3*this.margin)
                .attr("height", (this.height - 2*this.margin) - this.margin);

            // Render the forecast region background.
            this.svg.append("rect")
                .attr("id", "forecast_zone")
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1]))
                .attr("y", this.ylinear(this.ylinear.domain()[1]))
                .attr("height", this.ylinear(0) - this.ylinear(this.ylinear.domain()[1]))
                .attr("width", this.xdates(this.end_date) - this.xdates(this.data.dates[this.data.dates.length-1]))
                .attr("stroke-width", "0")
                .style("fill", "#eeeeee")
                .style("stroke", "none");

            // Render the forecast boundary line.
            this.svg.append("line")
                .attr("id", "forecast_line")
                .attr("x1", this.xdates(this.data.dates[this.data.dates.length-1]))
                .attr("x2", this.xdates(this.data.dates[this.data.dates.length-1]))
                .attr("y1", this.y(0))
                .attr("y2", this.y(this.y.domain()[1]))
                .attr("stroke-width", "1")
                .style("fill", "none")
                .style("stroke", "#bbbbbb");

            // Add text labels forecast boundary line.
            this.svg.append("text")
                .attr("id", "data_label")
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1]) - 5)
                .attr("y", this.y(this.y.domain()[1]) + 5)
                .style("text-anchor", "end")
                .attr("dominant-baseline", "hanging")
                .style("fill", "#444444")
                .style("font-size", "10")
                .text("Historical Data");

            this.svg.append("text")
                .attr("id", "forecast_label")
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1]) + 5)
                .attr("y", this.y(this.y.domain()[1]) + 5)
                .style("text-anchor", "start")
                .attr("dominant-baseline", "hanging")
                .style("fill", "#444444")
                .style("font-size", "10")
                .text("Forecast*");

            // Add axes.  First the X axis and label.
            this.xaxis = d3.axisBottom(this.xdates);
            this.svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0,"+(this.height-2*this.margin)+")")
                .call(this.xaxis);

            this.svg.append("text")
                .attr("id", "xaxislabel")
                .attr("class", "axis-label")
                .attr("y", this.height-0.5*this.margin)
                .attr("x",3*this.margin + ((this.width-4*this.margin) / 2))
                .style("text-anchor", "middle")
                .text("Date");

            // Now the Y axis and label.
            this.yaxis = d3.axisLeft(this.y);
            this.rightyaxis = d3.axisRight(this.y);
            this.svg.append("g")
                .attr("class", "y axis left")
                .attr("transform", "translate("+3*this.margin+",0)")
                .call(this.yaxis);

            this.svg.append("g")
                .attr("class", "y axis right")
                .attr("transform", "translate("+(this.width-2*this.margin)+",0)")
                .call(this.rightyaxis);

            this.svg.append("text")
                .attr("transform", "rotate(90)")
                .attr("class", "axis-label")
                .attr("y", -0.5*this.margin)
                .attr("x",1*this.margin + ((this.height - 3*this.margin) / 2))
                .style("text-anchor", "middle")
                .text("Number of Cases");
        }
        else {
            // Update the axes themselves.
            this.yaxis.scale(this.y);
            this.rightyaxis.scale(this.y);
            this.xaxis.scale(this.xdates);
            this.svg.selectAll("g.y.axis.left")
                .transition().duration(500)
                .call(this.yaxis);
            this.svg.selectAll("g.y.axis.right")
                .transition().duration(500)
                .attr("transform", "translate("+(this.width-2*this.margin)+",0)")
                .call(this.rightyaxis);
            this.svg.selectAll("g.x.axis")
                .transition().duration(500)
                .call(this.xaxis);

            // Update the clipping region size
            this.svg.select("#chart-clip-rect")
                .transition().duration(500)
                .attr("x", 3*this.margin)
                .attr("y", this.margin)
                .attr("width", (this.width-2*this.margin) - 3*this.margin)
                .attr("height", (this.height - 2*this.margin) - this.margin);

            this.svg.selectAll("#forecast_line")
                .transition().duration(500)
                .attr("x1", this.xdates(this.data.dates[this.data.dates.length-1-(this.useoldmodel ? this.forecast_period : 0)]))
                .attr("x2", this.xdates(this.data.dates[this.data.dates.length-1-(this.useoldmodel ? this.forecast_period : 0)]));

            this.svg.selectAll("#forecast_zone")
                .transition().duration(500)
                .attr("width", this.xdates(this.end_date) - this.xdates(this.data.dates[this.data.dates.length-1-(this.useoldmodel ? this.forecast_period : 0)]))
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1-(this.useoldmodel ? this.forecast_period : 0)]));

            this.svg.selectAll("#data_label")
                .transition().duration(500)
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1-(this.useoldmodel ? this.forecast_period : 0)]) - 5);

            this.svg.selectAll("#forecast_label")
                .transition().duration(500)
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1-(this.useoldmodel ? this.forecast_period : 0)]) + 5);

            // Now update the x axis label.
            let xlabel = this.svg.select("#xaxislabel");
            let newwidth = 3*this.margin + ((this.width-4*this.margin) / 2);
            xlabel
                .transition().duration(500)
                .attr("x", newwidth);
        }

        let x = this.xdates;
        let y = this.y;
        let itodate = []
        // Copy all dates from the actual data
        for (let i=0; i<this.data.dates.length; i++) {
            itodate.push(this.data.dates[i]);
        }
        // Now add dates for the forecast period.
        let last_date = this.data.dates[this.data.dates.length-1];
        for (let i=1; i<=this.forecast_period; i++) {
            let new_date = new Date();
            new_date.setDate(last_date.getDate()+i)
            itodate.push(new_date)
        }

        // Generator for the data line
        let line_generator = d3.line()
            .x(function(d,i) {return x(itodate[i]);})
            .y(function(d,i) {return y(d);});

        // Generator the model curve
        let curve_generator = d3.line()
            .x(function(d,i) {return x(itodate[i]);})
            .y(function(d,i) {return y(d);})
            .curve(d3.curveBasis)
            //.curve(d3.curveCatmullRom.alpha(0.9));

        // Draw the total model.
        if (this.svg.select(".total_model_line").empty()) {
            this.svg.append("path")
                .datum(model_totals)
                .attr("class", "total_model_line")
                .attr("clip-path", "url(#chart-clip)")
                .attr("d", curve_generator)
                .attr("stroke-width", "2")
                .style("fill", "none")
                .style("stroke", "#999999")
                .style("stroke-dasharray", "4 2");
        }
        else {
            d3.select(".total_model_line")
                .transition().duration(500)
                .style("opacity", (this.show_totals ? 1 : 0))
                .attr("d", curve_generator(model_totals));
        }

        if (this.svg.select(".total_line").empty()) {
            this.svg.append("path")
                .datum(this.data.totals)
                .attr("class", "total_line")
                .attr("d", line_generator)
                .attr("stroke-width", "4")
                .style("fill", "none")
                .style("stroke", "#777777");
        }
        else {
            d3.select(".total_line")
                .transition().duration(500)
                .style("opacity", (this.show_totals ? 1 : 0))
                .attr("d", line_generator);
        }

        // Render the total dots
        let total_dots = this.svg.selectAll(".total_dot").data(this.data.totals);
        total_dots.enter().append("circle")
            .attr("class", "total_dot")
            .attr("cx", function(d,i) {return x(itodate[i]);})
            .attr("cy", function(d,i) {return y(d);})
            .attr("r", 5)
            .on('mouseover', this.tool_tip.show)
            .on('mouseout', this.tool_tip.hide)
            .style("fill", "#777777");
        total_dots
            .transition().duration(500)
                .style("opacity", (this.show_totals ? 1 : 0))
                .attr("cx", function(d,i) {return x(itodate[i]);})
                .attr("cy", function(d,i) {return y(d);});


        // Now render the region model lines.
        let region_model_lines = this.svg.selectAll(".region_model_line").data(selected_region_data, function(d,i) { return d.region; });

        let mapped_regions = this.color_mapped_regions;
        let get_data_index = function(region) {
            let index = mapped_regions.indexOf(region);
            if (index < 0) {
                mapped_regions.push(region);
                return mapped_regions.length - 1;
            }
            else {
                return index;
            }
        }

        region_model_lines
            .transition().duration(500)
            .attr("d", function(d) { return curve_generator(d.model_data); });

        region_model_lines.enter().append("path")
                .attr("class", "region_model_line")
                .attr("clip-path", "url(#chart-clip)")
                .attr("d", function(d) { return curve_generator(d.model_data);})
                .attr("stroke-width", "2")
                .style("fill", "none")
                .style("stroke", function(d,i) {return colorscale(get_data_index(d.region));})
            .style("stroke-dasharray", "4 2")
                .style("opacity", 0)
                .transition().duration(500)
                .style("opacity", 0.5);

        region_model_lines.exit()
            .transition().duration(500)
            .style("opacity", 0)
            .remove();

        // Now render the region lines.
        let region_lines = this.svg.selectAll(".region_line").data(selected_region_data, function(d,i) { return d.region; });

        region_lines
            .transition().duration(500)
            .attr("d", function(d) { return line_generator(d.real_data); });

        region_lines.enter()
            .append("path")
                .attr("class", "region_line")
                .attr("d", function(d) { return line_generator(d.real_data); })
                .attr("stroke-width", "3")
                .style("fill", "none")
                //.style("stroke", "#ff8844")
                .style("stroke", function(d,i) {return colorscale(get_data_index(d.region))})
                .style("opacity", 0)
                        .transition().duration(500)
                        .style("opacity", 1)

        region_lines.exit()
            .transition().duration(500)
            .style("opacity", 0)
            .remove();

        // Finally, the region data dots
        // Add a group for each region.
        let region_dot_groups = this.svg.selectAll(".region_dot_group").data(selected_region_data, function(d,i) { return d.region;});

        region_dot_groups.selectAll(".region_dot").data(function(d) { return d.real_data; })
            .transition().duration(500)
            .attr("cx", function(d,i) {return x(itodate[i]);})
            .attr("cy", function(d,i) {return y(d);})
            .attr("r", 3);

        region_dot_groups.enter().append("g")
            .attr("class", "region_dot_group")
                .selectAll(".region_dot").data(function(d) { return d.real_data; })
                .enter().append("circle")
                    .attr("class", "region_dot")
                    .attr("cx", function(d,i) {return x(itodate[i]);})
                    .attr("cy", function(d,i) {return y(d);})
                    .style("fill", function(d,i) { return colorscale((get_data_index(d3.select(this.parentNode).datum().region))) })
                    //.style("fill", "#ff8844")
                    .attr("r", 0)
                    .on('mouseover', this.tool_tip.show)
                    .on('mouseout', this.tool_tip.hide)
                    .transition().duration(500)
                    .attr("r", 3);

        region_dot_groups.exit()
            .transition().duration(500)
            .style("opacity", 0)
            .remove();

        // Render the legend.
        let legend_labels = this.svg.selectAll(".legend_text").data((this.show_totals ? [this.grand_total_label] : []).concat(this.selected_region_list), function(d,i) {return d;});
        let margin = this.margin;

        legend_labels
            .transition().duration(500)
            .attr('y', function(d,i) {return margin + 10 + i*18})

        let grand_total_label = this.grand_total_label;
        legend_labels.enter().append("text")
            .attr("class", "legend_text")
            .attr('x', 3*this.margin + 10)
            .attr('y', function(d,i) {return margin + 10 + i*18})
            .style("font-size", "12")
            .style("fill", function(d) { return (d===grand_total_label? '#888888' : colorscale(get_data_index(d))) })
            .text(function(d) { return d;});

        legend_labels.exit()
            .transition().duration(500)
            .style("opacity", 0)
            .remove();


    }
}