import { expect, test, type Locator } from '@playwright/test';

async function centerOf(locator: Locator) {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('The navigation target must be visible');
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function expectRefraction(lens: Locator, optics = lens.locator('filter')) {
  await expect(lens).toBeVisible();
  await expect(lens).toHaveCSS('backdrop-filter', /url\(/);
  await expect(optics.locator('feImage')).toHaveAttribute('href', /^data:image\/png/);
  await lens.scrollIntoViewIfNeeded();
  const bounds = (await lens.boundingBox())!;
  const viewport = lens.page().viewportSize()!;
  const clip = {
    x: Math.max(0, bounds.x),
    y: Math.max(0, bounds.y),
    width: Math.min(bounds.width, viewport.width - Math.max(0, bounds.x)),
    height: Math.min(bounds.height, viewport.height - Math.max(0, bounds.y)),
  };
  const screenshot = () => lens.page().screenshot({ clip, animations: 'disabled', scale: 'css' });
  let refracted = await screenshot();
  await expect
    .poll(async () => {
      const settled = await screenshot();
      const stable = refracted.equals(settled);
      refracted = settled;
      return stable;
    })
    .toBe(true);

  const displacement = optics.locator('feDisplacementMap');
  const scale = (await displacement.getAttribute('scale'))!;
  expect(Number(scale)).toBeGreaterThan(0);
  try {
    // Keep the same CSS filter, tint and blur; only disable its displacement.
    await displacement.evaluate((element) => element.setAttribute('scale', '0'));
    const unshifted = await screenshot();
    expect(refracted.equals(unshifted), `${lens} should visibly bend its backdrop`).toBe(false);
  } finally {
    await displacement.evaluate((element, value) => element.setAttribute('scale', value), scale);
  }
  expect(refracted.equals(await screenshot()), 'Restoring displacement restores the image').toBe(
    true,
  );
}

test('renders the glass platform and lets a surface stretch and settle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  const canvas = page.locator('canvas.liquid-glass-canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  await expect(canvas).toHaveCSS('pointer-events', 'none');
  await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeVisible();
  await expect(page.locator('.catalog-card')).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  const surface = page.locator('.game-filters button[data-glass]').first();
  await surface.hover({ position: { x: 12, y: 12 } });
  await expect
    .poll(() =>
      surface.evaluate((element) =>
        Math.abs(Number.parseFloat(getComputedStyle(element).getPropertyValue('--glass-x'))),
      ),
    )
    .toBeGreaterThan(0.2);
  await page.mouse.move(0, 0);
  await expect
    .poll(() =>
      surface.evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          Math.abs(Number.parseFloat(style.getPropertyValue('--glass-x'))) +
          Math.abs(Number.parseFloat(style.getPropertyValue('--glass-y')))
        );
      }),
    )
    .toBeLessThan(0.15);
  expect(errors).toEqual([]);
});

test('filters remain usable and game glass stays within the toolbar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '文字', exact: true }).click();
  await expect(page.getByRole('button', { name: '文字', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.catalog-card')).toHaveCount(0);
  await expect(page.getByText('这个分类还在孵化中', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看全部游戏', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(4);
  await expect(page.getByRole('button', { name: '全部', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: /AI 娘消消乐/ }).click();
  await expect(page).toHaveURL(/#\/games\/match3$/);
  await expect(page.locator('.match3-tile')).toHaveCount(64);
  await expect(page.locator('.game-toolbar canvas.liquid-glass-canvas')).toHaveAttribute(
    'data-renderer',
    'webgl',
  );
  await expect(page.locator('.game-stage canvas')).toHaveCount(0);
  await expect(page.locator('.site-header, .site-nav')).toHaveCount(0);
  await expect(page.getByTestId('moves')).toHaveText('20');
  await page.getByRole('button', { name: '返回游戏列表', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeVisible();
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  await expect(page.locator('canvas.liquid-glass-canvas')).toHaveAttribute(
    'data-renderer',
    'webgl',
  );
  await expect(page.locator('.match3-tile')).toHaveCount(0);
});

test('reduced motion keeps the glass readable without elastic displacement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('canvas.liquid-glass-canvas')).toHaveAttribute(
    'data-renderer',
    'webgl',
  );
  const surface = page.locator('.game-filters button[data-glass]').first();
  await expect(surface).toBeVisible();
  const initialTransform = await surface.evaluate((element) => getComputedStyle(element).transform);
  await surface.hover({ position: { x: 12, y: 12 } });
  await page.mouse.down();
  await expect(surface).toHaveCSS('transform', initialTransform);
  await page.mouse.up();
  await page.getByRole('button', { name: '益智', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(2);
});

test('dock shell and selected tab refract the page before and after navigation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const navigation = page.getByRole('navigation', { name: '主导航' });
  for (const section of ['home', 'about']) {
    if (section === 'about') {
      await navigation.getByRole('link', { name: '加入共创', exact: true }).click();
      await expect(page).toHaveURL(/#about$/);
    }
    await expectRefraction(
      navigation.locator('.dock-shell'),
      navigation.locator('filter[id$="-shell"]'),
    );
    await expectRefraction(
      navigation.locator('.dock-lens'),
      navigation.locator('filter[id$="-tab"]'),
    );
  }
});

test('game panels and modal buttons refract their backdrop beyond a blur', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/games/sokoban');
  await expect(page.locator('.sokoban')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  await expectRefraction(page.locator('.game-stage > .liquid-surface'));
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expectRefraction(page.locator('.stage-overlay > .liquid-surface'));
  await expectRefraction(page.locator('.stage-overlay .primary-button > .liquid-surface'));
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect(page.getByRole('region', { name: '暂停菜单' })).toHaveCount(0);
  await page.getByRole('button', { name: '返回游戏列表', exact: true }).click();
  await expectRefraction(page.locator('.confirm-dialog > .liquid-surface'));
  await expectRefraction(page.locator('.confirm-dialog .primary-button > .liquid-surface'));
  await page.getByRole('button', { name: '继续本局', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('pausing keeps the game aligned through the flat center of the glass', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/games/sokoban');
  const game = page.locator('.sokoban');
  await expect(game).toBeVisible();
  const before = await game.boundingBox();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  expect(await game.boundingBox()).toEqual(before);

  const lens = page.locator('.stage-overlay > .liquid-surface');
  await expect(lens).toHaveCSS('backdrop-filter', /url\(/);
  await expect(lens.locator('feImage')).toHaveAttribute('href', /^data:image\/png/);
  // The first floor/wall intersection is inside the lens, away from its bent rim.
  const marker = page.locator('.sokoban-cell').nth(8);
  await marker.scrollIntoViewIfNeeded();
  const bounds = (await marker.boundingBox())!;
  const clip = { x: bounds.x - 24, y: bounds.y - 24, width: 48, height: 48 };
  const refracted = await page.screenshot({ clip, animations: 'disabled', scale: 'css' });
  const filter = lens.locator('feDisplacementMap');
  const scale = (await filter.getAttribute('scale'))!;
  await filter.evaluate((element) => element.setAttribute('scale', '0'));
  const unshifted = await page.screenshot({ clip, animations: 'disabled', scale: 'css' });
  expect(refracted.equals(unshifted), 'The flat lens center must not translate the game').toBe(
    true,
  );
  await filter.evaluate((element, value) => element.setAttribute('scale', value), scale);
});

test('a browser without WebGL retains a readable and functional platform', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof getContext>
    ) {
      if (String(args[0]).includes('webgl')) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.locator('canvas.liquid-glass-canvas')).toHaveAttribute(
    'data-renderer',
    'fallback',
  );
  await expect(page.locator('.game-search')).toHaveCSS('backdrop-filter', /blur\(8px\)/);
  await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeVisible();
  await expect(page.locator('.catalog-card')).toHaveCount(4);
  await page.getByRole('button', { name: '动作', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /大肥鱼跑酷/ })).toBeVisible();
});

test('search can be cleared and empty results reset both search and category', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: '搜索小游戏' });
  await search.click();
  await expect(search).toBeFocused();
  await expect(search).toHaveCSS('outline-style', 'none');
  await expect(page.locator('.game-search')).toHaveCSS('outline-style', 'none');
  await search.fill('搬家');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /大肥鱼 · 搬家日记/ })).toBeVisible();
  await page.getByRole('button', { name: '清除搜索', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.catalog-card')).toHaveCount(4);

  await page.getByRole('button', { name: '动作', exact: true }).click();
  await search.fill('搬家');
  await expect(page.getByText('还没有找到这款游戏', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看全部游戏', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('button', { name: '全部', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.catalog-card')).toHaveCount(4);
});

test('wallpaper loading failure leaves the CSS glass platform usable', async ({ page }) => {
  let failedWallpaperRequests = 0;
  await page.route(/\/bg_menu_(?:landscape|portrait)[^/]*\.png(?:\?.*)?$/, async (route) => {
    failedWallpaperRequests += 1;
    await route.abort('failed');
  });
  await page.goto('/');
  await expect.poll(() => failedWallpaperRequests).toBeGreaterThan(0);
  await expect(page.locator('canvas.liquid-glass-canvas')).toHaveAttribute(
    'data-renderer',
    'fallback',
  );
  await expect(page.locator('.game-search')).toHaveCSS('backdrop-filter', /blur\(8px\)/);
  await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeVisible();
  await expect(page.locator('.catalog-card')).toHaveCount(4);
  await page.getByRole('button', { name: '益智', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(2);
  await page.getByRole('searchbox', { name: '搜索小游戏' }).fill('搬家');
  await expect(page.getByRole('button', { name: /大肥鱼 · 搬家日记/ })).toBeVisible();
});

test('wallpaper follows the viewport across the mobile breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto('/');
  const platform = page.locator('.platform-home');
  const canvas = page.locator('canvas.liquid-glass-canvas');

  for (const { width, wallpaper } of [
    { width: 1000, wallpaper: 'bg_menu_landscape' },
    { width: 600, wallpaper: 'bg_menu_portrait' },
    { width: 1000, wallpaper: 'bg_menu_landscape' },
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        platform.evaluate((element) => getComputedStyle(element, '::before').backgroundImage),
      )
      .toContain(wallpaper);
    await platform.evaluate(async (element) => {
      const background = getComputedStyle(element, '::before').backgroundImage;
      const url = /url\(["']?([^"')]+)["']?\)/.exec(background)?.[1];
      if (!url) throw new Error('The wallpaper must have an image URL');
      const image = new Image();
      image.src = url;
      await image.decode();
    });
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
    await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeVisible();
  }
});

test('dock clicks navigate within the page and home returns to the top', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: '主导航' });
  const homeLink = navigation.getByRole('link', { name: '首页', exact: true });
  const aboutLink = navigation.getByRole('link', { name: '加入共创', exact: true });
  await expect(homeLink).toHaveAttribute('href', '#home');
  await expect(aboutLink).toHaveAttribute('href', '#about');
  await aboutLink.click();
  await expect(page).toHaveURL(/#about$/);
  await expect(aboutLink).toHaveAttribute('aria-current', 'location');
  const banner = page.getByRole('region', { name: '下一款心动，由你创造。' });
  await expect(banner).toBeInViewport();
  const contributeLink = banner.getByRole('link', { name: '加入共创', exact: true });
  await expect(contributeLink).toHaveAttribute(
    'href',
    'https://github.com/Shimmer66/moecore-arcade',
  );
  await expect(contributeLink).toHaveAttribute('target', '_blank');
  await expect(contributeLink).toBeInViewport();
  await contributeLink.click({ trial: true });

  const gamesLink = navigation.getByRole('link', { name: '小游戏', exact: true });
  await expect(gamesLink).toHaveAttribute('href', '#games');
  await gamesLink.click();
  await expect(page).toHaveURL(/#games$/);
  await expect(gamesLink).toHaveAttribute('aria-current', 'location');
  await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeInViewport();
  await homeLink.click();
  await expect(page).toHaveURL(/#home$/);
  await expect(homeLink).toHaveAttribute('aria-current', 'location');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(page.context().pages()).toHaveLength(1);
});

test('the dock shell ignores dragging while its inner tabs remain draggable', async ({ page }) => {
  await page.goto('/#home');
  const navigation = page.locator('.home-dock');
  const homeLink = navigation.getByRole('link', { name: '首页', exact: true });
  const aboutLink = navigation.getByRole('link', { name: '加入共创', exact: true });
  const shellBounds = await navigation.boundingBox();
  const tabBounds = await homeLink.boundingBox();
  if (!shellBounds || !tabBounds) throw new Error('The dock and its tabs must be visible');
  expect(tabBounds.y - shellBounds.y).toBeGreaterThan(1);
  const start = await centerOf(homeLink);
  const end = await centerOf(aboutLink);
  const shellY = (shellBounds.y + tabBounds.y) / 2;
  expect(
    await page.evaluate(
      ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.dock-tab')),
      { x: start.x, y: shellY },
    ),
  ).toBe(false);

  await page.mouse.move(start.x, shellY);
  await page.mouse.down();
  await expect(navigation).not.toHaveClass(/\bis-dragging\b/);
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await expect(navigation).not.toHaveClass(/\bis-dragging\b/);
  await page.mouse.up();
  await expect(page).toHaveURL(/#home$/);
  await expect(homeLink).toHaveAttribute('aria-current', 'location');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await expect(navigation).toHaveClass(/\bis-dragging\b/);
  await expect(page).toHaveURL(/#home$/);
  await page.mouse.up();
  await expect(page).toHaveURL(/#about$/);
  await expect(aboutLink).toHaveAttribute('aria-current', 'location');
});

test('mouse dragging previews the dock selection and only navigates on release', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Mouse drag behavior is covered on the desktop project');
  await page.goto('/#home');
  const navigation = page.locator('.home-dock');
  const indicator = navigation.locator('.dock-indicator');
  const homeLink = navigation.getByRole('link', { name: '首页', exact: true });

  for (const { name, hash } of [
    { name: '小游戏', hash: '#games' },
    { name: '加入共创', hash: '#about' },
  ]) {
    await homeLink.click();
    await expect(page).toHaveURL(/#home$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const destination = navigation.getByRole('link', { name, exact: true });
    const start = await centerOf(homeLink);
    const end = await centerOf(destination);
    await expect
      .poll(async () => Math.abs((await centerOf(indicator)).x - start.x))
      .toBeLessThan(8);
    const indicatorStart = await centerOf(indicator);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + (end.x - start.x) * 0.65, start.y, { steps: 8 });
    await expect(navigation).toHaveClass(/\bis-dragging\b/);
    await expect
      .poll(async () => (await centerOf(indicator)).x - indicatorStart.x)
      .toBeGreaterThan(20);
    await expect(page).toHaveURL(/#home$/);
    await expect(homeLink).toHaveAttribute('aria-current', 'location');
    await expect(navigation.locator('[aria-current="location"]')).toHaveCount(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.mouse.move(end.x, end.y, { steps: 5 });
    await expect(page).toHaveURL(/#home$/);
    await page.mouse.up();
    await expect(navigation).not.toHaveClass(/\bis-dragging\b/);
    await expect.poll(() => new URL(page.url()).hash).toBe(hash);
    await expect(destination).toHaveAttribute('aria-current', 'location');
  }
  expect(page.context().pages()).toHaveLength(1);
});

test('cancelling a dock pointer drag keeps the committed section', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Pointer cancellation is also covered by a real touch cancellation below');
  await page.goto('/#home');
  const navigation = page.locator('.home-dock');
  const homeLink = navigation.getByRole('link', { name: '首页', exact: true });
  const start = await centerOf(homeLink);
  const end = await centerOf(navigation.getByRole('link', { name: '加入共创', exact: true }));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await expect(navigation).toHaveClass(/\bis-dragging\b/);
  await navigation.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
  await page.mouse.up();
  await expect(navigation).not.toHaveClass(/\bis-dragging\b/);
  await expect(page).toHaveURL(/#home$/);
  await expect(homeLink).toHaveAttribute('aria-current', 'location');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect
    .poll(async () => Math.abs((await centerOf(navigation.locator('.dock-indicator'))).x - start.x))
    .toBeLessThan(8);
});

test('dock keyboard movement changes focus and Enter commits the section', async ({ page }) => {
  await page.goto('/#home');
  const navigation = page.locator('.home-dock');
  const homeLink = navigation.getByRole('link', { name: '首页', exact: true });
  const gamesLink = navigation.getByRole('link', { name: '小游戏', exact: true });
  const aboutLink = navigation.getByRole('link', { name: '加入共创', exact: true });
  await homeLink.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gamesLink).toBeFocused();
  await expect(page).toHaveURL(/#home$/);
  await expect(homeLink).toHaveAttribute('aria-current', 'location');
  await page.keyboard.press('ArrowLeft');
  await expect(homeLink).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#games$/);
  await expect(gamesLink).toHaveAttribute('aria-current', 'location');

  await page.keyboard.press('End');
  await expect(aboutLink).toBeFocused();
  await expect(page).toHaveURL(/#games$/);
  await expect(gamesLink).toHaveAttribute('aria-current', 'location');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#about$/);
  await expect(aboutLink).toHaveAttribute('aria-current', 'location');
  await page.keyboard.press('Home');
  await expect(homeLink).toBeFocused();
  await expect(page).toHaveURL(/#about$/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#home$/);
  await expect(homeLink).toHaveAttribute('aria-current', 'location');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(page.context().pages()).toHaveLength(1);
});

test('touch dragging previews without scrolling and touch cancellation does not navigate', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'This test uses the mobile project touch input');
  await page.goto('/#home');
  const navigation = page.locator('.home-dock');
  const indicator = navigation.locator('.dock-indicator');
  const homeLink = navigation.getByRole('link', { name: '首页', exact: true });
  const aboutLink = navigation.getByRole('link', { name: '加入共创', exact: true });
  const start = await centerOf(homeLink);
  const end = await centerOf(aboutLink);
  const client = await page.context().newCDPSession(page);
  const touchPoint = (x: number, y: number) => ({ x, y, id: 1, radiusX: 1, radiusY: 1 });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(start.x, start.y)],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [touchPoint((start.x + end.x) / 2, start.y - 12)],
  });
  await expect(navigation).toHaveClass(/\bis-dragging\b/);
  await expect.poll(async () => (await centerOf(indicator)).x - start.x).toBeGreaterThan(20);
  await expect(page).toHaveURL(/#home$/);
  await expect(homeLink).toHaveAttribute('aria-current', 'location');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [touchPoint(end.x, end.y)],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page).toHaveURL(/#about$/);
  await expect(aboutLink).toHaveAttribute('aria-current', 'location');
  await expect(navigation).not.toHaveClass(/\bis-dragging\b/);

  await homeLink.click();
  await expect(page).toHaveURL(/#home$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const cancelStart = await centerOf(homeLink);
  const cancelEnd = await centerOf(aboutLink);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(cancelStart.x, cancelStart.y)],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [touchPoint(cancelEnd.x, cancelEnd.y)],
  });
  await expect(navigation).toHaveClass(/\bis-dragging\b/);
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(navigation).not.toHaveClass(/\bis-dragging\b/);
  await expect(page).toHaveURL(/#home$/);
  await expect(homeLink).toHaveAttribute('aria-current', 'location');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(page.context().pages()).toHaveLength(1);
  await client.detach();
});

test('recovers from WebGL context loss and stops requesting frames when idle', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('canvas.liquid-glass-canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  const contextLoss = await canvas.evaluateHandle((element) => {
    const context = (element as HTMLCanvasElement).getContext('webgl');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('The test browser must support WEBGL_lose_context');
    extension.loseContext();
    return extension;
  });
  await expect(canvas).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.getByRole('heading', { name: '小游戏', exact: true })).toBeVisible();
  await contextLoss.evaluate((extension) => extension.restoreContext());
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');

  const frames = await page.evaluateHandle(() => {
    const counter = { count: 0 };
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      counter.count += 1;
      return requestFrame(callback);
    };
    return counter;
  });
  const surface = page.locator('.game-filters button[data-glass]').first();
  await surface.hover({ position: { x: 12, y: 12 } });
  await expect.poll(() => frames.evaluate((counter) => counter.count)).toBeGreaterThan(0);
  await page.mouse.move(0, 0);
  await expect
    .poll(() =>
      frames.evaluate(async (counter) => {
        const before = counter.count;
        await new Promise((resolve) => setTimeout(resolve, 700));
        return counter.count - before;
      }),
    )
    .toBe(0);
});
