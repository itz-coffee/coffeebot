import { sendOutput } from "../utils/runner.js"

async function requestChat(prompt, bot) {
	const res = await fetch("http://localhost:8080/backend-api/v2/conversation", {
		headers: {
			"accept": "text/event-stream",
			"accept-language": "en-US,en;q=0.9,es-US;q=0.8,es;q=0.7",
			"cache-control": "no-cache",
			"content-type": "application/json",
			"pragma": "no-cache",
			"sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Microsoft Edge\";v=\"120\"",
			"sec-ch-ua-mobile": "?0",
			"sec-ch-ua-platform": "\"Windows\"",
			"sec-fetch-dest": "empty",
			"sec-fetch-mode": "cors",
			"sec-fetch-site": "same-origin",
			"Referrer-Policy": "strict-origin-when-cross-origin"
		},
		body: JSON.stringify({
			provider: "Bing",
			stream: true,
			patch_provider: false,
			messages: [
				{ role: "user", content: prompt }
			]
		}),
		method: "POST"
	})

  const stream = res.body
	const reader = stream.getReader()
	const decoder = new TextDecoder()
	let text = ""
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		text += decoder.decode(value)
	}

	return text
		.split("\n")
		.map(line => {
			try {
				return JSON.parse(line).content
			} catch (e) {}
		})
		.join("")
}

export default async function (bot, message, args) {
	if (bot._isApiRunning)
		return message.reply("Please wait until the last request is done")
	bot._isApiRunning = true
	await message.channel.sendTyping()
	try {
		const res = await requestChat(`Respond to the prompt as a helpful assistant, avoid long or multiple sentences when possible or any follow-ups: ${args.join(" ")}`, bot)
		message.output = res
		await sendOutput(message, undefined, 1000) // 300
	} catch (error) {
		console.error(error)
		await message.reply("(coffeebot error) Sorry, I couldn't generate a response for you.")
	}
	bot._isApiRunning = false
}
