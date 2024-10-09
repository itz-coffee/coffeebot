import config from "./config.json" assert { type: "json" }
import { Client, GatewayIntentBits, Partials } from "discord.js"
import fs from "fs"
import Keyv from "keyv"
import crypto from "crypto"

const bot = new Client({
	intents: Object.values(GatewayIntentBits),
	partials: Object.values(Partials),
	allowedMentions: { parse: [] }
})

bot.chatid = crypto.randomUUID()
bot.tagdb = new Keyv("sqlite://./db.sqlite", { namespace: "tags" })
bot.userdb = new Keyv("sqlite://./db.sqlite", { namespace: "users" })

bot.on("messageCreate", async message => {
	if (message.author.bot) return

	if (message.partial) await message.fetch()

	let args = message.content
	let code

	if (args.indexOf("```lua") > -1) {
		[args, code] = args.split("```lua")
		args = args.split(" ")
		code = code.slice(0, -3).trim()
	} else {
		args = args.split(" ")
	}

	const cmd = args[0]
	args = args
		.slice(1)
		.join(" ")
		.replaceAll(/(“|”)/g, `"`)
		.split(/(".+?"|\s)/)
		.filter(c => c.match(/\S/))
		.map(c => c.replace(/^["'](.+(?=["']$))["']$/, "$1"))
	message.content = message.content.slice(config.prefix.length + cmd.length).trim()

	if (!cmd.startsWith(config.prefix)) return
	const path = `./commands/${cmd.slice(config.prefix.length)}.js`

	if (fs.existsSync(path)) {
		const file = await import(path)
		await file.default(bot, message, args, code)
	}
})

bot.login(config.token)

process.on("uncaughtException", e => {
	console.error(e)
})

// process.on("exit", code => {
// 	bot.gpt.exit()
// })
