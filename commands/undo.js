import config from "../config.json" assert { type: "json" }
/**
 * Made by Sirro, hehehehahaha
 * Undo 
 */
export default async function (bot, message, args) { 
    let response = "";
    // get past 10 messages
    const messages = await message.channel.messages.fetch({ limit: 10 })

    // find the message that the user issued "."
    const userCommand = messages.find(
        (m) => m.author.id === message.author.id && m.content.startsWith(config.prefix) && m.content !== config.prefix + "undo"
    );
    
    // find the bot's response to the user's command by checking if it references the user's command
    const botResponse = userCommand && messages.find(
        (m) => m.author.id === bot.user.id && m.reference && m.reference.messageId === userCommand.id
    );
    
    // if we didnt find it then 
    if (!botResponse) {
        response = "Could not find a response to undo."
    } else {
        // we cant delete the users command if we are in a DM
        if (message.guild) {
            await userCommand.delete()
            await message.delete()
        }
        
        await botResponse.delete()
        

        // respond to the user
        response = "Undid the last command."
    }

    // respond to the user
    const msg = await message.channel.send(response);
    setTimeout(() => {
        msg.delete();
    }, 3000);

}