import manifest from '../match3/asset-manifest.json';

// The portrait and reaction PNG masters have runtime WebP derivatives. Keep
// them out of the production bundle while retaining the original art pack.
const assetUrls = import.meta.glob(
  [
    '../match3/assets/**/*.png',
    '!../match3/assets/tiles/*_tile_portrait.png',
    '!../match3/assets/tiles/*_tile_reaction_*.png',
  ],
  {
    eager: true,
    import: 'default',
    query: '?url',
  },
) as Record<string, string>;
const displayTileUrls = import.meta.glob('../match3/runtime-tiles/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export const MATCH3_ASSET_MANIFEST = manifest;

export type Match3Asset = (typeof manifest.assets)[number] & {
  readonly url: string;
};

export type Match3AssetId = (typeof manifest.assets)[number]['id'];

function resolveAssetUrl(path: string): string {
  const displayTile =
    displayTileUrls[
      `../match3/runtime-tiles/${path
        .split('/')
        .at(-1)
        ?.replace(/\.png$/, '.webp')}`
    ];
  if (displayTile) return displayTile;
  const url = assetUrls[`../match3/${path}`];
  if (!url) {
    throw new Error(`Missing match3 asset: ${path}`);
  }

  return url;
}

export const MATCH3_ASSETS = Object.fromEntries(
  manifest.assets.map((asset) => [asset.id, { ...asset, url: resolveAssetUrl(asset.path) }]),
) as Readonly<Record<Match3AssetId, Match3Asset>>;

export function getMatch3Asset(id: string): Match3Asset {
  const asset = MATCH3_ASSETS[id as Match3AssetId];
  if (!asset) {
    throw new Error(`Unknown match3 asset: ${id}`);
  }

  return asset;
}
