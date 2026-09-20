import manifest from '../match3/asset-manifest.json';

const assetUrls = import.meta.glob('../match3/assets/**/*.png', {
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
