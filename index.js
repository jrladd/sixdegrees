// Import libraries (graphology from min files)
// Using d3 for CSV parsing
// import graphology from 'https://esm.run/graphology';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm";
import {Sigma} from "https://esm.run/sigma"
import { NodeBorderProgram } from "https://esm.run/@sigma/node-border";
import {animateNodes} from "https://esm.run/sigma/utils"
// import {generate} from "./generate-graph.js"

let start = new Date()
let graph = new graphology.Graph({type: 'undirected'})
graph.import(await d3.json('sdfb.graph'))
// let graph = await generate()

// Render graph with Sigma
const container = document.getElementById("sigma-container");
let renderer = new Sigma(graph, container, {
    allowInvalidContainer: true,
    defaultNodeType: "bordered",
    nodeProgramClasses: {
      bordered: NodeBorderProgram,
    }
});

/*
INTERACTIVITY
*/

// Variables to use with different event listeners
const searchInput = document.getElementById("search-input");
const rangeInputMin = document.getElementById("minYear");
const rangeInputMax = document.getElementById("maxYear");
const searchSuggestions = document.getElementById("suggestions");
const confidenceInput = document.getElementById("confidence");
const confSubhead = document.getElementById('subhead1');
const dateSubhead = document.getElementById('subhead2');
const confNumber = document.getElementById('conf-num');
const minYearNum = document.getElementById('minYearNum');

// Populate suggestions with node names for autocomplete
searchSuggestions.innerHTML = graph
    .nodes()
    .map((node) => `<option value="${graph.getNodeAttribute(node, "label")}"></option>`)
    .join("\n");

// Create an object to store state variables
const state = {
    hoveredNode: undefined,
    searchQuery: undefined,

    // State derived from query:
    selectedNode: undefined,
    suggestions: undefined,

    // State derived from hovered node:
    hoveredNeighbors: undefined,

    // State derived from date slider:
    minYear: rangeInputMin.value,
    maxYear: rangeInputMax.value,
    confidenceThreshold: confidenceInput.value
};

confSubhead.innerHTML = `${state.confidenceThreshold}% Confidence`;
dateSubhead.innerHTML = `${state.minYear}–${state.maxYear}`

// Function for searching with the search box
function setSearchQuery(query) {
    state.searchQuery = query;
  
    if (searchInput.value !== query) searchInput.value = query;
  
    if (query) {
      const lcQuery = query.toLowerCase();
      const suggestions = graph
        .nodes()
        .map((n) => ({ id: n, label: graph.getNodeAttribute(n, "label")}))
        .filter(({ label }) => label.toLowerCase().includes(lcQuery));
  
      // If we have a single perfect match, them we remove the suggestions, and
      // we consider the user has selected a node through the datalist
      // autocomplete:
      if (suggestions.length === 1 && suggestions[0].label === query) {
        state.selectedNode = suggestions[0].id;
        state.suggestions = undefined;
  
        // Move the camera to center it on the selected node:
        const nodePosition = renderer.getNodeDisplayData(state.selectedNode);
        renderer.getCamera().animate(nodePosition, {
          duration: 500,
        });
      }
      // Else, we display the suggestions list:
      else {
        state.selectedNode = undefined;
        state.suggestions = new Set(suggestions.map(({ id }) => id));
      }
    }
    // If the query is empty, then we reset the selectedNode / suggestions state:
    else {
      state.selectedNode = undefined;
      state.suggestions = undefined;
    }
  
    // Refresh rendering
    // You can directly call `renderer.refresh()`, but if you need performances
    // you can provide some options to the refresh method.
    // In this case, we don't touch the graph data so we can skip its reindexation
    renderer.refresh({
      skipIndexation: true,
    });
}

// Function for hovering, avoids conflict with search
function setHoveredNode(node) {
if (node) {
    state.hoveredNode = node;
    state.hoveredNeighbors = new Set(graph.neighbors(node));
}

// Compute the partial that we need to re-render to optimize the refresh
const nodes = graph.filterNodes((n) => n !== state.hoveredNode && !state.hoveredNeighbors?.has(n));
const nodesIndex = new Set(nodes);
const edges = graph.filterEdges((e) => graph.extremities(e).some((n) => nodesIndex.has(n)));

if (!node) {
    state.hoveredNode = undefined;
    state.hoveredNeighbors = undefined;
}

// Refresh rendering
renderer.refresh({
    partialGraph: {
    nodes,
    edges,
    },
    // We don't touch the graph data so we can skip its reindexation
    skipIndexation: true,
});
}
// let categories = graph.mapNodes((n, attr) => attr.community)
let categories = [...new Set(graph.mapNodes((n, attr) => attr.community))].sort()
let colors = d3.scaleOrdinal(categories,["dodgerblue", "orange", "firebrick", "gold", "navy", "sienna", "saddlebrown", "orangered", "indigo", "goldenrod"])
let lightcolors = d3.scaleOrdinal(categories,["#1e90ffd0", "#ffa500d0", "#b22222d0", "#ffd700d0", "#000080d0", "#a0522dd0", "#8b4513d0", "#ff4500d0", "#4b0082d0", "#daa520d0"])
// let colors = ["#00A9E6", "#E6D800", "#E60135", "#913047", "#335966", "#666333"]

// Render nodes accordingly to the internal state:
// 1. If a node is selected, it is highlighted
// 2. If there is query, all non-matching nodes are greyed
// 3. If there is a hovered node, all non-neighbor nodes are greyed
// 4. If time slider is changed, only those nodes are displayed
renderer.setSetting("nodeReducer", (node, data) => {
const res = { ...data };
res.color=lightcolors(res.community);
res.borderColor = colors(res.community);

if (state.hoveredNeighbors && !state.hoveredNeighbors.has(node) && state.hoveredNode !== node) {
    res.hidden = true;
}

if (state.selectedNode === node) {
    res.highlighted = true;
} else if (state.suggestions) {
    if (state.suggestions.has(node)) {
    res.forceLabel = true;
    } else {
    res.label = "";
    res.color = "#f6f6f6";
    res.borderColor = "#f6f6f6";
    }
}

let qualified = []
graph.forEachEdge(node, (e, attr) => {
    if (parseInt(attr.start_year) > state.maxYear || parseInt(attr.end_year) < state.minYear || parseInt(attr.max_certainty) < state.confidenceThreshold) {
    qualified.push(e)
    }
});

if (qualified.length == graph.degree(node)) {
    res.hidden = true;
}

return res;
});

// Render edges according to the same rules
renderer.setSetting("edgeReducer", (edge, data) => {
const res = { ...data };

if (state.hoveredNode && !graph.hasExtremity(edge, state.hoveredNode)) {
    res.hidden = true;
}

if (
    state.suggestions &&
    (!state.suggestions.has(graph.source(edge)) || !state.suggestions.has(graph.target(edge)))
) {
    res.hidden = true;
}

if (parseInt(data.start_year) > state.maxYear || parseInt(data.end_year) < state.minYear || parseInt(data.max_certainty) < state.confidenceThreshold) {
    res.hidden = true;
}

return res;
});

// Event listeners
// Listen for search entry
searchInput.addEventListener("input", () => {
    setSearchQuery(searchInput.value || "");
});
// Listen for focus leaving search
searchInput.addEventListener("blur", () => {
    setSearchQuery("");
});
// Listen for change in minimum date range
rangeInputMin.addEventListener("input", () => {
    if (rangeInputMin.value > rangeInputMax.value) {
        rangeInputMin.value = rangeInputMax.value
    }
    state.minYear = rangeInputMin.value
    minYearNum.value = rangeInputMin.value
    dateSubhead.innerHTML = `${state.minYear}–${state.maxYear}`
    renderer.refresh({
      skipIndexation: true,
    });
});

minYearNum.addEventListener("input", () => {
    state.minYear = minYearNum.value
    rangeInputMin.value = minYearNum.value
    dateSubhead.innerHTML = `${state.minYear}–${state.maxYear}`
    renderer.refresh({
      skipIndexation: true,
    });
});

["change","blur"].forEach(evt => {
    minYearNum.addEventListener(evt, () => {
        if (minYearNum.value < 1450) {minYearNum.value = 1450};
        if (minYearNum.value > state.maxYear) {minYearNum.value = state.maxYear};
        state.minYear = minYearNum.value
        rangeInputMin.value = minYearNum.value
        dateSubhead.innerHTML = `${state.minYear}–${state.maxYear}`
        renderer.refresh({
        skipIndexation: true,
        });
    });
});

// Listen for change in maximum date range
rangeInputMax.addEventListener("input", () => {
    if (rangeInputMax.value < rangeInputMin.value) {
        rangeInputMax.value = rangeInputMin.value
    }
    state.maxYear = rangeInputMax.value
    maxYearNum.value = rangeInputMax.value
    dateSubhead.innerHTML = `${state.minYear}–${state.maxYear}`
    renderer.refresh({
      skipIndexation: true,
    });
});

maxYearNum.addEventListener("input", () => {
    state.maxYear = maxYearNum.value
    rangeInputMax.value = maxYearNum.value
    dateSubhead.innerHTML = `${state.minYear}–${state.maxYear}`
    renderer.refresh({
      skipIndexation: true,
    });
});

["change", "blur"].forEach(evt => {
    maxYearNum.addEventListener(evt, () => {
        if (maxYearNum.value < state.minYear) {maxYearNum.value = state.minYear};
        if (maxYearNum.value > 1779) {maxYearNum.value = 1779};
        state.maxYear = maxYearNum.value
        rangeInputMax.value = maxYearNum.value
        dateSubhead.innerHTML = `${state.minYear}–${state.maxYear}`
        renderer.refresh({
        skipIndexation: true,
        });
    });
});

// Listen for change in confidence
confidenceInput.addEventListener("input", () => {
    state.confidenceThreshold = confidenceInput.value
    confSubhead.innerHTML = `${state.confidenceThreshold}% Confidence`
    confNumber.value = confidenceInput.value
    renderer.refresh({
      skipIndexation: true,
    });
});

confNumber.addEventListener("input", () => {
    state.confidenceThreshold = confNumber.value
    confSubhead.innerHTML = `${state.confidenceThreshold}% Confidence`
    confidenceInput.value = confNumber.value
    renderer.refresh({
      skipIndexation: true,
    });
});

confNumber.addEventListener("blur", () => {
    if (confNumber.value < 60) {confNumber.value = 60};
    if (confNumber.value > 100) {confNumber.value = 100};
    state.confidenceThreshold = confNumber.value
    confSubhead.innerHTML = `${state.confidenceThreshold}% Confidence`
    confidenceInput.value = confNumber.value
    renderer.refresh({
      skipIndexation: true,
    });
});

// Bind graph interactions:
renderer.on("enterNode", ({ node }) => {
    setHoveredNode(node);
});
renderer.on("leaveNode", ({ node }) => {
    setHoveredNode(undefined);
});

// Buttons to change layout
const FA2Button = document.getElementById("forceatlas2")
const FA2StopLabel = document.getElementById("forceatlas2-stop-label")
const FA2StartLabel = document.getElementById("forceatlas2-start-label")
const circularButton = document.getElementById("circular")

/** FA2 LAYOUT **/
/* This example shows how to use the force atlas 2 layout in a web worker */

// Graphology provides a easy to use implementation of Force Atlas 2 in a web worker
const sensibleSettings = graphologyLibrary.layoutForceAtlas2.inferSettings(graph);
const fa2Layout = new graphologyLibrary.FA2Layout(graph, {
settings: sensibleSettings,
});

// A button to trigger the layout start/stop actions

// A variable is used to toggle state between start and stop
// let cancelCurrentAnimation: (() => void) | null = null;

// correlate start/stop actions with state management
function stopFA2() {
fa2Layout.stop();
FA2StartLabel.style.display = "flex";
FA2StopLabel.style.display = "none";
}
function startFA2() {
// if (cancelCurrentAnimation) cancelCurrentAnimation();
fa2Layout.start();
FA2StartLabel.style.display = "none";
FA2StopLabel.style.display = "flex";
}

// the main toggle function
function toggleFA2Layout() {
if (fa2Layout.isRunning()) {
    stopFA2();
} else {
    startFA2();
}
}
// bind method to the forceatlas2 button
FA2Button.addEventListener("click", toggleFA2Layout);

/** CIRCULAR LAYOUT **/
/* This example shows how to use an existing deterministic graphology layout */
function circularLayout() {
    // stop fa2 if running
    if (fa2Layout.isRunning()) stopFA2();
    // if (cancelCurrentAnimation) cancelCurrentAnimation();

    //since we want to use animations we need to process positions before applying them through animateNodes
    // const circularPositions = circular(graph, { scale: 100 });
    const circularPositions= graphologyLibrary.layout.circlepack(graph, {
        hierarchyAttributes: ['community','degreeCentrality']
    })
    //In other context, it's possible to apply the position directly we : circular.assign(graph, {scale:100})
    animateNodes(graph, circularPositions, { duration: 2000, easing: "linear" });
}

// bind method to the random button
circularButton.addEventListener("click", circularLayout);

let edges = graph.edges().map(e => graph.getEdgeAttributes(e))
// Create confidence plot and add to tools panel
const confPlot = Plot.plot({
    // y: {grid: true},
    height: 100,
    marks: [
      Plot.areaY(edges, Plot.binX({y: "count"}, {x: "max_certainty", fill: "dodgerblue", fillOpacity: 0.2})),
      Plot.lineY(edges, Plot.binX({y: "count"}, {x: "max_certainty", stroke: "dodgerblue"})),
    //   Plot.ruleY([0])
    ]
  })

const confPlotDiv = document.querySelector("#conf-plot");
confPlotDiv.append(confPlot);

// Generate data for time plot
let y = 1450;
let yearFreq = [];
while (y < 1780) {
    let yfData = {'year': d3.utcParse("%Y")(y), 'edge_count': 0}
    edges.forEach(e => {
        if (parseInt(e.start_year) < y && parseInt(e.end_year) > y) {
            yfData.edge_count++
        }
    });
    yearFreq.push(yfData);
    y++;
}

// Create time plot and add to tools panel
const timePlot = Plot.plot({
    x: {
    label: "year",
    domain: [new Date("1450-01-01"),new Date("1780-01-01")]
    },
    height: 100,
    marks: [
      Plot.areaY(yearFreq, {y: "edge_count", x: "year", fill: "firebrick", fillOpacity: 0.2, interval: d3.utcYear}),
      Plot.lineY(yearFreq, {y: "edge_count", x: "year", stroke: "firebrick"}),
    ]
  })

const timePlotDiv = document.querySelector("#time-plot");
timePlotDiv.append(timePlot);


let end = new Date()

console.log(end - start)
// Nothing: 11410ms
// With component: 11187ms
// With force layout: 22983ms
// With community: 23471ms
// Data import: 11181ms
