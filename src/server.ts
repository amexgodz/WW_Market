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

function createSession(userId: string): string {
  const sessionId = uuidv4();
  sessionStore[sessionId] = userId;
  return sessionId;
}

function getUserFromRequest(req: Request): IUserRecord | null {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (!sessionId) return null;

  const userId = sessionStore[sessionId];
  if (!userId) return null;

  const db = readJsonFile<IDatabase>(usersPath, { users: [] });
  return db.users.find((u) => u.id === userId) ?? null;
}

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
  // @ts-expect-error расширяем объект запроса для удобства
  req.user = user;
  next();
}

// -------- API РОУТЫ --------

// GET /api/skins — просто отдача JSON скинов
app.get('/api/skins', (_req: Request, res: Response) => {
  const skins = readJsonFile<ISkin[]>(skinsPath, []);
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

// Пример защищённого роута (если понадобится позже)
app.get('/api/protected', authMiddleware, (req: Request, res: Response) => {
  // @ts-expect-error user добавлен в мидлваре
  const user: IUserRecord = req.user;
  res.json({ message: 'ok', login: user.login });
});

// -------- СТАРТ СЕРВЕРА --------

app.listen(PORT, () => {
  console.log(`WW Skin Market server running on http://localhost:${PORT}`);
});

