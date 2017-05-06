/* 3D bed visualization for Duet Web Control
 * 
 * written by Christian Hammacher (c) 2016-2017
 * 
 * licensed under the terms of the GPL v3
 * see http://www.gnu.org/licenses/gpl-3.0.html
 */

var scaleZ = 0.5, maxVisualizationZ = 0.25, pointTolerance = 2.0;
var smallIndicatorRadius = 0.01, mediumIndicatorRadius = 0.02, bigIndicatorRadius = 0.05;
var indicatorColor = 0xFFFFFF, indicatorOpacity = 0.4, indicatorOpacityHighlighted = 1.0;

var colorScheme = "terrain";
var scene, camera, renderer, raycaster;
var meshGeometry, meshPlane, meshIndicators, lastIntersection;
var bedProbePoints, probePoints, probeXMin, probeXMax, probeYMin, probeYMax;


function testHeightmap() {
	var csv = 'RepRapFirmware height map file v1\nxmin,xmax,ymin,ymax,radius,spacing,xnum,ynum\n-140.00,140.10,-140.00,140.10,150.00,20.00,15,15\n0,0,0,0,0,-0.139,-0.188,-0.139,-0.202,-0.224,0,0,0,0,0\n0,0,0,-0.058,-0.066,-0.109,-0.141,-0.129,-0.186,-0.198,-0.191,-0.176,0,0,0\n0,0,0.013,-0.008,-0.053,-0.071,-0.087,-0.113,-0.162,-0.190,-0.199,-0.267,-0.237,0,0\n0,0.124,0.076,0.025,-0.026,-0.054,-0.078,-0.137,-0.127,-0.165,-0.201,-0.189,-0.227,-0.226,0\n0,0.198,0.120,0.047,0.089,-0.074,-0.097,-0.153,-0.188,-0.477,-0.190,-0.199,-0.237,-0.211,0\n0.312,0.229,0.198,0.098,0.097,0.004,-0.089,-0.516,-0.150,-0.209,-0.197,-0.183,-0.216,-0.296,-0.250\n0.287,0.263,0.292,0.100,0.190,0.015,-0.102,-0.039,-0.125,-0.149,-0.137,-0.198,-0.188,-0.220,-0.192\n0.378,0.289,0.328,0.172,0.133,0.078,-0.086,0.134,-0.100,-0.150,-0.176,-0.234,-0.187,-0.199,-0.221\n0.360,0.291,0.260,0.185,0.111,0.108,0.024,0.073,-0.024,-0.116,-0.187,-0.252,-0.201,-0.215,-0.187\n0.447,0.397,0.336,0.276,0.180,0.164,0.073,-0.050,-0.049,-0.109,-0.151,-0.172,-0.211,-0.175,-0.161\n0,0.337,0.289,0.227,0.179,0.127,0.086,0.034,-0.039,-0.060,-0.113,-0.108,-0.171,-0.153,0\n0,0.478,0.397,0.374,0.270,0.141,0.085,0.074,0.037,-0.048,-0.080,-0.187,-0.126,-0.175,0\n0,0,0.373,0.364,0.265,0.161,0.139,0.212,0.040,0.046,-0.008,-0.149,-0.115,0,0\n0,0,0,0.346,0.295,0.273,0.148,0.136,0.084,0.024,-0.055,-0.078,0,0,0\n0,0,0,0,0,0.240,0.178,0.084,0.090,0.004,0,0,0,0,0';

	// The first line is a comment generated by RepRapFirmware. Remove it
	csv = csv.substr(csv.indexOf("\n") + 1);

	// Convert the CSV text into an array that we can use
	var csvArray = parseCSV(csv);

	// Get the values that are interesting for us
	var probeRadius = parseFloat(getCSVValue(csvArray, "radius"));
	var xMin = parseFloat(getCSVValue(csvArray, "xmin"));
	var xMax = parseFloat(getCSVValue(csvArray, "xmax"));
	var yMin = parseFloat(getCSVValue(csvArray, "ymin"));
	var yMax = parseFloat(getCSVValue(csvArray, "ymax"));
	var spacing = parseFloat(getCSVValue(csvArray, "spacing"));

	// Convert each point to a vector
	var heightmap = [];
	for(var y = 2; y < csvArray.length; y++) {
		for(var x = 0; x < csvArray[y].length; x++) {
			var value = csvArray[y][x];
			if (value == "0") {
				heightmap.push([xMin + x * spacing, yMin + (y - 2) * spacing, NaN]);
			} else {
				var value = parseFloat(csvArray[y][x]);
				heightmap.push([xMin + x * spacing, yMin + (y - 2) * spacing, value]);
			}
		}
	}

	// Generate 3D mesh
	showHeightmap(heightmap, probeRadius, xMin, yMin, spacing);
}

function testBedCompensation(numPoints) {
	var testPoints;
	switch (numPoints) {
		case 3:
			testPoints = [[15.0, 15.0, 0.123], [15.0, 195.0, -0.243], [215.0, 105.0, 0.034]];
			setGeometry("cartesian");
			break;

		case 4:
			testPoints = [[15.0, 15.0, 0.015], [15.0, 185.0, -0.193], [175.0, 185.0, 0.156], [175.0, 15.0, 0.105]];
			setGeometry("cartesian");
			break;

		case 5:
			testPoints = [[15.0, 15.0, 0.007], [15.0, 185.0, -0.121], [175.0, 185.0, -0.019], [175.0, 15.0, 0.193], [95.0, 100.0, 0.05]];
			setGeometry("cartesian");
			break;

		case 7:
			testPoints = [[0.0, 84.0, 0.01], [73.53, -42.45, 0.125], [-73.53, -42.45, 0.25], [0.0, 42.4, 0.0], [36.72, -21.2, -0.125], [-36.72, -21.2, -0.25], [0.0, 0.0, 0.25]];
			setGeometry("delta");
			break;

		case 9:
			testPoints = [[15.0, 15.0, 0.034], [95.0, 15.0, 0.143], [175.0, 15.0, -0.123], [15.0, 100.0, 0.154], [95.0, 100.0, -0.252], [175.0, 100.0, -0.135], [15.0, 185.0, 0.234], [95.0, 185.0, -0.242], [175.0, 185.0, 0.123]];
			setGeometry("cartesian");
			break;

		case 10:
			testPoints = [[0,84.9,0],[49.9,68.69,0],[80.74,26.24,0],[80.74,-26.24,0],[49.9,-68.69,0],[0,-84.9,0],[-49.9,-68.69,0],[-80.74,-26.24,0],[-80.74,26.24,0],[-49.9,68.69,0],[0,0,0]];
			setGeometry("delta");
			break;

		case 17:
			testPoints = [[0,84.9,0.05630809461178765],[49.9,68.69,0.17599528333331518],[80.74,26.24,0.2594756296464064],[80.74,-26.24,0.015530445498113554],[49.9,-68.69,0.23133485970358503],[0,-84.9,0.21997378657053593],[-49.9,-68.69,0.11618119110103399],[-80.74,-26.24,0.2772662322205023],[-80.74,26.24,0.08411930426155993],[-49.9,68.69,0.01151950813684679],[0,42.4,0.131994449059145],[36.72,21.2,0.056566293905866843],[36.72,-21.2,0.25405071944089047],[0,-42.4,0.1763972630845728],[-36.72,-21.2,0.07603902615730086],[-36.72,21.2,0.12579173035981916],[0,0,0.08963820511571098]];
			setGeometry("delta");
			break;

		case 121:
			testPoints = [[-50,-50,0.12002740834777786],[-50,-40,-0.11153931027113302],[-50,-30,0.03726485452325734],[-50,-20,0.10955886411136477],[-50,-10,-0.04435246652525355],[-50,0,-0.0028156396602971867],[-50,10,-0.051632028852817126],[-50,20,-0.05794016520470719],[-50,30,-0.030471271734211446],[-50,40,-0.06971687368573451],[-50,50,-0.12195742398687667],[-40,-50,0.14254362562578415],[-40,-40,-0.08126858523700416],[-40,-30,-0.06198184729114495],[-40,-20,-0.037504449710496],[-40,-10,0.07361124455504224],[-40,0,-0.08754060897951484],[-40,10,0.035879996249150815],[-40,20,-0.09360238058545878],[-40,30,0.11442068820906585],[-40,40,-0.08363311975376284],[-40,50,0.043518350809534076],[-30,-50,-0.057116822070275464],[-30,-40,0.08955138441010302],[-30,-30,0.1185910894111243],[-30,-20,-0.07601355576245762],[-30,-10,-0.005618731185199488],[-30,0,-0.13563892359086296],[-30,10,0.09300977253840119],[-30,20,0.0165485225775021],[-30,30,0.1291417905009324],[-30,40,0.10952998968672502],[-30,50,0.03606211423795047],[-20,-50,0.054808296166161605],[-20,-40,-0.08239703812918384],[-20,-30,-0.029730835473283677],[-20,-20,0.11280340342421669],[-20,-10,-0.0134227744832083],[-20,0,-0.03363528493561929],[-20,10,-0.001022756045073314],[-20,20,0.03156257223821328],[-20,30,0.005150101179566757],[-20,40,0.1342733417639501],[-20,50,0.08662800628200462],[-10,-50,-0.11251500729320446],[-10,-40,-0.10152120320535729],[-10,-30,-0.13947973240148234],[-10,-20,-0.0055081718158396685],[-10,-10,0.012406068888191889],[-10,0,0.019127386274646805],[-10,10,-0.060339695184274754],[-10,20,0.09475372058120354],[-10,30,0.04504534407928413],[-10,40,0.09264861231075873],[-10,50,-0.12986678193884427],[0,-50,0.044021329858792965],[0,-40,0.12602510485509355],[0,-30,-0.1358244106091512],[0,-20,0.04885005208852744],[0,-10,-0.07742114874082186],[0,0,-0.002289637865387117],[0,10,-0.00815542589988023],[0,20,0.0011158536939211317],[0,30,0.10700301631570701],[0,40,-0.054518657864691365],[0,50,0.017084666415419524],[10,-50,-0.11298043262249217],[10,-40,-0.14008436368192323],[10,-30,-0.1271727984317276],[10,-20,0.06333304984467969],[10,-10,0.060342445616347384],[10,0,0.08104223768183395],[10,10,-0.0024036494807740502],[10,20,0.003092740116676751],[10,30,-0.016183497677099833],[10,40,-0.021855589456963597],[10,50,0.06043936839655179],[20,-50,0.11820755728621879],[20,-40,-0.01702291734385255],[20,-30,-0.06449113235394623],[20,-20,-0.14055632865897286],[20,-10,-0.01994879304716839],[20,0,0.003604964896454832],[20,10,-0.04220968285722817],[20,20,0.01872527251135445],[20,30,0.035094267945042175],[20,40,0.08625901330376684],[20,50,0.14685416531566567],[30,-50,0.11423465093082014],[30,-40,-0.010328196199440342],[30,-30,0.07359570163736166],[30,-20,-0.016141161970606156],[30,-10,-0.061684955393020456],[30,0,0.12939173181232735],[30,10,-0.02237449658065016],[30,20,-0.14749891451903582],[30,30,0.1473553275042116],[30,40,-0.050145519405154326],[30,50,0.04250744539879927],[40,-50,0.14224393364505666],[40,-40,0.037228715024125926],[40,-30,0.06499028067572622],[40,-20,0.061523275439891195],[40,-10,-0.011061591645928103],[40,0,0.061033484764153975],[40,10,0.1205016965624641],[40,20,0.023848178520022387],[40,30,-0.0021676609838422677],[40,40,-0.06590936366459543],[40,50,0.08999587447670003],[50,-50,-0.13398415024828852],[50,-40,0.09659652345656729],[50,-30,-0.12894582833974588],[50,-20,0.08685982032429304],[50,-10,0.0007890629119364334],[50,0,-0.06152535417010243],[50,10,0.13123240948087636],[50,20,-0.07158442576405022],[50,30,-0.14788950165050954],[50,40,-0.1278763640481279],[50,50,0.07007486386303274]];
			setGeometry("delta");
			break;
	}

	showBedCompensation(testPoints);
}

function getHeightmap(file) {
	if (!isConnected) {
		return;
	}

	if (file == undefined) {
		file = "0:/sys/heightmap.csv";
	}

	$.ajax(ajaxPrefix + "rr_download?name=" + encodeURIComponent(file), {
		dataType: "html",
		cache: false,
		global: false,
		error: function() {
			showMessage("warning", T("Failed to download height map"), T("Failed to download and process /sys/heightmap.csv from the SD card. Have you run G29 yet?"));
		},
		success: function(csv) {
			// The first line is a comment generated by RepRapFirmware. Remove it
			csv = csv.substr(csv.indexOf("\n") + 1);

			// Convert the CSV text into an array that we can use
			var csvArray = parseCSV(csv);

			// Get the values that are interesting for us
			var probeRadius = parseFloat(getCSVValue(csvArray, "radius"));
			var xMin = parseFloat(getCSVValue(csvArray, "xmin"));
			//var xMax = parseFloat(getCSVValue(csvArray, "xmax"));		// unreliable!
			var yMin = parseFloat(getCSVValue(csvArray, "ymin"));
			//var yMax = parseFloat(getCSVValue(csvArray, "ymax"));		// unreliable!
			var spacing = parseFloat(getCSVValue(csvArray, "spacing"));

			// Convert each point to a vector and add it to the vector list
			var heightmap = [];
			for(var y = 2; y < csvArray.length; y++) {
				for(var x = 0; x < csvArray[y].length; x++) {
					var value = csvArray[y][x].trim();
					if (value == "0") {
						heightmap.push([xMin + x * spacing, yMin + (y - 2) * spacing, NaN]);
					} else {
						var value = parseFloat(csvArray[y][x]);
						heightmap.push([xMin + x * spacing, yMin + (y - 2) * spacing, value]);
					}
				}
			}

			// Generate and show 3D mesh
			try {
				// If we supply invalid values from the CSV file, this function will throw an error
				showHeightmap(heightmap, probeRadius, xMin, yMin, spacing);
			} catch (e) {
				this.error();
			}
		}
	});
}

function clearBedPoints() {
	$("#a_show_bed_points").parent().addClass("disabled");

	bedProbePoints = undefined;
}

function showBedCompensation(points) {
	$("#a_show_bed_points").parent().removeClass("disabled");

	bedProbePoints = points;
	showHeightmap(points);
}

function showHeightmap(points, probeRadius, xMin, yMin, spacing) {
	// Generate stats
	var xMax, yMax;
	var minDiff, maxDiff, numProbePoints = 0, meanError = 0, rmsError = 0;
	for(var i = 0; i < points.length; i++) {
		var z = points[i][2];
		if (!isNaN(z)) {
			var x = points[i][0];
			var y = points[i][1];
			if (xMin == undefined || xMin > x) { xMin = x; }
			if (xMax == undefined || xMax < x) { xMax = x; }
			if (yMin == undefined || yMin > y) { yMin = y; }
			if (yMax == undefined || yMax < y) { yMax = y; }

			numProbePoints++;
			meanError += Math.abs(z);
			rmsError += z * z;
			if (minDiff == undefined || minDiff > z) { minDiff = z; }
			if (maxDiff == undefined || maxDiff < z) { maxDiff = z; }
		}
	}
	meanError = meanError / numProbePoints;
	rmsError = Math.sqrt(rmsError / numProbePoints);

	// Try to prepare a mesh geometry for the final visualization
	probePoints = points;
	meshGeometry = generateMeshGeometry(points, probeRadius, xMin, xMax, yMin, yMax);
	if (meshGeometry == undefined) {
		showMessage("warning", T("Cannot generate 3D visualization"), T("Failed to generate mesh for bed points!"));
		return;
	}

	// Calculate probe area lengths and size
	var probeArea = NaN;
	if (xMin == undefined || xMax == undefined || yMin == undefined || yMax == undefined) {
		probeXMin = probeXMax = probeYMin = probeYMax = undefined;
	} else {
		probeXMin = xMin;
		probeXMax = xMax;
		probeYMin = yMin;
		probeYMax = yMax;
		probeArea = Math.abs((xMin - xMax) * (yMin - yMax));
	}

	if (probeRadius != undefined && geometry == "delta") {
		probeArea = probeRadius * probeRadius * Math.PI;
	}

	// Display them
	$("#num_probe_points").text(numProbePoints);
	$("#probing_radius").text((probeRadius == undefined) ? T("n/a") : T("{0} mm", probeRadius));
	$("#probe_area").text((isNaN(probeArea)) ? T("n/a") : T("{0} cm²", (probeArea / 100).toFixed(1)));
	$("#max_deviations").text(T("{0} / {1} mm", (minDiff == undefined) ? T("n/a") : minDiff.toFixed(3), (maxDiff == undefined) ? T("n/a") : maxDiff.toFixed(3)));
	$("#mean_error").text(T("{0} mm", meanError.toFixed(3)));
	$("#rms_error").text(T("{0} mm", rmsError.toFixed(3)));

	// Show modal dialog
	$("#modal_bed").modal("show");
}

function getNearestZOnRing(points, x, y) {
	// Get point that is closest to X+Y
	var point, delta = undefined;
	for(var i = 0; i < points.length; i++) {
		var deltaNew = Math.sqrt(Math.pow(x - points[i][0], 2) + Math.pow(y - points[i][1], 2));
		if (delta == undefined || deltaNew < delta) {
			point = points[i];
			delta = deltaNew;
		}
	}

	// Return its Z value
	return (delta == undefined) ? NaN : point[2];
}

function getNearestZOnGrid(points, x, y, maxDelta) {
	// Get the point that is closest to X+Y
	var point, delta = undefined;
	for(var i = 0; i < points.length; i++) {
		var deltaNew = Math.sqrt(Math.pow(x - points[i][0], 2) + Math.pow(y - points[i][1], 2));
		if (delta == undefined || deltaNew < delta) {
			point = points[i];
			delta = deltaNew;
		}
	}

	// Check if we exceed the maximum allowed delta
	if (delta == undefined || (maxDelta != undefined && delta > maxDelta)) {
		return NaN;
	}

	// Otherwise return the closest Z coordinate of this point
	return point[2];
}

function generateMeshGeometry(probePoints, probeRadius, xMin, xMax, yMin, yMax) {
	/** Delta visualization for old-fashioned probe points **/

	if (geometry == "delta" && probePoints.length <= 17) {
		// Check if we need to set the probing radius
		if (probeRadius == undefined) {
			probeRadius = 0;
		}

		// If we have a reasonably small number of probe points, try to group them by their radii
		var radiiGroups = [], zeroPoint = undefined, probeRadius = 0;
		for(var i = 0; i < probePoints.length; i++) {
			var radius = Math.sqrt(Math.pow(probePoints[i][0], 2) + Math.pow(probePoints[i][1], 2));
			if (radius > 0) {
				var groupFound = false;
				for(var k = 0; k < radiiGroups.length; k++) {
					if (Math.abs(radiiGroups[k][0] - radius) < pointTolerance) {
						radiiGroups[k].push(probePoints[i]);
						groupFound = true;
						break;
					}
				}

				if (!groupFound) {
					radiiGroups.push([radius, probePoints[i]]);
				}

				if (radius > probeRadius) {
					probeRadius = radius;
				}
			} else {
				zeroPoint = probePoints[i];
			}
		}

		// Check if the determined groups are valid
		var groupingOkay = (zeroPoint != undefined) && (radiiGroups.length > 0);
		var maxPointsPerGroup = 1;
		for(var i = 0; i < radiiGroups.length; i++) {
			// Each group must have more than three entries
			if (radiiGroups[i].length < 4) {
				groupingOkay = false;
				break;
			}

			// Check how many max. points per group we have
			if (radiiGroups[i].length > maxPointsPerGroup + 1) {
				maxPointsPerGroup = radiiGroups[i].length - 1;
			}
		}

		// Everything OK - we can visualize a typical delta probe point grid
		if (groupingOkay) {
			radiiGroups = radiiGroups.sort(function(a, b) { return a[0] > b[0]; });

			// Generate a geometry with 3*maxPointsPerGroup points per circle segment, because the probe points on
			// the inner circle(s) are usually rotated by a certain amount
			var ringGeometry = new THREE.RingGeometry(0.000000001, 0.5, maxPointsPerGroup * 3, radiiGroups.length);

			for(var i = 0; i < ringGeometry.vertices.length; i++) {
				var vRadius = Math.sqrt(Math.pow(ringGeometry.vertices[i].x, 2) + Math.pow(ringGeometry.vertices[i].y, 2));
				if (vRadius < 0.0001) {
					// If the radius of this vertex is extremely small, treat it as the zero point
					ringGeometry.vertices[i].z = zeroPoint[2] * scaleZ;
				} else {
					var rGroupIndex = Math.round(vRadius / 0.25) - 1;
					if (rGroupIndex < 0 || rGroupIndex >= radiiGroups.length) {
						console.log("WARNING: Failed to find point group near vRadius=" + vRadius);
					} else {
						// Because extra segments are generated, the getNearestZ function tends to fail for extremely small Y
						// values. Hence we round it to 0 in this case to avoid interrupts of the grid surface
						var x = ringGeometry.vertices[i].x * probeRadius * 2;
						if (x > -0.0001 && x < 0.0001) { x = 0; }
						var y = ringGeometry.vertices[i].y * probeRadius * 2;
						if (y > -0.0001 && y < 0.0001) { y = 0; }
						ringGeometry.vertices[i].z = getNearestZOnRing(radiiGroups[rGroupIndex].slice(1), x, y) * scaleZ;
					}
				}
			}

			return ringGeometry;
		}
	}


	/** Cartesian 3-point and 5-point bed compensation **/

	if (geometry != "delta" && (probePoints.length == 3 || probePoints.length == 5)) {
		var planeGeometry = new THREE.Geometry();

		// Generate vertices
		for(var i = 0; i < probePoints.length; i++) {
			var x = (probePoints[i][0] - xMin) / (xMax - xMin) - 0.5;
			var y = (probePoints[i][1] - yMin) / (yMax - yMin) - 0.5;
			var z = probePoints[i][2] * scaleZ;

			planeGeometry.vertices.push(new THREE.Vector3(x, y, z));
		}

		// Generate faces
		if (probePoints.length == 3) {
			planeGeometry.faces.push(new THREE.Face3(0, 1, 2));
		} else {
			planeGeometry.faces.push(new THREE.Face3(0, 1, 4));
			planeGeometry.faces.push(new THREE.Face3(1, 2, 4));
			planeGeometry.faces.push(new THREE.Face3(2, 3, 4));
			planeGeometry.faces.push(new THREE.Face3(3, 0, 4));
		}

		return planeGeometry;
	}


	/** New grid-based compensation **/

	// Find out how many different X+Y coordinates are used
	var xPoints = [], yPoints = [];
	for(var i = 0; i < probePoints.length; i++) {
		var z = probePoints[i][2];
		if (!isNaN(z)) {
			var x = probePoints[i][0], y = probePoints[i][1];
			if (xPoints.indexOf(x) == -1) {
				xPoints.push(x);
			}
			if (yPoints.indexOf(y) == -1) {
				yPoints.push(y);
			}
		}
	}

	// Generate plane geometry for grid
	var planeWidth = (xMax - xMin < yMax - yMin) ? Math.abs((xMax - xMin) / (yMax - yMin)) : 1.0;
	var planeHeight = (yMax - yMin < xMax - xMin) ? Math.abs((yMax - yMin) / (xMax - xMin)) : 1.0;
	var planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight, xPoints.length - 1, yPoints.length - 1);

	var width = (xMax - xMin);
	var height = (yMax - yMin);
	for(var i = planeGeometry.vertices.length - 1; i >= 0; i--) {
		var x = (planeGeometry.vertices[i].x + 0.5) * width + xMin;
		var y = (planeGeometry.vertices[i].y + 0.5) * height + yMin;
		var z = getNearestZOnGrid(probePoints, x, y) * scaleZ;

		planeGeometry.vertices[i].z = z;
	}

	// Add extra faces to each top row to avoid zig-zag lines
	var yCurrent = undefined;
	for(var i = 1; i < planeGeometry.vertices.length / 2; i++) {
		var vertex = planeGeometry.vertices[i];
		var prevVertex = planeGeometry.vertices[i - 1];
		if (!isNaN(prevVertex.z) && isNaN(vertex.z)) {
			var yPoint = vertex.y;
			if (yCurrent == undefined || yCurrent > yPoint) {
				// We are at the last defined point in this row
				yCurrent = yPoint;

				// Find the next two points below and below+right to this one
				var a = undefined, b;
				for(var k = i + 1; k < planeGeometry.vertices.length - 1; k++) {
					var nextVertex = planeGeometry.vertices[k];
					if (nextVertex.x == prevVertex.x && nextVertex.y == planeGeometry.vertices[k + 1].y) {
						a = k;
						b = k + 1;
						break;
					}
				}

				// If that succeeds add a new face
				if (a != undefined && !isNaN(planeGeometry.vertices[a].z) && !isNaN(planeGeometry.vertices[b].z)) {
					var face = new THREE.Face3(a, b, i - 1);
					planeGeometry.faces.push(face);
				}
			}
		}
	}

	// Add extra faces to each bottom row to avoid zig-zag lines
	var prevVertex = undefined;
	for(var i = Math.floor(planeGeometry.vertices.length / 2); i < planeGeometry.vertices.length; i++) {
		var vertex = planeGeometry.vertices[i];

		// Check if this is the first defined point in this row
		if (prevVertex != undefined && prevVertex.y == vertex.y && isNaN(prevVertex.z) && !isNaN(vertex.z)) {
			// Find the two points above and above+left to this one
			var a = undefined, b;
			for(var k = i - 1; k > 0; k--) {
				var prevVertex = planeGeometry.vertices[k];
				var prev2Vertex = planeGeometry.vertices[k - 1];
				if (prevVertex.x == vertex.x && prevVertex.y == planeGeometry.vertices[k - 1].y) {
					a = k - 1;
					b = k;
					break;
				}
			}

			// If that succeeds add a new face
			if (a != undefined && !isNaN(planeGeometry.vertices[a].z) && !isNaN(planeGeometry.vertices[b].z)) {
				var face = new THREE.Face3(a, b, i);
				planeGeometry.faces.push(face);
			}
		}
		prevVertex = vertex;
	}

	// Remove all the points and faces that have invalid values
	for(var i = planeGeometry.vertices.length - 1; i >= 0; i--) {
		if (isNaN(planeGeometry.vertices[i].z)) {
			// Remove and rearrange the associated face(s)
			for(var k = planeGeometry.faces.length - 1; k >= 0; k--) {
				var face = planeGeometry.faces[k];
				if (face.a == i || face.b == i || face.c == i) {
					planeGeometry.faces.splice(k, 1);
				} else {
					if (face.a > i) {
						face.a--;
					}
					if (face.b > i) {
						face.b--;
					}
					if (face.c > i) {
						face.c--;
					}
				}
			}

			// Remove this vertex
			planeGeometry.vertices.splice(i, 1);
		}
	}

	return planeGeometry;
}

function getColorByZ(modelZ) {
	var z = modelZ / scaleZ;

	// Terrain color scheme (i.e. from blue to red, asymmetric)
	if (colorScheme == "terrain") {
		z = Math.max(Math.min(z, maxVisualizationZ), -maxVisualizationZ);
		var hue = 240 - ((z + maxVisualizationZ) / maxVisualizationZ) * 120;
		return new THREE.Color("hsl(" + hue + ",100%,45%)");
	}

	// Default color scheme (i.e. the worse the redder, symmetric)
	var hue = 120 - Math.min(Math.abs(z), maxVisualizationZ) / maxVisualizationZ * 120;
	return new THREE.Color("hsl(" + hue + ",100%,45%)");
}

function setFaceColors(geometry) {
	for(var i = 0; i < geometry.faces.length; i++) {
		var face = geometry.faces[i];
		var a = getColorByZ(geometry.vertices[face.a].z);
		var b = getColorByZ(geometry.vertices[face.b].z);
		var c = getColorByZ(geometry.vertices[face.c].z);

		if (face.vertexColors.length < 3) {
			face.vertexColors = [a, b, c];
		} else {
			face.vertexColors[0].copy(a);
			face.vertexColors[1].copy(b);
			face.vertexColors[2].copy(c);
		}
	}
	geometry.colorsNeedUpdate = true;
}

function translateGridPoint(meshGeometry, vector) {
	var x, y, z = vector.z / scaleZ;
	if (meshGeometry.type == "PlaneGeometry") {
		x = (vector.x / meshGeometry.parameters.width + 0.5) * (probeXMax - probeXMin) + probeXMin;
		y = (vector.y / meshGeometry.parameters.height + 0.5) * (probeYMax - probeYMin) + probeYMin;
	} else if (meshGeometry.type == "Geometry") {
		x = (vector.x + 0.5) * (probeXMax - probeXMin) + probeXMin;
		y = (vector.y + 0.5) * (probeYMax - probeYMin) + probeYMin;
	} else {
		x = vector.x * (probeXMax - probeXMin) / 2;
		y = vector.y * (probeYMax - probeYMin) / 2;
	}

	return new THREE.Vector3(x, y, z);
}

function generateIndicators(meshGeometry) {
	var indicators = [], centerPointGenerated = false;

	for(var i = 0; i < meshGeometry.vertices.length; i++) {
		// Convert world coordinate to "real" probe coordinates
		var x = meshGeometry.vertices[i].x;
		var y = meshGeometry.vertices[i].y;
		var z = meshGeometry.vertices[i].z;
		var trueProbePoint = translateGridPoint(meshGeometry, new THREE.Vector3(x, y, z));

		// Skip center point if it already exists
		if (Math.sqrt(trueProbePoint.x*trueProbePoint.x + trueProbePoint.y*trueProbePoint.y) < pointTolerance) {
			if (centerPointGenerated) {
				continue;
			}
			centerPointGenerated = true;
		}

		// FIXME: Implement this for delta geometries as well
		if (meshGeometry.type != "RingGeometry") {
			// Get the true Z probe point coordinate or NaN if there is no close point
			trueProbePoint.z = getNearestZOnGrid(probePoints, trueProbePoint.x, trueProbePoint.y, pointTolerance);
		}

		// If we have a close point, create a new indicator
		if (!isNaN(trueProbePoint.z)) {
			var radius =	(probePoints.length > 64) ? smallIndicatorRadius :
							(probePoints.length > 9) ? mediumIndicatorRadius :
							 bigIndicatorRadius;
			var sphereGeometry = new THREE.SphereGeometry(radius);
			sphereGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(x, y, z));

			var material = new THREE.MeshBasicMaterial({ color: indicatorColor, opacity: indicatorOpacity, transparent: true });
			var sphere = new THREE.Mesh(sphereGeometry, material);
			sphere.coords = trueProbePoint;

			indicators.push(sphere);
		}
	}

	return indicators;
}

$("#modal_bed").on("shown.bs.modal", function () {
	if (meshGeometry == undefined) {
		// Don't proceed if we couldn't generate a mesh
		return;
	}

	// Get boundaries
	var width = $("#div_visualization").width();
	var height = $("#div_visualization").height();

	// Create THREE context
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
	camera.position.set(1.5, 1.5, 1.5);
	camera.up = new THREE.Vector3(0, 0, 1);

	renderer = new THREE.WebGLRenderer();
	renderer.setSize(width, height);

	// Allow grid to be moved and rotated by THREE OrbitControl
	var controls = new THREE.OrbitControls(camera, renderer.domElement);

	// Show legend+canvas div and insert WebGL element
	$("#div_visualization_placeholder").addClass("hidden");
	$("#div_visualization, #div_legend").removeClass("hidden");
	$("#div_visualization").html(renderer.domElement);
	$("#div_visualization > canvas").mousemove(canvasMouseMove).tooltip({ title: function() { return canvasTitle.split('\n').join("<br/>"); }, html: true, trigger: "manual" }).click(canvasClick);
	$("#modal_bed div.modal-content").resize();

	// Apply colors to geometry
	setFaceColors(meshGeometry);

	// Make 3D mesh
	var material = new THREE.MeshBasicMaterial({ vertexColors: THREE.VertexColors, side: THREE.DoubleSide });
	meshPlane = new THREE.Mesh(meshGeometry, material);
	scene.add(meshPlane);

	// Make indicators
	meshIndicators = generateIndicators(meshGeometry);
	meshIndicators.forEach(function(indicator) {
		scene.add(indicator);
	});

	// Make axis arrows
	var xMin = -0.6, yMin = -0.6;
	if (meshGeometry.hasOwnProperty("parameters") && meshGeometry.parameters.hasOwnProperty("width")) {
		xMin = meshGeometry.parameters.width * -0.5 - 0.1;
		yMin = meshGeometry.parameters.height * -0.5 - 0.1;
	}

	var xAxis = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(xMin, yMin, 0), 0.5, 0xFF0000);
	var yAxis = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xMin, yMin, 0), 0.5, 0x00FF00);
	var zAxis = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(xMin, yMin, 0), 0.5, 0x0000FF);
	scene.add(xAxis);
	scene.add(yAxis);
	scene.add(zAxis);

	// Make grid on XY plane
	var grid = new THREE.GridHelper(0.75, 15);
	grid.rotation.x = -Math.PI / 2;
	scene.add(grid);

	// Make raycaster
	raycaster = new THREE.Raycaster();

	// Render scene
	var render = function () {
		if (renderer != undefined) {
			requestAnimationFrame(render);
			renderer.render(scene, camera);
		}
	};
	render();
});

$("#modal_bed").on("hidden.bs.modal", function () {
	renderer.dispose();
	scene = camera = renderer = raycaster = undefined;

	$("#div_visualization").html("");
	$("#div_visualization_placeholder").removeClass("hidden");
	$("#div_visualization, #div_legend").addClass("hidden");
});

function canvasMouseMove(e) {
	if (e.pageX == undefined || probeXMin == undefined) {
		return;
	}

	// Try to get the Z value below the cursor
	// For that we need normalized X+Y coordinates between -1.0 and 1.0
	var mouse = new THREE.Vector2();
	var offset = $(this).offset();
	mouse.x = (e.pageX - offset.left) / $(this).width() * 2 - 1;
	mouse.y = -(e.pageY - offset.top) / $(this).height() * 2 + 1;

	// Is the cursor on a point indicator?
	raycaster.setFromCamera(mouse, camera);
	var intersection = raycaster.intersectObjects(meshIndicators);
	if (lastIntersection != undefined &&
		(intersection.length == 0 || intersection[0] != lastIntersection)) {
		lastIntersection.object.material.opacity = indicatorOpacity;
		lastIntersection = undefined;
	}

	var intersectionPoint = undefined;
	if (intersection.length > 0) {
		if (intersection[0] != lastIntersection) {
			lastIntersection = intersection[0];
			lastIntersection.object.material.opacity = indicatorOpacityHighlighted;
		}
		intersectionPoint = intersection[0].object.coords;
	}

	// Show the tooltip on md/lg devices and store it for xs/sm devices
	if (intersectionPoint == undefined) {
		updateCanvasTitle(undefined);
	} else {
		updateCanvasTitle(T("X: {0} mm\nY: {1} mm\nZ: {2} mm",
			intersectionPoint.x.toFixed(1), intersectionPoint.y.toFixed(1), intersectionPoint.z.toFixed(3)),
			e.pageX - offset.left, e.pageY - offset.top);
	}
}

var canvasTooltip, canvasTitle;
function updateCanvasTitle(title, x, y) {
	var canvas = $("#div_visualization > canvas");
	if (title == undefined) {
		// Remove title
		canvasTitle = undefined;

		// Hide tooltip if it exists
		if (canvasTooltip != undefined) {
			canvas.tooltip("hide");
			canvasTooltip = undefined;
		}
	} else {
		// Set title
		canvasTitle = title;

		// Show info on md/lg screens
		if (!windowIsXsSm()) {
			// Show tooltip
			if (canvasTooltip == undefined) {
				canvas.tooltip("show");
				canvasTooltip = $("#div_visualization > div.tooltip");
			}

			// Reposition tooltip
			canvasTooltip.css("left", x + 15 - canvasTooltip.outerWidth() / 2).css("top", y - canvasTooltip.outerHeight());
		}
	}
}

function canvasClick(e) {
	if (windowIsXsSm() && canvasTitle != undefined) {
		// Show message on xs/sm devices because the tooltip isn't really working there
		alert(canvasTitle);
	}
}

$("#modal_bed > div > div.modal-content").resize(function() {
	var contentHeight = $(this).height();
	var headerHeight = $("#modal_bed > div > div > div.modal-header").outerHeight();
	var footerHeight = $("#modal_bed > div > div > div.modal-footer").outerHeight();

	// Set body height
	var bodyHeight = contentHeight - headerHeight - footerHeight;
	$("#modal_bed > div > div > div.modal-body").css("height", bodyHeight);

	// Set canvas height
	var childrenHeight = 45; // top+bottom margins
	$("#modal_bed > div > div > div.modal-body").children().each(function() {
		if ($(this).children("#div_visualization").length == 0) {
			childrenHeight += $(this).outerHeight();
		}
	});

	var canvasHeight = bodyHeight - childrenHeight;
	$("#div_visualization, #div_legend").css("height", canvasHeight + "px");
	$("#div_visualization_placeholder > div").css("height", canvasHeight + "px").css("line-height", canvasHeight + "px");

	if (camera != undefined) {
		var canvasWidth = $("#div_visualization").width();

		camera.aspect = canvasWidth / canvasHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(canvasWidth, canvasHeight);
	}

	// Resize and redraw legend canvas
	var canvas = document.getElementById("canvas_legend");
	canvas.height = canvasHeight;
	canvas.width = $("#canvas_legend").parent().width();
	canvas.style.width = canvas.width + "px";
	canvas.style.height = canvasHeight + "px";
	var legendWidth = canvas.width;
	var context = canvas.getContext("2d");

	// clear background
	context.rect(0, 0, legendWidth, canvasHeight);
	context.fillStyle = "black";
	context.fill();

	// annotations above gradient
	context.font = "14px Helvetica";
	context.textAlign = "center";
	context.fillStyle = "white";
	context.fillText(T("Scale:"), legendWidth / 2, 21);
	context.fillText(T("{0} mm", maxVisualizationZ), legendWidth / 2, 44);
	context.fillText(T("or more"), legendWidth / 2, 60);

	// scale gradient
	var showAxes = canvasHeight > 180;
	var scaleHeight = showAxes ? (canvasHeight - 139) : (canvasHeight - 96);
	if (colorScheme == "terrain") {
		scaleHeight -= 16;
	}

	var gradient = context.createLinearGradient(0, 66, 0, 66 + scaleHeight);
	if (colorScheme == "terrain") {
		gradient.addColorStop(0.0, "hsl(0,100%,45%)");
		gradient.addColorStop(0.25, "hsl(60,100%,45%)");
		gradient.addColorStop(0.5, "hsl(120,100%,45%)");
		gradient.addColorStop(0.75, "hsl(180,100%,45%)");
		gradient.addColorStop(1.0, "hsl(240,100%,45%)");
	} else {
		gradient.addColorStop(0.0, "hsl(0,100%,45%)");
		gradient.addColorStop(0.5, "hsl(60,100%,45%)");
		gradient.addColorStop(1.0, "hsl(120,100%,45%)");
	}
	context.fillStyle = gradient;
	context.fillRect(legendWidth / 2 - 12, 66, 24, scaleHeight);

	// annotation below gradient
	context.fillStyle = "white";
	if (colorScheme == "terrain") {
		context.fillText(T("{0} mm", -maxVisualizationZ), legendWidth / 2, scaleHeight + 82);
		context.fillText(T("or less"), legendWidth / 2, scaleHeight + 98);
		scaleHeight += 16;
	} else {
		context.fillText(T("{0} mm", "0.00"), legendWidth / 2, scaleHeight + 82);
	}

	// axes
	if (showAxes) {
		context.fillText(T("Axes:"), legendWidth / 2, scaleHeight + 109);
		context.font = "bold 14px Helvetica";
		context.fillStyle = "rgb(255,0,0)";
		context.fillText("X", legendWidth / 3, scaleHeight + 129);
		context.fillStyle = "rgb(0,255,0)";
		context.fillText("Y", legendWidth / 2, scaleHeight + 129);
		context.fillStyle = "rgb(0,0,255)";
		context.fillText("Z", 2 * legendWidth / 3, scaleHeight + 129);
	}
});

$("#btn_top_view").click(function() {
	camera.position.set(0, 0, 2);
	camera.rotation.set(0, 0, 0);
	camera.updateProjectionMatrix();
});

$("#a_show_bed_points").click(function(e) {
	if (bedProbePoints != undefined) {
		showBedCompensation(bedProbePoints);
	}
	e.preventDefault();
});

$("#a_show_heightmap").click(function(e) {
	getHeightmap();
	e.preventDefault();
});

$(".color-scheme").click(function(e) {
	colorScheme = $(this).data("scheme");

	setFaceColors(meshGeometry);
	$("#modal_bed > div > div.modal-content").resize();

	e.preventDefault();
});