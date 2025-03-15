For Server Developers
​
 Summarize
​
Get started building your own server to use in Claude for Desktop and other clients.

In this tutorial, we’ll build a simple MCP weather server and connect it to a host, Claude for Desktop. We’ll start with a basic setup, and then progress to more complex use cases.

What we’ll be building

Many LLMs (including Claude) do not currently have the ability to fetch the forecast and severe weather alerts. Let’s use MCP to solve that!

We’ll build a server that exposes two tools: get-alerts and get-forecast. Then we’ll connect the server to an MCP host (in this case, Claude for Desktop):



Core MCP Concepts

MCP servers can provide three main types of capabilities:

Resources: File-like data that can be read by clients (like API responses or file contents)
Tools: Functions that can be called by the LLM (with user approval)
Prompts: Pre-written templates that help users accomplish specific tasks
This tutorial will primarily focus on tools.

Let’s get started with building our weather server! You can find the complete code for what we’ll be building here.

Prerequisite knowledge

This quickstart assumes you have familiarity with:

TypeScript
LLMs like Claude
System requirements

For TypeScript, make sure you have the latest version of Node installed.

Set up your environment

First, let’s install Node.js and npm if you haven’t already. You can download them from nodejs.org. Verify your Node.js installation:

For this tutorial, you’ll need Node.js version 16 or higher.

Now, let’s create and set up our project:


mkdir weather
cd weather


npm init -y


npm install @modelcontextprotocol/sdk zod
npm install -D @types/node typescript


mkdir src
touch src/index.ts
Update your package.json to add type: “module” and a build script:

Create a tsconfig.json in the root of your project:

Now let’s dive into building your server.

Building your server

Importing packages and setting up the instance

Add these to the top of your src/index.ts:

Helper functions

Next, let’s add our helper functions for querying and formatting the data from the National Weather Service API:

Implementing tool execution

The tool execution handler is responsible for actually executing the logic of each tool. Let’s add it:

Running the server

Finally, implement the main function to run the server:

Make sure to run npm run build to build your server! This is a very important step in getting your server to connect.

Let’s now test your server from an existing MCP host, Claude for Desktop.

Testing your server with Claude for Desktop

Claude for Desktop is not yet available on Linux. Linux users can proceed to the Building a client tutorial to build an MCP client that connects to the server we just built.

First, make sure you have Claude for Desktop installed. You can install the latest version here. If you already have Claude for Desktop, make sure it’s updated to the latest version.

We’ll need to configure Claude for Desktop for whichever MCP servers you want to use. To do this, open your Claude for Desktop App configuration at ~/Library/Application Support/Claude/claude_desktop_config.json in a text editor. Make sure to create the file if it doesn’t exist.

For example, if you have VS Code installed:

You’ll then add your servers in the mcpServers key. The MCP UI elements will only show up in Claude for Desktop if at least one server is properly configured.

In this case, we’ll add our single weather server like so:

This tells Claude for Desktop:

There’s an MCP server named “weather”
Launch it by running node /ABSOLUTE/PATH/TO/PARENT/FOLDER/weather/build/index.js
Save the file, and restart Claude for Desktop.

Test with commands

Let’s make sure Claude for Desktop is picking up the two tools we’ve exposed in our weather server. You can do this by looking for the hammer  icon:


After clicking on the hammer icon, you should see two tools listed:


If your server isn’t being picked up by Claude for Desktop, proceed to the Troubleshooting section for debugging tips.

If the hammer icon has shown up, you can now test your server by running the following commands in Claude for Desktop:

What’s the weather in Sacramento?
What are the active weather alerts in Texas?


Since this is the US National Weather service, the queries will only work for US locations.

What’s happening under the hood

When you ask a question:

The client sends your question to Claude
Claude analyzes the available tools and decides which one(s) to use
The client executes the chosen tool(s) through the MCP server
The results are sent back to Claude
Claude formulates a natural language response
The response is displayed to you!
Troubleshooting

For more advanced troubleshooting, check out our guide on Debugging MCP

Next steps
