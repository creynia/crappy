import { render } from 'preact';
import content from 'virtual:content';
import { App } from './app/App';
import { AppProviders } from './app/context';
import { Store } from './app/store';
import { applyTheme } from './app/theme';
import './app/styles/tokens.css';
import './app/styles/app.css';

// TODO(infra merge): import { registerSW } from './pwa/register'; registerSW();  (branch claude/crappy-infra)
const store = new Store();
applyTheme(store.settings);

render(
  <AppProviders content={content} store={store}>
    <App />
  </AppProviders>,
  document.getElementById('app')!,
);
