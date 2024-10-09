import { spawn, exec } from "child_process"
import { promisify } from "util"
import * as os from "os"

export class chatgpt {
	bot = null
  busy = false
	model = String()
	decoderConfig = {}
	executablePath = String()
	modelPath = String()

	constructor(model = "gpt4all-lora-quantized", decoderConfig = {}) {
		this.executablePath = `${os.homedir()}/.nomic/gpt4all-lora-quantized-`
		this.modelPath = `${os.homedir()}/.nomic/${model}.bin`
    this.decoderConfig = decoderConfig
	}

	async init() {
		const platform = os.platform()

		if (platform == "darwin") {
			const { stdout } = await promisify(exec)("uname -m")
			if (stdout.trim() == "arm64") {
				this.executablePath += "OSX-m1"
			} else {
				this.executablePath += "OSX-intel"
			}
		}
    else if (platform == "linux") {
      this.executablePath += "linux-x86"
    }
    else if (platform == "win32") {
      this.executablePath += "win64.exe"
    }
	}

	async open() {
		if (this.bot !== null) {
			this.close()
		}

		let spawnArgs = [this.executablePath, "--model", this.modelPath]

		for (let [key, value] of Object.entries(this.decoderConfig)) {
			spawnArgs.push(`--${key}`, value.toString())
		}

		this.bot = spawn(spawnArgs[0], spawnArgs.slice(1), {
			stdio: ["pipe", "pipe", "ignore"]
		})
		// wait for the bot to be ready
		await new Promise(resolve => {
			this.bot?.stdout?.on("data", data => {
				if (data.toString().includes(">")) {
					resolve(true)
				}
			})
		})
	}

	close() {
		if (this.bot !== null) {
			this.bot.kill()
			this.bot = null
		}
	}

	prompt(prompt) {
		if (this.bot === null) {
			throw new Error("Bot is not initialized.")
		}

		this.bot.stdin.write(prompt + "\n")
    this.busy = true

		return new Promise((resolve, reject) => {
			let response = ""
			let timeoutId

			const onStdoutData = data => {
				const text = data.toString()
				if (timeoutId) {
					clearTimeout(timeoutId)
				}

				if (text.includes(">")) {
					terminateAndResolve(response) // Remove the trailing "\f" delimiter
				} else {
					timeoutId = setTimeout(() => {
						terminateAndResolve(response)
					}, 4000) // Set a timeout of 4000ms to wait for more data
				}
				response += text
			}

			const onStdoutError = err => {
				this.bot.stdout.removeListener("data", onStdoutData)
				this.bot.stdout.removeListener("error", onStdoutError)
        this.busy = false
				reject(err)
			}

			const terminateAndResolve = finalResponse => {
				this.bot.stdout.removeListener("data", onStdoutData)
				this.bot.stdout.removeListener("error", onStdoutError)
				// check for > at the end and remove it
				if (finalResponse.endsWith(">")) {
					finalResponse = finalResponse.slice(0, -1)
				}
        this.busy = false
				resolve(finalResponse)
			}

			this.bot.stdout.on("data", onStdoutData)
			this.bot.stdout.on("error", onStdoutError)
		})
	}
}
