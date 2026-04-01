import type { ISkin, IUser } from '../src/shared/interfaces';

type View = 'market' | 'profile';
type AuthMode = 'login' | 'register';

interface AppState {
  currentUser: IUser | null;
  skins: ISkin[];
  currentView: View;
  isAuthModalOpen: boolean;
  authMode: AuthMode;
}

const state: AppState = {
  currentUser: null,
  skins: [],
  currentView: 'market',
  isAuthModalOpen: false,
  authMode: 'login',
};

const appRoot = document.getElementById('app');

if (!appRoot) {
  throw new Error('Root element #app not found');
}

/**
 * Форматирует цену в вид "$ 0.00".
 * @param {number} price
 * @returns {string}
 */
function formatPrice(price: number): string {
  return `$ ${price.toFixed(2)}`;
}

/**
 * Показывает всплывающее уведомление.
 * @param {string} message
 * @param {'success' | 'error'} [type='success']
 * @returns {void}
 */
function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  const existing = document.querySelector('.toast');
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast--hide');
    toast.remove();
  }, 2400);
}

/**
 * Универсальный fetch для API с обработкой ошибок.
 * @template TResponse
 * @param {RequestInfo} input
 * @param {RequestInit} [init]
 * @returns {Promise<TResponse>}
 */
async function apiFetch<TResponse>(input: RequestInfo, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    let message = 'Ошибка запроса';
    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) {
        message = data.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await response.json()) as TResponse;
}

/**
 * Переключает текущий раздел приложения.
 * @param {View} view
 * @returns {void}
 */
function setView(view: View): void {
  state.currentView = view;
  window.history.pushState({ view }, '', view === 'market' ? '/' : '/profile');
  render();
}

/**
 * Открывает модальное окно авторизации.
 * @param {AuthMode} mode
 * @returns {void}
 */
function openAuthModal(mode: AuthMode): void {
  state.authMode = mode;
  state.isAuthModalOpen = true;
  render();
}

/**
 * Закрывает модальное окно авторизации.
 * @returns {void}
 */
function closeAuthModal(): void {
  state.isAuthModalOpen = false;
  render();
}

/**
 * Выход пользователя из аккаунта.
 * @returns {void}
 */
function handleLogout(): void {
  state.currentUser = null;
  document.cookie = 'ww_session=; Max-Age=0; path=/';
  showToast('Вы вышли из аккаунта', 'success');
  render();
}

/**
 * Создает верхнюю панель навигации.
 * @returns {HTMLElement}
 */
function createNavbar(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'navbar';

  const logo = document.createElement('div');
  logo.className = 'navbar__logo';
  logo.innerHTML = '<span>WW</span> Skin Market';
  logo.addEventListener('click', () => setView('market'));

  const links = document.createElement('div');
  links.className = 'navbar__links';

  const marketLink = document.createElement('div');
  marketLink.className =
    'navbar__link' + (state.currentView === 'market' ? ' navbar__link--active' : '');
  marketLink.textContent = 'Маркет';
  marketLink.addEventListener('click', () => setView('market'));

  const profileLink = document.createElement('div');
  profileLink.className =
    'navbar__link' + (state.currentView === 'profile' ? ' navbar__link--active' : '');
  profileLink.textContent = 'Мой профиль';
  profileLink.addEventListener('click', () => setView('profile'));

  links.appendChild(marketLink);
  links.appendChild(profileLink);

  const right = document.createElement('div');
  right.className = 'navbar__right';

  const balanceBlock = document.createElement('div');
  balanceBlock.className = 'navbar__balance';

  const balanceLabel = document.createElement('div');
  balanceLabel.className = 'navbar__balance-label';
  balanceLabel.textContent = 'Баланс';

  const balanceValue = document.createElement('div');
  balanceValue.className = 'navbar__balance-value';
  balanceValue.textContent = state.currentUser ? formatPrice(state.currentUser.balance) : '$ 0.00';

  balanceBlock.appendChild(balanceLabel);
  balanceBlock.appendChild(balanceValue);

  const authBlock = document.createElement('div');
  authBlock.className = 'navbar__auth';

  if (state.currentUser) {
    const userLabel = document.createElement('span');
    userLabel.textContent = state.currentUser.login;

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'navbar__button';
    logoutBtn.textContent = 'Выйти';
    logoutBtn.addEventListener('click', handleLogout);

    authBlock.appendChild(userLabel);
    authBlock.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement('button');
    loginBtn.className = 'navbar__button navbar__button--primary';
    loginBtn.textContent = 'Войти';
    loginBtn.addEventListener('click', () => openAuthModal('login'));

    const registerBtn = document.createElement('button');
    registerBtn.className = 'navbar__button';
    registerBtn.textContent = 'Регистрация';
    registerBtn.addEventListener('click', () => openAuthModal('register'));

    authBlock.appendChild(loginBtn);
    authBlock.appendChild(registerBtn);
  }

  right.appendChild(balanceBlock);
  right.appendChild(authBlock);

  nav.appendChild(logo);
  nav.appendChild(links);
  nav.appendChild(right);

  return nav;
}

/**
 * Создает карточку скина для маркета или профиля.
 * @param {ISkin} skin
 * @param {boolean} isInProfile
 * @param {number} [indexInInventory]
 * @returns {HTMLElement}
 */
function createSkinCard(skin: ISkin, isInProfile: boolean, indexInInventory?: number): HTMLElement {
  const card = document.createElement('article');
  card.className = 'skin-card';

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'skin-card__image-wrapper';

  const img = document.createElement('img');
  img.className = 'skin-card__image';
  img.src = skin.image;
  img.alt = skin.name;

  const rarity = document.createElement('div');
  rarity.className = `skin-card__rarity-badge skin-card__rarity-badge--${skin.rarity}`;
  rarity.textContent = skin.rarity;

  const category = document.createElement('div');
  category.className = 'skin-card__category-tag';
  category.textContent = skin.category;

  imageWrapper.appendChild(img);
  imageWrapper.appendChild(rarity);
  imageWrapper.appendChild(category);

  const body = document.createElement('div');
  body.className = 'skin-card__body';

  const name = document.createElement('div');
  name.className = 'skin-card__name';
  name.textContent = skin.name;

  const wear = document.createElement('div');
  wear.className = 'skin-card__wear';
  wear.textContent = skin.wear;

  body.appendChild(name);
  body.appendChild(wear);

  const footer = document.createElement('div');
  footer.className = 'skin-card__footer';

  const price = document.createElement('div');
  price.className = 'skin-card__price';

  const priceMain = document.createElement('div');
  priceMain.className = 'skin-card__price-main';
  priceMain.textContent = formatPrice(skin.price);

  const priceLabel = document.createElement('div');
  priceLabel.className = 'skin-card__price-label';
  priceLabel.textContent = isInProfile ? 'Цена продажи' : 'Цена покупки';

  price.appendChild(priceMain);
  price.appendChild(priceLabel);

  const button = document.createElement('button');
  button.className = 'skin-card__button' + (isInProfile ? ' skin-card__button--sell' : '');
  button.textContent = isInProfile ? 'Продать' : 'Купить';

  if (isInProfile && typeof indexInInventory === 'number') {
    button.addEventListener('click', async () => {
      try {
        await apiFetch<IUser>('/api/sell', {
          method: 'POST',
          body: JSON.stringify({ instanceId: indexInInventory }),
        });
        await refreshCurrentUser();
        showToast('Предмет продан, баланс пополнен', 'success');
      } catch (error) {
        const err = error as Error;
        showToast(err.message, 'error');
      }
    });
  } else {
    button.addEventListener('click', async () => {
      if (!state.currentUser) {
        openAuthModal('login');
        return;
      }
      try {
        await apiFetch<IUser>('/api/buy', {
          method: 'POST',
          body: JSON.stringify({ skinId: skin.id }),
        });
        card.classList.add('skin-card--purchased');
        setTimeout(() => {
          card.classList.remove('skin-card--purchased');
        }, 800);
        await refreshCurrentUser();
        showToast('Предмет куплен', 'success');
      } catch (error) {
        const err = error as Error;
        showToast(err.message, 'error');
      }
    });
  }

  footer.appendChild(price);
  footer.appendChild(button);

  card.appendChild(imageWrapper);
  card.appendChild(body);
  card.appendChild(footer);

  return card;
}

/**
 * Отрисовывает главную страницу маркета.
 * @param {HTMLElement} container
 * @returns {void}
 */
function renderHome(container: HTMLElement): void {
  const header = document.createElement('div');
  header.className = 'page__header';

  const left = document.createElement('div');

  const title = document.createElement('h1');
  title.className = 'page__title';
  title.textContent = 'Маркет скинов';

  const subtitle = document.createElement('div');
  subtitle.className = 'page__subtitle';
  subtitle.textContent = 'Выберите предмет и нажмите «Купить», чтобы добавить его в свой инвентарь.';

  left.appendChild(title);
  left.appendChild(subtitle);

  header.appendChild(left);

  const grid = document.createElement('div');
  grid.className = 'skins-grid';

  state.skins.forEach((skin) => {
    const card = createSkinCard(skin, false);
    grid.appendChild(card);
  });

  container.appendChild(header);
  container.appendChild(grid);
}

/**
 * Отрисовывает страницу профиля пользователя.
 * @param {HTMLElement} container
 * @returns {void}
 */
function renderProfile(container: HTMLElement): void {
  const header = document.createElement('div');
  header.className = 'page__header';

  const left = document.createElement('div');

  const title = document.createElement('h1');
  title.className = 'page__title';
  const login = state.currentUser?.login ?? '';
  title.textContent = `Инвентарь пользователя ${login}`;

  const subtitle = document.createElement('div');
  subtitle.className = 'page__subtitle';
  subtitle.textContent =
    'Здесь отображаются только купленные вами предметы. Нажмите «Продать», чтобы вернуть деньги на баланс.';

  left.appendChild(title);
  left.appendChild(subtitle);

  header.appendChild(left);

  container.appendChild(header);

  if (!state.currentUser || state.currentUser.inventory.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';

    const emptyTitle = document.createElement('div');
    emptyTitle.className = 'empty-state__title';
    emptyTitle.textContent = 'Инвентарь пуст';

    const hint = document.createElement('div');
    hint.className = 'empty-state__hint';
    hint.textContent = 'Купите несколько скинов на вкладке «Маркет», чтобы они появились здесь.';

    empty.appendChild(emptyTitle);
    empty.appendChild(hint);
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'skins-grid';

  state.currentUser.inventory.forEach((skin, index) => {
    const card = createSkinCard(skin, true, index);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

/**
 * Создает модальное окно входа/регистрации.
 * @returns {HTMLElement | null}
 */
function renderAuthModal(): HTMLElement | null {
  if (!state.isAuthModalOpen) {
    return null;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'auth-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'auth-modal';

  const title = document.createElement('div');
  title.className = 'auth-modal__title';
  title.textContent = state.authMode === 'login' ? 'Вход в аккаунт' : 'Регистрация';

  const subtitle = document.createElement('div');
  subtitle.className = 'auth-modal__subtitle';
  subtitle.textContent =
    state.authMode === 'login'
      ? 'Введите логин и пароль, чтобы получить доступ к покупкам.'
      : 'Создайте новый аккаунт и получите стартовый баланс 1000.00.';

  const tabs = document.createElement('div');
  tabs.className = 'auth-modal__tabs';

  const loginTab = document.createElement('button');
  loginTab.className =
    'auth-modal__tab' + (state.authMode === 'login' ? ' auth-modal__tab--active' : '');
  loginTab.textContent = 'Вход';
  loginTab.addEventListener('click', () => {
    state.authMode = 'login';
    render();
  });

  const registerTab = document.createElement('button');
  registerTab.className =
    'auth-modal__tab' + (state.authMode === 'register' ? ' auth-modal__tab--active' : '');
  registerTab.textContent = 'Регистрация';
  registerTab.addEventListener('click', () => {
    state.authMode = 'register';
    render();
  });

  tabs.appendChild(loginTab);
  tabs.appendChild(registerTab);

  const form = document.createElement('form');
  form.className = 'auth-modal__form';

  const loginField = document.createElement('div');
  loginField.className = 'auth-modal__field';

  const loginLabel = document.createElement('label');
  loginLabel.className = 'auth-modal__label';
  loginLabel.textContent = 'Логин';

  const loginInput = document.createElement('input');
  loginInput.className = 'auth-modal__input';
  loginInput.type = 'text';
  loginInput.required = true;

  loginField.appendChild(loginLabel);
  loginField.appendChild(loginInput);

  const passwordField = document.createElement('div');
  passwordField.className = 'auth-modal__field';

  const passwordLabel = document.createElement('label');
  passwordLabel.className = 'auth-modal__label';
  passwordLabel.textContent = 'Пароль';

  const passwordInput = document.createElement('input');
  passwordInput.className = 'auth-modal__input';
  passwordInput.type = 'password';
  passwordInput.required = true;

  passwordField.appendChild(passwordLabel);
  passwordField.appendChild(passwordInput);

  let repeatPasswordInput: HTMLInputElement | null = null;

  if (state.authMode === 'register') {
    const repeatField = document.createElement('div');
    repeatField.className = 'auth-modal__field';

    const repeatLabel = document.createElement('label');
    repeatLabel.className = 'auth-modal__label';
    repeatLabel.textContent = 'Повтор пароля';

    repeatPasswordInput = document.createElement('input');
    repeatPasswordInput.className = 'auth-modal__input';
    repeatPasswordInput.type = 'password';
    repeatPasswordInput.required = true;

    repeatField.appendChild(repeatLabel);
    repeatField.appendChild(repeatPasswordInput);
    form.appendChild(repeatField);
  }

  const errorEl = document.createElement('div');
  errorEl.className = 'auth-modal__error';

  const actions = document.createElement('div');
  actions.className = 'auth-modal__actions';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'navbar__button navbar__button--primary auth-modal__submit';
  submitBtn.type = 'submit';
  submitBtn.textContent = state.authMode === 'login' ? 'Войти' : 'Создать аккаунт';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'auth-modal__close';
  closeBtn.type = 'button';
  closeBtn.textContent = 'Отмена';
  closeBtn.addEventListener('click', closeAuthModal);

  actions.appendChild(submitBtn);
  actions.appendChild(closeBtn);

  form.appendChild(loginField);
  form.appendChild(passwordField);
  form.appendChild(errorEl);
  form.appendChild(actions);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';

    const loginValue = loginInput.value.trim();
    const passwordValue = passwordInput.value.trim();

    if (!loginValue || !passwordValue) {
      errorEl.textContent = 'Заполните логин и пароль';
      return;
    }

    if (state.authMode === 'register' && repeatPasswordInput) {
      const repeatValue = repeatPasswordInput.value.trim();
      if (!repeatValue) {
        errorEl.textContent = 'Повторите пароль';
        return;
      }
      if (repeatValue !== passwordValue) {
        errorEl.textContent = 'Пароли не совпадают';
        return;
      }
    }

    try {
      const url = state.authMode === 'login' ? '/api/login' : '/api/register';
      const user = await apiFetch<IUser>(url, {
        method: 'POST',
        body: JSON.stringify({ login: loginValue, password: passwordValue }),
      });
      state.currentUser = user;
      state.isAuthModalOpen = false;
      render();
      showToast(
        state.authMode === 'login' ? 'Вы успешно вошли' : 'Аккаунт создан, добро пожаловать',
        'success'
      );
    } catch (error) {
      const err = error as Error;
      errorEl.textContent = err.message;
    }
  });

  modal.appendChild(title);
  modal.appendChild(subtitle);
  modal.appendChild(tabs);
  modal.appendChild(form);

  backdrop.appendChild(modal);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeAuthModal();
    }
  });

  return backdrop;
}

/**
 * Обновляет текущего пользователя с сервера.
 * @returns {Promise<void>}
 */
async function refreshCurrentUser(): Promise<void> {
  try {
    const user = await apiFetch<IUser>('/api/me');
    state.currentUser = user;
  } catch {
    state.currentUser = null;
  } finally {
    render();
  }
}

/**
 * Полностью перерисовывает приложение.
 * @returns {void}
 */
function render(): void {
  appRoot.innerHTML = '';

  const navbar = createNavbar();
  appRoot.appendChild(navbar);

  const page = document.createElement('main');
  page.className = 'page';

  if (state.currentView === 'market') {
    renderHome(page);
  } else {
    renderProfile(page);
  }

  appRoot.appendChild(page);

  const modal = renderAuthModal();
  if (modal) {
    document.body.appendChild(modal);
  }
}

/**
 * Инициализирует приложение и первичную загрузку данных.
 * @returns {Promise<void>}
 */
async function bootstrap(): Promise<void> {
  window.addEventListener('popstate', (event) => {
    const nextView = (event.state as { view?: View } | null)?.view ?? 'market';
    state.currentView = nextView;
    render();
  });

  render();

  try {
    const skins = await apiFetch<ISkin[]>('/api/skins');
    state.skins = skins;
  } catch {
    state.skins = [];
  } finally {
    render();
  }

  await refreshCurrentUser();
}

void bootstrap();

