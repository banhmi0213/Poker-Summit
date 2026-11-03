/** Separate module so the bundler sees the worker URL, while server renders and tests never load it (imported lazily). */
export function createGtoWorker():Worker{return new Worker(new URL('../../lib/poker/gto.worker.ts',import.meta.url));}
