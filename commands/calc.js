import fetch from "node-fetch"

export default async function (bot, message, args) {
	args = args.join(" ")
	const req = await fetch(
		"https://f.ggg.dev/api/calculator?expression=" + encodeURIComponent(args)
	)
	const res = await req.text()
	message.reply(res)
}
