import { render } from 'preact';
import content from 'virtual:content';
import { App } from './app/App';
import { AppProviders } from './app/context';
import { Store } from './app/store';
import { applyTheme } from './app/theme';
import { onUpdateAvailable, registerSW } from './pwa/register';
import './app/styles/tokens.css';
import './app/styles/app.css';

const store = new Store();
applyTheme(store.settings);

render(
  <AppProviders content={content} store={store}>
    <App onUpdateAvailable={onUpdateAvailable} />
  </AppProviders>,
  document.getElementById('app')!,
);

registerSW();
