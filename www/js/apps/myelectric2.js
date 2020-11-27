// todo: separate the powergraph_load() functions from each app so that they don't overwrite

// ----------------------------------------------------------------------
// Display
// ----------------------------------------------------------------------
// $("body").css('background-color','WhiteSmoke');

// ----------------------------------------------------------------------
// APPLICATION
// ----------------------------------------------------------------------
var feeds = {};
var data = {};
var bargraph_series = [];
var powergraph_series = [];
var previousPoint = false;
var viewmode = "bargraph";
var viewcostenergy = "energy";
var panning = false;
var period_text = "month";
var period_average = 0;
var flot_font_size = 12;
var start_time = 0;
var updaterinst = false;

var use_id = _FEED_ID_USE;
var use_kwh_id = _FEED_ID_KWH;

// ----------------------------------------------
// Load from local storage
// ----------------------------------------------
var storage = window.localStorage;

if (result = storage.getItem('feeds')) {
    feeds = JSON.parse(result)
    if (feeds[use_id] != undefined) {
        $("#power_now").html(Math.round(feeds[use_id].value) + "<span class='units'>W</span>");
    }
}

if (result = storage.getItem('bargraph_series')) {
    bargraph_series = JSON.parse(result)
    if (bargraph_series.length) {
        resize();
        var timeWindow = (3600000 * 24.0 * 30);
        var end = (new Date()).getTime();
        var start = end - timeWindow;

        bargraph_draw();
    }
}

// ----------------------------------------------

document.addEventListener("deviceready", function () {
    show()
});

function show () {
    // $("body").css('background-color','WhiteSmoke');

    resize();
    var timeWindow = (3600000 * 24.0 * 30);
    var end = (new Date()).getTime();
    var start = end - timeWindow;

    updater(function () {
        bargraph_load(start, end);
    });
    updaterinst = setInterval(updater, 5000);
    $(".ajax-loader").hide();
}

function updater (callback = false) {
    cordova.plugin.http.get(`${_HOST}/feed/list.json`, {
        userid: '' + _USER_ID,
        apikey: '' + _API_KEY
    }, {}, function (response) {
        var feeds_in = response.data || [];

        var feeds = {};
        for (var z in feeds_in) feeds[feeds_in[z].id] = feeds_in[z];

        storage.setItem('feeds', JSON.stringify(feeds))

        if (viewcostenergy == "energy") {
            if (feeds[use_id].value < 10000) {
                $("#power_now").html(Math.round(feeds[use_id].value) + "<span class='units'>W</span>");
            } else {
                $("#power_now").html((feeds[use_id].value * 0.001).toFixed(1) + "<span class='units'>kW</span>");
            }
        } else {
            $("#power_now").html('£' + (feeds[use_id].value * 1 * 0.15 * 0.001).toFixed(3) + "<span class='units'>/hr</span>");
        }

        if (callback) callback();

        // console.log('myelectric.updater()\\success()',response.status);
    }, function (response) {
        // console.error('myelectric.updater()\\fail()', response.error);
    });
}

// -------------------------------------------------------------------------------
// EVENTS
// -------------------------------------------------------------------------------
// The buttons for these powergraph events are hidden when in historic mode 
// The events are loaded at the start here and dont need to be unbinded and binded again.
$("#zoomout").click(function () { view.zoomout(); powergraph_load(); });
$("#zoomin").click(function () { view.zoomin(); powergraph_load(); });
$('#right').click(function () { view.panright(); powergraph_load(); });
$('#left').click(function () { view.panleft(); powergraph_load(); });

$('.time').click(function () {
    view.timewindow($(this).attr("time") / 24.0);
    powergraph_load();
});

$(".viewhistory").click(function () {
    $(".powergraph-navigation").hide();
    var timeWindow = (3600000 * 24.0 * 30);
    var end = (new Date()).getTime();
    var start = end - timeWindow;
    viewmode = "bargraph";
    bargraph_load(start, end);
    $(".bargraph-navigation").show();
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

            var elec_kwh, unit;
            if (data.use_kwhd[z]) {
                unit = "kWh";
                elec_kwh = data.use_kwhd[z][1];
            } else {
                unit = "W";
                elec_kwh = data.use[z][1];
            }

            var d = new Date(itemTime);
            var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            var date = days[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate();

            var text = "";
            if (viewcostenergy == "energy") {
                text = date + "<br>" + (elec_kwh).toFixed(1) + " " + unit;
            } else {
                text = date + "<br>" + (elec_kwh).toFixed(1) + " " + unit + " (" + '£' + (elec_kwh * 0.15).toFixed(2) + ")";
            }

            tooltip(item.pageX, item.pageY, text, "#fff");
        }
    } else $("#tooltip").remove();
});

// Auto click through to power graph
$('#placeholder').bind("plotclick", function (event, pos, item) {
    if (item && !panning && viewmode == "bargraph") {
        var z = item.dataIndex;
        view.start = data["use_kwhd"][z][0];
        view.end = view.start + 86400 * 1000;
        $(".bargraph-navigation").hide();
        viewmode = "powergraph";
        powergraph_load();
        $(".powergraph-navigation").show();
    }
});

$('#placeholder').bind("plotselected", function (event, ranges) {
    var start = ranges.xaxis.from;
    var end = ranges.xaxis.to;
    panning = true;

    if (viewmode == "bargraph") {
        bargraph_load(start, end);
    } else {
        view.start = start; view.end = end;
        powergraph_load();
    }
    setTimeout(function () { panning = false; }, 100);
});

$('.bargraph-alltime').click(function () {
    var start = start_time * 1000;
    var end = (new Date()).getTime();
    bargraph_load(start, end);
    period_text = "period";
});

$('.bargraph-week').click(function () {
    var timeWindow = (3600000 * 24.0 * 7);
    var end = (new Date()).getTime();
    var start = end - timeWindow;
    bargraph_load(start, end);
    period_text = "week";
});

$('.bargraph-month').click(function () {
    var timeWindow = (3600000 * 24.0 * 30);
    var end = (new Date()).getTime();
    var start = end - timeWindow;
    bargraph_load(start, end);
    period_text = "month";
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

    $(".powergraph-navigation").hide();
    viewmode = "bargraph";
    $(".bargraph-navigation").show();
    show();
});

// -------------------------------------------------------------------------------
// FUNCTIONS
// -------------------------------------------------------------------------------
// - powergraph_load
// - powergraph_draw
// - bargraph_load
// - bargraph_draw
// - resize

function powergraph_load () {
    $("#power-graph-footer").show();
    var start = view.start; var end = view.end;
    var npoints = 800;
    var interval = ((end - start) * 0.001) / npoints;
    interval = view.round_interval(interval);
    var intervalms = interval * 1000;
    start = Math.ceil(start / intervalms) * intervalms;
    end = Math.ceil(end / intervalms) * intervalms;

    cordova.plugin.http.get(`${_HOST}/feed/data.json`, {
        id: '' + _FEED_ID_USE,
        start: '' + start,
        end: '' + end,
        interval: '' + interval,
        skipmissing: '' + 1,
        limitinterval: '' + 1,
        apikey: '' + _API_KEY
    }, {}, function (response) {

        data["use"] = JSON.parse(response.data)

        powergraph_series = [];
        powergraph_series.push({ data: data["use"], yaxis: 1, color: "#44b3e2", lines: { show: true, fill: 0.8, lineWidth: 0 } });

        var feedstats = {};
        feedstats["use"] = stats(data["use"]);

        var time_elapsed = (data["use"][data["use"].length - 1][0] - data["use"][0][0]) * 0.001;
        var kwh_in_window = 0.0; // (feedstats["use"].mean * time_elapsed) / 3600000;

        for (var z = 0; z < data["use"].length - 1; z++) {
            var power = 0;
            if (data["use"][z][1] != null) power = data["use"][z][1];
            var time = (data["use"][z + 1][0] - data["use"][z][0]) * 0.001;

            if (time < 3600) {
                kwh_in_window += (power * time) / 3600000;
            }
        }

        if (viewcostenergy == "energy") {
            $("#window-kwh").html(kwh_in_window.toFixed(1) + "kWh");
            $("#window-cost").html("");
        } else {
            $("#window-kwh").html(kwh_in_window.toFixed(1) + "kWh");
            $("#window-cost").html("(" + '£' + (kwh_in_window * 0.15).toFixed(2) + ")");
        }

        var out = "";
        for (var z in feedstats) {
            out += "<tr>";
            out += "<td style='text-align:left'>" + z + "</td>";
            out += "<td style='text-align:center'>" + feedstats[z].minval.toFixed(2) + "</td>";
            out += "<td style='text-align:center'>" + feedstats[z].maxval.toFixed(2) + "</td>";
            out += "<td style='text-align:center'>" + feedstats[z].diff.toFixed(2) + "</td>";
            out += "<td style='text-align:center'>" + feedstats[z].mean.toFixed(2) + "</td>";
            out += "<td style='text-align:center'>" + feedstats[z].stdev.toFixed(2) + "</td>";
            out += "</tr>";
        }
        $("#stats").html(out);

        powergraph_draw();

        console.log('myelectric.powergraph_load()\\success', response.status);
    }, function (response) {
        console.error('myelectric.powergraph_load()\\error', response.error);
    });
}

function powergraph_draw () {
    var options = {
        lines: { fill: false },
        xaxis: {
            mode: "time", timezone: "browser",
            min: view.start, max: view.end,
            font: { size: flot_font_size, color: "#666" },
            reserveSpace: false
        },
        yaxes: [
            { min: 0, font: { size: flot_font_size, color: "#666" }, reserveSpace: false },
            { font: { size: flot_font_size, color: "#666" }, reserveSpace: false }
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
        legend: { position: "NW", noColumns: 4 }
    }
    $.plot($('#placeholder'), powergraph_series, options);
}

function bargraph_load (start, end) {
    $("#power-graph-footer").hide();
    $("#advanced-toggle").html("SHOW DETAIL");
    $("#advanced-block").hide();

    var interval = 3600 * 24;
    var intervalms = interval * 1000;
    end = Math.ceil(end / intervalms) * intervalms;
    start = Math.floor(start / intervalms) * intervalms;

    cordova.plugin.http.get(`${_HOST}/feed/data.json`, {
        id: '' + _FEED_ID_KWH,
        start: '' + start,
        end: '' + end,
        mode: 'daily',
        apikey: '' + _API_KEY
    }, {}, function (response) {

        var elec_result = response.data || response;
        var elec_data = [];

        // remove nan values from the end.
        for (var z in elec_result) {
            if (elec_result[z][1] != null) elec_data.push(elec_result[z]);
        }

        data["use_kwhd"] = [];

        var kwh_now = 0;
        if (feeds[use_kwh_id] != undefined) kwh_now = feeds[use_kwh_id].value

        if (elec_data.length == 0) {
            // If empty, then it's a new feed and we can safely append today's value.
            // Also append a fake value for the day before so that the calculations work.
            var d = new Date();
            d.setHours(0, 0, 0, 0);
            elec_data.push([d.getTime(), 0]);
            elec_data.push([d.getTime() + (interval * 1000), kwh_now]);
        } else {
            var lastday = elec_data[elec_data.length - 1][0];

            var d = new Date();
            d.setHours(0, 0, 0, 0);
            if (lastday == d.getTime()) {
                // last day in kwh data matches start of today from the browser's perspective
                // which means its safe to append today kwh value
                var next = elec_data[elec_data.length - 1][0] + (interval * 1000);
                elec_data.push([next, kwh_now]);
            }
        }

        if (elec_data.length > 1) {
            var total_kwh = 0;
            var n = 0;
            // Calculate the daily totals by subtracting each day from the day before
            for (var z = 1; z < elec_data.length; z++) {
                var time = elec_data[z - 1][0];
                var elec_kwh = (elec_data[z][1] - elec_data[z - 1][1]);
                data["use_kwhd"].push([time, elec_kwh]);
                total_kwh += elec_kwh;
                n++;
            }
            period_average = total_kwh / n;

            var kwh_today = data["use_kwhd"][data["use_kwhd"].length - 1][1];

            if (viewcostenergy == "energy") {
                $("#kwh_today").html(kwh_today.toFixed(1) + "<span class='units'>kWh</span>");
            } else {
                $("#kwh_today").html('£' + (kwh_today * 0.15).toFixed(2));
            }
        }

        bargraph_series = [];

        bargraph_series.push({
            data: data["use_kwhd"], color: "#44b3e2",
            bars: { show: true, align: "center", barWidth: 0.75 * 3600 * 24 * 1000, fill: 1.0, lineWidth: 0 }
        });

        storage.setItem('bargraph_series', JSON.stringify(bargraph_series))

        bargraph_draw();

        console.log('myelectric.js\\bargraph_load()\\success', response);
    }, function (response) {
        console.error('myelectric.js\\bargraph_load()\\fail', response);
    });
}

function bargraph_draw () {
    var options = {
        xaxis: {
            mode: "time",
            timezone: "browser",
            font: { size: flot_font_size, color: "#666" },
            // labelHeight:-5
            reserveSpace: false
        },
        yaxis: {
            font: { size: flot_font_size, color: "#666" },
            // labelWidth:-5
            reserveSpace: false,
            min: 0
        },
        selection: { mode: "x" },
        grid: {
            show: true,
            color: "#aaa",
            borderWidth: 0,
            hoverable: true,
            clickable: true
        }
    }

    var plot = $.plot($('#placeholder'), bargraph_series, options);
    $('#placeholder').append("<div id='bargraph-label' style='position:absolute;left:50px;top:30px;color:#666;font-size:12px'></div>");
}

// -------------------------------------------------------------------------------
// RESIZE
// -------------------------------------------------------------------------------
function resize () {
    var top_offset = 0;
    var placeholder_bound = $('#placeholder_bound');
    var placeholder = $('#placeholder');

    var window_height = $(window).height();
    var topblock = $("#myelectric-realtime").height();

    var width = placeholder_bound.width();
    var height = width * 0.6;
    if (height > 500) height = 500;
    if (height > width) height = width;

    height = window_height - topblock - 200;

    placeholder.width(width);
    placeholder_bound.height(height);
    placeholder.height(height - top_offset);

    if (width <= 500) {
        $(".electric-title").css("font-size", "16px");
        $(".power-value").css("font-size", "38px");
    } else if (width <= 724) {
        $(".electric-title").css("font-size", "18px");
        $(".power-value").css("font-size", "52px");
    } else {
        $(".electric-title").css("font-size", "22px");
        $(".power-value").css("font-size", "52px");
    }
}

resize();
// on finish sidebar hide/show
$(function () {
    $(document).on('window.resized hidden.sidebar.collapse shown.sidebar.collapse', function () {
        var window_width = $(this).width();

        flot_font_size = 12;
        if (window_width < 450) flot_font_size = 10;

        resize();

        if (viewmode == "bargraph") {
            bargraph_draw();
        } else {
            powergraph_draw();
        }
    })
})

// ----------------------------------------------------------------------
// App log
// ----------------------------------------------------------------------
function app_log (level, message) {
    if (level == "ERROR") alert(level + ": " + message);
    console.log(level + ": " + message);
}
