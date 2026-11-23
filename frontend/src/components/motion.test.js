import { describe, expect, it, vi } from 'vitest';
import {
  HERO_NAME,
  REVEAL_MAX_STEPS,
  REVEAL_STEP,
  countUp,
  drift,
  isHero,
  markHero,
  withTimeout,
  reducedMotion,
  reveal,
  revealDelay,
} from './motion.js';
import { formatAverage } from './Rating.js';

function fakeWin({ reduce = false, io = true } = {}) {
  const win = { matchMedia: () => ({ matches: reduce }) };
  if (io) {
    win.IntersectionObserver = class {
      constructor(callback) {
        this.callback = callback;
        this.observed = [];
        win.observer = this;
      }
      observe(node) {
        this.observed.push(node);
      }
      unobserve(node) {
        this.observed = this.observed.filter((n) => n !== node);
      }
      disconnect() {
        this.observed = [];
      }
    };
  }
  return win;
}

function fakeNode() {
  const classes = new Set();
  const style = {};
  return {
    classes,
    style: { setProperty: (key, value) => (style[key] = value), values: style },
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
  };
}

describe('reducedMotion', () => {
  it('враховує налаштування «зменшити рух»', () => {
    expect(reducedMotion(fakeWin({ reduce: true }))).toBe(true);
    expect(reducedMotion(fakeWin())).toBe(false);
    expect(reducedMotion(undefined)).toBe(false);
  });
});

describe('reveal', () => {
  it('затримка росте по черзі і має межу', () => {
    expect(revealDelay(0)).toBe(0);
    expect(revealDelay(2)).toBe(2 * REVEAL_STEP);
    expect(revealDelay(50)).toBe((REVEAL_MAX_STEPS - 1) * REVEAL_STEP);
  });

  it('показує картки, що з’явилися на екрані, по черзі', () => {
    const win = fakeWin();
    const nodes = [fakeNode(), fakeNode(), fakeNode()];
    reveal(nodes, { win });
    expect(nodes.every((n) => n.classes.has('reveal'))).toBe(true);
    win.observer.callback([
      { target: nodes[0], isIntersecting: true, intersectionRatio: 0.5 },
      { target: nodes[1], isIntersecting: false, intersectionRatio: 0 },
      { target: nodes[2], isIntersecting: true, intersectionRatio: 1 },
    ]);
    expect(nodes[0].classes.has('reveal--in')).toBe(true);
    expect(nodes[1].classes.has('reveal--in')).toBe(false);
    expect(nodes[2].style.values['--reveal-delay']).toBe(`${REVEAL_STEP}ms`);
  });

  it('картка, що пішла з екрана, з’являється знову при поверненні', () => {
    const win = fakeWin();
    const node = fakeNode();
    reveal([node], { win });
    win.observer.callback([{ target: node, isIntersecting: true, intersectionRatio: 1 }]);
    win.observer.callback([{ target: node, isIntersecting: false, intersectionRatio: 0 }]);
    expect(node.classes.has('reveal--in')).toBe(false);
    win.observer.callback([{ target: node, isIntersecting: true, intersectionRatio: 0.05 }]);
    expect(node.classes.has('reveal--in')).toBe(false);
    win.observer.callback([{ target: node, isIntersecting: true, intersectionRatio: 0.3 }]);
    expect(node.classes.has('reveal--in')).toBe(true);
  });

  it('без анімацій картки не ховаються', () => {
    for (const win of [fakeWin({ reduce: true }), fakeWin({ io: false })]) {
      const node = fakeNode();
      reveal([node], { win });
      expect(node.classes.size).toBe(0);
    }
  });
});

describe('countUp', () => {
  it('при «зменшити рух» одразу ставить кінцеве значення', () => {
    const onUpdate = vi.fn();
    countUp(3, 4.5, { onUpdate, win: fakeWin({ reduce: true }) });
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith(4.5);
  });

  it('плавно доходить до кінцевого значення', () => {
    const frames = [];
    const win = {
      ...fakeWin(),
      performance: { now: () => 0 },
      requestAnimationFrame: (fn) => frames.push(fn),
    };
    const values = [];
    countUp(2, 4, { duration: 100, onUpdate: (v) => values.push(v), win });
    frames.shift()(50);
    frames.shift()(100);
    expect(values[0]).toBeGreaterThan(2);
    expect(values[0]).toBeLessThan(4);
    expect(values.at(-1)).toBe(4);
    expect(frames).toHaveLength(0);
  });

  it('без попереднього значення не анімує', () => {
    const onUpdate = vi.fn();
    countUp(null, 5, { onUpdate, win: fakeWin() });
    expect(onUpdate).toHaveBeenCalledWith(5);
  });
});

describe('formatAverage', () => {
  it('проміжні значення мають хоча б один знак після коми', () => {
    expect(formatAverage(4.2678, 4.35)).toBe(4.27);
    expect(formatAverage(3.64, 4)).toBe(3.6);
    expect(formatAverage(4, 4)).toBe(4);
    expect(formatAverage(null, 4)).toBe(null);
  });
});

describe('перехід картка - сторінка світлини', () => {
  it('ім’я переходу є лише в останньої вибраної світлини', () => {
    const first = { style: {} };
    const second = { style: {} };
    markHero(first, 1);
    expect(first.style.viewTransitionName).toBe(HERO_NAME);
    markHero(second, 2);
    expect(first.style.viewTransitionName).toBe('');
    expect(second.style.viewTransitionName).toBe(HERO_NAME);
    expect(isHero(2)).toBe(true);
    expect(isHero(1)).toBe(false);
    expect(isHero(undefined)).toBe(false);
  });

  it('не чекає сторінку довше за ліміт і не падає на помилці', async () => {
    vi.useFakeTimers();
    const slow = withTimeout(new Promise(() => {}), 100);
    vi.advanceTimersByTime(100);
    await expect(slow).resolves.toBeUndefined();
    vi.useRealTimers();
    await expect(withTimeout(Promise.reject(new Error('x')))).resolves.toBeUndefined();
  });
});

describe('drift', () => {
  function scrollWin({ reduce = false } = {}) {
    const handlers = {};
    return {
      ...fakeWin({ reduce }),
      innerHeight: 800,
      handlers,
      addEventListener: (type, fn) => (handlers[type] = fn),
      removeEventListener: (type) => delete handlers[type],
      requestAnimationFrame: (fn) => (fn(), 1),
    };
  }

  function driftNode(top) {
    const node = fakeNode();
    node.getBoundingClientRect = () => ({ top, height: 400 });
    return node;
  }

  it('зсув залежить від положення колажу на екрані', () => {
    const win = scrollWin();
    const below = driftNode(800);
    drift(below, { win });
    expect(below.style.values['--drift']).toBe('-4.00%');
    const middle = driftNode(200);
    const stop = drift(middle, { win });
    expect(middle.style.values['--drift']).toBe('0.00%');
    expect(win.handlers.scroll).toBeTypeOf('function');
    stop();
    expect(win.handlers.scroll).toBeUndefined();
  });

  it('при «зменшити рух» колаж стоїть', () => {
    const node = driftNode(0);
    drift(node, { win: scrollWin({ reduce: true }) });
    expect(node.classes.size).toBe(0);
  });
});
