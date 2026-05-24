const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const ID_INSTANCE = process.env.ID_INSTANCE;
const API_TOKEN = process.env.API_TOKEN;
const BOSS = 'P14';
const ADMINS = ['A', 'Фаягуль', 'Галина', 'Гузель 🧿', 'Галина Дубль', 'Евгения'];

const ALLOWED_GROUPS = ['Штаб-БОТ', 'Колесо Фортуны, резерв', 'У Фаягуль'];

// Глобальные переменные для текущей группы (будут переопределяться в handleMessage)
let db, game, stats, lotInfo, piggyBank, piggyHistory;

// Мультигрупповая система
let groups = {};  // { "chatId@g.us": { db, game, stats, lotInfo, piggyBank, piggyHistory } }

// Система лицензий
let licenses = {}; // { "chatId@g.us": { expireDate, plan, addedBy, addedAt } }

// Функция получения данных группы
function getGroupData(chatId) {
    if (!groups[chatId]) {
        groups[chatId] = {
            db: {},
            game: { active: false, paused: false, style: 'обезьянка', slots: {}, max: 0, repeat: false },
            stats: { totalLots: 0, adminLots: {}, totalGames: 0, reportDate: new Date() },
            lotInfo: {},
            piggyBank: 0,
            piggyHistory: []
        };
    }
    return groups[chatId];
}

// Функция проверки лицензии
function hasLicense(chatId) {
    const license = licenses[chatId];
    if (!license) return false;
    const now = new Date();
    const expireDate = new Date(license.expireDate);
    return expireDate > now;
}

// Штаб-группы (могут управлять лицензиями)
const HEADQUARTERS_GROUPS = ['Штаб-БОТ'];

function isHeadquarters(groupName) {
    return HEADQUARTERS_GROUPS.includes(groupName);
}

async function saveLicenses() {
    fs.writeFileSync('licenses.json', JSON.stringify(licenses, null, 2));
    console.log('💾 Лицензии сохранены');
}
// Функция получения информации о лицензии
function getLicenseInfo(chatId) {
    const license = licenses[chatId];
    if (!license) return null;
    const expireDate = new Date(license.expireDate);
    const daysLeft = Math.ceil((expireDate - new Date()) / (1000 * 60 * 60 * 24));
    return { expireDate, daysLeft, plan: license.plan, addedBy: license.addedBy };
}

const fs = require('fs');

// Загрузка лицензий
try {
    if (fs.existsSync('licenses.json')) {
        licenses = JSON.parse(fs.readFileSync('licenses.json', 'utf8'));
        console.log('✅ Лицензии загружены');
    }
} catch(e) { console.log('Нет файла лицензий'); }

// Автосохранение лицензий
setInterval(() => {
    fs.writeFileSync('licenses.json', JSON.stringify(licenses, null, 2));
}, 5 * 60 * 1000);

const emj = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣'];

const styles = {
    обезьянка: {
        h: '🦥✨🦥✨🦥✨🦥✨🦥✨\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🐒🐒 *{price_full}₽➖{price_half}₽* 🐒🐒\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🪵1️⃣🪵 1️⃣2️⃣0️⃣0️⃣ 🪵\n🦥2️⃣🦥 8️⃣0️⃣0️⃣ 🦥\n🌰3️⃣🌰 1️⃣0️⃣0️⃣0️⃣ 🌰\n🐿️4️⃣🐿️ 3️⃣0️⃣0️⃣0️⃣ 🐿️\n🪵5️⃣🪵 1️⃣0️⃣0️⃣0️⃣ 🪵\n🦥6️⃣🦥 5️⃣0️⃣0️⃣ 🦥',
        i: '🦥',
        price: { full: 1000, half: 500 },
        maxNumbers: 12,
        prizesCount: 4,
        prizes: [{ place: 1, prize: 1000 }, { place: 2, prize: 5000 }, { place: 3, prize: 1000 }, { place: 4, prize: 2500 }]
    },
    рыжий: {
        h: '🦊🔥🦊🔥🦊🔥🦊🔥🦊🔥\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🔥🔥 *{price_full}₽➖{price_half}₽* 🔥🔥\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍂1️⃣🍂 1️⃣2️⃣0️⃣0️⃣ 🍂\n🦊2️⃣🦊 8️⃣0️⃣0️⃣ 🦊\n🌾3️⃣🌾 1️⃣0️⃣0️⃣0️⃣ 🌾\n🍁4️⃣🍁 3️⃣0️⃣0️⃣0️⃣ 🍁\n🪵5️⃣🪵 1️⃣0️⃣0️⃣0️⃣ 🪵\n🦊6️⃣🦊 5️⃣0️⃣0️⃣ 🦊',
        i: '🦊',
        price: { full: 1000, half: 500 },
        maxNumbers: 9,
        prizesCount: 4,
        prizes: [{ place: 1, prize: 2000 }, { place: 2, prize: 3000 }, { place: 3, prize: 500 }, { place: 4, prize: 1000 }]
    },
    клубничка: {
        h: '🍓✨🍓✨🍓✨🍓✨🍓✨\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍓🍓 *{price_full}₽➖{price_half}₽* 🍓🍓\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍓1️⃣🍓 6️⃣0️⃣0️⃣0️⃣ 🍓\n🍓2️⃣🍓 4️⃣5️⃣0️⃣0️⃣ 🍓\n🍓3️⃣🍓 3️⃣5️⃣0️⃣0️⃣ 🍓\n🍓4️⃣🍓 3️⃣5️⃣0️⃣0️⃣ 🍓\n🍓5️⃣🍓 4️⃣0️⃣0️⃣0️⃣ 🍓',
        i: '🍓',
        price: { full: 3000, half: 1500 },
        maxNumbers: 8,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 6000 }, { place: 2, prize: 4500 }, { place: 3, prize: 3500 }, { place: 4, prize: 3500 }, { place: 5, prize: 4000 }]
    },
    солнышко: {
        h: '☀️✨☀️✨☀️✨☀️✨☀️✨\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌞🌞 *{price_full}₽➖{price_half}₽* 🌞🌞\n✩⢄⢁✧ --------- ✧⡈⡠✩\n☀️1️⃣☀️ 5️⃣0️⃣0️⃣0️⃣ ☀️\n☀️2️⃣☀️ 1️⃣0️⃣0️⃣0️⃣ ☀️\n☀️3️⃣☀️ 2️⃣0️⃣0️⃣0️⃣ ☀️\n☀️4️⃣☀️ 1️⃣5️⃣0️⃣0️⃣ ☀️\n☀️5️⃣☀️ 1️⃣5️⃣0️⃣0️⃣ ☀️\n☀️6️⃣☀️ 3️⃣0️⃣0️⃣0️⃣ ☀️',
        i: '☀️',
        price: { full: 1500, half: 750 },
        maxNumbers: 11,
        prizesCount: 6,
        prizes: [{ place: 1, prize: 5000 }, { place: 2, prize: 1000 }, { place: 3, prize: 2000 }, { place: 4, prize: 1500 }, { place: 5, prize: 1500 }, { place: 6, prize: 3000 }]
    },
    затмение: {
        h: '🌑✨🌑✨🌑✨🌑✨🌑✨\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌚🌚 *{price_full}₽➖{price_half}₽* 🌚🌚\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌑1️⃣🌑 6️⃣0️⃣0️⃣0️⃣ 🌑\n🌑2️⃣🌑 2️⃣0️⃣0️⃣0️⃣ 🌑\n🌑3️⃣🌑 1️⃣5️⃣0️⃣0️⃣ 🌑\n🌑4️⃣🌑 2️⃣0️⃣0️⃣0️⃣ 🌑\n🌑5️⃣🌑 2️⃣0️⃣0️⃣0️⃣ 🌑\n🌑6️⃣🌑 4️⃣0️⃣0️⃣0️⃣ 🌑',
        i: '🌑',
        price: { full: 2000, half: 1000 },
        maxNumbers: 10,
        prizesCount: 6,
        prizes: [{ place: 1, prize: 6000 }, { place: 2, prize: 2000 }, { place: 3, prize: 1500 }, { place: 4, prize: 2000 }, { place: 5, prize: 2000 }, { place: 6, prize: 4000 }]
    },
    яблочко: {
        h: '🍎☠️🍎☠️🍎☠️🍎☠️🍎☠️\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍎☠️ *{price_full}₽➖{price_half}₽* ☠️🍎\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍎1️⃣🍎 5️⃣0️⃣0️⃣0️⃣ ☠️\n🍎2️⃣🍎 2️⃣5️⃣0️⃣0️⃣ ☠️\n🍎3️⃣🍎 2️⃣0️⃣0️⃣0️⃣ ☠️\n🍎4️⃣🍎 2️⃣0️⃣0️⃣0️⃣ ☠️\n🍎5️⃣🍎 2️⃣0️⃣0️⃣0️⃣ ☠️\n🍎6️⃣🍎 2️⃣0️⃣0️⃣0️⃣ ☠️\n🍎7️⃣🍎 2️⃣0️⃣0️⃣0️⃣ ☠️',
        i: '🍎',
        price: { full: 2000, half: 1000 },
        maxNumbers: 10,
        prizesCount: 7,
        prizes: [{ place: 1, prize: 5000 }, { place: 2, prize: 2500 }, { place: 3, prize: 2000 }, { place: 4, prize: 2000 }, { place: 5, prize: 2000 }, { place: 6, prize: 2000 }, { place: 7, prize: 2000 }]
    },
    пивасик: {
        h: '🍺🍻🍺🍻🍺🍻🍺🍻🍺🍻\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍺🍺 *{price_full}₽➖{price_half}₽* 🍺🍺\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍺1️⃣🍺 6️⃣0️⃣0️⃣0️⃣ 🍻\n🍺2️⃣🍺 3️⃣0️⃣0️⃣0️⃣ 🍻\n🍺3️⃣🍺 4️⃣0️⃣0️⃣0️⃣ 🍻\n🍺4️⃣🍺 2️⃣5️⃣0️⃣0️⃣ 🍻',
        i: '🍺',
        price: { full: 3000, half: 1500 },
        maxNumbers: 6,
        prizesCount: 4,
        prizes: [{ place: 1, prize: 6000 }, { place: 2, prize: 3000 }, { place: 3, prize: 4000 }, { place: 4, prize: 2500 }]
    },
    кокетка: {
        h: '💄💅💄💅💄💅💄💅💄💅\n✩⢄⢁✧ --------- ✧⡈⡠✩\n💄💄 *{price_full}₽➖{price_half}₽* 💄💄\n✩⢄⢁✧ --------- ✧⡈⡠✩\n💄1️⃣💄 5️⃣0️⃣0️⃣0️⃣ 💅\n💄2️⃣💄 2️⃣5️⃣0️⃣0️⃣ 💅\n💄3️⃣💄 2️⃣0️⃣0️⃣0️⃣ 💅\n💄4️⃣💄 2️⃣0️⃣0️⃣0️⃣ 💅\n💄5️⃣💄 2️⃣0️⃣0️⃣0️⃣ 💅\n💄6️⃣💄 2️⃣0️⃣0️⃣0️⃣ 💅',
        i: '💄',
        price: { full: 3000, half: 1500 },
        maxNumbers: 6,
        prizesCount: 6,
        prizes: [{ place: 1, prize: 5000 }, { place: 2, prize: 2500 }, { place: 3, prize: 2000 }, { place: 4, prize: 2000 }, { place: 5, prize: 2000 }, { place: 6, prize: 2000 }]
    },
    котик: {
        h: '🐱🐾🐱🐾🐱🐾🐱🐾🐱🐾\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🐱🐱 *{price_full}₽➖{price_half}₽* 🐱🐱\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🐱1️⃣🐱 3️⃣0️⃣0️⃣0️⃣ 🐾\n🐱2️⃣🐱 2️⃣0️⃣0️⃣0️⃣ 🐾\n🐱3️⃣🐱 4️⃣0️⃣0️⃣0️⃣ 🐾\n🐱4️⃣🐱 4️⃣0️⃣0️⃣0️⃣ 🐾\n🐱5️⃣🐱 2️⃣5️⃣0️⃣0️⃣ 🐾',
        i: '🐱',
        price: { full: 2000, half: 1000 },
        maxNumbers: 9,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 3000 }, { place: 2, prize: 2000 }, { place: 3, prize: 4000 }, { place: 4, prize: 4000 }, { place: 5, prize: 2500 }]
    },
    звездочка: {
        h: '⭐️✨⭐️✨⭐️✨⭐️✨⭐️✨\n✩⢄⢁✧ --------- ✧⡈⡠✩\n⭐️⭐️ *{price_full}₽➖{price_half}₽* ⭐️⭐️\n✩⢄⢁✧ --------- ✧⡈⡠✩\n⭐️1️⃣⭐️ 1️⃣7️⃣0️⃣0️⃣ ✨\n⭐️2️⃣⭐️ 1️⃣5️⃣0️⃣0️⃣ ✨\n⭐️3️⃣⭐️ 1️⃣2️⃣0️⃣0️⃣ ✨\n⭐️4️⃣⭐️ 1️⃣2️⃣0️⃣0️⃣ ✨\n⭐️5️⃣⭐️ 1️⃣5️⃣0️⃣0️⃣ ✨',
        i: '⭐️',
        price: { full: 1200, half: 600 },
        maxNumbers: 8,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 1700 }, { place: 2, prize: 1500 }, { place: 3, prize: 1200 }, { place: 4, prize: 1200 }, { place: 5, prize: 1500 }]
    },
    дождик: {
        h: '☔️💧☔️💧☔️💧☔️💧☔️💧\n✩⢄⢁✧ --------- ✧⡈⡠✩\n☔️☔️ *{price_full}₽➖{price_half}₽* ☔️☔️\n✩⢄⢁✧ --------- ✧⡈⡠✩\n☔️1️⃣☔️ 3️⃣0️⃣0️⃣0️⃣ 💧\n☔️2️⃣☔️ 2️⃣0️⃣0️⃣0️⃣ 💧\n☔️3️⃣☔️ 4️⃣0️⃣0️⃣0️⃣ 💧\n☔️4️⃣☔️ 1️⃣5️⃣0️⃣0️⃣ 💧\n☔️5️⃣☔️ 3️⃣0️⃣0️⃣0️⃣ 💧\n☔️6️⃣☔️ 4️⃣0️⃣0️⃣0️⃣ 💧',
        i: '☔️',
        price: { full: 2000, half: 1000 },
        maxNumbers: 10,
        prizesCount: 6,
        prizes: [{ place: 1, prize: 3000 }, { place: 2, prize: 2000 }, { place: 3, prize: 4000 }, { place: 4, prize: 1500 }, { place: 5, prize: 3000 }, { place: 6, prize: 4000 }]
    },
    цветочек: {
        h: '🌸🌷🌸🌷🌸🌷🌸🌷🌸🌷\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌸🌸 *{price_full}₽➖{price_half}₽* 🌸🌸\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌸1️⃣🌸 3️⃣0️⃣0️⃣0️⃣ 🌷\n🌸2️⃣🌸 1️⃣5️⃣0️⃣0️⃣ 🌷\n🌸3️⃣🌸 2️⃣0️⃣0️⃣0️⃣ 🌷\n🌸4️⃣🌸 3️⃣0️⃣0️⃣0️⃣ 🌷',
        i: '🌸',
        price: { full: 2000, half: 1000 },
        maxNumbers: 6,
        prizesCount: 4,
        prizes: [{ place: 1, prize: 3000 }, { place: 2, prize: 1500 }, { place: 3, prize: 2000 }, { place: 4, prize: 3000 }]
    },
    улитка: {
        h: '🐌🍃🐌🍃🐌🍃🐌🍃🐌🍃\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🐌🐌 *{price_full}₽➖{price_half}₽* 🐌🐌\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🐌1️⃣🐌 3️⃣0️⃣0️⃣0️⃣ 🍃\n🐌2️⃣🐌 2️⃣0️⃣0️⃣0️⃣ 🍃\n🐌3️⃣🐌 3️⃣0️⃣0️⃣0️⃣ 🍃\n🐌4️⃣🐌 2️⃣0️⃣0️⃣0️⃣ 🍃\n🐌5️⃣🐌 1️⃣5️⃣0️⃣0️⃣ 🍃',
        i: '🐌',
        price: { full: 2000, half: 1000 },
        maxNumbers: 7,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 3000 }, { place: 2, prize: 2000 }, { place: 3, prize: 3000 }, { place: 4, prize: 2000 }, { place: 5, prize: 1500 }]
    },
    звездопад: {
        h: '💥💫💥💫💥💫💥💫💥💫\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌠🌠 *{price_full}₽➖{price_half}₽* 🌠🌠\n✩⢄⢁✧ --------- ✧⡈⡠✩\n💫💥1️⃣💫💥5️⃣0️⃣0️⃣🌟\n💫💥2️⃣💫💥5️⃣0️⃣0️⃣🌟\n💫💥3️⃣💫💥5️⃣0️⃣0️⃣🌟\n💫💥4️⃣💫💥5️⃣0️⃣0️⃣🌟\n💫💥5️⃣💫💥5️⃣0️⃣0️⃣🌟\n💫💥6️⃣💫💥5️⃣0️⃣0️⃣🌟\n💫💥7️⃣💫💥5️⃣0️⃣0️⃣🌟\n💫💥8️⃣💫💥5️⃣0️⃣0️⃣🌟\n💫💥9️⃣💫💥5️⃣0️⃣0️⃣🌟\n💫💥🔟💫💥5️⃣0️⃣0️⃣🌟\n💫💥1️⃣1️⃣💥5️⃣0️⃣0️⃣🌟',
        i: '🌠',
        price: { full: 1000, half: 500 },
        maxNumbers: 11,
        prizesCount: 11,
        prizes: [{ place: 1, prize: 500 }, { place: 2, prize: 500 }, { place: 3, prize: 500 }, { place: 4, prize: 500 }, { place: 5, prize: 500 }, { place: 6, prize: 500 }, { place: 7, prize: 500 }, { place: 8, prize: 500 }, { place: 9, prize: 500 }, { place: 10, prize: 500 }, { place: 11, prize: 500 }]
    },
    десяточка: {
        h: '🔟💎🔟💎🔟💎🔟💎🔟💎\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🔟🔟 *{price_full}₽➖{price_half}₽* 🔟🔟\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🔟1️⃣🔟 1️⃣0️⃣0️⃣0️⃣0️⃣ 💎\n🔟2️⃣🔟 1️⃣0️⃣0️⃣0️⃣0️⃣ 💎\n🔟3️⃣🔟 1️⃣0️⃣0️⃣0️⃣0️⃣ 💎\n🔟4️⃣🔟 8️⃣0️⃣0️⃣0️⃣ 💎\n🔟5️⃣🔟 3️⃣5️⃣0️⃣0️⃣ 💎',
        i: '🔟',
        price: { full: 4000, half: 2000 },
        maxNumbers: 11,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 10000 }, { place: 2, prize: 10000 }, { place: 3, prize: 10000 }, { place: 4, prize: 8000 }, { place: 5, prize: 3500 }]
    },
    апельсинка: {
        h: '🍊🍊🍊🍊🍊🍊🍊🍊🍊🍊\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍊🍊 *{price_full}₽➖{price_half}₽* 🍊🍊\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍊1️⃣🍊 6️⃣0️⃣0️⃣0️⃣ 🍊\n🍊2️⃣🍊 3️⃣0️⃣0️⃣0️⃣ 🍊\n🍊3️⃣🍊 3️⃣5️⃣0️⃣0️⃣ 🍊',
        i: '🍊',
        price: { full: 3000, half: 1500 },
        maxNumbers: 5,
        prizesCount: 3,
        prizes: [{ place: 1, prize: 6000 }, { place: 2, prize: 3000 }, { place: 3, prize: 3500 }]
    },
    смерч: {
        h: '🌪️💨🌪️💨🌪️💨🌪️💨🌪️💨\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌪️🌪️ *{price_full}₽➖{price_half}₽* 🌪️🌪️\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌪️1️⃣🌪️ 2️⃣0️⃣0️⃣0️⃣ 💨\n🌪️2️⃣🌪️ 1️⃣0️⃣0️⃣0️⃣ 💨\n🌪️3️⃣🌪️ 1️⃣2️⃣0️⃣0️⃣ 💨\n🌪️4️⃣🌪️ 1️⃣2️⃣0️⃣0️⃣ 💨\n🌪️5️⃣🌪️ 2️⃣1️⃣0️⃣0️⃣ 💨',
        i: '🌪️',
        price: { full: 1000, half: 500 },
        maxNumbers: 10,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 2000 }, { place: 2, prize: 1000 }, { place: 3, prize: 1200 }, { place: 4, prize: 1200 }, { place: 5, prize: 2100 }]
    },
    пустыня: {
        h: '🏜️🐪🏜️🐪🏜️🐪🏜️🐪🏜️🐪\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🏜️🏜️ *{price_full}₽➖{price_half}₽* 🏜️🏜️\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🏜️1️⃣🏜️ 8️⃣0️⃣0️⃣ 🐪\n🏜️2️⃣🏜️ 4️⃣0️⃣0️⃣ 🐪\n🏜️3️⃣🏜️ 6️⃣0️⃣0️⃣ 🐪\n🏜️4️⃣🏜️ 8️⃣0️⃣0️⃣ 🐪\n🏜️5️⃣🏜️ 9️⃣0️⃣0️⃣ 🐪',
        i: '🏜️',
        price: { full: 600, half: 300 },
        maxNumbers: 10,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 800 }, { place: 2, prize: 400 }, { place: 3, prize: 600 }, { place: 4, prize: 800 }, { place: 5, prize: 900 }]
    },
    алмаз: {
        h: '💎✨💎✨💎✨💎✨💎✨\n✩⢄⢁✧ --------- ✧⡈⡠✩\n💎💎 *{price_full}₽➖{price_half}₽* 💎💎\n✩⢄⢁✧ --------- ✧⡈⡠✩\n💎1️⃣💎 3️⃣0️⃣0️⃣0️⃣ ✨\n💎2️⃣💎 1️⃣0️⃣0️⃣0️⃣ ✨\n💎3️⃣💎 1️⃣0️⃣0️⃣0️⃣ ✨\n💎4️⃣💎 1️⃣0️⃣0️⃣0️⃣ ✨\n💎5️⃣💎 1️⃣0️⃣0️⃣0️⃣ ✨\n💎6️⃣💎 1️⃣5️⃣0️⃣0️⃣ ✨\n💎7️⃣💎 2️⃣0️⃣0️⃣0️⃣ ✨\n💎8️⃣💎 1️⃣0️⃣0️⃣0️⃣ ✨\n💎9️⃣💎 1️⃣0️⃣0️⃣0️⃣ ✨\n💎🔟💎 2️⃣0️⃣0️⃣0️⃣ ✨',
        i: '💎',
        price: { full: 2000, half: 1000 },
        maxNumbers: 10,
        prizesCount: 10,
        prizes: [{ place: 1, prize: 3000 }, { place: 2, prize: 1000 }, { place: 3, prize: 1000 }, { place: 4, prize: 1000 }, { place: 5, prize: 1000 }, { place: 6, prize: 1500 }, { place: 7, prize: 2000 }, { place: 8, prize: 1000 }, { place: 9, prize: 1000 }, { place: 10, prize: 2000 }]
    },
    сирень: {
        h: '🌿🌸🌿🌸🌿🌸🌿🌸🌿🌸\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌿🌿 *{price_full}₽➖{price_half}₽* 🌿🌿\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌿1️⃣🌿 4️⃣0️⃣0️⃣0️⃣ 🌸\n🌿2️⃣🌿 1️⃣6️⃣0️⃣0️⃣ 🌸\n🌿3️⃣🌿 1️⃣3️⃣0️⃣0️⃣ 🌸\n🌿4️⃣🌿 2️⃣4️⃣0️⃣0️⃣ 🌸\n🌿5️⃣🌿 1️⃣0️⃣0️⃣0️⃣ 🌸',
        i: '🌿',
        price: { full: 1600, half: 800 },
        maxNumbers: 8,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 4000 }, { place: 2, prize: 1600 }, { place: 3, prize: 1300 }, { place: 4, prize: 2400 }, { place: 5, prize: 1000 }]
    },
    ледовик: {
        h: '❄️🧊❄️🧊❄️🧊❄️🧊❄️🧊\n✩⢄⢁✧ --------- ✧⡈⡠✩\n❄️❄️ *{price_full}₽➖{price_half}₽* ❄️❄️\n✩⢄⢁✧ --------- ✧⡈⡠✩\n❄️1️⃣❄️ 5️⃣5️⃣0️⃣0️⃣ 🧊\n❄️2️⃣❄️ 3️⃣0️⃣0️⃣0️⃣ 🧊\n❄️3️⃣❄️ 3️⃣0️⃣0️⃣0️⃣ 🧊\n❄️4️⃣❄️ 2️⃣0️⃣0️⃣0️⃣ 🧊\n❄️5️⃣❄️ 4️⃣0️⃣0️⃣0️⃣ 🧊',
        i: '❄️',
        price: { full: 2000, half: 1000 },
        maxNumbers: 10,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 5500 }, { place: 2, prize: 3000 }, { place: 3, prize: 3000 }, { place: 4, prize: 2000 }, { place: 5, prize: 4000 }]
    },
    капуста: {
        h: '🥬🥬🥬🥬🥬🥬🥬🥬🥬🥬\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🥬🥬 *{price_full}₽➖{price_half}₽* 🥬🥬\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🥬1️⃣🥬 5️⃣0️⃣0️⃣0️⃣ 🥬\n🥬2️⃣🥬 3️⃣0️⃣0️⃣0️⃣ 🥬\n🥬3️⃣🥬 3️⃣0️⃣0️⃣0️⃣ 🥬\n🥬4️⃣🥬 3️⃣0️⃣0️⃣0️⃣ 🥬\n🥬5️⃣🥬 4️⃣5️⃣0️⃣0️⃣ 🥬',
        i: '🥬',
        price: { full: 3000, half: 1500 },
        maxNumbers: 7,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 5000 }, { place: 2, prize: 3000 }, { place: 3, prize: 3000 }, { place: 4, prize: 3000 }, { place: 5, prize: 4500 }]
    },
    коктейль: {
        h: '🍹🥂🍹🥂🍹🥂🍹🥂🍹🥂\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍹🍹 *{price_full}₽➖{price_half}₽* 🍹🍹\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍹1️⃣🍹 1️⃣0️⃣0️⃣0️⃣0️⃣ 🥂\n🍹2️⃣🍹 5️⃣0️⃣0️⃣0️⃣ 🥂\n🍹3️⃣🍹 1️⃣0️⃣0️⃣0️⃣0️⃣ 🥂\n🍹4️⃣🍹 5️⃣0️⃣0️⃣0️⃣ 🥂\n🍹5️⃣🍹 8️⃣5️⃣0️⃣0️⃣ 🥂\n🍹6️⃣🍹 5️⃣0️⃣0️⃣0️⃣ 🥂\n🍹7️⃣🍹 2️⃣0️⃣0️⃣0️⃣ 🥂',
        i: '🍹',
        price: { full: 4000, half: 2000 },
        maxNumbers: 12,
        prizesCount: 7,
        prizes: [{ place: 1, prize: 10000 }, { place: 2, prize: 5000 }, { place: 3, prize: 10000 }, { place: 4, prize: 5000 }, { place: 5, prize: 8500 }, { place: 6, prize: 5000 }, { place: 7, prize: 2000 }]
    },
    орешек: {
        h: '🌰🥜🌰🥜🌰🥜🌰🥜🌰🥜\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌰🌰 *{price_full}₽➖{price_half}₽* 🌰🌰\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🌰1️⃣🌰 1️⃣2️⃣0️⃣0️⃣ 🥜\n🌰2️⃣🌰 8️⃣0️⃣0️⃣ 🥜\n🌰3️⃣🌰 1️⃣0️⃣0️⃣0️⃣ 🥜\n🌰4️⃣🌰 3️⃣0️⃣0️⃣0️⃣ 🥜\n🌰5️⃣🌰 1️⃣0️⃣0️⃣0️⃣ 🥜\n🌰6️⃣🌰 5️⃣0️⃣0️⃣ 🥜',
        i: '🌰',
        price: { full: 1000, half: 500 },
        maxNumbers: 10,
        prizesCount: 6,
        prizes: [{ place: 1, prize: 1200 }, { place: 2, prize: 800 }, { place: 3, prize: 1000 }, { place: 4, prize: 3000 }, { place: 5, prize: 1000 }, { place: 6, prize: 500 }]
    },
    шашлычок: {
        h: '🍢🔥🍢🔥🍢🔥🍢🔥🍢🔥\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍢🍢 *{price_full}₽➖{price_half}₽* 🍢🍢\n✩⢄⢁✧ --------- ✧⡈⡠✩\n🍢1️⃣🍢 1️⃣5️⃣0️⃣0️⃣ 🔥\n🍢2️⃣🍢 1️⃣0️⃣0️⃣0️⃣ 🔥\n🍢3️⃣🍢 1️⃣0️⃣0️⃣0️⃣ 🔥\n🍢4️⃣🍢 1️⃣0️⃣0️⃣0️⃣ 🔥\n🍢5️⃣🍢 1️⃣0️⃣0️⃣0️⃣ 🔥',
        i: '🍢',
        price: { full: 800, half: 400 },
        maxNumbers: 10,
        prizesCount: 5,
        prizes: [{ place: 1, prize: 1500 }, { place: 2, prize: 1000 }, { place: 3, prize: 1000 }, { place: 4, prize: 1000 }, { place: 5, prize: 1000 }]
    }
};
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
const horos = [
    '♈ Овен: 3, 7, 11',
    '♉ Телец: 4, 8, 12',
    '♊ Близнецы: 1, 5, 9',
    '♋ Рак: 2, 6, 10',
    '♌ Лев: 7, 14, 20',
    '♍ Дева: 3, 9, 15',
    '♎ Весы: 2, 8, 11',
    '♏ Скорпион: 4, 10, 16',
    '♐ Стрелец: 5, 12, 18',
    '♑ Козерог: 1, 6, 13',
    '♒ Водолей: 3, 7, 14',
    '♓ Рыбы: 9, 13, 16'
];
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
    
    // Каждые 10 игр = 1 мешочек, игры при этом уменьшаются
    while (db[playerKey].games >= 10) {
        db[playerKey].tickets += 1;
        db[playerKey].games -= 10;
    }
}

function showPiggy(chatId) {
    let totalTickets = 0;
    for (let key in db) if (db[key]?.tickets) totalTickets += db[key].tickets;
    sendMessage(chatId, `🐷 *КОПИЛКА-СВИНКА* 🐷\n━━━━━━━━━━━━━━━━━━\n💰 Сумма: *${piggyBank}₽*\n🎟️ Мешочков: *${totalTickets}*`);
}

function breakPiggy(chatId) {
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
    
// Сохраняем в историю
piggyHistory.push({
    date: new Date().toISOString(),
    amount: piggyBank,
    participants: participants.map(p => ({
        name: getDisplayName(p.key),
        tickets: p.tickets,
        winnings: Math.floor((piggyBank / totalTickets) * p.tickets)
    }))
});
    
    piggyBank = 0;
    msg += `\n\n━━━━━━━━━━━━━━━━━━\n🎉 ПОЗДРАВЛЯЕМ! 🎉`;
    sendMessage(chatId, msg);
}

function renderLot() {
    const s = styles[game.style];
    const p = s.price;
    const repeatText = game.repeat ? ' 🔁 *ЛОТ С ПОВТОРОМ* 🔁' : '';
    
    // Берём ТВОЁ красивое оформление
    let res = s.h;
    
    // Подставляем цены
    res = res.replace(/\{price_full\}/g, p.full);
    res = res.replace(/\{price_half\}/g, p.half);
    
    // Добавляем номерки с игроками ВНИЗУ (как в твоём примере)
    res += `\n✩⢄⢁✧ --------- ✧⡈⡠✩\n`;
    
    for (let i = 1; i <= game.max; i++) {
        const slot = game.slots[i];
        const emoji = emj[i] || i;
        
        if (!slot) {
            res += `${emoji}. 🟢\n`;
        } else if (slot.full) {
            const playerKey = getPlayerKey(slot.full);
            const displayName = playerKey ? getDisplayNameNoId(playerKey) : (slot.fullName || slot.full.split('|')[0]);
            res += `${emoji}. ${displayName}\n`;
        } else {
            const leftName = slot.left ? (getPlayerKey(slot.left) ? getDisplayNameNoId(getPlayerKey(slot.left)) : (slot.leftName || slot.left.split('|')[0])) : null;
            const rightName = slot.right ? (getPlayerKey(slot.right) ? getDisplayNameNoId(getPlayerKey(slot.right)) : (slot.rightName || slot.right.split('|')[0])) : null;
            
            if (leftName && rightName) {
                res += `${emoji}. ${leftName} / ${rightName}\n`;
            } else if (leftName) {
                res += `${emoji}. ${leftName} /\n`;
            } else if (rightName) {
                res += `${emoji}. / ${rightName}\n`;
            }
        }
    }
    
    if (game.paused) {
        res += `\n⏸️ *ЛОТ НА ПАУЗЕ* ⏸️`;
        if (game.startedBy && lotInfo[game.startedBy]) {
            res += `\n📋 ${lotInfo[game.startedBy]}`;
        }
    }
    
    return res;
}
async function payout(chatId, winners, adminName) {
    const s = styles[game.style];
    
    const prizes = s.prizes || [
        { place: 1, prize: 1000 },
        { place: 2, prize: 5000 },
        { place: 3, prize: 1000 },
        { place: 4, prize: 2500 }
    ];

    let msg = `🏆 *ВЫПЛАТА ПОБЕДИТЕЛЯМ* 🏆\n━━━━━━━━━━━━━━━━━━\n`;
    let total = 0;
    let winnersList = [];

    for (let idx = 0; idx < Math.min(winners.length, prizes.length); idx++) {
        const num = winners[idx];
        const slot = game.slots[num];
        if (!slot) continue;

        let prizeMoney = prizes[idx].prize;
        if (prizeMoney === 0) continue;

        if (!slot.full && (slot.left || slot.right)) {
            prizeMoney = Math.floor(prizeMoney / 2);
        }

        if (slot.full) {
            // Ищем игрока по ID из slot.full или по имени
            let playerKey = null;
            
            // Пытаемся вытащить ID из формата "имя|id:123"
            const idMatch = slot.full.match(/id:(\d+)/);
            if (idMatch) {
                const playerId = parseInt(idMatch[1]);
                playerKey = Object.keys(db).find(key => db[key]?.id === playerId);
            }
            
            // Если не нашли по ID, ищем по имени
            if (!playerKey) {
                const playerName = slot.fullName || slot.full.split('|')[0];
                playerKey = getPlayerKey(playerName);
            }
            
            if (playerKey) {
                db[playerKey].balance = (db[playerKey].balance || 0) + prizeMoney;
                winnersList.push(`${idx + 1}️⃣ ${getDisplayNameNoId(playerKey)} → +${prizeMoney}₽`);
                total += prizeMoney;
                if (!db[playerKey].wins) db[playerKey].wins = 0;
                db[playerKey].wins++;
            } else {
                winnersList.push(`${idx + 1}️⃣ ${slot.fullName || slot.full.split('|')[0]} → +${prizeMoney}₽ (не найден в базе)`);
                total += prizeMoney;
            }
        } else {
            if (slot.left) {
                let playerKey = null;
                const idMatch = slot.left.match(/id:(\d+)/);
                if (idMatch) {
                    const playerId = parseInt(idMatch[1]);
                    playerKey = Object.keys(db).find(key => db[key]?.id === playerId);
                }
                if (!playerKey) {
                    const playerName = slot.leftName || slot.left.split('|')[0];
                    playerKey = getPlayerKey(playerName);
                }
                
                if (playerKey) {
                    db[playerKey].balance = (db[playerKey].balance || 0) + prizeMoney;
                    winnersList.push(`${idx + 1}️⃣ ${getDisplayNameNoId(playerKey)} → +${prizeMoney}₽ (левая)`);
                    total += prizeMoney;
                    if (!db[playerKey].wins) db[playerKey].wins = 0;
                    db[playerKey].wins++;
                } else {
                    winnersList.push(`${idx + 1}️⃣ ${slot.leftName || slot.left.split('|')[0]} → +${prizeMoney}₽ (левая, не найден)`);
                    total += prizeMoney;
                }
            }
            if (slot.right && slot.left !== slot.right) {
                let playerKey = null;
                const idMatch = slot.right.match(/id:(\d+)/);
                if (idMatch) {
                    const playerId = parseInt(idMatch[1]);
                    playerKey = Object.keys(db).find(key => db[key]?.id === playerId);
                }
                if (!playerKey) {
                    const playerName = slot.rightName || slot.right.split('|')[0];
                    playerKey = getPlayerKey(playerName);
                }
                
                if (playerKey) {
                    db[playerKey].balance = (db[playerKey].balance || 0) + prizeMoney;
                    winnersList.push(`${idx + 1}️⃣ ${getDisplayNameNoId(playerKey)} → +${prizeMoney}₽ (правая)`);
                    total += prizeMoney;
                    if (!db[playerKey].wins) db[playerKey].wins = 0;
                    db[playerKey].wins++;
                } else {
                    winnersList.push(`${idx + 1}️⃣ ${slot.rightName || slot.right.split('|')[0]} → +${prizeMoney}₽ (правая, не найден)`);
                    total += prizeMoney;
                }
            }
        }
    }

    if (winnersList.length > 0) {
        msg += winnersList.join('\n');
    } else {
        msg += `❌ Нет победителей`;
    }

    const piggyContribution = 1000;
    msg += `\n\n━━━━━━━━━━━━━━━━━━\n💰 *ОБЩИЙ ВЫИГРЫШ:* ${total}₽\n🐷 *В КОПИЛКУ:* +${piggyContribution}₽\n🎉 *ПОЗДРАВЛЯЕМ ПОБЕДИТЕЛЕЙ!* 🎉`;
    await sendMessage(chatId, msg);

    piggyBank += piggyContribution;
    stats.totalLots++;
    if (!stats.adminLots) stats.adminLots = {};
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

    let startDate = 'неизвестно';
    if (stats.reportDate) {
        try {
            const d = new Date(stats.reportDate);
            if (!isNaN(d.getTime())) {
                startDate = d.toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch(e) { console.error('Ошибка парсинга даты:', e); }
    }

    const generalReport = `📊 *ОТЧЕТ: ОБЩАЯ СТАТИСТИКА* 📊
━━━━━━━━━━━━━━━━━━
📅 *Период:* ${startDate} — сейчас
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
    const group = getGroupData(chatId);
    const exportObj = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        db: group.db,
        game: group.game,
        piggyBank: group.piggyBank,
        piggyHistory: group.piggyHistory,
        stats: group.stats,
        lotInfo: group.lotInfo
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
        group.game = data.game || { active: false, paused: false, style: 'обезьянка', slots: {}, max: 0, repeat: false };
        group.piggyBank = data.piggyBank || 0;
        group.piggyHistory = data.piggyHistory || [];
        group.stats = data.stats || { totalLots: 0, adminLots: {}, totalGames: 0, reportDate: new Date() };
        group.lotInfo = data.lotInfo || {};
        await sendMessage(chatId, `✅ *ИМПОРТ ВЫПОЛНЕН*\n👥 Игроков: ${Object.keys(group.db).length}\n🐷 Копилка: ${group.piggyBank}₽`);
    } catch (err) {
        await sendMessage(chatId, `❌ Ошибка: ${err.message}`);
    }
}
async function handleMessage(chatId, sender, text, groupName) {

// Получаем данные для этой группы
const group = getGroupData(chatId);
db = group.db;  // ← обновляем глобальную db
game = group.game;
stats = group.stats;
lotInfo = group.lotInfo;
piggyBank = group.piggyBank;
piggyHistory = group.piggyHistory;

// Проверка лицензии (если группа не в списке разрешённых и не босс)
const isLicensed = hasLicense(chatId);
const isBossHere = sender === BOSS;

if (!isLicensed && !isBossHere && !ALLOWED_GROUPS.includes(groupName)) {
    await sendMessage(chatId, `❌ *ГРУППА НЕ АКТИВИРОВАНА*\n━━━━━━━━━━━━━━━━━━\nДля использования бота необходима лицензия.\n\n💰 Стоимость: от 5000₽/месяц\n📞 Для активации обратитесь к @${BOSS}`);
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

    const isAdminUser = isAdmin(sender);
    const playerExists = getPlayerKey(sender) !== null;

    // ===== ПРОВЕРКА РЕГИСТРАЦИИ =====
    if (!playerExists && cmd.startsWith('/') && cmd !== '/регистрация') {
        await sendMessage(chatId, `❌ *ДОСТУП ЗАПРЕЩЁН* ❌
━━━━━━━━━━━━━━━━━━
👤 ${sender}, вы не зарегистрированы в системе для игры.

✅ Для регистрации напишите:
/регистрация

💡 Регистрация бесплатна!`);
        return;
    }

    if (!playerExists && !cmd.startsWith('/') && !cmd.startsWith('.') && cmd.length > 1) {
        await sendMessage(chatId, `👋 *Здравствуйте, ${sender}!* 👋
━━━━━━━━━━━━━━━━━━
Вы не зарегистрированы в системе игры.

✅ Для регистрации напишите:
/регистрация

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
            await sendMessage(chatId, `💰 *БАЛАНС*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n💎 0₽\n\n💡 Напишите /регистрация`);
            return;
        }
        await sendMessage(chatId, `💰 *БАЛАНС*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(playerKey)}\n💎 ${db[playerKey]?.balance || 0}₽`);
        return;
    }
    if (cmd === '/статистика') {
        const playerKey = getPlayerKey(sender);
        if (!playerKey) {
            await sendMessage(chatId, `📊 *СТАТИСТИКА*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n🎲 Игр: 0\n🎟️ Меш.: 0\n🏆 Побед: 0\n💰 Баланс: 0₽\n\n💡 Напишите /регистрация`);
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
    const signs = [
        '♈ Овен', '♉ Телец', '♊ Близнецы', '♋ Рак',
        '♌ Лев', '♍ Дева', '♎ Весы', '♏ Скорпион',
        '♐ Стрелец', '♑ Козерог', '♒ Водолей', '♓ Рыбы'
    ];
    
    const randomSign = signs[Math.floor(Math.random() * signs.length)];
    
    // Генерируем 3 случайных числа от 1 до 20
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

// Получаем ID игрока для привязки
const playerId = db[playerKey]?.id || null;
const playerIdentifier = playerId ? `${sender}|id:${playerId}` : sender;

for (const bet of validBets) {
    if (!game.slots[bet.num]) game.slots[bet.num] = {};
    if (bet.type === 'full') {
        game.slots[bet.num].full = playerIdentifier;
        game.slots[bet.num].fullId = playerId;
        game.slots[bet.num].fullName = sender;
    } else if (bet.type === 'half') {
        if (!game.slots[bet.num].left) {
            game.slots[bet.num].left = playerIdentifier;
            game.slots[bet.num].leftId = playerId;
            game.slots[bet.num].leftName = sender;
        } else if (!game.slots[bet.num].right) {
            game.slots[bet.num].right = playerIdentifier;
            game.slots[bet.num].rightId = playerId;
            game.slots[bet.num].rightName = sender;
        }
    }
}

        // НАЧИСЛЕНИЕ ИГР ЗА СТАВКИ (исправлено!)
        for (const bet of validBets) {
            if (bet.type === 'full') {
                addGamePlay(playerKey, 1);
                stats.totalGames += 1;
            } else if (bet.type === 'half') {
                addGamePlay(playerKey, 0.5);
                stats.totalGames += 0.5;
            }
        }

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
        }

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

🎟️ *МЕШОЧКИ*
.мешочки [имя или ID] + [сумма]

🎲 *ЛОТ*
.номерки (ИМЯ ИЛИ ID)
.стили
.начать [стиль] [повтор]
.список | .пауза | .продолжить
.победители [1 2 3 4 5 6]

🐷 *КОПИЛКА*
.копилка + [сумма] | .копилка - [сумма] | .копилка = [сумма]
.разбить

📊 *ОТЧЁТ*
.отчет — полная статистика от запуска до команды отчета

📦 *ВОССТАНОВЛЕНИЕ (для сис.админа)*
.экспорт — выгрузить все данные
.вставить [JSON] — восстановить из бэкапа

📋 *ИНФО*
.инфо [текст] — сохранить информацию о себе
.инфо — показать свою информацию
.стереть инфо — удалить свою информацию`);
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
        lotInfo[sender] = args;
        await sendMessage(chatId, `✅ *ИНФОРМАЦИЯ СОХРАНЕНА*\n━━━━━━━━━━━━━━━━━━\n👤 ${sender}\n📝 *Текст:*\n${args}`);
        return;
    }
      if (cmd === '.снять' && args && game.active) {
        const targetName = args.trim();
        
        // Пытаемся найти игрока по ID или имени
        let targetKey = getPlayerKey(targetName);
        let targetId = null;
        let targetPlayerName = targetName;
        
        if (targetKey && db[targetKey]) {
            targetId = db[targetKey].id;
            targetPlayerName = targetKey.split(' (')[0];
        }
        
        let removedBets = [];
        let totalRefund = 0;
        const p = styles[game.style].price;
        
        // ИСПРАВЛЕННАЯ ФУНКЦИЯ ПОИСКА
        function matchesPlayer(slotValue) {
            if (!slotValue) return false;
            
            // Если у нас есть ID цели — ищем точное совпадение по ID в строке
            if (targetId) {
                // Ищем формат "id:123"
                const idMatch = slotValue.match(/id:(\d+)/);
                if (idMatch && parseInt(idMatch[1]) === targetId) return true;
            }
            
            // Если нет targetId — ищем по точному совпадению имени (без учёта регистра)
            if (slotValue.toLowerCase() === targetName.toLowerCase()) return true;
            
            // Проверяем, не совпадает ли полное имя (originalName) из слота
            if (slotValue.includes('|')) {
                const originalName = slotValue.split('|')[0];
                if (originalName.toLowerCase() === targetName.toLowerCase()) return true;
            }
            
            return false;
        }
        
        for (let i = 1; i <= game.max; i++) {
            const slot = game.slots[i];
            if (!slot) continue;
            
            // Полная ставка
            if (slot.full && matchesPlayer(slot.full)) {
                delete game.slots[i];
                removedBets.push({ num: i, type: 'full', price: p.full, playerName: slot.fullName || slot.full });
                totalRefund += p.full;
                continue;
            }
            
            // Левая половинка
            if (slot.left && matchesPlayer(slot.left)) {
                delete slot.left;
                delete slot.leftId;
                delete slot.leftName;
                removedBets.push({ num: i, type: 'половинка (левая)', price: p.half, playerName: slot.leftName || slot.left });
                totalRefund += p.half;
                if (!slot.left && !slot.right) delete game.slots[i];
                continue;
            }
            
            // Правая половинка
            if (slot.right && matchesPlayer(slot.right)) {
                delete slot.right;
                delete slot.rightId;
                delete slot.rightName;
                removedBets.push({ num: i, type: 'половинка (правая)', price: p.half, playerName: slot.rightName || slot.right });
                totalRefund += p.half;
                if (!slot.left && !slot.right) delete game.slots[i];
                continue;
            }
        }
        
        if (removedBets.length === 0) {
            await sendMessage(chatId, `❌ У игрока ${targetPlayerName} нет ставок в текущем лоте`);
            return;
        }
        
        // Возвращаем деньги
        let playerKeyForBalance = targetKey;
        if (!playerKeyForBalance) {
            playerKeyForBalance = ensurePlayer(targetPlayerName);
        }
        
        if (playerKeyForBalance) {
            db[playerKeyForBalance].balance = (db[playerKeyForBalance].balance || 0) + totalRefund;
        }
        
        // Формируем сообщение
        let msg = `🗑️ *СНЯТИЕ СТАВОК* 🗑️\n━━━━━━━━━━━━━━━━━━\n👤 Игрок: ${targetPlayerName}\n🎲 Снято ставок: ${removedBets.length}\n\n`;
        for (const bet of removedBets) {
            msg += `   🔸 Номер ${bet.num} (${bet.type}) — ${bet.price}₽\n`;
        }
        msg += `\n💰 ВОЗВРАЩЕНО: ${totalRefund}₽`;
        if (playerKeyForBalance) {
            msg += `\n💰 Новый баланс: ${db[playerKeyForBalance].balance}₽`;
        }
        msg += `\n\n${renderLot()}`;
        
        await sendMessage(chatId, msg);
        return;
    }

// ===== ЛИЦЕНЗИИ =====
if (cmd === '.лицензия' && args) {
if (!isHeadquarters(groupName) && sender !== BOSS) {
        await sendMessage(chatId, `❌ *ДОСТУП ЗАПРЕЩЁН*`);
        return;
    }
    
    // Поддерживаем кавычки для названий с пробелами
    let parts = [];
    let match;
    const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
    while ((match = regex.exec(args)) !== null) {
        const part = match[1] || match[2] || match[3];
        if (part) parts.push(part);
    }
    
    // .лицензия список
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
    
    // .лицензия удалить группа
    if (parts[0] === 'удалить' && parts[1]) {
        const targetChatId = parts[1];
        if (licenses[targetChatId]) {
            delete licenses[targetChatId];
            await sendMessage(chatId, `🗑️ Лицензия для ${targetChatId} удалена`);
            await saveLicenses();
        } else {
            await sendMessage(chatId, `❌ Лицензия для ${targetChatId} не найдена`);
        }
        return;
    }
    
    // .лицензия "Название группы" дни
    if (parts.length >= 2) {
        const targetChatId = parts[0];
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
        
        await sendMessage(chatId, `✅ *ЛИЦЕНЗИЯ ДОБАВЛЕНА*\n━━━━━━━━━━━━━━━━━━\n📌 Группа: ${targetChatId}\n📅 До: ${expireDate.toLocaleDateString()}\n⏰ Срок: ${days} дней`);
        
        try {
            await sendMessage(targetChatId, `🎉 *ГРУППА АКТИВИРОВАНА!*\n━━━━━━━━━━━━━━━━━━\nБот активирован на ${days} дней.\nДо: ${expireDate.toLocaleDateString()}\n\nПриятной игры! 🎲`);
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
    
    if (cmd === '.инфо' && !args && isAdminUser) {
        const info = lotInfo[sender];
        if (info) {
            await sendMessage(chatId, `📋 *ВАША ИНФОРМАЦИЯ*\n━━━━━━━━━━━━━━━━━━\n${info}`);
        } else {
            await sendMessage(chatId, `ℹ️ *У ВАС НЕТ СОХРАНЕННОЙ ИНФОРМАЦИИ*\n━━━━━━━━━━━━━━━━━━\nИспользуйте: .инфо [текст]`);
        }
        return;
    }
    
    if (cmd === '.стереть инфо' && isAdminUser) {
        delete lotInfo[sender];
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
            } 
            else if (parts[0] === '+' || parts[0] === '-' || parts[0] === '=') {
                op = parts[0];
                nameOrId = parts[1];
                val = parseInt(parts[2]);
            }
        }
        
        if (!op || isNaN(val)) {
            await sendMessage(chatId, '❌ .мешочки [имя или ID] + [число] | .мешочки + [имя] [число] | .мешочки [имя] = [число]');
            return;
        }
        
        let key = getPlayerKey(nameOrId);
        if (!key) {
            await sendMessage(chatId, `❌ Игрок "${nameOrId}" не найден`);
            return;
        }
        
        let currentTickets = db[key].tickets || 0;
        let newTickets = currentTickets;
        
        if (op === '+') {
            newTickets = currentTickets + val;
        } else if (op === '-') {
            newTickets = currentTickets - val;
            if (newTickets < 0) newTickets = 0;
        } else if (op === '=') {
            newTickets = val;
            if (newTickets < 0) newTickets = 0;
        }
        
        db[key].tickets = newTickets;
        await sendMessage(chatId, `🎟️ *МЕШОЧКИ ИЗМЕНЕНЫ*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key)}\n📉 Было: ${currentTickets}\n📈 Стало: ${newTickets}`);
        return;
    }

    // ===== КОПИЛКА (изменение) =====
    if (cmd === '.копилка' && args && isAdminUser) {
        const parts = args.split(/\s+/);
        const op = parts[0];
        const val = parseInt(parts[1]);
        
        if (isNaN(val)) {
            await sendMessage(chatId, '❌ Сумма не число');
            return;
        }
        
        let newPiggy = piggyBank;
        
        if (op === '+') {
            newPiggy = piggyBank + val;
        } else if (op === '-') {
            newPiggy = piggyBank - val;
            if (newPiggy < 0) newPiggy = 0;
        } else if (op === '=') {
            newPiggy = val;
            if (newPiggy < 0) newPiggy = 0;
        } else {
            await sendMessage(chatId, '❌ .копилка + [сумма] | .копилка - [сумма] | .копилка = [сумма]');
            return;
        }
        
        const oldPiggy = piggyBank;
        piggyBank = newPiggy;
        await sendMessage(chatId, `🐷 *КОПИЛКА ИЗМЕНЕНА*\n━━━━━━━━━━━━━━━━━━\n📉 Было: ${oldPiggy}₽\n📈 Стало: ${piggyBank}₽`);
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

    if (cmd === '.продолжить') {
        if (!game.active) {
            await sendMessage(chatId, '❌ Нет активного лота');
            return;
        }
        if (!game.paused) {
            await sendMessage(chatId, '❌ Лот не на паузе');
            return;
        }
        game.paused = false;
        await sendMessage(chatId, `▶️ *ЛОТ ПРОДОЛЖЕН* ▶️\n━━━━━━━━━━━━━━━━━━\nСтавки снова принимаются!\n\n${renderLot()}`);
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

    if (cmd === '.номерки' && args && isAdminUser) {
        const parts = args.trim().split(/\s+/);
        let op = '';
        let nameOrId = '';
        let val = 0;
        
        if (parts.length >= 3) {
            if (parts[1] === '+' || parts[1] === '-' || parts[1] === '=') {
                nameOrId = parts[0];
                op = parts[1];
                val = parseFloat(parts[2]);
            } else if (parts[0] === '+' || parts[0] === '-' || parts[0] === '=') {
                op = parts[0];
                nameOrId = parts[1];
                val = parseFloat(parts[2]);
            }
        }
        
        if (!op || isNaN(val)) {
            await sendMessage(chatId, '❌ .номерки [имя или ID] + [число] | .номерки [имя] = [число]\nПример: .номерки Фаягуль + 2\nПример: .номерки 15 = 5');
            return;
        }
        
        let key = getPlayerKey(nameOrId);
        if (!key) {
            await sendMessage(chatId, `❌ Игрок "${nameOrId}" не найден`);
            return;
        }
        
        let currentGames = db[key].games || 0;
        let newGames = currentGames;
        
        if (op === '+') {
            newGames = currentGames + val;
        } else if (op === '-') {
            newGames = currentGames - val;
            if (newGames < 0) newGames = 0;
        } else if (op === '=') {
            newGames = val;
            if (newGames < 0) newGames = 0;
        }
        
        db[key].games = newGames;
        
        const oldTickets = db[key].tickets || 0;
        const newTickets = Math.floor(newGames / 10);
        db[key].tickets = newTickets;
        
        await sendMessage(chatId, `🎲 *КОЛИЧЕСТВО ИГР ИЗМЕНЕНО*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key)}\n📉 Было игр: ${currentGames}\n📈 Стало игр: ${newGames}\n🎟️ Мешочков: ${oldTickets} → ${newTickets}`);
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

    if (cmd === '.отчет') {
        await generateReport(chatId);
        await sendMessage(chatId, `📋 *ОТЧЁТ СФОРМИРОВАН*\n━━━━━━━━━━━━━━━━━━\nНовый период начат.`);
        return;
    }

    if (cmd === '.разбить') {
        await breakPiggy(chatId);
        return;
    }

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
        const games = db[key]?.games || 0;
        const tickets = db[key]?.tickets || 0;
        const wins = db[key]?.wins || 0;
        const gamesStr = games % 1 === 0 ? games : games.toFixed(1);
        await sendMessage(chatId, `🔎 *РЕЗУЛЬТАТ ПОИСКА*\n━━━━━━━━━━━━━━━━━━\n👤 ${getDisplayName(key)}\n🎲 Игр: ${gamesStr}\n🎟️ Меш.: ${tickets}\n🏆 Побед: ${wins}\n💰 Баланс: ${db[key].balance}₽`);
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
            const maxNumbers = styles[styleName].maxNumbers || 10;
            game = { 
                active: true, 
                paused: false, 
                style: styleName, 
                max: maxNumbers, 
                slots: {},
                repeat: isRepeat,
                startedBy: sender
            };
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
    
    if (cmd === '.пауза') {
        if (!game.active) {
            await sendMessage(chatId, '❌ Нет активного лота');
            return;
        }
        game.paused = true;
        await sendMessage(chatId, `⏸️ *ЛОТ ОСТАНОВЛЕН* ⏸️\n━━━━━━━━━━━━━━━━━━\nЛот завершён. Админ может объявить победителей:\n.победители [номера]\n\n${renderLot()}`);
        return;
    }

    if (cmd === '.стили') {
        let stylesList = '🎨 *ДОСТУПНЫЕ СТИЛИ ЛОТОВ* 🎨\n━━━━━━━━━━━━━━━━━━\n';
        for (const [name, style] of Object.entries(styles)) {
            const price = style.price;
            const maxNum = style.maxNumbers;
            const prizesCount = style.prizesCount || 6;
            stylesList += `\n📌 *${name.toUpperCase()}*\n   🎲 Номеров: ${maxNum}\n   🏆 Победителей: ${prizesCount}\n   💰 Цена: ${price.full}₽ / ${price.half}₽\n`;
        }
        stylesList += `\n━━━━━━━━━━━━━━━━━━\n💡 Команда: .начать [название_стиля] [повтор]`;
        await sendMessage(chatId, stylesList);
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

// Простой ответ при заходе на сайт
app.get('/', (req, res) => {
    res.send('✅ Бот для WhatsApp работает!');
});

// Для проверки живучести (пинг)
app.get('/livez', (req, res) => {
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Бот на порту ${PORT}`));
