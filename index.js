const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  Events,
  PermissionsBitField,
  AuditLogEvent,
} = require("discord.js");
const express = require("express");
require("dotenv").config();

// ===== VARIÁVEIS DO .env =====
const TOKEN = process.env.TOKEN;
const CANAL_LOGS = process.env.CANAL_LOGS;
const CARGO_APROVADO = process.env.CARGO_APROVADO;
const CARGO_REPROVADO = process.env.CARGO_REPROVADO;
const CARGO_STAFF = process.env.CARGO_STAFF;
const CATEGORIA_CANAIS = process.env.CATEGORIA_CANAIS;
const CATEGORIA_TICKETS = process.env.CATEGORIA_TICKETS;
const PORT = process.env.PORT || 3000;

// Servidor HTTP para uptime (Replit/Render)
const app = express();
app.get("/", (req, res) => res.send("Bot de formulário online."));
app.listen(PORT, () => console.log(`🟢 Servidor HTTP ativo na porta ${PORT}.`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// Controle para anti-exclusão
const exclusoesCanal = new Map(); // userId => {count, timeout}

client.once("ready", () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
});

// Anti-bot: kicka bots que tentarem entrar
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) {
    const canalLogs = await client.channels.fetch(CANAL_LOGS).catch(() => null);
    if (canalLogs?.isTextBased()) {
      canalLogs.send(`⚠️ Bot ${member.user.tag} tentou entrar e foi removido.`);
    }
    try {
      await member.kick("Bots não são permitidos neste servidor.");
    } catch (err) {
      console.error("Erro ao expulsar bot:", err);
    }
  }
  // Autorole: Adiciona cargo automático para membros (não bots)
  if (!member.user.bot && CARGO_AUTOROLE) {
    try {
      await member.roles.add(CARGO_AUTOROLE);
      console.log(`✅ Cargo automático adicionado para ${member.user.tag}`);
    } catch (err) {
      console.error("Erro ao adicionar cargo automático:", err);
    }
  }

});

// Anti-exclusão de canais e punição
client.on(Events.ChannelDelete, async (canal) => {
  try {
    const guild = canal.guild;

    // Pega audit log pra saber quem deletou
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 1,
    });
    const entry = auditLogs.entries.first();
    if (!entry) return;
    const executor = entry.executor;
    if (!executor) return;

    // Recria canal
    await recriarCanal(canal);

    // Contabiliza exclusões
    if (!exclusoesCanal.has(executor.id)) {
      exclusoesCanal.set(executor.id, { count: 1 });
      setTimeout(() => exclusoesCanal.delete(executor.id), 5 * 60 * 1000);
    } else {
      const dados = exclusoesCanal.get(executor.id);
      dados.count++;
      exclusoesCanal.set(executor.id, dados);

      if (dados.count >= 4) {
        // Bane executor
        const membro = await guild.members.fetch(executor.id).catch(() => null);
        if (membro && membro.bannable) {
          await membro.ban({
            reason: "Excluiu 4 ou mais canais em curto período",
          });
          const canalLogs = await client.channels
            .fetch(CANAL_LOGS)
            .catch(() => null);
          if (canalLogs?.isTextBased()) {
            canalLogs.send(
              `🚨 Usuário ${executor.tag} banido por excluir vários canais.`,
            );
          }
        }
        exclusoesCanal.delete(executor.id);
      }
    }
  } catch (error) {
    console.error("Erro no evento ChannelDelete:", error);
  }
});

// Comandos
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  // Painel de formulário
  if (msg.content === "!painel") {
    const embed = new EmbedBuilder()
      .setTitle("📋 Seja um Influenciador")
      .setDescription("Clique no botão abaixo para preencher o formulário!")
      .setColor("#092666")
      .setThumbnail(msg.guild.iconURL())
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_formulario")
        .setLabel("📋 Formulário de Influencer")
        .setStyle(ButtonStyle.Primary),
    );

    await msg.channel.send({ embeds: [embed], components: [row] });
  }

  // Painel de tickets
  if (msg.content === "!painelticket") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Suporte - Abra seu Ticket")
      .setDescription(
        "Clique no botão abaixo para abrir um ticket com a equipe de suporte.",
      )
      .setColor("Blue")
      .setTimestamp()
      .setFooter({ text: "Sistema de Tickets" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_ticket")
        .setLabel("🎫 Abrir Ticket")
        .setStyle(ButtonStyle.Primary),
    );

    await msg.channel.send({ embeds: [embed], components: [row] });
  }
});

// Interações
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Abrir formulário
    if (interaction.isButton() && interaction.customId === "abrir_formulario") {
      const modal = new ModalBuilder()
        .setCustomId("formulario_influencer")
        .setTitle("📋 Formulário de Influenciador");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("nome")
            .setLabel("Seu nome ou nick")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("canal")
            .setLabel("Link do canal/perfil")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("seguidores")
            .setLabel("Quantos seguidores você tem?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("motivo")
            .setLabel("Por que quer ser influenciador?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true),
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    // Envio do formulário
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "formulario_influencer"
    ) {
      const nome = interaction.fields.getTextInputValue("nome");
      const canal = interaction.fields.getTextInputValue("canal");
      const seguidores = interaction.fields.getTextInputValue("seguidores");
      const motivo = interaction.fields.getTextInputValue("motivo");

      const embed = new EmbedBuilder()
        .setTitle("📨 Novo Formulário de Influenciador")
        .addFields(
          { name: "👤 Nome / Nick", value: nome },
          { name: "🌐 Canal ou Perfil", value: canal },
          { name: "📊 Seguidores", value: seguidores },
          { name: "📝 Motivo", value: motivo },
        )
        .setFooter({ text: `ID: ${interaction.user.id}` })
        .setColor("Green")
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("aprovar_form")
          .setLabel("✅ Aprovar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("reprovar_form")
          .setLabel("❌ Reprovar")
          .setStyle(ButtonStyle.Danger),
      );

      const canalLogs = await client.channels.fetch(CANAL_LOGS);
      if (canalLogs?.isTextBased()) {
        await canalLogs.send({ embeds: [embed], components: [row] });
      }

      await interaction.reply({
        content: "✅ Formulário enviado com sucesso!",
        ephemeral: true,
      });
      return;
    }

    // Botões de aprovação ou reprovação do formulário
    if (
      interaction.isButton() &&
      (interaction.customId === "aprovar_form" ||
        interaction.customId === "reprovar_form")
    ) {
      const embed = interaction.message.embeds[0];
      const userId = embed?.footer?.text?.match(/\d+/)?.[0];
      if (!userId)
        return interaction.reply({
          content: "❌ Não foi possível identificar o usuário.",
          ephemeral: true,
        });

      const membro = await interaction.guild.members
        .fetch(userId)
        .catch(() => null);
      if (!membro)
        return interaction.reply({
          content: "❌ Membro não encontrado.",
          ephemeral: true,
        });

      if (!interaction.member.roles.cache.has(CARGO_STAFF)) {
        return interaction.reply({
          content: "❌ Você não tem permissão para isso.",
          ephemeral: true,
        });
      }

      const nomeFormatado = membro.user.username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 20);
      const canalCriado = await interaction.guild.channels.create({
        name: `📢・${nomeFormatado}`,
        type: ChannelType.GuildText,
        parent: CATEGORIA_CANAIS,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: CARGO_STAFF,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: membro.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ],
      });

      if (interaction.customId === "aprovar_form") {
        await membro.roles.add(CARGO_APROVADO);
        await canalCriado.send(
          `🎉 Parabéns ${membro}, você foi aprovado como influenciador!`,
        );
        await interaction.reply({
          content: "✅ Usuário aprovado e canal criado!",
          ephemeral: true,
        });
      }

      if (interaction.customId === "reprovar_form") {
        await membro.roles.add(CARGO_REPROVADO);
        await canalCriado.send(
          `📪 Olá ${membro}, infelizmente seu pedido foi reprovado. Qualquer dúvida, fale com a staff.`,
        );
        await interaction.reply({
          content: "❌ Usuário reprovado e canal criado.",
          ephemeral: true,
        });
      }
      return;
    }

    // Botão do painel de tickets
    if (interaction.isButton() && interaction.customId === "abrir_ticket") {
      const guild = interaction.guild;
      const user = interaction.user;

      // Verifica ticket aberto
      const ticketsAbertos = guild.channels.cache.filter(
        (c) =>
          c.parentId === CATEGORIA_TICKETS &&
          c.name === `ticket-min-${user.id}`,
      );
      if (ticketsAbertos.size > 0) {
        return interaction.reply({
          content: `Você já possui um ticket aberto!`,
          ephemeral: true,
        });
      }

      // Cria canal de ticket com "min" no nome
      const canalTicket = await guild.channels.create({
        name: `ticket-min-${user.id}`,
        type: ChannelType.GuildText,
        parent: CATEGORIA_TICKETS,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: CARGO_STAFF,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ],
      });

      // Botão para fechar ticket
      const fecharRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("fechar_ticket")
          .setLabel("🔒 Fechar Ticket")
          .setStyle(ButtonStyle.Danger),
      );

      await canalTicket.send({
        content: `Olá ${user}, seu ticket foi criado! Aguarde que a equipe irá te atender.`,
        components: [fecharRow],
      });

      await interaction.reply({
        content: `✅ Seu ticket foi criado: ${canalTicket}`,
        ephemeral: true,
      });
      return;
    }

    // Fechar ticket
    if (interaction.isButton() && interaction.customId === "fechar_ticket") {
      const channel = interaction.channel;

      // Verifica se o canal está na categoria de tickets
      if (channel.parentId !== CATEGORIA_TICKETS) {
        return interaction.reply({
          content: "❌ Este canal não é um ticket.",
          ephemeral: true,
        });
      }

      // Permite apenas staff ou dono do ticket (extrai ID do nome do canal)
      const ticketOwnerId = channel.name.split("ticket-min-")[1];
      if (
        !interaction.member.roles.cache.has(CARGO_STAFF) &&
        interaction.user.id !== ticketOwnerId
      ) {
        return interaction.reply({
          content: "❌ Você não tem permissão para fechar este ticket.",
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: "🔒 Ticket será fechado em 5 segundos.",
        ephemeral: true,
      });

      setTimeout(async () => {
        await channel.delete().catch(() => null);
      }, 5000);
    }
  } catch (error) {
    console.error("Erro na interação:", error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "❌ Ocorreu um erro interno.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "❌ Ocorreu um erro interno.",
        ephemeral: true,
      });
    }
  }
});

client.login(TOKEN);
