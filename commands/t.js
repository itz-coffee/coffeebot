import { userMention } from "discord.js"
import { runLua, sendOutput } from "../utils/runner.js"
import { AttachmentBuilder } from "discord.js"

export default async function (bot, message, args, code) {
	const db = bot.tagdb
	const users = bot.userdb

	switch (args[0]) {
		case "create": {
			if (args.length < 3 && code === undefined) return

			const tag = await db.get(args[1])
			// const user = await users.get(message.author.id)

			if (tag) return message.reply("error: tag already exists")
			if (["create", "edit", "delete", "raw", "list", "owner"].indexOf(args[1]) > -1)
				return message.reply("error: reserved word")

			await db.set(args[1], {
				owner: message.author.id,
				content: code ?? message.content.slice(
					args[0].length + args[1].length + 2
				),
				lua: code !== undefined
			})

			// let tags = user?.tags

			// if (user) tags.push(args[1])
			// else tags = [args[1]]

			// await users.set(message.author.id, {
			// 	tags: tags
			// })
			await message.reply("tag created")
			break
		}
		case "edit": {
			if (args.length < 3 && code === undefined) return

			const tag = await db.get(args[1])

			if (message.author.id !== tag.owner && message.author.id !== "345691161530466304")
				return message.reply("error: not tag owner")

			await db.set(args[1], {
				owner: tag.owner,
				content: code ?? message.content.slice(
					args[0].length + args[1].length + 2
				),
				lua: code !== undefined
			})
			await message.reply("tag edited")
			break
		}
		case "delete": {
			if (args.length < 2) return

			const tag = await db.get(args[1])
			// const user = await users.get(message.author.id)

			if (!tag) return message.reply("error: not found")
			if (message.author.id !== tag.owner && message.author.id !== "345691161530466304")
				return message.reply("error: not tag owner")

			await db.delete(args[1])
			// if (user) {
			// 	await users.set(message.author.id, {
			// 		tags: user.tags.filter(x => x !== args[1])
			// 	})
			// }

			await message.reply("tag deleted")
			break
		}
		case "raw": {
			if (args.length < 2) return

			const tag = await db.get(args[1])
			let output

			if (!tag) return message.reply("error: not found")
			if (tag.lua) {
				output = "```lua\n" + tag.content + "\n```"
			} else {
				output = tag.content
			}

			if (output.length > 2000) {
				const file = new AttachmentBuilder()
				file.setFile(Buffer.from(output))
				file.setName("output.txt")
				await message.channel.send({ files: [file] })
			} else {
				await message.reply(output)
			}

			break
		}
		case "owner": {
			if (args.length < 2) return

			const tag = await db.get(args[1])

			if (!tag) return message.reply("error: not found")

			await message.reply(userMention(tag.owner))
			break
		}
		case "list": {
			let output = String()

			for await (const [key, value] of db.iterator()) {
				output += `${key}: ${userMention(value.owner)}\n`
			}
	
			const file = new AttachmentBuilder()
			file.setFile(Buffer.from(output))
			file.setName("output.txt")
			await message.channel.send({ files: [file] })
			break
		}
		default: {
			if (args.length < 1) return

			const tag = await db.get(args[0])

			if (!tag) return message.reply("error: not found")
			if (tag.lua) {
				const output = await runLua(message, tag.content, bot, args.slice(1), tag)
				await sendOutput(message, output)
			} else await message.reply(tag.content)

			break
		}
	}
}
