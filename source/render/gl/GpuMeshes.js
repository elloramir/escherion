
// Uploads backend-neutral meshes ({layers: [{triangles}]}) to GL buffers, one per mesh object.
// All layers share a vertex buffer; each layer is a [first, count) range, so drawing a mesh is
// one VAO bind plus drawArrays calls. The WeakMap cache holds the buffers, and a FinalizationRegistry
// frees the GL objects once the mesh is collected.
class GpuMeshes {

    #context;
    #cache = new WeakMap();
    #registry;

    constructor(context) {
        this.#context = context;
        this.#registry = typeof FinalizationRegistry === "function"
            ? new FinalizationRegistry(({ buffer, vao }) => {
                if (this.#context.lost) return;
                this.#context.gl.deleteBuffer(buffer);
                this.#context.gl.deleteVertexArray(vao);
            })
            : null;
    }

    get(mesh) {
        let gpu = this.#cache.get(mesh);
        if (gpu !== undefined) return gpu;
        gpu = this.#upload(mesh);
        this.#cache.set(mesh, gpu);
        return gpu;
    }

    #upload(mesh) {
        let total = 0;
        for (const layer of mesh.layers) total += layer.triangles.length;
        if (total === 0) return null;
        const gl = this.#context.gl;
        const data = new Float32Array(total);
        const ranges = [];
        let offset = 0;
        for (const layer of mesh.layers) {
            ranges.push({ first: offset / 2, count: layer.triangles.length / 2 });
            data.set(layer.triangles, offset);
            offset += layer.triangles.length;
        }
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        this.#registry?.register(mesh, { buffer, vao });
        return { vao, ranges };
    }
}

export default GpuMeshes;
