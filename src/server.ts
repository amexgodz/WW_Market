import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import { ISkin, IUser } from './shared/interfaces';

const app = express();
const PORT = process.env.PORT || 3000;

// Пути к статике и "базе данных"
const publicPath = path.join(__dirname, '..', 'public');
const dataDir = path.join(__dirname, '..', 'data');
const skinsPath = path.join(dataDir, 'skins.json');
const usersPath = path.join(dataDir, 'users.json');

// Убедимся, что директория для данных существует
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Вспомогательные функции работы с файлами
/**
 * Читает JSON из файла и возвращает результат.
 * Если файл отсутствует, пустой или с ошибкой, вернет defaultValue.
 * @template T
 * @param {string} filePath
 * @param {T} defaultValue
 * @returns {T}
 */
function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) {
      return defaultValue;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Failed to read JSON from ${filePath}`, error);
    return defaultValue;
  }
}

/**
 * Записывает данные в JSON-файл.
 * @template T
 * @param {string} filePath
 * @param {T} data
 * @returns {void}
 */
function writeJsonFile<T>(filePath: string, data: T): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Типы для "базы"
interface IUserRecord extends IUser {
  password: string;
}

interface IDatabase {
  users: IUserRecord[];
}

// Инициализация пустой базы пользователей при первом старте
if (!fs.existsSync(usersPath)) {
  const initialDb: IDatabase = { users: [] };
  writeJsonFile<IDatabase>(usersPath, initialDb);
}

// Мидлвары
app.use(express.json());
app.use(cookieParser());
app.use(express.static(publicPath));

// Простая система сессий через cookie
const SESSION_COOKIE_NAME = 'ww_session';
type SessionStore = Record<string, string>; // sessionId -> userId

const sessionStore: SessionStore = {};

/**
 * Создает новую сессию для пользователя.
 * @param {string} userId
 * @returns {string}
 */
function createSession(userId: string): string {
  const sessionId = uuidv4();
  sessionStore[sessionId] = userId;
  return sessionId;
}

/**
 * Возвращает пользователя по cookie-сессии из запроса.
 * @param {Request} req
 * @returns {IUserRecord | null}
 */
function getUserFromRequest(req: Request): IUserRecord | null {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (!sessionId) return null;

  const userId = sessionStore[sessionId];
  if (!userId) return null;

  const db = readJsonFile<IDatabase>(usersPath, { users: [] });
  return db.users.find((u) => u.id === userId) ?? null;
}

/**
 * Проверяет авторизацию пользователя.
 * Если сессии нет, возвращает 401.
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {void}
 */
function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message: 'Необходима авторизация' });
    return;
  }
  (req as Request & { user: IUserRecord }).user = user;
  next();
}

// -------- API РОУТЫ --------

// GET /api/skins — просто отдача JSON скинов
app.get('/api/skins', (_req: Request, res: Response) => {
  const skins = readJsonFile<ISkin[]>(skinsPath, []);
  console.log('GET /api/skins -> using file:', skinsPath, 'items:', skins.length);
  res.json(skins);
});

// POST /api/register — регистрация
app.post('/api/register', (req: Request, res: Response) => {
  const { login, password } = req.body as {
    login?: string;
    password?: string;
  };

  if (!login || !password) {
    res.status(400).json({ message: 'login и password обязательны' });
    return;
  }

  const db = readJsonFile<IDatabase>(usersPath, { users: [] });

  const existing = db.users.find((u) => u.login === login);
  if (existing) {
    res.status(400).json({ message: 'Логин уже занят' });
    return;
  }

  const newUser: IUserRecord = {
    id: uuidv4(),
    login,
    password,
    balance: 1000.0,
    inventory: [],
  };

  db.users.push(newUser);
  writeJsonFile<IDatabase>(usersPath, db);

  // создаём сессию сразу после регистрации
  const sessionId = createSession(newUser.id);
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
  });

  const { password: _pwd, ...publicUser } = newUser;
  res.status(201).json(publicUser);
});

// POST /api/login — авторизация, создание сессии
app.post('/api/login', (req: Request, res: Response) => {
  const { login, password } = req.body as {
    login?: string;
    password?: string;
  };

  if (!login || !password) {
    res.status(400).json({ message: 'login и password обязательны' });
    return;
  }

  const db = readJsonFile<IDatabase>(usersPath, { users: [] });
  const user = db.users.find(
    (u) => u.login === login && u.password === password
  );

  if (!user) {
    res.status(401).json({ message: 'Неверный логин или пароль' });
    return;
  }

  const sessionId = createSession(user.id);
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
  });

  const { password: _pwd, ...publicUser } = user;
  res.json(publicUser);
});

// GET /api/me — текущий пользователь по Cookie
app.get('/api/me', (req: Request, res: Response) => {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message: 'Необходима авторизация' });
    return;
  }

  const { password: _pwd, ...publicUser } = user;
  res.json(publicUser);
});

// POST /api/buy — покупка предмета
app.post('/api/buy', authMiddleware, (req: Request, res: Response) => {
  const { skinId } = req.body as { skinId?: string };

  if (!skinId) {
    res.status(400).json({ message: 'skinId обязателен' });
    return;
  }

  const skins = readJsonFile<ISkin[]>(skinsPath, []);
  const skin = skins.find((s) => s.id === skinId);

  if (!skin) {
    res.status(404).json({ message: 'Скин не найден' });
    return;
  }

  const db = readJsonFile<IDatabase>(usersPath, { users: [] });

  const currentUser: IUserRecord | undefined = db.users.find(
    (u) => u.id === (req as Request & { user: IUserRecord }).user.id
  );

  if (!currentUser) {
    res.status(401).json({ message: 'Пользователь не найден' });
    return;
  }

  // Критическая проверка экономики: достаточно ли средств
  if (currentUser.balance < skin.price) {
    res.status(400).json({ message: 'Недостаточно средств' });
    return;
  }

  currentUser.balance -= skin.price;
  currentUser.inventory.push({ ...skin });

  writeJsonFile<IDatabase>(usersPath, db);

  const { password: _pwd, ...publicUser } = currentUser;
  res.json(publicUser);
});

// POST /api/sell — продажа предмета по индексу в инвентаре
app.post('/api/sell', authMiddleware, (req: Request, res: Response) => {
  const { instanceId } = req.body as { instanceId?: number };

  if (instanceId === undefined || instanceId === null) {
    res.status(400).json({ message: 'instanceId обязателен' });
    return;
  }

  const db = readJsonFile<IDatabase>(usersPath, { users: [] });

  const currentUser: IUserRecord | undefined = db.users.find(
    (u) => u.id === (req as Request & { user: IUserRecord }).user.id
  );

  if (!currentUser) {
    res.status(401).json({ message: 'Пользователь не найден' });
    return;
  }

  if (
    instanceId < 0 ||
    instanceId >= currentUser.inventory.length ||
    !Number.isInteger(instanceId)
  ) {
    res.status(400).json({ message: 'Неверный идентификатор предмета' });
    return;
  }

  const [soldItem] = currentUser.inventory.splice(instanceId, 1);

  if (!soldItem) {
    res.status(400).json({ message: 'Предмет не найден' });
    return;
  }

  currentUser.balance += soldItem.price;

  writeJsonFile<IDatabase>(usersPath, db);

  const { password: _pwd, ...publicUser } = currentUser;
  res.json(publicUser);
});

// Пример защищённого роута (если понадобится позже)
app.get('/api/protected', authMiddleware, (req: Request, res: Response) => {
  const user: IUserRecord = (req as Request & { user: IUserRecord }).user;
  res.json({ message: 'ok', login: user.login });
});

// -------- СТАРТ СЕРВЕРА --------

app.listen(PORT, () => {
  console.log(`WW Skin Market server running on http://localhost:${PORT}`);
});

