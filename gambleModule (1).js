// ============================================================================
// 4.5) GAMBLE ENGINE (Chẵn Lẻ / Tài Xỉu) — tỉ lệ thắng CÔNG KHAI cho user
// ----------------------------------------------------------------------------
// Tỉ lệ thắng giảm dần theo mức cược. Bảng này được hiển thị đầy đủ trong
// panel gamble và trước khi user xác nhận cược — không giấu diếm.
// Thắng: được hoàn lại gấp đôi tiền cược (net +tiền cược).
// Thua: mất tiền cược (đã bị trừ khi đặt cược).
// ============================================================================
const GAMBLE_ODDS_TIERS = [
  { min: 0, label: 'Dưới 5.000.000', winChance: 0.6 },
  { min: 5_000_000, label: 'Từ 5.000.000 đến dưới 20.000.000', winChance: 0.53 },
  { min: 20_000_000, label: 'Từ 20.000.000 đến dưới 50.000.000', winChance: 0.52 },
  { min: 50_000_000, label: 'Từ 50.000.000 trở lên', winChance: 0.5 },
];


function getGambleWinChance(betAmount) {
  let chance = GAMBLE_ODDS_TIERS[0].winChance;
  for (const tier of GAMBLE_ODDS_TIERS) {
    if (betAmount >= tier.min) chance = tier.winChance;
  }
  return chance;
}

function gambleOddsLines() {
  return GAMBLE_ODDS_TIERS.map((t) => `• **${t.label}** → tỉ lệ thắng \`${Math.round(t.winChance * 100)}%\``);
}


function rollGambleOutcome(betAmount) {
  const winChance = getGambleWinChance(betAmount);
  const win = Math.random() < winChance;
  return { win, winChance };
}

function generateChanLeNumber(choice, win) {
  const wantParity = win ? choice : choice === 'chan' ? 'le' : 'chan';
  let num = Math.floor(Math.random() * 100);
  if ((num % 2 === 0 ? 'chan' : 'le') !== wantParity) num = (num + 1) % 100;
  return num;
}

function generateTaiXiuDice(choice, win) {
  const wantSide = win ? choice : choice === 'tai' ? 'xiu' : 'tai';
  let dice;
  let guard = 0;
  do {
    dice = [0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6));
    guard += 1;
  } while ((dice[0] + dice[1] + dice[2] >= 11 ? 'tai' : 'xiu') !== wantSide && guard < 500);
  return dice;
}

// userId -> { game: 'chanle'|'taixiu', choice: 'chan'|'le'|'tai'|'xiu' }, dùng khi mở modal đặt cược
const pendingGambleChoice = new Map();

// ============================================================================
// 5) EMBEDS
// ============================================================================
const COLOR_ACTIVE = 0x57f287;
const COLOR_PAUSED = 0xed4245;
const COLOR_INFO = 0x5865f2;
const COLOR_SUCCESS = 0x57f287;
const COLOR_DANGER = 0xed4245;
const COLOR_WARN = 0xfee75c;

function statusLabel(status) {
  return status === 'active' ? '🟢 Hoạt động' : '🔴 Tạm dừng';
}

function marketPanelEmbed(settings) {
  const updated = settings.lastUpdated
    ? `<t:${Math.floor(settings.lastUpdated / 1000)}:R>`
    : 'chưa cập nhật';

  return new EmbedBuilder()
    .setColor(settings.status === 'active' ? COLOR_ACTIVE : COLOR_PAUSED)
    .setTitle('🍩 Auto Nhận')
    .addFields(
      { name: '💵 Rate', value: `\`${formatNumber(settings.rate)}/1M\``, inline: true },
      { name: '📦 Tối đa có thể tặng', value: `\`${abbreviate(settings.maxGift)} Money\``, inline: true },
      { name: '💳 Quỹ hiện', value: `\`${formatNumber(settings.fund)}\``, inline: true },
      { name: '🛡️ Tặng tối thiểu', value: `${formatNumber(settings.minGift)} Money`, inline: false },
      { name: '🤖 Trạng thái Bot', value: statusLabel(settings.status), inline: true },
      { name: '🕐 Cập nhật lần cuối', value: updated, inline: true }
    )
    .setFooter({ text: 'Nhấn "Tặng Cho Tôi" để bán Money · "Hồ Sơ" để xem số dư' });
}

function profileEmbed(customer, member) {
  return new EmbedBuilder()
    .setColor(COLOR_INFO)
    .setTitle('👤 Hồ sơ của bạn')
    .setThumbnail(member.displayAvatarURL())
    .addFields(
      { name: '💰 Số dư khả dụng', value: formatVND(customer.balance), inline: true },
      { name: '🎮 IGN đã lưu', value: customer.ign || 'Chưa có', inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '📈 Tổng đã nhận', value: formatVND(customer.totalReceived || 0), inline: true },
      { name: '📉 Tổng đã rút', value: formatVND(customer.totalWithdrawn || 0), inline: true },
      { name: '🧾 Số đơn đã duyệt', value: String(customer.ordersCount || 0), inline: true }
    )
    .setFooter({ text: 'Chỉ bạn mới có thể thấy điều này' });
}

function dmPaymentEmbed(order, settings) {
  return new EmbedBuilder()
    .setColor(COLOR_WARN)
    .setTitle('📨 Yêu cầu tặng Money')
    .setDescription(
      [
        `Vui lòng vào game và gõ đúng lệnh sau để tặng Money:`,
        '```',
        `/pay ${settings.receiverIGN || '<ADMIN_IGN>'} ${order.amount}`,
        '```',
        `⚠️ Phải tặng **đúng IGN nhận (${settings.receiverIGN || 'chưa cấu hình'})** và **đúng số lượng ${formatNumber(order.amount)} Money**, nếu không đơn sẽ không được duyệt.`,
      ].join('\n')
    )
    .addFields(
      { name: 'IGN của bạn', value: order.ign, inline: true },
      { name: 'Số lượng Money', value: formatNumber(order.amount), inline: true },
      { name: 'Tổng tiền sẽ nhận', value: formatVND(order.totalPrice), inline: true }
    )
    .setFooter({ text: `Mã đơn: ${order.id}` });
}

function checkingChannelEmbed(order, user) {
  return new EmbedBuilder()
    .setColor(COLOR_WARN)
    .setTitle('🔎 Đơn cần xác minh')
    .addFields(
      { name: 'Người dùng', value: `<@${order.userId}> (${user.tag})`, inline: false },
      { name: 'IGN', value: order.ign, inline: true },
      { name: 'Số lượng Money', value: formatNumber(order.amount), inline: true },
      { name: 'Tổng tiền', value: formatVND(order.totalPrice), inline: true }
    )
    .setFooter({ text: `Mã đơn: ${order.id}` })
    .setTimestamp();
}

function withdrawRequestEmbed(withdrawal, user) {
  return new EmbedBuilder()
    .setColor(COLOR_WARN)
    .setTitle('🏦 Yêu cầu rút tiền')
    .addFields(
      { name: 'Người dùng', value: `<@${withdrawal.userId}> (${user.tag})`, inline: false },
      { name: 'Số tiền rút', value: formatVND(withdrawal.amount), inline: true }
    )
    .setImage(withdrawal.qrImageUrl)
    .setFooter({ text: `Mã yêu cầu: ${withdrawal.id}` })
    .setTimestamp();
}

function gambleStatusLabel(status) {
  return status === 'active' ? '🟢 Hoạt động' : '🔴 Tạm dừng';
}

function gamblePanelEmbed(settings) {
  return new EmbedBuilder()
    .setColor(settings.gambleStatus === 'active' ? COLOR_ACTIVE : COLOR_PAUSED)
    .setTitle('🎲 Sòng Bạc — Chẵn Lẻ & Tài Xỉu')
    .setDescription(
      'Cược bằng số dư gamble trong hồ sơ của bạn. Thắng: nhận lại **gấp đôi** tiền cược. Thua: mất tiền cược.'
    )
    .addFields(
      { name: '🎯 Cược tối thiểu', value: formatNumber(settings.gambleMinBet), inline: true },
      {
        name: '🎯 Cược tối đa',
        value: settings.gambleMaxBet > 0 ? formatNumber(settings.gambleMaxBet) : 'Không giới hạn',
        inline: true,
      },
      { name: '🤖 Trạng thái', value: gambleStatusLabel(settings.gambleStatus), inline: true }
    )
    .setFooter({ text: 'Chẵn Lẻ / Tài Xỉu để chơi · Nạp để cộng thêm số dư · Rút để đổi lại tiền thật' });
}

function gambleProfileEmbed(customer, member) {
  const stats = customer.gambleStats || { bets: 0, wins: 0, losses: 0, totalWagered: 0, totalWon: 0, totalLost: 0 };
  return new EmbedBuilder()
    .setColor(COLOR_INFO)
    .setTitle('🎲 Số dư Gamble của bạn')
    .setThumbnail(member.displayAvatarURL())
    .addFields(
      { name: '💰 Số dư gamble', value: formatNumber(customer.gambleBalance || 0), inline: true },
      { name: '🎮 IGN đã lưu', value: customer.ign || 'Chưa có', inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '🎰 Số lượt cược', value: String(stats.bets || 0), inline: true },
      { name: '✅ Thắng', value: String(stats.wins || 0), inline: true },
      { name: '❌ Thua', value: String(stats.losses || 0), inline: true }
    )
    .setFooter({ text: 'Chỉ bạn mới có thể thấy điều này' });
}

function gambleChoiceEmbed(game) {
  if (game === 'chanle') {
    return new EmbedBuilder()
      .setColor(COLOR_INFO)
      .setTitle('🔴🔵 Chẵn Lẻ')
      .setDescription('Chọn Chẵn hoặc Lẻ, sau đó nhập số tiền muốn cược.');
  }
  return new EmbedBuilder()
    .setColor(COLOR_INFO)
    .setTitle('🎲 Tài Xỉu')
    .setDescription('3 xúc xắc — Tài: tổng 11-18, Xỉu: tổng 3-10. Chọn 1 bên rồi nhập số tiền muốn cược.');
}

function gambleResultEmbed({ game, choice, win, amount, newBalance, roll }) {
  const labelMap = { chan: 'Chẵn', le: 'Lẻ', tai: 'Tài', xiu: 'Xỉu' };
  let resultLine;
  if (game === 'chanle') {
    const parity = roll % 2 === 0 ? 'Chẵn' : 'Lẻ';
    resultLine = `🎲 Ra số **${roll}** → **${parity}**`;
  } else {
    const sum = roll[0] + roll[1] + roll[2];
    const side = sum >= 11 ? 'Tài' : 'Xỉu';
    resultLine = `🎲 Xúc xắc: **${roll.join(' - ')}** (tổng ${sum}) → **${side}**`;
  }

  return new EmbedBuilder()
    .setColor(win ? COLOR_SUCCESS : COLOR_DANGER)
    .setTitle(win ? '🎉 Bạn đã THẮNG' : '💔 Bạn đã THUA')
    .setDescription(
      [
        `Bạn cược **${labelMap[choice]}** với số tiền **${formatNumber(amount)}**.`,
        resultLine,
        win ? `Nhận lại: **+${formatNumber(amount)}**` : `Mất: **-${formatNumber(amount)}**`,
        `Số dư gamble hiện tại: **${formatNumber(newBalance)}**`,
      ].join('\n')
    );
}

function gambleDepositDMEmbed(deposit, settings) {
  return new EmbedBuilder()
    .setColor(COLOR_WARN)
    .setTitle('📨 Yêu cầu nạp tiền gamble')
    .setDescription(
      [
        'Vui lòng vào game và gõ đúng lệnh sau để nạp:',
        '```',
        `/pay ${settings.gambleReceiverIGN || settings.receiverIGN || '<ADMIN_IGN>'} ${deposit.amount}`,
        '```',
        `⚠️ Phải gửi **đúng IGN nhận (${settings.gambleReceiverIGN || settings.receiverIGN || 'chưa cấu hình'})** và **đúng số lượng ${formatNumber(deposit.amount)}**, nếu không yêu cầu sẽ không được duyệt.`,
      ].join('\n')
    )
    .addFields(
      { name: 'IGN của bạn', value: deposit.ign, inline: true },
      { name: 'Số tiền nạp', value: formatNumber(deposit.amount), inline: true }
    )
    .setFooter({ text: `Mã yêu cầu: ${deposit.id}` });
}

function gambleDepositCheckingEmbed(deposit, user) {
  return new EmbedBuilder()
    .setColor(COLOR_WARN)
    .setTitle('🔎 Yêu cầu nạp gamble cần xác minh')
    .addFields(
      { name: 'Người dùng', value: `<@${deposit.userId}> (${user.tag})`, inline: false },
      { name: 'IGN', value: deposit.ign, inline: true },
      { name: 'Số tiền', value: formatNumber(deposit.amount), inline: true }
    )
    .setFooter({ text: `Mã yêu cầu: ${deposit.id}` })
    .setTimestamp();
}

function gambleWithdrawRequestEmbed(withdrawal, user, settings) {
  return new EmbedBuilder()
    .setColor(COLOR_WARN)
    .setTitle('🏦 Yêu cầu rút tiền gamble')
    .setDescription(
      [
        'Admin vào game và gõ lệnh sau để thanh toán cho user:',
        '```',
        `/pay ${withdrawal.ign} ${withdrawal.amount}`,
        '```',
      ].join('\n')
    )
    .addFields(
      { name: 'Người dùng', value: `<@${withdrawal.userId}> (${user.tag})`, inline: false },
      { name: 'IGN nhận', value: withdrawal.ign, inline: true },
      { name: 'Số tiền rút', value: formatNumber(withdrawal.amount), inline: true }
    )
    .setFooter({ text: `Mã yêu cầu: ${withdrawal.id}` })
    .setTimestamp();
}

// ============================================================================
// 6) COMPONENTS (buttons + modal)
// ============================================================================
function marketPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('market:gift').setLabel('Tặng Cho Tôi').setEmoji('🛒').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('market:profile').setLabel('Hồ Sơ').setEmoji('👤').setStyle(ButtonStyle.Secondary)
  );
}

function profileRow(canWithdraw) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('market:withdraw')
      .setLabel('Rút')
      .setEmoji('💸')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canWithdraw)
  );
}

function giftModal() {
  return new ModalBuilder()
    .setCustomId('market:gift_modal')
    .setTitle('Tặng Cho Tôi')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Số lượng Money muốn tặng')
          .setPlaceholder('VD: 10000000, 10.000.000, hoặc 10m')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(20)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ign')
          .setLabel('IGN của bạn (in-game name)')
          .setPlaceholder('VD: Steve123')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(32)
          .setRequired(true)
      )
    );
}

function dmPaidRow(orderId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`order:paid:${orderId}`).setLabel('Tôi đã pay').setEmoji('✅').setStyle(ButtonStyle.Success)
  );
}

function checkingRow(orderId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`order:approve:${orderId}`).setLabel('Duyệt').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`order:reject:${orderId}`).setLabel('Từ chối').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );
}

function withdrawRow(withdrawId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`withdraw:confirm:${withdrawId}`).setLabel('Đã chuyển khoản').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`withdraw:reject:${withdrawId}`).setLabel('Từ chối').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );
}

function gamblePanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gamble:panel:chanle').setLabel('Chẵn Lẻ').setEmoji('🔴').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gamble:panel:taixiu').setLabel('Tài Xỉu').setEmoji('🎲').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gamble:panel:balance').setLabel('Số Dư').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('gamble:panel:deposit').setLabel('Nạp').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('gamble:panel:withdraw').setLabel('Rút').setEmoji('💸').setStyle(ButtonStyle.Danger)
  );
}

function gambleChanLeChoiceRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gamble:choose:chanle:chan').setLabel('Chẵn').setEmoji('🔵').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gamble:choose:chanle:le').setLabel('Lẻ').setEmoji('🔴').setStyle(ButtonStyle.Danger)
  );
}

function gambleTaiXiuChoiceRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gamble:choose:taixiu:tai').setLabel('Tài (11-18)').setEmoji('⬆️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gamble:choose:taixiu:xiu').setLabel('Xỉu (3-10)').setEmoji('⬇️').setStyle(ButtonStyle.Danger)
  );
}

function gambleBetModal(game, choice) {
  const labelMap = { chan: 'Chẵn', le: 'Lẻ', tai: 'Tài', xiu: 'Xỉu' };
  return new ModalBuilder()
    .setCustomId(`gamble:bet_modal:${game}:${choice}`)
    .setTitle(`Đặt cược — ${labelMap[choice]}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Số tiền muốn cược')
          .setPlaceholder('VD: 5000000, 5.000.000, hoặc 5m')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(20)
          .setRequired(true)
      )
    );
}

function gambleDepositModal() {
  return new ModalBuilder()
    .setCustomId('gamble:deposit_modal')
    .setTitle('Nạp tiền gamble')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Số tiền muốn nạp')
          .setPlaceholder('VD: 10000000, 10.000.000, hoặc 10m')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(20)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ign')
          .setLabel('IGN của bạn (in-game name)')
          .setPlaceholder('VD: Steve123')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(32)
          .setRequired(true)
      )
    );
}

function gambleWithdrawModal() {
  return new ModalBuilder()
    .setCustomId('gamble:withdraw_modal')
    .setTitle('Rút tiền gamble')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Số tiền muốn rút')
          .setPlaceholder('VD: 10000000, 10.000.000, hoặc 10m')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(20)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ign')
          .setLabel('IGN nhận tiền (in-game name)')
          .setPlaceholder('VD: Steve123')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(32)
          .setRequired(true)
      )
    );
}

function gambleDepositConfirmRow(depositId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gamble:deposit_paid:${depositId}`).setLabel('Tôi đã pay').setEmoji('✅').setStyle(ButtonStyle.Success)
  );
}

function gambleDepositReviewRow(depositId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gamble:deposit_approve:${depositId}`).setLabel('Duyệt').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`gamble:deposit_reject:${depositId}`).setLabel('Từ chối').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );
}

function gambleWithdrawReviewRow(withdrawId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gamble:withdraw_confirm:${withdrawId}`).setLabel('Đã chuyển').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`gamble:withdraw_reject:${withdrawId}`).setLabel('Từ chối').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );
}

// ============================================================================
// 7) SLASH COMMANDS
// ============================================================================
const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('market-panel')
    .setDescription('[Admin] Đăng hoặc làm mới bảng Market trong kênh này')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('market-set-rate')
    .setDescription('[Admin] Đặt rate (VND / 1.000.000 Money)')
    .addNumberOption((o) => o.setName('rate').setDescription('Ví dụ: 200').setRequired(true).setMinValue(0))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('market-set-min')
    .setDescription('[Admin] Đặt số Money tối thiểu mỗi lần tặng')
    .addStringOption((o) => o.setName('amount').setDescription('VD: 10000000, 10m, 10M').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('market-set-max')
    .setDescription('[Admin] Đặt tổng Money tối đa còn có thể mua')
    .addStringOption((o) => o.setName('amount').setDescription('VD: 2353000000, 2.353b, 2353M').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('market-set-fund')
    .setDescription('[Admin] Đặt quỹ tiền mặt hiện có (VND)')
    .addStringOption((o) => o.setName('amount').setDescription('VD: 470605, 470k, 1.2m').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('market-set-status')
    .setDescription('[Admin] Bật/tạm dừng bot nhận tặng')
    .addStringOption((o) =>
      o
        .setName('status')
        .setDescription('Trạng thái')
        .setRequired(true)
        .addChoices({ name: 'Hoạt động', value: 'active' }, { name: 'Tạm dừng', value: 'paused' })
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('market-set-ign')
    .setDescription('[Admin] Đặt IGN sẽ nhận Money (dùng trong lệnh /pay)')
    .addStringOption((o) => o.setName('ign').setDescription('IGN nhận tiền').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('market-set-channel')
    .setDescription('[Admin] Cấu hình kênh checking / payment')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Loại kênh')
        .setRequired(true)
        .addChoices(
          { name: 'checking (xác minh đơn tặng)', value: 'checking' },
          { name: 'payment (yêu cầu rút tiền)', value: 'payment' }
        )
    )
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Kênh').setRequired(true).addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('market-set-admin-role')
    .setDescription('[Admin] Đặt role được phép duyệt đơn / xử lý rút tiền')
    .addRoleOption((o) => o.setName('role').setDescription('Role admin').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('market-info')
    .setDescription('[Admin] Xem cấu hình hiện tại của market')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('market-customer')
    .setDescription('[Admin] Xem hồ sơ đầy đủ của một khách hàng (từ file save)')
    .addUserOption((o) => o.setName('user').setDescription('Khách hàng').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // ---- Gamble ----
  new SlashCommandBuilder()
    .setName('gamble-panel')
    .setDescription('[Admin] Đăng hoặc làm mới bảng Gamble (Chẵn Lẻ / Tài Xỉu) trong kênh này')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('gamble-set-status')
    .setDescription('[Admin] Bật/tạm dừng hệ thống gamble')
    .addStringOption((o) =>
      o
        .setName('status')
        .setDescription('Trạng thái')
        .setRequired(true)
        .addChoices({ name: 'Hoạt động', value: 'active' }, { name: 'Tạm dừng', value: 'paused' })
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('gamble-set-minbet')
    .setDescription('[Admin] Đặt số tiền cược tối thiểu')
    .addStringOption((o) => o.setName('amount').setDescription('VD: 100000, 100k').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('gamble-set-maxbet')
    .setDescription('[Admin] Đặt số tiền cược tối đa (0 = không giới hạn)')
    .addStringOption((o) => o.setName('amount').setDescription('VD: 0, 100000000, 100m').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('gamble-set-ign')
    .setDescription('[Admin] Đặt IGN sẽ nhận tiền nạp gamble (dùng trong lệnh /pay)')
    .addStringOption((o) => o.setName('ign').setDescription('IGN nhận tiền').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('gamble-set-channel')
    .setDescription('[Admin] Cấu hình kênh checking / payment cho gamble')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Loại kênh')
        .setRequired(true)
        .addChoices(
          { name: 'checking (xác minh nạp tiền)', value: 'checking' },
          { name: 'payment (yêu cầu rút tiền)', value: 'payment' }
        )
    )
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Kênh').setRequired(true).addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('gamble-info')
    .setDescription('[Admin] Xem cấu hình hiện tại của hệ thống gamble')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

async function handleCommand(interaction) {
  const settings = db.getSettings();

  if (!isMarketAdmin(interaction.member, settings)) {
    return interaction.reply({ content: '⛔ Bạn không có quyền dùng lệnh này.', ephemeral: true });
  }

  switch (interaction.commandName) {
    case 'market-panel': {
      const updated = db.getSettings();
      const msg = await interaction.channel.send({
        embeds: [marketPanelEmbed(updated)],
        components: [marketPanelRow()],
      });
      await db.updateSettings({ panelChannelId: interaction.channel.id, panelMessageId: msg.id });
      return interaction.reply({ content: '✅ Đã đăng bảng Market.', ephemeral: true });
    }

    case 'market-set-rate': {
      const rate = interaction.options.getNumber('rate');
      await db.updateSettings({ rate });
      await refreshPanel(interaction);
      return interaction.reply({ content: `✅ Đã đặt rate = \`${formatNumber(rate)}/1M\`.`, ephemeral: true });
    }

    case 'market-set-min': {
      const raw = interaction.options.getString('amount');
      const amount = parseAmountInput(raw);
      if (!Number.isFinite(amount) || amount <= 0) {
        return interaction.reply({
          content: `❌ Giá trị không hợp lệ: \`${raw}\`. Ví dụ hợp lệ: \`10000000\`, \`10m\`, \`10M\`.`,
          ephemeral: true,
        });
      }
      const current = db.getSettings();
      if (amount > current.maxGift) {
        return interaction.reply({
          content: `❌ Tối thiểu (\`${formatNumber(amount)}\`) không được lớn hơn tối đa hiện tại (\`${formatNumber(current.maxGift)}\`).`,
          ephemeral: true,
        });
      }
      await db.updateSettings({ minGift: amount });
      await refreshPanel(interaction);
      return interaction.reply({ content: `✅ Đã đặt tặng tối thiểu = \`${formatNumber(amount)}\` Money.`, ephemeral: true });
    }

    case 'market-set-max': {
      const raw = interaction.options.getString('amount');
      const amount = parseAmountInput(raw);
      if (!Number.isFinite(amount) || amount <= 0) {
        return interaction.reply({
          content: `❌ Giá trị không hợp lệ: \`${raw}\`. Ví dụ hợp lệ: \`2353000000\`, \`2.353b\`, \`2353M\`.`,
          ephemeral: true,
        });
      }
      const current = db.getSettings();
      if (amount < current.minGift) {
        return interaction.reply({
          content: `❌ Tối đa (\`${formatNumber(amount)}\`) không được nhỏ hơn tối thiểu hiện tại (\`${formatNumber(current.minGift)}\`).`,
          ephemeral: true,
        });
      }
      await db.updateSettings({ maxGift: amount });
      await refreshPanel(interaction);
      return interaction.reply({ content: `✅ Đã đặt tối đa có thể tặng = \`${formatNumber(amount)}\` Money.`, ephemeral: true });
    }

    case 'market-set-fund': {
      const raw = interaction.options.getString('amount');
      const amount = parseAmountInput(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        return interaction.reply({
          content: `❌ Giá trị không hợp lệ: \`${raw}\`. Ví dụ hợp lệ: \`470605\`, \`470k\`, \`1.2m\`.`,
          ephemeral: true,
        });
      }
      await db.updateSettings({ fund: amount });
      await refreshPanel(interaction);
      return interaction.reply({ content: `✅ Đã đặt quỹ hiện = \`${formatNumber(amount)}\`.`, ephemeral: true });
    }

    case 'market-set-status': {
      const status = interaction.options.getString('status');
      await db.updateSettings({ status });
      await refreshPanel(interaction);
      return interaction.reply({
        content: `✅ Trạng thái bot: ${status === 'active' ? '🟢 Hoạt động' : '🔴 Tạm dừng'}.`,
        ephemeral: true,
      });
    }

    case 'market-set-ign': {
      const ign = interaction.options.getString('ign');
      await db.updateSettings({ receiverIGN: ign });
      return interaction.reply({ content: `✅ Đã đặt IGN nhận tiền = \`${ign}\`.`, ephemeral: true });
    }

    case 'market-set-channel': {
      const type = interaction.options.getString('type');
      const channel = interaction.options.getChannel('channel');
      if (type === 'checking') await db.updateSettings({ checkingChannelId: channel.id });
      else await db.updateSettings({ paymentChannelId: channel.id });
      return interaction.reply({ content: `✅ Đã đặt kênh ${type} = <#${channel.id}>.`, ephemeral: true });
    }

    case 'market-set-admin-role': {
      const role = interaction.options.getRole('role');
      await db.updateSettings({ adminRoleId: role.id });
      return interaction.reply({ content: `✅ Đã đặt role admin = <@&${role.id}>.`, ephemeral: true });
    }

    case 'market-info': {
      const s = db.getSettings();
      const lines = [
        `**Rate:** ${formatNumber(s.rate)}/1M`,
        `**Tặng tối thiểu:** ${formatNumber(s.minGift)} Money`,
        `**Tối đa có thể tặng:** ${formatNumber(s.maxGift)} Money`,
        `**Quỹ hiện:** ${formatNumber(s.fund)}`,
        `**Trạng thái:** ${s.status === 'active' ? '🟢 Hoạt động' : '🔴 Tạm dừng'}`,
        `**IGN nhận tiền:** ${s.receiverIGN || '(chưa đặt)'}`,
        `**Kênh checking:** ${s.checkingChannelId ? `<#${s.checkingChannelId}>` : '(chưa đặt)'}`,
        `**Kênh payment:** ${s.paymentChannelId ? `<#${s.paymentChannelId}>` : '(chưa đặt)'}`,
        `**Role admin:** ${s.adminRoleId ? `<@&${s.adminRoleId}>` : '(dùng quyền Manage Server)'}`,
      ];
      return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }

    case 'market-customer': {
      const target = interaction.options.getUser('user');
      const customer = customers.getCustomer(target.id);
      const lastOrders = (customer.orderHistory || [])
        .slice(-5)
        .reverse()
        .map((o) => `• \`${o.orderId}\` — ${formatNumber(o.amount)} Money — ${o.status}`)
        .join('\n') || '(chưa có)';
      const lastWithdrawals = (customer.withdrawalHistory || [])
        .slice(-5)
        .reverse()
        .map((w) => `• \`${w.withdrawalId}\` — ${formatNumber(w.amount)}đ — ${w.status}`)
        .join('\n') || '(chưa có)';

      const lines = [
        `**Khách hàng:** <@${target.id}> (${customer.tag || target.tag})`,
        `**IGN:** ${customer.ign || '(chưa có)'}`,
        `**Số dư khả dụng:** ${formatNumber(customer.balance)}đ`,
        `**Tổng đã nhận:** ${formatNumber(customer.totalReceived)}đ · **Tổng đã rút:** ${formatNumber(customer.totalWithdrawn)}đ`,
        `**Số đơn đã duyệt:** ${customer.ordersCount} · **Số lần rút thành công:** ${customer.withdrawalsCount}`,
        `**Đang chờ rút:** ${customer.pendingWithdrawalId ? `\`${customer.pendingWithdrawalId}\`` : 'Không'}`,
        '',
        '**5 đơn tặng gần nhất:**',
        lastOrders,
        '',
        '**5 lần rút gần nhất:**',
        lastWithdrawals,
      ];
      return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }

    case 'gamble-panel': {
      const updated = db.getSettings();
      const msg = await interaction.channel.send({
        embeds: [gamblePanelEmbed(updated)],
        components: [gamblePanelRow()],
      });
      await db.updateSettings({ gamblePanelChannelId: interaction.channel.id, gamblePanelMessageId: msg.id });
      return interaction.reply({ content: '✅ Đã đăng bảng Gamble.', ephemeral: true });
    }

    case 'gamble-set-status': {
      const status = interaction.options.getString('status');
      await db.updateSettings({ gambleStatus: status });
      await refreshGamblePanel(interaction);
      return interaction.reply({
        content: `✅ Trạng thái gamble: ${status === 'active' ? '🟢 Hoạt động' : '🔴 Tạm dừng'}.`,
        ephemeral: true,
      });
    }

    case 'gamble-set-minbet': {
      const raw = interaction.options.getString('amount');
      const amount = parseAmountInput(raw);
      if (!Number.isFinite(amount) || amount <= 0) {
        return interaction.reply({
          content: `❌ Giá trị không hợp lệ: \`${raw}\`. Ví dụ hợp lệ: \`100000\`, \`100k\`.`,
          ephemeral: true,
        });
      }
      await db.updateSettings({ gambleMinBet: amount });
      await refreshGamblePanel(interaction);
      return interaction.reply({ content: `✅ Đã đặt cược tối thiểu = \`${formatNumber(amount)}\`.`, ephemeral: true });
    }

    case 'gamble-set-maxbet': {
      const raw = interaction.options.getString('amount');
      const amount = parseAmountInput(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        return interaction.reply({
          content: `❌ Giá trị không hợp lệ: \`${raw}\`. Ví dụ hợp lệ: \`0\`, \`100000000\`, \`100m\`.`,
          ephemeral: true,
        });
      }
      await db.updateSettings({ gambleMaxBet: amount });
      await refreshGamblePanel(interaction);
      return interaction.reply({
        content: `✅ Đã đặt cược tối đa = \`${amount > 0 ? formatNumber(amount) : 'Không giới hạn'}\`.`,
        ephemeral: true,
      });
    }

    case 'gamble-set-ign': {
      const ign = interaction.options.getString('ign');
      await db.updateSettings({ gambleReceiverIGN: ign });
      return interaction.reply({ content: `✅ Đã đặt IGN nhận tiền nạp gamble = \`${ign}\`.`, ephemeral: true });
    }

    case 'gamble-set-channel': {
      const type = interaction.options.getString('type');
      const channel = interaction.options.getChannel('channel');
      if (type === 'checking') await db.updateSettings({ gambleCheckingChannelId: channel.id });
      else await db.updateSettings({ gamblePaymentChannelId: channel.id });
      return interaction.reply({ content: `✅ Đã đặt kênh gamble ${type} = <#${channel.id}>.`, ephemeral: true });
    }

    case 'gamble-info': {
      const s = db.getSettings();
      const lines = [
        `**Trạng thái:** ${s.gambleStatus === 'active' ? '🟢 Hoạt động' : '🔴 Tạm dừng'}`,
        `**Cược tối thiểu:** ${formatNumber(s.gambleMinBet)}`,
        `**Cược tối đa:** ${s.gambleMaxBet > 0 ? formatNumber(s.gambleMaxBet) : 'Không giới hạn'}`,
        `**IGN nhận tiền nạp:** ${s.gambleReceiverIGN || s.receiverIGN || '(chưa đặt)'}`,
        `**Kênh checking:** ${s.gambleCheckingChannelId ? `<#${s.gambleCheckingChannelId}>` : '(chưa đặt)'}`,
        `**Kênh payment:** ${s.gamblePaymentChannelId ? `<#${s.gamblePaymentChannelId}>` : '(chưa đặt)'}`,
        '',
        '**Bảng tỉ lệ thắng công khai:**',
        ...gambleOddsLines(),
      ];
      return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }

    default:
      return interaction.reply({ content: 'Lệnh không xác định.', ephemeral: true });
  }
}

/** Nếu bảng panel đã được đăng trước đó, cập nhật lại nội dung cho khớp cấu hình mới */
async function refreshPanel(interaction) {
  const settings = db.getSettings();
  if (!settings.panelChannelId || !settings.panelMessageId) return;
  try {
    const channel = await interaction.client.channels.fetch(settings.panelChannelId);
    const msg = await channel.messages.fetch(settings.panelMessageId);
    await msg.edit({ embeds: [marketPanelEmbed(settings)], components: [marketPanelRow()] });
  } catch (err) {
    console.warn('[commands] Không thể cập nhật panel:', err.message);
  }
}

/** Tương tự refreshPanel nhưng cho bảng Gamble */
async function refreshGamblePanel(interaction) {
  const settings = db.getSettings();
  if (!settings.gamblePanelChannelId || !settings.gamblePanelMessageId) return;
  try {
    const channel = await interaction.client.channels.fetch(settings.gamblePanelChannelId);
    const msg = await channel.messages.fetch(settings.gamblePanelMessageId);
    await msg.edit({ embeds: [gamblePanelEmbed(settings)], components: [gamblePanelRow()] });
  } catch (err) {
    console.warn('[commands] Không thể cập nhật gamble panel:', err.message);
  }
}

// ============================================================================
// 8) ORDER FLOW (luồng tặng / xác minh / rút tiền)
// ============================================================================
// userId -> withdrawalId, khi đang chờ ảnh QR trong DM
const awaitingQR = new Map();

/** Khôi phục trạng thái "đang chờ ảnh QR" sau khi bot restart */
function restoreAwaitingQR() {
  const pending = db.listWithdrawals((w) => w.status === 'awaiting_qr');
  for (const w of pending) awaitingQR.set(w.userId, w.id);
  if (pending.length > 0) {
    console.log(`[orderFlow] Đã khôi phục ${pending.length} yêu cầu rút tiền đang chờ ảnh QR.`);
  }
}
restoreAwaitingQR();

function touchCustomer(user) {
  return customers.updateCustomer(user.id, { username: user.username, tag: user.tag });
}

/** Người dùng có đơn "Tặng Cho Tôi" nào đang chờ xử lý (chưa duyệt/từ chối) không */
function hasActiveOrder(userId) {
  return db.listOrders((o) => o.userId === userId && ['pending_payment', 'checking'].includes(o.status)).length > 0;
}

// ---- 1) Người dùng bấm "Tặng Cho Tôi" -> mở modal, submit modal ----
async function handleGiftModalSubmit(interaction) {
  const settings = db.getSettings();

  if (settings.status !== 'active') {
    return interaction.reply({ content: '⏸️ Bot đang **tạm dừng**, vui lòng quay lại sau.', ephemeral: true });
  }
  if (!settings.receiverIGN) {
    return interaction.reply({ content: '⚠️ Admin chưa cấu hình IGN nhận tiền. Vui lòng thử lại sau.', ephemeral: true });
  }
  if (hasActiveOrder(interaction.user.id)) {
    return interaction.reply({
      content: '⏳ Bạn đang có một đơn tặng chưa hoàn tất. Vui lòng hoàn tất (bấm "Tôi đã pay") hoặc chờ admin xử lý trước khi tạo đơn mới.',
      ephemeral: true,
    });
  }

  const rawAmount = interaction.fields.getTextInputValue('amount');
  const ign = sanitizeIGN(interaction.fields.getTextInputValue('ign'));
  const amount = parseAmountInput(rawAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return interaction.reply({
      content: '❌ Số lượng Money không hợp lệ. Ví dụ hợp lệ: `10000000`, `10.000.000`, hoặc `10m`.',
      ephemeral: true,
    });
  }
  if (!ign) {
    return interaction.reply({ content: '❌ IGN không hợp lệ, vui lòng nhập lại.', ephemeral: true });
  }
  if (amount < settings.minGift) {
    return interaction.reply({
      content: `❌ Số lượng tối thiểu là **${formatNumber(settings.minGift)} Money**.`,
      ephemeral: true,
    });
  }
  if (amount > settings.maxGift) {
    return interaction.reply({
      content: `❌ Vượt quá số lượng tối đa còn nhận (**${formatNumber(settings.maxGift)} Money**).`,
      ephemeral: true,
    });
  }

  const totalPrice = calcPrice(amount, settings.rate);
  if (totalPrice > settings.fund) {
    return interaction.reply({
      content: '❌ Quỹ hiện không đủ để nhận đơn này. Vui lòng thử số lượng nhỏ hơn hoặc quay lại sau.',
      ephemeral: true,
    });
  }

  const order = await db.createOrder({
    userId: interaction.user.id,
    guildId: interaction.guildId,
    amount,
    ign,
    totalPrice,
    status: 'pending_payment', // pending_payment -> checking -> approved/rejected
  });

  await customers.updateCustomer(interaction.user.id, {
    ign,
    username: interaction.user.username,
    tag: interaction.user.tag,
  });
  await customers.recordOrder(interaction.user.id, {
    orderId: order.id,
    amount: order.amount,
    totalPrice: order.totalPrice,
    status: 'pending_payment',
  });

  try {
    await interaction.user.send({ embeds: [dmPaymentEmbed(order, settings)], components: [dmPaidRow(order.id)] });
    await interaction.reply({
      content: '📬 Đã gửi hướng dẫn thanh toán vào tin nhắn riêng (DM) của bạn. Vui lòng kiểm tra!',
      ephemeral: true,
    });
  } catch (err) {
    await interaction.reply({
      content: '❌ Không thể gửi DM cho bạn. Vui lòng bật tin nhắn riêng (Direct Messages) từ thành viên server và thử lại.',
      ephemeral: true,
    });
    await db.updateOrder(order.id, { status: 'failed_dm' });
  }
}

// ---- 2) Người dùng bấm "Tôi đã pay" trong DM ----
async function handleOrderPaid(interaction, orderId) {
  const order = db.getOrder(orderId);
  if (!order) return interaction.reply({ content: '❌ Không tìm thấy đơn hàng.', ephemeral: true });
  if (order.userId !== interaction.user.id) {
    return interaction.reply({ content: '⛔ Đây không phải đơn của bạn.', ephemeral: true });
  }
  if (order.status !== 'pending_payment') {
    return interaction.reply({ content: 'ℹ️ Đơn này đã được xử lý trước đó.', ephemeral: true });
  }

  const settings = db.getSettings();
  await db.updateOrder(orderId, { status: 'checking' });
  await touchCustomer(interaction.user);

  await interaction.update({
    embeds: interaction.message.embeds,
    components: [],
    content: '🔎 Đơn của bạn đang được **xác minh**, vui lòng chờ trong giây lát...',
  });

  if (!settings.checkingChannelId) {
    return interaction.followUp({
      content: '⚠️ Admin chưa cấu hình kênh checking, vui lòng liên hệ trực tiếp.',
      ephemeral: true,
    });
  }

  try {
    const channel = await interaction.client.channels.fetch(settings.checkingChannelId);
    await channel.send({
      embeds: [checkingChannelEmbed(order, interaction.user)],
      components: [checkingRow(order.id)],
    });
  } catch (err) {
    console.error('[orderFlow] Không thể gửi vào kênh checking:', err);
  }
}

// ---- 3) Admin bấm Duyệt / Từ chối trong kênh checking ----
async function handleOrderApprove(interaction, orderId) {
  const settings = db.getSettings();
  if (!isMarketAdmin(interaction.member, settings)) {
    return interaction.reply({ content: '⛔ Bạn không có quyền duyệt đơn.', ephemeral: true });
  }

  const order = db.getOrder(orderId);
  if (!order) return interaction.reply({ content: '❌ Không tìm thấy đơn hàng.', ephemeral: true });
  if (order.status !== 'checking') {
    return interaction.reply({ content: 'ℹ️ Đơn này đã được xử lý trước đó.', ephemeral: true });
  }

  await db.updateOrder(orderId, { status: 'approved', approvedBy: interaction.user.id });

  const updatedCustomer = await customers.adjustBalance(order.userId, order.totalPrice);
  const newBalance = updatedCustomer.balance;
  await customers.recordOrder(order.userId, {
    orderId: order.id,
    amount: order.amount,
    totalPrice: order.totalPrice,
    status: 'approved',
  });

  await db.adjustFundAndMax(-order.totalPrice, -order.amount);
  await refreshPanel(interaction);

  await interaction.update({
    embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(COLOR_SUCCESS).setTitle('✅ Đơn đã được duyệt')],
    components: [],
  });

  try {
    const dmUser = await interaction.client.users.fetch(order.userId);
    await dmUser.send(
      `✅ Đơn hàng **${order.id}** đã được duyệt thành công!\n` +
        `💰 Đã cộng **${formatVND(order.totalPrice)}** vào số dư của bạn.\n` +
        `📊 Số dư khả dụng hiện tại: **${formatVND(newBalance)}**`
    );
  } catch (err) {
    console.warn('[orderFlow] Không thể DM người dùng sau khi duyệt:', err.message);
  }
}

async function handleOrderReject(interaction, orderId) {
  const settings = db.getSettings();
  if (!isMarketAdmin(interaction.member, settings)) {
    return interaction.reply({ content: '⛔ Bạn không có quyền xử lý đơn.', ephemeral: true });
  }

  const order = db.getOrder(orderId);
  if (!order) return interaction.reply({ content: '❌ Không tìm thấy đơn hàng.', ephemeral: true });
  if (order.status !== 'checking') {
    return interaction.reply({ content: 'ℹ️ Đơn này đã được xử lý trước đó.', ephemeral: true });
  }

  await db.updateOrder(orderId, { status: 'rejected', rejectedBy: interaction.user.id });
  await customers.recordOrder(order.userId, {
    orderId: order.id,
    amount: order.amount,
    totalPrice: order.totalPrice,
    status: 'rejected',
  });

  await interaction.update({
    embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(COLOR_DANGER).setTitle('❌ Đơn bị từ chối')],
    components: [],
  });

  try {
    const dmUser = await interaction.client.users.fetch(order.userId);
    await dmUser.send(
      `❌ Đơn hàng **${order.id}** đã bị **từ chối** (không xác minh được giao dịch trong game).\n` +
        `Vui lòng liên hệ admin nếu bạn cho rằng đây là nhầm lẫn.`
    );
  } catch (err) {
    console.warn('[orderFlow] Không thể DM người dùng sau khi từ chối:', err.message);
  }
}

// ---- 4) Hồ sơ & Rút tiền ----
async function handleProfile(interaction) {
  await touchCustomer(interaction.user);
  const customer = customers.getCustomer(interaction.user.id);
  const canWithdraw = customer.balance >= config.minWithdraw && !customer.pendingWithdrawalId;
  await interaction.reply({
    embeds: [profileEmbed(customer, interaction.member ?? interaction.user)],
    components: [profileRow(canWithdraw)],
    ephemeral: true,
  });
}

async function handleWithdrawClick(interaction) {
  const customer = customers.getCustomer(interaction.user.id);

  if (customer.pendingWithdrawalId) {
    return interaction.reply({ content: '⏳ Bạn đang có một yêu cầu rút tiền đang xử lý.', ephemeral: true });
  }
  if (customer.balance < config.minWithdraw) {
    return interaction.reply({
      content: `❌ Số dư phải trên **${formatVND(config.minWithdraw)}** mới được rút.`,
      ephemeral: true,
    });
  }

  const settings = db.getSettings();
  if (!settings.paymentChannelId) {
    return interaction.reply({ content: '⚠️ Admin chưa cấu hình kênh payment. Vui lòng liên hệ admin.', ephemeral: true });
  }

  const withdrawal = await db.createWithdrawal({
    userId: interaction.user.id,
    guildId: interaction.guildId,
    amount: customer.balance,
    status: 'awaiting_qr',
    qrImageUrl: null,
  });

  await customers.updateCustomer(interaction.user.id, { balance: 0, pendingWithdrawalId: withdrawal.id });
  awaitingQR.set(interaction.user.id, withdrawal.id);

  try {
    await interaction.user.send(
      `🏦 Bạn đang rút **${formatVND(withdrawal.amount)}**.\n` +
        `Vui lòng gửi **ảnh mã QR ngân hàng** của bạn ngay tại đây (trong tin nhắn riêng này) để admin chuyển khoản.`
    );
    await interaction.reply({ content: '📬 Đã gửi hướng dẫn rút tiền vào DM của bạn. Vui lòng kiểm tra!', ephemeral: true });
  } catch (err) {
    await customers.updateCustomer(interaction.user.id, { balance: withdrawal.amount, pendingWithdrawalId: null });
    await db.updateWithdrawal(withdrawal.id, { status: 'cancelled' });
    awaitingQR.delete(interaction.user.id);
    await interaction.reply({
      content: '❌ Không thể gửi DM cho bạn. Vui lòng bật tin nhắn riêng (Direct Messages) và thử lại.',
      ephemeral: true,
    });
  }
}

// ---- 5) Người dùng gửi ảnh QR trong DM ----
async function handleDMAttachment(message) {
  const userId = message.author.id;
  const withdrawalId = awaitingQR.get(userId);
  if (!withdrawalId) return false;

  const withdrawal = db.getWithdrawal(withdrawalId);
  if (!withdrawal || withdrawal.status !== 'awaiting_qr') {
    awaitingQR.delete(userId);
    return false;
  }

  const image = message.attachments.find((a) => (a.contentType || '').startsWith('image/'));
  if (!image) {
    await message.reply('⚠️ Vui lòng gửi **ảnh** mã QR ngân hàng (không phải văn bản).');
    return true;
  }

  await db.updateWithdrawal(withdrawalId, { status: 'reviewing', qrImageUrl: image.url });
  awaitingQR.delete(userId);
  await message.reply('✅ Đã nhận ảnh QR. Yêu cầu rút tiền của bạn đang được admin xử lý, vui lòng chờ trong giây lát.');

  const settings = db.getSettings();
  if (!settings.paymentChannelId) return true;

  try {
    const channel = await message.client.channels.fetch(settings.paymentChannelId);
    await channel.send({
      embeds: [withdrawRequestEmbed({ ...withdrawal, qrImageUrl: image.url }, message.author)],
      components: [withdrawRow(withdrawalId)],
    });
  } catch (err) {
    console.error('[orderFlow] Không thể gửi vào kênh payment:', err);
  }
  return true;
}

// ---- 6) Admin xác nhận / từ chối rút tiền trong kênh payment ----
async function handleWithdrawConfirm(interaction, withdrawalId) {
  const settings = db.getSettings();
  if (!isMarketAdmin(interaction.member, settings)) {
    return interaction.reply({ content: '⛔ Bạn không có quyền xử lý yêu cầu rút tiền.', ephemeral: true });
  }

  const withdrawal = db.getWithdrawal(withdrawalId);
  if (!withdrawal) return interaction.reply({ content: '❌ Không tìm thấy yêu cầu.', ephemeral: true });
  if (withdrawal.status !== 'reviewing') {
    return interaction.reply({ content: 'ℹ️ Yêu cầu này đã được xử lý trước đó.', ephemeral: true });
  }

  await db.updateWithdrawal(withdrawalId, { status: 'completed', completedBy: interaction.user.id });
  await customers.updateCustomer(withdrawal.userId, { pendingWithdrawalId: null });
  await customers.recordWithdrawal(withdrawal.userId, {
    withdrawalId: withdrawal.id,
    amount: withdrawal.amount,
    status: 'completed',
  });

  await interaction.update({
    embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(COLOR_SUCCESS).setTitle('✅ Đã chuyển khoản')],
    components: [],
  });

  try {
    const dmUser = await interaction.client.users.fetch(withdrawal.userId);
    await dmUser.send(`✅ Rút tiền thành công! Đã chuyển khoản **${formatVND(withdrawal.amount)}** vào tài khoản ngân hàng của bạn.`);
  } catch (err) {
    console.warn('[orderFlow] Không thể DM người dùng sau khi rút tiền:', err.message);
  }
}

async function handleWithdrawReject(interaction, withdrawalId) {
  const settings = db.getSettings();
  if (!isMarketAdmin(interaction.member, settings)) {
    return interaction.reply({ content: '⛔ Bạn không có quyền xử lý yêu cầu rút tiền.', ephemeral: true });
  }

  const withdrawal = db.getWithdrawal(withdrawalId);
  if (!withdrawal) return interaction.reply({ content: '❌ Không tìm thấy yêu cầu.', ephemeral: true });
  if (withdrawal.status !== 'reviewing') {
    return interaction.reply({ content: 'ℹ️ Yêu cầu này đã được xử lý trước đó.', ephemeral: true });
  }

  await customers.adjustBalance(withdrawal.userId, withdrawal.amount);
  await customers.updateCustomer(withdrawal.userId, { pendingWithdrawalId: null });
  await customers.recordWithdrawal(withdrawal.userId, {
    withdrawalId: withdrawal.id,
    amount: withdrawal.amount,
    status: 'rejected',
  });
  await db.updateWithdrawal(withdrawalId, { status: 'rejected', rejectedBy: interaction.user.id });

  await interaction.update({
    embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(COLOR_DANGER).setTitle('❌ Yêu cầu bị từ chối')],
    components: [],
  });

  try {
    const dmUser = await interaction.client.users.fetch(withdrawal.userId);
    await dmUser.send(
      `❌ Yêu cầu rút tiền **${withdrawal.id}** đã bị từ chối. Số dư **${formatVND(withdrawal.amount)}** đã được hoàn lại vào hồ sơ của bạn.`
    );
  } catch (err) {
    console.warn('[orderFlow] Không thể DM người dùng sau khi từ chối rút tiền:', err.message);
  }
}

// ============================================================================
// 8.5) GAMBLE FLOW (chơi / nạp / rút)
// ============================================================================
function hasActiveGambleDeposit(userId) {
  return db.listGambleDeposits((d) => d.userId === userId && ['pending_payment', 'checking'].includes(d.status)).length > 0;
}

// ---- Panel: các nút Chẵn Lẻ / Tài Xỉu / Số Dư / Nạp / Rút ----
async function handleGamblePanelButton(interaction, action) {
  const settings = db.getSettings();

  if (action === 'chanle' || action === 'taixiu') {
    if (settings.gambleStatus !== 'active') {
      return interaction.reply({ content: '⏸️ Gamble đang **tạm dừng**, vui lòng quay lại sau.', ephemeral: true });
    }
    return interaction.reply({
      embeds: [gambleChoiceEmbed(action)],
      components: [action === 'chanle' ? gambleChanLeChoiceRow() : gambleTaiXiuChoiceRow()],
      ephemeral: true,
    });
  }

  if (action === 'balance') {
    await touchCustomer(interaction.user);
    const customer = customers.getCustomer(interaction.user.id);
    return interaction.reply({
      embeds: [gambleProfileEmbed(customer, interaction.member ?? interaction.user)],
      ephemeral: true,
    });
  }

  if (action === 'deposit') {
    if (settings.gambleStatus !== 'active') {
      return interaction.reply({ content: '⏸️ Gamble đang **tạm dừng**, vui lòng quay lại sau.', ephemeral: true });
    }
    if (!settings.gambleReceiverIGN && !settings.receiverIGN) {
      return interaction.reply({ content: '⚠️ Admin chưa cấu hình IGN nhận tiền. Vui lòng thử lại sau.', ephemeral: true });
    }
    if (hasActiveGambleDeposit(interaction.user.id)) {
      return interaction.reply({
        content: '⏳ Bạn đang có một yêu cầu nạp chưa hoàn tất. Vui lòng hoàn tất hoặc chờ admin xử lý trước.',
        ephemeral: true,
      });
    }
    return interaction.showModal(gambleDepositModal());
  }

  if (action === 'withdraw') {
    const customer = customers.getCustomer(interaction.user.id);
    if (customer.pendingGambleWithdrawalId) {
      return interaction.reply({ content: '⏳ Bạn đang có một yêu cầu rút đang xử lý.', ephemeral: true });
    }
    if (!customer.gambleBalance || customer.gambleBalance <= 0) {
      return interaction.reply({ content: '❌ Số dư gamble của bạn đang là 0.', ephemeral: true });
    }
    if (!settings.gamblePaymentChannelId) {
      return interaction.reply({ content: '⚠️ Admin chưa cấu hình kênh payment cho gamble. Vui lòng liên hệ admin.', ephemeral: true });
    }
    return interaction.showModal(gambleWithdrawModal());
  }
}

// ---- Chọn Chẵn/Lẻ/Tài/Xỉu -> mở modal nhập số tiền cược ----
async function handleGambleChoose(interaction, game, choice) {
  const settings = db.getSettings();
  if (settings.gambleStatus !== 'active') {
    return interaction.reply({ content: '⏸️ Gamble đang **tạm dừng**, vui lòng quay lại sau.', ephemeral: true });
  }
  return interaction.showModal(gambleBetModal(game, choice));
}

// ---- Submit modal đặt cược -> roll kết quả theo tỉ lệ công khai ----
async function handleGambleBetModalSubmit(interaction, game, choice) {
  const settings = db.getSettings();
  if (settings.gambleStatus !== 'active') {
    return interaction.reply({ content: '⏸️ Gamble đang **tạm dừng**, vui lòng quay lại sau.', ephemeral: true });
  }

  const rawAmount = interaction.fields.getTextInputValue('amount');
  const amount = parseAmountInput(rawAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return interaction.reply({ content: '❌ Số tiền không hợp lệ. Ví dụ hợp lệ: `5000000`, `5.000.000`, hoặc `5m`.', ephemeral: true });
  }
  if (amount < settings.gambleMinBet) {
    return interaction.reply({ content: `❌ Số tiền cược tối thiểu là **${formatNumber(settings.gambleMinBet)}**.`, ephemeral: true });
  }
  if (settings.gambleMaxBet > 0 && amount > settings.gambleMaxBet) {
    return interaction.reply({ content: `❌ Số tiền cược tối đa là **${formatNumber(settings.gambleMaxBet)}**.`, ephemeral: true });
  }

  await touchCustomer(interaction.user);
  const customer = customers.getCustomer(interaction.user.id);
  if ((customer.gambleBalance || 0) < amount) {
    return interaction.reply({
      content: `❌ Số dư gamble không đủ (hiện có **${formatNumber(customer.gambleBalance || 0)}**). Bấm "Nạp" trên bảng gamble để nạp thêm.`,
      ephemeral: true,
    });
  }

  // Trừ tiền cược trước
  await customers.adjustGambleBalance(interaction.user.id, -amount);

  const { win } = rollGambleOutcome(amount);
  let roll;
  if (game === 'chanle') {
    roll = generateChanLeNumber(choice, win);
  } else {
    roll = generateTaiXiuDice(choice, win);
  }

  let updatedCustomer;
  if (win) {
    updatedCustomer = await customers.adjustGambleBalance(interaction.user.id, amount * 2);
  } else {
    updatedCustomer = customers.getCustomer(interaction.user.id);
  }

  await customers.recordGambleBet(interaction.user.id, {
    game,
    choice,
    amount,
    result: win ? 'win' : 'lose',
  });

  return interaction.reply({
    embeds: [
      gambleResultEmbed({ game, choice, win, amount, newBalance: updatedCustomer.gambleBalance, roll }),
    ],
    ephemeral: true,
  });
}

// ---- 1) Submit modal Nạp -> tạo yêu cầu, DM hướng dẫn /pay ----
async function handleGambleDepositModalSubmit(interaction) {
  const settings = db.getSettings();
  if (settings.gambleStatus !== 'active') {
    return interaction.reply({ content: '⏸️ Gamble đang **tạm dừng**, vui lòng quay lại sau.', ephemeral: true });
  }

  const rawAmount = interaction.fields.getTextInputValue('amount');
  const ign = sanitizeIGN(interaction.fields.getTextInputValue('ign'));
  const amount = parseAmountInput(rawAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return interaction.reply({ content: '❌ Số tiền không hợp lệ. Ví dụ hợp lệ: `10000000`, `10.000.000`, hoặc `10m`.', ephemeral: true });
  }
  if (!ign) {
    return interaction.reply({ content: '❌ IGN không hợp lệ, vui lòng nhập lại.', ephemeral: true });
  }

  const deposit = await db.createGambleDeposit({
    userId: interaction.user.id,
    guildId: interaction.guildId,
    amount,
    ign,
    status: 'pending_payment', // pending_payment -> checking -> approved/rejected
  });

  await customers.updateCustomer(interaction.user.id, {
    ign,
    username: interaction.user.username,
    tag: interaction.user.tag,
  });

  try {
    await interaction.user.send({ embeds: [gambleDepositDMEmbed(deposit, settings)], components: [gambleDepositConfirmRow(deposit.id)] });
    await interaction.reply({ content: '📬 Đã gửi hướng dẫn nạp tiền vào tin nhắn riêng (DM) của bạn. Vui lòng kiểm tra!', ephemeral: true });
  } catch (err) {
    await interaction.reply({
      content: '❌ Không thể gửi DM cho bạn. Vui lòng bật tin nhắn riêng (Direct Messages) từ thành viên server và thử lại.',
      ephemeral: true,
    });
    await db.updateGambleDeposit(deposit.id, { status: 'failed_dm' });
  }
}

// ---- 2) Người dùng bấm "Tôi đã pay" trong DM -> gửi kênh checking ----
async function handleGambleDepositPaid(interaction, depositId) {
  const deposit = db.getGambleDeposit(depositId);
  if (!deposit) return interaction.reply({ content: '❌ Không tìm thấy yêu cầu.', ephemeral: true });
  if (deposit.userId !== interaction.user.id) {
    return interaction.reply({ content: '⛔ Đây không phải yêu cầu của bạn.', ephemeral: true });
  }
  if (deposit.status !== 'pending_payment') {
    return interaction.reply({ content: 'ℹ️ Yêu cầu này đã được xử lý trước đó.', ephemeral: true });
  }

  const settings = db.getSettings();
  await db.updateGambleDeposit(depositId, { status: 'checking' });

  await interaction.update({
    embeds: interaction.message.embeds,
    components: [],
    content: '🔎 Yêu cầu của bạn đang được **xác minh**, vui lòng chờ trong giây lát...',
  });

  if (!settings.gambleCheckingChannelId) {
    return interaction.followUp({
      content: '⚠️ Admin chưa cấu hình kênh checking cho gamble, vui lòng liên hệ trực tiếp.',
      ephemeral: true,
    });
  }

  try {
    const channel = await interaction.client.channels.fetch(settings.gambleCheckingChannelId);
    await channel.send({
      embeds: [gambleDepositCheckingEmbed(deposit, interaction.user)],
      components: [gambleDepositReviewRow(deposit.id)],
    });
  } catch (err) {
    console.error('[gambleFlow] Không thể gửi vào kênh checking:', err);
  }
}

// ---- 3) Admin Duyệt / Từ chối yêu cầu nạp ----
async function handleGambleDepositApprove(interaction, depositId) {
  const settings = db.getSettings();
  if (!isMarketAdmin(interaction.member, settings)) {
    return interaction.reply({ content: '⛔ Bạn không có quyền duyệt yêu cầu này.', ephemeral: true });
  }

  const deposit = db.getGambleDeposit(depositId);
  if (!deposit) return interaction.reply({ content: '❌ Không tìm thấy yêu cầu.', ephemeral: true });
  if (deposit.status !== 'checking') {
    return interaction.reply({ content: 'ℹ️ Yêu cầu này đã được xử lý trước đó.', ephemeral: true });
  }

  await db.updateGambleDeposit(depositId, { status: 'approved', approvedBy: interaction.user.id });
  const updatedCustomer = await customers.adjustGambleBalance(deposit.userId, deposit.amount);
  await customers.recordGambleDeposit(deposit.userId, { depositId: deposit.id, amount: deposit.amount, status: 'approved' });

  await interaction.update({
    embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(COLOR_SUCCESS).setTitle('✅ Đã duyệt nạp gamble')],
    components: [],
  });

  try {
    const dmUser = await interaction.client.users.fetch(deposit.userId);
    await dmUser.send(
      `✅ Yêu cầu nạp **${deposit.id}** đã được duyệt!\n` +
        `💰 Đã cộng **${formatNumber(deposit.amount)}** vào số dư gamble.\n` +
        `📊 Số dư gamble hiện tại: **${formatNumber(updatedCustomer.gambleBalance)}**`
    );
  } catch (err) {
    console.warn('[gambleFlow] Không thể DM người dùng sau khi duyệt:', err.message);
  }
}

async function handleGambleDepositReject(interaction, depositId) {
  const settings = db.getSettings();
  if (!isMarketAdmin(interaction.member, settings)) {
    return interaction.reply({ content: '⛔ Bạn không có quyền xử lý yêu cầu này.', ephemeral: true });
  }

  const deposit = db.getGambleDeposit(depositId);
  if (!deposit) return interaction.reply({ content: '❌ Không tìm thấy yêu cầu.', ephemeral: true });
  if (deposit.status !== 'checking') {
    return interaction.reply({ content: 'ℹ️ Yêu cầu này đã được xử lý trước đó.', ephemeral: true });
  }

  await db.updateGambleDeposit(depositId, { status: 'rejected', rejectedBy: interaction.user.id });
  await customers.recordGambleDeposit(deposit.userId, { depositId: deposit.id, amount: deposit.amount, status: 'rejected' });

  await interaction.update({
    embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(COLOR_DANGER).setTitle('❌ Yêu cầu nạp bị từ chối')],
    components: [],
  });

  try {
    const dmUser = await interaction.client.users.fetch(deposit.userId);
    await dmUser.send(
      `❌ Yêu cầu nạp **${deposit.id}** đã bị **từ chối** (không xác minh được giao dịch trong game).\n` +
        `Vui lòng liên hệ admin nếu bạn cho rằng đây là nhầm lẫn.`
    );
  } catch (err) {
    console.warn('[gambleFlow] Không thể DM người dùng sau khi từ chối:', err.message);
  }
}

// ---- 4) Submit modal Rút -> trừ tiền ngay, gửi thẳng kênh payment ----
async function handleGambleWithdrawModalSubmit(interaction) {
  const settings = db.getSettings();
  const customer = customers.getCustomer(interaction.user.id);

  if (customer.pendingGambleWithdrawalId) {
    return interaction.reply({ content: '⏳ Bạn đang có một yêu cầu rút đang xử lý.', ephemeral: true });
  }
  if (!settings.gamblePaymentChannelId) {
    return interaction.reply({ content: '⚠️ Admin chưa cấu hình kênh payment cho gamble. Vui lòng liên hệ admin.', ephemeral: true });
  }

  const rawAmount = interaction.fields.getTextInputValue('amount');
  const ign = sanitizeIGN(interaction.fields.getTextInputValue('ign'));
  const amount = parseAmountInput(rawAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return interaction.reply({ content: '❌ Số tiền không hợp lệ. Ví dụ hợp lệ: `10000000`, `10.000.000`, hoặc `10m`.', ephemeral: true });
  }
  if (!ign) {
    return interaction.reply({ content: '❌ IGN không hợp lệ, vui lòng nhập lại.', ephemeral: true });
  }
  if (amount > (customer.gambleBalance || 0)) {
    return interaction.reply({
      content: `❌ Số dư gamble không đủ (hiện có **${formatNumber(customer.gambleBalance || 0)}**).`,
      ephemeral: true,
    });
  }

  const withdrawal = await db.createGambleWithdrawal({
    userId: interaction.user.id,
    guildId: interaction.guildId,
    amount,
    ign,
    status: 'reviewing', // reviewing -> completed/rejected
  });

  await customers.adjustGambleBalance(interaction.user.id, -amount);
  await customers.updateCustomer(interaction.user.id, { ign, pendingGambleWithdrawalId: withdrawal.id });

  try {
    const channel = await interaction.client.channels.fetch(settings.gamblePaymentChannelId);
    await channel.send({
      embeds: [gambleWithdrawRequestEmbed(withdrawal, interaction.user, settings)],
      components: [gambleWithdrawReviewRow(withdrawal.id)],
    });
    await interaction.reply({
      content: `📬 Đã tạo yêu cầu rút **${formatNumber(amount)}**. Admin sẽ thanh toán vào IGN \`${ign}\` và xác nhận trong ít phút.`,
      ephemeral: true,
    });
  } catch (err) {
    console.error('[gambleFlow] Không thể gửi vào kênh payment:', err);
    await customers.adjustGambleBalance(interaction.user.id, amount);
    await customers.updateCustomer(interaction.user.id, { pendingGambleWithdrawalId: null });
    await db.updateGambleWithdrawal(withdrawal.id, { status: 'cancelled' });
    await interaction.reply({ content: '❌ Không thể tạo yêu cầu rút, vui lòng thử lại sau.', ephemeral: true });
  }
}

// ---- 5) Admin Đã chuyển / Từ chối trong kênh payment ----
async function handleGambleWithdrawConfirm(interaction, withdrawalId) {
  const settings = db.getSettings();
  if (!isMarketAdmin(interaction.member, settings)) {
    return interaction.reply({ content: '⛔ Bạn không có quyền xử lý yêu cầu này.', ephemeral: true });
  }

  const withdrawal = db.getGambleWithdrawal(withdrawalId);
  if (!withdrawal) return interaction.reply({ content: '❌ Không tìm thấy yêu cầu.', ephemeral: true });
  if (withdrawal.status !== 'reviewing') {
    return interaction.reply({ content: 'ℹ️ Yêu cầu này đã được xử lý trước đó.', ephemeral: true });
  }

  await db.updateGambleWithdrawal(withdrawalId, { status: 'completed', completedBy: interaction.user.id });
  await customers.updateCustomer(withdrawal.userId, { pendingGambleWithdrawalId: null });
  await customers.recordGambleWithdrawal(withdrawal.userId, { withdrawalId: withdrawal.id, amount: withdrawal.amount, status: 'completed' });

  await interaction.update({
    embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(COLOR_SUCCESS).setTitle('✅ Đã chuyển tiền gamble')],
    components: [],
  });

  try {
    const dmUser = await interaction.client.users.fetch(withdrawal.userId);
    await dmUser.send(`✅ Rút tiền thành công! Đã chuyển **${formatNumber(withdrawal.amount)}** vào IGN **${withdrawal.ign}**.`);
  } catch (err) {
    console.warn('[gambleFlow] Không thể DM người dùng sau khi rút tiền:', err.message);
  }
}

async function handleGambleWithdrawReject(interaction, withdrawalId) {
  const settings = db.getSettings();
  if (!isMarketAdmin(interaction.member, settings)) {
    return interaction.reply({ content: '⛔ Bạn không có quyền xử lý yêu cầu này.', ephemeral: true });
  }

  const withdrawal = db.getGambleWithdrawal(withdrawalId);
  if (!withdrawal) return interaction.reply({ content: '❌ Không tìm thấy yêu cầu.', ephemeral: true });
  if (withdrawal.status !== 'reviewing') {
    return interaction.reply({ content: 'ℹ️ Yêu cầu này đã được xử lý trước đó.', ephemeral: true });
  }

  await customers.adjustGambleBalance(withdrawal.userId, withdrawal.amount);
  await customers.updateCustomer(withdrawal.userId, { pendingGambleWithdrawalId: null });
  await customers.recordGambleWithdrawal(withdrawal.userId, { withdrawalId: withdrawal.id, amount: withdrawal.amount, status: 'rejected' });
  await db.updateGambleWithdrawal(withdrawalId, { status: 'rejected', rejectedBy: interaction.user.id });

  await interaction.update({
    embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(COLOR_DANGER).setTitle('❌ Yêu cầu rút bị từ chối')],
    components: [],
  });

  try {
    const dmUser = await interaction.client.users.fetch(withdrawal.userId);
    await dmUser.send(
      `❌ Yêu cầu rút **${withdrawal.id}** đã bị từ chối. Số dư **${formatNumber(withdrawal.amount)}** đã được hoàn lại vào số dư gamble của bạn.`
    );
  } catch (err) {
    console.warn('[gambleFlow] Không thể DM người dùng sau khi từ chối rút tiền:', err.message);
  }
}

// ============================================================================
// 9) DISCORD CLIENT
// ============================================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Đã đăng nhập với tên ${c.user.tag}`);

  // Tự động đăng ký slash command mỗi khi khởi động (thay cho lệnh deploy riêng)
  try {
    const body = commandDefinitions.map((cmd) => cmd.toJSON());
    if (config.guildId) {
      const guild = await c.guilds.fetch(config.guildId);
      await guild.commands.set(body);
      console.log(`🔄 Đã đăng ký ${body.length} lệnh cho server ${config.guildId} (nhanh).`);
    } else {
      await c.application.commands.set(body);
      console.log(`🔄 Đã đăng ký ${body.length} lệnh trên toàn cục (có thể mất tới 1 giờ để cập nhật).`);
    }
  } catch (err) {
    console.error('[deploy] Lỗi khi đăng ký slash command:', err);
  }

  c.user.setPresence({
    activities: [{ name: 'Auto Nhận · /market-panel', type: 3 /* Watching */ }],
    status: 'online',
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      return handleCommand(interaction);
    }

    if (interaction.isButton()) {
      const [ns, action, id] = interaction.customId.split(':');

      if (ns === 'market' && action === 'gift') {
        return interaction.showModal(giftModal());
      }
      if (ns === 'market' && action === 'profile') {
        return handleProfile(interaction);
      }
      if (ns === 'market' && action === 'withdraw') {
        return handleWithdrawClick(interaction);
      }
      if (ns === 'order' && action === 'paid') {
        return handleOrderPaid(interaction, id);
      }
      if (ns === 'order' && action === 'approve') {
        return handleOrderApprove(interaction, id);
      }
      if (ns === 'order' && action === 'reject') {
        return handleOrderReject(interaction, id);
      }
      if (ns === 'withdraw' && action === 'confirm') {
        return handleWithdrawConfirm(interaction, id);
      }
      if (ns === 'withdraw' && action === 'reject') {
        return handleWithdrawReject(interaction, id);
      }

      if (ns === 'gamble') {
        if (action === 'panel') {
          // customId: gamble:panel:<chanle|taixiu|balance|deposit|withdraw>
          return handleGamblePanelButton(interaction, id);
        }
        if (action === 'choose') {
          // customId: gamble:choose:<chanle|taixiu>:<chan|le|tai|xiu>
          const [, , choiceGame, choiceValue] = interaction.customId.split(':');
          return handleGambleChoose(interaction, choiceGame, choiceValue);
        }
        if (action === 'deposit_paid') return handleGambleDepositPaid(interaction, id);
        if (action === 'deposit_approve') return handleGambleDepositApprove(interaction, id);
        if (action === 'deposit_reject') return handleGambleDepositReject(interaction, id);
        if (action === 'withdraw_confirm') return handleGambleWithdrawConfirm(interaction, id);
        if (action === 'withdraw_reject') return handleGambleWithdrawReject(interaction, id);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'market:gift_modal') {
        return handleGiftModalSubmit(interaction);
      }
      if (interaction.customId === 'gamble:deposit_modal') {
        return handleGambleDepositModalSubmit(interaction);
      }
      if (interaction.customId === 'gamble:withdraw_modal') {
        return handleGambleWithdrawModalSubmit(interaction);
      }
      if (interaction.customId.startsWith('gamble:bet_modal:')) {
        const [, , game, choice] = interaction.customId.split(':');
        return handleGambleBetModalSubmit(interaction, game, choice);
      }
    }
  } catch (err) {
    console.error('[interactionCreate] Lỗi xử lý interaction:', err);
    const payload = { content: '❌ Đã xảy ra lỗi, vui lòng thử lại sau.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (message.guild) return; // chỉ xử lý DM
    if (message.attachments.size > 0) {
      await handleDMAttachment(message);
    }
  } catch (err) {
    console.error('[messageCreate] Lỗi xử lý tin nhắn DM:', err);
  }
});const DEBUG_MODE = true;

const FORCE_RESULT = {
    enabled: false,
    side: null // "tai", "xiu" hoặc null
};

Khi tạo kết quả:

function generateTaiXiuDice(choice, win) {

    if (DEBUG_MODE && FORCE_RESULT.enabled) {
        const wantSide = FORCE_RESULT.side;

        let dice;
        do {
            dice = [1,1,1].map(() => 1 + Math.floor(Math.random() * 6));
        } while (
            ((dice[0] + dice[1] + dice[2] >= 11 ? "tai" : "xiu") !== wantSide)
        );

        return dice;
    }

    // Code random gốc...
}

Và chỉ admin mới nhìn thấy nút:

if (interaction.user.id !== OWNER_ID) return;

await interaction.reply({
    content: "Chọn kết quả muốn ép",
    ephemeral: true
});