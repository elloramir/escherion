import Flattener from "./Flattener.js";
import FillMesh from "./FillMesh.js";
import LayerPacker from "./LayerPacker.js";
import StrokeMesh from "./StrokeMesh.js";

// Turns the draw paths produced by `ShapesBuilder` into GPU-ready layers for the
// stencil-then-cover renderer.
//
// Layers follow the Canvas `ShapeRenderer` order: all fills in their order, then all strokes,
// where strokes sharing one style object become one layer (as `ShapeCache` does when it builds a
// single `Path2D` per style).
class MeshBuilder {

    static build(drawPaths, options = {}) {
        const scale = options.scale > 0 ? options.scale : 1 / 20;
        const packer = new LayerPacker();
        let thin = false;
        // Paint order is per style layer: that layer's fills, then its strokes, then the next layer
        // (Ruffle `flush_layer`). Painting every fill before every stroke let an earlier layer's
        // outlines show through a later layer's fills.
        const layerOf = (entry) => entry.layer ?? 0;
        const layers = new Set([...drawPaths.fills.map(layerOf), ...drawPaths.strokes.map(layerOf)]);
        for (const layerIndex of [...layers].sort((x, y) => x - y)) {
            for (const fill of drawPaths.fills) {
                if (layerOf(fill) !== layerIndex || !fill.commands || fill.commands.length === 0) continue;
                const mesh = FillMesh.build(Flattener.flatten(fill.commands, scale));
                packer.addFill(fill.style, fill.windingRule === "nonzero" ? "nonzero" : "evenodd", mesh);
            }
            const byStyle = new Map();
            for (const stroke of drawPaths.strokes) {
                if (layerOf(stroke) !== layerIndex || !stroke.commands || stroke.commands.length === 0) continue;
                let contours = byStyle.get(stroke.style);
                if (contours === undefined) {
                    contours = [];
                    byStyle.set(stroke.style, contours);
                }
                for (const contour of Flattener.flatten(stroke.commands, scale)) contours.push(contour);
            }
            for (const [style, contours] of byStyle) {
                if (!style) continue;
                const layer = MeshBuilder.strokeLayer(style, contours, scale);
                if (layer === null) continue;
                if (layer.widened) thin = true;
                delete layer.widened;
                packer.addLayer(layer);
            }
        }
        return MeshBuilder.finish(packer.finish(), scale, thin);
    }

    // Builds one stroke layer from contours, or null when empty.
    static strokeLayer(style, contours, scale) {
        if (contours.length === 0) return null;
        const params = StrokeMesh.resolve(style, scale);
        const mesh = StrokeMesh.build(contours, params, scale);
        if (mesh.triangles.length === 0) return null;
        return {
            kind: "stroke",
            style,
            width: params.width,
            triangles: mesh.triangles,
            bbox: mesh.bbox,
            widened: params.widened,
        };
    }

    // Wraps layers into a mesh with their union bounds.
    static finish(layers, scale, thin) {
        let xMin = Infinity;
        let yMin = Infinity;
        let xMax = -Infinity;
        let yMax = -Infinity;
        for (const layer of layers) {
            if (layer.bbox[0] < xMin) xMin = layer.bbox[0];
            if (layer.bbox[1] < yMin) yMin = layer.bbox[1];
            if (layer.bbox[2] > xMax) xMax = layer.bbox[2];
            if (layer.bbox[3] > yMax) yMax = layer.bbox[3];
        }
        const bounds = layers.length === 0
            ? { xMin: 0, yMin: 0, xMax: 0, yMax: 0 }
            : { xMin, yMin, xMax, yMax };
        return { bounds, scale, thin, layers };
    }
}

export default MeshBuilder;
