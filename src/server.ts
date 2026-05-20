import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import { ISkin, IUser, UserRole } from './shared/interfaces';

const app = express();
const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, '..', 'public');
const dataDir = path.join(__dirname, '..', 'data');
const skinsPath = path.join(dataDir, 'skins.json');
const usersPath = path.join(dataDir, 'users.json');
const SESSION_COOKIE_NAME = 'ww_session';
const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000;
const RECOMMENDATION_DECAY_MS = 3 * 24 * 60 * 60 * 1000;

interface IUserRecord extends IUser {
  password: string;
}

interface IDatabase {
  users: IUserRecord[];
}

interface ISession {
  userId: string;
  locale: 'ru' | 'en';
  recommendations: Record<string, { score: number; updatedAt: number }>;
  lastSeenAt: number;
}

const sessionStore: Record<string, ISession> = {};

export function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function writeJsonFile<T>(filePath: string, data: T): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function detectLocale(header: string | undefined): 'ru' | 'en' {
  if (!header) return 'ru';
  return header.toLowerCase().includes('en') ? 'en' : 'ru';
}

export function scoreSkin(tags: string[], recommendations: ISession['recommendations']): number {
  return tags.reduce((acc, tag) => acc + (recommendations[tag]?.score ?? 0), 0);
}

function ensureDataFiles(): void {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const adminUser: IUserRecord = {
    id: uuidv4(),
    login: 'owner',
    password: 'owner123',
    balance: 5000,
    inventory: [],
    role: 'admin',
  };
  if (!fs.existsSync(usersPath)) {
    writeJsonFile<IDatabase>(usersPath, { users: [adminUser] });
  } else {
    const db = readJsonFile<IDatabase>(usersPath, { users: [] });
    if (!db.users.some((item) => item.login === 'owner')) {
      db.users.push(adminUser);
      writeJsonFile(usersPath, db);
    }
  }
  if (!fs.existsSync(skinsPath) || readJsonFile<ISkin[]>(skinsPath, []).length === 0) {
    writeJsonFile<ISkin[]>(skinsPath, [
      {
        id: uuidv4(),
        name: 'AK-47 | Redline',
        price: 220,
        rarity: 'Rare',
        wear: 'Field-Tested',
        image: 'https://via.placeholder.com/300x160?text=AK-47',
        category: 'Rifles',
        tags: ['rifle', 'aggressive', 'red'],
        reviews: [],
      },
      {
        id: uuidv4(),
        name: 'AWP | Asiimov',
        price: 540,
        rarity: 'Legendary',
        wear: 'Battle-Scarred',
        image: 'https://via.placeholder.com/300x160?text=AWP',
        category: 'Snipers',
        tags: ['sniper', 'orange', 'pro'],
        reviews: [],
      },
      {
        id: uuidv4(),
        name: 'Glock-18 | Fade',
        price: 110,
        rarity: 'Common',
        wear: 'Factory New',
        image: 'https://via.placeholder.com/300x160?text=Glock',
        category: 'Pistols',
        tags: ['pistol', 'bright', 'fast'],
        reviews: [],
      },
    ]);
  }
}

function toPublicUser(user: IUserRecord): IUser {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

function createSession(userId: string, locale: 'ru' | 'en'): string {
  const sessionId = uuidv4();
  sessionStore[sessionId] = {
    userId,
    locale,
    recommendations: {},
    lastSeenAt: Date.now(),
  };
  return sessionId;
}

function getSession(req: Request): ISession | null {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (!sessionId) return null;
  return sessionStore[sessionId] ?? null;
}

function getUserFromRequest(req: Request): IUserRecord | null {
  const session = getSession(req);
  if (!session) return null;
  const db = readJsonFile<IDatabase>(usersPath, { users: [] });
  const user = db.users.find((candidate) => candidate.id === session.userId) ?? null;
  if (!user) return null;
  if (user.role === 'admin' && Date.now() - session.lastSeenAt > ADMIN_SESSION_TTL_MS) {
    const sid = req.cookies?.[SESSION_COOKIE_NAME];
    if (sid) delete sessionStore[sid];
    return null;
  }
  session.lastSeenAt = Date.now();
  return user;
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message: 'Необходима авторизация' });
    return;
  }
  // @ts-ignore convenient request extension
  req.user = user;
  next();
}

function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message: 'Необходима авторизация' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ message: 'Недостаточно прав' });
    return;
  }
  // @ts-ignore convenient request extension
  req.user = user;
  next();
}

function decayRecommendations(session: ISession): void {
  const now = Date.now();
  Object.entries(session.recommendations).forEach(([tag, value]) => {
    if (now - value.updatedAt > RECOMMENDATION_DECAY_MS) {
      delete session.recommendations[tag];
    }
  });
}

function addRecommendation(session: ISession, tags: string[]): void {
  const now = Date.now();
  tags.forEach((tag) => {
    const current = session.recommendations[tag];
    session.recommendations[tag] = {
      score: (current?.score ?? 0) + 1,
      updatedAt: now,
    };
  });
}

ensureDataFiles();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(publicPath));

app.get('/api/skins', (_req: Request, res: Response) => {
  res.json(readJsonFile<ISkin[]>(skinsPath, []));
});

app.get('/api/feed', (req: Request, res: Response) => {
  const skins = readJsonFile<ISkin[]>(skinsPath, []);
  const session = getSession(req);
  if (!session) {
    res.json(skins);
    return;
  }
  decayRecommendations(session);
  const sorted = [...skins].sort(
    (a, b) => scoreSkin(b.tags, session.recommendations) - scoreSkin(a.tags, session.recommendations)
  );
  const high = sorted.filter((skin) => scoreSkin(skin.tags, session.recommendations) > 0);
  const other = sorted.filter((skin) => scoreSkin(skin.tags, session.recommendations) === 0);
  const mixed: ISkin[] = [];
  while (high.length || other.length) {
    if (other.length) mixed.push(other.shift() as ISkin);
    if (other.length) mixed.push(other.shift() as ISkin);
    if (high.length) mixed.push(high.shift() as ISkin);
  }
  res.json(mixed);
});

app.post('/api/register', (req: Request, res: Response) => {
  const { login, password } = req.body as { login?: string; password?: string };
  if (!login || !password) {
    res.status(400).json({ message: 'login и password обязательны' });
    return;
  }
  const db = readJsonFile<IDatabase>(usersPath, { users: [] });
  if (db.users.some((item) => item.login === login)) {
    res.status(400).json({ message: 'Логин уже занят' });
    return;
  }
  const user: IUserRecord = {
    id: uuidv4(),
    login,
    password,
    balance: 1000,
    inventory: [],
    role: 'user',
  };
  db.users.push(user);
  writeJsonFile(usersPath, db);
  const sessionId = createSession(user.id, detectLocale(req.headers['accept-language']));
  res.cookie(SESSION_COOKIE_NAME, sessionId, { httpOnly: true, sameSite: 'lax' });
  res.status(201).json(toPublicUser(user));
});

app.post('/api/login', (req: Request, res: Response) => {
  const { login, password } = req.body as { login?: string; password?: string };
  if (!login || !password) {
    res.status(400).json({ message: 'login и password обязательны' });
    return;
  }
  const db = readJsonFile<IDatabase>(usersPath, { users: [] });
  const user = db.users.find((item) => item.login === login && item.password === password);
  if (!user) {
    res.status(401).json({ message: 'Неверный логин или пароль' });
    return;
  }
  const sessionId = createSession(user.id, detectLocale(req.headers['accept-language']));
  res.cookie(SESSION_COOKIE_NAME, sessionId, { httpOnly: true, sameSite: 'lax' });
  res.json(toPublicUser(user));
});

app.post('/api/logout', (req: Request, res: Response) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (sessionId) delete sessionStore[sessionId];
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ message: 'ok' });
});

app.get('/api/me', (req: Request, res: Response) => {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message: 'Необходима авторизация' });
    return;
  }
  res.json(toPublicUser(user));
});

app.get('/api/session-locale', (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) {
    res.json({
      locale: detectLocale(req.headers['accept-language']),
      hasSessionChoice: false,
    });
    return;
  }
  res.json({ locale: session.locale, hasSessionChoice: true });
});

app.post('/api/session-locale', (req: Request, res: Response) => {
  const { locale } = req.body as { locale?: 'ru' | 'en' };
  const session = getSession(req);
  if (!session) {
    res.status(400).json({ message: 'Нет активной сессии' });
    return;
  }
  if (locale !== 'ru' && locale !== 'en') {
    res.status(400).json({ message: 'Некорректная локаль' });
    return;
  }
  session.locale = locale;
  res.json({ locale: session.locale });
});

app.post('/api/skins/:skinId/like', authMiddleware, (req: Request, res: Response) => {
  const skins = readJsonFile<ISkin[]>(skinsPath, []);
  const session = getSession(req);
  const skin = skins.find((item) => item.id === req.params.skinId);
  if (!skin || !session) {
    res.status(404).json({ message: 'Товар не найден' });
    return;
  }
  addRecommendation(session, skin.tags);
  res.json({ message: 'ok' });
});

app.post('/api/skins/:skinId/reviews', authMiddleware, (req: Request, res: Response) => {
  // @ts-ignore populated in middleware
  const user = req.user as IUserRecord;
  const { rating, comment } = req.body as { rating?: number; comment?: string };
  if (!rating || rating < 1 || rating > 5 || !comment?.trim()) {
    res.status(400).json({ message: 'Нужны корректные рейтинг и комментарий' });
    return;
  }
  const skins = readJsonFile<ISkin[]>(skinsPath, []);
  const skin = skins.find((item) => item.id === req.params.skinId);
  if (!skin) {
    res.status(404).json({ message: 'Товар не найден' });
    return;
  }
  skin.reviews.push({
    rating,
    comment: comment.trim(),
    userLogin: user.login,
    createdAt: new Date().toISOString(),
  });
  writeJsonFile(skinsPath, skins);
  res.status(201).json(skin);
});

app.post('/api/buy', authMiddleware, (req: Request, res: Response) => {
  // @ts-ignore populated in middleware
  const user = req.user as IUserRecord;
  const { skinId } = req.body as { skinId?: string };
  if (!skinId) {
    res.status(400).json({ message: 'skinId обязателен' });
    return;
  }
  const skins = readJsonFile<ISkin[]>(skinsPath, []);
  const skin = skins.find((item) => item.id === skinId);
  if (!skin) {
    res.status(404).json({ message: 'Товар не найден' });
    return;
  }
  if (user.balance < skin.price) {
    res.status(400).json({ message: 'Недостаточно баланса' });
    return;
  }
  const db = readJsonFile<IDatabase>(usersPath, { users: [] });
  const dbUser = db.users.find((item) => item.id === user.id);
  if (!dbUser) {
    res.status(404).json({ message: 'Пользователь не найден' });
    return;
  }
  dbUser.balance -= skin.price;
  dbUser.inventory.push(skin);
  writeJsonFile(usersPath, db);
  res.json(toPublicUser(dbUser));
});

app.post('/api/sell', authMiddleware, (req: Request, res: Response) => {
  // @ts-ignore populated in middleware
  const user = req.user as IUserRecord;
  const { instanceId } = req.body as { instanceId?: number };
  if (typeof instanceId !== 'number') {
    res.status(400).json({ message: 'instanceId обязателен' });
    return;
  }
  const db = readJsonFile<IDatabase>(usersPath, { users: [] });
  const dbUser = db.users.find((item) => item.id === user.id);
  if (!dbUser) {
    res.status(404).json({ message: 'Пользователь не найден' });
    return;
  }
  const skin = dbUser.inventory[instanceId];
  if (!skin) {
    res.status(404).json({ message: 'Предмет не найден в инвентаре' });
    return;
  }
  dbUser.inventory.splice(instanceId, 1);
  dbUser.balance += skin.price;
  writeJsonFile(usersPath, db);
  res.json(toPublicUser(dbUser));
});

app.post('/api/admin/products', adminMiddleware, (req: Request, res: Response) => {
  const payload = req.body as Partial<ISkin>;
  if (!payload.name || !payload.price || !payload.rarity || !payload.wear || !payload.category) {
    res.status(400).json({ message: 'Недостаточно полей для создания товара' });
    return;
  }
  const skins = readJsonFile<ISkin[]>(skinsPath, []);
  const skin: ISkin = {
    id: uuidv4(),
    name: payload.name,
    price: payload.price,
    rarity: payload.rarity,
    wear: payload.wear,
    category: payload.category,
    image: payload.image ?? 'https://via.placeholder.com/300x160?text=New+Skin',
    tags: payload.tags ?? [],
    reviews: [],
  };
  skins.push(skin);
  writeJsonFile(skinsPath, skins);
  res.status(201).json(skin);
});

app.put('/api/admin/products/:skinId', adminMiddleware, (req: Request, res: Response) => {
  const skins = readJsonFile<ISkin[]>(skinsPath, []);
  const skin = skins.find((item) => item.id === req.params.skinId);
  if (!skin) {
    res.status(404).json({ message: 'Товар не найден' });
    return;
  }
  const payload = req.body as Partial<ISkin>;
  skin.name = payload.name ?? skin.name;
  skin.price = payload.price ?? skin.price;
  skin.rarity = payload.rarity ?? skin.rarity;
  skin.wear = payload.wear ?? skin.wear;
  skin.category = payload.category ?? skin.category;
  skin.image = payload.image ?? skin.image;
  skin.tags = payload.tags ?? skin.tags;
  writeJsonFile(skinsPath, skins);
  res.json(skin);
});

app.get('/api/protected', authMiddleware, (req: Request, res: Response) => {
  // @ts-ignore populated in middleware
  const user = req.user as IUserRecord;
  res.json({ message: 'ok', login: user.login, role: user.role as UserRole });
});

export { app };

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`WW Skin Market server running on http://localhost:${PORT}`);
  });
}

