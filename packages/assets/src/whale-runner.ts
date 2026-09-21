import manifest from '../whale-runner/runtime/manifest.json';

const loaders = import.meta.glob<string>('../whale-runner/runtime/*.webp', {
  import: 'default',
  query: '?url',
});
const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));

export const WHALE_RUNNER_MANIFEST = manifest;

export async function loadWhaleRunnerAssets(
  ids: readonly string[],
): Promise<Readonly<Record<string, string>>> {
  const entries = await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const asset = assets.get(id);
      const load = asset && loaders[`../whale-runner/${asset.file}`];
      if (!asset || !load) throw new Error(`Unknown whale runner asset: ${id}`);
      return [id, await load()] as const;
    }),
  );
  return Object.fromEntries(entries);
}
