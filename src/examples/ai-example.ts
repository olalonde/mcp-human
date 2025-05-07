// This is a hypothetical example of how an AI model would interact with the MCP Human server
// In a real implementation, this code would be part of the AI model's runtime environment
// and would be built into the model's MCP client

import { createMcpClient } from "hypothetical-mcp-client";

async function runAIWithHumanHelp() {
  // Create an MCP client that connects to our Human server
  const mcpClient = createMcpClient({
    serverUri: "mcp://localhost:3000",
    capabilities: ["tools", "resources"],
    modelName: "gpt-5",
    modelVersion: "1.0.0",
  });

  // Connect to the MCP server
  await mcpClient.connect();

  // AI receives a complex creative task
  const userPrompt =
    "Design a logo for a sustainable energy startup called 'SolarPulse'.";

  console.log(`User prompt: ${userPrompt}`);

  // AI recognizes this is a creative task where human input would be valuable
  console.log("AI: I need some human input for this creative task.");

  // AI defines a specific question for the human
  const question =
    "What visual elements and colors would work well for a logo design for 'SolarPulse', a sustainable energy startup? Please provide 2-3 specific ideas.";

  // AI uses the askHuman tool via MCP
  console.log(`AI: Asking human for input: "${question}"`);

  const humanResponse = await mcpClient.callTool("askHuman", {
    question,
    reward: "0.15",
    title: "Logo design ideas for a sustainable energy startup",
    description: "Provide creative input for a logo design",
    maxWaitSeconds: 300, // Wait up to 5 minutes for a response
  });

  console.log("AI received human input:", humanResponse);

  // If no immediate response, AI can check back later
  if (humanResponse.content[0].text.includes("No response received")) {
    // Extract HIT ID for later checking
    const hitId = humanResponse.content[0].text.match(/HIT ID: ([A-Z0-9]+)/)[1];

    console.log(
      `AI: No immediate response. Will check back later for HIT ${hitId}`,
    );

    // AI could continue with other tasks and check back later
    // Simulating passage of time...
    console.log("Some time passes...");

    // Check status of the HIT
    const hitStatus = await mcpClient.callTool("checkHITStatus", { hitId });
    console.log("AI checked HIT status:", hitStatus);

    // Process any new responses
    if (hitStatus.content[0].text.includes('assignmentsCount": 1')) {
      // Parse the JSON response to get the human answer
      const statusData = JSON.parse(hitStatus.content[0].text);
      if (statusData.assignments && statusData.assignments.length > 0) {
        const humanAnswer = statusData.assignments[0].answer;
        console.log("AI received delayed human response:", humanAnswer);

        // AI would incorporate this feedback into its response
        console.log(
          "AI: Now I can incorporate this human input into my logo design suggestions.",
        );
      }
    }
  } else {
    // AI received an immediate response
    // In a real implementation, parse the response text
    const humanInputText = humanResponse.content[0].text.replace(
      "Human response: ",
      "",
    );

    console.log(
      "AI: Thank you for the human input. I'll incorporate these ideas into my design suggestions.",
    );

    // AI would then incorporate this feedback into its response to the user
    const aiResponse = `Based on human design input and my understanding of sustainable energy branding, here are some logo design concepts for SolarPulse:\n\n${humanInputText}\n\nThese ideas combine modern design elements with sustainable energy themes, creating a memorable visual identity for SolarPulse.`;

    console.log("\nAI final response to user:");
    console.log(aiResponse);
  }

  // Checking account balance (using resource)
  const accountInfo = await mcpClient.getResource("mturk-account://balance");
  console.log("AI checked MTurk account balance:", accountInfo);

  // Disconnect from the MCP server
  await mcpClient.disconnect();
}

// Run the example
runAIWithHumanHelp().catch(console.error);
