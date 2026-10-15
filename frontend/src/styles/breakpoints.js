export const breakpoints = {
  mobile: 375,
  tablet: 768,
  desktop: 1440,
};

export function currentBreakpoint(width = window.innerWidth) {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  if (width >= breakpoints.mobile) return 'mobile';
  return 'fluid';
}
