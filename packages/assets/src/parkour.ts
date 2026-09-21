import manifest from '../parkour/manifest.json';

const loaders = import.meta.glob<string>('../parkour/assets/**/*.png', {
  import: 'default',
  query: '?url',
});
const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));

export const PARKOUR_MANIFEST = manifest;

export async function loadParkourAssets(
  ids: readonly string[],
): Promise<Readonly<Record<string, string>>> {
  const entries = await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const asset = assets.get(id);
      const load = asset && loaders[`../parkour/${asset.file}`];
      if (!asset || !load) throw new Error(`Unknown parkour asset: ${id}`);
      return [id, await load()] as const;
    }),
  );
  return Object.fromEntries(entries);
}
