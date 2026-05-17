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
    
    // Защита от undefined
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
