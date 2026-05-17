const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const ID_INSTANCE = process.env.ID_INSTANCE;
const API_TOKEN = process.env.API_TOKEN;
const BOSS = 'P14';
const ADMINS = ['A', 'Фаягуль', 'Галина', 'Гузель 🧿', 'Галина Дубль'];

const ALLOWED_GROUPS = ['тестовая система автоматизации','Колесо Фортуны, резерв'];

let db = {};
let game = { active: false, paused: false, style: 'феникс', slots: {}, max: 0 };
let piggyBank = 0;
let dailyPayoutDone = false;
let smartBot = false;

let stats = {
    totalLots: 0,
    adminLots: {},
    totalGames: 0,
    reportDate: new Date()
};

const emj = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

const prices = {
    феникс: { full: 2000, half: 1000 },
    роман: { full: 1500, half: 750 },
    париж: { full: 2500, half: 1250 },
    сказочный: { full: 1800, half: 900 },
    джульетта: { full: 2200, half: 1100 },
    'лунная гладь': { full: 3000, half: 1500 },
    'драгон лор': { full: 5000, half: 2500 },
    дримленд: { full: 1700, half: 850 },
    'кисло-сладкий': { full: 1900, half: 950 },
    'удачный гном': { full: 1300, half: 650 },
    серьезный: { full: 4000, half: 2000 }
};

const styles = {
    феникс: { h: '🔥🐦‍🔥 *ФЕНИКС* 🐦‍🔥🔥\n💎 ЦЕНА: 2000₽ / 1000₽ 💎', i: '🔥' },
    роман: { h: '🌹💖 *РОМАН* 💖🌹\n💎 ЦЕНА: 1500₽ / 750₽ 💎', i: '💖' },
    париж: { h: '🗼🥐 *ПАРИЖ* 🥐🗼\n💎 ЦЕНА: 2500₽ / 1250₽ 💎', i: '🗼' },
    сказочный: { h: '🧚‍♀️✨ *СКАЗОЧНЫЙ* ✨🧚‍♂️\n💎 ЦЕНА: 1800₽ / 900₽ 💎', i: '✨' },
    джульетта: { h: '💋🌙 *ДЖУЛЬЕТТА* 🌙💋\n💎 ЦЕНА: 2200₽ / 1100₽ 💎', i: '💋' },
    'лунная гладь': { h: '🌕🌊 *ЛУННАЯ ГЛАДЬ* 🌊🌕\n💎 ЦЕНА: 3000₽ / 1500₽ 💎', i: '🌕' },
    'драгон лор': { h: '🐉👑 *ДРАГОН ЛОР* 👑🐉\n💎 ЦЕНА: 5000₽ / 2500₽ 💎', i: '🐉' },
    дримленд: { h: '☁️🌈 *ДРИМЛЕНД* 🌈☁️\n💎 ЦЕНА: 1700₽ / 850₽ 💎', i: '🌈' },
    'кисло-сладкий': { h: '🍋🍬 *КИСЛО-СЛАДКИЙ* 🍬🍋\n💎 ЦЕНА: 1900₽ / 950₽ 💎', i: '🍬' },
    'удачный гном': { h: '🍀🧙 *УДАЧНЫЙ ГНОМ* 🧙🍀\n💎 ЦЕНА: 1300₽ / 650₽ 💎', i: '🍀' },
    серьезный: { h: '🎩💼 *СЕРЬЕЗНЫЙ* 💼🎩\n💎 ЦЕНА: 4000₽ / 2000₽ 💎', i: '🎩' }
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

function getPlayerKey(name) {
    if (!name) return null;
    // Точное сравнение имени (как в базе)
    return Object.keys(db).find(key => key.split(' (')[0] === name);
}

function getDisplayName(playerKey) {
    if (!playerKey) return 'Неизвестно';
    return playerKey.split(' (')[0];
}

function isAdmin(sender) {
    if (sender === BOSS) return true;
    if (ADMINS.includes(sender)) return true;
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

function renderLot() {
    const s = styles[game.style];
    const p = prices[game.style];
    
    const prizes = [
        { place: 1, mult: 3 },
        { place: 2, mult: 2 },
        { place: 3, mult: 1.5 },
        { place: 4, mult: 1 },
        { place: 5, mult: 0.8 },
        { place: 6, mult: 0.5 }
    ];
    
    let res = `${s.h}\n━━━━━━━━━━━━━━━━━━\n🏆 *ПРИЗЫ* 🏆\n`;
    for (let i = 0; i < 6; i++) {
        const prize = Math.floor(p.full * prizes[i].mult);
        res += `${prizes[i].place} место: ${prize}₽ (x${prizes[i].mult})\n`;
    }
    res += `━━━━━━━━━━━━━━━━━━\n`;
    
    for (let i = 1; i <= game.max; i++) {
        const slot = game.slots[i];
        if (!slot) res += `${emj[i] || i} ${s.i} 🆓\n`;
        else if (slot.full) {
            res += `${emj[i] || i} ${s.i} 👑 *${slot.full}*\n`;
        } else {
            const leftName = slot.left ? slot.left : '🆓';
            const rightName = slot.right ? slot.right : '🆓';
            res += `${emj[i] || i} ${s.i} ⬅️ ${leftName} | ➡️ ${rightName}\n`;
        }
    }
    if (game.paused) res += `\n⏸️ *ПАУЗА* ⏸️`;
    return res;
}

async function payout(chatId, winners, adminName) {
    const p = prices[game.style];
    const prizes = [
        { place: 1, mult: 3 },
        { place: 2, mult: 2 },
        { place: 3, mult: 1.5 },
        { place: 4, mult: 1 },
        { place: 5, mult: 0.8 },
        { place: 6, mult: 0.5 }
    ];
    
    let msg = `🏆 *ВЫПЛАТА ПОБЕДИТЕЛЯМ* 🏆\n━━━━━━━━━━━━━━━━━━\n`;
    let total = 0;
    
    for (let idx = 0; idx < Math.min(winners.length, 6); idx++) {
        const num = winners[idx];
        const slot = game.slots[num];
        if (!slot) continue;
        
        const prizeMoney = Math.floor(p.full * prizes[idx].mult);
        
        if (slot.full) {
            const playerKey = getPlayerKey(slot.full);
            if (playerKey) {
                db[playerKey].balance += prizeMoney;
                msg += `\n${idx+1}️⃣ ${slot.full} → +${prizeMoney}₽ (x${prizes[idx].mult})`;
                total += prizeMoney;
                addGamePlay(playerKey, 1);
                if (!db[playerKey].wins) db[playerKey].wins = 0;
                db[playerKey].wins++;
                stats.totalGames += 1;
            } else {
                msg += `\n${idx+1}️⃣ ${slot.full} → +${prizeMoney}₽ (x${prizes[idx].mult}) (игрок не найден в базе!)`;
            }
        } else {
            if (slot.left) {
                const playerKey = getPlayerKey(slot.left);
                if (playerKey) {
                    db[playerKey].balance += prizeMoney;
                    msg += `\n${idx+1}️⃣ ${slot.left} → +${prizeMoney}₽ (левая x${prizes[idx].mult})`;
                    total += prizeMoney;
                    addGamePlay(playerKey, 0.5);
                    if (!db[playerKey].wins) db[playerKey].wins = 0;
                    db[playerKey].wins++;
                    stats.totalGames += 0.5;
                } else {
                    msg += `\n${idx+1}️⃣ ${slot.left} → +${prizeMoney}₽ (левая x${prizes[idx].mult}) (игрок не найден в базе!)`;
                }
            }
            if (slot.right) {
                const playerKey = getPlayerKey(slot.right);
                if (playerKey) {
                    db[playerKey].balance += prizeMoney;
                    msg += `\n${idx+1}️⃣ ${slot.right} → +${prizeMoney}₽ (правая x${prizes[idx].mult})`;
                    total += prizeMoney;
                    addGamePlay(playerKey, 0.5);
                    if (!db[playerKey].wins) db[playerKey].wins = 0;
                    db[playerKey].wins++;
                    stats.totalGames += 0.5;
                } else {
                    msg += `\n${idx+1}️⃣ ${slot.right} → +${prizeMoney}₽ (правая x${prizes[idx].mult}) (игрок не найден в базе!)`;
                }
            }
        }
    }
    
    msg += `\n\n━━━━━━━━━━━━━━━━━━\n💰 *ОБЩИЙ ВЫИГРЫШ:* ${total}₽\n🎉 *ПОЗДРАВЛЯЕМ ПОБЕДИТЕЛЕЙ!* 🎉`;
    await sendMessage(chatId, msg);
    
    piggyBank += 500;
    stats.totalLots++;
    stats.adminLots[adminName] = (stats.adminLots[adminName] || 0) + 1;
    game.active = false;
    game.paused = false;
    game.slots = {};
}

async function generateReport(chatId) {
    const list = Object.entries(db);
    let memberReport = '👥 *ОТЧЕТ: УЧАСТНИКИ* 👥\n━━━━━━━━━━━━━━━━━━\n';
    if (list.length === 0) {
        memberReport += 'Нет участников\n';
    } else {
        list.forEach(([n, d], i) => {
            const name = getDisplayName(n);
            const games = d.games || 0;
            const tickets = d.tickets || 0;
            memberReport += `${i+1}. ${name}\n   🎲 Игр: ${games} | 🎟️ Меш.: ${tickets} | 💰 ${d.balance}₽\n`;
        });
    }
    await sendMessage(chatId, memberReport);
    
    let totalBalance = 0;
    for (let key in db) totalBalance += db[key].balance || 0;
    
    let adminStats = '';
    for (let [admin, count] of Object.entries(stats.adminLots)) {
        adminStats += `\n👑 ${admin} — ${count} лот(ов)`;
    }
    if (!adminStats) adminStats = '\nНет данных';
    
    const generalReport = `📊 *ОТЧЕТ: ОБЩАЯ СТАТИСТИКА* 📊
━━━━━━━━━━━━━━━━━━
📅 *Период:* ${stats.reportDate.toLocaleString()} — сейчас
━━━━━━━━━━━━━━━━━━
🎲 *Всего лотов:* ${stats.totalLots}
🎯 *Сыграно игр:* ${stats.totalGames.toFixed(1)}
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
    
    // ===== ПУБЛИЧНЫЕ КОМАНДЫ =====
    if (cmd === '/бот') {
        await sendMessage(chatId, `🤖 *МЕНЮ ИГРОКА*\n━━━━━━━━━━━━━━━━━━\n/баланс 💰\n/статистика 📊\n/банк 🏦\n/гадание 🔮\n/новости 📰\n/шутка 😂\n/топ10 🏆\n/админы 👑`);
        return;
    }
    if (cmd === '/баланс') {
        const playerKey = getPlayerKey(sender);
        if (!playerKey) {
            await sendMessage(chatId, `💰 *БАЛАНС*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n💎 0₽\n\n💡 Вы не зарегистрированы. Обратитесь к админу: .средства ${sender} + сумма`);
            return;
        }
        await sendMessage(chatId, `💰 *БАЛАНС*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n💎 ${db[playerKey]?.balance || 0}₽`);
        return;
    }
    if (cmd === '/статистика') {
        const playerKey = getPlayerKey(sender);
        if (!playerKey) {
            await sendMessage(chatId, `📊 *СТАТИСТИКА*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n🎲 Игр: 0\n🎟️ Меш.: 0\n🏆 Побед: 0\n💰 Баланс: 0₽\n\n💡 Вы не зарегистрированы. Обратитесь к админу: .средства ${sender} + сумма`);
            return;
        }
        const g = db[playerKey]?.games || 0;
        const t = db[playerKey]?.tickets || 0;
        const w = db[playerKey]?.wins || 0;
        await sendMessage(chatId, `📊 *СТАТИСТИКА*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n🎲 Игр: ${g}\n🎟️ Меш.: ${t}\n🏆 Побед: ${w}\n💰 Баланс: ${db[playerKey]?.balance || 0}₽`);
        return;
    }
    if (cmd === '/банк') {
        const list = Object.entries(db);
        if (!list.length) { await sendMessage(chatId, '📭 База пуста'); return; }
        let out = '🏦 *БАЛАНС ВСЕХ* 🏦\n━━━━━━━━━━━━━━━━━━\n';
        list.forEach(([n, d], i) => {
            out += `${i+1}. ${getDisplayName(n)} — ${d.balance}₽\n`;
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
        const top = Object.entries(db).sort((a,b) => (b[1].balance||0)-(a[1].balance||0)).slice(0,10);
        if (!top.length) { await sendMessage(chatId, '🏆 ТОП-10\nНет данных'); return; }
        let out = '🏆 *ТОП-10* 🏆\n━━━━━━━━━━━━━━━━━━\n';
        top.forEach(([n,d],i) => out += `${i+1}. ${getDisplayName(n)} — ${d.balance}₽\n`);
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
            await sendMessage(chatId, `❌ Игрок "${sender}" не зарегистрирован. Пополните баланс: .средства ${sender} + сумма`);
            return;
        }
        
        const bets = cmd.split(',').map(b => b.trim());
        let totalCost = 0;
        const validBets = [];
        const errors = [];
        const p = prices[game.style];
        
        for (const bet of bets) {
            let num = parseInt(bet);
            let type = 'full';
            if (bet.endsWith('/')) { type = 'half'; num = parseInt(bet.slice(0,-1)); }
            if (bet.endsWith('\\')) { type = 'half'; num = parseInt(bet.slice(0,-1)); }
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
        
        const currentBalance = db[playerKey]?.balance || 0;
        if (currentBalance < totalCost) {
            await sendMessage(chatId, `❌ *НЕ ХВАТАЕТ ${totalCost}₽*\n💰 Ваш баланс: ${currentBalance}₽`);
            return;
        }
        
        db[playerKey].balance -= totalCost;
        
        for (const bet of validBets) {
            if (!game.slots[bet.num]) game.slots[bet.num] = {};
            if (bet.type === 'full') game.slots[bet.num].full = sender;
            else if (bet.type === 'half') {
                if (!game.slots[bet.num].left) game.slots[bet.num].left = sender;
                else if (!game.slots[bet.num].right) game.slots[bet.num].right = sender;
            }
        }
        
        let allFilled = true;
        for (let i = 1; i <= game.max; i++) {
            const s = game.slots[i];
            if (!s || (!s.full && !s.left && !s.right)) { allFilled = false; break; }
        }
        if (allFilled) game.paused = true;
        
        let success = `✅ *СТАВКИ ПРИНЯТЫ*\n━━━━━━━━━━━━━━━━━━\n`;
        for (const bet of validBets) {
            const price = bet.type === 'full' ? p.full : p.half;
            success += `🎲 Номер ${bet.num}${bet.type === 'half' ? '/' : ''} — ${price}₽\n`;
        }
        success += `\n💰 Списано: ${totalCost}₽\n💰 Новый баланс: ${db[playerKey].balance}₽\n\n${renderLot()}`;
        await sendMessage(chatId, success);
        return;
    }
    
    // ===== АДМИН-КОМАНДЫ =====
    if (!isAdminUser) {
        if (cmd.startsWith('/') && !['/бот','/баланс','/статистика','/банк','/гадание','/новости','/шутка','/топ10','/админы'].includes(cmd)) {
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
.средства [имя] +[сумма]
.средства [имя] -[сумма]
.средства = [имя] [сумма]

💳 *ДОЛГИ*
.принять [имя] — оплата долга
.отказ [имя] — списать долг

🎲 *ЛОТ*
.начать [стиль] [число]
.список | .пауза лот
.победители [1 2 3 4 5 6]

🐷 *КОПИЛКА*
.копилка | .разбить

🤖 *УМНЫЙ БОТ*
.умныйбот + | .умныйбот -

📊 *ОТЧЁТ*
.отчёт — полная статистика`);
        return;
    }
    
    if (cmd === '.принять' && args) {
        const key = getPlayerKey(args);
        if (!key) { await sendMessage(chatId, `❌ Игрок "${args}" не найден`); return; }
        const current = db[key].balance || 0;
        if (current >= 0) {
            await sendMessage(chatId, `ℹ️ У ${args} нет долга (баланс: ${current}₽)`);
            return;
        }
        db[key].balance = 0;
        await sendMessage(chatId, `✅ *ОПЛАТА ПРИНЯТА*\n━━━━━━━━━━━━━━━━━━\n👤 ${args}\n📉 Долг был: ${current}₽\n📈 Баланс обнулён`);
        return;
    }
    
    if (cmd === '.отказ' && args) {
        const key = getPlayerKey(args);
        if (!key) { await sendMessage(chatId, `❌ Игрок "${args}" не найден`); return; }
        const current = db[key].balance || 0;
        if (current >= 0) {
            await sendMessage(chatId, `ℹ️ У ${args} нет долга (баланс: ${current}₽)`);
            return;
        }
        db[key].balance = 0;
        await sendMessage(chatId, `⛔ *ДОЛГ СПИСАН*\n━━━━━━━━━━━━━━━━━━\n👤 ${args}\n📉 Долг: ${current}₽ → 0₽`);
        return;
    }
    
    if (cmd === '.средства' && args && args.includes('=')) {
        const parts = args.split('=');
        let name = parts[0].trim();
        let val = parseInt(parts[1].trim());
        if (isNaN(val)) { await sendMessage(chatId, '❌ Сумма не число'); return; }
        let key = getPlayerKey(name);
        if (!key) {
            key = `${name} (manual)`;
            db[key] = { balance: 0, games: 0, tickets: 0, wins: 0 };
        }
        const old = db[key].balance || 0;
        db[key].balance = val;
        await sendMessage(chatId, `🟡 *КОРРЕКТИРОВКА БАЛАНСА*\n━━━━━━━━━━━━━━━━━━\n👤 ${name}\n📉 Было: ${old}₽\n📈 Стало: ${db[key].balance}₽`);
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
    if (cmd === '.копилка') { showPiggy(chatId); return; }
    if (cmd === '.разбить') { breakPiggy(chatId); return; }
    if (cmd === '.участники') {
        const list = Object.entries(db);
        if (!list.length) { await sendMessage(chatId, '📭 База пуста'); return; }
        let out = '👥 *УЧАСТНИКИ*\n━━━━━━━━━━━━━━━━━━\n';
        list.forEach(([n,d],i) => out += `${i+1}. ${getDisplayName(n)} — ${d.balance}₽\n`);
        await sendMessage(chatId, out);
        return;
    }
    if (cmd === '.топ10') {
        const top = Object.entries(db).sort((a,b) => (b[1].balance||0)-(a[1].balance||0)).slice(0,10);
        if (!top.length) { await sendMessage(chatId, '📭 Нет данных'); return; }
        let out = '🏆 *ТОП-10* 🏆\n━━━━━━━━━━━━━━━━━━\n';
        top.forEach(([n,d],i) => out += `${i+1}. ${getDisplayName(n)} — ${d.balance}₽\n`);
        await sendMessage(chatId, out);
        return;
    }
    if (cmd === '.поиск' && args) {
        const key = getPlayerKey(args);
        if (!key) { await sendMessage(chatId, `❌ "${args}" не найден`); return; }
        await sendMessage(chatId, `🔎 *РЕЗУЛЬТАТ*\n━━━━━━━━━━━━━━━━━━\n👤 ${args}\n💰 ${db[key].balance}₽`);
        return;
    }
    if (cmd === '.средства' && args) {
        const op = args.includes('+') ? '+' : (args.includes('-') ? '-' : null);
        if (!op) { await sendMessage(chatId, '❌ .средства [имя] +[сумма]'); return; }
        const parts = args.split(op);
        let name = parts[0].trim();
        let val = parseInt(parts[1]);
        if (isNaN(val)) { await sendMessage(chatId, '❌ Сумма не число'); return; }
        let key = getPlayerKey(name);
        if (!key) {
            key = `${name} (manual)`;
            db[key] = { balance: 0, games: 0, tickets: 0, wins: 0 };
        }
        const old = db[key].balance || 0;
        db[key].balance = op === '+' ? old + val : old - val;
        await sendMessage(chatId, `${op === '+' ? '🟢 НАЧИСЛЕНО' : '🔴 СПИСАНО'} ${name}: ${old} → ${db[key].balance}₽`);
        return;
    }
    if (cmd === '.удалить' && args) {
        const key = getPlayerKey(args);
        if (!key) { await sendMessage(chatId, `❌ "${args}" не найден`); return; }
        delete db[key];
        await sendMessage(chatId, `🗑️ *УДАЛЁН*\n👤 ${args}`);
        return;
    }
    if (cmd === '.начать' && args) {
        const parts = args.split(/\s+/);
        const num = parseInt(parts[parts.length-1]);
        const style = parts.slice(0,-1).join(' ').toLowerCase();
        if (styles[style] && !isNaN(num) && num > 0) {
            game = { active: true, paused: false, style: style, max: num, slots: {} };
            await sendMessage(chatId, renderLot());
        } else {
            await sendMessage(chatId, `❌ .начать [стиль] [число]\nПример: .начать феникс 10`);
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
            const uniqueWins = [...new Set(wins)];
            if (uniqueWins.length !== wins.length) {
                await sendMessage(chatId, `❌ *ОШИБКА*: номера победителей не должны повторяться!`);
                return;
            }
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
