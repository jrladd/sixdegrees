import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export async function generate() {
    // Import node and edge CSVs
    const nodes = await d3.csv('SDFB_people_2024_05_30.csv')
    const edges = await d3.csv('SDFB_relationships_2024_05_30.csv')

    // Create Graph object
    let graph = new graphology.Graph({type: 'undirected'})
    let all_nodes = nodes.map(n => n.id)
    nodes.forEach(n => {
        graph.addNode(n.id, n);
    });
    edges.forEach(e => {
        // Limit to 60% certainty
        if (all_nodes.indexOf(e.person1_index) !== -1 && all_nodes.indexOf(e.person2_index) !== -1 && e.max_certainty >= 60) {
        graph.addEdge(e.person1_index,e.person2_index,e);
        }
    });

    // Get only largest component
    graphologyLibrary.components.cropToLargestConnectedComponent(graph)


    // Add attributes and update appearance
    // Centrality
    graphologyLibrary.metrics.centrality.degree.assign(graph)
    const centralityArray = graph.nodes().map(n => graph.getNodeAttribute(n, 'degreeCentrality'))
    // Log scale for node size
    let logScale = d3.scaleLog([Math.min(...centralityArray), Math.max(...centralityArray)], [1, 8]).nice();
    // Louvain modularity
    graphologyLibrary.communitiesLouvain.assign(graph, {
        resolution: 0.5,
        getEdgeWeight: 'max_certainty'
    });
    // Colors for louvain categories (from colorbrewer)
    let colors = ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928']
    
    // All attributes added to nodes
    graph.forEachNode((n,attr) => {
        graph.setNodeAttribute(n, "size", logScale(attr.degreeCentrality));//graph.degree(n)/100);
        graph.setNodeAttribute(n, "label", attr.display_name);
        graph.setNodeAttribute(n, "color", colors[attr.community]);
    });

    graphologyLibrary.layout.circlepack.assign(graph, {
        hierarchyAttributes: ['community','degreeCentrality']
    })

    console.log(graph.export())
    return graph
}