const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const express = require("express");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const prefix = "!";

// Banco de dados simples na memória
const users = new Map();

// Sistema de economia simples
function addCoins(userId, amount) {
  if (!users.has(userId)) users.set(userId, { coins: 0 });
  users.get(userId).coins += amount;
}

function getCoins(userId) {
  return users.has(userId) ? users.get(userId).coins : 0;
}

// Comandos com prefixo
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // 💡 Sugestão
  if (command === "sugestao") {
    const sugestao = args.join(" ");
    if (!sugestao) return message.reply("Você precisa escrever uma sugestão.");
    const embed = new EmbedBuilder()
      .setTitle("📬 Nova Sugestão")
      .setDescription(sugestao)
      .setFooter({ text: `Sugestão enviada por ${message.author.tag}` })
      .setColor("Blue");
    const sugestaoMsg = await message.channel.send({ embeds: [embed] });
    sugestaoMsg.react("✅");
    sugestaoMsg.react("❌");
    return message.reply("Sugestão enviada com sucesso!");
  }

  // 💰 Economia
  else if (command === "saldo") {
    const coins = getCoins(message.author.id);
    return message.reply(`Você tem 💰 ${coins} moedas.`);
  } else if (command === "trabalhar") {
    const coinsEarned = Math.floor(Math.random() * 50) + 1;
    addCoins(message.author.id, coinsEarned);
    return message.reply(`Você trabalhou e ganhou 💰 ${coinsEarned} moedas!`);
  }

  // 🎉 Diversão
  else if (command === "piada") {
    const piadas = [
      "Por que o programador foi ao médico? Porque ele tinha um bug.",
      "Qual o rei dos queijos? O reiqueijão.",
      "O que o zero disse para o oito? Belo cinto!"
    ];
    const aleatoria = piadas[Math.floor(Math.random() * piadas.length)];
    return message.reply(aleatoria);
  }

  // 🛠️ Utilitário
  else if (command === "ping") {
    const msg = await message.reply("Calculando...");
    const latency = msg.createdTimestamp - message.createdTimestamp;
    msg.edit(`🏓 Pong! Latência: ${latency}ms`);
  }

  // ✅ Moderação leve
  else if (command === "limpar") {
    const quantidade = parseInt(args[0]);
    if (!quantidade || isNaN(quantidade)) return message.reply("Quantos mensagens deseja apagar?");
    const msgs = await message.channel.bulkDelete(quantidade, true);
    message.channel.send(`🧹 ${msgs.size} mensagens apagadas!`).then(msg => setTimeout(() => msg.delete(), 3000));
  }
});

// 📅 Evento de palavras-chave
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const palavrasChave = ["oi bot", "eae bot", "fala bot"];
  if (palavrasChave.some((palavra) => message.content.toLowerCase().includes(palavra))) {
    message.reply("Olá! Precisa de algo? Use `!ajuda` 😄");
  }
});

// 🌐 Servidor HTTP para uptime
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot secundário online!"));

app.listen(port, () => {
  console.log(`Servidor HTTP rodando na porta ${port}`);
});

// 🤖 Login no bot
client.login(process.env.TOKEN);
