"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const uuid_1 = require("uuid");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Пути к статике и "базе данных"
const publicPath = path_1.default.join(__dirname, '..', 'public');
const dataDir = path_1.default.join(__dirname, '..', 'data');
const skinsPath = path_1.default.join(dataDir, 'skins.json');
const usersPath = path_1.default.join(dataDir, 'users.json');
// Убедимся, что директория для данных существует
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
// Вспомогательные функции работы с файлами
function readJsonFile(filePath, defaultValue) {
    try {
        if (!fs_1.default.existsSync(filePath)) {
            return defaultValue;
        }
        const raw = fs_1.default.readFileSync(filePath, 'utf-8');
        if (!raw.trim()) {
            return defaultValue;
        }
        return JSON.parse(raw);
    }
    catch (error) {
        console.error(`Failed to read JSON from ${filePath}`, error);
        return defaultValue;
    }
}
function writeJsonFile(filePath, data) {
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
// Инициализация пустой базы пользователей при первом старте
if (!fs_1.default.existsSync(usersPath)) {
    const initialDb = { users: [] };
    writeJsonFile(usersPath, initialDb);
}
// Мидлвары
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.static(publicPath));
// Простая система сессий через cookie
const SESSION_COOKIE_NAME = 'ww_session';
const sessionStore = {};
function createSession(userId) {
    const sessionId = (0, uuid_1.v4)();
    sessionStore[sessionId] = userId;
    return sessionId;
}
function getUserFromRequest(req) {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
    if (!sessionId)
        return null;
    const userId = sessionStore[sessionId];
    if (!userId)
        return null;
    const db = readJsonFile(usersPath, { users: [] });
    return db.users.find((u) => u.id === userId) ?? null;
}
function authMiddleware(req, res, next) {
    const user = getUserFromRequest(req);
    if (!user) {
        res.status(401).json({ message: 'Необходима авторизация' });
        return;
    }
    req.user = user;
    next();
}
// -------- API РОУТЫ --------
// GET /api/skins — просто отдача JSON скинов
app.get('/api/skins', (_req, res) => {
    const skins = readJsonFile(skinsPath, []);
    console.log('GET /api/skins -> using file:', skinsPath, 'items:', skins.length);
    res.json(skins);
});
// POST /api/register — регистрация
app.post('/api/register', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) {
        res.status(400).json({ message: 'login и password обязательны' });
        return;
    }
    const db = readJsonFile(usersPath, { users: [] });
    const existing = db.users.find((u) => u.login === login);
    if (existing) {
        res.status(400).json({ message: 'Логин уже занят' });
        return;
    }
    const newUser = {
        id: (0, uuid_1.v4)(),
        login,
        password,
        balance: 1000.0,
        inventory: [],
    };
    db.users.push(newUser);
    writeJsonFile(usersPath, db);
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
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) {
        res.status(400).json({ message: 'login и password обязательны' });
        return;
    }
    const db = readJsonFile(usersPath, { users: [] });
    const user = db.users.find((u) => u.login === login && u.password === password);
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
app.get('/api/me', (req, res) => {
    const user = getUserFromRequest(req);
    if (!user) {
        res.status(401).json({ message: 'Необходима авторизация' });
        return;
    }
    const { password: _pwd, ...publicUser } = user;
    res.json(publicUser);
});
// POST /api/buy — покупка предмета
app.post('/api/buy', authMiddleware, (req, res) => {
    const { skinId } = req.body;
    if (!skinId) {
        res.status(400).json({ message: 'skinId обязателен' });
        return;
    }
    const skins = readJsonFile(skinsPath, []);
    const skin = skins.find((s) => s.id === skinId);
    if (!skin) {
        res.status(404).json({ message: 'Скин не найден' });
        return;
    }
    const db = readJsonFile(usersPath, { users: [] });
    const currentUser = db.users.find((u) => u.id === req.user.id);
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
    writeJsonFile(usersPath, db);
    const { password: _pwd, ...publicUser } = currentUser;
    res.json(publicUser);
});
// POST /api/sell — продажа предмета по индексу в инвентаре
app.post('/api/sell', authMiddleware, (req, res) => {
    const { instanceId } = req.body;
    if (instanceId === undefined || instanceId === null) {
        res.status(400).json({ message: 'instanceId обязателен' });
        return;
    }
    const db = readJsonFile(usersPath, { users: [] });
    const currentUser = db.users.find((u) => u.id === req.user.id);
    if (!currentUser) {
        res.status(401).json({ message: 'Пользователь не найден' });
        return;
    }
    if (instanceId < 0 ||
        instanceId >= currentUser.inventory.length ||
        !Number.isInteger(instanceId)) {
        res.status(400).json({ message: 'Неверный идентификатор предмета' });
        return;
    }
    const [soldItem] = currentUser.inventory.splice(instanceId, 1);
    if (!soldItem) {
        res.status(400).json({ message: 'Предмет не найден' });
        return;
    }
    currentUser.balance += soldItem.price;
    writeJsonFile(usersPath, db);
    const { password: _pwd, ...publicUser } = currentUser;
    res.json(publicUser);
});
// Пример защищённого роута (если понадобится позже)
app.get('/api/protected', authMiddleware, (req, res) => {
    const user = req.user;
    res.json({ message: 'ok', login: user.login });
});
// -------- СТАРТ СЕРВЕРА --------
app.listen(PORT, () => {
    console.log(`WW Skin Market server running on http://localhost:${PORT}`);
});
