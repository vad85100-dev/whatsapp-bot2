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

const jokes = ['😂 Почему игроки не любят лес? — Там много логов!', '🤣 Лот — это лотерея для оптимистов!', '😎 Ставки сделаны? Да, на победу!'];
const horos = ['♈ Овен: 3,7,11', '♌ Лев: 7,14,20', '♓ Рыбы: 9,13,16'];
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

// ========== КОПИЛКА ==========
function savePiggy() {
    // в реальной базе нужно сохранять, но для простоты оставляем в памяти
}
function addGamePlay(playerKey, value) {
    if (!db[playerKey]) return;
    if (!db[playerKey].games) db[playerKey].games = 0;
    if (!db[playerKey].tickets) db[playerKey].tickets = 0;
    db[playerKey].games += value;
    const newTickets = Math.floor(db[playerKey].games / 10) - db[playerKey].tickets;
    if (newTickets > 0) {
        db[playerKey].tickets += newTickets;
        sendMessage(chatId, `🎁 *ИГРОК ПОЛУЧИЛ МЕШОЧЕК!*\n━━━━━━━━━━━━━━━━━━\n👤 ${playerKey.split(' (')[0]}\n📊 Сыграно игр: ${db[playerKey].games}\n🎟️ Мешочков: ${db[playerKey].tickets}`);
    }
}
function showPiggy(chatId) {
    let totalTickets = 0;
    for (let key in db) if (db[key]?.tickets) totalTickets += db[key].tickets;
    sendMessage(chatId, `🐷 *КОПИЛКА КАЗИНО* 🐷\n━━━━━━━━━━━━━━━━━━\n💰 Сумма в копилке: *${piggyBank}₽*\n🎟️ Всего мешочков: *${totalTickets}*`);
}
function breakPiggy(chatId) {
    if (dailyPayoutDone) {
        sendMessage(chatId, `⚠️ *КОПИЛКА УЖЕ РАЗБИТА СЕГОДНЯ*\nСледующая разбивка завтра!`);
        return;
    }
    const participants = [];
    for (let key in db) if (db[key]?.tickets && db[key].tickets > 0) participants.push({ key, tickets: db[key].tickets });
    if (participants.length === 0 || piggyBank === 0) {
        sendMessage(chatId, `❌ *НЕЛЬЗЯ РАЗБИТЬ КОПИЛКУ*\nНет мешочков или копилка пуста!`);
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

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function isAdmin(sender) {
    return sender === BOSS || ADMINS.includes(sender);
}

function getPlayerKey(name) {
    return Object.keys(db).find(key => key.split(' (')[0] === name);
}

function ensurePlayer(name) {
    let key = getPlayerKey(name);
    if (!key) {
        key = `${name} (auto)`;
        db[key] = { balance: 0, games: 0, tickets: 0, wins: 0 };
    }
    return key;
}

function renderLot() {
    const s = styles[game.style];
    const p = prices[game.style];
    const prize1 = p.full * 3, prize2 = p.full * 2, prize3 = p.full * 1;
    let res = `${s.h}\n━━━━━━━━━━━━━━━━━━\n🏆 *ПРИЗОВЫЕ МЕСТА* 🏆\n🥇 1 место: ${prize1}₽\n🥈 2 место: ${prize2}₽\n🥉 3 место: ${prize3}₽\n━━━━━━━━━━━━━━━━━━\n`;
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

// ========== ОБРАБОТЧИК СООБЩЕНИЙ ==========
async function handleMessage(chatId, sender, text, groupName) {
    const low = text.toLowerCase();
    const playerKey = ensurePlayer(sender);
    const isAdminUser = isAdmin(sender);

    // Публичные команды
    if (low === '/бот') {
        await sendMessage(chatId, `🤖 *ПРИВЕТ, ИГРОК!*\n━━━━━━━━━━━━━━━━━━\n/баланс 💰\n/статистика 📊\n/гадание 🔮\n/новости 📰\n/шутка 😂\n/топ10 🏆\n/админы 👑`);
        return;
    }
    if (low === '/баланс') {
        await sendMessage(chatId, `💰 *МОЙ БАЛАНС*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n💎 Баланс: *${db[playerKey]?.balance || 0}₽*`);
        return;
    }
    if (low === '/статистика') {
        const games = db[playerKey]?.games || 0;
        const tickets = db[playerKey]?.tickets || 0;
        const wins = db[playerKey]?.wins || 0;
        await sendMessage(chatId, `📊 *МОЯ СТАТИСТИКА*\n━━━━━━━━━━━━━━━━━━\n🎲 Игр: *${games}*\n🎟️ Мешочков: *${tickets}*\n🏆 Побед: *${wins}*`);
        return;
    }
    if (low === '/гадание') {
        await sendMessage(chatId, `🔮 *ГАДАНИЕ*\n━━━━━━━━━━━━━━━━━━\n${horos[Math.floor(Math.random() * horos.length)]}\n\n🍀 *Пусть удача будет с тобой!*`);
        return;
    }
    if (low === '/новости') {
        await sendMessage(chatId, `📰 *НОВОСТЬ*\n━━━━━━━━━━━━━━━━━━\n${facts[Math.floor(Math.random() * facts.length)]}`);
        return;
    }
    if (low === '/шутка') {
        await sendMessage(chatId, `😂 *ШУТКА*\n━━━━━━━━━━━━━━━━━━\n${jokes[Math.floor(Math.random() * jokes.length)]}`);
        return;
    }
    if (low === '/топ10') {
        const top = Object.entries(db).sort((a,b) => (b[1].balance||0) - (a[1].balance||0)).slice(0,10);
        if (!top.length) { await sendMessage(chatId, '🏆 ТОП-10\nНет данных'); return; }
        let out = '🏆 *ТОП-10 БОГАТЕЙШИХ* 🏆\n━━━━━━━━━━━━━━━━━━\n';
        top.forEach(([n,d],i) => out += `${i+1}. ${n.split(' (')[0]} — ${d.balance}₽\n`);
        await sendMessage(chatId, out);
        return;
    }
    if (low === '/админы') {
        await sendMessage(chatId, `👑 *АДМИНИСТРАЦИЯ* 👑\n━━━━━━━━━━━━━━━━━━\n${BOSS}\n${ADMINS.join('\n')}`);
        return;
    }

    // Админ-команды
    if (!isAdminUser) return;

    if (low === '.помощь') {
        await sendMessage(chatId, `🔥👑 *TITAN CASINO* 👑🔥
━━━━━━━━━━━━━━━━━━━━━
📌 *ОСНОВНЫЕ*
.участники | .поиск | .топ10

💰 *ФИНАНСЫ*
.средства [имя] +/-

🎲 *ЛОТ*
.начать [стиль] [число]
.список | .пауза лот
.победители [1 2 3]

🐷 *КОПИЛКА*
.копилка | .разбить

🤖 *УМНЫЙ БОТ*
.умныйбот + | .умныйбот -`);
        return;
    }
    if (low === '.умныйбот +') {
        smartBot = true;
        await sendMessage(chatId, '🧠 *УМНЫЙ БОТ ВКЛЮЧЁН*');
        return;
    }
    if (low === '.умныйбот -') {
        smartBot = false;
        await sendMessage(chatId, '💤 *УМНЫЙ БОТ ВЫКЛЮЧЁН*');
        return;
    }
    if (low === '.копилка') {
        await showPiggy(chatId);
        return;
    }
    if (low === '.разбить') {
        await breakPiggy(chatId);
        return;
    }
    if (low === '.участники') {
        const list = Object.entries(db);
        if (!list.length) { await sendMessage(chatId, '📭 База пуста'); return; }
        let out = '👥 *УЧАСТНИКИ*\n━━━━━━━━━━━━━━━━━━\n';
        list.forEach(([n,d],i) => {
            const name = n.split(' (')[0];
            out += `${i+1}. ${name} — ${d.balance}₽\n`;
        });
        await sendMessage(chatId, out);
        return;
    }
    if (low.startsWith('.средства')) {
        const op = text.includes('+') ? '+' : '-';
        const parts = text.split(op);
        let name = parts[0].replace('.средства', '').trim();
        let val = parseInt(parts[1]);
        if (!isNaN(val)) {
            let key = getPlayerKey(name);
            if (!key) {
                key = `${name} (new)`;
                db[key] = { balance: 0, games: 0, tickets: 0, wins: 0 };
            }
            const old = db[key].balance || 0;
            db[key].balance = op === '+' ? old + val : old - val;
            await sendMessage(chatId, `${op === '+' ? '🟢 НАЧИСЛЕНО' : '🔴 СПИСАНО'} ${name}: ${old} → ${db[key].balance}₽`);
        }
        return;
    }
    if (low.startsWith('.начать')) {
        const stylePart = text.replace('.начать', '').trim();
        const parts = stylePart.split(/\s+/);
        const number = parseInt(parts[parts.length-1]);
        const styleName = parts.slice(0,-1).join(' ').toLowerCase();
        if (styles[styleName] && !isNaN(number)) {
            game = { active: true, paused: false, style: styleName, max: number, slots: {} };
            await sendMessage(chatId, renderLot());
        } else {
            await sendMessage(chatId, '❌ .начать [стиль] [число]');
        }
        return;
    }
    if (low === '.список') {
        if (game.active) await sendMessage(chatId, renderLot());
        else await sendMessage(chatId, '❌ Нет активного лота');
        return;
    }
    if (low === '.пауза лот') {
        if (game.active) { game.paused = true; await sendMessage(chatId, renderLot()); }
        return;
    }
    if (low.startsWith('.победители')) {
        const wins = text.match(/\d+/g);
        if (wins && wins.length) {
            await sendMessage(chatId, `🏆 ПОБЕДИТЕЛИ: ${wins.join(', ')}`);
            game.active = false;
            game.paused = false;
            game.slots = {};
        }
        return;
    }
    
    // Умный бот (отвечает на обычные сообщения)
    if (smartBot && !isAdminUser && !low.startsWith('.') && !low.startsWith('/')) {
        const replies = ['🎲 Удачи!', '🔥 Ставки?', '💰 Фарта!', '🍀 Сегодня твой день!'];
        await sendMessage(chatId, replies[Math.floor(Math.random() * replies.length)]);
        return;
    }
}

// ========== ВЕБХУК ==========
app.post('/webhook', async (req, res) => {
    const webhook = req.body;
    console.log('📩 Получен вебхук:', JSON.stringify(webhook, null, 2));

    const groupName = webhook.senderData?.chatName || '';
    const chatId = webhook.senderData?.chatId;
    const sender = webhook.senderData?.senderName || webhook.senderData?.sender;
    const text = webhook.messageData?.textMessageData?.textMessage;

    const isGroup = chatId && chatId.includes('@g.us');
    if (isGroup && groupName && ALLOWED_GROUPS.length > 0 && !ALLOWED_GROUPS.includes(groupName)) {
        console.log(`⛔ Группа "${groupName}" не в белом списке. Игнорируем.`);
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
