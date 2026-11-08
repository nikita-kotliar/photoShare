const STAFF_ROLES = ['ADMIN', 'MODERATOR'];

export function isStaff(user) {
  return STAFF_ROLES.includes(user?.role);
}

export function profileHref(user) {
  return user ? `/users/${user.username}` : '/auth';
}

export function navItems(user) {
  const profile = profileHref(user);
  const items = [
    {
      label: 'Світлини',
      href: '/home',
      isActive: (path) => path === '/home' || path.startsWith('/photos/'),
    },
    { label: 'Мій профіль', href: profile, isActive: (path) => Boolean(user) && path === profile },
    { label: 'Про нас', href: '/about', isActive: (path) => path === '/about' },
  ];
  if (isStaff(user)) {
    items.push({ label: 'Користувачі', href: '/admin', isActive: (path) => path === '/admin' });
  }
  return items;
}
