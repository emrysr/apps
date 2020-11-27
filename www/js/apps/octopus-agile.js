
var apikey = _API_KEY;
var sessionwrite = _SESSIONWRITE;

apikeystr = "";
if (apikey != "") apikeystr = "&apikey=" + apikey;

var view_mode = "energy";

// ----------------------------------------------------------------------
// Display
// ----------------------------------------------------------------------
// $("body").css('background-color', 'WhiteSmoke');
$(window).ready(function () {
    //$("#footer").css('background-color','#181818');
    //$("#footer").css('color','#999');
});

if (!sessionwrite) $(".openconfig").hide();

// ----------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------
config.app = {
    "title": { "type": "value", "default": "OCTOPUS AGILE", "name": "Title", "description": "Optional title for app" },
    "import": { "optional": true, "type": "feed", "autoname": "import", "engine": "5" },
    "import_kwh": { "type": "feed", "autoname": "import_kwh", "engine": 5 },
    "use_kwh": { "optional": true, "type": "feed", "autoname": "use_kwh", "engine": 5 },
    "solar_kwh": { "optional": true, "type": "feed", "autoname": "solar_kwh", "engine": 5 },
    "region": { "type": "select", "name": "Select region:", "default": "D_Merseyside_and_Northern_Wales", "options": ["A_Eastern_England", "B_East_Midlands", "C_London", "E_West_Midlands", "D_Merseyside_and_Northern_Wales", "F_North_Eastern_England", "G_North_Western_England", "H_Southern_England", "J_South_Eastern_England", "K_Southern_Wales", "L_South_Western_England", "M_Yorkshire", "N_Southern_Scotland", "P_Northern_Scotland"] }
};
config.name = "Octopus Agile";
config.db = { "region": "D_Merseyside_and_Northern_Wales", "import_kwh": "2", "import": "1", "use_kwh": "2" };

config.feeds = feed.list;

config.initapp = function () { init() };
config.showapp = function () { show() };
config.hideapp = function () { hide() };

var regions_import = {
    "A_Eastern_England": 396124,
    "B_East_Midlands": 396125,
    "C_London": 396126,
    "E_West_Midlands": 396127,
    "D_Merseyside_and_Northern_Wales": 396105,
    "F_North_Eastern_England": 396128,
    "G_North_Western_England": 396129,
    "H_Southern_England": 396138,
    "J_South_Eastern_England": 396139,
    "K_Southern_Wales": 396140,
    "L_South_Western_England": 396141,
    "M_Yorkshire": 396142,
    "N_Southern_Scotland": 396143,
    "P_Northern_Scotland": 396144
}

var regions_outgoing = {
    "A_Eastern_England": 399374,
    "B_East_Midlands": 399361,
    "C_London": 399362,
    "E_West_Midlands": 399363,
    "D_Merseyside_and_Northern_Wales": 399364,
    "F_North_Eastern_England": 399365,
    "G_North_Western_England": 399366,
    "H_Southern_England": 399367,
    "J_South_Eastern_England": 399368,
    "K_Southern_Wales": 399369,
    "L_South_Western_England": 399370,
    "M_Yorkshire": 399371,
    "N_Southern_Scotland": 399372,
    "P_Northern_Scotland": 399373
}

// ----------------------------------------------------------------------
// APPLICATION
// ----------------------------------------------------------------------
var feeds = {};
var meta = {};
var data = {};
var graph_series = [];
var previousPoint = false;
var viewmode = "graph";
var viewcostenergy = "energy";
var panning = false;
var period_text = "month";
var period_average = 0;
var comparison_heating = false;
var comparison_transport = false;
var flot_font_size = 12;
var updaterinst = false;
var this_halfhour_index = -1;
// disable x axis limit
view.limit_x = false;
var solarpv_mode = false;

config.init();

function init () {

}

function show () {
    // $("body").css('background-color', 'WhiteSmoke');
    $("#app-title").html(config.app.title.value);

    // Quick translation of feed ids
    feeds = {};
    for (var key in config.app) {
        if (config.app[key].value) feeds[key] = config.feedsbyid[config.app[key].value];
    }
    resize();

    setPeriod('T');
    graph_load();
    graph_draw();

    updater();
    updaterinst = setInterval(updater, 5000);
    $(".ajax-loader").hide();
}

function setPeriod (period) {
    switch (period) {
        case 'T':
            //Today
            var d = new Date();
            d.setHours(0, 0, 0, 0);
            view.start = d.getTime();
            d.setHours(24, 0, 0, 0);
            view.end = d.getTime();
            //view.timewindow(3600000);
            break;
        case 'Y':
            //Yesterday
            var d = new Date();
            d.setHours(0, 0, 0, 0);
            view.end = d.getTime();
            d.setHours(-24);
            view.start = d.getTime();
            //view.timewindow(3600000);
            break;
        case 'W':
            //Week
            var d = new Date();
            view.end = d.getTime();
            d.setHours(0, 0, 0, 0);
            d.setHours(-24 * d.getDay());
            view.start = d.getTime();
            // view.timewindow(3600000);
            break;
        case 'M':
            // Month
            var d = new Date();
            view.end = d.getTime();
            d.setHours(0, 0, 0, 0);
            d.setHours(-24 * (d.getDate() - 1));
            view.start = d.getTime();
            // view.timewindow(3600000);
            break;
        case '12':
        case '24':
        case '168':
        case '720':
        case '1440':
            var timeWindow = (3600000 * period);
            view.end = (new Date()).getTime();
            view.start = view.end - timeWindow;

            if (period <= 24) {
                view.end += 3600 * 4 * 1000; // show 4h of forecast for short time ranges
            }
            // view.timewindow(timeWindow);
            break;
        default:
            alert('Invalid time period');
            break;
    }
}

function hide () {
    clearInterval(updaterinst);
}

function updater () {
    feed.listbyidasync(function (result) {
        if (result === null) { return; }

        for (var key in config.app) {
            if (config.app[key].value) feeds[key] = result[config.app[key].value];
        }

        if (feeds["import"] != undefined) {
            if (viewcostenergy == "energy") {
                if (feeds["import"].value < 10000) {
                    $("#power_now").html(Math.round(feeds["import"].value) + "<span class='units'>W</span>");
                } else {
                    $("#power_now").html((feeds["import"].value * 0.001).toFixed(1) + "<span class='units'>kW</span>");
                }
            } else {
                $("#power_now").html(config.app.currency.value + (feeds["import"].value * 1 * config.app.unitcost.value * 0.001).toFixed(3) + "<span class='units'>/hr</span>");
            }
        }
    });
}

// -------------------------------------------------------------------------------
// EVENTS
// -------------------------------------------------------------------------------
// The buttons for these graph events are hidden when in historic mode 
// The events are loaded at the start here and dont need to be unbinded and binded again.
$("#zoomout").click(function () { view.zoomout(); graph_load(); graph_draw(); });
$("#zoomin").click(function () { view.zoomin(); graph_load(); graph_draw(); });
$('#right').click(function () { view.pan_speed = 0.5; view.panright(); graph_load(); graph_draw(); });
$('#left').click(function () { view.pan_speed = 0.5; view.panleft(); graph_load(); graph_draw(); });
$('#fastright').click(function () { view.pan_speed = 1.0; view.panright(); graph_load(); graph_draw(); });
$('#fastleft').click(function () { view.pan_speed = 1.0; view.panleft(); graph_load(); graph_draw(); });


$('.time').click(function () {
    setPeriod($(this).attr("time"));
    // view.timewindow(period);
    graph_load();
    graph_draw();
});

$('.time-select').change(function () {
    setPeriod($(this).val());
    // view.timewindow(period);
    graph_load();
    graph_draw();
});

$("#advanced-toggle").click(function () {
    var mode = $(this).html();
    if (mode == "SHOW DETAIL") {
        $("#advanced-block").show();
        $(this).html("HIDE DETAIL");
    } else {
        $("#advanced-block").hide();
        $(this).html("SHOW DETAIL");
    }
});

$('#placeholder').bind("plothover", function (event, pos, item) {
    if (item) {
        var z = item.dataIndex;

        if (previousPoint != item.datapoint) {
            previousPoint = item.datapoint;

            $("#tooltip").remove();
            var itemTime = item.datapoint[0];
            var itemValue = item.datapoint[1];

            var d = new Date(itemTime);
            var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            var hours = d.getHours();
            if (hours < 10) hours = "0" + hours;
            var minutes = d.getMinutes();
            if (minutes < 10) minutes = "0" + minutes;
            var seconds = d.getSeconds();
            if (seconds < 10) seconds = "0" + seconds;

            var date = hours + ":" + minutes + ":" + seconds + ", " + days[d.getDay()] + " " + months[d.getMonth()] + " " + d.getDate();

            var text = item.series.label + "<br>" + date + "<br>";
            if (item.series.label == 'Agile' || item.series.label == 'Outgoing') {
                text += (itemValue * 1.05).toFixed(2) + " p/kWh (inc VAT)";
            } else {
                if (view_mode == "energy") text += (itemValue).toFixed(3) + " kWh";
                if (view_mode == "cost") text += (itemValue * 100 * 1.05).toFixed(2) + "p";
            }
            tooltip(item.pageX, item.pageY, text, "#fff");
        }
    } else $("#tooltip").remove();
});

$('#placeholder').bind("plotselected", function (event, ranges) {
    var start = ranges.xaxis.from;
    var end = ranges.xaxis.to;
    panning = true;

    view.start = start; view.end = end;
    graph_load();
    graph_draw();

    setTimeout(function () { panning = false; }, 100);
});

$(".viewcostenergy").click(function () {
    var view = $(this).html();
    if (view == "VIEW COST") {
        $(this).html("VIEW ENERGY");
        viewcostenergy = "cost";
    } else {
        $(this).html("VIEW COST");
        viewcostenergy = "energy";
    }
});

$(".energy").click(function () {
    view_mode = "energy";
    graph_draw()
    $(this).addClass("bluenav-active");
    $(".cost").removeClass("bluenav-active");
});

$(".cost").click(function () {
    view_mode = "cost";
    graph_draw()
    $(this).addClass("bluenav-active");
    $(".energy").removeClass("bluenav-active");
});

// -------------------------------------------------------------------------------
// FUNCTIONS
// -------------------------------------------------------------------------------
// - graph_load
// - graph_draw
// - resize

function graph_load () {
    $(".power-graph-footer").show();
    var interval = 1800;
    var intervalms = interval * 1000;
    view.start = Math.ceil(view.start / intervalms) * intervalms;
    view.end = Math.ceil(view.end / intervalms) * intervalms;

    if (feeds["use_kwh"] != undefined && feeds["solar_kwh"] != undefined) solarpv_mode = true;
    var import_kwh = feed.getdata(feeds["import_kwh"].id, view.start, view.end, interval, 0, 0);

    var use_kwh = [];
    if (solarpv_mode) use_kwh = feed.getdata(feeds["use_kwh"].id, view.start, view.end, interval, 0, 0);
    var solar_kwh = [];
    if (solarpv_mode) solar_kwh = feed.getdata(feeds["solar_kwh"].id, view.start, view.end, interval, 0, 0);
    data = {};

    data["agile"] = []
    data["outgoing"] = []
    if (config.app.region != undefined && regions_import[config.app.region.value] != undefined) {
        //Add 30 minutes to each reading to get a stepped graph
        agile = feed.getdataremote(regions_import[config.app.region.value], view.start, view.end, interval);
        for (var z in agile) {
            data["agile"].push(agile[z]);
            data["agile"].push([agile[z][0] + (intervalms - 1), agile[z][1]]);
        }

        outgoing = feed.getdataremote(regions_outgoing[config.app.region.value], view.start, view.end, interval);
        for (var z in outgoing) {
            data["outgoing"].push(outgoing[z]);
            data["outgoing"].push([outgoing[z][0] + (intervalms - 1), outgoing[z][1]]);
        }
    }
    // Invert export tariff
    for (var z in data["outgoing"]) data["outgoing"][z][1] *= -1;


    data["use"] = [];
    data["import"] = [];
    data["import_cost"] = [];
    data["export"] = [];
    data["export_cost"] = [];
    data["solar_used"] = []
    data["solar_used_cost"] = [];

    var total_cost_import = 0
    var total_kwh_import = 0
    var total_cost_export = 0
    var total_kwh_export = 0
    var total_cost_solar_used = 0
    var total_kwh_solar_used = 0

    this_halfhour_index = -1;
    // Add last half hour
    var this_halfhour = Math.floor((new Date()).getTime() / 1800000) * 1800000
    for (var z = 1; z < import_kwh.length; z++) {
        if (import_kwh[z][0] == this_halfhour) {
            import_kwh[z + 1] = [this_halfhour + 1800000, feeds["import_kwh"].value]
            this_halfhour_index = z
            if (solarpv_mode) {
                use_kwh[z + 1] = [this_halfhour + 1800000, feeds["use_kwh"].value]
                solar_kwh[z + 1] = [this_halfhour + 1800000, feeds["solar_kwh"].value]
            }
            break;
        }
    }

    if (import_kwh.length > 1) {
        for (var z = 1; z < import_kwh.length; z++) {
            let time = import_kwh[z - 1][0];

            if (solarpv_mode) {
                // ----------------------------------------------------
                // Solar PV agile outgoing
                // ----------------------------------------------------
                // calculate half hour kwh
                let kwh_use = 0;
                let kwh_import = 0;
                let kwh_solar = 0;

                if (use_kwh[z] != undefined && use_kwh[z - 1] != undefined) kwh_use = (use_kwh[z][1] - use_kwh[z - 1][1]);
                if (import_kwh[z] != undefined && import_kwh[z - 1] != undefined) kwh_import = (import_kwh[z][1] - import_kwh[z - 1][1]);
                if (solar_kwh[z] != undefined && solar_kwh[z - 1] != undefined) kwh_solar = (solar_kwh[z][1] - solar_kwh[z - 1][1]);

                // limits
                if (kwh_use < 0.0) kwh_use = 0.0;
                if (kwh_import < 0.0) kwh_import = 0.0;
                if (kwh_solar < 0.0) kwh_solar = 0.0;

                // calc export & self consumption
                let kwh_solar_used = kwh_use - kwh_import;
                let kwh_export = kwh_solar - kwh_solar_used;

                // half hourly datasets for graph
                data["use"].push([time, kwh_use]);
                data["import"].push([time, kwh_import]);
                data["export"].push([time, kwh_export * -1]);
                data["solar_used"].push([time, kwh_solar_used]);

                // energy totals
                total_kwh_import += kwh_import
                total_kwh_export += kwh_export
                total_kwh_solar_used += kwh_solar_used

                // costs
                let cost_import = data.agile[2 * (z - 1)][1] * 0.01;
                let cost_export = data.outgoing[2 * (z - 1)][1] * 0.01 * -1;

                // half hourly datasets for graph
                data["import_cost"].push([time, kwh_import * cost_import]);
                data["export_cost"].push([time, kwh_export * cost_export * -1]);
                data["solar_used_cost"].push([time, kwh_solar_used * cost_import]);

                // cost totals
                total_cost_import += kwh_import * cost_import
                total_cost_export += kwh_export * cost_export
                total_cost_solar_used += kwh_solar_used * cost_import
            } else {
                // ----------------------------------------------------
                // Import mode only
                // ----------------------------------------------------
                let kwh_import = 0;
                if (import_kwh[z] != undefined && import_kwh[z - 1] != undefined) kwh_import = (import_kwh[z][1] - import_kwh[z - 1][1]);
                if (kwh_import < 0.0) kwh_import = 0.0;
                data["import"].push([time, kwh_import]);
                total_kwh_import += kwh_import
                let cost_import = data.agile[2 * (z - 1)][1] * 0.01;
                data["import_cost"].push([time, kwh_import * cost_import]);
                total_cost_import += kwh_import * cost_import
            }
        }
    }

    var unit_cost_import = (total_cost_import / total_kwh_import);

    var out = "";
    out += "<tr>";
    out += "<td>Import</td>";
    out += "<td>" + total_kwh_import.toFixed(1) + " kWh</td>";
    out += "<td>£" + total_cost_import.toFixed(2) + "</td>";
    out += "<td>" + (unit_cost_import * 100 * 1.05).toFixed(1) + "p/kWh (inc VAT)</td>";
    out += "</tr>";

    if (solarpv_mode) {
        var unit_cost_export = (total_cost_export / total_kwh_export);
        out += "<tr>";
        out += "<td>Export</td>";
        out += "<td>" + total_kwh_export.toFixed(1) + " kWh</td>";
        out += "<td>£" + total_cost_export.toFixed(2) + "</td>";
        out += "<td>" + (unit_cost_export * 100 * 1.05).toFixed(1) + "p/kWh (inc VAT)</td>";
        out += "</tr>";

        var unit_cost_solar_used = (total_cost_solar_used / total_kwh_solar_used);
        out += "<tr>";
        out += "<td>Solar self consumption</td>";
        out += "<td>" + total_kwh_solar_used.toFixed(1) + " kWh</td>";
        out += "<td>£" + total_cost_solar_used.toFixed(2) + "</td>";
        out += "<td>" + (unit_cost_solar_used * 100 * 1.05).toFixed(1) + "p/kWh (inc VAT)</td>";
        out += "</tr>";

        var unit_cost_solar_combined = ((total_cost_solar_used + total_cost_export) / (total_kwh_solar_used + total_kwh_export));
        out += "<tr>";
        out += "<td>Solar + Export</td>";
        out += "<td>" + (total_kwh_solar_used + total_kwh_export).toFixed(1) + " kWh</td>";
        out += "<td>£" + (total_cost_solar_used + total_cost_export).toFixed(2) + "</td>";
        out += "<td>" + (unit_cost_solar_combined * 100 * 1.05).toFixed(1) + "p/kWh (inc VAT)</td>";
        out += "</tr>";
    }

    $("#octopus_totals").html(out);
}

function graph_draw () {
    if (this_halfhour_index != -1) {

        let kwh_last_halfhour = data["import"][this_halfhour_index][1];
        $("#kwh_halfhour").html(kwh_last_halfhour.toFixed(2) + "<span class='units'>kWh</span>");

        let cost_last_halfhour = data["import_cost"][this_halfhour_index][1] * 100;
        $("#cost_halfhour").html("(" + cost_last_halfhour.toFixed(2) + "<span class='units'>p</span>)");

        let unit_price = data["agile"][2 * this_halfhour_index][1] * 1.05;
        $("#unit_price").html(unit_price.toFixed(2) + "<span class='units'>p</span>");

        $(".last_halfhour_stats").show();
    } else {
        $(".last_halfhour_stats").hide();
    }

    var bars = { show: true, align: "left", barWidth: 0.9 * 1800 * 1000, fill: 1.0, lineWidth: 0 };

    graph_series = [];
    if (view_mode == "energy") {
        if (solarpv_mode) graph_series.push({ label: "Used Solar", data: data["solar_used"], yaxis: 1, color: "#bec745", stack: true, bars: bars });
        graph_series.push({ label: "Import", data: data["import"], yaxis: 1, color: "#44b3e2", stack: true, bars: bars });
        if (solarpv_mode) graph_series.push({ label: "Export", data: data["export"], yaxis: 1, color: "#dccc1f", stack: false, bars: bars });

    }
    else if (view_mode == "cost") {
        if (solarpv_mode) graph_series.push({ label: "Used Solar", data: data["solar_used_cost"], yaxis: 1, color: "#bec745", stack: true, bars: bars });
        graph_series.push({ label: "Import", data: data["import_cost"], yaxis: 1, color: "#44b3e2", stack: true, bars: bars });
        if (solarpv_mode) graph_series.push({ label: "Export", data: data["export_cost"], yaxis: 1, color: "#dccc1f", stack: false, bars: bars });
    }
    // price signals
    graph_series.push({ label: "Agile", data: data["agile"], yaxis: 2, color: "#fb1a80", lines: { show: true, align: "left", lineWidth: 1 } });
    if (solarpv_mode) graph_series.push({ label: "Outgoing", data: data["outgoing"], yaxis: 2, color: "#941afb", lines: { show: true, align: "center", lineWidth: 1 } });

    var options = {
        xaxis: {
            mode: "time", timezone: "browser",
            min: view.start, max: view.end,
            font: { size: flot_font_size, color: "#666" },
            reserveSpace: false
        },
        yaxes: [
            { position: 'left', font: { size: flot_font_size, color: "#666" }, reserveSpace: false },
            { position: 'left', alignTicksWithAxis: 1, font: { size: flot_font_size, color: "#666" }, reserveSpace: false }
        ],
        grid: {
            show: true,
            color: "#aaa",
            borderWidth: 0,
            hoverable: true,
            clickable: true,
            // labelMargin:0,
            // axisMargin:0
            margin: { top: 30 }
        },
        selection: { mode: "x" },
        legend: { position: "NW", noColumns: 5 }
    }
    $.plot($('#placeholder'), graph_series, options);
}

// -------------------------------------------------------------------------------
// RESIZE
// -------------------------------------------------------------------------------
function resize () {
    var top_offset = 0;
    var placeholder_bound = $('#placeholder_bound');
    var placeholder = $('#placeholder');

    var window_height = $(window).height();
    var topblock = $("#octopus-realtime").height();

    var width = placeholder_bound.width();
    var height = window_height - topblock - 250;
    if (height < 250) height = 250;

    placeholder.width(width);
    placeholder_bound.height(height);
    placeholder.height(height - top_offset);

    // if (width <= 500) {
    //     $(".electric-title").css("font-size", "14px");
    //     $(".power-value").css("font-size", "36px");
    //     $(".halfhour-value").css("font-size", "26px");
    // } else if (width <= 724) {
    //     $(".electric-title").css("font-size", "16px");
    //     $(".power-value").css("font-size", "50px");
    //     $(".halfhour-value").css("font-size", "40px");
    // } else {
    //     $(".electric-title").css("font-size", "20px");
    //     $(".power-value").css("font-size", "50px");
    //     $(".halfhour-value").css("font-size", "40px");
    // }
}

$(function () {
    $(document).on('window.resized hidden.sidebar.collapse shown.sidebar.collapse', function () {
        var window_width = $(this).width();

        flot_font_size = 12;
        if (window_width < 450) flot_font_size = 10;

        resize();

        graph_draw();
    })
})