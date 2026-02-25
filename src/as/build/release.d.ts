/** Exported memory */
export declare const memory: WebAssembly.Memory;
/**
 * src/as/assembly/index/solveTSPDP
 * @param weights `~lib/typedarray/Uint32Array`
 * @param n `i32`
 * @param dp `~lib/typedarray/Uint32Array`
 * @param log2 `~lib/typedarray/Uint32Array`
 */
export declare function solveTSPDP(weights: Uint32Array, n: number, dp: Uint32Array, log2: Uint32Array): void;
