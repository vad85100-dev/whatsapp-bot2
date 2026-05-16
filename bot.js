const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ========== ТВОИ ДАННЫЕ ==========
const ID_INSTANCE = process.env.ID_INSTANCE;
const API_TOKEN = process.env.API_TOKEN;
const BOSS = 'P14';
const ADMINS = ['A', 'Фаягуль', 'Галина', 'Гузель', 'Галина Дубль'];

// ========== БЕЛЫЙ СПИСОК ГРУПП ==========
const ALLOWED_GROUPS = [
    'тестовая система автоматизации',
];

// ========== БАЗА ДАННЫХ ==========
let db = {};
let game = { active: false, paused: false, style: 'феникс', slots: {}, max: 0 };
let piggyBank = 0;
let dailyPayoutDone = false;
let smartBot = false;

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

// ========== ФУНКЦИЯ ОТПРАВКИ ==========
async function sendMessage(chatId, text) {
    try {
        await axios.post(`https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`, {
            chatId: chatId,
            message: text
        });
        console.log(`✅ Отправлено: ${text.substring(0, 50)}...`);
    } catch (err) {
        console.error('❌ Ошибка отправки:', err.message);
    }
}

// ========== ПОИСК ИГРОКА (без учёта регистра и лишних символов) ==========
function normalizeName(name) {
    return name.toLowerCase().replace(/[~@_]/g, '').trim();
}

function findPlayerKey(name) {
    const normalized = normalizeName(name);
    return Object.keys(db).find(key => {
        const keyName = normalizeName(key.split(' (')[0]);
        return keyName === normalized || keyName.includes(normalized) || normalized.includes(keyName);
    });
}

function ensurePlayer(name) {
    let key = findPlayerKey(name);
    if (!key) {
        key = `${name} (auto)`;
        db[key] = { balance: 0, games: 0, tickets: 0, wins: 0 };
    }
    return key;
}

function isAdmin(sender) {
    return sender === BOSS || ADMINS.includes(sender);
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
    sendMessage(chatId, `🐷 *КОПИЛКА КАЗИНО* 🐷\n━━━━━━━━━━━━━━━━━━\n💰 Сумма в копилке: *${piggyBank}₽*\n🎟️ Всего мешочков: *${totalTickets}*`);
}

function breakPiggy(chatId) {
    if (dailyPayoutDone) {
        sendMessage(chatId, `⚠️ *КОПИЛКА УЖЕ РАЗБИТА СЕГОДНЯ*\n━━━━━━━━━━━━━━━━━━\nСледующая разбивка завтра!`);
        return;
    }
    const participants = [];
    for (let key in db) if (db[key]?.tickets && db[key].tickets > 0) participants.push({ key, tickets: db[key].tickets });
    if (participants.length === 0 || piggyBank === 0) {
        sendMessage(chatId, `❌ *НЕЛЬЗЯ РАЗБИТЬ КОПИЛКУ*\n━━━━━━━━━━━━━━━━━━\nНет мешочков или копилка пуста!`);
        return;
    }
    const totalTickets = participants.reduce((s, p) => s + p.tickets, 0);
    const perTicket = piggyBank / totalTickets;
    let msg = `🐷 *РАЗБИВКА КОПИЛКИ* 🐷\n━━━━━━━━━━━━━━━━━━\n💰 Общая сумма: ${piggyBank}₽\n🎟️ Всего мешочков: ${totalTickets}\n📊 Сумма на 1 мешочек: ${Math.floor(perTicket)}₽\n\n🏆 *ПОЛУЧИЛИ:*\n`;
    for (const p of participants) {
        const winnings = Math.floor(perTicket * p.tickets);
        db[p.key].balance = (db[p.key].balance || 0) + winnings;
        db[p.key].tickets = 0;
        msg += `\n${p.key.split(' (')[0]} — ${winnings}₽ (${p.tickets} меш.)`;
    }
    piggyBank = 0;
    dailyPayoutDone = true;
    msg += `\n\n━━━━━━━━━━━━━━━━━━\n🎉 *ВСЕ ПОЗДРАВЛЯЮТ ПОБЕДИТЕЛЕЙ!* 🎉`;
    sendMessage(chatId, msg);
}

function renderLot() {
    const s = styles[game.style];
    const p = prices[game.style];
    
    const prizes = [
        { place: 1, multiplier: 3 },
        { place: 2, multiplier: 2 },
        { place: 3, multiplier: 1.5 },
        { place: 4, multiplier: 1 },
        { place: 5, multiplier: 0.8 },
        { place: 6, multiplier: 0.5 }
    ];
    
    let res = `${s.h}\n━━━━━━━━━━━━━━━━━━\n🏆 *ПРИЗОВЫЕ НОМЕРА* 🏆\n`;
    for (let i = 0; i < 6; i++) {
        const prize = Math.floor(p.full * prizes[i].multiplier);
        res += `${prizes[i].place} место: ${prize}₽ (x${prizes[i].multiplier})\n`;
    }
    res += `━━━━━━━━━━━━━━━━━━\n`;
    
    for (let i = 1; i <= game.max; i++) {
        const slot = game.slots[i];
        if (!slot) res += `${emj[i] || i} ${s.i} 🆓\n`;
        else if (slot.full) res += `${emj[i] || i} ${s.i} 👑 *${slot.full}*\n`;
        else {
            const left = slot.left ? slot.left : '🆓';
            const right = slot.right ? slot.right : '🆓';
            res += `${emj[i] || i} ${s.i} ⬅️ ${left} | ➡️ ${right}\n`;
        }
    }
    if (game.paused) res += `\n⏸️ *ПАУЗА* ⏸️`;
    return res;
}

async function payout(chatId, winners) {
    const p = prices[game.style];
    const prizes = [
        { place: 1, multiplier: 3 },
        { place: 2, multiplier: 2 },
        { place: 3, multiplier: 1.5 },
        { place: 4, multiplier: 1 },
        { place: 5, multiplier: 0.8 },
        { place: 6, multiplier: 0.5 }
    ];
    
    let msg = `🏆 *ВЫПЛАТА ПОБЕДИТЕЛЯМ* 🏆\n━━━━━━━━━━━━━━━━━━\n`;
    let total = 0;
    
    for (let idx = 0; idx < Math.min(winners.length, 6); idx++) {
        const num = winners[idx];
        const slot = game.slots[num];
        if (!slot) continue;
        
        const prizeMoney = Math.floor(p.full * prizes[idx].multiplier);
        
        if (slot.full) {
            const playerKey = ensurePlayer(slot.full);
            db[playerKey].balance += prizeMoney;
            msg += `\n${idx+1}️⃣ ${slot.full} → +${prizeMoney}₽ (x${prizes[idx].multiplier})`;
            total += prizeMoney;
            addGamePlay(playerKey, 1);
            if (!db[playerKey].wins) db[playerKey].wins = 0;
            db[playerKey].wins++;
        } else {
            if (slot.left) {
                const playerKey = ensurePlayer(slot.left);
                db[playerKey].balance += prizeMoney;
                msg += `\n${idx+1}️⃣ ${slot.left} → +${prizeMoney}₽ (левая x${prizes[idx].multiplier})`;
                total += prizeMoney;
                addGamePlay(playerKey, 0.5);
                if (!db[playerKey].wins) db[playerKey].wins = 0;
                db[playerKey].wins++;
            }
            if (slot.right) {
                const playerKey = ensurePlayer(slot.right);
                db[playerKey].balance += prizeMoney;
                msg += `\n${idx+1}️⃣ ${slot.right} → +${prizeMoney}₽ (правая x${prizes[idx].multiplier})`;
                total += prizeMoney;
                addGamePlay(playerKey, 0.5);
                if (!db[playerKey].wins) db[playerKey].wins = 0;
                db[playerKey].wins++;
            }
        }
    }
    
    msg += `\n\n━━━━━━━━━━━━━━━━━━\n💰 *ОБЩИЙ ВЫИГРЫШ:* ${total}₽\n🎉 *ПОЗДРАВЛЯЕМ ПОБЕДИТЕЛЕЙ!* 🎉`;
    await sendMessage(chatId, msg);
    
    piggyBank += 500;
    game.active = false;
    game.paused = false;
    game.slots = {};
}

// ========== ОБРАБОТЧИК СООБЩЕНИЙ ==========
async function handleMessage(chatId, sender, text, groupName) {
    const rawCmd = text.trim().toLowerCase();
    let cmd = rawCmd;
    let args = '';
    const firstSpace = rawCmd.indexOf(' ');
    if (firstSpace !== -1) {
        cmd = rawCmd.substring(0, firstSpace).trim();
        args = rawCmd.substring(firstSpace + 1).trim();
    }
    
    // Нормализуем имя отправителя для поиска в базе
    const playerKey = ensurePlayer(sender);
    const isAdminUser = isAdmin(sender);
    const isBoss = sender === BOSS;
    
    // Список существующих команд
    const validCommands = [
        '/бот', '/баланс', '/статистика', '/гадание', '/новости', '/шутка', '/топ10', '/админы', '/банк',
        '.помощь', '.участники', '.топ10', '.копилка', '.разбить', '.умныйбот +', '.умныйбот -',
        '.начать', '.список', '.пауза лот', '.победители', '.средства', '.поиск', '.удалить'
    ];
    
    // ========== ПУБЛИЧНЫЕ КОМАНДЫ ==========
    if (cmd === '/бот') {
        await sendMessage(chatId, `🤖 *ПРИВЕТ, ИГРОК!* 🤖\n━━━━━━━━━━━━━━━━━━\n/баланс 💰 — мой баланс\n/статистика 📊 — моя статистика\n/банк 🏦 — баланс всех игроков\n/гадание 🔮 — счастливые числа\n/новости 📰 — свежие факты\n/шутка 😂 — поднять настроение\n/топ10 🏆 — богатейшие игроки\n/админы 👑 — список администрации`);
        return;
    }
    if (cmd === '/баланс') {
        await sendMessage(chatId, `💰 *МОЙ БАЛАНС* 💰\n━━━━━━━━━━━━━━━━━━\n👤 *Игрок:* ${sender}\n💎 *Баланс:* ${db[playerKey]?.balance || 0}₽`);
        return;
    }
    if (cmd === '/статистика') {
        const games = db[playerKey]?.games || 0;
        const tickets = db[playerKey]?.tickets || 0;
        const wins = db[playerKey]?.wins || 0;
        await sendMessage(chatId, `📊 *МОЯ СТАТИСТИКА* 📊\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n🎲 Игр: ${games}\n🎟️ Меш.: ${tickets}\n🏆 Побед: ${wins}\n💰 Баланс: ${db[playerKey]?.balance || 0}₽`);
        return;
    }
    if (cmd === '/банк') {
        const list = Object.entries(db);
        if (!list.length) { await sendMessage(chatId, '📭 База пуста'); return; }
        let out = '🏦 *БАЛАНС ИГРОКОВ* 🏦\n━━━━━━━━━━━━━━━━━━\n';
        list.forEach(([n, d], i) => {
            const name = n.split(' (')[0];
            out += `${i+1}. ${name} — ${d.balance}₽\n`;
        });
        await sendMessage(chatId, out);
        return;
    }
    if (cmd === '/гадание') {
        await sendMessage(chatId, `🔮 *ГАДАНИЕ* 🔮\n━━━━━━━━━━━━━━━━━━\n${horos[Math.floor(Math.random() * horos.length)]}\n\n🍀 *Пусть удача будет с тобой!*`);
        return;
    }
    if (cmd === '/новости') {
        await sendMessage(chatId, `📰 *НОВОСТЬ* 📰\n━━━━━━━━━━━━━━━━━━\n${facts[Math.floor(Math.random() * facts.length)]}`);
        return;
    }
    if (cmd === '/шутка') {
        await sendMessage(chatId, `😂 *ШУТКА* 😂\n━━━━━━━━━━━━━━━━━━\n${jokes[Math.floor(Math.random() * jokes.length)]}`);
        return;
    }
    if (cmd === '/топ10') {
        const top = Object.entries(db).sort((a, b) => (b[1].balance || 0) - (a[1].balance || 0)).slice(0, 10);
        if (!top.length) { await sendMessage(chatId, '🏆 ТОП-10\nНет данных'); return; }
        let out = '🏆 *ТОП-10 БОГАТЕЙШИХ* 🏆\n━━━━━━━━━━━━━━━━━━\n';
        top.forEach(([n, d], i) => out += `${i+1}. ${n.split(' (')[0]} — ${d.balance}₽\n`);
        await sendMessage(chatId, out);
        return;
    }
    if (cmd === '/админы') {
        await sendMessage(chatId, `👑 *АДМИНИСТРАЦИЯ* 👑\n━━━━━━━━━━━━━━━━━━\n${BOSS} (владелец)\n${ADMINS.join('\n')}`);
        return;
    }
    
    // ========== СТАВКИ ==========
    if (game.active && !game.paused) {
        const isBet = /^[\d,\/\\]+$/.test(cmd);
        if (isBet) {
            const bets = cmd.split(',').map(b => b.trim());
            let totalCost = 0;
            const validBets = [];
            const errors = [];
            const p = prices[game.style];
            
            for (const bet of bets) {
                let num = parseInt(bet);
                let type = 'full';
                if (bet.endsWith('/')) { type = 'half'; num = parseInt(bet.slice(0, -1)); }
                if (bet.endsWith('\\')) { type = 'half'; num = parseInt(bet.slice(0, -1)); }
                
                if (isNaN(num) || num < 1 || num > game.max) {
                    errors.push(`❌ "${bet}" — неверный номер`);
                    continue;
                }
                
                const need = (type === 'full') ? p.full : p.half;
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
                    errors.push(`❌ Номер ${num} полностью занят (обе половинки заняты)`);
                    continue;
                }
                
                validBets.push({ num, type, need });
                totalCost += need;
            }
            
            if (errors.length > 0) {
                await sendMessage(chatId, `❌ *ОШИБКИ В СТАВКАХ*\n━━━━━━━━━━━━━━━━━━\n${errors.join('\n')}`);
                return;
            }
            
            if (validBets.length === 0) return;
            
            if ((db[playerKey]?.balance || 0) < totalCost) {
                await sendMessage(chatId, `❌ *НЕ ХВАТАЕТ ${totalCost}₽*\n💰 Ваш баланс: ${db[playerKey]?.balance || 0}₽`);
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
            
            let successMsg = `✅ *СТАВКИ ПРИНЯТЫ*\n━━━━━━━━━━━━━━━━━━\n`;
            for (const bet of validBets) {
                const price = bet.type === 'full' ? p.full : p.half;
                successMsg += `🎲 Номер ${bet.num}${bet.type === 'half' ? '/' : ''} — ${price}₽\n`;
            }
            successMsg += `\n💰 Всего списано: ${totalCost}₽\n━━━━━━━━━━━━━━━━━━\n\n${renderLot()}`;
            await sendMessage(chatId, successMsg);
            return;
        }
    }
    
    // ========== АДМИН-КОМАНДЫ ==========
    if (!isAdminUser) {
        if (cmd.startsWith('/') && !validCommands.includes(cmd)) {
            await sendMessage(chatId, `❌ *ОШИБКА! ТАКОЙ КОМАНДЫ НЕ СУЩЕСТВУЕТ*\n━━━━━━━━━━━━━━━━━━\n💡 Введи /бот для списка команд.`);
        }
        return;
    }
    
    if (cmd === '.помощь') {
        await sendMessage(chatId, `🔥👑 *TITAN CASINO* 👑🔥\n━━━━━━━━━━━━━━━━━━━━━
📌 *ОСНОВНЫЕ*
.участники — список игроков
.поиск [имя] — найти игрока
.топ10 — богатейшие
.удалить [имя] — удалить игрока

💰 *ФИНАНСЫ*
.средства [имя] +[сумма]
.средства [имя] -[сумма]

🎲 *ЛОТ*
.начать [стиль] [число]
.список — показать лот
.пауза лот — заморозить
.победители [номера]

🐷 *КОПИЛКА*
.копилка — показать сумму
.разбить — поделить копилку

🤖 *УМНЫЙ БОТ*
.умныйбот + — включить
.умныйбот - — выключить

🎮 *ДЛЯ ИГРОКОВ*
/бот — меню игрока
━━━━━━━━━━━━━━━━━━━━━
💡 Ставки: 5 — весь | 5/ — половинка | 5,3,2/ — несколько`);
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
        await showPiggy(chatId);
        return;
    }
    if (cmd === '.разбить') {
        await breakPiggy(chatId);
        return;
    }
    if (cmd === '.участники') {
        const list = Object.entries(db);
        if (!list.length) { await sendMessage(chatId, '📭 База пуста'); return; }
        let out = '👥 *УЧАСТНИКИ*\n━━━━━━━━━━━━━━━━━━\n';
        list.forEach(([n, d], i) => {
            const name = n.split(' (')[0];
            const games = d.games || 0;
            const tickets = d.tickets || 0;
            out += `${i+1}. ${name}\n   🎲 Игр: ${games} | 🎟️ Меш.: ${tickets} | 💰 ${d.balance}₽\n`;
        });
        await sendMessage(chatId, out);
        return;
    }
    if (cmd === '.топ10') {
        const top = Object.entries(db).sort((a, b) => (b[1].balance || 0) - (a[1].balance || 0)).slice(0, 10);
        if (!top.length) { await sendMessage(chatId, '📭 Нет данных'); return; }
        let out = '🏆 *ТОП-10* 🏆\n━━━━━━━━━━━━━━━━━━\n';
        top.forEach(([n, d], i) => out += `${i+1}. ${n.split(' (')[0]} — ${d.balance}₽\n`);
        await sendMessage(chatId, out);
        return;
    }
    if (cmd === '.поиск' && args) {
        const res = Object.keys(db).filter(key => key.toLowerCase().includes(args.toLowerCase()));
        if (!res.length) { await sendMessage(chatId, `❌ "${args}" не найден`); return; }
        let out = '🔎 *РЕЗУЛЬТАТ ПОИСКА*\n━━━━━━━━━━━━━━━━━━\n';
        res.slice(0, 5).forEach(key => out += `\n${key.split(' (')[0]} — ${db[key].balance}₽`);
        await sendMessage(chatId, out);
        return;
    }
    if (cmd === '.средства' && args) {
        const op = args.includes('+') ? '+' : (args.includes('-') ? '-' : null);
        if (!op) return;
        const parts = args.split(op);
        let name = parts[0].trim();
        let val = parseInt(parts[1]);
        if (isNaN(val)) { await sendMessage(chatId, '❌ Сумма не число'); return; }
        
        let key = findPlayerKey(name);
        if (!key) {
            key = `${name} (manual)`;
            db[key] = { balance: 0, games: 0, tickets: 0, wins: 0 };
        }
        const old = db[key].balance || 0;
        db[key].balance = op === '+' ? old + val : old - val;
        await sendMessage(chatId, `${op === '+' ? '🟢 НАЧИСЛЕНО' : '🔴 СПИСАНО'} ${name}: ${old} → ${db[key].balance}₽`);
        return;
    }
    if (cmd === '.удалить' && args && isAdminUser) {
        const key = findPlayerKey(args);
        if (!key) {
            await sendMessage(chatId, `❌ Игрок "${args}" не найден в базе`);
            return;
        }
        delete db[key];
        await sendMessage(chatId, `🗑️ *ИГРОК УДАЛЁН*\n━━━━━━━━━━━━━━━━━━\n👤 ${key.split(' (')[0]} удалён из базы.`);
        return;
    }
    if (cmd === '.очистить базу' && isBoss) {
        db = {};
        await sendMessage(chatId, '🗑️ *БАЗА ОЧИЩЕНА*\n━━━━━━━━━━━━━━━━━━\nВсе данные удалены.');
        return;
    }
    if (cmd === '.начать' && args) {
        const parts = args.split(/\s+/);
        const number = parseInt(parts[parts.length - 1]);
        const styleName = parts.slice(0, -1).join(' ').toLowerCase();
        if (styles[styleName] && !isNaN(number)) {
            game = { active: true, paused: false, style: styleName, max: number, slots: {} };
            await sendMessage(chatId, renderLot());
        } else {
            await sendMessage(chatId, `❌ *ОШИБКА*\nФормат: .начать [стиль] [число]\nПример: .начать феникс 10`);
        }
        return;
    }
    if (cmd === '.список') {
        if (game.active) await sendMessage(chatId, renderLot());
        else await sendMessage(chatId, '❌ Нет активного лота');
        return;
    }
    if (cmd === '.пауза лот') {
        if (game.active) { game.paused = true; await sendMessage(chatId, renderLot()); }
        return;
    }
    if (cmd === '.победители' && args && game.paused) {
        const wins = args.match(/\d+/g);
        if (wins && wins.length) {
            await payout(chatId, wins);
        } else {
            await sendMessage(chatId, '❌ .победители 1 2 3 4 5 6');
        }
        return;
    }
    
    // Умный бот
    if (smartBot && !cmd.startsWith('.') && !cmd.startsWith('/')) {
        const replies = ['🎲 Удачи в лоте!', '🔥 Ставки сделаны?', '💰 Фарта тебе!', '🍀 Сегодня твой день!', '💎 Джекпот уже близко!'];
        await sendMessage(chatId, replies[Math.floor(Math.random() * replies.length)]);
        return;
    }
    
    if (cmd.startsWith('.') && !validCommands.includes(cmd) && cmd !== '.очистить базу') {
        await sendMessage(chatId, `❌ *ОШИБКА! ТАКОЙ КОМАНДЫ НЕ СУЩЕСТВУЕТ*\n💡 Введи .помощь для списка команд.`);
    }
}

// ========== ВЕБХУК ==========
app.post('/webhook', async (req, res) => {
    const webhook = req.body;
    console.log('📩 Получен вебхук');

    const groupName = webhook.senderData?.chatName || '';
    const chatId = webhook.senderData?.chatId;
    const sender = webhook.senderData?.senderName || webhook.senderData?.sender;
    const text = webhook.messageData?.textMessageData?.textMessage;

    const isGroup = chatId && chatId.includes('@g.us');
    if (isGroup && groupName && ALLOWED_GROUPS.length > 0 && !ALLOWED_GROUPS.includes(groupName)) {
        console.log(`⛔ Группа "${groupName}" не в белом списке`);
        res.status(200).send('OK');
        return;
    }

    if (webhook.typeWebhook === 'incomingMessageReceived' || webhook.typeWebhook === 'outgoingMessageReceived') {
        if (chatId && text) {
            await handleMessage(chatId, sender || chatId.split('@')[0], text, groupName);
        }
    }

    res.status(200).send('OK');
});

// ========== ЗАПУСК ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Бот запущен на порту ${PORT}`);
});
