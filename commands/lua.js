import { runLua, sendOutput } from "../utils/runner.js"

export default async function (bot, message, args, code) {
	const output = await runLua(message, code ?? message.content, bot)
	// console.log(output)
	await sendOutput(message, output)
}
