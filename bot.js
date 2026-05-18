const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const ID_INSTANCE = process.env.ID_INSTANCE;
const API_TOKEN = process.env.API_TOKEN;
const BOSS = 'P14';
const ADMINS = ['A', 'Фаягуль', 'Галина', 'Гузель 🧿', 'Галина Дубль', 'a', '~a', '~A'];

const ALLOWED_GROUPS = ['тестовая система автоматизации', 'Колесо Фортуны, резерв'];

let db = {};
let game = { active: false, paused: false, style: 'обезьянка', slots: {}, max: 0, repeat: false };
let piggyBank = 0;
let dailyPayoutDone = false;
let smartBot = false;

let stats = {
    totalLots: 0,
    adminLots: {},
    totalGames: 0,
    reportDate: new Date()
};

// Очередь последних ставок
let lastBets = [];

const emj = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣'];

const styles = {
    обезьянка: {
        h: '🦥🦥🦥1️⃣0️⃣0️⃣0️⃣➖5️⃣0️⃣0️⃣🦥🦥🦥\n🐿️🐿️🐿️🐿️🐿️🐿️🐿️🐿️🐿️\n🪵1️⃣🪵🪵1️⃣2️⃣0️⃣0️⃣🪵\n🦥2️⃣🦥🦥8️⃣0️⃣0️⃣🦥\n🌰3️⃣🌰🌰1️⃣0️⃣0️⃣0️⃣🌰\n🐿️4️⃣🐿️🐿️3️⃣🌰🌰🌰\n🪵5️⃣🪵🪵1️⃣0️⃣0️⃣0️⃣🪵\n🦥6️⃣🦥🦥5️⃣0️⃣0️⃣🦥\n🌰🌰🌰🌰🌰🌰🌰🌰🌰\n1️⃣\n2️⃣\n3️⃣\n4️⃣\n5️⃣\n6️⃣\n7️⃣\n8️⃣\n9️⃣\n🔟',
        i: '🦥',
        price: { full: 1000, half: 500 }
    }
};

const jokes = [
    '😂 Почему игроки не любят лес? — Там много *логов*!',
    '🤣 Лот — это лотерея для оптимистов с кредиткой!',
    '😎 Админ: *Ставки сделаны?* Игрок: *Да, на победу!*',
    '🔥 Феникс сгорел... в лоте! Но возродился с деньгами!'
];
const horos = ['♈ Овен: 3,7,11', '♌ Лев: 7,14,20', '♓ Рыбы: 9,13,16', '♊ Близнецы: 1,5,9'];
const facts = ['🎲 Сегодня чаще выпадают нечётные', '🔥 70% игроков ставят на 7 и 8', '💰 Джекпот недели — 25 000₽'];

async function sendMessage(chatId, text) {
    try {
        await axios.post(`https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`, {
            chatId: chatId,
            message: text
        });
        console.log(`✅ Отправлено`);
    } catch (err) {
        console.error('❌ Ошибка отправки:', err.message);
    }
}

function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().trim();
}

function getDisplayNameNoId(playerKey) {
    if (!playerKey) return 'Неизвестно';
    return playerKey.split(' (')[0];
}

function getPlayerKey(nameOrId) {
    if (!nameOrId) return null;

    const idNum = parseInt(nameOrId);
    if (!isNaN(idNum)) {
        return Object.keys(db).find(key => db[key]?.id === idNum);
    }

    const searchName = nameOrId.toLowerCase().trim();
    let exactMatch = Object.keys(db).find(key => {
        const keyName = key.split(' (')[0].toLowerCase().trim();
        return keyName === searchName;
    });

    if (exactMatch) return exactMatch;

    const normalizedSearch = nameOrId.toLowerCase().replace(/[^a-zа-яё0-9]/g, '').trim();
    return Object.keys(db).find(key => {
        const keyName = key.split(' (')[0].toLowerCase().replace(/[^a-zа-яё0-9]/g, '').trim();
        return keyName === normalizedSearch;
    });
}

function ensurePlayer(name) {
    let key = getPlayerKey(name);
    if (!key) {
        const existingIds = Object.values(db).map(p => p.id || 0);
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 9;
        const newId = maxId + 1;

        key = `${name} (auto)`;
        db[key] = { balance: 0, games: 0, tickets: 0, wins: 0, id: newId };
    }
    return key;
}

function getDisplayName(playerKey) {
    if (!playerKey) return 'Неизвестно';
    const name = playerKey.split(' (')[0];
    const id = db[playerKey]?.id;
    if (id) return `${name} (${id})`;
    return name;
}

function isAdmin(sender) {
    if (sender === BOSS) return true;

    const normalizedSender = sender.toLowerCase().replace(/^~/, '').replace(/[^a-zа-яё0-9]/g, '').trim();

    if (ADMINS.some(admin => {
        const normalizedAdmin = admin.toLowerCase().replace(/^~/, '').replace(/[^a-zа-яё0-9]/g, '').trim();
        return normalizedAdmin === normalizedSender;
    })) return true;

    const playerKey = getPlayerKey(sender);
    if (playerKey && db[playerKey]?.isAdmin === true) return true;

    return false;
}

function addGamePlay(playerKey, value) {
    if (!db[playerKey]) return;
    if (!db[playerKey].games) db[playerKey].games = 0;
    if (!db[playerKey].tickets) db[playerKey].tickets = 0;
    db[playerKey].games += value;
    const newTickets = Math.floor(db[playerKey].games / 10) - db[playerKey].tickets;
    if (newTickets > 0) {
        db[playerKey].tickets += newTickets;
    }
}

function showPiggy(chatId) {
    let totalTickets = 0;
    for (let key in db) if (db[key]?.tickets) totalTickets += db[key].tickets;
    sendMessage(chatId, `🐷 *КОПИЛКА КАЗИНО* 🐷\n━━━━━━━━━━━━━━━━━━\n💰 Сумма: *${piggyBank}₽*\n🎟️ Мешочков: *${totalTickets}*`);
}

function breakPiggy(chatId) {
    if (dailyPayoutDone) {
        sendMessage(chatId, `⚠️ Копилка уже разбита сегодня. Завтра новая!`);
        return;
    }
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
        msg += `\n${getDisplayName(p.key)} — ${winnings}₽ (${p.tickets} меш.)`;
    }
    piggyBank = 0;
    dailyPayoutDone = true;
    msg += `\n\n━━━━━━━━━━━━━━━━━━\n🎉 ПОЗДРАВЛЯЕМ! 🎉`;
    sendMessage(chatId, msg);
}

function getFreeSlotsList() {
    const freeSlots = [];
    for (let i = 1; i <= game.max; i++) {
        const slot = game.slots[i];
        if (!slot) {
            freeSlots.push(i);
        }
    }
    return freeSlots;
}

function renderLot() {
    const s = styles[game.style];
    const p = s.price;
    const repeatText = game.repeat ? ' 🔁 *ЛОТ С ПОВТОРОМ* 🔁' : '';

    const prizes = [
        { place: 1, prize: 1000 },
        { place: 2, prize: 5000 },
        { place: 3, prize: 1000 },
        { place: 4, prize: 2500 },
        { place: 5, prize: 0 },
        { place: 6, prize: 0 }
    ];

    let res = `━━━━━━━━━━━━━━━━━━\n💰 *ЦЕНА: ${p.full}₽ / ${p.half}₽* 💰${repeatText}\n━━━━━━━━━━━━━━━━━━\n🏆 *ПРИЗЫ* 🏆\n`;
    for (let i = 0; i < 6; i++) {
        if (prizes[i].prize > 0) {
            res += `${prizes[i].place} место: ${prizes[i].prize}₽\n`;
        }
    }
    res += `━━━━━━━━━━━━━━━━━━\n`;

    for (let i = 1; i <= game.max; i++) {
        const slot = game.slots[i];
        const emoji = emj[i] || i;

        if (!slot) {
            res += `${emoji} ${s.i} 🟢\n`;
        } else if (slot.full) {
            const playerKey = getPlayerKey(slot.full);
            const displayName = playerKey ? getDisplayNameNoId(playerKey) : slot.full;
            res += `${emoji} ${displayName}\n`;
        } else {
            const leftName = slot.left ? (getPlayerKey(slot.left) ? getDisplayNameNoId(getPlayerKey(slot.left)) : slot.left) : null;
            const rightName = slot.right ? (getPlayerKey(slot.right) ? getDisplayNameNoId(getPlayerKey(slot.right)) : slot.right) : null;

            if (leftName && rightName) {
                res += `${emoji} ${leftName} / ${rightName}\n`;
            } else if (leftName) {
                res += `${emoji} ${leftName} / 🟢\n`;
            } else if (rightName) {
                res += `${emoji} 🟢 / ${rightName}\n`;
            }
        }
    }
    if (game.paused) res += `\n⏸️ *ПАУЗА* ⏸️`;
    return res;
}

async function payout(chatId, winners, adminName) {
    const s = styles[game.style];
    const p = s.price;
    
    const prizes = [
        { place: 1, prize: 1000 },
        { place: 2, prize: 5000 },
        { place: 3, prize: 1000 },
        { place: 4, prize: 2500 },
        { place: 5, prize: 0 },
        { place: 6, prize: 0 }
    ];

    let msg = `🏆 *ВЫПЛАТА ПОБЕДИТЕЛЯМ* 🏆\n━━━━━━━━━━━━━━━━━━\n`;
    let total = 0;

    for (let idx = 0; idx < Math.min(winners.length, 6); idx++) {
        const num = winners[idx];
        const slot = game.slots[num];
        if (!slot) continue;

        let prizeMoney = prizes[idx].prize;
        if (prizeMoney === 0) continue;

        if (!slot.full && (slot.left || slot.right)) {
            prizeMoney = Math.floor(prizeMoney / 2);
        }

        if (slot.full) {
            const playerKey = getPlayerKey(slot.full);
            if (playerKey) {
                db[playerKey].balance += prizeMoney;
                msg += `\n${idx + 1}️⃣ ${getDisplayNameNoId(playerKey)} → +${prizeMoney}₽`;
                total += prizeMoney;
                addGamePlay(playerKey, 1);
                if (!db[playerKey].wins) db[playerKey].wins = 0;
                db[playerKey].wins++;
                stats.totalGames += 1;
            }
        } else {
            if (slot.left) {
                const playerKey = getPlayerKey(slot.left);
                if (playerKey) {
                    db[playerKey].balance += prizeMoney;
                    msg += `\n${idx + 1}️⃣ ${getDisplayNameNoId(playerKey)} → +${prizeMoney}₽ (левая)`;
                    total += prizeMoney;
                    addGamePlay(playerKey, 0.5);
                    if (!db[playerKey].wins) db[playerKey].wins = 0;
                    db[playerKey].wins++;
                    stats.totalGames += 0.5;
                }
            }
            if (slot.right) {
                const playerKey = getPlayerKey(slot.right);
                if (playerKey) {
                    db[playerKey].balance += prizeMoney;
                    msg += `\n${idx + 1}️⃣ ${getDisplayNameNoId(playerKey)} → +${prizeMoney}₽ (правая)`;
                    total += prizeMoney;
                    addGamePlay(playerKey, 0.5);
                    if (!db[playerKey].wins) db[playerKey].wins = 0;
                    db[playerKey].wins++;
                    stats.totalGames += 0.5;
                }
            }
        }
    }

    msg += `\n\n━━━━━━━━━━━━━━━━━━\n💰 *ОБЩИЙ ВЫИГРЫШ:* ${total}₽\n🎉 *ПОЗДРАВЛЯЕМ ПОБЕДИТЕЛЕЙ!* 🎉`;
    await sendMessage(chatId, msg);

    piggyBank += 500;
    stats.totalLots++;
    if (!stats.adminLots) stats.adminLots = {};
    stats.adminLots[adminName] = (stats.adminLots[adminName] || 0) + 1;
    game.active = false;
    game.paused = false;
    game.slots = {};
    lastBets = [];
}

async function generateReport(chatId) {
    const list = Object.entries(db);
    let memberReport = '👥 *ОТЧЕТ: УЧАСТНИКИ* 👥\n━━━━━━━━━━━━━━━━━━\n';
    if (list.length === 0) {
        memberReport += 'Нет участников\n';
    } else {
        list.forEach(([n, d], i) => {
            const name = n.split(' (')[0];
            const id = d.id || '?';
            const games = d.games || 0;
            const tickets = d.tickets || 0;
            memberReport += `${i + 1}. ${name} (${id})\n   🎲 Игр: ${games} | 🎟️ Меш.: ${tickets} | 💰 ${d.balance}₽\n`;
        });
    }
    await sendMessage(chatId, memberReport);

    let totalBalance = 0;
    for (let key in db) totalBalance += db[key].balance || 0;

    const adminLots = stats.adminLots || {};
    let adminStats = '';
    for (let [admin, count] of Object.entries(adminLots)) {
        adminStats += `\n👑 ${admin} — ${count} лот(ов)`;
    }
    if (!adminStats) adminStats = '\nНет данных';

    const generalReport = `📊 *ОТЧЕТ: ОБЩАЯ СТАТИСТИКА* 📊
━━━━━━━━━━━━━━━━━━
📅 *Период:* ${stats.reportDate?.toLocaleString() || 'неизвестно'} — сейчас
━━━━━━━━━━━━━━━━━━
🎲 *Всего лотов:* ${stats.totalLots || 0}
🎯 *Сыграно игр:* ${(stats.totalGames || 0).toFixed(1)}
💰 *Общий баланс игроков:* ${totalBalance}₽
🐷 *Копилка:* ${piggyBank}₽
━━━━━━━━━━━━━━━━━━
👑 *ЛОТЫ ПО АДМИНАМ:*${adminStats}
━━━━━━━━━━━━━━━━━━
📌 *Следующий отчёт начнёт новый период*`;

    await sendMessage(chatId, generalReport);

    stats = {
        totalLots: 0,
        adminLots: {},
        totalGames: 0,
        reportDate: new Date()
    };
}

async function exportData(chatId) {
    const exportObj = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        db: db,
        game: { active: game.active, paused: game.paused, style: game.style, slots: game.slots, max: game.max, repeat: game.repeat },
        piggyBank: piggyBank,
        dailyPayoutDone: dailyPayoutDone,
        smartBot: smartBot,
        stats: stats
    };
    const jsonStr = JSON.stringify(exportObj);
    await sendMessage(chatId, `📦 *ЭКСПОРТ ДАННЫХ*\n━━━━━━━━━━━━━━━━━━\nДля восстановления используй команду:\n.вставить [JSON]\n\nДанные:\n${jsonStr}`);
}

async function importData(chatId, jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        if (!data.db) {
            await sendMessage(chatId, `❌ *ОШИБКА*: неверный формат JSON`);
            return;
        }

        db = data.db;
        game = {
            active: data.game?.active || false,
            paused: data.game?.paused || false,
            style: data.game?.style || 'обезьянка',
            slots: data.game?.slots || {},
            max: data.game?.max || 0,
            repeat: data.game?.repeat || false
        };
        piggyBank = data.piggyBank || 0;
        dailyPayoutDone = data.dailyPayoutDone || false;
        smartBot = data.smartBot || false;
        stats = data.stats || { totalLots: 0, adminLots: {}, totalGames: 0, reportDate: new Date() };

        await sendMessage(chatId, `✅ *ИМПОРТ ВЫПОЛНЕН*\n━━━━━━━━━━━━━━━━━━\n📅 Версия: ${data.version || '1.0'}\n🕒 От: ${data.timestamp || 'неизвестно'}\n👥 Игроков: ${Object.keys(db).length}\n🐷 Копилка: ${piggyBank}₽`);

        console.log(`✅ Импорт данных выполнен боссом ${BOSS}`);
    } catch (err) {
        await sendMessage(chatId, `❌ *ОШИБКА ИМПОРТА*\n━━━━━━━━━━━━━━━━━━\n${err.message}\n\nПроверь правильность JSON.`);
    }
}

async function handleMessage(chatId, sender, text, groupName) {
    let rawCmd = text.trim().toLowerCase();
    let cmd = rawCmd;
    let args = '';
    const spaceIdx = rawCmd.indexOf(' ');
    if (spaceIdx !== -1) {
        cmd = rawCmd.substring(0, spaceIdx).trim();
        args = rawCmd.substring(spaceIdx + 1).trim();
    }

    const isAdminUser = isAdmin(sender);
    const playerExists = getPlayerKey(sender) !== null;

    // ===== ПРОВЕРКА РЕГИСТРАЦИИ ДЛЯ ПУБЛИЧНЫХ КОМАНД =====
    if (!playerExists && cmd.startsWith('/') && cmd !== '/регистрация') {
        await sendMessage(chatId, `❌ *ДОСТУП ЗАПРЕЩЁН* ❌
━━━━━━━━━━━━━━━━━━
👤 ${sender}, вы не зарегистрированы в системе казино.

✅ Для регистрации напишите:
/регистрация

После регистрации вам станут доступны все команды:
/баланс, /статистика, /гадание и другие.

💡 Регистрация бесплатна!`);
        return;
    }

    // Если игрок не зарегистрирован и пишет обычное сообщение (не команду)
    if (!playerExists && !cmd.startsWith('/') && !cmd.startsWith('.') && cmd.length > 1) {
        await sendMessage(chatId, `👋 *Здравствуйте, ${sender}!* 👋
━━━━━━━━━━━━━━━━━━
Вы не зарегистрированы в системе казино.

✅ Для регистрации напишите:
/регистрация

После регистрации вам станут доступны:
💰 /баланс — узнать баланс
📊 /статистика — свою статистику
🔮 /гадание — счастливые числа
📰 /новости — свежие факты
😂 /шутка — поднять настроение
🏆 /топ10 — богатейшие игроки

💡 Регистрация бесплатна!`);
        return;
    }

    // ===== РЕГИСТРАЦИЯ =====
    if (cmd === '/регистрация') {
        const existingKey = getPlayerKey(sender);
        if (existingKey) {
            await sendMessage(chatId, `✅ *ВЫ УЖЕ ЗАРЕГИСТРИРОВАНЫ*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(existingKey)}\n💰 Баланс: ${db[existingKey]?.balance || 0}₽`);
            return;
        }

        const existingIds = Object.values(db).map(p => p.id || 0);
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 9;
        const newId = maxId + 1;

        const newKey = `${sender} (auto)`;
        db[newKey] = { balance: 0, games: 0, tickets: 0, wins: 0, id: newId };
        await sendMessage(chatId, `✅ *РЕГИСТРАЦИЯ ПРОШЛА УСПЕШНО!* ✅
━━━━━━━━━━━━━━━━━━
👤 *Игрок:* ${sender}
🆔 *ID:* ${newId}
💰 *Баланс:* 0₽

💡 Для пополнения баланса обратитесь к админу.
🎮 Доступные команды: /бот`);
        return;
    }

    // ===== ПУБЛИЧНЫЕ КОМАНДЫ =====
    if (cmd === '/бот') {
        await sendMessage(chatId, `🤖 *МЕНЮ ИГРОКА*\n━━━━━━━━━━━━━━━━━━\n/баланс 💰\n/статистика 📊\n/банк 🏦\n/гадание 🔮\n/новости 📰\n/шутка 😂\n/топ10 🏆\n/админы 👑`);
        return;
    }
    if (cmd === '/баланс') {
        const playerKey = getPlayerKey(sender);
        if (!playerKey) {
            await sendMessage(chatId, `💰 *БАЛАНС*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n💎 0₽\n\n💡 Вы не зарегистрированы. Напишите /регистрация`);
            return;
        }
        await sendMessage(chatId, `💰 *БАЛАНС*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(playerKey)}\n💎 ${db[playerKey]?.balance || 0}₽`);
        return;
    }
    if (cmd === '/статистика') {
        const playerKey = getPlayerKey(sender);
        if (!playerKey) {
            await sendMessage(chatId, `📊 *СТАТИСТИКА*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n🎲 Игр: 0\n🎟️ Меш.: 0\n🏆 Побед: 0\n💰 Баланс: 0₽\n\n💡 Вы не зарегистрированы. Напишите /регистрация`);
            return;
        }
        const g = db[playerKey]?.games || 0;
        const t = db[playerKey]?.tickets || 0;
        const w = db[playerKey]?.wins || 0;
        await sendMessage(chatId, `📊 *СТАТИСТИКА*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(playerKey)}\n🎲 Игр: ${g}\n🎟️ Меш.: ${t}\n🏆 Побед: ${w}\n💰 Баланс: ${db[playerKey]?.balance || 0}₽`);
        return;
    }
    if (cmd === '/банк') {
        const list = Object.entries(db);
        if (!list.length) {
            await sendMessage(chatId, '📭 База пуста');
            return;
        }
        let out = '🏦 *БАЛАНС ВСЕХ* 🏦\n━━━━━━━━━━━━━━━━━━\n';
        list.forEach(([n, d], i) => {
            const name = n.split(' (')[0];
            out += `${i + 1}. ${name} — ${d.balance}₽\n`;
        });
        await sendMessage(chatId, out);
        return;
    }
    if (cmd === '/гадание') {
        await sendMessage(chatId, `🔮 *ГАДАНИЕ*\n━━━━━━━━━━━━━━━━━━\n${horos[Math.floor(Math.random() * horos.length)]}`);
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
        top.forEach(([n, d], i) => out += `${i + 1}. ${getDisplayName(n)} — ${d.balance}₽\n`);
        await sendMessage(chatId, out);
        return;
    }
    if (cmd === '/админы') {
        await sendMessage(chatId, `👑 *АДМИНЫ* 👑\n━━━━━━━━━━━━━━━━━━\n${BOSS}\n${ADMINS.join('\n')}`);
        return;
    }

    // ===== СТАВКИ =====
    if (game.active && !game.paused && /^[\d,\/\\]+$/.test(cmd)) {
        const playerKey = getPlayerKey(sender);
        if (!playerKey) {
            await sendMessage(chatId, `❌ Игрок "${sender}" не зарегистрирован. Напишите /регистрация`);
            return;
        }

        const bets = cmd.split(',').map(b => b.trim());
        let totalCost = 0;
        const validBets = [];
        const errors = [];
        const p = styles[game.style].price;

        for (const bet of bets) {
            let num = parseInt(bet);
            let type = 'full';
            if (bet.endsWith('/')) {
                type = 'half';
                num = parseInt(bet.slice(0, -1));
            }
            if (bet.endsWith('\\')) {
                type = 'half';
                num = parseInt(bet.slice(0, -1));
            }
            if (isNaN(num) || num < 1 || num > game.max) {
                errors.push(`❌ "${bet}" неверный номер`);
                continue;
            }
            const need = type === 'full' ? p.full : p.half;
            const slot = game.slots[num] || {};
            if (type === 'full' && (slot.full || slot.left || slot.right)) {
                errors.push(`❌ Номер ${num} уже занят`);
                continue;
            }
            if (type === 'half' && slot.full) {
                errors.push(`❌ Номер ${num} уже занят целиком`);
                continue;
            }
            if (type === 'half' && slot.left && slot.right) {
                errors.push(`❌ Номер ${num} полностью занят`);
                continue;
            }
            validBets.push({ num, type, need });
            totalCost += need;
        }

        if (errors.length) {
            await sendMessage(chatId, `❌ *ОШИБКИ*\n${errors.join('\n')}`);
            return;
        }

        db[playerKey].balance = (db[playerKey].balance || 0) - totalCost;

        for (const bet of validBets) {
            if (!game.slots[bet.num]) game.slots[bet.num] = {};
            if (bet.type === 'full') game.slots[bet.num].full = sender;
            else if (bet.type === 'half') {
                if (!game.slots[bet.num].left) game.slots[bet.num].left = sender;
                else if (!game.slots[bet.num].right) game.slots[bet.num].right = sender;
            }
        }

        // Добавляем в очередь последних ставок
        for (const bet of validBets) {
            const displayName = getDisplayNameNoId(playerKey);
            const betSymbol = bet.type === 'full' ? '' : (bet.type === 'half' ? '/' : '\\');
            lastBets.unshift(`${displayName} ➜ ${bet.num}${betSymbol}`);
        }
        lastBets = lastBets.slice(0, 3);

        // Отправляем подтверждение
        let confirmMsg = `👌 *СТАВКА ПРИНЯТА!*\n━━━━━━━━━━━━━━━━━━\n`;
        for (const bet of validBets) {
            const price = bet.type === 'full' ? p.full : p.half;
            confirmMsg += `🎲 Номер ${bet.num}${bet.type === 'half' ? '/' : ''} — ${price}₽\n`;
        }
        confirmMsg += `\n💰 Новый баланс: ${db[playerKey].balance}₽`;

        // Добавляем очередь последних ставок
        if (lastBets.length > 0) {
            confirmMsg += `\n━━━━━━━━━━━━━━━━━━\n📋 *ПОСЛЕДНИЕ СТАВКИ:*\n`;
            for (let i = 0; i < lastBets.length; i++) {
                confirmMsg += `${i + 1}. ${lastBets[i]}\n`;
            }
        }

        // Показываем свободные номера
        const freeSlots = getFreeSlotsList();
        if (freeSlots.length > 0) {
            const freeDisplay = freeSlots.slice(0, 10).join(', ') + (freeSlots.length > 10 ? '...' : '');
            confirmMsg += `\n━━━━━━━━━━━━━━━━━━\n🟢 *СВОБОДНЫЕ НОМЕРА:* ${freeDisplay}`;
        }

        await sendMessage(chatId, confirmMsg);

        let anySlotAvailable = false;
        for (let i = 1; i <= game.max; i++) {
            const s = game.slots[i];
            if (!s) {
                anySlotAvailable = true;
                break;
            } else if (!s.full) {
                if (!s.left || !s.right) {
                    anySlotAvailable = true;
                    break;
                }
            }
        }
        if (!anySlotAvailable) {
            game.paused = true;
            await sendMessage(chatId, `⏸️ *ЛОТ ЗАПОЛНЕН!* ⏸️\n━━━━━━━━━━━━━━━━━━\nВсе номера заняты. Админ может объявить победителей:\n.победители [номера]`);
        }

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
        await sendMessage(chatId, `🔥 *TITAN CASINO* 🔥
━━━━━━━━━━━━━━━━━━━━━
👥 *УПРАВЛЕНИЕ*
.участники | .поиск | .топ10 | .удалить

💰 *ФИНАНСЫ*
.средства [имя или ID] +[сумма]
.средства [имя или ID] -[сумма]
.средства = [имя или ID] [сумма]

💳 *ДОЛГИ*
.принять [имя или ID]
.отказ [имя или ID]

🎲 *ЛОТ*
.начать [стиль] [повтор]
.список | .пауза лот
.победители [1 2 3 4 5 6]

🐷 *КОПИЛКА*
.копилка | .разбить

🤖 *УМНЫЙ БОТ*
.умныйбот + | .умныйбот -

📊 *ОТЧЁТ*
.отчёт — полная статистика

📦 *БЭКАП*
.экспорт — выгрузить все данные
.вставить [JSON] — восстановить из бэкапа`);
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

    if (cmd === '.принять' && args) {
        const key = getPlayerKey(args);
        if (!key) {
            await sendMessage(chatId, `❌ Игрок "${args}" не найден`);
            return;
        }
        const current = db[key].balance || 0;
        if (current >= 0) {
            await sendMessage(chatId, `ℹ️ У ${getDisplayName(key)} нет долга (баланс: ${current}₽)`);
            return;
        }
        db[key].balance = 0;
        await sendMessage(chatId, `✅ *ОПЛАТА ПРИНЯТА*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key)}\n📉 Долг был: ${current}₽\n📈 Баланс обнулён`);
        return;
    }

    if (cmd === '.админ' && args && sender === BOSS) {
        const key = getPlayerKey(args);
        if (!key) {
            await sendMessage(chatId, `❌ Игрок "${args}" не найден`);
            return;
        }
        db[key].isAdmin = true;
        await sendMessage(chatId, `✅ *АДМИН НАЗНАЧЕН*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key)}\nТеперь может использовать команды с точкой.`);
        return;
    }

    if (cmd === '.убрать админ' && args && sender === BOSS) {
        const key = getPlayerKey(args);
        if (!key) {
            await sendMessage(chatId, `❌ Игрок "${args}" не найден`);
            return;
        }
        db[key].isAdmin = false;
        await sendMessage(chatId, `🗑️ *АДМИН УБРАН*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key)}`);
        return;
    }

    if (cmd === '.отказ' && args) {
        const key = getPlayerKey(args);
        if (!key) {
            await sendMessage(chatId, `❌ Игрок "${args}" не найден`);
            return;
        }
        const current = db[key].balance || 0;
        if (current >= 0) {
            await sendMessage(chatId, `ℹ️ У ${getDisplayName(key)} нет долга (баланс: ${current}₽)`);
            return;
        }
        db[key].balance = 0;
        await sendMessage(chatId, `⛔ *ДОЛГ СПИСАН*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key)}\n📉 Долг: ${current}₽ → 0₽`);
        return;
    }

    if (cmd === '.средства' && args && args.includes('=')) {
        const parts = args.split('=');
        let nameOrId = parts[0].trim();
        let val = parseInt(parts[1].trim());
        if (isNaN(val)) {
            await sendMessage(chatId, '❌ Сумма не число');
            return;
        }

        let key = getPlayerKey(nameOrId);
        if (!key) {
            await sendMessage(chatId, `❌ *ИГРОК НЕ НАЙДЕН*\n━━━━━━━━━━━━━━━━━━\n👤 "${nameOrId}" отсутствует в базе участников.\n\n💡 Для регистрации игрок должен написать /регистрация`);
            return;
        }

        const old = db[key].balance || 0;
        db[key].balance = val;
        await sendMessage(chatId, `🟡 *КОРРЕКТИРОВКА БАЛАНСА*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key)}\n📉 Было: ${old}₽\n📈 Стало: ${db[key].balance}₽`);
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

        let key = getPlayerKey(nameOrId);
        if (!key) {
            await sendMessage(chatId, `❌ *ИГРОК НЕ НАЙДЕН*\n━━━━━━━━━━━━━━━━━━\n👤 "${nameOrId}" отсутствует в базе участников.\n\n💡 Для регистрации игрок должен написать /регистрация`);
            return;
        }

        const old = db[key].balance || 0;
        db[key].balance = op === '+' ? old + val : old - val;
        await sendMessage(chatId, `${op === '+' ? '🟢 НАЧИСЛЕНО' : '🔴 СПИСАНО'} ${getDisplayName(key)}: ${old} → ${db[key].balance}₽`);
        return;
    }

    if (cmd === '.отчёт') {
        await generateReport(chatId);
        await sendMessage(chatId, `📋 *ОТЧЁТ СФОРМИРОВАН*\n━━━━━━━━━━━━━━━━━━\nНовый период начат.`);
        return;
    }

    if (cmd === '.умныйбот +') {
        smartBot = true;
        await sendMessage(chatId, '🧠 *УМНЫЙ БОТ ВКЛЮЧЁН*');
        return;
    }
    if (cmd === '.умныйбот -') {
        smartBot = false;
        await sendMessage(chatId, '💤 *УМНЫЙ БОТ ВЫКЛЮЧЁН*');
        return;
    }
    if (cmd === '.копилка') {
        showPiggy(chatId);
        return;
    }
    if (cmd === '.разбить') {
        breakPiggy(chatId);
        return;
    }
    if (cmd === '.участники') {
        const list = Object.entries(db);
        if (!list.length) {
            await sendMessage(chatId, '📭 База пуста');
            return;
        }
        let out = '👥 *УЧАСТНИКИ*\n━━━━━━━━━━━━━━━━━━\n';
        list.forEach(([n, d], i) => {
            const name = n.split(' (')[0];
            const id = d.id || '?';
            out += `${i + 1}. ${name} (${id}) — ${d.balance}₽\n`;
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
        top.forEach(([n, d], i) => out += `${i + 1}. ${getDisplayName(n)} — ${d.balance}₽\n`);
        await sendMessage(chatId, out);
        return;
    }
    if (cmd === '.поиск' && args) {
        const key = getPlayerKey(args);
        if (!key) {
            await sendMessage(chatId, `❌ "${args}" не найден`);
            return;
        }
        await sendMessage(chatId, `🔎 *РЕЗУЛЬТАТ*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key)}\n💰 ${db[key].balance}₽`);
        return;
    }
    if (cmd === '.удалить' && args) {
        const key = getPlayerKey(args);
        if (!key) {
            await sendMessage(chatId, `❌ "${args}" не найден`);
            return;
        }
        delete db[key];
        await sendMessage(chatId, `🗑️ *УДАЛЁН*\n👤 ${args}`);
        return;
    }
    if (cmd === '.начать' && args) {
        const parts = args.trim().toLowerCase().split(/\s+/);
        const styleName = parts[0];
        const isRepeat = parts[1] === 'повтор';
        
        if (styles[styleName]) {
            const maxNumbers = styleName === 'обезьянка' ? 12 : 10;
            game = { 
                active: true, 
                paused: false, 
                style: styleName, 
                max: maxNumbers, 
                slots: {},
                repeat: isRepeat
            };
            lastBets = [];
            await sendMessage(chatId, renderLot());
        } else {
            await sendMessage(chatId, `❌ *ОШИБКА*\n━━━━━━━━━━━━━━━━━━\nСтиль "${styleName}" не найден.\nДоступные стили: ${Object.keys(styles).join(', ')}`);
        }
        return;
    }
    if (cmd === '.список') {
        if (game.active) await sendMessage(chatId, renderLot());
        else await sendMessage(chatId, '❌ Нет активного лота');
        return;
    }
    if (cmd === '.пауза лот') {
        if (game.active) {
            game.paused = true;
            await sendMessage(chatId, `⏸️ *ЛОТ НА ПАУЗЕ*\n\n${renderLot()}`);
        } else {
            await sendMessage(chatId, '❌ Нет лота');
        }
        return;
    }
    if (cmd === '.победители' && args && game.paused) {
        const wins = args.match(/\d+/g);
        if (wins && wins.length) {
            const missing = wins.filter(n => !game.slots[n] || (!game.slots[n].full && !game.slots[n].left && !game.slots[n].right));
            if (missing.length > 0) {
                await sendMessage(chatId, `❌ *ОШИБКА*: номера ${missing.join(', ')} не имеют ставок!`);
                return;
            }
            await payout(chatId, wins, sender);
        } else {
            await sendMessage(chatId, '❌ .победители 12 8 3 5 2 7');
        }
        return;
    }

    if (smartBot && !cmd.startsWith('.') && !cmd.startsWith('/') && cmd.length > 1) {
        const replies = ['🎲 Удачи!', '🔥 Ставки?', '💰 Фарта!', '🍀 Сегодня твой день!'];
        await sendMessage(chatId, replies[Math.floor(Math.random() * replies.length)]);
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

    const isGroup = chatId && chatId.includes('@g.us');
    if (isGroup && groupName && ALLOWED_GROUPS.length && !ALLOWED_GROUPS.includes(groupName)) {
        console.log(`⛔ Группа "${groupName}" не в списке`);
        res.status(200).send('OK');
        return;
    }

    if (wh.typeWebhook === 'incomingMessageReceived' || wh.typeWebhook === 'outgoingMessageReceived') {
        if (chatId && text) await handleMessage(chatId, sender || chatId.split('@')[0], text, groupName);
    }

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Бот на порту ${PORT}`));
