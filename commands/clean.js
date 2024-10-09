import config from "../config.json" assert { type: "json" }
/**
 * Hai coffee :3
 * Clean command for bot, will purge the last 100 messages of "." commands and the bot's reponse
 */
export default async function (bot, message, args) {

    if (!message.member.roles.cache.some(role => role.name === 'unix team') || !message.guild) return

    const messages = await message.channel.messages.fetch({ limit: 100 })

    // filter out messages that are not from the bot or user typing a command
    const filtered = messages.filter(
        (m) => m.author.id === bot.user.id || m.content.startsWith(config.prefix)
    )

    // delete the messages
    await message.channel.bulkDelete(filtered)

    // respond to the user
    const response = await message.channel.send("Cleaned up " + filtered.size + " messages.");
    setTimeout(() => {
        response.delete();
    }, 3000);
}