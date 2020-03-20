
class TimeChart {
    constructor(covid_data) {
        this.old_model_offset = 3;
        this.forecast_period = 3;
        this.margin = 30;
        this.is_rerender = false;

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
        this.xdates = d3.scaleTime().domain([this.data.dates[0], new Date().setDate(this.data.dates[this.data.dates.length-1].getDate()+this.forecast_period)]);
        this.x = d3.scaleLinear().domain([0,this.data.totals.length+this.forecast_period]);
        this.ylinear = d3.scaleLinear().domain([0,3*this.data.max_count]);
        this.ylog = d3.scaleSymlog().domain([0,3*this.data.max_count]);
        this.y = this.ylinear;

        // Initialize to use the latest model
        this.useoldmodel = false;

        // Setup the tool tip.  Note that this is just one example, and that many styling options are available.
        // See original documentation for more details on styling: http://labratrevenge.com/d3-tip/
        let dates = this.data.date_strings;
        this.tool_tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-8, 0])
            .html(function(d,i) { return ""+d+" confirmed cases on " + dates[i]; });
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
        this.selected_region = region_name;
        this.render();
    }

    render() {
        // Update scales
        this.x.range([3*this.margin, this.width-2*this.margin]);
        this.xdates.range([3*this.margin, this.width-2*this.margin]);
        this.ylog.range([this.height-2*this.margin, this.margin]);
        this.ylinear.range([this.height-2*this.margin, this.margin]);


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
                .attr("y", this.ylinear(3*this.data.max_count))
                .attr("height", this.ylinear(0) - this.ylinear(3*this.data.max_count))
                .attr("width", this.xdates(new Date().setDate(this.data.dates[this.data.dates.length-1].getDate()+this.forecast_period)) - this.xdates(this.data.dates[this.data.dates.length-1]))
                .attr("stroke-width", "0")
                .style("fill", "#eeeeee")
                .style("stroke", "none");

            // Render the forecast boundary line.
            this.svg.append("line")
                .attr("id", "forecast_line")
                .attr("x1", this.xdates(this.data.dates[this.data.dates.length-1]))
                .attr("x2", this.xdates(this.data.dates[this.data.dates.length-1]))
                .attr("y1", this.y(0))
                .attr("y2", this.y(3*this.data.max_count))
                .attr("stroke-width", "1")
                .style("fill", "none")
                .style("stroke", "#bbbbbb");

            // Add text labels forecast boundary line.
            this.svg.append("text")
                .attr("id", "data_label")
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1]) - 5)
                .attr("y", this.y(3*this.data.max_count) + 5)
                .style("text-anchor", "end")
                .attr("dominant-baseline", "hanging")
                .style("fill", "#444444")
                .style("font-size", "10")
                .text("Historical Data");

            this.svg.append("text")
                .attr("id", "forecast_label")
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1]) + 5)
                .attr("y", this.y(3*this.data.max_count) + 5)
                .style("text-anchor", "start")
                .attr("dominant-baseline", "hanging")
                .style("fill", "#444444")
                .style("font-size", "10")
                .text("Forecast*");

            this.svg.append("text")
                .attr("id", "forecast_label_2")
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1]) + 5)
                .attr("y", this.y(3*this.data.max_count) + 18)
                .style("text-anchor", "start")
                .attr("dominant-baseline", "hanging")
                .style("fill", "#444444")
                .style("font-size", "7")
                .text("(Naive Exponential Model)");

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
                .attr("width", this.xdates(new Date().setDate(this.data.dates[this.data.dates.length-1].getDate()+this.forecast_period)) - this.xdates(this.data.dates[this.data.dates.length-1-(this.useoldmodel ? this.forecast_period : 0)]))
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1-(this.useoldmodel ? this.forecast_period : 0)]));

            this.svg.selectAll("#data_label")
                .transition().duration(500)
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1-(this.useoldmodel ? this.forecast_period : 0)]) - 5);

            this.svg.selectAll("#forecast_label")
                .transition().duration(500)
                .attr("x", this.xdates(this.data.dates[this.data.dates.length-1-(this.useoldmodel ? this.forecast_period : 0)]) + 5);

            this.svg.selectAll("#forecast_label_2")
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
            itodate.push(new Date().setDate(last_date.getDate()+i))
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

        // Calculate exponential regression
        let pairs = d3.zip(d3.range(this.data.totals.length-(this.useoldmodel ? this.old_model_offset : 0)), this.data.totals);
        console.log(pairs.length);
        // Avoid log(0) errors by alterning all zero values to "just over zero"
        pairs = pairs.map(d => (d[1] == 0 ? [d[0], 0.000001] : d));
        let exponential_model = exponential(pairs, {precision: 5});

        // Generate samples from the exponential model.
        let model_totals = d3.range(this.data.totals.length+this.forecast_period).map(d => exponential_model.predict(d)[1]);
        if (this.svg.select(".total_model_line").empty()) {
            this.svg.append("path")
                .datum(model_totals)
                .attr("class", "total_model_line")
                .attr("clip-path", "url(#chart-clip)")
                .attr("d", curve_generator)
                .attr("stroke-width", "2")
                .style("fill", "none")
                .style("stroke", "#8888ff")
                .style("stroke-dasharray", "4 2");
        }
        else {
            d3.select(".total_model_line")
                .transition().duration(500)
                .attr("d", curve_generator(model_totals));
        }

        if (this.svg.select(".total_line").empty()) {
            this.svg.append("path")
                .datum(this.data.totals)
                .attr("class", "total_line")
                .attr("d", line_generator)
                .attr("stroke-width", "4")
                .style("fill", "none")
                .style("stroke", "#888888");
        }
        else {
            d3.select(".total_line")
                .transition().duration(500)
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
            .style("fill", "#888888");
        total_dots
            .transition().duration(500)
                .attr("cx", function(d,i) {return x(itodate[i]);})
                .attr("cy", function(d,i) {return y(d);});

        // Now render the region dots.
        let region_data = []
        if (this.selected_region != undefined) {
            region_data = this.data.regions[this.selected_region];

            // First, the region model.
            // Calculate exponential regression
            pairs = d3.zip(d3.range(region_data.length-(this.useoldmodel ? this.old_model_offset : 0)), region_data);
            console.log(pairs.length);
            // Avoid log(0) errors by alterning all zero values to "just over zero"
            pairs = pairs.map(d => (d[1] == 0 ? [d[0], 0.000001] : d));
            let exponential_model = exponential(pairs, {precision: 5});
            // Generate samples from the exponential model.
            let model_totals = d3.range(region_data.length+this.forecast_period).map(d => exponential_model.predict(d)[1]);
            if (this.svg.select(".region_model_line").empty()) {
                this.svg.append("path")
                    .datum(model_totals)
                    .attr("class", "region_model_line")
                    .attr("clip-path", "url(#chart-clip)")
                    .attr("d", curve_generator)
                    .attr("stroke-width", "2")
                    .style("fill", "none")
                    .style("stroke", "#ff88ff")
                    .style("stroke-dasharray", "4 2")
                    .style("opacity", 0)
                            .transition().duration(500)
                            .style("opacity", 1)
            }
            else {
                d3.select(".region_model_line")
                    .transition().duration(500)
                    .attr("d", curve_generator(model_totals));
            }

            // Render the region data line since there is region data.
            if (this.svg.select(".region_line").empty()) {
                this.svg.append("path")
                    .datum(region_data)
                    .attr("class", "region_line")
                    .attr("d", line_generator)
                    .attr("stroke-width", "3")
                    .style("fill", "none")
                    .style("stroke", "#ff8844")
                    .style("opacity", 0)
                            .transition().duration(500)
                            .style("opacity", 1)
            }
            else {
                d3.select(".region_line").transition().duration(500).attr("d", line_generator(region_data));
            }
        }
        else {
            d3.select(".region_line")
                .transition().duration(500)
                .style("opacity", 0)
                .remove();
            d3.select(".region_model_line")
                .transition().duration(500)
                .style("opacity", 0)
                .remove();
        }

        // Region data dots
        let region_dots = this.svg.selectAll(".region_dot").data(region_data);
        region_dots.enter().append("circle")
            .attr("class", "region_dot")
            .attr("cx", function(d,i) {return x(itodate[i]);})
            .attr("cy", function(d,i) {return y(d);})
            .attr("r", 0)
            .on('mouseover', this.tool_tip.show)
            .on('mouseout', this.tool_tip.hide)
            .transition().duration(500)
            .attr("r", 3)
            .style("fill", "#ff8844");
        region_dots
            .transition().duration(500)
            .attr("cx", function(d,i) {return x(itodate[i]);})
            .attr("cy", function(d,i) {return y(d);})
            .attr("r", 3)
            .style("fill", "#ff8844");
        region_dots.exit()
            .transition().duration(500)
            .attr('r',0)
            .remove();
    }
}