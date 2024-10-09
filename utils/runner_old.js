import { LuaFactory } from "wasmoon"
import fetch from "node-fetch"
import util from "util"
import { AttachmentBuilder } from "discord.js"
import { readFile, readdir } from "fs/promises"
import { fileURLToPath } from "url"
import { dirname } from "path"

let output = String()

function writeOutput(...args) {
	let str = String()

	if (args.length > 1) str = util.inspect(args)
	else str = typeof args[0] == "string" ? args[0] : util.inspect(args[0])
	if (str == "undefined") return

	output += (output ? "\n" : "") + str
}

export async function sendOutput(message, output, limit = 2000) {
	if (output.length === 0) return
	if (output.length > limit) {
		const file = new AttachmentBuilder()
		file.setFile(Buffer.from(output))
		file.setName("output.txt")
		await message.channel.send({ files: [file] })
	} else {
		output = output.replace(/^["'](.+(?=["']$))["']$/, "$1")
		await message.reply(output)
	}
}

function arrayToTable(lua, array, name) {
	const thread = lua.global
	const L = thread.address

	thread.lua.lua_createtable(L, array.length, 0)

	for (let i = 0; i < array.length; i++) {
		thread.pushValue(i + 1)

		if (Array.isArray(array[i])) {
			arrayToTable(lua, array[i], false)
		} else {
			thread.pushValue(array[i])
		}

		thread.lua.lua_settable(L, -3)
	}

	if (name) {
		lua.global.lua.lua_setglobal(L, name)
	}
}

export async function runLua(message, code, bot, args, tag) {
	output = String()

	const factory = new LuaFactory()
	const lua = await factory.createEngine({ traceAllocations: true })
	const env = lua.global

	env.setMemoryMax(1024 * 128)
	env.setTimeout(Date.now() + 10000)

	env.set("io", null)
	env.set("package", null)
	env.set("dofile", null)
	env.set("loadfile", null)
	env.set("load", null)

	const { clock, date } = env.get("os")
	env.set("os", {
		clock,
		date,
		time: () => Math.trunc(Date.now() / 1000).toString()
		// time: () => Math.trunc(Date.now() / 1000)
	})

	const { traceback } = env.get("debug")
	env.set("debug", { traceback })

	env.set("log", writeOutput)
	env.set("print", writeOutput)
	env.set("json", {
		encode: JSON.stringify,
		decode: JSON.parse
	})
	env.set("fetch", fetch)
	env.set("fetchText", async (url, options) => {
		const req = await fetch(url, options)
		const res = await req.text()
		return res
	})
	env.set("fetchJson", async (url, options) => {
		const req = await fetch(url, options)
		const res = await req.json()
		return res
	})

	env.set("encodeURIComponent", encodeURIComponent)
	env.set("encodeURI", encodeURI)

	// env.set("chatgpt", {
	// 	prompt: async(str) => {
	// 		const res = await bot.gpt.prompt(str)
	// 		return res.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
	// 	},
	// 	busy: () => bot.gpt.busy
	// })

	if (args) {
		arrayToTable(lua, args, "args")
		// env.set("args", args)
	}

	const userId = tag ? tag.owner : message.author.id

	env.set("kv", {
		all: async () => {
			const user = await bot.userdb.get(userId)
			return user.kv
		},
		get: async key => {
			const user = await bot.userdb.get(userId)
			return user.kv[key]
		},
		set: async (key, value) => {
			if (value.toString().length > 2000)
				throw new Error("value more than 2000 characters")

			const user = await bot.userdb.get(userId)

			if (Object.keys(user.kv).length > 100)
				throw new Error("more than 100 keys")

			user.kv[key] = value
			return bot.userdb.set(userId, user)
		},
		delete: async key => {
			const user = await bot.userdb.get(userId)
			delete user.kv[key]
			return bot.userdb.set(userId, user)
		},
		clear: async () => {
			const user = await bot.userdb.get(userId)
			user.kv = {}
			return bot.userdb.set(userId, user)
		}
	})

	const { id, username, discriminator, avatar, banner } =
		await message.author.fetch({ force: true })

	env.set("message", {
		author: {
			id,
			username,
			discriminator,
			avatarURL: () =>
				avatar &&
				`https://cdn.discordapp.com/avatars/${id}/${avatar}.webp?size=1024`,
			bannerURL: () =>
				banner &&
				`https://cdn.discordapp.com/banners/${id}/${banner}.png?size=600`
		},
		content: message.content
		// reply: message.reply
	})

	if (message.guild) {
		let members = await message.guild.members.fetch({
			withPresences: true,
			force: true
		})

		members.each(member => {
			const user = member.user
			members.set(user.id, {
				nickname: member.nickname,
				roles: member._roles,
				avatarURL: () =>
					member.avatar &&
					`https://cdn.discordapp.com/avatars/${user.id}/${member.avatar}.webp?size=256`,
				bannerURL: () =>
					member.banner &&
					`https://cdn.discordapp.com/banners/${user.id}/${member.banner}.png?size=600`,
				presence: {
					status: member.presence?.status,
					clientStatus: member.presence?.clientStatus,
					activities: member.presence?.activities
				},
				user: {
					id: user.id,
					username: user.username,
					discriminator: user.discriminator,
					avatarURL: () =>
						user.avatar &&
						`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=256`,
					bannerURL: () =>
						user.banner &&
						`https://cdn.discordapp.com/banners/${user.id}/${user.banner}.png?size=600`
				}
			})
		})

		env.set("members", members)
	}

	const __filename = fileURLToPath(import.meta.url)
	const __dirname = dirname(__filename)
	const luaFiles = await readdir(__dirname + "/lua", { withFileTypes: true })

	for (const file of luaFiles) {
		const name = __dirname + "/lua/" + file.name
		await factory.mountFile(name, await readFile(name))
		await lua.doFile(name)
	}

	try {
		await message.channel.sendTyping()
		const res = await lua.doString(code)
		writeOutput(res)
	} catch (e) {
		let err = e.message

		if (err.indexOf("Aborted()") > -1) err = "aborted"
		writeOutput(err)
	}

	return output
}
