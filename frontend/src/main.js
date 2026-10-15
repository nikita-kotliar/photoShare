import './styles/index.css';
import { mountSprite } from './components/icons.js';
import { createRouter } from './router/index.js';
import { routes } from './router/routes.js';
import { store } from './store/index.js';
import { authApi } from './api/auth.js';

// Каркас 
const root = document.getElementById('app');
root.innerHTML = `
  <div class="app">
    <div id="app-header"></div>
    <main id="app-main" class="app__main"></main>
    <div id="app-footer"></div>
  </div>
`;

async function bootstrap() {
  mountSprite();

  try {
    const user = await authApi.me();
    store.set({ user });
  } catch {
    store.set({ user: null });
  }
  store.set({ authReady: true });

  const router = createRouter({
    routes,
    outlet: document.getElementById('app-main'),
    store,
  });
  await router.start();
}

bootstrap();
