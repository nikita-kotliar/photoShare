const STAFF = ['ADMIN', 'MODERATOR'];

export const routes = [
  {
    path: '/',
    access: 'guest',
    title: 'PhotoShare',
    load: () => import('../pages/WelcomePage.js'),
  },
  { path: '/auth', access: 'guest', title: 'Вхід', load: () => import('../pages/AuthPage.js') },
  {
    path: '/home',
    access: 'private',
    title: 'Стрічка',
    load: () => import('../pages/HomePage.js'),
  },
  {
    path: '/photos/:id',
    access: 'any',
    title: 'Світлина',
    load: () => import('../pages/PhotoPage.js'),
  },
  {
    path: '/upload',
    access: 'private',
    title: 'Додати світлину',
    load: () => import('../pages/UploadPage.js'),
  },
  {
    path: '/users/:username',
    access: 'any',
    title: 'Профіль',
    load: () => import('../pages/ProfilePage.js'),
  },
  {
    path: '/settings',
    access: 'private',
    title: 'Налаштування',
    load: () => import('../pages/SettingsPage.js'),
  },
  {
    path: '/search',
    access: 'private',
    title: 'Пошук',
    load: () => import('../pages/SearchPage.js'),
  },
  {
    path: '/admin',
    access: 'private',
    roles: STAFF,
    title: 'Керування користувачами',
    load: () => import('../pages/AdminPage.js'),
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/icons',
          access: 'any',
          title: 'Іконки',
          load: () => import('../pages/dev/IconsPage.js'),
        },
      ]
    : []),
  {
    path: '*',
    access: 'any',
    title: 'Сторінку не знайдено',
    load: () => import('../pages/NotFoundPage.js'),
  },
];
