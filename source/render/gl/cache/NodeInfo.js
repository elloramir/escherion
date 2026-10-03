// Per-node snapshot of the display protocol, refreshed once per frame by `SceneGraph.prepare` and
// then used by the draw pass, so the expensive VM property reads happen exactly once per node.
//
// Two hashes describe a node:
//  - `contentSig`: what is *inside* the node (its character, text, drawing commands and every
//    descendant's full state), independent of the node's own transform, alpha, colour transform
//    and blend mode. A cached group raster (filters, masks) stays valid while this is unchanged.
//  - `sig`: everything, including the node's own placement state.
// Equal root `sig` across frames means nothing visible changed.
class NodeInfo {

    constructor(node) {
        this.node = node;
        this.id = 0;
        this.visible = true;
        this.x = 0;
        this.y = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.rotation = 0;
        this.alpha = 1;
        this.ct = null;
        this.blend = "normal";
        this.filters = null;
        this.mask = null;
        this.tag = null;
        this.tagName = null;
        this.ratio = 0;
        this.commands = null;
        this.commandCount = 0;
        this.bitmapData = null;
        // True when the subtree holds a placed bitmap, mask or blend mode: not safe to cache.
        this.unsafeBounds = false;
        this.grid = null;
        this.scrollRect = null;
        this.smoothing = false;
        this.textSource = null;
        this.textVersion = 0;
        this.textWidth = 0;
        this.textHeight = 0;
        this.dictionary = null;
        this.kids = [];
        this.sig = 0;
        this.contentSig = 0;
        this.isMasker = false;
        // The game asked for this node to be rasterized once and reused as an image.
        this.cacheAsBitmap = false;
        // True when the node or any descendant is a mask (the raster cache cannot remap mask space).
        this.hasMask = false;
        // True when the node or any descendant has filters (they flatten against the backdrop).
        this.hasFilter = false;
        // True when the node or any descendant has a `scrollRect` (its scissor is in canvas space).
        this.hasScrollRect = false;
        // Consecutive frames `contentSig` stayed the same (drives static-subtree baking).
        this.staticFrames = 0;
        this.lastContentSig = 0;
        // Rough draw-call cost of the subtree (shapes, graphics, text, bitmaps).
        this.cost = 0;
        // Actual draw cost in mesh layers (fills + strokes), propagated up the tree. Shapes count
        // their real layer count (recorded on first draw), so a static multi-layer shape or a
        // subtree of them can reach the frame-cache threshold even when it is a leaf.
        this.drawCost = 0;
        this.bounds = null;
        this.boundsSig = -1;
        this.boundsEmpty = true;
    }
}

export default NodeInfo;
