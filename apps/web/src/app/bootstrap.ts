import { ASSETS } from '@moecore/assets';
import { renderHome } from '../features/home';

export function renderApp(root: HTMLElement): void {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = ASSETS.arcadeMark.url;

  root.innerHTML = `
    <header class="site-header">
      <div class="wordmark">
        <img src="${ASSETS.arcadeMark.url}" alt="" width="40" height="40" />
        <div>
          <span class="brand-name">萌芯游乐园</span>
          <span class="brand-subtitle" lang="en">MoeCore Arcade</span>
        </div>
      </div>
      <span class="development-label">筹备中</span>
    </header>
    <main id="main-content"></main>
    <footer class="site-footer">MoeCore Arcade · 非官方同人项目</footer>
  `;

  const main = root.querySelector<HTMLElement>('main');
  if (main) renderHome(main);
}
