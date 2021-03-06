class CovidData {
    constructor(raw_data, strip_substring, zero_padded_dates) {
        // Initialize an object to store the various data series.
        this.max_count = 0;
        this.dates = []
        this.date_strings = []

        // Set the first date of data.
        // let next_date  = new Date(2020,2,1);
        let next_date  = new Date(2020,2,10);
        let current_date  = new Date();
        current_date.setHours(0,0,0,0);
        current_date.setDate(current_date.getDate())
        while (next_date < current_date) {
            // Is the date in the data file?
            let string_form = (next_date.getFullYear()) + "-";
            let month = next_date.getMonth()+1;
            if ((zero_padded_dates == true) && (month < 10)) {
                string_form += "0";
            }
            string_form += month + "-";
            let day = next_date.getDate();
            if ((zero_padded_dates == true) && (day < 10)) {
                string_form += "0";
            }
            string_form += next_date.getDate();

            if (undefined != raw_data[0][string_form]) {
                this.dates.push(new Date(next_date));
                this.date_strings.push(string_form);
            }

            // Prepare for next iteration
            next_date.setDate(next_date.getDate()+1);
        }

        this.regions = {};
        for (let i=0; i < raw_data.length; i++) {
            let region_name = raw_data[i]['state'];
            region_name = region_name.substring(0, region_name.length - strip_substring.length);

            // Now iterate over dates.
            let region_data = [];
            for (let j=0; j<this.date_strings.length; j++) {
                let val_as_string = raw_data[i][this.date_strings[j]];
                let val = 0;
                if ((val_as_string === undefined) || (val_as_string.length == 0)) {
                    // If there is an empty cell (no data) use the previous day's number.
                    val = region_data[region_data.length-1]
                }
                else {
                    val = +val_as_string;
                }	
                if (isNaN(val)) {
                    // If we have a NaN, use the previous day's data...
                    if (j>0) {
                        val = region_data[region_data.length-1]
                    }
                    else {
                        // Unless this is the first day.  Then make it zero.
                        val = 0;
                    }
                }
                region_data.push(val);
            }

            this.regions[region_name] = region_data;
        }

        // Now calculate total for the entire state.
        this.totals = []
        for (let i=0; i<this.date_strings.length; i++) {
            let date_total = 0;
            let region_names = Object.keys(this.regions);
            for (let j=0; j<region_names.length; j++) {
                let val = this.regions[region_names[j]][i]
                date_total += val;
            }
            if (date_total > this.max_count) {
                this.max_count = date_total;
            }
            this.totals.push(date_total);
        }
    }
}
