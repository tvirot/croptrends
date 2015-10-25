var fs = require('fs');
var scale = require('d3-scale');

var commodities = [
  'barley', 'beans', 'canola', 'corn',
  'cotton-pima', 'cotton-upland', 'flaxseed', 'hay-alfalfa',
  'hay-others', 'oats', 'peanuts', 'rice', 'sorghum' ,
  'soybeans', 'sugarbeets', 'sugarcane', 'sunflower-non-oil',
  'sunflower-oil', 'sweet-potatoes', 'tobacco-burley', 'tobacco-flue-cured',
  'wheat-durum', 'wheat-spring', 'wheat-winter'
];
var stats = ['planted', 'harvested', 'yield', 'production'];
var noPlanted = [
  'hay-alfalfa', 'hay-others', 'sugarcane', 'tobacco-burley',
  'tobacco-flue-cured',
  ]

var c = commodities[23];

for (var i in stats) {
  var s = stats[i];
  var key = c + '-' + s;
  console.log(key);

  if (s === 'planted' && noPlanted.indexOf(c) >= 0) continue;

  var national = JSON.parse(fs.readFileSync('../dat/tmp/' + key + '-national.json', 'utf8')).data;
  var state = JSON.parse(fs.readFileSync('../dat/tmp/' + key + '-state.json', 'utf8')).data;
  var county = JSON.parse(fs.readFileSync('../dat/tmp/' + key + '-county.json', 'utf8')).data;

  var summary = {
    national: { data:{}, yRange:[undefined, undefined], name: 'United States'},
    state: {},
    county: {},
    metadata: {}
  };

  summary.metadata.unit = county[0].unit_desc;
  summary.metadata.yearRange = [undefined, undefined];


  // == COUNTY ==
  console.log("Processing county-level data");

  var values = []
  currentItem = county[0].data_item;
  county.forEach(function(d) {
    // Skip some data
    if (d.county_code === "998" || d.county_code === null) {
      // console.log("Skipping: " + d.location_desc);
      return;
    }

    // Check data
    if (d.unit_desc !== summary.metadata.unit) {
      throw "Mixed units: " + [d.unit_desc, summary.metadata.unit];
    } else if (d.data_item !== currentItem) {
      throw "Mixed data item: " + [d.data_item, currentItem];
    }

    var countyCode = +(d.state_fips_code + d.county_code);
    var value = +d.value.replace(/,/g, "");
    values.push(value);

    // if (!d.county_name) {
    //  console.log(d)
    // };

    if(!summary.county.hasOwnProperty(countyCode)) {
      summary.county[countyCode] = {
        data: {},
        yRange: [undefined, undefined],
        name: capitalize(d.county_name) + " " + d.state_alpha
      };
    } else if (summary.county[countyCode].data.hasOwnProperty(d.year)) {
      console.log('Existing value: ' + summary.county[countyCode].data[d.year]);
      throw "There are multiple records corresponding to " + JSON.stringify(d);
    }

    summary.county[countyCode].data[d.year] = value;

    if (summary.county[countyCode].yRange[0] === undefined ||
      summary.county[countyCode].yRange[0] > value) {
      summary.county[countyCode].yRange[0] = value;
    }
    if (summary.county[countyCode].yRange[1] === undefined ||
      summary.county[countyCode].yRange[1] < value) {
      summary.county[countyCode].yRange[1] = value;
    }

    if (summary.metadata.yearRange[0] === undefined ||
      summary.metadata.yearRange[0] > d.year) {
      summary.metadata.yearRange[0] = d.year;
    }
    if (summary.metadata.yearRange[1] === undefined ||
      summary.metadata.yearRange[1] < d.year) {
      summary.metadata.yearRange[1] = d.year;
    }

  });

  var quantiles = scale.quantile()
    .domain(values)
    .range([1, 2, 3, 4, 5, 6, 7])
    .quantiles();
  summary.metadata.colorQuantiles = quantiles.map(prettifyNumber);

  // console.log(summary.county['30105'].name)
  // console.log(summary.metadata.yearRange);
  // console.log(summary.metadata.colorQuantiles);

  // == STATE ==
  console.log("Processing state-level data");

  currentItem = state[0].data_item;
  state.forEach(function(d) {
    // Skip some data
    if (d.year < summary.metadata.yearRange[0] ||
      d.year > summary.metadata.yearRange[1]) {
      console.log("Skipping: " + d.year);
      return;
    }

    // Check data
    if (d.unit_desc !== summary.metadata.unit) {
      throw "Mixed units: " + [d.unit_desc, summary.metadata.unit];
    } else if (d.data_item !== currentItem) {
      throw "Mixed data item: " + [d.data_item, currentItem];
    }

    var stateCode = +(d.state_fips_code);
    var value = +d.value.replace(/,/g, "");

    if(!summary.state.hasOwnProperty(stateCode)) {
      summary.state[stateCode] = {
        data: {},
        yRange: [undefined, undefined],
        name: capitalize(d.state_name)
      };
    } else if (summary.state[stateCode].data.hasOwnProperty(d.year)) {
      console.log('Existing value: ' + summary.state[stateCode].data[d.year]);
      throw "There are multiple records corresponding to " + JSON.stringify(d);
    }

    summary.state[stateCode].data[d.year] = value;

    if (summary.state[stateCode].yRange[0] === undefined ||
      summary.state[stateCode].yRange[0] > value) {
      summary.state[stateCode].yRange[0] = value;
    }
    if (summary.state[stateCode].yRange[1] === undefined ||
      summary.state[stateCode].yRange[1] < value) {
      summary.state[stateCode].yRange[1] = value;
    }
  });

  // console.log(summary.state["27"].name);
  // console.log(summary.metadata.yearRange);


  // == NATIONAL ==
  console.log("Processing national-level data");

  currentItem = state[0].data_item;
  national.forEach(function(d) {
    // Skip some data
    if (d.year < summary.metadata.yearRange[0] ||
      d.year > summary.metadata.yearRange[1]) {
      console.log("Skipping: " + d.year);
      return;
    }

    // Check data
    if (d.unit_desc !== summary.metadata.unit) {
      throw "Mixed units: " + [d.unit_desc, summary.metadata.unit];
    } else if (d.data_item !== currentItem) {
      throw "Mixed data item: " + [d.data_item, currentItem];
    }

    var value = +d.value.replace(/,/g, "");

    if (summary.national.data.hasOwnProperty(d.year)) {
      console.log('Existing value: ' + summary.national.data[d.year]);
      throw "There are multiple records corresponding to " + JSON.stringify(d);
    }

    summary.national.data[d.year] = value;

    if (summary.national.yRange[0] === undefined ||
      summary.national.yRange[0] > value) {
      summary.national.yRange[0] = value;
    }
    if (summary.national.yRange[1] === undefined ||
      summary.national.yRange[1] < value) {
      summary.national.yRange[1] = value;
    }
  });

  fs.writeFileSync("../dat/nass/" + key + ".json",
    JSON.stringify(summary)
  );
}


function prettifyNumber(n) {
  var log = Math.floor(Math.log10(n));
  var fraction = (log > 1) ? 4 : 1;

  return Math.round(n * fraction * Math.pow(10, -log)) /
    fraction /
    Math.pow(10, -log);
}

function capitalize(str) {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, function(a) {
    return a.toUpperCase();
  });
};
