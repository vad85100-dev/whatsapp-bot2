const express = require('express');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

const ID_INSTANCE = process.env.ID_INSTANCE;
const API_TOKEN = process.env.API_TOKEN;
const BOSS = 'P14';
const ADMINS = ['A', 'Фаягуль', 'Галина', 'Гузель 🧿', 'Галина Дубль', 'Евгения'];

const ALLOWED_GROUPS = ['Штаб-БОТ', 'Колесо Фортуны, резерв'];

// Мультигрупповая система
let groups = {};
let licenses = {};

// Функция получения данных группы
function getGroupData(chatId) {
    if (!groups[chatId]) {
        groups[chatId] = {
            db: {},
            piggyBank: 0,
            piggyHistory: [],
            stats: { reportDate: new Date() }
        };
    }
    return groups[chatId];
}

// Функция проверки лицензии
function hasLicense(chatId, groupName) {
    const licenseById = licenses[chatId];
    if (licenseById) {
        const expireDate = new Date(licenseById.expireDate);
        return expireDate > new Date();
    }
    
    const groupNameLower = groupName.toLowerCase();
    for (const [key, lic] of Object.entries(licenses)) {
        if (key.toLowerCase() === groupNameLower) {
            const expireDate = new Date(lic.expireDate);
            return expireDate > new Date();
        }
    }
    return false;
}

const HEADQUARTERS_GROUPS = ['Штаб-БОТ'];

function isHeadquarters(groupName) {
    return HEADQUARTERS_GROUPS.includes(groupName);
}

async function saveLicenses() {
    fs.writeFileSync('licenses.json', JSON.stringify(licenses, null, 2));
    console.log('💾 Лицензии сохранены');
}

function getLicenseInfo(chatId) {
    const license = licenses[chatId];
    if (!license) return null;
    const expireDate = new Date(license.expireDate);
    const daysLeft = Math.ceil((expireDate - new Date()) / (1000 * 60 * 60 * 24));
    return { expireDate, daysLeft, plan: license.plan, addedBy: license.addedBy };
}

function getPlayerKey(nameOrId, dbData) {
    if (!nameOrId) return null;

    const idNum = parseInt(nameOrId);
    if (!isNaN(idNum)) {
        return Object.keys(dbData).find(key => dbData[key]?.id === idNum);
    }

    const searchName = nameOrId.toLowerCase().trim();
    let exactMatch = Object.keys(dbData).find(key => {
        const keyName = key.split(' (')[0].toLowerCase().trim();
        return keyName === searchName;
    });

    if (exactMatch) return exactMatch;

    const normalizedSearch = nameOrId.toLowerCase().replace(/[^a-zа-яё0-9]/g, '').trim();
    return Object.keys(dbData).find(key => {
        const keyName = key.split(' (')[0].toLowerCase().replace(/[^a-zа-яё0-9]/g, '').trim();
        return keyName === normalizedSearch;
    });
}

// Загрузка данных
try {
    if (fs.existsSync('groups_backup.json')) {
        const backup = JSON.parse(fs.readFileSync('groups_backup.json', 'utf8'));
        groups = backup;
        console.log('✅ Данные групп восстановлены из бэкапа');
    }
} catch(e) { console.log('Нет бэкапа групп'); }

setInterval(() => {
    fs.writeFileSync('groups_backup.json', JSON.stringify(groups, null, 2));
    console.log('💾 Данные групп сохранены');
}, 30 * 1000);

try {
    if (fs.existsSync('licenses.json')) {
        licenses = JSON.parse(fs.readFileSync('licenses.json', 'utf8'));
        console.log('✅ Лицензии загружены');
    }
} catch(e) { console.log('Нет файла лицензий'); }

setInterval(() => {
    fs.writeFileSync('licenses.json', JSON.stringify(licenses, null, 2));
}, 5 * 60 * 1000);

// Шутки и прочее
const jokes = [
    '😂 Почему игроки не любят лес? — Там много *логов*!',
    '🤣 Лот — это лотерея для оптимистов с кредиткой!',
    '😎 Админ: *Ставки сделаны?* Игрок: *Да, на победу!*',
    '🔥 Феникс сгорел... в лоте! Но возродился с деньгами!',
    '🐱 Почему котик проиграл в лоте? — Потому что мяукнул не на тот номер!',
    '🍺 Сколько нужно пивасика, чтобы выиграть джекпот? — Столько же, сколько номеров в лоте!',
    '💄 Кокетка поставила на 6 — и выиграла! А всё потому, что верила в себя!',
    '🍎 Ядовитое яблочко укусило удачу за хвост — и выиграло 5000₽!',
    '🐶 Почему собаки не играют в лото? — Боятся стать *логами*!',
    '🎲 Лучший способ удвоить деньги — сложить их пополам и положить в карман. А лот — это веселее!',
    '🃏 Игрок спрашивает: "Почему я всё время проигрываю?" Админ: "Ты просто тренируешь удачу!"',
    '💰 Лот — это как коробка конфет: никогда не знаешь, какая начинка тебя ждёт!'
];

const facts = ['🎲 Сегодня чаще выпадают нечётные', '🔥 70% игроков ставят на 7 и 8', '💰 Джекпот недели — 25 000₽'];

async function sendMessage(chatId, text) {
    try {
        const url = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`;
        console.log('Отправка по URL:', url);
        
        const response = await axios.post(url, {
            chatId: chatId,
            message: text
        });
        
        console.log('✅ Отправлено, ID:', response.data.idMessage);
    } catch (err) {
        console.error('❌ Ошибка отправки:', err.message);
        if (err.response) {
            console.error('Статус:', err.response.status);
            console.error('Данные ошибки:', err.response.data);
        }
    }
}

function getDisplayNameNoId(playerKey) {
    if (!playerKey) return 'Неизвестно';
    return playerKey.split(' (')[0];
}

function getDisplayName(playerKey, dbData) {
    if (!playerKey) return 'Неизвестно';
    if (typeof playerKey !== 'string') return 'Неизвестно';
    const name = playerKey.split(' (')[0];
    if (!dbData || !dbData[playerKey]) return name;
    const id = dbData[playerKey]?.id;
    if (id) return `${name} (${id})`;
    return name;
}

function ensurePlayer(name, dbData) {
    let key = getPlayerKey(name, dbData);
    if (!key) {
        const existingIds = Object.values(dbData).map(p => p.id || 0);
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 9;
        const newId = maxId + 1;
        key = `${name} (auto)`;
        dbData[key] = { balance: 0, games: 0, tickets: 0, wins: 0, id: newId };
    }
    return key;
}

function isAdmin(sender, dbData) {
    if (sender === BOSS) return true;

    const normalizedSender = sender.toLowerCase().replace(/^~/, '').replace(/[^a-zа-яё0-9]/g, '').trim();

    if (ADMINS.some(admin => {
        const normalizedAdmin = admin.toLowerCase().replace(/^~/, '').replace(/[^a-zа-яё0-9]/g, '').trim();
        return normalizedAdmin === normalizedSender;
    })) return true;

    const playerKey = getPlayerKey(sender, dbData);
    if (playerKey && dbData[playerKey]?.isAdmin === true) return true;

    return false;
}

function addGamePlay(playerKey, value, dbData) {
    if (!dbData[playerKey]) return;
    if (!dbData[playerKey].games) dbData[playerKey].games = 0;
    if (!dbData[playerKey].tickets) dbData[playerKey].tickets = 0;
    
    dbData[playerKey].games += value;
    
    while (dbData[playerKey].games >= 10) {
        dbData[playerKey].tickets += 1;
        dbData[playerKey].games -= 10;
    }
}

function breakPiggy(chatId) {
    const group = getGroupData(chatId);
    const db = group.db;
    let piggyBank = group.piggyBank;
    let piggyHistory = group.piggyHistory;
    
    const participants = [];
    for (let key in db) if (db[key]?.tickets && db[key].tickets > 0) participants.push({ key, tickets: db[key].tickets });
    if (participants.length === 0 || piggyBank === 0) {
        sendMessage(chatId, `❌ Нет мешочков или копилка пуста!`);
        return;
    }
    const totalTickets = participants.reduce((s, p) => s + p.tickets, 0);
    const perTicket = piggyBank / totalTickets;
    let msg = `🐷 *РАЗБИВКА КОПИЛКИ* 🐷\n━━━━━━━━━━━━━━━━━━\n💰 Сумма: ${piggyBank}₽\n🎟️ Мешочков: ${totalTickets}\n📊 На 1 мешочек: ${Math.floor(perTicket)}₽\n\n🏆 *ПОЛУЧИЛИ:*\n`;
    for (const p of participants) {
        const winnings = Math.floor(perTicket * p.tickets);
        db[p.key].balance = (db[p.key].balance || 0) + winnings;
        db[p.key].tickets = 0;
        msg += `\n${getDisplayName(p.key, db)} — ${winnings}₽ (${p.tickets} меш.)`;
    }
    piggyHistory.push({
        date: new Date().toISOString(),
        amount: piggyBank,
        participants: participants.map(p => ({
            name: getDisplayName(p.key, db),
            tickets: p.tickets,
            winnings: Math.floor((piggyBank / totalTickets) * p.tickets)
        }))
    });
    piggyBank = 0;
    group.piggyBank = piggyBank;
    group.db = db;
    group.piggyHistory = piggyHistory;
    groups[chatId] = group;
    msg += `\n\n━━━━━━━━━━━━━━━━━━\n🎉 ПОЗДРАВЛЯЕМ! 🎉`;
    sendMessage(chatId, msg);
}

async function exportData(chatId) {
    const group = getGroupData(chatId);
    const exportObj = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        db: group.db,
        piggyBank: group.piggyBank,
        piggyHistory: group.piggyHistory,
        stats: group.stats
    };
    const jsonStr = JSON.stringify(exportObj);
    await sendMessage(chatId, `📦 *ЭКСПОРТ ДАННЫХ*\n━━━━━━━━━━━━━━━━━━\n.вставить [JSON] для восстановления\n\n${jsonStr}`);
}

async function importData(chatId, jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        if (!data.db) {
            await sendMessage(chatId, `❌ Неверный формат JSON`);
            return;
        }
        const group = getGroupData(chatId);
        group.db = data.db;
        group.piggyBank = data.piggyBank || 0;
        group.piggyHistory = data.piggyHistory || [];
        group.stats = data.stats || { reportDate: new Date() };
        await sendMessage(chatId, `✅ *ИМПОРТ ВЫПОЛНЕН*\n👥 Игроков: ${Object.keys(group.db).length}\n🐷 Копилка: ${group.piggyBank}₽`);
    } catch (err) {
        await sendMessage(chatId, `❌ Ошибка: ${err.message}`);
    }
}

async function handleMessage(chatId, sender, text, groupName) {
    const group = getGroupData(chatId);
    let db = group.db;
    let piggyBank = group.piggyBank;
    let piggyHistory = group.piggyHistory;
    let stats = group.stats;

    const isLicensed = hasLicense(chatId, groupName);
    const isBossHere = sender === BOSS;

    if (!isLicensed && !isBossHere && !ALLOWED_GROUPS.includes(groupName)) {
        return;
    }
    
    let rawCmd = text.trim().toLowerCase();
    let cmd = rawCmd;
    let args = '';
    const spaceIdx = rawCmd.indexOf(' ');
    if (spaceIdx !== -1) {
        cmd = rawCmd.substring(0, spaceIdx).trim();
        args = rawCmd.substring(spaceIdx + 1).trim();
    }

    const isAdminUser = isAdmin(sender, db);
    const playerExists = getPlayerKey(sender, db) !== null;

    if (!playerExists && cmd.startsWith('/') && cmd !== '/регистрация') {
        await sendMessage(chatId, `❌ *ДОСТУП ЗАПРЕЩЁН* ❌
━━━━━━━━━━━━━━━━━━
👤 ${sender}, вы не зарегистрированы в системе.

✅ Для регистрации напишите:
/регистрация

💡 Регистрация бесплатна!`);
        return;
    }

    if (!playerExists && !cmd.startsWith('/') && !cmd.startsWith('.') && cmd.length > 1) {
        await sendMessage(chatId, `👋 *Здравствуйте, ${sender}!* 👋
━━━━━━━━━━━━━━━━━━
Вы не зарегистрированы в системе.

✅ Для регистрации напишите:
/регистрация

💡 Регистрация бесплатна!`);
        return;
    }

    // ===== РЕГИСТРАЦИЯ =====
    if (cmd === '/регистрация') {
        const existingKey = getPlayerKey(sender, db);
        if (existingKey) {
            await sendMessage(chatId, `✅ *ВЫ УЖЕ ЗАРЕГИСТРИРОВАНЫ*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(existingKey, db)}\n💰 Баланс: ${db[existingKey]?.balance || 0}₽`);
            return;
        }
        const existingIds = Object.values(db).map(p => p.id || 0);
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 9;
        const newId = maxId + 1;
        const newKey = `${sender} (auto)`;
        db[newKey] = { balance: 0, games: 0, tickets: 0, wins: 0, id: newId };
        group.db = db;
        groups[chatId] = group;
        await sendMessage(chatId, `✅ *РЕГИСТРАЦИЯ ПРОШЛА УСПЕШНО!* ✅
━━━━━━━━━━━━━━━━━━
👤 *Игрок:* ${sender}
🆔 *ID:* ${newId}
💰 *Баланс:* 0₽

🎮 Доступные команды: /бот`);
        return;
    }

    // ===== ПУБЛИЧНЫЕ КОМАНДЫ =====
    if (cmd === '/бот') {
        await sendMessage(chatId, `🤖 *МЕНЮ ИГРОКА*\n━━━━━━━━━━━━━━━━━━\n/баланс 💰\n/статистика 📊\n/банк 🏦\n/гадание 🔮\n/новости 📰\n/шутка 😂\n/топ10 🏆\n/админы 👑`);
        return;
    }
    
    if (cmd === '/баланс') {
        const playerKey = getPlayerKey(sender, db);
        if (!playerKey) {
            await sendMessage(chatId, `💰 *БАЛАНС*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n💎 0₽\n\n💡 Напишите /регистрация`);
            return;
        }
        await sendMessage(chatId, `💰 *БАЛАНС*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(playerKey, db)}\n💎 ${db[playerKey]?.balance || 0}₽`);
        return;
    }
    
    if (cmd === '/статистика') {
        const playerKey = getPlayerKey(sender, db);
        if (!playerKey) {
            await sendMessage(chatId, `📊 *СТАТИСТИКА*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n🎲 Игр: 0\n🎟️ Меш.: 0\n🏆 Побед: 0\n💰 Баланс: 0₽\n\n💡 Напишите /регистрация`);
            return;
        }
        const g = db[playerKey]?.games || 0;
        const t = db[playerKey]?.tickets || 0;
        const w = db[playerKey]?.wins || 0;
        await sendMessage(chatId, `📊 *СТАТИСТИКА*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(playerKey, db)}\n🎲 Игр: ${g}\n🎟️ Меш.: ${t}\n🏆 Побед: ${w}\n💰 Баланс: ${db[playerKey]?.balance || 0}₽`);
        return;
    }
    
    if (cmd === '/банк') {
        const list = Object.entries(db);
        if (!list.length) {
            await sendMessage(chatId, '📭 База пуста');
            return;
        }
        list.sort((a, b) => {
            const nameA = a[0].split(' (')[0].toLowerCase();
            const nameB = b[0].split(' (')[0].toLowerCase();
            return nameA.localeCompare(nameB);
        });
        let totalTickets = 0;
        for (let key in db) if (db[key]?.tickets) totalTickets += db[key].tickets;
        let out = `🐷 *КОПИЛКА-СВИНКА* 🐷\n💰 Сумма: ${piggyBank}₽ | 🎟️ Всего мешочков: ${totalTickets}\n━━━━━━━━━━━━━━━━━━\n🏦 *БАЛАНС ВСЕХ* 🏦\n`;
        list.forEach(([n, d], i) => {
            const name = n.split(' (')[0];
            const games = d.games || 0;
            const tickets = d.tickets || 0;
            const gamesStr = games % 1 === 0 ? games : games.toFixed(1);
            out += `${i + 1}. ${name} — 🎲 ${gamesStr} | 🎟️ ${tickets} | 💰 ${d.balance}₽\n`;
        });
        await sendMessage(chatId, out);
        return;
    }
    
    if (cmd === '/гадание') {
        const signs = ['♈ Овен', '♉ Телец', '♊ Близнецы', '♋ Рак', '♌ Лев', '♍ Дева', '♎ Весы', '♏ Скорпион', '♐ Стрелец', '♑ Козерог', '♒ Водолей', '♓ Рыбы'];
        const randomSign = signs[Math.floor(Math.random() * signs.length)];
        const num1 = Math.floor(Math.random() * 20) + 1;
        const num2 = Math.floor(Math.random() * 20) + 1;
        const num3 = Math.floor(Math.random() * 20) + 1;
        await sendMessage(chatId, `🔮 *ГАДАНИЕ* 🔮\n━━━━━━━━━━━━━━━━━━\n${randomSign}: ${num1}, ${num2}, ${num3}`);
        return;
    }
    
    if (cmd === '/новости') {
        await sendMessage(chatId, `📰 *НОВОСТЬ*\n━━━━━━━━━━━━━━━━━━\n${facts[Math.floor(Math.random() * facts.length)]}`);
        return;
    }
    
    if (cmd === '/шутка') {
        await sendMessage(chatId, `😂 *ШУТКА*\n━━━━━━━━━━━━━━━━━━\n${jokes[Math.floor(Math.random() * jokes.length)]}`);
        return;
    }
    
    if (cmd === '/топ10') {
        const top = Object.entries(db).sort((a, b) => (b[1].balance || 0) - (a[1].balance || 0)).slice(0, 10);
        if (!top.length) {
            await sendMessage(chatId, '🏆 ТОП-10\nНет данных');
            return;
        }
        let out = '🏆 *ТОП-10* 🏆\n━━━━━━━━━━━━━━━━━━\n';
        top.forEach(([n, d], i) => out += `${i + 1}. ${getDisplayName(n, db)} — ${d.balance}₽\n`);
        await sendMessage(chatId, out);
        return;
    }
    
    if (cmd === '/админы') {
        await sendMessage(chatId, `👑 *АДМИНЫ* 👑\n━━━━━━━━━━━━━━━━━━\n${BOSS}\n${ADMINS.join('\n')}`);
        return;
    }

    // ===== АДМИН-КОМАНДЫ =====
    if (!isAdminUser) {
        if (cmd.startsWith('/') && !['/бот', '/баланс', '/статистика', '/банк', '/гадание', '/новости', '/шутка', '/топ10', '/админы', '/регистрация'].includes(cmd)) {
            await sendMessage(chatId, `❌ *НЕТ КОМАНДЫ*\n💡 Введи /бот`);
        }
        return;
    }

    if (cmd === '.помощь') {
        await sendMessage(chatId, `🔥 *ПАНЕЛЬ АДМИНА* 🔥
━━━━━━━━━━━━━━━━━━━━━
👥 *УПРАВЛЕНИЕ*
.участники | .поиск | .топ10 | .удалить

💰 *ФИНАНСЫ*
.средства [имя или ID] +[сумма]
.средства [имя или ID] = [сумма]

🎟️ *МЕШОЧКИ*
.мешочки [имя или ID] + [сумма]
.мешочки [имя или ID] - [сумма]
.мешочки [имя или ID] = [сумма]

🐷 *КОПИЛКА*
.копилка + [сумма]
.копилка - [сумма]
.копилка = [сумма]
.разбить

📦 *ВОССТАНОВЛЕНИЕ*
.экспорт — выгрузить все данные
.вставить [JSON] — восстановить из бэкапа

📋 *ИНФО*
.инфо [текст] — сохранить информацию
.инфо — показать свою информацию
.стереть инфо — удалить информацию`);
        return;
    }

    if (cmd === '.экспорт') {
        await exportData(chatId);
        return;
    }

    if (cmd === '.вставить' && args) {
        await importData(chatId, args);
        return;
    }

    // ===== ИНФО =====
    if (cmd === '.инфо' && args && isAdminUser) {
        group.lotInfo = group.lotInfo || {};
        group.lotInfo[sender] = args;
        groups[chatId] = group;
        await sendMessage(chatId, `✅ *ИНФОРМАЦИЯ СОХРАНЕНА*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n📝 *Текст:*\n${args}`);
        return;
    }
    
    if (cmd === '.инфо' && !args && isAdminUser) {
        const info = group.lotInfo ? group.lotInfo[sender] : null;
        if (info) {
            await sendMessage(chatId, `📋 *ВАША ИНФОРМАЦИЯ*\n━━━━━━━━━━━━━━━━━━\n${info}`);
        } else {
            await sendMessage(chatId, `ℹ️ *У ВАС НЕТ СОХРАНЕННОЙ ИНФОРМАЦИИ*\n━━━━━━━━━━━━━━━━━━\nИспользуйте: .инфо [текст]`);
        }
        return;
    }
    
    if (cmd === '.стереть инфо' && isAdminUser) {
        if (group.lotInfo) delete group.lotInfo[sender];
        groups[chatId] = group;
        await sendMessage(chatId, `🗑️ *ИНФОРМАЦИЯ УДАЛЕНА*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}`);
        return;
    }

    // ===== МЕШОЧКИ =====
    if (cmd === '.мешочки' && args && isAdminUser) {
        const parts = args.trim().split(/\s+/);
        let op = '';
        let nameOrId = '';
        let val = 0;
        if (parts.length >= 3) {
            if (parts[1] === '+' || parts[1] === '-' || parts[1] === '=') {
                nameOrId = parts[0];
                op = parts[1];
                val = parseInt(parts[2]);
            } else if (parts[0] === '+' || parts[0] === '-' || parts[0] === '=') {
                op = parts[0];
                nameOrId = parts[1];
                val = parseInt(parts[2]);
            }
        }
        if (!op || isNaN(val)) {
            await sendMessage(chatId, '❌ .мешочки [имя или ID] + [число] | .мешочки + [имя] [число] | .мешочки [имя] = [число]');
            return;
        }
        let key = getPlayerKey(nameOrId, db);
        if (!key) {
            await sendMessage(chatId, `❌ Игрок "${nameOrId}" не найден`);
            return;
        }
        let currentTickets = db[key].tickets || 0;
        let newTickets = currentTickets;
        if (op === '+') newTickets = currentTickets + val;
        else if (op === '-') newTickets = currentTickets - val;
        else if (op === '=') newTickets = val;
        if (newTickets < 0) newTickets = 0;
        db[key].tickets = newTickets;
        group.db = db;
        groups[chatId] = group;
        await sendMessage(chatId, `🎟️ *МЕШОЧКИ ИЗМЕНЕНЫ*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key, db)}\n📉 Было: ${currentTickets}\n📈 Стало: ${newTickets}`);
        return;
    }

    // ===== КОПИЛКА =====
    if (cmd === '.копилка' && args && isAdminUser) {
        const parts = args.split(/\s+/);
        const op = parts[0];
        const val = parseInt(parts[1]);
        if (isNaN(val)) {
            await sendMessage(chatId, '❌ Сумма не число');
            return;
        }
        let newPiggy = piggyBank;
        if (op === '+') newPiggy = piggyBank + val;
        else if (op === '-') newPiggy = piggyBank - val;
        else if (op === '=') newPiggy = val;
        else {
            await sendMessage(chatId, '❌ .копилка + [сумма] | .копилка - [сумма] | .копилка = [сумма]');
            return;
        }
        if (newPiggy < 0) newPiggy = 0;
        const oldPiggy = piggyBank;
        piggyBank = newPiggy;
        group.piggyBank = piggyBank;
        groups[chatId] = group;
        await sendMessage(chatId, `🐷 *КОПИЛКА ИЗМЕНЕНА*\n━━━━━━━━━━━━━━━━━━\n📉 Было: ${oldPiggy}₽\n📈 Стало: ${piggyBank}₽`);
        return;
    }

    if (cmd === '.разбить') {
        await breakPiggy(chatId);
        return;
    }

    // ===== УПРАВЛЕНИЕ ИГРОКАМИ =====
    if (cmd === '.участники') {
        const list = Object.entries(db);
        if (!list.length) {
            await sendMessage(chatId, '📭 База пуста');
            return;
        }
        list.sort((a, b) => {
            const nameA = a[0].split(' (')[0].toLowerCase();
            const nameB = b[0].split(' (')[0].toLowerCase();
            return nameA.localeCompare(nameB);
        });
        let out = '👥 *УЧАСТНИКИ*\n━━━━━━━━━━━━━━━━━━\n';
        list.forEach(([n, d], i) => {
            const name = n.split(' (')[0];
            const id = d.id || '?';
            const games = d.games || 0;
            const tickets = d.tickets || 0;
            const gamesStr = games % 1 === 0 ? games : games.toFixed(1);
            out += `${i + 1}. ${name} (${id}) — 🎲 ${gamesStr} | 🎟️ ${tickets} | 💰 ${d.balance}₽\n`;
        });
        await sendMessage(chatId, out);
        return;
    }
    
    if (cmd === '.топ10') {
        const top = Object.entries(db).sort((a, b) => (b[1].balance || 0) - (a[1].balance || 0)).slice(0, 10);
        if (!top.length) {
            await sendMessage(chatId, '📭 Нет данных');
            return;
        }
        let out = '🏆 *ТОП-10* 🏆\n━━━━━━━━━━━━━━━━━━\n';
        top.forEach(([n, d], i) => out += `${i + 1}. ${getDisplayName(n, db)} — ${d.balance}₽\n`);
        await sendMessage(chatId, out);
        return;
    }
    
    if (cmd === '.поиск' && args) {
        const key = getPlayerKey(args, db);
        if (!key) {
            await sendMessage(chatId, `❌ "${args}" не найден`);
            return;
        }
        const games = db[key]?.games || 0;
        const tickets = db[key]?.tickets || 0;
        const wins = db[key]?.wins || 0;
        const gamesStr = games % 1 === 0 ? games : games.toFixed(1);
        await sendMessage(chatId, `🔎 *РЕЗУЛЬТАТ ПОИСКА*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key, db)}\n🎲 Игр: ${gamesStr}\n🎟️ Меш.: ${tickets}\n🏆 Побед: ${wins}\n💰 Баланс: ${db[key].balance}₽`);
        return;
    }
    
    if (cmd === '.удалить' && args) {
        const key = getPlayerKey(args, db);
        if (!key) {
            await sendMessage(chatId, `❌ "${args}" не найден`);
            return;
        }
        delete db[key];
        group.db = db;
        groups[chatId] = group;
        await sendMessage(chatId, `🗑️ *УДАЛЁН*\n👤 ${args}`);
        return;
    }

    // ===== СРЕДСТВА =====
    if (cmd === '.средства' && args && args.includes('=')) {
        const parts = args.split('=');
        let nameOrId = parts[0].trim();
        let val = parseInt(parts[1].trim());
        if (isNaN(val)) {
            await sendMessage(chatId, '❌ Сумма не число');
            return;
        }
        let key = getPlayerKey(nameOrId, db);
        if (!key) {
            await sendMessage(chatId, `❌ *ИГРОК НЕ НАЙДЕН*\n━━━━━━━━━━━━━━━━━━\n👤 "${nameOrId}" отсутствует в базе участников.\n\n💡 Для регистрации игрок должен написать /регистрация`);
            return;
        }
        const old = db[key].balance || 0;
        db[key].balance = val;
        group.db = db;
        groups[chatId] = group;
        await sendMessage(chatId, `🟡 *КОРРЕКТИРОВКА БАЛАНСА*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key, db)}\n📉 Было: ${old}₽\n📈 Стало: ${db[key].balance}₽`);
        return;
    }

    if (cmd === '.средства' && args) {
        const op = args.includes('+') ? '+' : (args.includes('-') ? '-' : null);
        if (!op) {
            await sendMessage(chatId, '❌ .средства [имя или ID] +[сумма]');
            return;
        }
        const parts = args.split(op);
        let nameOrId = parts[0].trim();
        let val = parseInt(parts[1]);
        if (isNaN(val)) {
            await sendMessage(chatId, '❌ Сумма не число');
            return;
        }
        let key = getPlayerKey(nameOrId, db);
        if (!key) {
            await sendMessage(chatId, `❌ *ИГРОК НЕ НАЙДЕН*\n━━━━━━━━━━━━━━━━━━\n👤 "${nameOrId}" отсутствует в базе участников.\n\n💡 Для регистрации игрок должен написать /регистрация`);
            return;
        }
        const old = db[key].balance || 0;
        db[key].balance = op === '+' ? old + val : old - val;
        group.db = db;
        groups[chatId] = group;
        await sendMessage(chatId, `${op === '+' ? '🟢 НАЧИСЛЕНО' : '🔴 СПИСАНО'} ${getDisplayName(key, db)}: ${old} → ${db[key].balance}₽`);
        return;
    }

    // ===== ЛИЦЕНЗИИ =====
    if (cmd === '.лицензия' && args) {
        if (!isHeadquarters(groupName) && sender !== BOSS) {
            await sendMessage(chatId, `❌ *ДОСТУП ЗАПРЕЩЁН*`);
            return;
        }
        let parts = [];
        let match;
        const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
        while ((match = regex.exec(args)) !== null) {
            const part = match[1] || match[2] || match[3];
            if (part) parts.push(part);
        }
        if (parts[0] === 'список') {
            const list = Object.entries(licenses);
            if (list.length === 0) {
                await sendMessage(chatId, '📭 Нет активных лицензий');
                return;
            }
            let msg = '📜 *ЛИЦЕНЗИИ*\n━━━━━━━━━━━━━━━━━━\n';
            for (const [grp, lic] of list) {
                const expireDate = new Date(lic.expireDate);
                const daysLeft = Math.ceil((expireDate - new Date()) / (1000 * 60 * 60 * 24));
                msg += `\n📌 ${grp}\n   ⏰ Осталось: ${daysLeft} дн.\n   👤 Выдал: ${lic.addedBy}\n`;
            }
            await sendMessage(chatId, msg);
            return;
        }
        if (parts[0] === 'удалить' && parts[1]) {
            const targetChatId = parts[1].toLowerCase();
            let found = false;
            for (const [key, lic] of Object.entries(licenses)) {
                if (key.toLowerCase() === targetChatId) {
                    delete licenses[key];
                    found = true;
                    break;
                }
            }
            if (found) {
                await sendMessage(chatId, `🗑️ Лицензия для ${parts[1]} удалена`);
                await saveLicenses();
            } else {
                await sendMessage(chatId, `❌ Лицензия для ${parts[1]} не найдена`);
            }
            return;
        }
        if (parts.length >= 2) {
            const targetChatId = parts[0].toLowerCase();
            const days = parseInt(parts[1]);
            if (isNaN(days) || days <= 0) {
                await sendMessage(chatId, '❌ Укажите корректное количество дней');
                return;
            }
            const expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + days);
            licenses[targetChatId] = {
                expireDate: expireDate.toISOString(),
                plan: 'premium',
                addedBy: sender,
                addedAt: new Date().toISOString()
            };
            await sendMessage(chatId, `✅ *ЛИЦЕНЗИЯ ДОБАВЛЕНА*\n━━━━━━━━━━━━━━━━━━\n📌 Группа: ${parts[0]}\n📅 До: ${expireDate.toLocaleDateString()}\n⏰ Срок: ${days} дней`);
            try {
                await sendMessage(chatId, `🎉 *ГРУППА АКТИВИРОВАНА!*`);
            } catch(e) {}
            await saveLicenses();
            return;
        }
        await sendMessage(chatId, '❌ *ЛИЦЕНЗИЯ*\n━━━━━━━━━━━━━━━━━━\n.лицензия "название группы" дни\n.лицензия список\n.лицензия удалить "название группы"');
        return;
    }

    if (cmd === '.моя_лицензия' && isAdminUser) {
        const info = getLicenseInfo(chatId);
        if (info && info.daysLeft > 0) {
            await sendMessage(chatId, `✅ *СТАТУС ЛИЦЕНЗИИ*\n━━━━━━━━━━━━━━━━━━\n📅 Действует до: ${info.expireDate.toLocaleDateString()}\n⏰ Осталось: ${info.daysLeft} дн.\n📋 Тариф: ${info.plan}`);
        } else {
            await sendMessage(chatId, `❌ *ЛИЦЕНЗИЯ ОТСУТСТВУЕТ*\n━━━━━━━━━━━━━━━━━━\nГруппа не активирована.\nОбратитесь к администратору.`);
        }
        return;
    }
}

app.post('/webhook', async (req, res) => {
    const wh = req.body;
    console.log('📩 Вебхук');

    const groupName = wh.senderData?.chatName || '';
    const chatId = wh.senderData?.chatId;
    const sender = wh.senderData?.senderName || wh.senderData?.sender;
    const text = wh.messageData?.textMessageData?.textMessage;

    if (wh.typeWebhook === 'incomingMessageReceived' || wh.typeWebhook === 'outgoingMessageReceived') {
        if (chatId && text) await handleMessage(chatId, sender || chatId.split('@')[0], text, groupName);
    }

    res.status(200).send('OK');
});

app.get('/', (req, res) => {
    res.send('✅ Бот для WhatsApp работает!');
});

app.get('/livez', (req, res) => {
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Бот на порту ${PORT}`));
