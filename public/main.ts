type View = 'market' | 'profile' | 'admin';
type AuthMode = 'login' | 'register';
type Locale = 'ru' | 'en';

interface IReview {
  userLogin: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ISkin {
  id: string;
  name: string;
  price: number;
  rarity: string;
  wear: string;
  image: string;
  category: string;
  tags: string[];
  reviews: IReview[];
}

interface IUser {
  id: string;
  login: string;
  balance: number;
  inventory: ISkin[];
  role: 'user' | 'admin';
}

type TDict = Record<string, string>;
const dict: Record<Locale, TDict> = {
  ru: {
    market: 'Маркет',
    profile: 'Профиль',
    admin: 'Админ',
    login: 'Войти',
    register: 'Регистрация',
    logout: 'Выйти',
    buy: 'Купить',
    sell: 'Продать',
    like: 'Лайк',
    comment: 'Комментарий',
    send: 'Отправить',
    title: 'Маркет скинов',
    subtitle: 'Лента включает рекомендации по лайкам.',
    inventoryEmpty: 'Инвентарь пуст',
    localeAsk: 'Вы из Беларуси?',
    yes: 'Да',
    no: 'Нет, переключить на English',
  },
  en: {
    market: 'Market',
    profile: 'Profile',
    admin: 'Admin',
    login: 'Sign in',
    register: 'Register',
    logout: 'Logout',
    buy: 'Buy',
    sell: 'Sell',
    like: 'Like',
    comment: 'Comment',
    send: 'Send',
    title: 'Skin market',
    subtitle: 'Feed includes recommendations from likes.',
    inventoryEmpty: 'Inventory is empty',
    localeAsk: 'Are you from Belarus?',
    yes: 'Yes',
    no: 'No, switch to Russian',
  },
};

interface State {
  currentUser: IUser | null;
  skins: ISkin[];
  currentView: View;
  locale: Locale;
  localeBanner: boolean;
  authMode: AuthMode;
  authOpen: boolean;
}

const state: State = {
  currentUser: null,
  skins: [],
  currentView: 'market',
  locale: 'ru',
  localeBanner: false,
  authMode: 'login',
  authOpen: false,
};

const appRoot = document.getElementById('app') as HTMLElement | null;
if (!appRoot) throw new Error('Root element #app not found');
const app = appRoot;

function t(key: string): string {
  return dict[state.locale][key] ?? key;
}

function formatPrice(price: number): string {
  return `$ ${price.toFixed(2)}`;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message ?? 'Request error');
  }
  return (await response.json()) as T;
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1700);
}

function openAuth(mode: AuthMode): void {
  state.authMode = mode;
  state.authOpen = true;
  render();
}

async function handleLogout(): Promise<void> {
  await apiFetch('/api/logout', { method: 'POST' });
  state.currentUser = null;
  showToast('ok');
  render();
}

function createNav(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'navbar';
  const links = document.createElement('div');
  links.className = 'navbar__links';
  ['market', 'profile'].forEach((view) => {
    const link = document.createElement('div');
    link.className = `navbar__link${state.currentView === view ? ' navbar__link--active' : ''}`;
    link.textContent = t(view);
    link.onclick = () => {
      state.currentView = view as View;
      render();
    };
    links.appendChild(link);
  });
  if (state.currentUser?.role === 'admin') {
    const admin = document.createElement('div');
    admin.className = `navbar__link${state.currentView === 'admin' ? ' navbar__link--active' : ''}`;
    admin.textContent = t('admin');
    admin.onclick = () => {
      state.currentView = 'admin';
      render();
    };
    links.appendChild(admin);
  }
  const right = document.createElement('div');
  right.className = 'navbar__right';
  right.innerHTML = `<div class="navbar__balance-value">${formatPrice(state.currentUser?.balance ?? 0)}</div>`;
  if (state.currentUser) {
    const btn = document.createElement('button');
    btn.className = 'navbar__button';
    btn.textContent = t('logout');
    btn.onclick = () => void handleLogout();
    right.appendChild(btn);
  } else {
    const inBtn = document.createElement('button');
    inBtn.className = 'navbar__button navbar__button--primary';
    inBtn.textContent = t('login');
    inBtn.onclick = () => openAuth('login');
    const upBtn = document.createElement('button');
    upBtn.className = 'navbar__button';
    upBtn.textContent = t('register');
    upBtn.onclick = () => openAuth('register');
    right.appendChild(inBtn);
    right.appendChild(upBtn);
  }
  nav.append(links, right);
  return nav;
}

function createReviewBlock(skin: ISkin): HTMLElement {
  const wrap = document.createElement('div');
  const avg =
    skin.reviews.length === 0
      ? '—'
      : (skin.reviews.reduce((acc, item) => acc + item.rating, 0) / skin.reviews.length).toFixed(1);
  wrap.innerHTML = `<div class="skin-card__wear">Rating: ${avg}</div>`;
  skin.reviews.slice(-2).forEach((review) => {
    const item = document.createElement('div');
    item.className = 'skin-card__wear';
    item.textContent = `${review.userLogin}: ${review.comment} (${new Date(review.createdAt).toLocaleDateString()})`;
    wrap.appendChild(item);
  });
  if (!state.currentUser) return wrap;

  const rating = document.createElement('input');
  rating.type = 'number';
  rating.min = '1';
  rating.max = '5';
  rating.value = '5';
  rating.className = 'auth-modal__input';
  const comment = document.createElement('input');
  comment.className = 'auth-modal__input';
  comment.placeholder = t('comment');
  const send = document.createElement('button');
  send.className = 'navbar__button';
  send.textContent = t('send');
  send.onclick = async () => {
    await apiFetch(`/api/skins/${skin.id}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating: Number(rating.value), comment: comment.value }),
    });
    await loadSkins();
  };
  wrap.append(rating, comment, send);
  return wrap;
}

function cardForSkin(skin: ISkin, profileIndex?: number): HTMLElement {
  const card = document.createElement('article');
  card.className = 'skin-card';
  card.innerHTML = `<div class="skin-card__name">${skin.name}</div><div class="skin-card__wear">${skin.wear}</div><div>${formatPrice(skin.price)}</div>`;
  const buySell = document.createElement('button');
  buySell.className = `skin-card__button${typeof profileIndex === 'number' ? ' skin-card__button--sell' : ''}`;
  buySell.textContent = typeof profileIndex === 'number' ? t('sell') : t('buy');
  buySell.onclick = async () => {
    if (!state.currentUser) return openAuth('login');
    if (typeof profileIndex === 'number') {
      await apiFetch('/api/sell', { method: 'POST', body: JSON.stringify({ instanceId: profileIndex }) });
    } else {
      await apiFetch('/api/buy', { method: 'POST', body: JSON.stringify({ skinId: skin.id }) });
    }
    await refreshMe();
    await loadSkins();
  };
  const like = document.createElement('button');
  like.className = 'navbar__button';
  like.textContent = t('like');
  like.onclick = async () => {
    await apiFetch(`/api/skins/${skin.id}/like`, { method: 'POST' });
    await loadSkins();
  };
  card.append(buySell, like, createReviewBlock(skin));
  return card;
}

function renderMarket(page: HTMLElement): void {
  const title = document.createElement('h1');
  title.className = 'page__title';
  title.textContent = t('title');
  page.appendChild(title);
  const subtitle = document.createElement('div');
  subtitle.className = 'page__subtitle';
  subtitle.textContent = t('subtitle');
  page.appendChild(subtitle);
  const grid = document.createElement('div');
  grid.className = 'skins-grid';
  state.skins.forEach((skin) => grid.appendChild(cardForSkin(skin)));
  page.appendChild(grid);
}

function renderProfile(page: HTMLElement): void {
  if (!state.currentUser || state.currentUser.inventory.length === 0) {
    page.innerHTML = `<div class="empty-state">${t('inventoryEmpty')}</div>`;
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'skins-grid';
  state.currentUser.inventory.forEach((skin, index) => grid.appendChild(cardForSkin(skin, index)));
  page.appendChild(grid);
}

function renderAdmin(page: HTMLElement): void {
  if (state.currentUser?.role !== 'admin') return;
  const form = document.createElement('form');
  form.className = 'auth-modal__form';
  const name = document.createElement('input');
  name.className = 'auth-modal__input';
  name.placeholder = 'Name';
  const price = document.createElement('input');
  price.className = 'auth-modal__input';
  price.type = 'number';
  price.placeholder = 'Price';
  const tags = document.createElement('input');
  tags.className = 'auth-modal__input';
  tags.placeholder = 'tag1,tag2';
  const submit = document.createElement('button');
  submit.className = 'navbar__button navbar__button--primary';
  submit.textContent = 'Create';
  form.append(name, price, tags, submit);
  form.onsubmit = async (e) => {
    e.preventDefault();
    await apiFetch('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({
        name: name.value,
        price: Number(price.value),
        rarity: 'Rare',
        wear: 'Factory New',
        category: 'Custom',
        tags: tags.value.split(',').map((item) => item.trim()).filter(Boolean),
      }),
    });
    await loadSkins();
    showToast('created');
  };
  page.appendChild(form);
}

function renderAuth(): HTMLElement | null {
  if (!state.authOpen) return null;
  const b = document.createElement('div');
  b.className = 'auth-modal-backdrop';
  const m = document.createElement('div');
  m.className = 'auth-modal';
  const login = document.createElement('input');
  login.className = 'auth-modal__input';
  login.placeholder = 'login';
  const password = document.createElement('input');
  password.className = 'auth-modal__input';
  password.type = 'password';
  password.placeholder = 'password';
  const btn = document.createElement('button');
  btn.className = 'navbar__button navbar__button--primary';
  btn.textContent = state.authMode === 'login' ? t('login') : t('register');
  btn.onclick = async () => {
    const url = state.authMode === 'login' ? '/api/login' : '/api/register';
    await apiFetch(url, { method: 'POST', body: JSON.stringify({ login: login.value, password: password.value }) });
    state.authOpen = false;
    await refreshMe();
    await loadSkins();
  };
  m.append(login, password, btn);
  b.onclick = (e) => {
    if (e.target === b) {
      state.authOpen = false;
      render();
    }
  };
  b.appendChild(m);
  return b;
}

function renderLocaleBanner(): HTMLElement | null {
  if (!state.localeBanner) return null;
  const wrap = document.createElement('div');
  wrap.className = 'toast';
  const yes = document.createElement('button');
  yes.className = 'navbar__button';
  yes.textContent = t('yes');
  yes.onclick = async () => {
    await apiFetch('/api/session-locale', { method: 'POST', body: JSON.stringify({ locale: 'ru' }) });
    state.locale = 'ru';
    state.localeBanner = false;
    render();
  };
  const no = document.createElement('button');
  no.className = 'navbar__button';
  no.textContent = t('no');
  no.onclick = async () => {
    const next = state.locale === 'ru' ? 'en' : 'ru';
    await apiFetch('/api/session-locale', { method: 'POST', body: JSON.stringify({ locale: next }) });
    state.locale = next;
    state.localeBanner = false;
    render();
  };
  wrap.textContent = `${t('localeAsk')} `;
  wrap.append(yes, no);
  return wrap;
}

async function refreshMe(): Promise<void> {
  try {
    state.currentUser = await apiFetch<IUser>('/api/me');
  } catch {
    state.currentUser = null;
  }
}

async function loadSkins(): Promise<void> {
  state.skins = await apiFetch<ISkin[]>('/api/feed');
  render();
}

function render(): void {
  app.innerHTML = '';
  app.appendChild(createNav());
  const page = document.createElement('main');
  page.className = 'page';
  if (state.currentView === 'market') renderMarket(page);
  if (state.currentView === 'profile') renderProfile(page);
  if (state.currentView === 'admin') renderAdmin(page);
  app.appendChild(page);
  const modal = renderAuth();
  if (modal) document.body.appendChild(modal);
  const locale = renderLocaleBanner();
  if (locale) document.body.appendChild(locale);
}

async function bootstrap(): Promise<void> {
  render();
  const localeData = await apiFetch<{ locale: Locale; hasSessionChoice: boolean }>('/api/session-locale');
  state.locale = localeData.locale;
  state.localeBanner = !localeData.hasSessionChoice;
  await refreshMe();
  await loadSkins();
}

void bootstrap();

