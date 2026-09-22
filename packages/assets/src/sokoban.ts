import manifest from '../sokoban/manifest.json';

const loaders = import.meta.glob<string>('../sokoban/runtime/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
});

export const SOKOBAN_MANIFEST = manifest;
export type SokobanAsset = (typeof manifest.assets)[number] & { readonly url: string };
export type SokobanAssetId = (typeof manifest.assets)[number]['id'];

function resolveAssetUrl(file: string): string {
  const url = loaders[`../sokoban/${file}`];
  if (!url) throw new Error(`Missing sokoban asset: ${file}`);
  return url;
}

export const SOKOBAN_ASSETS = Object.fromEntries(
  manifest.assets.map((asset) => [asset.id, { ...asset, url: resolveAssetUrl(asset.file) }]),
) as Readonly<Record<SokobanAssetId, SokobanAsset>>;

export function getSokobanAsset(id: string): SokobanAsset {
  const asset = SOKOBAN_ASSETS[id as SokobanAssetId];
  if (!asset) throw new Error(`Unknown sokoban asset: ${id}`);
  return asset;
}
