import './styles/index.css';
import { onAchievements } from './api/client.js';
import { REFRESH_EVENT } from './components/NotificationBell.js';
import { showAchievements } from './components/AchievementToast.js';
import { mountSprite } from './components/icons.js';
import { Footer } from './components/Footer.js';
import { Header } from './components/Header.js';
import { LoadingBar, Toasts } from './components/Toast.js';
import { installAutosize, installInputMode } from './components/inputMode.js';
import { installRipple } from './components/motion.js';
import { applyTheme, readTheme, watchSystemTheme } from './components/theme.js';
import { createRouter } from './router/index.js';
import { routes } from './router/routes.js';
import { store } from './store/index.js';

const AUTH_PATHS = ['/auth', '/forgot-password', '/reset-password'];
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
  applyTheme(readTheme());
  watchSystemTheme();
  mountSprite();
  installRipple();
  installInputMode();
  installAutosize();
  // Нові досягнення з відповідей API - анімований тост (TASK-070)
  onAchievements((codes) => {
    showAchievements(codes);
    window.dispatchEvent(new Event(REFRESH_EVENT));
  });

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
    onRoute: (path) => {
      header.setPath(path);
      document.body.classList.toggle('layout-bare', AUTH_PATHS.includes(path));
    },
  });

  const header = Header({ store, navigate: router.navigate });
  document.getElementById('app-header').replaceWith(header);
  document.getElementById('app-footer').replaceWith(Footer({ store }));
  document.body.append(LoadingBar({ store }), Toasts({ store }));

  await router.start();
}

bootstrap();
