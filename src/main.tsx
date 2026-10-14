import { render } from 'preact';
import { registerSW } from './pwa/register';

// TODO(WP3): replace with <App /> (router, store, screens).
function Hello() {
  return (
    <main style={{ padding: '2rem 1rem', textAlign: 'center' }}>
      <h1>crappy</h1>
      <p>Learn craps. Coming soon.</p>
      <small>v{__APP_VERSION__}</small>
    </main>
  );
}

render(<Hello />, document.getElementById('app')!);

registerSW();
