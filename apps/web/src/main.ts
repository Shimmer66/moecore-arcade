import { renderApp } from './app/bootstrap';
import './styles.css';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Application root #app was not found.');
}

renderApp(root);
