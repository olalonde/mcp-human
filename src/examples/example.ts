// Example of how an LLM client would interact with the MCP Human server

// Sample MCP client code (not actual implementation)
// This represents what would happen on the LLM/model side

// Step 1: The LLM recognizes it needs human input
console.log("LLM: I need human assistance to answer this creative question...");

// Step 2: LLM would use the askHuman tool
const humanRequest = {
  question:
    "What's a creative name for a product that helps people remember their dreams?",
  reward: "0.10",
  title: "Help an AI with a creative product name",
  description:
    "Provide a creative and catchy product name for a dream-remembering device",
  timeoutSeconds: 1800, // 30 minutes
};

console.log("LLM: Sending request to human worker:", humanRequest);

// Step 3: The MCP server would create a HIT and wait for a response
console.log("MCP Server: Creating HIT on MTurk...");
console.log("MCP Server: Waiting for human response...");

// Step 4: Simulate response coming back (this would happen asynchronously)
setTimeout(() => {
  console.log("Human Worker: Responding with 'DreamCatcher Pro'");

  // Step 5: LLM receives the response
  console.log("LLM: Received human response 'DreamCatcher Pro'");
  console.log(
    "LLM: Thank you for the creative name suggestion! I'll use 'DreamCatcher Pro' in my response to the user.",
  );
}, 2000);

// Note: In a real implementation, the LLM would:
// 1. Call the askHuman tool via MCP JSON-RPC
// 2. Potentially suspend its execution while waiting for human input
// 3. Continue processing once human input is received
